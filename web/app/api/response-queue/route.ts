import { prisma } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status') || 'PENDING';

    // Fetch pending responses that are due soon (plus a 5s buffer for the worker)
    const responses = await prisma.pendingResponse.findMany({
      where: {
        status,
        scheduledFor: {
          lte: new Date(Date.now() + 5000)
        }
      },
      orderBy: { scheduledFor: 'asc' }
    });

    return NextResponse.json(responses);
  } catch (error) {
    console.error('Queue Fetch Error:', error);
    return NextResponse.json({ error: 'Failed to fetch queue' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { userId, message, replyToMsgId, scheduledFor } = body;

    const pending = await prisma.pendingResponse.create({
      data: {
        userId: String(userId),
        message,
        replyToMsgId: replyToMsgId ? Number(replyToMsgId) : null,
        scheduledFor: new Date(scheduledFor),
        status: 'PENDING'
      }
    });

    return NextResponse.json({ success: true, data: pending });
  } catch (error) {
    console.error('Queue Create Error:', error);
    return NextResponse.json({ error: 'Failed to queue response' }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const body = await req.json();
    const { id, status, typingStatus } = body;

    const updated = await prisma.pendingResponse.update({
      where: { id },
      data: {
        ...(status && { status }),
        ...(typingStatus !== undefined && { typingStatus })
      }
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    console.error('Queue Update Error:', error);
    return NextResponse.json({ error: 'Failed to update queue' }, { status: 500 });
  }
}
