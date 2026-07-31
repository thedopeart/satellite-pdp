'use client';

import { useEffect } from 'react';
import { useCartContext } from './CartProvider';

/**
 * Slide-out cart. Checkout hands off to Shopify's hosted checkout via the
 * cart's checkoutUrl, which is the only point where the shopper leaves this
 * domain.
 */
export default function CartDrawer() {
  const cart = useCartContext();
  const open = Boolean(cart?.open);

  // Escape to close, and lock body scroll while the drawer is up.
  useEffect(() => {
    if (!open || !cart) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') cart.closeCart();
    };
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKey);
    };
  }, [open, cart]);

  if (!cart?.enabled) return null;

  const lines = cart.cart?.lines ?? [];
  const currency = cart.cart?.currencyCode ?? 'USD';

  return (
    <>
      <div
        aria-hidden={!open}
        onClick={cart.closeCart}
        className={`fixed inset-0 z-40 bg-black/40 transition-opacity duration-200 ${
          open ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
      />
      <aside
        role="dialog"
        aria-label="Shopping cart"
        aria-modal={open}
        className={`fixed right-0 top-0 z-50 flex h-full w-full max-w-sm flex-col bg-[var(--background)] shadow-xl transition-transform duration-200 ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <header className="flex items-center justify-between border-b border-[var(--border)] px-5 py-4">
          <h2 className="text-sm font-medium">
            Your cart{cart.count > 0 ? ` (${cart.count})` : ''}
          </h2>
          <button
            type="button"
            onClick={cart.closeCart}
            aria-label="Close cart"
            className="text-xl leading-none text-[var(--text-muted)] hover:opacity-70"
          >
            &times;
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {lines.length === 0 ? (
            <p className="py-10 text-center text-sm text-[var(--text-muted)]">
              {cart.loading ? 'Loading…' : 'Your cart is empty.'}
            </p>
          ) : (
            <ul className="space-y-4">
              {lines.map((line) => (
                <li key={line.id} className="flex gap-3">
                  {line.image ? (
                    // eslint-disable-next-line @next/next/no-img-element -- Shopify CDN, arbitrary host
                    <img
                      src={line.image}
                      alt=""
                      className="h-20 w-16 flex-shrink-0 object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="h-20 w-16 flex-shrink-0 bg-[var(--border)]" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm">{line.title}</p>
                    <p className="mt-0.5 text-xs text-[var(--text-muted)]">{line.variantTitle}</p>
                    <div className="mt-2 flex items-center gap-2">
                      <button
                        type="button"
                        aria-label="Decrease quantity"
                        disabled={cart.loading}
                        onClick={() => cart.setQuantity(line.id, line.quantity - 1)}
                        className="h-6 w-6 border border-[var(--border)] text-xs disabled:opacity-50"
                      >
                        &minus;
                      </button>
                      <span className="text-xs tabular-nums">{line.quantity}</span>
                      <button
                        type="button"
                        aria-label="Increase quantity"
                        disabled={cart.loading}
                        onClick={() => cart.setQuantity(line.id, line.quantity + 1)}
                        className="h-6 w-6 border border-[var(--border)] text-xs disabled:opacity-50"
                      >
                        +
                      </button>
                      <button
                        type="button"
                        disabled={cart.loading}
                        onClick={() => cart.remove(line.id)}
                        className="ml-2 text-xs text-[var(--text-muted)] underline disabled:opacity-50"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                  <span className="text-sm tabular-nums">
                    ${parseFloat(line.amount).toFixed(2)}
                  </span>
                </li>
              ))}
            </ul>
          )}

          {cart.error && (
            <p className="mt-4 text-xs text-red-600" role="alert">
              {cart.error}
            </p>
          )}
        </div>

        <footer className="border-t border-[var(--border)] px-5 py-4">
          <div className="mb-3 flex items-center justify-between text-sm">
            <span>Subtotal</span>
            <span className="tabular-nums">
              ${parseFloat(cart.cart?.subtotal ?? '0').toFixed(2)} {currency}
            </span>
          </div>
          <p className="mb-3 text-xs text-[var(--text-muted)]">
            Shipping and taxes calculated at checkout.
          </p>
          {cart.checkoutUrl ? (
            <a
              href={cart.checkoutUrl}
              className="block w-full bg-[var(--foreground)] px-6 py-3 text-center text-sm text-[var(--background)] hover:opacity-90"
            >
              Checkout
            </a>
          ) : (
            <button
              type="button"
              disabled
              className="w-full cursor-not-allowed bg-[var(--foreground)] px-6 py-3 text-sm text-[var(--background)] opacity-40"
            >
              Checkout
            </button>
          )}
        </footer>
      </aside>
    </>
  );
}
