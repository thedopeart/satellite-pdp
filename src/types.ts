// Shared types for the satellite PDP package.

export interface SatelliteProduct {
  id: string;
  handle: string;
  title: string;
  /** Price of the first variant, e.g. "129.00" */
  price: string;
  compareAtPrice?: string;
  /** Primary image src */
  image: string;
  secondImage?: string;
  /** Alt text for the primary image */
  alt: string;
  /** All product images */
  images: { src: string; alt: string | null }[];
  /** All variants (size options on the parent store) */
  variants: ProductVariant[];
  /** Lowercased, trimmed tags from the parent store */
  tags: string[];
  /** Site-local collection handles this product was classified into */
  collectionHandles: string[];
  /**
   * Where the product card should link on this site:
   * the internal PDP when differentiation content exists for the handle,
   * otherwise the parent-store product page.
   */
  url: string;
  /** True when `url` points at the parent store (opens in a new tab) */
  external: boolean;
}

export interface ProductVariant {
  title: string;
  price: string;
  compareAtPrice?: string;
  /**
   * Numeric parent-store variant id as a string. Required to build a Storefront
   * cart line; unused in 'link' commerce mode. Optional because pdpContent
   * fixtures and older cached payloads predate it.
   */
  id?: string;
}

/**
 * Plain-data site adapter. Everything the shared data layer needs to know
 * about one satellite. Keep this serializable: no functions, so it can be
 * defined next to site.config.ts without pulling server code into clients.
 */
export interface SiteAdapter {
  /** Shopify store subdomain of the parent, e.g. "luxurywallartwork" or "36hz80-wh" */
  store: string;
  /** Parent storefront domain used for purchase links, e.g. "luxurywallart.com" */
  parentDomain: string;
  /** Shopify numeric collection ids to pull products from (tags mode; site.config shopifyCollections) */
  sourceCollectionIds: number[];
  /** Tag rules: site-local collection handle -> parent-store tags that map into it (tags mode) */
  tagRules: Record<string, string[]>;
  /**
   * Classification mode. 'tags' (default): fetch sourceCollectionIds, classify by tagRules.
   * 'collections': each local handle maps 1:1 to its source Shopify collection(s)
   * via collectionMap; membership IS the classification (the 2026-07 converted sites).
   */
  classifyBy?: 'tags' | 'collections';
  /** collections mode: site-local handle -> source Shopify collection id(s) */
  collectionMap?: Record<string, number | number[]>;
  /** Optional cap on products returned per local collection (wallartformen grid cap) */
  gridCap?: number;
  /** When no tag rule matches, assign the product to ALL local collections (bankruptsaint behavior) */
  fallbackAllOnNoMatch?: boolean;
  /** Products carrying any of these tags are excluded entirely. Default: ["sveta"] */
  excludeTags?: string[];
  /** When set, ONLY products carrying at least one of these tags are included (artist filter) */
  requireAnyTags?: string[];
  /** Suffix for generated image alt text, e.g. "lion wall art canvas print" */
  altSuffix: string;
  /**
   * Optional purchase-link rewrite: product handle -> handle on another storefront.
   * Handles in this map link to `purchaseDomainOverride` instead of `parentDomain`.
   */
  purchaseHandleMap?: Record<string, string>;
  /** Domain used for handles in purchaseHandleMap, e.g. "thedopeart.com" */
  purchaseDomainOverride?: string;
  /** Env var holding the Admin API token. Default: SHOPIFY_ACCESS_TOKEN */
  accessTokenEnv?: string;
  /**
   * Curation price cap: products whose CHEAPEST variant exceeds this (USD) are
   * excluded, so every grid leads with the shared entry tier (89 across
   * LWA/WCA). Unset = no price filtering.
   */
  maxEntryPrice?: number;
  /** Curation blocklist: parent-store product handles never shown on this satellite. */
  excludeHandles?: string[];
  /**
   * Minimum products a local collection must resolve before the build logs a
   * MIN-COUNT warning (or fails when SATELLITE_MIN_COUNT_STRICT=1). Default: 12.
   */
  minCollectionCount?: number;
  /**
   * Per-local-collection curation on top of collection membership (collections
   * mode): a product joins the local handle only if it carries at least one
   * requireAnyTags tag (when set) and none of the excludeTags. Parent-store
   * smart collections are often broader than a satellite niche (LWA
   * "portrait-art" includes animal portraits); this trims them to theme.
   */
  collectionRefine?: Record<string, { requireAnyTags?: string[]; excludeTags?: string[] }>;
  /**
   * How this satellite sells. Omitted or 'link' keeps the legacy behavior:
   * the buy CTA is an outbound link to the parent storefront.
   *
   * 'cart' gives the satellite its own cart via the Storefront API, so the
   * shopper only leaves at the hosted checkout step. Requires the products to
   * be published to the Headless sales channel that issued the token.
   */
  commerce?: CommerceConfig;
}

export interface CommerceConfig {
  mode: 'link' | 'cart';
  /**
   * Storefront API host for the backing store, e.g. "luxurywallartwork.myshopify.com".
   * One satellite maps to exactly ONE store: a Storefront cart cannot mix
   * merchandise from two stores, so a site selling both LWA and TDA products
   * needs those products duplicated into a single backing store.
   */
  storefrontDomain: string;
  /**
   * Env var holding the PUBLIC Storefront API token. Must be readable in the
   * browser, so it has to be NEXT_PUBLIC_-prefixed. Storefront tokens are
   * designed to be public and are scoped to read + cart only.
   * Default: NEXT_PUBLIC_SHOPIFY_STOREFRONT_TOKEN
   */
  storefrontTokenEnv?: string;
}

/** Minimal site identity the PDP renderer and metadata builder need. */
export interface SiteMeta {
  /** Site display name, e.g. "Lion Wall Art" */
  name: string;
  /** Site domain without protocol, e.g. "lionwallart.com" */
  domain: string;
  /** Parent store label for the buy CTA, e.g. "LuxuryWallArt" */
  parentLabel: string;
}

/** One product's differentiation content on one site. All handwritten/pre-generated, never built at render time. */
export interface PdpContent {
  /** Parent-store product handle this content belongs to */
  handle: string;
  /** Full <title> tag content (no site template applied on top) */
  seoTitle: string;
  metaDescription: string;
  /** Optional OG overrides; fall back to seoTitle / metaDescription */
  ogTitle?: string;
  ogDescription?: string;
  /** Niche-framed on-page intro. Plain text with \n\n paragraph breaks. Never the parent store description. */
  intro: string;
  /** Short niche-specific FAQ. Plain-text answers. */
  faqs: { question: string; answer: string }[];
  /** Niche-relevant alt text for the primary image */
  imageAlt: string;
  /** Site-local collection handles to link to from this page (validated at generation time) */
  relatedCollections: string[];
  /**
   * Optional "About this piece" section. HTML-lite: only <strong> and <a> with
   * site-internal hrefs (/collections/... or /blog/...) are allowed; the lint
   * gate enforces this. Long-tail keyword bolds live here.
   */
  about?: string;
}

/** Site-level product facts shown in the Details block (reuse the site's existing boilerplate copy). */
export interface SiteDetails {
  materials: string;
  sizes: string;
  shipping: string;
}

/** A blog post link shown in the "From the blog" section. */
export interface RelatedPostRef {
  slug: string;
  title: string;
}

export type PdpContentMap = Record<string, PdpContent>;

/** Per-site style overrides for the shared card (plain strings: safe across the client boundary). */
export interface CardStyles {
  title?: string;
  price?: string;
  frame?: string;
}

/** Site-local collection info the PDP needs for internal links (subset of each site's Collection type). */
export interface CollectionRef {
  handle: string;
  title: string;
}
