import Link from 'next/link';
import type {
  CardStyles,
  CollectionRef,
  PdpContent,
  RelatedPostRef,
  SatelliteProduct,
  SiteDetails,
  SiteMeta,
} from '../types';
import { productBreadcrumbJsonLd, productFaqJsonLd, productJsonLd } from '../jsonld';
import JsonLd from '../components/JsonLd';
import ProductGallery from '../components/ProductGallery';
import ProductCard from '../components/ProductCard';
import SizeSelect from '../components/SizeSelect';
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
  /** Site-level Materials / Sizes / Shipping facts (reuse the site's existing boilerplate) */
  details?: SiteDetails;
  /** Site blog posts related to this product's collections */
  relatedPosts?: RelatedPostRef[];
  cardStyles?: CardStyles;
}

function lowestPrice(product: SatelliteProduct): string {
  const prices = product.variants.map((v) => parseFloat(v.price)).filter((n) => Number.isFinite(n));
  if (!prices.length) return product.price;
  const min = Math.min(...prices);
  return Number.isInteger(min) ? String(min) : min.toFixed(2);
}

/**
 * Shared satellite product detail page.
 * Self-canonical, niche content from the content layer, live price/size/image
 * data from the parent store, internal links to the site's own collections and
 * blog, and an outbound buy CTA to the parent store.
 */
export default function ProductPage({
  site,
  product,
  content,
  purchaseUrl,
  relatedProducts,
  collections,
  details,
  relatedPosts = [],
  cardStyles,
}: ProductPageProps) {
  const byHandle = new Map(collections.map((c) => [c.handle, c]));
  const primaryCollection = product.collectionHandles
    .map((h) => byHandle.get(h))
    .find((c): c is CollectionRef => Boolean(c));
  const relatedCollections = content.relatedCollections
    .map((h) => byHandle.get(h))
    .filter((c): c is CollectionRef => Boolean(c));

  const fromPrice = lowestPrice(product);
  const introParagraphs = content.intro.split('\n\n').map((p) => p.trim()).filter(Boolean);
  const faqSchema = productFaqJsonLd(content);

  // Long-form body text uses the site's main foreground color: muted palettes
  // (olive on brown etc.) fail contrast on paragraph-length text.
  const bodyText = 'text-[15px] leading-relaxed text-[var(--foreground)] opacity-90';

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

        <div className="grid grid-cols-1 md:grid-cols-[1.15fr_1fr] gap-10 lg:gap-16">
          {/* Left: gallery (dominant) */}
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
                <p key={i} className={bodyText}>
                  {para}
                </p>
              ))}
            </div>

            <SizeSelect variants={product.variants} />

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

            {/* Site-level product facts */}
            {details && (
              <div className="mt-10 pt-8 border-t border-[var(--border)] space-y-4">
                <div>
                  <h2 className="text-sm font-medium mb-1.5">Materials</h2>
                  <p className={bodyText}>{details.materials}</p>
                </div>
                <div>
                  <h2 className="text-sm font-medium mb-1.5">Sizes</h2>
                  <p className={bodyText}>{details.sizes}</p>
                </div>
                <div>
                  <h2 className="text-sm font-medium mb-1.5">Shipping</h2>
                  <p className={bodyText}>{details.shipping}</p>
                </div>
              </div>
            )}

            {(relatedCollections.length > 0 || relatedPosts.length > 0) && (
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
                  {relatedPosts.map((p) => (
                    <li key={p.slug}>
                      <Link
                        href={`/blog/${p.slug}`}
                        className="text-sm underline underline-offset-4 hover:text-[var(--text-muted)] transition-colors"
                      >
                        {p.title}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* About this piece (unique long-tail content, HTML-lite from the content layer) */}
      {content.about && (
        <section className="mx-auto max-w-3xl px-6 pb-12 md:pb-16">
          <AnimateIn>
            <h2 className="text-2xl font-light mb-6">About this piece</h2>
            <div
              className={`${bodyText} space-y-4 [&_a]:underline [&_a]:underline-offset-4`}
              dangerouslySetInnerHTML={{
                __html: content.about
                  .split('\n\n')
                  .map((p) => `<p>${p.trim()}</p>`)
                  .join(''),
              }}
            />
          </AnimateIn>
        </section>
      )}

      {/* FAQ accordion (unique per product per site; native details = crawlable) */}
      {content.faqs.length > 0 && (
        <section className="mx-auto max-w-3xl px-6 pb-12 md:pb-16">
          <AnimateIn>
            <h2 className="text-2xl font-light mb-6">Common questions</h2>
            <div>
              {content.faqs.map((faq) => (
                <details
                  key={faq.question}
                  className="group border-b border-[var(--border)] py-4"
                >
                  <summary className="flex items-center justify-between gap-4 cursor-pointer list-none text-sm font-medium">
                    {faq.question}
                    <span
                      aria-hidden
                      className="shrink-0 text-[var(--text-muted)] transition-transform duration-200 group-open:rotate-45 text-lg leading-none"
                    >
                      +
                    </span>
                  </summary>
                  <p className={`${bodyText} pt-3`}>{faq.answer}</p>
                </details>
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
              {relatedProducts.slice(0, 8).map((p) => (
                <ProductCard key={p.id} product={p} styles={cardStyles} />
              ))}
            </div>
          </div>
        </section>
      )}
    </>
  );
}
