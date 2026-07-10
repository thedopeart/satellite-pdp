import Link from 'next/link';
import type { CardStyles, CollectionRef, PdpContent, SatelliteProduct, SiteMeta } from '../types';
import { productBreadcrumbJsonLd, productFaqJsonLd, productJsonLd } from '../jsonld';
import JsonLd from '../components/JsonLd';
import ProductGallery from '../components/ProductGallery';
import ProductCard from '../components/ProductCard';
import AnimateIn from '../components/AnimateIn';

export interface ProductPageProps {
  site: SiteMeta;
  product: SatelliteProduct;
  content: PdpContent;
  /** Parent-store URL for the buy CTA (from ProductSource.getPurchaseUrl) */
  purchaseUrl: string;
  /** Products from the same local collection, already filtered/sliced by the caller */
  relatedProducts: SatelliteProduct[];
  /** The site's own collections, used to resolve handles to titles for internal links */
  collections: CollectionRef[];
  cardStyles?: CardStyles;
}

function uniqueSizes(product: SatelliteProduct): string[] {
  const seen = new Set<string>();
  for (const v of product.variants) {
    const t = v.title.trim();
    if (t && t.toLowerCase() !== 'default title') seen.add(t);
  }
  return Array.from(seen);
}

function lowestPrice(product: SatelliteProduct): string {
  const prices = product.variants.map((v) => parseFloat(v.price)).filter((n) => Number.isFinite(n));
  if (!prices.length) return product.price;
  const min = Math.min(...prices);
  return Number.isInteger(min) ? String(min) : min.toFixed(2);
}

/**
 * Shared satellite product detail page.
 * Self-canonical (via buildProductMetadata), niche content from the content
 * layer, live price/size/image data from the parent store, internal links to
 * the site's own collections, and an outbound buy CTA to the parent store.
 */
export default function ProductPage({
  site,
  product,
  content,
  purchaseUrl,
  relatedProducts,
  collections,
  cardStyles,
}: ProductPageProps) {
  const byHandle = new Map(collections.map((c) => [c.handle, c]));
  const primaryCollection = product.collectionHandles
    .map((h) => byHandle.get(h))
    .find((c): c is CollectionRef => Boolean(c));
  const relatedCollections = content.relatedCollections
    .map((h) => byHandle.get(h))
    .filter((c): c is CollectionRef => Boolean(c));

  const sizes = uniqueSizes(product);
  const fromPrice = lowestPrice(product);
  const introParagraphs = content.intro.split('\n\n').map((p) => p.trim()).filter(Boolean);
  const faqSchema = productFaqJsonLd(content);

  return (
    <>
      <JsonLd data={productJsonLd(site, product, content)} />
      <JsonLd data={productBreadcrumbJsonLd(site, product, primaryCollection)} />
      {faqSchema && <JsonLd data={faqSchema} />}

      <section className="mx-auto max-w-[1280px] px-6 pt-6 pb-12 md:pb-16">
        {/* Breadcrumbs */}
        <nav className="flex items-center gap-2 text-sm md:text-xs font-medium mb-8 flex-wrap">
          <Link href="/" className="hover:text-[var(--text-muted)] transition-colors">Home</Link>
          <span className="text-[var(--text-muted)]">/</span>
          <Link href="/collections" className="hover:text-[var(--text-muted)] transition-colors">Collections</Link>
          {primaryCollection && (
            <>
              <span className="text-[var(--text-muted)]">/</span>
              <Link
                href={`/collections/${primaryCollection.handle}`}
                className="hover:text-[var(--text-muted)] transition-colors"
              >
                {primaryCollection.title}
              </Link>
            </>
          )}
          <span className="text-[var(--text-muted)]">/</span>
          <span className="text-[var(--text-muted)]">{product.title}</span>
        </nav>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-10 lg:gap-16">
          {/* Left: gallery */}
          <ProductGallery
            images={product.images}
            primaryAlt={content.imageAlt}
            title={product.title}
          />

          {/* Right: product info */}
          <div>
            <h1 className="text-3xl md:text-4xl font-normal leading-tight mb-3">
              {product.title}
            </h1>

            <p className="text-xl mb-6">
              From ${fromPrice}
              {product.compareAtPrice && parseFloat(product.compareAtPrice) > parseFloat(product.price) && (
                <span className="ml-3 text-base text-[var(--text-muted)] line-through">
                  ${product.compareAtPrice}
                </span>
              )}
            </p>

            {/* Niche intro (unique per product per site) */}
            <div className="space-y-4 mb-8">
              {introParagraphs.map((para, i) => (
                <p key={i} className="text-[15px] leading-relaxed text-[var(--text-muted)]">
                  {para}
                </p>
              ))}
            </div>

            {sizes.length > 0 && (
              <div className="mb-8">
                <h2 className="text-sm font-medium mb-3">Available sizes</h2>
                <div className="flex flex-wrap gap-2">
                  {sizes.map((size) => (
                    <span
                      key={size}
                      className="px-3 py-1.5 border border-[var(--border)] text-xs tracking-wide"
                    >
                      {size}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Buy CTA: purchase happens on the parent store */}
            <a
              href={purchaseUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center w-full sm:w-auto px-8 py-4 bg-[var(--foreground)] text-[var(--background)] text-sm hover:opacity-90 transition-opacity"
            >
              Buy on {site.parentLabel}
            </a>
            <p className="mt-3 text-xs text-[var(--text-muted)]">
              Checkout, shipping, and returns are handled by {site.parentLabel}.
            </p>

            {relatedCollections.length > 0 && (
              <div className="mt-10 pt-8 border-t border-[var(--border)]">
                <h2 className="text-sm font-medium mb-3">On this site</h2>
                <ul className="space-y-2">
                  {relatedCollections.map((c) => (
                    <li key={c.handle}>
                      <Link
                        href={`/collections/${c.handle}`}
                        className="text-sm underline underline-offset-4 hover:text-[var(--text-muted)] transition-colors"
                      >
                        {c.title}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* FAQ (unique per product per site) */}
      {content.faqs.length > 0 && (
        <section className="mx-auto max-w-3xl px-6 pb-12 md:pb-16">
          <AnimateIn>
            <h2 className="text-2xl font-light mb-8">Common questions</h2>
            <div className="space-y-6">
              {content.faqs.map((faq) => (
                <div key={faq.question} className="border-b border-[var(--border)] pb-6">
                  <h3 className="text-sm font-medium mb-2">{faq.question}</h3>
                  <p className="text-sm text-[var(--text-muted)] leading-relaxed">{faq.answer}</p>
                </div>
              ))}
            </div>
          </AnimateIn>
        </section>
      )}

      {/* Related pieces on this site */}
      {relatedProducts.length > 0 && (
        <section className="bg-[var(--surface)]">
          <div className="mx-auto max-w-[1280px] px-6 py-12 md:py-16">
            <AnimateIn>
              <h2 className="text-2xl font-light mb-8">
                More {primaryCollection ? primaryCollection.title.toLowerCase() : 'pieces'} on {site.name}
              </h2>
            </AnimateIn>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-8">
              {relatedProducts.slice(0, 4).map((p) => (
                <ProductCard key={p.id} product={p} styles={cardStyles} />
              ))}
            </div>
          </div>
        </section>
      )}
    </>
  );
}
