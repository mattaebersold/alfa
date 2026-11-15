import React from 'react';
import BaseFilterSummaryRow from '../../filters/FilterSummaryRow';

/**
 * The filter row and its panel (filters/FilterSummaryRow), shared with the
 * photography map.
 *
 * Wrapped rather than re-exported for one default: alfa's compact filter sits
 * beside a search field, so it's the shared `pill` form, where its own
 * default is the squarer button that floats over a map.
 */
export default function FilterSummaryRow<T>(props: React.ComponentProps<typeof BaseFilterSummaryRow<T>>) {
  return <BaseFilterSummaryRow<T> compactVariant="pill" {...props} />;
}

export * from '../../filters/FilterSummaryRow';
