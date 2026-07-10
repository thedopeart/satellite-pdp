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

/** Sitemap entries for the product pages that actually publish (content-backed handles only). */
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
