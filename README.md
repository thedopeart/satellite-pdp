# @dopeart/satellite-pdp

Shared product detail page template, data layer, and product components for the satellite art sites. One source of truth instead of 13 hand-maintained copies.

Ships as raw TypeScript source. Each consumer transpiles it via `transpilePackages`.

## Install (per satellite)

```jsonc
// package.json
"dependencies": {
  "@dopeart/satellite-pdp": "github:thedopeart/satellite-pdp#v0.1.0"
}
```

```ts
// next.config.ts
const nextConfig: NextConfig = {
  transpilePackages: ['@dopeart/satellite-pdp'],
  // ...existing config
};
```

```css
/* app/globals.css — let Tailwind scan the package's classes */
@source "../node_modules/@dopeart/satellite-pdp/src";
```

## Wire-up

Each site defines three small files and two routes:

1. `lib/pdp-adapter.ts` — a plain-data `SiteAdapter` (store, tag rules, alt suffix, quirks) plus a `SiteMeta`.
2. `content/pdp-content.ts` — the pre-generated, lint-gated differentiation copy (`PdpContentMap`). A product only gets a local product page if it has an entry here; everything else keeps linking to the parent store. Never generate this at build/render time.
3. `lib/products.ts` — `createProductSource(adapter, pdpContent, { fallbackProducts })`, re-exporting the old function names so existing pages keep working.
4. `app/products/[handle]/page.tsx` — thin route: look up product + content, 404 if either is missing, render `ProductPage` and `buildProductMetadata`.
5. `app/sitemap.ts` — add `productSitemapEntries(domain, publishedHandles)`.

## Rules baked into the design

- Product pages are self-canonical and must carry genuinely unique niche copy. The parent store's `body_html` is never fetched and never rendered.
- A handle with no content entry fails closed: no local page, card links out to the parent store instead.
- Purchase always happens on the parent store; the buy CTA is an outbound link.
- Content copy follows the workspace writing rules (no em dashes, no banned AI-isms, nothing invented). Lint before committing.

## Versioning

Tag releases (`v0.1.0`, ...) and pin satellites to tags. Rolling out a template change = bump the tag in each site's package.json, one site at a time. Never point 13 sites at a moving branch.
