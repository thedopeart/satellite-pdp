import type { Metadata } from 'next';
import type { PdpContent, SatelliteProduct, SiteMeta } from './types';

/** Metadata for a satellite product page: unique title/meta/OG, self-referential canonical. */
export function buildProductMetadata(
  site: SiteMeta,
  product: SatelliteProduct,
  content: PdpContent,
): Metadata {
  const url = `https://${site.domain}/products/${product.handle}`;

  return {
    title: { absolute: content.seoTitle },
    description: content.metaDescription,
    openGraph: {
      title: content.ogTitle ?? content.seoTitle,
      description: content.ogDescription ?? content.metaDescription,
      url,
      siteName: site.name,
      type: 'website',
      images: product.image ? [{ url: product.image, width: 1200, height: 1200 }] : [],
    },
    twitter: {
      card: 'summary_large_image',
      title: content.ogTitle ?? content.seoTitle,
      description: content.ogDescription ?? content.metaDescription,
    },
    alternates: {
      canonical: url,
    },
  };
}

/**
 * Sitemap entries for product pages.
 *
 * Pass `await source.getRenderableHandles()`, NOT `Object.keys(pdpContent)`.
 * pdpContent is static while the catalog is fetched and then narrowed, so its
 * keys include handles with no live product. Listing those produced sitemaps
 * advertising soft 404s: 153 URLs on wallartforoffice, 137 on playingcardart,
 * each returning HTTP 200 with not-found content (2026-07-30).
 */
export function productSitemapEntries(
  domain: string,
  handles: string[],
): { url: string; changeFrequency: 'weekly'; priority: number }[] {
  return handles.map((handle) => ({
    url: `https://${domain}/products/${handle}`,
    changeFrequency: 'weekly' as const,
    priority: 0.7,
  }));
}
