import { getFaqs } from '@/app/actions/faqs';
import { NextResponse } from 'next/server';

export async function GET() {
  const faqs = await getFaqs();
  return NextResponse.json(faqs);
}
