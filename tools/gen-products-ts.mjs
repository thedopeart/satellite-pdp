// Generate a site's new lib/products.ts (package-backed wrapper), carrying over
// the old file's fallbackProducts array.
// Usage: node gen-products-ts.mjs <site-dir>
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const siteDir = process.argv[2];
if (!siteDir) {
  console.error('Usage: node gen-products-ts.mjs <site-dir>');
  process.exit(2);
}

const oldSrc = readFileSync(join(siteDir, 'lib/products.ts'), 'utf8');
const m = oldSrc.match(/const fallbackProducts: Product\[\] = \[([\s\S]*?)\n\];/);
if (!m) {
  console.error('Could not find fallbackProducts array in old lib/products.ts');
  process.exit(1);
}

// Wrap each top-level object literal in the array with fallback(...)
const body = m[1]
  .replace(/^  \{$/gm, '  fallback({')
  .replace(/^  \},$/gm, '  }),')
  .replace(/^  \}$/gm, '  })');

const out = `import { createProductSource, purchaseUrl, type SatelliteProduct } from '@dopeart/satellite-pdp';
import { adapter } from '@/lib/pdp-adapter';
import { pdpContent } from '@/content/pdp-content';

// The shared package owns fetching/classification now; this file keeps the
// site's original API surface so existing pages don't change.
export type Product = SatelliteProduct;

function fallback(
  p: Omit<SatelliteProduct, 'images' | 'variants' | 'tags' | 'url' | 'external'>,
): SatelliteProduct {
  return {
    ...p,
    images: [{ src: p.image, alt: p.alt }],
    variants: [],
    tags: [],
    url: purchaseUrl(adapter, p.handle),
    external: true,
  };
}

// Fallback products for builds without API access (carried over from the old data layer)
const fallbackProducts: SatelliteProduct[] = [${body}
];

const source = createProductSource(adapter, pdpContent, { fallbackProducts });

export const getAllProducts = source.getAllProducts;
export const getProductsByCollection = source.getProductsByCollection;
export const getFeaturedProducts = source.getFeaturedProducts;
export const getProductByHandle = source.getProductByHandle;

/** Parent-store URL where this product can be bought (outbound links, blog sidebar, buy CTA). */
export function getProductUrl(handle: string): string {
  return source.getPurchaseUrl(handle);
}
`;

writeFileSync(join(siteDir, 'lib/products.ts'), out);
console.log(`Wrote ${join(siteDir, 'lib/products.ts')} with carried-over fallbacks`);
