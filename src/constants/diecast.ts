// Diecast listing constants — mirrors Murray's CreateDiecast options.

export const DIECAST_BRANDS = [
  'Hot Wheels', 'Matchbox', 'Johnny Lightning', 'Majorette',
  'Greenlight Collectibles', 'M2 Machines', 'Auto World', 'Maisto',
  'Bburago', 'Racing Champions', 'Jada Toys', 'Motor Max',
  'Tomica (Takara Tomy)', 'Siku', 'Corgi', 'Hot Wheels RLC', 'Dinky', 'Other',
];

export const DIECAST_CONDITIONS = ['In Packaging', 'Near Mint', 'Good', 'Fair', 'Poor'];

/**
 * The diecast words, as points on the marketplace's 0-5 condition scale.
 *
 * Collectors grade in their own vocabulary and the marketplace grades
 * everything from a brake caliper to a whole car, so the two lists can't be
 * one list — this is the join. Sealed on the card is the collector's mint,
 * which is this scale's New.
 */
export const DIECAST_CONDITION_LEVEL: Record<string, number> = {
  'In Packaging': 5,
  'Near Mint': 5,
  Good: 3,
  Fair: 2,
  Poor: 1,
};

export const DIECAST_RARITIES = ['Common', 'Uncommon', 'Rare', 'Super Rare', 'Limited Edition'];

// Blue used across Murray for diecast listings (gated on category === 'diecast').
export const DIECAST_BLUE = '#284682';
export const DIECAST_BLUE_DARK = '#1a2f5a';
