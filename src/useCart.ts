'use client';

// React binding over cart.ts. One hook per site, mounted wherever the cart UI
// lives (drawer, header badge, cart page).

import { useCallback, useEffect, useState } from 'react';
import {
  addToCart as addToCartApi,
  clearStoredCartId,
  getCart,
  readStoredCartId,
  updateLine as updateLineApi,
  CartError,
  type Cart,
  type CartLineInput,
} from './cart';
import type { CommerceConfig } from './types';

export interface UseCart {
  cart: Cart | null;
  /** Item count for a header badge. 0 while loading or empty. */
  count: number;
  loading: boolean;
  /** Last failure, surfaced so the UI can show it instead of failing silently. */
  error: string | null;
  add: (lines: CartLineInput[]) => Promise<void>;
  setQuantity: (lineId: string, quantity: number) => Promise<void>;
  remove: (lineId: string) => Promise<void>;
  /** Hosted Shopify checkout for the current cart, or null when empty. */
  checkoutUrl: string | null;
}

export function useCart(commerce: CommerceConfig | undefined): UseCart {
  const [cart, setCart] = useState<Cart | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const enabled = commerce?.mode === 'cart';

  // Rehydrate an existing cart on mount. A cart Shopify has expired comes back
  // as null, so drop the stale id rather than leaving a badge showing a cart
  // that no longer exists.
  useEffect(() => {
    if (!enabled || !commerce) return;
    const storedId = readStoredCartId(commerce);
    if (!storedId) return;

    let cancelled = false;
    setLoading(true);
    getCart(commerce, storedId)
      .then((existing) => {
        if (cancelled) return;
        if (existing) setCart(existing);
        else clearStoredCartId(commerce);
      })
      .catch(() => {
        if (!cancelled) clearStoredCartId(commerce);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [enabled, commerce]);

  const run = useCallback(
    async (op: () => Promise<Cart>) => {
      setLoading(true);
      setError(null);
      try {
        setCart(await op());
      } catch (err) {
        setError(err instanceof CartError ? err.message : 'Something went wrong. Please try again.');
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  const add = useCallback(
    async (lines: CartLineInput[]) => {
      if (!enabled || !commerce) return;
      await run(() => addToCartApi(commerce, lines));
    },
    [enabled, commerce, run],
  );

  const setQuantity = useCallback(
    async (lineId: string, quantity: number) => {
      if (!enabled || !commerce || !cart) return;
      await run(() => updateLineApi(commerce, cart.id, lineId, quantity));
    },
    [enabled, commerce, cart, run],
  );

  // Quantity 0 is how the Storefront API removes a line.
  const remove = useCallback((lineId: string) => setQuantity(lineId, 0), [setQuantity]);

  return {
    cart,
    count: cart?.totalQuantity ?? 0,
    loading,
    error,
    add,
    setQuantity,
    remove,
    checkoutUrl: cart && cart.totalQuantity > 0 ? cart.checkoutUrl : null,
  };
}
