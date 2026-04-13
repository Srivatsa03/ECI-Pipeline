import { getSources } from '../../../lib/db';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const sources = await getSources();
    return NextResponse.json(sources);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
