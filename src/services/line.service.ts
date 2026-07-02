const LINE_API_URL = "https://api.line.me/v2/bot/message/push";
const channelAccessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN;

async function sendLineMessage(body: object) {
  if (!channelAccessToken) {
    throw new Error("LINE_CHANNEL_ACCESS_TOKEN is not configured");
  }

  const response = await fetch(LINE_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${channelAccessToken}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    let errorMsg = errorText;
    try {
      const errorJson = JSON.parse(errorText || "{}");
      errorMsg = errorJson.message || errorText;
    } catch {
      // Use raw text if not JSON
    }
    const err = new Error(`LINE API failed: ${errorMsg}`);
    (err as any).status = response.status;
    throw err;
  }

  return response.json();
}

export const sendText = async (lineUserId: string, message: string) => {
  return sendLineMessage({
    to: lineUserId,
    messages: [
      {
        type: "text",
        text: message,
      },
    ],
  });
};

export const sendImage = async (lineUserId: string, imageUrl: string) => {
  return sendLineMessage({
    to: lineUserId,
    messages: [
      {
        type: "image",
        originalContentUrl: imageUrl,
        previewImageUrl: imageUrl,
      },
    ],
  });
};

export const sendFlex = async (lineUserId: string, flexPayload: object) => {
  return sendLineMessage({
    to: lineUserId,
    messages: [
      {
        type: "flex",
        altText: "Plant Tracker Notification",
        contents: flexPayload,
      },
    ],
  });
};
