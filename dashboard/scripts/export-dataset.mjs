// export-dataset.mjs — dump the console's offline dataset to JSON.
//
// The curated intelligence feed lives in `lib/data.js` because the console has
// to run with no database. The API needs the same rows in Postgres, and two
// hand-maintained copies is how they drift. So: export once, seed from the
// export.
//
//   node scripts/export-dataset.mjs
//
// Writes ../../data/{demo_dataset,knowledge_graph,ablation_results}.json.
//
// `lib/data.js` is written for the Next compiler: plain `.js` in a package with
// no "type": "module", and a bare JSON import. Plain Node resolves it as CJS
// and rejects both. Rather than reshape a file the app depends on, we compile a
// throwaway ESM copy next to it (so relative paths still resolve) and import
// that.

import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const LIB = resolve(HERE, '../lib');
const OUT_DIR = resolve(HERE, '../../data');
const SHIM = resolve(LIB, '.data.export.mjs');

const JSON_IMPORT = /^import\s+(\w+)\s+from\s+['"](.+\.json)['"];?$/gm;

const source = await readFile(resolve(LIB, 'data.js'), 'utf8');
const shimmed = source.replace(
  JSON_IMPORT,
  (_m, binding, path) =>
    `const ${binding} = JSON.parse(await (await import('node:fs/promises'))` +
    `.readFile(new URL('${path}', import.meta.url), 'utf8'));`
);

await writeFile(SHIM, shimmed);

try {
  const data = await import(pathToFileURL(SHIM).href);
  const { SOURCES, CHANGES, RECOMMENDATIONS, GRAPH_RAW, ABLATION } = data;

  await mkdir(OUT_DIR, { recursive: true });

  const write = async (name, payload) => {
    await writeFile(resolve(OUT_DIR, name), JSON.stringify(payload, null, 2));
    console.log(`  wrote ${name}`);
  };

  await write('demo_dataset.json', {
    sources: SOURCES,
    changes: CHANGES,
    recommendations: RECOMMENDATIONS,
  });
  await write('knowledge_graph.json', GRAPH_RAW);
  await write('ablation_results.json', ABLATION);

  console.log(
    `\n${SOURCES.length} sources, ${CHANGES.length} changes, ` +
      `${RECOMMENDATIONS.length} tickets -> data/`
  );
} finally {
  await rm(SHIM, { force: true });
}
