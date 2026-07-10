export type {
  SatelliteProduct,
  ProductVariant,
  SiteAdapter,
  SiteMeta,
  SiteDetails,
  RelatedPostRef,
  PdpContent,
  PdpContentMap,
  CardStyles,
  CollectionRef,
} from './types';

export { createProductSource, type ProductSource, type ProductSourceOptions } from './products';
export { purchaseUrl, classifyProduct, isExcluded } from './shopify';
export { buildProductMetadata, productSitemapEntries } from './seo';
export { productJsonLd, productBreadcrumbJsonLd, productFaqJsonLd } from './jsonld';
export { default as ProductPage, type ProductPageProps } from './pdp/ProductPage';
