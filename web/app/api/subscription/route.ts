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
        return NextResponse.json({ success: true, isSubscribed: !!sub, data: sub });
      } else {
         // List all subscriptions
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
    const { userId, name } = body;

    if (!userId) {
      return NextResponse.json({ success: false, error: 'User ID is required' }, { status: 400 });
    }

    const sub = await prisma.subscription.create({
      data: {
        userId,
        name,
      },
    });

    return NextResponse.json({ success: true, data: sub });
  } catch (error) {
      console.error(error);
    return NextResponse.json({ success: false, error: 'Failed to create subscription' }, { status: 500 });
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
