import React from 'react';
import KitFilterSummaryRow from '@ors/kit/src/filters/FilterSummaryRow';

/**
 * The filter row and its panel — one copy, in the kit (@ors/kit's
 * filters/FilterSummaryRow), shared with the photography map and the photo and
 * spot apps.
 *
 * Wrapped rather than re-exported for one default: alfa's compact filter sits
 * beside a search field, so it's the kit's `pill` form, where the kit's own
 * default is the squarer button that floats over a map.
 */
export default function FilterSummaryRow<T>(props: React.ComponentProps<typeof KitFilterSummaryRow<T>>) {
  return <KitFilterSummaryRow<T> compactVariant="pill" {...props} />;
}

export * from '@ors/kit/src/filters/FilterSummaryRow';
