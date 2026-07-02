import { NextResponse } from "next/server";
import crypto from "crypto";

export async function POST(request: Request) {
  const bodyText = await request.text();
  const signature = request.headers.get("x-line-signature");
  const channelSecret = process.env.LINE_CHANNEL_SECRET;

  if (!channelSecret) {
    return NextResponse.json({ error: "LINE_CHANNEL_SECRET not configured" }, { status: 500 });
  }

  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  // Verify Signature using HMAC-SHA256
  const hash = crypto
    .createHmac("sha256", channelSecret)
    .update(bodyText)
    .digest("base64");

  if (hash !== signature) {
    console.warn("LINE Webhook signature verification failed.");
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  try {
    const payload = JSON.parse(bodyText);
    const events = payload.events || [];

    for (const event of events) {
      console.log(`LINE Webhook Event: ${event.type}`, event);
      // Here you could parse custom user replies or message payloads if needed.
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
