// Lint gate for generated PDP differentiation content.
// Usage: node lint-pdp-content.mjs <content.json> <catalog.json> <validCollectionHandles,csv>
//
// content.json: array of PdpContent entries (see src/types.ts)
// catalog.json: the grounding dump (handle, title, parentDescriptionText, ...)
// Exit 0 only when every entry passes every check. Failures are machine-readable JSON lines.

import { readFileSync } from 'node:fs';

const [contentPath, catalogPath, validHandlesCsv, validBlogSlugsCsv] = process.argv.slice(2);
if (!contentPath || !catalogPath || !validHandlesCsv) {
  console.error('Usage: node lint-pdp-content.mjs <content.json> <catalog.json> <validCollectionHandles,csv> [validBlogSlugs,csv]');
  process.exit(2);
}

const entries = JSON.parse(readFileSync(contentPath, 'utf8'));
const catalog = JSON.parse(readFileSync(catalogPath, 'utf8'));
const validCollections = new Set(validHandlesCsv.split(','));
const validBlogSlugs = new Set((validBlogSlugsCsv ?? '').split(',').filter(Boolean));

function stripTags(s) {
  return (s ?? '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}
const catalogByHandle = new Map(catalog.map((p) => [p.handle, p]));

const BANNED = new RegExp(
  '\\b(exceptional|unparalleled|cutting-edge|groundbreaking|revolutionary|transformative|remarkable|game-changing|' +
  'leverage|synergy|robust|seamless(?:ly)?|holistic|paradigm|streamline|optimize|utilize|comprehensive|vital|pivotal|' +
  'compelling|intriguing|thought-provoking|incredible|amazing|captivating|exquisite|stunning|majesty|majestic|' +
  'unleash|unlock|empower|embark|delve|foster|harness|elevate(?:s|d)?|furthermore|moreover|additionally|consequently|' +
  'thus|hence|tapestry|multifaceted|meticulous|testament|endeavors|realm|myriad|plethora|paramount|intricate|bespoke|' +
  'curated|masterpiece)\\b|a touch of|whether you|look no further|perfect addition|in today\'s|in the world of|' +
  'it\'s important to note|it\'s worth noting|dive into|rest assured|elevate your|transform your|make a statement|' +
  'not only|when it comes to|at its core|take .{1,30} to the next level|digital download|instant download|high-res file',
  'i',
);

const BAD_OPENERS = /^(welcome to|introducing|looking for|are you|do you|have you|imagine)\b/i;
const QUESTION_OPENER = /^[^.!?]*\?/;

function words(s) {
  return s.toLowerCase().replace(/[^a-z0-9\s']/g, ' ').split(/\s+/).filter(Boolean);
}

function ngrams(s, n) {
  const w = words(s);
  const grams = new Set();
  for (let i = 0; i + n <= w.length; i++) grams.add(w.slice(i, i + n).join(' '));
  return grams;
}

function textOf(e) {
  return [e.intro, stripTags(e.about), ...(e.faqs ?? []).flatMap((f) => [f.question, f.answer])].join('\n');
}

const failures = [];
function fail(handle, check, detail) {
  failures.push({ handle, check, detail });
}

// ---- per-entry checks ----
const seenTitles = new Map();
const seenMeta = new Map();
const seenOpeners = new Map();
const seenFaqQuestions = new Map();

for (const e of entries) {
  const h = e.handle;
  const all = [e.seoTitle, e.metaDescription, e.ogTitle, e.ogDescription, e.intro, e.imageAlt, stripTags(e.about),
    ...(e.faqs ?? []).flatMap((f) => [f.question, f.answer])].filter(Boolean).join('\n');

  // about: HTML-lite validation
  if (e.about) {
    const aw = words(stripTags(e.about)).length;
    if (aw < 50 || aw > 160) fail(h, 'about-length', `${aw} words (50-160)`);
    for (const tag of e.about.match(/<[^>]+>/g) ?? []) {
      if (!/^<\/?strong>$/.test(tag) && !/^<a href="\/(collections|blog)\/[a-z0-9-]+">$/.test(tag) && tag !== '</a>') {
        fail(h, 'about-html', `disallowed tag: ${tag}`);
      }
    }
    for (const m of e.about.matchAll(/href="\/collections\/([a-z0-9-]+)"/g)) {
      if (!validCollections.has(m[1])) fail(h, 'about-link', `unknown collection "${m[1]}"`);
    }
    for (const m of e.about.matchAll(/href="\/blog\/([a-z0-9-]+)"/g)) {
      if (validBlogSlugs.size && !validBlogSlugs.has(m[1])) fail(h, 'about-link', `unknown blog slug "${m[1]}"`);
    }
    if (!/<strong>/.test(e.about)) fail(h, 'about-keywords', 'no <strong> keyword bolds present');
  }

  if (!catalogByHandle.has(h)) fail(h, 'handle', 'not in live catalog dump');
  if (/[–—]/.test(all)) fail(h, 'dashes', 'em or en dash found');
  if (/[\u{1F300}-\u{1FAFF}☀-➿]/u.test(all)) fail(h, 'emoji', 'emoji found');
  const banned = all.match(BANNED);
  if (banned) fail(h, 'banned-words', banned[0]);

  if (!e.seoTitle || e.seoTitle.length > 60) fail(h, 'seoTitle', `length ${e.seoTitle?.length ?? 0} (max 60)`);
  if (!e.metaDescription || e.metaDescription.length > 160) fail(h, 'metaDescription', `length ${e.metaDescription?.length ?? 0} (max 160)`);
  if (e.metaDescription && e.metaDescription.length < 90) fail(h, 'metaDescription', `length ${e.metaDescription.length} (min 90)`);

  const introWords = words(e.intro ?? '');
  if (introWords.length < 55 || introWords.length > 160) fail(h, 'intro-length', `${introWords.length} words (55-160)`);
  if (BAD_OPENERS.test((e.intro ?? '').trim())) fail(h, 'opener', 'banned opening formula');
  if (QUESTION_OPENER.test((e.intro ?? '').trim().split(/(?<=[.!?])\s/)[0] ?? '')) fail(h, 'opener', 'opens with a question');

  if (!Array.isArray(e.faqs) || e.faqs.length < 2 || e.faqs.length > 3) fail(h, 'faqs', `count ${e.faqs?.length ?? 0} (2-3)`);
  for (const f of e.faqs ?? []) {
    if (!f.question?.trim().endsWith('?')) fail(h, 'faq-question', `not a question: "${(f.question ?? '').slice(0, 40)}"`);
    const aw = words(f.answer ?? '').length;
    if (aw < 25 || aw > 90) fail(h, 'faq-answer-length', `${aw} words (25-90) for "${(f.question ?? '').slice(0, 40)}"`);
  }

  const altW = words(e.imageAlt ?? '').length;
  if (altW < 5 || altW > 16) fail(h, 'imageAlt', `${altW} words (5-16)`);

  if (!Array.isArray(e.relatedCollections) || e.relatedCollections.length < 2 || e.relatedCollections.length > 3) {
    fail(h, 'relatedCollections', `count ${e.relatedCollections?.length ?? 0} (2-3)`);
  }
  for (const c of e.relatedCollections ?? []) {
    if (!validCollections.has(c)) fail(h, 'relatedCollections', `unknown handle "${c}"`);
  }

  // uniqueness registries
  const t = (e.seoTitle ?? '').toLowerCase();
  if (seenTitles.has(t)) fail(h, 'seoTitle-dup', `same as ${seenTitles.get(t)}`);
  seenTitles.set(t, h);
  const m = (e.metaDescription ?? '').toLowerCase();
  if (seenMeta.has(m)) fail(h, 'metaDescription-dup', `same as ${seenMeta.get(m)}`);
  seenMeta.set(m, h);
  const opener = words(e.intro ?? '').slice(0, 6).join(' ');
  if (seenOpeners.has(opener)) fail(h, 'opener-dup', `first 6 words same as ${seenOpeners.get(opener)}`);
  seenOpeners.set(opener, h);
  for (const f of e.faqs ?? []) {
    const q = (f.question ?? '').toLowerCase().trim();
    if (seenFaqQuestions.has(q)) fail(h, 'faq-dup', `question also on ${seenFaqQuestions.get(q)}`);
    seenFaqQuestions.set(q, h);
  }

  // anti-copy: no 6-gram shared with the parent store description
  const parent = catalogByHandle.get(h)?.parentDescriptionText ?? '';
  if (parent) {
    const parentGrams = ngrams(parent, 6);
    for (const g of ngrams(textOf(e), 6)) {
      if (parentGrams.has(g)) {
        fail(h, 'parent-overlap', `6-gram shared with parent description: "${g}"`);
        break;
      }
    }
  }
}

// ---- cross-entry template detection: any 8-gram appearing in 2+ entries ----
const gramOwners = new Map();
for (const e of entries) {
  for (const g of ngrams(textOf(e), 8)) {
    if (gramOwners.has(g)) {
      const other = gramOwners.get(g);
      if (other !== e.handle) fail(e.handle, 'template-overlap', `8-gram shared with ${other}: "${g}"`);
    } else {
      gramOwners.set(g, e.handle);
    }
  }
}

if (failures.length) {
  for (const f of failures) console.log(JSON.stringify(f));
  console.error(`\nFAIL: ${failures.length} issue(s) across ${new Set(failures.map((f) => f.handle)).size} entries (${entries.length} total)`);
  process.exit(1);
}
console.log(`PASS: ${entries.length} entries clean`);
