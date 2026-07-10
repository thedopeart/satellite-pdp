'use client';

import { useState, useMemo } from 'react';
import CollectionGrid from './CollectionGrid';
import type { CardStyles, SatelliteProduct } from '../types';

type SortKey = 'featured' | 'price-asc' | 'price-desc' | 'az';

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: 'featured', label: 'Featured' },
  { value: 'price-asc', label: 'Price: Low to High' },
  { value: 'price-desc', label: 'Price: High to Low' },
  { value: 'az', label: 'A-Z' },
];

function sortProducts(products: SatelliteProduct[], key: SortKey): SatelliteProduct[] {
  if (key === 'featured') return products;
  const copy = [...products];
  if (key === 'price-asc') return copy.sort((a, b) => parseFloat(a.price) - parseFloat(b.price));
  if (key === 'price-desc') return copy.sort((a, b) => parseFloat(b.price) - parseFloat(a.price));
  if (key === 'az') return copy.sort((a, b) => a.title.localeCompare(b.title));
  return copy;
}

interface SortedCollectionGridProps {
  products: SatelliteProduct[];
  cardStyles?: CardStyles;
}

export default function SortedCollectionGrid({ products, cardStyles }: SortedCollectionGridProps) {
  const [sort, setSort] = useState<SortKey>('featured');
  const sorted = useMemo(() => sortProducts(products, sort), [products, sort]);

  return (
    <div>
      <div className="flex justify-end mb-6">
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as SortKey)}
          className="text-sm border border-[var(--border)] bg-[var(--surface)] text-[var(--text-primary)] px-3 py-2 rounded-md focus:outline-none cursor-pointer"
        >
          {SORT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>
      <CollectionGrid products={sorted} cardStyles={cardStyles} />
    </div>
  );
}
