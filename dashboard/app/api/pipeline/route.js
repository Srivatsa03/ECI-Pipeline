import { NextResponse } from 'next/server';
import { getStats } from '@/lib/db';

// Offline pipeline endpoint.
//
// The live, streaming multi-agent run is driven entirely client-side by
// components/LivePipeline.js so the demo needs no GitHub token, no Supabase,
// and no network. This route just reports the last known pipeline summary so
// any legacy poller keeps working.
export async function GET() {
  try {
    const stats = await getStats();
    return NextResponse.json({
      job: {
        id: 128,
        status: 'completed',
        mode: 'local',
        finished_at: new Date('2026-07-07T08:42:00Z').toISOString(),
      },
      stats,
      logs: [],
    });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST() {
  return NextResponse.json({
    success: true,
    mode: 'local',
    message: 'Pipeline runs locally in the browser — see the live console on the dashboard.',
  });
}
