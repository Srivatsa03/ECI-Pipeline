import { getGraphData } from '../../../lib/db';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  try {
    const graph = await getGraphData();
    console.log('[API /graph] nodes:', graph.nodes?.length, 'links:', graph.links?.length);
    return NextResponse.json(graph);
  } catch (error) {
    console.error('[API /graph] Error:', error);
    return NextResponse.json({ error: error.message, nodes: [], links: [] }, { status: 500 });
  }
}
