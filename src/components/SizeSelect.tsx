'use client';

import { useState } from 'react';
import type { ProductVariant } from '../types';

interface SizeSelectProps {
  variants: ProductVariant[];
}

/**
 * Compact size/finish dropdown. Purely informational (purchase happens on the
 * parent store): selecting an option shows that variant's price.
 */
export default function SizeSelect({ variants }: SizeSelectProps) {
  const options = variants.filter((v) => v.title.trim().toLowerCase() !== 'default title');
  const [selected, setSelected] = useState(0);

  if (options.length === 0) return null;
  const current = options[Math.min(selected, options.length - 1)];
  const price = parseFloat(current.price);

  return (
    <div className="mb-8">
      <label htmlFor="pdp-size" className="block text-sm font-medium mb-2">
        Size and finish
      </label>
      <div className="flex items-center gap-4">
        <select
          id="pdp-size"
          value={selected}
          onChange={(e) => setSelected(Number(e.target.value))}
          className="max-w-full text-sm border border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] px-3 py-2.5 rounded-md focus:outline-none cursor-pointer"
        >
          {options.map((v, i) => (
            <option key={v.title} value={i}>
              {v.title}
            </option>
          ))}
        </select>
        <span className="text-lg whitespace-nowrap">
          ${Number.isInteger(price) ? price : price.toFixed(2)}
        </span>
      </div>
    </div>
  );
}
