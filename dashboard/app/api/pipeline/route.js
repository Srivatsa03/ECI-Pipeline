import { NextResponse } from "next/server";
import { query } from "@/lib/db";

// POST — triggers GitHub Actions workflow_dispatch, then polls Supabase for logs
export async function POST(request) {
  try {
    const githubToken = process.env.GITHUB_TOKEN;
    if (!githubToken) {
      return NextResponse.json({ error: "GITHUB_TOKEN not configured" }, { status: 500 });
    }

    // Call GitHub API to trigger the workflow
    // workflow_dispatch lets you fire a workflow from the API, same as clicking "Run workflow" on GitHub
    const ghRes = await fetch(
      "https://api.github.com/repos/Srivatsa03/ECI-Pipeline/actions/workflows/eci-pipeline.yml/dispatches",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${githubToken}`,
          Accept: "application/vnd.github+json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ ref: "main" }),  // run on the main branch
      }
    );

    // GitHub returns 204 No Content on success
    if (ghRes.status !== 204) {
      const err = await ghRes.text();
      return NextResponse.json({ error: `GitHub API error: ${err}` }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: "Pipeline triggered on GitHub Actions" });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// GET — returns latest pipeline job + logs from Supabase (written by pipeline_logger.py)
export async function GET(request) {
  try {
    const latestJob = await query(
      "SELECT * FROM pipeline_jobs ORDER BY id DESC LIMIT 1"
    );

    if (latestJob.length === 0) {
      return NextResponse.json({ job: null, logs: [] });
    }

    const job = latestJob[0];
    const logsResult = await query(
      "SELECT log_line FROM pipeline_logs WHERE job_id = $1 ORDER BY id ASC",
      [job.id]
    );

    return NextResponse.json({ job, logs: logsResult.map(l => l.log_line) });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
