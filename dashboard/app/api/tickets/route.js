import { getTickets } from '../../../lib/db';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const tickets = await getTickets();
    return NextResponse.json(tickets);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
