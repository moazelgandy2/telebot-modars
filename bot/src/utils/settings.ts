import { config } from "../config.js";

interface WorkingHours {
  start: string; // HH:MM
  end: string;   // HH:MM
}

let cachedSettings: Record<string, string> | null = null;
let lastFetch = 0;
const CACHE_TTL = 60 * 1000; // 1 Minute

export const clearSettingsCache = () => {
  cachedSettings = null;
  lastFetch = 0;
};

export const getSettings = async (): Promise<Record<string, string>> => {
  const now = Date.now();
  if (cachedSettings && (now - lastFetch < CACHE_TTL)) {
    return cachedSettings;
  }

  try {
    const res = await fetch(`${config.apiBaseUrl}/settings`);
    const json: any = await res.json();
    if (json.success && json.data) {
      cachedSettings = json.data;
      lastFetch = now;
      return cachedSettings!;
    }
  } catch (e) {
    console.error("Failed to fetch settings:", e);
  }
  return cachedSettings || {};
};

export const getWorkingHours = async (): Promise<WorkingHours | null> => {
  const settings = await getSettings();
  const start = settings["aiWorkStart"];
  const end = settings["aiWorkEnd"];

  if (start && end) {
    return { start, end };
  }
  return null;
};

export const isWithinWorkingHours = async (): Promise<boolean> => {
  const hours = await getWorkingHours();
  if (!hours) return true; // Default to always open if not set

  try {
    // Current time in Egypt (strictly)
    const now = new Date();
    const egyptTimeStr = now.toLocaleTimeString("en-GB", { timeZone: "Africa/Cairo", hour12: false, hour: "2-digit", minute: "2-digit" });
    const [currentH, currentM] = egyptTimeStr.split(':').map(Number);
    const currentTotal = currentH * 60 + currentM;

    const [startH, startM] = hours.start.split(':').map(Number);
    const startTotal = startH * 60 + startM;

    const [endH, endM] = hours.end.split(':').map(Number);
    const endTotal = endH * 60 + endM;

    // Case 1: Standard Day (e.g. 08:00 to 22:00)
    if (startTotal < endTotal) {
      return currentTotal >= startTotal && currentTotal < endTotal;
    }
    // Case 2: Overnight (e.g. 22:00 to 08:00)
    else {
      return currentTotal >= startTotal || currentTotal < endTotal;
    }
  } catch (e) {
    console.error("Time calc error:", e);
    return true; // Fail open
  }
};

export const isBotActive = async (): Promise<boolean> => {
  const settings = await getSettings();
  return settings["botActive"] !== "false"; // Default to true
};

export const getReplyTarget = async (): Promise<'all' | 'subscribers'> => {
  const settings = await getSettings();
  return (settings["replyTarget"] as 'all' | 'subscribers') || 'all';
};

export const getResponseDelay = async (): Promise<number> => {
  const settings = await getSettings();
  const delay = settings["responseDelay"];
  return delay ? parseInt(delay, 10) : 0; // Default to 0 seconds
};
