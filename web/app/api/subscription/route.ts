import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId');

  try {
      if (userId) {
        // Check specific subscription
        const sub = await prisma.subscription.findUnique({
          where: { userId },
        });

        const now = new Date();
        const isValid = sub && sub.startDate <= now && (!sub.endDate || sub.endDate >= now);

        return NextResponse.json({ success: true, isSubscribed: !!isValid, data: sub });
      } else {
         const subs = await prisma.subscription.findMany({
             orderBy: { createdAt: 'desc' }
         });
         return NextResponse.json({ success: true, data: subs });
      }

  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to fetch subscription' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { userId, name, startDate, endDate } = body;

    if (!userId || !startDate || !endDate) {
      return NextResponse.json({ success: false, error: 'User ID, Start Date, and End Date are required' }, { status: 400 });
    }

    const sub = await prisma.subscription.create({
      data: {
        userId,
        name,
        startDate: new Date(startDate),
        endDate: new Date(endDate)
      },
    });

    return NextResponse.json({ success: true, data: sub });
  } catch (error) {
      console.error(error);
    return NextResponse.json({ success: false, error: 'Failed to create subscription' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { userId, startDate, endDate } = body;

    if (!userId) {
      return NextResponse.json({ success: false, error: 'User ID is required' }, { status: 400 });
    }

    const dataToUpdate: any = {};
    if (startDate) dataToUpdate.startDate = new Date(startDate);
    if (endDate) dataToUpdate.endDate = new Date(endDate);

    const sub = await prisma.subscription.update({
      where: { userId },
      data: dataToUpdate,
    });

    return NextResponse.json({ success: true, data: sub });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ success: false, error: 'Failed to update subscription' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId');

  if (!userId) {
    return NextResponse.json({ success: false, error: 'User ID is required' }, { status: 400 });
  }

  try {
    await prisma.subscription.delete({
      where: { userId },
    });

    return NextResponse.json({ success: true, message: 'Subscription removed' });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to remove subscription' }, { status: 500 });
  }
}
