import { getContactData } from '@/app/actions/contact';
import { NextResponse } from 'next/server';

export async function GET() {
  const contact = await getContactData();
  return NextResponse.json(contact);
}
