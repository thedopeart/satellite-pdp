// Product source factory: one per site, built from its adapter + content map.
// Consolidates the per-site lib/products.ts copies.

import type { PdpContentMap, SatelliteProduct, SiteAdapter } from './types';
import {
  classifyProduct,
  fetchAllProductsFromCollection,
  isExcluded,
  mapShopifyProduct,
  purchaseUrl,
} from './shopify';

export interface ProductSource {
  getAllProducts(): Promise<SatelliteProduct[]>;
  getProductsByCollection(collectionHandle: string): Promise<SatelliteProduct[]>;
  getFeaturedProducts(count?: number): Promise<SatelliteProduct[]>;
  getProductByHandle(handle: string): Promise<SatelliteProduct | undefined>;
  /** Parent-store URL where this handle can be bought (respects per-site handle maps). */
  getPurchaseUrl(handle: string): string;
}

export interface ProductSourceOptions {
  /** Rendered when the token is missing or the fetch fails, so builds never hard-crash. */
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
    if (!cachedProducts) cachedProducts = doFetchAllProducts();
    return cachedProducts;
  }

  async function doFetchAllProducts(): Promise<SatelliteProduct[]> {
    const envName = adapter.accessTokenEnv ?? 'SHOPIFY_ACCESS_TOKEN';
    if (!process.env[envName]) {
      console.warn(`${envName} not set, using fallback products`);
      return fallbackProducts;
    }

    try {
      const allProducts = new Map<string, SatelliteProduct>();

      if (adapter.classifyBy === 'collections' && adapter.collectionMap) {
        // Membership mode: each local handle maps directly to its source collection(s)
        for (const [localHandle, idOrIds] of Object.entries(adapter.collectionMap)) {
          const collectionIds = Array.isArray(idOrIds) ? idOrIds : [idOrIds];
          for (const collectionId of collectionIds) {
            const shopifyProducts = await fetchAllProductsFromCollection(adapter, collectionId);

            for (const sp of shopifyProducts) {
              const tags = sp.tags
                .split(',')
                .map((t) => t.trim().toLowerCase())
                .filter(Boolean);
              if (isExcluded(adapter, new Set(tags))) continue;

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

      const products = Array.from(allProducts.values());
      console.log(`Fetched ${products.length} products from Shopify (classified into local collections)`);
      return products;
    } catch (err) {
      console.error('Failed to fetch Shopify products, using fallback:', err);
      return fallbackProducts;
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

    getPurchaseUrl: (handle: string) => purchaseUrl(adapter, handle),
  };
}
