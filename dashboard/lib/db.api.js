// lib/db.api.js — live data access layer for the SENTINEL console.
//
// Reads the FastAPI service (api/main.py) instead of the offline dataset.
// Every export here matches lib/db.offline.js exactly, so the pages and API
// routes are identical either way.
//
// Selected by ECI_DATA_SOURCE=api. See lib/db.js.

import { styleGraph } from './graph-style';

const BASE = (process.env.ECI_API_URL || 'http://localhost:8000').replace(/\/$/, '');
const TIMEOUT_MS = Number(process.env.ECI_API_TIMEOUT_MS || 8000);

async function request(path, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${BASE}${path}`, {
      ...options,
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
      cache: 'no-store',
    });
    if (!res.ok) {
      throw new Error(`ECI API ${path} responded ${res.status}`);
    }
    return await res.json();
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new Error(`ECI API ${path} timed out after ${TIMEOUT_MS}ms`);
    }
    // A connection refused here almost always means the service isn't running.
    throw new Error(`ECI API ${path} unreachable at ${BASE}: ${err.message}`);
  } finally {
    clearTimeout(timer);
  }
}

// Kept so any legacy `query()` import keeps compiling.
export async function query() {
  return [];
}

export async function getStats() {
  return request('/api/stats');
}

export async function getTickets() {
  return request('/api/tickets');
}

export async function getSources() {
  return request('/api/sources');
}

export async function getChanges() {
  return request('/api/changes');
}

export async function getEvidence(chunkIds) {
  if (!chunkIds || chunkIds.length === 0) return [];
  return request('/api/evidence', {
    method: 'POST',
    body: JSON.stringify({ chunkIds }),
  });
}

export async function getGraphData() {
  return styleGraph(await request('/api/graph'));
}

export async function getChatContext() {
  return request('/api/chat-context');
}

export async function getBenchmarks() {
  return request('/api/benchmarks');
}
