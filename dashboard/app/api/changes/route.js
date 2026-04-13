import { getChanges } from '../../../lib/db';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const changes = await getChanges();
    return NextResponse.json(changes);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
