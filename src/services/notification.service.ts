import { sendText } from "./line.service";
import { isSupabaseConfigured, supabase } from "./supabase";

export type NotificationType = "watering" | "fertilizer" | "plantHealth";

export const triggerLineNotification = async (
  userId: string,
  type: NotificationType,
  message: string
) => {
  let profile: any = null;
  try {
    // 1. Get user profile to check connection and preferences
    if (isSupabaseConfigured && supabase) {
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .single();
      profile = data;
    } else {
      // Local storage fallback mock check (when running on client)
      if (typeof window !== "undefined") {
        const stored = localStorage.getItem("plant_tracker_mock_session");
        if (stored) {
          const session = JSON.parse(stored);
          if (session && session.id === userId) {
            profile = session;
          }
        }
      }
    }

    if (!profile || !profile.line_connected || !profile.line_user_id) {
      return { success: false, reason: "LINE not connected" };
    }

    // 2. Check preferences
    const prefs = profile.notification_preferences || { watering: true, fertilizer: true, plantHealth: true };
    if (!prefs[type]) {
      return { success: false, reason: "Notification type disabled in preferences" };
    }

    // 3. Send message
    await sendText(profile.line_user_id, message);
    
    // Log success
    await logNotificationAttempt({
      user_id: userId,
      line_user_id: profile.line_user_id,
      notification_type: type,
      status: "success",
      response_code: 200,
    });

    return { success: true };
  } catch (err: any) {
    console.error("Failed to send LINE notification:", err);
    
    // Log failure
    try {
      const lineUserId = profile?.line_user_id || "";
      await logNotificationAttempt({
        user_id: userId,
        line_user_id: lineUserId,
        notification_type: type,
        status: "failed",
        response_code: err.status || 500,
        error_message: err.message || "Unknown error",
      });
    } catch (logErr) {
      console.error("Failed to write notification log:", logErr);
    }

    // Failures must NOT interrupt main application flow, so return gracefully!
    return { success: false, reason: err.message };
  }
};

const logNotificationAttempt = async (log: {
  user_id: string;
  line_user_id: string;
  notification_type: NotificationType;
  status: "success" | "failed";
  response_code?: number;
  error_message?: string;
}) => {
  if (isSupabaseConfigured && supabase) {
    await supabase.from("notification_logs").insert({
      user_id: log.user_id,
      line_user_id: log.line_user_id,
      notification_type: log.notification_type,
      status: log.status,
      response_code: log.response_code || null,
      error_message: log.error_message || null,
    });
  } else {
    // Save to local storage for local testing
    if (typeof window !== "undefined") {
      const logs = JSON.parse(localStorage.getItem("plant_tracker_notification_logs") || "[]");
      logs.push({
        id: crypto.randomUUID(),
        ...log,
        created_at: new Date().toISOString(),
      });
      localStorage.setItem("plant_tracker_notification_logs", JSON.stringify(logs));
    }
  }
};
