import { NextResponse } from "next/server";
import { isSupabaseConfigured, supabase, getSupabaseAdminClient } from "@/services/supabase";
import { triggerLineNotification } from "@/services/notification.service";

export async function GET(request: Request) {
  // Simple check for cron authorization
  const { searchParams } = new URL(request.url);
  const secret = searchParams.get("secret");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && secret !== cronSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isSupabaseConfigured) {
    return NextResponse.json({ success: false, reason: "Supabase not configured" });
  }

  const dbClient = getSupabaseAdminClient() || supabase;
  if (!dbClient) {
    return NextResponse.json({ success: false, reason: "Database client not available" });
  }

  try {
    // 1. Get all connected LINE users
    const { data: connectedProfiles, error: profError } = await dbClient
      .from("profiles")
      .select("*")
      .eq("line_connected", true);

    if (profError) throw profError;
    if (!connectedProfiles || connectedProfiles.length === 0) {
      return NextResponse.json({ success: true, message: "No users connected to LINE" });
    }

    const todayLocal = new Date().toLocaleDateString("sv-SE"); // YYYY-MM-DD
    const startOfToday = `${todayLocal}T00:00:00.000Z`;

    let sentCount = 0;

    for (const profile of connectedProfiles) {
      const userId = profile.id;

      // 2. Fetch existing logs for today to prevent duplicate sends
      const { data: todayLogs } = await dbClient
        .from("notification_logs")
        .select("*")
        .eq("user_id", userId)
        .eq("status", "success")
        .gte("created_at", startOfToday);

      const sentTypes = new Set(todayLogs?.map(l => l.notification_type) || []);

      // 3. Check schedules for due/overdue items
      const { data: schedules } = await dbClient
        .from("schedules")
        .select("*, plants:plant_id(name, archived)")
        .eq("user_id", userId);

      if (!schedules) continue;

      let needsWatering = false;
      let needsFertilizer = false;
      const wateringPlants: string[] = [];
      const fertilizerPlants: string[] = [];

      for (const s of schedules) {
        // Cast plants join correctly
        const plant = s.plants as unknown as { name: string; archived: boolean } | null;
        if (!plant || plant.archived) continue;

        // Calculate task status (due / overdue)
        const nextDue = s.next_due_date ? new Date(s.next_due_date) : null;
        if (!nextDue) continue;

        const isDueOrOverdue = nextDue.getTime() <= Date.now();

        if (isDueOrOverdue) {
          if (s.type === "watering") {
            needsWatering = true;
            wateringPlants.push(plant.name);
          } else if (s.type === "fertilizing") {
            needsFertilizer = true;
            fertilizerPlants.push(plant.name);
          }
        }
      }

      // 4. Send Watering Reminders
      if (needsWatering && !sentTypes.has("watering")) {
        const plantsStr = wateringPlants.slice(0, 3).join(", ") + (wateringPlants.length > 3 ? "..." : "");
        const msg = `🪴 Plant Tracker\n\nถึงเวลารดน้ำต้นไม้ของคุณแล้ว: ${plantsStr}\n\nเปิดแอปเพื่อบันทึกประวัติการรดน้ำของคุณได้เลยครับ`;
        const res = await triggerLineNotification(userId, "watering", msg);
        if (res.success) sentCount++;
      }

      // 5. Send Fertilizing Reminders
      if (needsFertilizer && !sentTypes.has("fertilizer")) {
        const plantsStr = fertilizerPlants.slice(0, 3).join(", ") + (fertilizerPlants.length > 3 ? "..." : "");
        const msg = `🌱 Plant Tracker\n\nถึงเวลาใส่ปุ๋ยต้นไม้ของคุณแล้ว: ${plantsStr}\n\nกรุณาใส่ปุ๋ยตามตารางการดูแลเพื่อการเติบโตที่ดีที่สุดครับ`;
        const res = await triggerLineNotification(userId, "fertilizer", msg);
        if (res.success) sentCount++;
      }
    }

    return NextResponse.json({ success: true, sentNotifications: sentCount });
  } catch (err: any) {
    console.error("Cron Sweep Error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
