#!/bin/bash
# Wire a satellite to @dopeart/satellite-pdp. Run from the satellites/ dir.
# Assumes lib/pdp-adapter.ts already exists (site-specific, written by hand).
# Usage: bash wire-site.sh <site-dir> <pkg-version-tag>
set -euo pipefail
SITE="$1"; TAG="${2:-v0.2.2}"
REF="lionwallart"   # reference site to copy the route + component shims from
GEN="/Users/thedopeart/Desktop/all-projects/_global/Domain Interlinking/satellite-pdp/tools/gen-products-ts.mjs"

cd "$SITE"
if [ ! -f lib/pdp-adapter.ts ]; then
  echo "ERROR: lib/pdp-adapter.ts missing in $SITE. Write the site adapter first." >&2
  exit 1
fi
git checkout -q -b fable-shared-pdp 2>/dev/null || git checkout -q fable-shared-pdp
node "$GEN" .
mkdir -p "app/products/[handle]" content
cp "../$REF/app/products/[handle]/page.tsx" "app/products/[handle]/page.tsx"
cp "../$REF/components/ProductCard.tsx" components/ProductCard.tsx
cp "../$REF/components/CollectionGrid.tsx" components/CollectionGrid.tsx
cp "../$REF/components/SortedCollectionGrid.tsx" components/SortedCollectionGrid.tsx
# placeholder content until generated copy lands
printf "import type { PdpContentMap } from '@dopeart/satellite-pdp';\n\nexport const pdpContent: PdpContentMap = {};\n" > content/pdp-content.ts
git rm -q lib/shopify.ts 2>/dev/null || rm -f lib/shopify.ts
npm install --no-audit --no-fund "github:thedopeart/satellite-pdp#$TAG" >/dev/null 2>&1
node -e "
const fs=require('fs');
let nc=fs.readFileSync('next.config.ts','utf8');
if(!nc.includes('transpilePackages')){nc=nc.replace(/const nextConfig: NextConfig = \{/, 'const nextConfig: NextConfig = {\n  transpilePackages: [\'@dopeart/satellite-pdp\'],');fs.writeFileSync('next.config.ts',nc);}
let g=fs.readFileSync('app/globals.css','utf8');
if(!g.includes('@source')){g=g.replace('@import \"tailwindcss\";','@import \"tailwindcss\";\n@source \"../node_modules/@dopeart/satellite-pdp/src\";');fs.writeFileSync('app/globals.css',g);}
let s=fs.readFileSync('app/sitemap.ts','utf8');
if(!s.includes('productSitemapEntries')){
  s=s.replace(\"import type { MetadataRoute } from 'next';\", \"import type { MetadataRoute } from 'next';\nimport { productSitemapEntries } from '@dopeart/satellite-pdp';\");
  s=s.replace(/import { blogPosts } from '@\/lib\/blog-posts';/, \"import { blogPosts } from '@/lib/blog-posts';\nimport { pdpContent } from '@/content/pdp-content';\");
  s=s.replace(/return \[\.\.\.staticPages, \.\.\.collectionPages, \.\.\.blogPages\];/, 'const productPages = productSitemapEntries(siteConfig.domain, Object.keys(pdpContent)).map((e) => ({ ...e, lastModified: new Date() }));\n\n  return [...staticPages, ...collectionPages, ...productPages, ...blogPages];');
  fs.writeFileSync('app/sitemap.ts',s);
}
console.log('wired. sitemap has productPages:', fs.readFileSync('app/sitemap.ts','utf8').includes('productPages'));
"