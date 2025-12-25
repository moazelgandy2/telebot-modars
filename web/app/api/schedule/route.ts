import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(req: NextRequest) {
  try {
    const schedules = await prisma.scheduledBroadcast.findMany({
      orderBy: { createdAt: 'desc' }
    });
    return NextResponse.json(schedules);
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch schedules" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { message, time } = await req.json();

    if (!message || !time) {
      return NextResponse.json({ error: "Message and Time are required" }, { status: 400 });
    }

    const schedule = await prisma.scheduledBroadcast.create({
      data: {
        message,
        time // "HH:MM"
      }
    });

    return NextResponse.json({ success: true, data: schedule });
  } catch (error) {
    console.error("Create Schedule Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function PUT(req: Request) {
    try {
        const { id, lastRunAt, isActive } = await req.json();

        if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 });

        const data: any = { updatedAt: new Date() };
        if (lastRunAt) data.lastRunAt = lastRunAt;
        if (typeof isActive === 'boolean') data.isActive = isActive;

        const updated = await prisma.scheduledBroadcast.update({
            where: { id },
            data: data
        });
        return NextResponse.json({ success: true, data: updated });
    } catch (e) {
        return NextResponse.json({ error: "Update Failed" }, { status: 500 });
    }
}

export async function DELETE(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 });

    try {
        await prisma.scheduledBroadcast.delete({ where: { id } });
        return NextResponse.json({ success: true });
    } catch (e) {
        return NextResponse.json({ error: "Delete Failed" }, { status: 500 });
    }
}
