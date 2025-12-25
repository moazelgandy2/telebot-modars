import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");

  try {
    if (status) {
      // Fetch 'PENDING' broadcasts (Limit 1 to avoid conflicts or process in order)
      const broadcasts = await prisma.broadcast.findMany({
        where: { status },
        orderBy: { createdAt: "asc" },
        take: 1
      });
      return NextResponse.json(broadcasts);
    } else {
      // List all for dashboard?
      const broadcasts = await prisma.broadcast.findMany({
        orderBy: { createdAt: 'desc' },
        take: 20
      });
      return NextResponse.json(broadcasts);
    }
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch broadcasts" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { message, recipients } = await req.json();

    if (!message) {
      return NextResponse.json({ error: "Message is required" }, { status: 400 });
    }

    const broadcast = await prisma.broadcast.create({
      data: {
        message,
        recipients: recipients ? recipients : undefined // Handle JSON/Array
      }
    });

    return NextResponse.json({ success: true, data: broadcast });
  } catch (error) {
    console.error("Create Broadcast Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function PUT(req: Request) {
    try {
        const { id, status, sentCount, failedCount, log } = await req.json();

        if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 });

        const updated = await prisma.broadcast.update({
            where: { id },
            data: {
                status,
                sentCount,
                failedCount,
                log,
                updatedAt: new Date()
            }
        });
        return NextResponse.json({ success: true, data: updated });
    } catch (e) {
        return NextResponse.json({ error: "Update Failed" }, { status: 500 });
    }
}
