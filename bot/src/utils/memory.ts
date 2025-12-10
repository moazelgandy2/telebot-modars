import { config } from "../config.js";

export interface ChatMessage {
  role: "user" | "model";
  parts: { text: string }[];
}

export const getHistory = async (userId: number): Promise<ChatMessage[]> => {
  try {
    const res = await fetch(`${config.apiBaseUrl}/chat/history?userId=${userId}`, {
      cache: "no-store",
    });
    if (!res.ok) return [];

    const messages = await res.json() as any[];
    return messages.map((msg: any) => ({
      role: msg.role === "user" ? "user" : "model",
      parts: [{ text: msg.content }],
    }));
  } catch (error) {
    console.error("Error fetching history:", error);
    return [];
  }
};

export const addToHistory = async (userId: number, role: "user" | "model", text: string) => {
  try {
    await fetch(`${config.apiBaseUrl}/chat/history`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: userId.toString(), role, content: text }),
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
