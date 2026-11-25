/**
 * Marketplace finds — Facebook Marketplace listings shared into ORS from a
 * phone's share menu, shown under PRO › Marketplace › Finds. See horacio's
 * models/MarketplaceFind and controllers/marketplaceFindController.
 */
export interface MarketplaceFind {
  internal_id: string;
  title: string | null;
  description: string | null;
  /** Whole dollars; 0 for free. */
  price: number | null;
  /** As Facebook wrote it: "$3369", "Free". */
  price_text: string | null;
  condition: string | null;
  /** "Olalla, Washington" */
  location: string | null;
  /** An S3 filename, or (when the copy failed) Facebook's own photo link. */
  image: string | null;
  /** The listing on Facebook — opens in the Facebook app when it's installed. */
  url: string;
  shared_by: string | null;
  note: string | null;
  share_count: number;
  shared_at: string;
  /** 'failed' — we only have the link. */
  scrape_status: 'ok' | 'partial' | 'failed';
}

export interface MarketplaceFindPage {
  entries: MarketplaceFind[];
  has_more: boolean;
}
