import { NextResponse } from "next/server";
import { isSupabaseConfigured, supabase, getSupabaseAdminClient } from "@/services/supabase";
import { getUserFromRequest } from "./helper";

// GET CONNECTION STATUS
export async function GET(request: Request) {
  const user = await getUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const isMock = !!request.headers.get("x-mock-user-id");

  if (isSupabaseConfigured && !isMock) {
    const adminClient = getSupabaseAdminClient() || supabase;
    if (!adminClient) {
      return NextResponse.json({ connected: false });
    }

    const { data, error } = await adminClient
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();

    if (error || !data) {
      return NextResponse.json({ connected: false });
    }

    return NextResponse.json({
      connected: data.line_connected || false,
      displayName: data.line_display_name || null,
      pictureUrl: data.line_picture_url || null,
      connectedAt: data.line_connected_at || null,
      preferences: data.notification_preferences || { watering: true, fertilizer: true, plantHealth: true }
    });
  }

  // Local Storage Fallback Mock - retrieve mock LINE values stored in mock headers / query params
  const mockConnected = request.headers.get("x-mock-line-connected") === "true";
  const mockPref = request.headers.get("x-mock-line-preferences");
  let preferences = { watering: true, fertilizer: true, plantHealth: true };
  if (mockPref) {
    try {
      preferences = JSON.parse(mockPref);
    } catch {
      // Ignored fallback
    }
  }

  return NextResponse.json({
    connected: mockConnected,
    displayName: "Google Gardener LINE",
    pictureUrl: "https://api.dicebear.com/7.x/adventurer/svg?seed=mockLineUser",
    connectedAt: new Date().toISOString(),
    preferences
  });
}

// UPDATE NOTIFICATION PREFERENCES
export async function PATCH(request: Request) {
  const user = await getUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const isMock = !!request.headers.get("x-mock-user-id");

  try {
    const body = await request.json();
    const { preferences } = body;

    if (!preferences) {
      return NextResponse.json({ error: "Preferences payload required" }, { status: 400 });
    }

    if (isSupabaseConfigured && !isMock) {
      const adminClient = getSupabaseAdminClient() || supabase;
      if (!adminClient) throw new Error("Database client not available");

      const { error } = await adminClient
        .from("profiles")
        .update({ notification_preferences: preferences })
        .eq("id", user.id);

      if (error) throw error;
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ success: true, mock: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// DISCONNECT LINE ACCOUNT
export async function DELETE(request: Request) {
  const user = await getUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const isMock = !!request.headers.get("x-mock-user-id");

  if (isSupabaseConfigured && !isMock) {
    const adminClient = getSupabaseAdminClient() || supabase;
    if (!adminClient) {
      return NextResponse.json({ error: "Database client not available" }, { status: 500 });
    }

    const { error } = await adminClient
      .from("profiles")
      .update({
        line_connected: false,
        line_user_id: null,
        line_display_name: null,
        line_picture_url: null,
        line_connected_at: null
      })
      .eq("id", user.id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ success: true, mock: true });
}
