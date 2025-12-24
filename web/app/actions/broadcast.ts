"use server";

export async function sendBroadcast(message: string) {
  try {
    const reloadPort = process.env.RELOAD_PORT || 4000;
    const res = await fetch(`http://localhost:${reloadPort}/broadcast`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ message }),
      cache: "no-store",
    });

    const data = await res.json();

    if (!res.ok) {
        return { success: false, error: data.error || "Failed to send broadcast" };
    }

    return {
        success: true,
        data: {
            total: data.total,
            sent: data.sent,
            failed: data.failed
        }
    };

  } catch (error: any) {
    console.error("Broadcast Server Action Error:", error);
    return { success: false, error: error.message };
  }
}
