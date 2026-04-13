import { getEvidence } from '../../../lib/db';
import { NextResponse } from 'next/server';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const ids = searchParams.get('ids');
    if (!ids) return NextResponse.json([]);

    const chunkIds = ids.split(',').filter(Boolean);
    const results = await getEvidence(chunkIds);
    return NextResponse.json(results);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
