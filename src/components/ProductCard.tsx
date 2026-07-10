import Image from 'next/image';
import Link from 'next/link';
import type { CardStyles, SatelliteProduct } from '../types';

interface ProductCardProps {
  product: SatelliteProduct;
  priority?: boolean;
  /** Per-site brand styling overrides (plain class strings) */
  styles?: CardStyles;
}

/**
 * Shared product card. Links internally to the site's own product page when
 * one exists for this handle (product.url + product.external are set by the
 * data layer), otherwise out to the parent store like the old cards did.
 */
export default function ProductCard({ product, priority = false, styles = {} }: ProductCardProps) {
  const frameClass = styles.frame ?? 'aspect-square bg-[var(--surface)] overflow-hidden mb-4';
  const titleClass = styles.title ?? 'text-sm font-medium group-hover:underline underline-offset-4';
  const priceClass = styles.price ?? 'text-sm text-[var(--text-muted)]';

  const inner = (
    <>
      <div className={frameClass}>
        <Image
          src={product.image}
          alt={product.alt}
          width={600}
          height={600}
          loading={priority ? 'eager' : 'lazy'}
          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
        />
      </div>
      <div className="space-y-1">
        <h3 className={titleClass}>{product.title}</h3>
        <p className={priceClass}>From ${product.price}</p>
      </div>
    </>
  );

  if (product.external) {
    return (
      <a href={product.url} target="_blank" rel="noopener noreferrer" className="group block">
        {inner}
      </a>
    );
  }

  return (
    <Link href={product.url} className="group block">
      {inner}
    </Link>
  );
}
