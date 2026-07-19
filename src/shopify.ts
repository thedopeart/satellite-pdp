// Parent-store fetch layer. Admin REST, cursor pagination, 429 retry.
// This is the consolidated version of the per-site lib/shopify.ts copies.

import type { SatelliteProduct, SiteAdapter } from './types';

const API_VERSION = '2024-10';

export interface ShopifyRestProduct {
  id: number;
  handle: string;
  title: string;
  status: string;
  tags: string;
  images: { src: string; alt: string | null }[];
  variants: { title: string; price: string; compare_at_price: string | null }[];
}

function getToken(adapter: SiteAdapter): string {
  const envName = adapter.accessTokenEnv ?? 'SHOPIFY_ACCESS_TOKEN';
  const token = process.env[envName];
  if (!token) throw new Error(`${envName} is not set`);
  return token;
}

// Fetch with retry on 429 rate limits.
//
// Backoff takes the LONGER of Shopify's Retry-After and our own exponential
// curve. Honoring Retry-After alone is a trap: Shopify answers a rate-limited
// REST call with "Retry-After: 2.0" every time, so the retry schedule flattens
// to ~2s and the whole budget drains in seconds. That is fine for one client,
// but a Next static build runs N worker processes that EACH pull the full
// catalog, so the burst is N x pages against a 2 req/s sustained bucket and
// needs tens of seconds to clear, not a handful.
async function fetchWithRetry(url: string, token: string, maxRetries = 10): Promise<Response> {
  for (let attempt = 0; ; attempt++) {
    // Must stay cacheable (revalidate, NOT no-store): these product pages are
    // statically generated, and Next refuses to prerender a route whose fetch
    // opts out of caching ("Dynamic server usage ... used no-store fetch").
    // The responses are 2-4MB so Next logs "items over 2MB can not be cached"
    // and skips storing them; that warning is expected and harmless. Oversize
    // bodies occasionally arrive mangled, which parseProductsJson absorbs.
    const res: Response = await fetch(url, {
      headers: { 'X-Shopify-Access-Token': token },
      next: { revalidate: 3600 },
    });

    if (res.status === 429 && attempt < maxRetries) {
      const retryAfter = Number(res.headers.get('Retry-After')) || 0;
      const backoff = Math.min(2 ** attempt, 30); // cap so a build cannot stall forever
      const waitSeconds = Math.max(retryAfter, backoff);
      await new Promise((resolve) => setTimeout(resolve, waitSeconds * 1000 + Math.random() * 1500));
      continue;
    }

    if (!res.ok) throw new Error(`Shopify API error: ${res.status} ${res.statusText}`);
    return res;
  }
}

// Per-run cache: one source collection is fetched ONCE no matter how many local
// collections map to it. Without this, mapping N local handles onto the same
// parent collection costs N full paginated fetches, which is how a satellite
// trips Shopify's 429 (a big parent collection is 4+ pages, and Next's data
// cache refuses to store responses over 2MB, so nothing absorbs the repeat).
// Keyed by store + collection so a multi-store build cannot cross-contaminate.
// Cleared per product-fetch run by resetCollectionCache() so a long-lived dev
// server still picks up parent-store changes on the next revalidate.
const collectionCache = new Map<string, Promise<ShopifyRestProduct[]>>();

export function resetCollectionCache(): void {
  collectionCache.clear();
}

export function fetchAllProductsFromCollection(
  adapter: SiteAdapter,
  collectionId: number,
): Promise<ShopifyRestProduct[]> {
  const key = `${adapter.store}:${collectionId}`;
  const cached = collectionCache.get(key);
  if (cached) return cached;

  // Cache the PROMISE, not the result, so concurrent callers share one fetch.
  const inFlight = doFetchAllProductsFromCollection(adapter, collectionId).catch((err) => {
    collectionCache.delete(key); // never cache a failure
    throw err;
  });
  collectionCache.set(key, inFlight);
  return inFlight;
}

/**
 * Parse a products.json body, tolerating raw control characters inside string
 * literals. Shopify occasionally emits an unescaped control char (and an
 * oversize response can arrive mangled), and a single bad byte would otherwise
 * fail the entire build. Strips only C0 controls that are illegal in JSON
 * strings, then reparses; if it still will not parse, the error propagates
 * rather than silently returning a short catalog.
 */
async function parseProductsJson(
  res: Response,
  url: string,
): Promise<{ products: ShopifyRestProduct[] }> {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch (err) {
    // C0 controls are illegal raw inside a JSON string, and outside one they
    // are only insignificant whitespace, so removing them cannot change parsed data.
    const cleaned = text.replace(/[\u0000-\u001F]/g, '');
    try {
      const data = JSON.parse(cleaned);
      console.warn(
        `⚠️  Shopify returned JSON with illegal control characters (${url.slice(0, 120)}…); ` +
          `stripped and reparsed ${data.products?.length ?? 0} products.`,
      );
      return data;
    } catch {
      throw err; // original error is the useful one
    }
  }
}

// Fetch all products from a Shopify collection with cursor pagination
async function doFetchAllProductsFromCollection(
  adapter: SiteAdapter,
  collectionId: number,
): Promise<ShopifyRestProduct[]> {
  const token = getToken(adapter);
  const allProducts: ShopifyRestProduct[] = [];
  let url = `https://${adapter.store}.myshopify.com/admin/api/${API_VERSION}/products.json?collection_id=${collectionId}&limit=250&status=active&fields=id,handle,title,status,tags,images,variants`;

  while (true) {
    const res = await fetchWithRetry(url, token);

    const data = await parseProductsJson(res, url);
    allProducts.push(...data.products);

    const linkHeader = res.headers.get('Link') || '';
    const nextMatch = linkHeader.match(/<([^>]+)>;\s*rel="next"/);
    if (!nextMatch) break;
    url = nextMatch[1];
  }

  return allProducts;
}

function intersects(a: Set<string>, b: string[]): boolean {
  for (const item of b) {
    if (a.has(item)) return true;
  }
  return false;
}

/** Classify a product's tags into site-local collection handles per the adapter's tag rules. */
export function classifyProduct(adapter: SiteAdapter, tags: Set<string>): string[] {
  const handles: string[] = [];

  for (const [handle, ruleTags] of Object.entries(adapter.tagRules)) {
    if (intersects(tags, ruleTags)) handles.push(handle);
  }

  if (handles.length === 0 && adapter.fallbackAllOnNoMatch) {
    return Object.keys(adapter.tagRules);
  }

  return handles;
}

/** True when the product must not appear on this satellite. */
export function isExcluded(adapter: SiteAdapter, tags: Set<string>): boolean {
  if (intersects(tags, adapter.excludeTags ?? ['sveta'])) return true;
  if (adapter.requireAnyTags && !intersects(tags, adapter.requireAnyTags)) return true;
  return false;
}

/** Where "buy" links for this handle should point on the parent storefront. */
export function purchaseUrl(adapter: SiteAdapter, handle: string): string {
  const mapped = adapter.purchaseHandleMap?.[handle];
  if (mapped && adapter.purchaseDomainOverride) {
    return `https://${adapter.purchaseDomainOverride}/products/${mapped}`;
  }
  return `https://${adapter.parentDomain}/products/${handle}`;
}

export function mapShopifyProduct(
  adapter: SiteAdapter,
  product: ShopifyRestProduct,
  collectionHandles: string[],
  tags: string[],
  hasPdp: boolean,
): SatelliteProduct {
  const firstImage = product.images[0];
  const secondImage = product.images[1];
  const firstVariant = product.variants[0];

  return {
    id: String(product.id),
    handle: product.handle,
    title: product.title,
    price: firstVariant?.price ?? '0.00',
    compareAtPrice: firstVariant?.compare_at_price || undefined,
    image: firstImage?.src ?? '',
    secondImage: secondImage?.src ?? '',
    alt: firstImage?.alt ?? `${product.title} ${adapter.altSuffix}`,
    images: product.images.map((i) => ({ src: i.src, alt: i.alt })),
    variants: product.variants.map((v) => ({
      title: v.title,
      price: v.price,
      compareAtPrice: v.compare_at_price || undefined,
    })),
    tags,
    collectionHandles,
    url: hasPdp ? `/products/${product.handle}` : purchaseUrl(adapter, product.handle),
    external: !hasPdp,
  };
}
