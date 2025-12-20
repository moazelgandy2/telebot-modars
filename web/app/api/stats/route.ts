
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const [sessionsCount, messagesCount, instructionsCount, subscriptionsCount] = await Promise.all([
      prisma.chatSession.count(),
      prisma.chatMessage.count(),
      prisma.systemInstruction.count(),
      prisma.subscription.count(),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        sessionsCount,
        messagesCount,
        instructionsCount,
        subscriptionsCount
      }
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch stats' },
      { status: 500 }
    );
  }
}
