import { config } from "../config.js";

export interface ChatMessage {
  role: "user" | "model" | "assistant";
  parts: { text: string; image_url?: { url: string } }[];
}

export const getHistory = async (userId: string | number): Promise<{ messages: ChatMessage[], summary?: string, metadata?: any }> => {
  try {
    const res = await fetch(
      `${config.apiBaseUrl}/chat/history?userId=${userId}`,
      {
        cache: "no-store",
      }
    );
    if (!res.ok) return { messages: [] };

    const data = await res.json();
    let rawMessages: any[] = [];
    let summary: string | undefined = undefined;
    let metadata: any | undefined = undefined;

    if (Array.isArray(data)) {
        rawMessages = data; // Legacy fallback
    } else {
        rawMessages = data.messages || [];
        summary = data.summary;
        metadata = data.metadata;
    }

    const messages = rawMessages.map((msg: any) => {
      const parts: any[] = [];

      // 1. Text Content
      if (msg.content) {
          parts.push({ text: msg.content });
      }

      // 2. Attachments (New Schema)
      if (msg.attachments && Array.isArray(msg.attachments)) {
          msg.attachments.forEach((att: any) => {
              if (att.type?.startsWith('image/') || att.url.match(/\.(jpeg|jpg|gif|png|webp)$/i)) {
                  parts.push({ image_url: { url: att.url } });
              } else {
                  // Non-image attachments (Video/PDF) -> Append as text context
                  parts.push({ text: `\n[Attachment: ${att.type || 'file'} - ${att.url}]` });
              }
          });
      }

      // 3. Legacy ImageUrl (Old Schema)
      if (msg.imageUrl) {
          parts.push({ image_url: { url: msg.imageUrl } });
      }

      // Fallback if empty (shouldn't happen often)
      if (parts.length === 0) parts.push({ text: "" });

      return {
        role: msg.role === "user" ? "user" : (msg.role === "assistant" ? "assistant" : "model"),
        parts: parts,
      };
    });

    return { messages, summary, metadata };
  } catch (error) {
    console.error("Error fetching history:", error);
    return { messages: [] };
  }
};

export const addToHistory = async (
  userId: string | number,
  role: "user" | "model" | "assistant",
  text: string,
  username?: string,
  attachments?: { url: string; type: string }[]
) => {
  try {
    await fetch(`${config.apiBaseUrl}/chat/history`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: userId.toString(),
        role,
        content: text,
        username,
        attachments,
      }),
    });
  } catch (error) {
    console.error("Error saving history:", error);
  }
};

export const clearHistory = async (userId: string | number) => {
  try {
    await fetch(`${config.apiBaseUrl}/chat/history?userId=${userId}`, {
      method: "DELETE",
    });
  } catch (error) {
    console.error("Error clearing history:", error);
  }
};

export const updateSession = async (
    userId: string | number,
    updates: { summary?: string, metadata?: any }
) => {
    try {
        await fetch(`${config.apiBaseUrl}/chat/history`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                userId: userId.toString(),
                role: "system",
                content: "", // Empty to skip creating visible message if API allowed it, but API requires logic.
                // We rely on API processing summary/metadata even if content is empty.
                ...updates
            }),
        });
    } catch (e) { console.error("Update Session Error", e); }
};
