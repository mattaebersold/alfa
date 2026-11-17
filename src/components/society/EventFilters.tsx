import type { StyleProp, ViewStyle } from 'react-native';
import React from 'react';
import FilterSummaryRow, { FilterChoiceRow } from '../ui/FilterSummaryRow';
import LocationFilterRow, { locationPill } from '../ui/LocationFilterRow';
import { EVENT_CATEGORIES } from '../../constants/eventTypes';
import type { LocationChoice } from '../../hooks/useLocationFilter';

interface EventFiltersProps {
  location: {
    choice: LocationChoice;
    choose: (next: LocationChoice) => void;
  };
  /** State codes with something coming up; undefined offers every state. */
  states?: string[];
  category: string | null;
  onCategory: (key: string | null) => void;
  /** Category keys with something in the window — see EventsView. */
  presentCategories: Set<string>;
  /**
   * A date window to choose in the panel too — the map's Next 7 days … Next 6
   * months. Left out, the panel has no When.
   */
  window?: {
    value: number;
    options: { days: number; label: string }[];
    /** The one that goes unmentioned on the pill. */
    defaultDays: number;
    onChange: (days: number) => void;
  };
  /** The small pill beside the search, rather than the full row. */
  compact?: boolean;
  style?: StyleProp<ViewStyle>;
}

interface EventFilterValue {
  choice: LocationChoice;
  category: string | null;
  days: number | null;
}

/**
 * Location and type, folded into one row.
 *
 * The two chip rows took a third of the screen above the events they filter,
 * and most visits never touch them. The row says what's applied; tapping it
 * opens both in a panel; taps there mark a draft, and Apply applies it.
 *
 * The two combine — Washington *and* Cars & Coffee — and the row names each
 * that's applied.
 *
 * The row and the panel are FilterSummaryRow's, shared with groups,
 * members and cars; what's here is only what events filter by.
 */
export default function EventFilters({
  location, states, category, onCategory, presentCategories, window, compact, style,
}: EventFiltersProps) {
  const activeCategory = category ? EVENT_CATEGORIES.find((c) => c.key === category) : undefined;
  const typeLabel = category ? activeCategory?.label ?? category : 'All types';
  const where = locationPill(location.choice);
  // The place, and the type when there is one. The type keeps its own
  // colour, as it has in the panel.
  const windowLabel = window && window.value !== window.defaultDays
    ? window.options.find((o) => o.days === window.value)?.label
    : null;
  const applied = [
    where,
    ...(category ? [{ key: 'type', label: typeLabel, color: activeCategory?.color }] : []),
    ...(windowLabel ? [{ key: 'when', label: windowLabel }] : []),
  ];

  return (
    <FilterSummaryRow<EventFilterValue>
      value={{ choice: location.choice, category, days: window?.value ?? null }}
      onApply={(next) => {
        location.choose(next.choice);
        onCategory(next.category);
        if (window && next.days != null) window.onChange(next.days);
      }}
      pills={applied}
      compact={compact}
      style={style}
      accessibilityLabel={`Filter events: ${applied.map((p) => p.label).join(', ')}`}
    >
      {(draft, setDraft) => {
        // Only types with something coming up, as before — plus whichever is
        // applied, so a choice can't vanish from under you.
        const categories = EVENT_CATEGORIES.filter(
          (c) => presentCategories.has(c.key) || c.key === category,
        );
        return (
          <>
            <LocationFilterRow
              choice={draft.choice}
              onChoose={(choice) => setDraft((d) => ({ ...d, choice }))}
              states={states}
              // No All chip on events: Near me toggles, and clearing the state is everywhere.
              showAll={false}
            />

            {/* When — the map's date window, once tabs over the map. */}
            {window ? (
              <>
                <FilterChoiceRow<string>
                  label="When"
                  options={window.options.map((o) => ({ key: String(o.days), label: o.label }))}
                  selected={String(draft.days ?? window.defaultDays)}
                  onSelect={(key) => setDraft((d) => ({ ...d, days: Number(key) }))}
                />
              </>
            ) : null}

            {/* No heading: the types follow the state field. */}
            <FilterChoiceRow<string | null>
              options={[
                { key: null, label: 'All' },
                ...categories.map((c) => ({ key: c.key, label: c.label, color: c.color })),
              ]}
              selected={draft.category}
              // A second tap on the chosen type, or All, clears it.
              onSelect={(key) => setDraft((d) => ({
                ...d,
                category: key === d.category ? null : key,
              }))}
            />
          </>
        );
      }}
    </FilterSummaryRow>
  );
}
