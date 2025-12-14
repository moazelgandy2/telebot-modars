import { NextResponse } from 'next/server';

export async function POST() {
  const BOT_URL = process.env.BOT_URL || "http://localhost:4000";
  try {
    const response = await fetch(`${BOT_URL}/reload`, { method: "POST" });
    if (!response.ok) {
        throw new Error("Bot reload server returned validation error");
    }
    return NextResponse.json({ success: true, message: "Bot reloaded" });
  } catch (error) {
    console.error("Error reloading bot:", error);
    return NextResponse.json(
      { success: false, error: 'Failed to reload bot. Is it running?' },
      { status: 500 }
    );
  }
}
