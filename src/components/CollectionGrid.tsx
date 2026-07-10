'use client';

import { useState, useEffect } from 'react';
import ProductCard from './ProductCard';
import type { CardStyles, SatelliteProduct } from '../types';

const PAGE_SIZE = 24;

interface CollectionGridProps {
  products: SatelliteProduct[];
  cardStyles?: CardStyles;
}

function SkeletonCard() {
  return (
    <div>
      <div className="aspect-square skeleton rounded mb-4" />
      <div className="h-4 skeleton rounded w-3/4 mb-2" />
      <div className="h-3 skeleton rounded w-1/3" />
    </div>
  );
}

export default function CollectionGrid({ products, cardStyles }: CollectionGridProps) {
  const [visible, setVisible] = useState(PAGE_SIZE);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setLoaded(true), 400);
    return () => clearTimeout(timer);
  }, []);

  if (products.length === 0) {
    return (
      <p className="text-[var(--text-muted)] text-center py-12">
        No products found in this collection.
      </p>
    );
  }

  const shown = products.slice(0, visible);
  const hasMore = visible < products.length;

  if (!loaded) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-8">
        {Array.from({ length: Math.min(PAGE_SIZE, products.length) }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-8">
        {shown.map((product, i) => (
          <div
            key={product.id}
            className="card-reveal"
            style={{ animationDelay: `${Math.min(i, 23) * 40}ms` }}
          >
            <ProductCard product={product} priority={i < 8} styles={cardStyles} />
          </div>
        ))}
      </div>
      {hasMore && (
        <div className="mt-12 text-center">
          <button
            onClick={() => setVisible((v) => v + PAGE_SIZE)}
            className="px-8 py-3 border border-[var(--border)] text-sm hover:bg-[var(--surface)] transition-colors"
          >
            Load More ({products.length - visible} remaining)
          </button>
        </div>
      )}
    </>
  );
}
