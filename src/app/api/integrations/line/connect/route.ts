import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getUserFromRequest } from "../helper";

export async function POST(request: Request) {
  const user = await getUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const clientId = process.env.LINE_CHANNEL_ID;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const redirectUri = `${appUrl}/api/integrations/line/callback`;

  if (!clientId) {
    return NextResponse.json({ error: "LINE_CHANNEL_ID is not configured" }, { status: 500 });
  }

  const state = crypto.randomUUID();
  const authHeader = request.headers.get("Authorization");
  const isMock = !authHeader || !authHeader.startsWith("Bearer ");

  // Set secure HTTP-only cookies
  const cookieStore = await cookies();
  cookieStore.set("line_oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    maxAge: 300, // 5 minutes
    path: "/",
  });
  cookieStore.set("line_oauth_user_id", user.id, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    maxAge: 300, // 5 minutes
    path: "/",
  });
  if (isMock) {
    cookieStore.set("line_oauth_is_mock", "true", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: 300,
      path: "/",
    });
  }

  const authUrl = `https://access.line.me/oauth2/v2.1/authorize?response_type=code&client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}&scope=profile%20openid`;

  return NextResponse.json({ url: authUrl });
}
