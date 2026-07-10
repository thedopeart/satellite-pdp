// Per-batch lint for generated "about" sections (cross-entry uniqueness is checked later at merge).
// Usage: node lint-about-batch.mjs <about-output.json> <validCollectionHandles,csv> <validBlogSlugs,csv>
import { readFileSync } from 'node:fs';

const [outPath, colsCsv, slugsCsv] = process.argv.slice(2);
const items = JSON.parse(readFileSync(outPath, 'utf8'));
const validCollections = new Set((colsCsv ?? '').split(','));
const validSlugs = new Set((slugsCsv ?? '').split(',').filter(Boolean));

const BANNED = new RegExp(
  '\\b(exceptional|unparalleled|cutting-edge|groundbreaking|revolutionary|transformative|remarkable|game-changing|' +
  'leverage|synergy|robust|seamless(?:ly)?|holistic|paradigm|streamline|optimize|utilize|comprehensive|vital|pivotal|' +
  'compelling|intriguing|thought-provoking|incredible|amazing|captivating|exquisite|stunning|majesty|majestic|' +
  'unleash|unlock|empower|embark|delve|foster|harness|elevate(?:s|d)?|furthermore|moreover|additionally|consequently|' +
  'thus|hence|tapestry|multifaceted|meticulous|testament|endeavors|realm|myriad|plethora|paramount|intricate|bespoke|' +
  'curated|masterpiece)\\b|a touch of|whether you|look no further|perfect addition|in today\'s|in the world of|' +
  'it\'s important to note|it\'s worth noting|dive into|rest assured|elevate your|transform your|make a statement|' +
  'not only|when it comes to|at its core|digital download|instant download|high-res file',
  'i',
);

const strip = (s) => (s ?? '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
const failures = [];
for (const it of items) {
  const t = strip(it.about);
  const w = t.split(/\s+/).filter(Boolean).length;
  if (w < 50 || w > 160) failures.push({ handle: it.handle, check: 'length', detail: `${w} words (50-160)` });
  if (/[–—]/.test(it.about)) failures.push({ handle: it.handle, check: 'dashes', detail: 'em/en dash' });
  const b = t.match(BANNED);
  if (b) failures.push({ handle: it.handle, check: 'banned', detail: b[0] });
  const bolds = (it.about.match(/<strong>/g) ?? []).length;
  if (bolds < 2 || bolds > 3) failures.push({ handle: it.handle, check: 'bolds', detail: `${bolds} <strong> (need 2-3)` });
  const links = it.about.match(/<a href="[^"]*">/g) ?? [];
  if (links.length !== 1) failures.push({ handle: it.handle, check: 'links', detail: `${links.length} links (need exactly 1)` });
  for (const tag of it.about.match(/<[^>]+>/g) ?? []) {
    if (!/^<\/?strong>$/.test(tag) && !/^<a href="\/(collections|blog)\/[a-z0-9-]+">$/.test(tag) && tag !== '</a>') {
      failures.push({ handle: it.handle, check: 'html', detail: `disallowed tag: ${tag}` });
    }
  }
  for (const m of it.about.matchAll(/href="\/collections\/([a-z0-9-]+)"/g)) {
    if (!validCollections.has(m[1])) failures.push({ handle: it.handle, check: 'link-target', detail: `unknown collection ${m[1]}` });
  }
  for (const m of it.about.matchAll(/href="\/blog\/([a-z0-9-]+)"/g)) {
    if (!validSlugs.has(m[1])) failures.push({ handle: it.handle, check: 'link-target', detail: `unknown blog slug ${m[1]}` });
  }
}
if (failures.length) {
  failures.forEach((f) => console.log(JSON.stringify(f)));
  console.error(`FAIL: ${failures.length} issue(s)`);
  process.exit(1);
}
console.log(`PASS: ${items.length} about sections clean`);
