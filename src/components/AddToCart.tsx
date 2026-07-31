'use client';

// Replaces SizeSelect + the outbound buy link when a site runs commerce.mode
// 'cart'. Variant choice and the add action have to live in one component
// because the cart line needs the selected variant's id.

import { useState } from 'react';
import { useCartContext } from './CartProvider';
import type { ProductVariant } from '../types';

interface AddToCartProps {
  variants: ProductVariant[];
  /** Shown when the selected variant has no id (catalog built before v0.3.0). */
  fallbackUrl: string;
  fallbackLabel: string;
}

export default function AddToCart({ variants, fallbackUrl, fallbackLabel }: AddToCartProps) {
  const cart = useCartContext();
  const options = variants.filter((v) => v.title.trim().toLowerCase() !== 'default title');
  const list = options.length ? options : variants;
  const [selected, setSelected] = useState(0);
  const [justAdded, setJustAdded] = useState(false);

  const current = list[Math.min(selected, list.length - 1)];

  // Without a provider, or without a variant id, fall back to the parent-store
  // link rather than rendering a button that cannot work.
  if (!cart?.enabled || !current?.id) {
    return (
      <a
        href={fallbackUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center justify-center w-full sm:w-auto px-8 py-4 bg-[var(--foreground)] text-[var(--background)] text-sm hover:opacity-90 transition-opacity"
      >
        {fallbackLabel}
      </a>
    );
  }

  const price = parseFloat(current.price);

  async function add() {
    if (!cart || !current?.id) return;
    try {
      await cart.add([{ variantId: current.id, quantity: 1 }]);
      setJustAdded(true);
      cart.openCart();
      setTimeout(() => setJustAdded(false), 2000);
    } catch {
      // useCart already captured the message into cart.error; the block below
      // renders it. Swallowing here keeps an expected failure out of the console.
    }
  }

  return (
    <div>
      {list.length > 1 && (
        <div className="mb-6">
          <label htmlFor="pdp-size" className="block text-sm font-medium mb-2">
            Size and finish
          </label>
          <div className="flex items-center gap-4">
            <select
              id="pdp-size"
              value={selected}
              onChange={(e) => setSelected(Number(e.target.value))}
              className="border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
            >
              {list.map((v, i) => (
                <option key={v.id ?? v.title} value={i}>
                  {v.title}
                </option>
              ))}
            </select>
            {Number.isFinite(price) && <span className="text-sm">${price.toFixed(2)}</span>}
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={add}
        disabled={cart.loading}
        className="inline-flex items-center justify-center w-full sm:w-auto px-8 py-4 bg-[var(--foreground)] text-[var(--background)] text-sm hover:opacity-90 transition-opacity disabled:opacity-60"
      >
        {cart.loading ? 'Adding…' : justAdded ? 'Added to cart' : 'Add to cart'}
      </button>

      {cart.error && (
        <p className="mt-3 text-xs text-red-600" role="alert">
          {cart.error}
        </p>
      )}
      <p className="mt-3 text-xs text-[var(--text-muted)]">
        Secure checkout by Shopify. Free returns within 30 days.
      </p>
    </div>
  );
}
