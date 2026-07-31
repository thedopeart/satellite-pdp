'use client';

// Cart state has to be shared between the header badge, the drawer and the PDP
// add button, so useCart lives behind one provider rather than being called in
// three places (which would give three independent carts).

import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { useCart, type UseCart } from '../useCart';
import type { CommerceConfig } from '../types';

export interface CartContextValue extends UseCart {
  /** Whether the drawer is showing. */
  open: boolean;
  openCart: () => void;
  closeCart: () => void;
  /** True when the site is configured for its own cart. */
  enabled: boolean;
}

const CartContext = createContext<CartContextValue | null>(null);

export default function CartProvider({
  commerce,
  children,
}: {
  commerce?: CommerceConfig;
  children: React.ReactNode;
}) {
  const cart = useCart(commerce);
  const [open, setOpen] = useState(false);

  const openCart = useCallback(() => setOpen(true), []);
  const closeCart = useCallback(() => setOpen(false), []);

  const value = useMemo<CartContextValue>(
    () => ({ ...cart, open, openCart, closeCart, enabled: commerce?.mode === 'cart' }),
    [cart, open, openCart, closeCart, commerce],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

/**
 * Returns null when there is no provider, so a site still in 'link' mode can
 * render the cart components without crashing. Callers must handle null.
 */
export function useCartContext(): CartContextValue | null {
  return useContext(CartContext);
}
