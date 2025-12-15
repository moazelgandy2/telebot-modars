
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';


export async function GET() {
  try {
    console.log('[API] GET /api/faqs called');
    const faqs = await prisma.fAQ.findMany({
      orderBy: { createdAt: 'desc' },
    });
    console.log(`[API] GET /api/faqs: found ${faqs.length} items`);
    console.log(faqs);
    return NextResponse.json({ success: true, data: faqs });
  } catch (error) {
    console.error('Error fetching FAQs:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch FAQs' },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    console.log('[API] POST /api/faqs received:', body);
    const { question, answer, id } = body;

    if (!question || !answer) {
      return NextResponse.json(
        { success: false, error: 'Question and Answer are required' },
        { status: 400 }
      );
    }

    let faq;
    if (id) {
        // Update
        faq = await prisma.fAQ.update({
            where: { id },
            data: { question, answer }
        });
        console.log('[API] POST /api/faqs: FAQ updated:', faq.id);
    } else {
        // Create
        faq = await prisma.fAQ.create({
            data: { question, answer }
        });
        console.log('[API] POST /api/faqs: FAQ created:', faq.id);
    }

    return NextResponse.json({ success: true, data: faq });
  } catch (error) {
    console.error('Error saving FAQ:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to save FAQ' },
      { status: 500 }
    );
  }
}

export async function DELETE(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const id = searchParams.get('id');

        console.log('[API] DELETE /api/faqs called for ID:', id);

        if (!id) {
            return NextResponse.json({ success: false, error: 'ID is required' }, { status: 400 });
        }

        await prisma.fAQ.delete({
            where: { id }
        });

        console.log('[API] DELETE /api/faqs: FAQ deleted successfully');

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error deleting FAQ:', error);
        return NextResponse.json({ success: false, error: 'Failed to delete FAQ' }, { status: 500 });
    }
}
