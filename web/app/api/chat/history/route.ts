import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get("userId");

  if (!userId) {
    return NextResponse.json({ error: "userId is required" }, { status: 400 });
  }

  try {
    const session = await prisma.chatSession.findUnique({
      where: { userId },
      include: {
        messages: {
          orderBy: { createdAt: "asc" },
        },
      },
    });

    return NextResponse.json(session?.messages || []);
  } catch (error) {
    console.error("Error fetching chat history:", error);
    return NextResponse.json({ error: "Failed to fetch history" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { userId, role, content } = await req.json();

    if (!userId || !role || !content) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Upsert session (create if not exists)
    const session = await prisma.chatSession.upsert({
      where: { userId },
      update: {},
      create: { userId },
    });

    // Add message
    const message = await prisma.chatMessage.create({
      data: {
        sessionId: session.id,
        role,
        content,
      },
      // Select minimal fields for performance
      select: {
         id: true,
         role: true,
         content: true,
         createdAt: true
      }
    });

    return NextResponse.json(message);
  } catch (error) {
    console.error("Error saving chat message:", error);
    return NextResponse.json({ error: "Failed to save message" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
   const { searchParams } = new URL(req.url);
   const userId = searchParams.get("userId");

   if (!userId) {
     return NextResponse.json({ error: "userId is required" }, { status: 400 });
   }

   try {
     await prisma.chatSession.delete({
       where: { userId },
     });

     return NextResponse.json({ success: true });
   } catch (error) {
     // If record not found, generic 404 or just success is fine.
     // Prisma throws if delete fails.
     console.error("Error clearing chat history:", error);
     return NextResponse.json({ error: "Failed to clear history" }, { status: 500 });
   }
 }
