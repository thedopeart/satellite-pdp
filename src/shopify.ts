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

// Fetch with retry on 429 rate limits (honors Retry-After, exponential backoff)
async function fetchWithRetry(url: string, token: string, maxRetries = 8): Promise<Response> {
  for (let attempt = 0; ; attempt++) {
    const res: Response = await fetch(url, {
      headers: { 'X-Shopify-Access-Token': token },
      next: { revalidate: 3600 },
    });

    if (res.status === 429 && attempt < maxRetries) {
      const retryAfter = Number(res.headers.get('Retry-After')) || 2 ** attempt;
      await new Promise((resolve) => setTimeout(resolve, retryAfter * 1000 + Math.random() * 1500));
      continue;
    }

    if (!res.ok) throw new Error(`Shopify API error: ${res.status} ${res.statusText}`);
    return res;
  }
}

// Fetch all products from a Shopify collection with cursor pagination
export async function fetchAllProductsFromCollection(
  adapter: SiteAdapter,
  collectionId: number,
): Promise<ShopifyRestProduct[]> {
  const token = getToken(adapter);
  const allProducts: ShopifyRestProduct[] = [];
  let url = `https://${adapter.store}.myshopify.com/admin/api/${API_VERSION}/products.json?collection_id=${collectionId}&limit=250&status=active&fields=id,handle,title,status,tags,images,variants`;

  while (true) {
    const res = await fetchWithRetry(url, token);

    const data: { products: ShopifyRestProduct[] } = await res.json();
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
