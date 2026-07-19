// Product source factory: one per site, built from its adapter + content map.
// Consolidates the per-site lib/products.ts copies.

import type { PdpContentMap, SatelliteProduct, SiteAdapter } from './types';
import {
  classifyProduct,
  fetchAllProductsFromCollection,
  isExcluded,
  mapShopifyProduct,
  purchaseUrl,
  resetCollectionCache,
} from './shopify';

export interface ProductSource {
  getAllProducts(): Promise<SatelliteProduct[]>;
  getProductsByCollection(collectionHandle: string): Promise<SatelliteProduct[]>;
  getFeaturedProducts(count?: number): Promise<SatelliteProduct[]>;
  getProductByHandle(handle: string): Promise<SatelliteProduct | undefined>;
  /** Live product count per local collection handle — the only sanctioned source for "N prints" copy. */
  getCollectionCounts(): Promise<Record<string, number>>;
  /** Parent-store URL where this handle can be bought (respects per-site handle maps). */
  getPurchaseUrl(handle: string): string;
}

export interface ProductSourceOptions {
  /**
   * Last-resort data, used ONLY when ALLOW_FALLBACK_PRODUCTS=1 is set. Without
   * that env var a missing token or failed fetch throws and fails the build:
   * shipping stale hardcoded products silently caused real incidents, so the
   * previous deployment staying live is always the better outcome.
   */
  fallbackProducts?: SatelliteProduct[];
}

export function createProductSource(
  adapter: SiteAdapter,
  content: PdpContentMap,
  options: ProductSourceOptions = {},
): ProductSource {
  const fallbackProducts = options.fallbackProducts ?? [];

  // Cache the in-flight fetch promise so concurrent page renders share a
  // single API pass per worker instead of each firing their own request storm
  let cachedProducts: Promise<SatelliteProduct[]> | null = null;

  function fetchAllProducts(): Promise<SatelliteProduct[]> {
    if (!cachedProducts) {
      cachedProducts = doFetchAllProducts();
      // Don't cache a rejection: a transient runtime failure (ISR revalidate)
      // should retry on the next render instead of pinning the worker to a 500.
      cachedProducts.catch(() => {
        cachedProducts = null;
      });
    }
    return cachedProducts;
  }

  function fallbackOrThrow(reason: string): SatelliteProduct[] {
    if (process.env.ALLOW_FALLBACK_PRODUCTS === '1' && fallbackProducts.length > 0) {
      console.warn(
        `\n${'!'.repeat(72)}\n` +
          `!! SERVING ${fallbackProducts.length} HARDCODED FALLBACK PRODUCTS — NOT LIVE DATA\n` +
          `!! Reason: ${reason}\n` +
          `!! This build ships degraded content. Fix the token and redeploy.\n` +
          `${'!'.repeat(72)}\n`,
      );
      return fallbackProducts;
    }
    throw new Error(
      `Refusing to build without live Shopify data (${reason}). ` +
        `Set ALLOW_FALLBACK_PRODUCTS=1 only to knowingly ship fallback content.`,
    );
  }

  /** Cheapest variant price, for the shared entry-tier curation cap. */
  function minVariantPrice(p: SatelliteProduct): number {
    const prices = p.variants.map((v) => Number(v.price)).filter((n) => Number.isFinite(n));
    return prices.length ? Math.min(...prices) : Number(p.price);
  }

  function auditCounts(products: SatelliteProduct[]): void {
    const threshold = adapter.minCollectionCount ?? 12;
    const handles =
      adapter.classifyBy === 'collections' && adapter.collectionMap
        ? Object.keys(adapter.collectionMap)
        : Object.keys(adapter.tagRules);
    const thin: string[] = [];
    for (const handle of handles) {
      const n = products.filter((p) => p.collectionHandles.includes(handle)).length;
      if (n < threshold) thin.push(`"${handle}" resolved ${n} products (< ${threshold})`);
    }
    if (thin.length) {
      const msg = `MIN-COUNT WARNING: ${thin.join('; ')} — merge, remap, or drop before shipping sparse pages.`;
      if (process.env.SATELLITE_MIN_COUNT_STRICT === '1') throw new Error(msg);
      console.warn(`⚠️  ${msg}`);
    }
  }

  async function doFetchAllProducts(): Promise<SatelliteProduct[]> {
    const envName = adapter.accessTokenEnv ?? 'SHOPIFY_ACCESS_TOKEN';
    if (!process.env[envName]) {
      return fallbackOrThrow(`${envName} is not set`);
    }

    try {
      // Fresh cache per run: within a run a source collection is fetched once
      // (many local handles can share one parent collection), across runs the
      // data is re-pulled so a dev server does not serve a stale catalog.
      resetCollectionCache();

      const allProducts = new Map<string, SatelliteProduct>();

      if (adapter.classifyBy === 'collections' && adapter.collectionMap) {
        // Membership mode: each local handle maps directly to its source collection(s)
        for (const [localHandle, idOrIds] of Object.entries(adapter.collectionMap)) {
          const collectionIds = Array.isArray(idOrIds) ? idOrIds : [idOrIds];
          for (const collectionId of collectionIds) {
            const shopifyProducts = await fetchAllProductsFromCollection(adapter, collectionId);

            const refine = adapter.collectionRefine?.[localHandle];
            for (const sp of shopifyProducts) {
              const tags = sp.tags
                .split(',')
                .map((t) => t.trim().toLowerCase())
                .filter(Boolean);
              if (isExcluded(adapter, new Set(tags))) continue;
              if (refine) {
                const tagSet = new Set(tags);
                if (refine.excludeTags?.some((t) => tagSet.has(t.toLowerCase()))) continue;
                if (
                  refine.requireAnyTags &&
                  !refine.requireAnyTags.some((t) => tagSet.has(t.toLowerCase()))
                ) {
                  continue;
                }
              }

              const existing = allProducts.get(String(sp.id));
              if (existing) {
                if (!existing.collectionHandles.includes(localHandle)) {
                  existing.collectionHandles.push(localHandle);
                }
                continue;
              }

              const hasPdp = Boolean(content[sp.handle]);
              allProducts.set(String(sp.id), mapShopifyProduct(adapter, sp, [localHandle], tags, hasPdp));
            }
          }
        }
      } else {
        for (const collectionId of adapter.sourceCollectionIds) {
          const shopifyProducts = await fetchAllProductsFromCollection(adapter, collectionId);

          for (const sp of shopifyProducts) {
            if (allProducts.has(String(sp.id))) continue;

            const tags = sp.tags
              .split(',')
              .map((t) => t.trim().toLowerCase())
              .filter(Boolean);
            const tagSet = new Set(tags);

            if (isExcluded(adapter, tagSet)) continue;

            const localHandles = classifyProduct(adapter, tagSet);
            if (localHandles.length === 0) continue;

            const hasPdp = Boolean(content[sp.handle]);
            allProducts.set(String(sp.id), mapShopifyProduct(adapter, sp, localHandles, tags, hasPdp));
          }
        }
      }

      let products = Array.from(allProducts.values());
      const fetched = products.length;

      if (adapter.excludeHandles?.length) {
        const blocked = new Set(adapter.excludeHandles);
        products = products.filter((p) => !blocked.has(p.handle));
      }
      if (adapter.maxEntryPrice != null) {
        const cap = adapter.maxEntryPrice;
        products = products.filter((p) => minVariantPrice(p) <= cap);
      }
      const dropped = fetched - products.length;

      console.log(
        `Fetched ${products.length} products from Shopify (classified into local collections)` +
          (dropped ? ` — ${dropped} curated out (price cap ${adapter.maxEntryPrice ?? 'n/a'} / excludeHandles)` : ''),
      );
      auditCounts(products);
      return products;
    } catch (err) {
      console.error('Failed to fetch Shopify products:', err);
      return fallbackOrThrow(err instanceof Error ? err.message : String(err));
    }
  }

  return {
    getAllProducts: () => fetchAllProducts(),

    async getProductsByCollection(collectionHandle: string) {
      const products = await fetchAllProducts();
      const matched = products.filter((p) => p.collectionHandles.includes(collectionHandle));
      return adapter.gridCap ? matched.slice(0, adapter.gridCap) : matched;
    },

    async getFeaturedProducts(count = 8) {
      const products = await fetchAllProducts();
      return products.slice(0, count);
    },

    async getProductByHandle(handle: string) {
      const products = await fetchAllProducts();
      return products.find((p) => p.handle === handle);
    },

    async getCollectionCounts() {
      const products = await fetchAllProducts();
      const counts: Record<string, number> = {};
      for (const p of products) {
        for (const h of p.collectionHandles) counts[h] = (counts[h] ?? 0) + 1;
      }
      return counts;
    },

    getPurchaseUrl: (handle: string) => purchaseUrl(adapter, handle),
  };
}
