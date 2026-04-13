import { NextResponse } from "next/server";
import { query } from "@/lib/db";

export async function POST(request) {
  try {
    // Check if there is already a pending or running job
    const active = await query(
      "SELECT id FROM pipeline_jobs WHERE status IN ('pending', 'running') ORDER BY id DESC LIMIT 1"
    );
    
    if (active.length > 0) {
      return NextResponse.json(
        { error: "A pipeline job is already active.", jobId: active[0].id },
        { status: 400 }
      );
    }

    // Create a new job
    const result = await query(
      "INSERT INTO pipeline_jobs (status) VALUES ('pending') RETURNING *"
    );

    return NextResponse.json({ success: true, job: result[0] });
  } catch (err) {
    console.error("Error creating pipeline job:", err);
    return NextResponse.json({ error: "Failed to trigger pipeline" }, { status: 500 });
  }
}

export async function GET(request) {
  try {
    // Get the most recent job
    const latestJob = await query(
      "SELECT * FROM pipeline_jobs ORDER BY id DESC LIMIT 1"
    );

    if (latestJob.length === 0) {
      return NextResponse.json({ job: null });
    }

    const job = latestJob[0];
    let logs = [];

    // If there is an active job or the latest finishes, retrieve its logs
    if (job.status !== "pending") {
      const logsResult = await query(
        "SELECT log_line FROM pipeline_logs WHERE job_id = $1 ORDER BY id ASC",
        [job.id]
      );
      logs = logsResult.map(l => l.log_line);
    }

    return NextResponse.json({ job, logs });
  } catch (err) {
    console.error("Error fetching pipeline status:", err);
    return NextResponse.json({ error: "Failed to fetch status" }, { status: 500 });
  }
}
