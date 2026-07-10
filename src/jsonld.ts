import type { CollectionRef, PdpContent, SatelliteProduct, SiteMeta } from './types';

/**
 * Product JSON-LD pointing at the SATELLITE's own URL (self-canonical posture).
 * Description comes from the niche intro, never the parent store description.
 */
export function productJsonLd(
  site: SiteMeta,
  product: SatelliteProduct,
  content: PdpContent,
) {
  const url = `https://${site.domain}/products/${product.handle}`;
  const prices = product.variants
    .map((v) => parseFloat(v.price))
    .filter((n) => Number.isFinite(n));
  const lowPrice = prices.length ? Math.min(...prices) : parseFloat(product.price) || 0;
  const highPrice = prices.length ? Math.max(...prices) : lowPrice;

  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.title,
    url,
    image: product.images.length ? product.images.map((i) => i.src) : [product.image],
    description: content.intro.split('\n\n')[0],
    offers: {
      '@type': 'AggregateOffer',
      priceCurrency: 'USD',
      lowPrice,
      highPrice,
      offerCount: Math.max(product.variants.length, 1),
      availability: 'https://schema.org/InStock',
      url,
      seller: {
        '@type': 'Organization',
        name: site.parentLabel,
      },
    },
  };
}

/** BreadcrumbList JSON-LD: Home / Collections / {primary collection} / {product}, all satellite URLs. */
export function productBreadcrumbJsonLd(
  site: SiteMeta,
  product: SatelliteProduct,
  primaryCollection: CollectionRef | undefined,
) {
  const items = [
    { name: 'Home', item: `https://${site.domain}` },
    { name: 'Collections', item: `https://${site.domain}/collections` },
  ];
  if (primaryCollection) {
    items.push({
      name: primaryCollection.title,
      item: `https://${site.domain}/collections/${primaryCollection.handle}`,
    });
  }
  items.push({
    name: product.title,
    item: `https://${site.domain}/products/${product.handle}`,
  });

  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((entry, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: entry.name,
      item: entry.item,
    })),
  };
}

export function productFaqJsonLd(content: PdpContent) {
  if (!content.faqs.length) return null;
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: content.faqs.map((faq) => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: faq.answer,
      },
    })),
  };
}
