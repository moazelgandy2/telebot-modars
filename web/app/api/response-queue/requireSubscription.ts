import { NextRequest, NextResponse } from "next/server";

export async function requireSubscription(req: NextRequest) {
  try {
    // Accept userId from body (POST/PUT) or query (GET)
    let userId: string | undefined;
    if (req.method === "GET") {
      const { searchParams } = new URL(req.url);
      userId = searchParams.get("userId") || undefined;
    } else {
      const body = await req.json().catch(() => undefined);
      userId = body?.userId;
    }
    if (!userId) {
      return NextResponse.json({ error: "User ID required" }, { status: 400 });
    }
    // Check subscription status via internal API
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_API_BASE_URL || ""}/api/subscription?userId=${userId}`,
    );
    const json = await res.json();
    if (!json.success || !json.isSubscribed) {
      return NextResponse.json(
        { error: "Subscription required" },
        { status: 403 },
      );
    }
    return null; // OK
  } catch (e) {
    return NextResponse.json(
      { error: "Subscription check failed" },
      { status: 500 },
    );
  }
}
