// Convert a lint-passed PDP content JSON file into the site's content/pdp-content.ts.
// Usage: node build-content-ts.mjs <content.json> <out.ts>
import { readFileSync, writeFileSync } from 'node:fs';

const [contentPath, outPath] = process.argv.slice(2);
if (!contentPath || !outPath) {
  console.error('Usage: node build-content-ts.mjs <content.json> <out.ts>');
  process.exit(2);
}

const entries = JSON.parse(readFileSync(contentPath, 'utf8'));
const map = {};
// Only these keys exist on PdpContent; strip anything a generator/repair pass
// may have added (e.g. a stray "title") so the emitted TS typechecks.
const ALLOWED = new Set([
  'handle', 'seoTitle', 'metaDescription', 'ogTitle', 'ogDescription',
  'intro', 'faqs', 'imageAlt', 'relatedCollections', 'about',
]);
for (const e of entries) {
  for (const k of Object.keys(e)) if (!ALLOWED.has(k)) delete e[k];
  map[e.handle] = e;
}

const header = `import type { PdpContentMap } from '@dopeart/satellite-pdp';

// Pre-generated differentiation content for this site's product pages.
// One entry per product handle. A product with no entry here gets NO local
// product page (fails closed): its card keeps linking to the parent store.
// Generated in a controlled pass and gated by satellite-pdp/tools/lint-pdp-content.mjs.
// Do not hand-edit without re-running the lint.
export const pdpContent: PdpContentMap = `;

writeFileSync(outPath, header + JSON.stringify(map, null, 2) + ';\n');
console.log(`Wrote ${entries.length} entries to ${outPath}`);
