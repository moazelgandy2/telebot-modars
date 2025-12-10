export interface ChatMessage {
  role: "user" | "model";
  parts: { text: string }[];
}

const MAX_HISTORY = 30;
const sessions = new Map<number, ChatMessage[]>();

export const getHistory = (userId: number): ChatMessage[] => {
  return sessions.get(userId) || [];
};

export const addToHistory = (userId: number, role: "user" | "model", text: string) => {
  const history = sessions.get(userId) || [];
  history.push({ role, parts: [{ text }] });


  if (history.length > MAX_HISTORY) {
    history.splice(0, history.length - MAX_HISTORY);
  }

  sessions.set(userId, history);
};

export const clearHistory = (userId: number) => {
  sessions.delete(userId);
};
