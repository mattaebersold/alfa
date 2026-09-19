import type { Listing } from '../../types/api';

/**
 * How a listing reads — the one place the marketplace turns a record into words.
 *
 * A price is four different sentences depending on `price_mode`, `obo` and
 * whether it's a want ad, and the card, the summary panel and the create form's
 * preview all have to agree on which. They did not, when each had its own
 * `${price}` template: a free listing showed "$0" on the card and "Free" in the
 * panel.
 */

/**
 * The category keys the server stores, as people say them.
 *
 * The keys come from `GET /api/marketplace/meta` — this only supplies the
 * wording, and falls back to a de-underscored key for anything added on the
 * server before it's named here.
 */
export const LISTING_CATEGORY_LABELS: Record<string, string> = {
  car: 'Car',
  part_out: 'Part-out',
  part: 'Part',
  wheels_tires: 'Wheels & tires',
  accessories: 'Accessories',
  other: 'Other',
};

export const categoryLabel = (key?: string | null): string => {
  if (!key) return '';
  return LISTING_CATEGORY_LABELS[key] ?? key.replace(/_/g, ' ');
};

/**
 * The 0-5 condition scale, worst to best.
 *
 * The filter UI reads these off `/meta` so the app can't drift from the
 * collection. This copy is only the fallback for a card rendered before that
 * one-off request has landed — mirrors models/Listing.js CONDITIONS.
 */
export const LISTING_CONDITIONS = ['For parts', 'Poor', 'Fair', 'Good', 'Very good', 'New'];

export const conditionLabel = (
  condition?: number | null,
  conditions: string[] = LISTING_CONDITIONS,
): string | null => {
  if (condition === null || condition === undefined) return null;
  return conditions[condition] ?? null;
};

/** How a category's fields are shaped — what the create form asks for. */
export const isVehicleCategory = (category?: string | null) =>
  category === 'car' || category === 'part' || category === 'part_out' || category === 'wheels_tires';

export const isDiecastCategory = (category?: string | null) => category === 'diecast';

/** `$1,200`, with no trailing `.00` on a round number. */
const money = (n: number) =>
  `$${Number.isInteger(n) ? n.toLocaleString() : n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/**
 * What the price says.
 *
 * A want ad names what the buyer will pay, or says nothing at all — "$0" and
 * "Free" are both wrong for a want with no budget set, and an empty pill is
 * better than either. A sale says its amount, "Free" or "Trade", with OBO
 * appended when the seller is open to offers.
 */
export function priceLabel(listing: Pick<Listing,
  'kind' | 'price' | 'price_mode' | 'obo' | 'willing_to_pay'>): string | null {
  if (listing.kind === 'want') {
    const wtp = listing.willing_to_pay;
    return wtp === null || wtp === undefined ? null : `Will pay ${money(wtp)}`;
  }
  if (listing.price_mode === 'free') return 'Free';
  if (listing.price_mode === 'trade') return 'Trade';
  if (listing.price === null || listing.price === undefined) return null;
  return listing.obo ? `${money(listing.price)} OBO` : money(listing.price);
}

/** The struck-through number beside a price that's been dropped. */
export const previousPriceLabel = (listing: Pick<Listing, 'previous_price' | 'price_mode'>): string | null =>
  listing.price_mode === 'amount' && listing.previous_price ? money(listing.previous_price) : null;

/**
 * "12 mi away". Only when the browse was measured from somewhere — an absent
 * distance means we don't know where the viewer is, not that it's next door.
 */
export function distanceLabel(miles?: number | null): string | null {
  if (miles === null || miles === undefined || !Number.isFinite(miles)) return null;
  if (miles < 1) return 'Under a mile';
  return `${Math.round(miles)} mi away`;
}

/** Why this listing is at the top of the list — e.g. "Matches your Porsche 911". */
export function matchLabel(listing: Pick<Listing, 'matches_garage' | 'make' | 'model'>): string | null {
  if (!listing.matches_garage) return null;
  const car = [listing.make, listing.model].filter(Boolean).join(' ');
  return car ? `Matches your ${car}` : 'Matches your garage';
}

/** How it changes hands. Null for 'pickup', which is the unremarkable default. */
export function shippingLabel(shipping?: Listing['shipping']): string | null {
  if (shipping === 'ship') return 'Ships';
  if (shipping === 'both') return 'Ships or pickup';
  return null;
}
