// Storefront API cart layer.
//
// Separate from shopify.ts on purpose. That module is the BUILD-TIME catalog
// fetch (Admin REST, runs on the server, reads products regardless of which
// sales channel they are published to). This module is the RUNTIME cart, runs
// in the browser, and talks to the Storefront API.
//
// The split matters for the exclusive-artwork model: a product published ONLY
// to the Headless channel has no parent-store URL to duplicate, but Admin REST
// still returns it for the catalog. Storefront API, by contrast, only sees
// products published to the channel that issued the token, which is exactly
// the guarantee we want on the cart side.

import type { CommerceConfig } from './types';

const STOREFRONT_API_VERSION = '2025-01';
const CART_ID_KEY = 'satellite_cart_id';

export interface CartLineInput {
  /** Numeric parent-store variant id (SatelliteProduct.variants[].id) */
  variantId: string;
  quantity: number;
}

export interface CartLine {
  id: string;
  quantity: number;
  title: string;
  variantTitle: string;
  image: string | null;
  amount: string;
  currencyCode: string;
}

export interface Cart {
  id: string;
  checkoutUrl: string;
  totalQuantity: number;
  subtotal: string;
  currencyCode: string;
  lines: CartLine[];
}

export class CartError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CartError';
  }
}

/** Shopify wants merchandise ids as GIDs; the Admin REST catalog gives us numbers. */
export function toVariantGid(variantId: string): string {
  return variantId.startsWith('gid://') ? variantId : `gid://shopify/ProductVariant/${variantId}`;
}

function tokenFor(commerce: CommerceConfig): string {
  const envName = commerce.storefrontTokenEnv ?? 'NEXT_PUBLIC_SHOPIFY_STOREFRONT_TOKEN';
  // Next inlines NEXT_PUBLIC_* at build time, so this must be a static-looking
  // lookup on the client. process.env[envName] would not be replaced, hence the
  // explicit fallback to the default name.
  const token =
    process.env.NEXT_PUBLIC_SHOPIFY_STOREFRONT_TOKEN ??
    (process.env as Record<string, string | undefined>)[envName];
  if (!token) {
    throw new CartError(
      `${envName} is not set. Add the Headless channel's public Storefront token to the site env.`,
    );
  }
  return token;
}

const CART_FRAGMENT = `
  fragment CartParts on Cart {
    id
    checkoutUrl
    totalQuantity
    cost { subtotalAmount { amount currencyCode } }
    lines(first: 100) {
      nodes {
        id
        quantity
        cost { totalAmount { amount currencyCode } }
        merchandise {
          ... on ProductVariant {
            title
            image { url }
            product { title }
          }
        }
      }
    }
  }
`;

interface RawCart {
  id: string;
  checkoutUrl: string;
  totalQuantity: number;
  cost: { subtotalAmount: { amount: string; currencyCode: string } };
  lines: {
    nodes: {
      id: string;
      quantity: number;
      cost: { totalAmount: { amount: string; currencyCode: string } };
      merchandise: { title: string; image: { url: string } | null; product: { title: string } };
    }[];
  };
}

function normalize(raw: RawCart): Cart {
  return {
    id: raw.id,
    checkoutUrl: raw.checkoutUrl,
    totalQuantity: raw.totalQuantity,
    subtotal: raw.cost.subtotalAmount.amount,
    currencyCode: raw.cost.subtotalAmount.currencyCode,
    lines: raw.lines.nodes.map((n) => ({
      id: n.id,
      quantity: n.quantity,
      title: n.merchandise.product.title,
      variantTitle: n.merchandise.title,
      image: n.merchandise.image?.url ?? null,
      amount: n.cost.totalAmount.amount,
      currencyCode: n.cost.totalAmount.currencyCode,
    })),
  };
}

async function storefront<T>(
  commerce: CommerceConfig,
  query: string,
  variables: Record<string, unknown>,
): Promise<T> {
  const res = await fetch(
    `https://${commerce.storefrontDomain}/api/${STOREFRONT_API_VERSION}/graphql.json`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Storefront-Access-Token': tokenFor(commerce),
      },
      body: JSON.stringify({ query, variables }),
    },
  );

  if (!res.ok) throw new CartError(`Storefront API error: ${res.status} ${res.statusText}`);

  const json = (await res.json()) as { data?: T; errors?: { message: string }[] };
  if (json.errors?.length) throw new CartError(json.errors.map((e) => e.message).join('; '));
  if (!json.data) throw new CartError('Storefront API returned no data');
  return json.data;
}

/** userErrors are business-level failures (sold out, unpublished variant) and arrive with HTTP 200. */
function assertNoUserErrors(errors: { message: string }[] | undefined): void {
  if (errors?.length) throw new CartError(errors.map((e) => e.message).join('; '));
}

export async function createCart(
  commerce: CommerceConfig,
  lines: CartLineInput[] = [],
): Promise<Cart> {
  const data = await storefront<{
    cartCreate: { cart: RawCart | null; userErrors: { message: string }[] };
  }>(
    commerce,
    `${CART_FRAGMENT}
     mutation CartCreate($lines: [CartLineInput!]) {
       cartCreate(input: { lines: $lines }) {
         cart { ...CartParts }
         userErrors { field message }
       }
     }`,
    {
      lines: lines.map((l) => ({ merchandiseId: toVariantGid(l.variantId), quantity: l.quantity })),
    },
  );

  assertNoUserErrors(data.cartCreate.userErrors);
  if (!data.cartCreate.cart) throw new CartError('Shopify did not return a cart');
  return normalize(data.cartCreate.cart);
}

export async function getCart(commerce: CommerceConfig, cartId: string): Promise<Cart | null> {
  const data = await storefront<{ cart: RawCart | null }>(
    commerce,
    `${CART_FRAGMENT}
     query GetCart($id: ID!) { cart(id: $id) { ...CartParts } }`,
    { id: cartId },
  );
  // Shopify expires carts after ~10 days of inactivity and then returns null.
  return data.cart ? normalize(data.cart) : null;
}

export async function addLines(
  commerce: CommerceConfig,
  cartId: string,
  lines: CartLineInput[],
): Promise<Cart> {
  const data = await storefront<{
    cartLinesAdd: { cart: RawCart | null; userErrors: { message: string }[] };
  }>(
    commerce,
    `${CART_FRAGMENT}
     mutation CartLinesAdd($cartId: ID!, $lines: [CartLineInput!]!) {
       cartLinesAdd(cartId: $cartId, lines: $lines) {
         cart { ...CartParts }
         userErrors { field message }
       }
     }`,
    {
      cartId,
      lines: lines.map((l) => ({ merchandiseId: toVariantGid(l.variantId), quantity: l.quantity })),
    },
  );

  assertNoUserErrors(data.cartLinesAdd.userErrors);
  if (!data.cartLinesAdd.cart) throw new CartError('Shopify did not return a cart');
  return normalize(data.cartLinesAdd.cart);
}

export async function updateLine(
  commerce: CommerceConfig,
  cartId: string,
  lineId: string,
  quantity: number,
): Promise<Cart> {
  // Quantity 0 is Shopify's documented way to remove a line, so this one
  // mutation covers both "change quantity" and "remove".
  const data = await storefront<{
    cartLinesUpdate: { cart: RawCart | null; userErrors: { message: string }[] };
  }>(
    commerce,
    `${CART_FRAGMENT}
     mutation CartLinesUpdate($cartId: ID!, $lines: [CartLineUpdateInput!]!) {
       cartLinesUpdate(cartId: $cartId, lines: $lines) {
         cart { ...CartParts }
         userErrors { field message }
       }
     }`,
    { cartId, lines: [{ id: lineId, quantity }] },
  );

  assertNoUserErrors(data.cartLinesUpdate.userErrors);
  if (!data.cartLinesUpdate.cart) throw new CartError('Shopify did not return a cart');
  return normalize(data.cartLinesUpdate.cart);
}

// ── Cart id persistence ──────────────────────────────────────────────────────
// Scoped per store so a shopper moving between satellites backed by different
// stores does not get handed a cart id the other store will reject.

function storageKey(commerce: CommerceConfig): string {
  return `${CART_ID_KEY}:${commerce.storefrontDomain}`;
}

export function readStoredCartId(commerce: CommerceConfig): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(storageKey(commerce));
  } catch {
    return null; // Safari private mode throws on localStorage access
  }
}

export function storeCartId(commerce: CommerceConfig, cartId: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(storageKey(commerce), cartId);
  } catch {
    /* non-fatal: the cart still works for this page view */
  }
}

export function clearStoredCartId(commerce: CommerceConfig): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(storageKey(commerce));
  } catch {
    /* non-fatal */
  }
}

/**
 * Add to the shopper's cart, creating or recovering one as needed.
 * Handles the expired-cart case: Shopify returns null for a cart that aged out,
 * so we drop the stale id and start a fresh cart rather than throwing.
 */
export async function addToCart(
  commerce: CommerceConfig,
  lines: CartLineInput[],
): Promise<Cart> {
  const existingId = readStoredCartId(commerce);

  if (existingId) {
    try {
      const existing = await getCart(commerce, existingId);
      if (existing) {
        const updated = await addLines(commerce, existingId, lines);
        storeCartId(commerce, updated.id);
        return updated;
      }
    } catch {
      // Fall through to a fresh cart rather than dead-ending the shopper.
    }
    clearStoredCartId(commerce);
  }

  const created = await createCart(commerce, lines);
  storeCartId(commerce, created.id);
  return created;
}
