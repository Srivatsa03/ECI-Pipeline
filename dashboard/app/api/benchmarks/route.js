import { NextResponse } from 'next/server';
import { getBenchmarks } from '@/lib/db';

// Serves the RAG evaluation ablation study (DeltaRAG + Graph-RAG) so the
// Analytics page can chart retrieval quality across system variants.
// Reshaping lives in the data layer so this route honours ECI_DATA_SOURCE
// like every other route.
export async function GET() {
  try {
    return NextResponse.json(await getBenchmarks());
  } catch (err) {
    return NextResponse.json(
      { error: err.message, variants: [], byType: [] },
      { status: 500 }
    );
  }
}
