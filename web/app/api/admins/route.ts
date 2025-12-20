import { prisma } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

export async function GET() {
  try {
    const admins = await prisma.admin.findMany({
      orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json({ success: true, data: admins });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to fetch admins' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { userId, name, role, permissions } = body;

    if (!userId) {
      return NextResponse.json({ success: false, error: 'User ID is required' }, { status: 400 });
    }

    const existing = await prisma.admin.findUnique({ where: { userId } });
    if (existing) {
        return NextResponse.json({ success: false, error: 'Admin already exists' }, { status: 400 });
    }

    const admin = await prisma.admin.create({
      data: {
        userId,
        name,
        role: role || 'ADMIN',
        permissions: permissions || []
      },
    });

    return NextResponse.json({ success: true, data: admin });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to add admin' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get('userId');

  if (!userId) {
    return NextResponse.json({ success: false, error: 'User ID is required' }, { status: 400 });
  }

  try {
    await prisma.admin.delete({ where: { userId } });
    return NextResponse.json({ success: true, message: 'Admin deleted' });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to delete admin' }, { status: 500 });
  }
}
