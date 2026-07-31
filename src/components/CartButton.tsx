'use client';

import { useCartContext } from './CartProvider';

/**
 * Header cart trigger with an item-count badge. Renders nothing when the site
 * is still in 'link' commerce mode, so it is safe to mount in a shared header
 * before a satellite is converted.
 */
export default function CartButton({ className = '' }: { className?: string }) {
  const cart = useCartContext();
  if (!cart?.enabled) return null;

  return (
    <button
      type="button"
      onClick={cart.openCart}
      aria-label={cart.count > 0 ? `Open cart, ${cart.count} items` : 'Open cart'}
      className={`relative inline-flex items-center ${className}`}
    >
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 00-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 00-16.536-1.84M7.5 14.25L5.106 5.272M6 20.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm12.75 0a.75.75 0 11-1.5 0 .75.75 0 011.5 0z"
        />
      </svg>
      {cart.count > 0 && (
        <span className="absolute -right-2 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--foreground)] px-1 text-[10px] leading-none text-[var(--background)]">
          {cart.count}
        </span>
      )}
    </button>
  );
}
