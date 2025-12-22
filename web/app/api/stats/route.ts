import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET() {
  try {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const threeDaysFromNow = new Date();
    threeDaysFromNow.setDate(now.getDate() + 3);

    const [total, active, expiring, expired, newSubsToday, messagesToday, activeUsersToday] = await Promise.all([
      // 1. Total Subscriptions
      prisma.subscription.count(),

      // 2. Active Subscriptions
      prisma.subscription.count({
        where: {
          startDate: { lte: now },
          endDate: { gte: now }
        }
      }),

      // 3. Expiring Soon (Next 3 Days)
      prisma.subscription.count({
        where: {
          endDate: {
            gt: now,
            lte: threeDaysFromNow
          }
        }
      }),

      // 4. Expired Subscriptions
      prisma.subscription.count({
        where: {
          endDate: { lt: now }
        }
      }),

      // 5. New Subscriptions Today
      prisma.subscription.count({
        where: {
          createdAt: { gte: startOfDay }
        }
      }),

      // 6. Messages Today (Volume)
      prisma.chatMessage.count({
         where: { createdAt: { gte: startOfDay } }
      }),

      // 7. Active Users Today (Approximate via distinct sessions in messages)
      prisma.chatMessage.findMany({
          where: { createdAt: { gte: startOfDay } },
          select: { sessionId: true },
          distinct: ['sessionId']
      }).then(res => res.length)
    ]);

    return NextResponse.json({
      success: true,
      data: {
        total,
        active,
        expiring,
        expired,
        newSubsToday,
        messagesToday,
        activeUsersToday
      }
    });

  } catch (error) {
    console.error("Stats Error:", error);
    return NextResponse.json({ success: false, error: 'Failed to fetch stats' }, { status: 500 });
  }
}
