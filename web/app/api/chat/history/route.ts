import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get("userId");

  try {
    if (userId) {
      // Get history for specific user
      const session = await prisma.chatSession.findUnique({
        where: { userId },
        include: {
          messages: {
            orderBy: { createdAt: "asc" },
            include: { attachments: true }
          },
        },
      });
      return NextResponse.json(session?.messages || []);
    } else {
      // Get all sessions (for list view) with Search & Pagination
      const q = searchParams.get("q") || "";
      const page = parseInt(searchParams.get("page") || "1");
      const limit = parseInt(searchParams.get("limit") || "10");
      const skip = (page - 1) * limit;

      const where: any = {};
      if (q) {
          where.OR = [
              { userId: { contains: q } }, // Prisma default is case-insensitive for strings in Postgres usually, but depends on collation.
              { username: { contains: q, mode: 'insensitive' } } // Explicitly insensitive if possible, or just contains
          ];
      }

      const sessions = await prisma.chatSession.findMany({
        where,
        orderBy: { updatedAt: "desc" },
        take: limit,
        skip: skip,
        select: {
          id: true,
          userId: true,
          username: true,
          updatedAt: true,
          _count: {
             select: { messages: true }
          }
        }
      });
      return NextResponse.json(sessions);
    }
  } catch (error) {
    console.error("Error fetching history:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const { userId, role, content, attachments, username } = await req.json();

    if (!userId || !role) {
      if (!content && (!attachments || attachments.length === 0)) {
           return NextResponse.json(
            { error: "Missing required fields (content or attachments)" },
            { status: 400 }
          );
      }
      if (!userId || !role) {
          return NextResponse.json(
            { error: "Missing required fields" },
            { status: 400 }
          );
      }
    }

    let session = await prisma.chatSession.findUnique({
      where: { userId },
    });

    if (!session) {
      session = await prisma.chatSession.create({
        data: { userId, username },
      });
    } else if (username && session.username !== username) {
       // Update username if it changed
       await prisma.chatSession.update({
           where: { id: session.id },
           data: { username }
       });
    }

    const message = await prisma.chatMessage.create({
      data: {
        sessionId: session.id,
        role,
        content: content || "",
        attachments: {
            create: attachments?.map((att: any) => ({
                url: att.url,
                type: att.type
            }))
        }
      },
      include: { attachments: true }
    });

    // Update session timestamp
    await prisma.chatSession.update({
        where: { id: session.id },
        data: { updatedAt: new Date() }
    });

    return NextResponse.json(message);
  } catch (error) {
    console.error("Error saving message:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
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
     console.error("Error clearing chat history:", error);
     return NextResponse.json({ error: "Failed to clear history" }, { status: 500 });
   }
 }
