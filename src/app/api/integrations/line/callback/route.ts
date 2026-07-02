import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { isSupabaseConfigured, supabase } from "@/services/supabase";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");
  const errorDescription = searchParams.get("error_description");

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const redirectUri = `${appUrl}/api/integrations/line/callback`;

  // Helper to redirect with query status
  const redirectWithError = (msg: string) => {
    return NextResponse.redirect(`${appUrl}/settings?line=error&msg=${encodeURIComponent(msg)}`);
  };

  if (error) {
    return redirectWithError(errorDescription || "LINE login request was denied");
  }

  // 1. Retrieve OAuth cookies
  const cookieStore = await cookies();
  const savedState = cookieStore.get("line_oauth_state")?.value;
  const userId = cookieStore.get("line_oauth_user_id")?.value;
  const isMock = cookieStore.get("line_oauth_is_mock")?.value === "true";

  // Clear state cookies immediately
  cookieStore.delete("line_oauth_state");
  cookieStore.delete("line_oauth_user_id");
  cookieStore.delete("line_oauth_is_mock");

  if (!code || !state) {
    return redirectWithError("Missing authorization code or state");
  }

  // 2. Validate state (CSRF Protection)
  if (!savedState || savedState !== state) {
    return redirectWithError("Invalid OAuth state validation. Possible CSRF attempt.");
  }

  if (!userId) {
    return redirectWithError("User session has expired. Please try connecting again.");
  }

  const clientId = process.env.LINE_CHANNEL_ID;
  const clientSecret = process.env.LINE_CHANNEL_SECRET;

  if (!clientId || !clientSecret) {
    return redirectWithError("LINE credentials are not configured on the server.");
  }

  try {
    // 3. Exchange code for access token
    const tokenResponse = await fetch("https://api.line.me/oauth2/v2.1/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
        client_id: clientId,
        client_secret: clientSecret,
      }),
    });

    if (!tokenResponse.ok) {
      const errText = await tokenResponse.text();
      throw new Error(`Token exchange failed: ${errText}`);
    }

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;

    // 4. Retrieve LINE Profile
    const profileResponse = await fetch("https://api.line.me/v2/profile", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!profileResponse.ok) {
      const errText = await profileResponse.text();
      throw new Error(`Failed to fetch LINE profile: ${errText}`);
    }

    const profileData = await profileResponse.json();
    const { userId: lineUserId, displayName, pictureUrl } = profileData;

    // 5. Update profile table
    if (isSupabaseConfigured && supabase && !isMock) {
      // Check if this LINE account is already linked to another user
      const { data: existingUser } = await supabase
        .from("profiles")
        .select("id")
        .eq("line_user_id", lineUserId)
        .neq("id", userId)
        .maybeSingle();

      if (existingUser) {
        return redirectWithError("This LINE account is already connected to another Plant Tracker user.");
      }

      const { error: updateError } = await supabase
        .from("profiles")
        .update({
          line_user_id: lineUserId,
          line_display_name: displayName,
          line_picture_url: pictureUrl || null,
          line_connected: true,
          line_connected_at: new Date().toISOString(),
        })
        .eq("id", userId);

      if (updateError) throw updateError;
    } else {
      // Mock mode fallback: Save connection state in client-readable cookies
      cookieStore.set("mock_line_connected", "true", { maxAge: 86400 * 30, path: "/" });
      cookieStore.set("mock_line_display_name", displayName, { maxAge: 86400 * 30, path: "/" });
      cookieStore.set("mock_line_picture_url", pictureUrl || "", { maxAge: 86400 * 30, path: "/" });
    }

    // Redirect with success!
    return NextResponse.redirect(`${appUrl}/settings?line=connected`);
  } catch (err: any) {
    console.error("LINE OAuth Callback Error:", err);
    return redirectWithError(err.message || "An unexpected error occurred during LINE connection.");
  }
}
