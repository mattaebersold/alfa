/**
 * What a basic membership includes, and where Pro starts.
 *
 * Here rather than inside a screen because the same number has to be told to
 * the member in two places — the garage list and the create form — and two
 * copies of it drift the moment one is changed.
 *
 * Note this is a *presentation* limit today: the API does not enforce it, so it
 * shapes what the app offers rather than what the account can hold.
 */
export const CAR_LIMIT_BASIC = 5;

/**
 * Posts a basic member may publish per calendar month.
 *
 * Unlike the car limit, this one is real: horacio refuses the post. Keep it in
 * step with `helpers/limits.js` there — the app draws the meter, the server
 * decides.
 */
export const POST_LIMIT_BASIC = 20;

/** How many cars this member may keep. Pro is unlimited. */
export function carLimitFor(isPro: boolean): number | null {
  return isPro ? null : CAR_LIMIT_BASIC;
}
