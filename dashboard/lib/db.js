// lib/db.js — data source selector for the SENTINEL console.
//
// The console has two backends and one contract:
//
//   offline (default)  lib/db.offline.js  in-process dataset, no deps at all
//   api                lib/db.api.js      the FastAPI service in ../api
//
// Offline stays the default on purpose. `./run-demo.sh` has to work on a
// laptop with no database, no credentials, and no network. Point the console
// at the real stack with:
//
//   ECI_DATA_SOURCE=api ECI_API_URL=http://localhost:8000 npm run dev
//
// Both modules export the same functions with the same shapes, so nothing
// downstream of this file knows or cares which one is live.

import * as offline from './db.offline';
import * as api from './db.api';

const SOURCE = (process.env.ECI_DATA_SOURCE || 'offline').toLowerCase();

if (SOURCE !== 'offline' && SOURCE !== 'api') {
  throw new Error(
    `ECI_DATA_SOURCE must be "offline" or "api", got "${SOURCE}"`
  );
}

const impl = SOURCE === 'api' ? api : offline;

export const dataSource = SOURCE;

export const query = impl.query;
export const getStats = impl.getStats;
export const getTickets = impl.getTickets;
export const getSources = impl.getSources;
export const getChanges = impl.getChanges;
export const getEvidence = impl.getEvidence;
export const getGraphData = impl.getGraphData;
export const getChatContext = impl.getChatContext;
export const getBenchmarks = impl.getBenchmarks;
