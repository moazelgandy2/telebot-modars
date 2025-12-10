import { config } from "../config.js";

export interface ChatMessage {
  role: "user" | "model";
  parts: { text: string; image_url?: { url: string } }[];
}

export const getHistory = async (userId: number): Promise<ChatMessage[]> => {
  try {
    const res = await fetch(
      `${config.apiBaseUrl}/chat/history?userId=${userId}`,
      {
        cache: "no-store",
      }
    );
    if (!res.ok) return [];

    const messages = (await res.json()) as any[];
    return messages.map((msg: any) => {
      const parts: any[] = [{ text: msg.content }];
      if (msg.imageUrl) {
        // According to OpenAI spec, image_url block is separate or part of content array
        // We will structure it as the prompt generator expects
        // But for getHistory return type, let's keep it simple
        // Actually, let's just return the raw text + imageUrl handling in openai.ts
      }
      return {
        role: msg.role === "user" ? "user" : "model",
        parts: [{ text: msg.content, imageUrl: msg.imageUrl }], // Pass raw imageUrl
      };
    });
  } catch (error) {
    console.error("Error fetching history:", error);
    return [];
  }
};

export const addToHistory = async (
  userId: number,
  role: "user" | "model",
  text: string,
  imageUrl?: string
) => {
  try {
    await fetch(`${config.apiBaseUrl}/chat/history`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: userId.toString(),
        role,
        content: text,
        imageUrl,
      }),
    });
  } catch (error) {
    console.error("Error saving history:", error);
  }
};

export const clearHistory = async (userId: number) => {
  try {
    await fetch(`${config.apiBaseUrl}/chat/history?userId=${userId}`, {
      method: "DELETE",
    });
  } catch (error) {
    console.error("Error clearing history:", error);
  }
};
