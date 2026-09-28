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
  /** Regions with something coming up. */
  regions: { key: string; label: string }[];
  category: string | null;
  onCategory: (key: string | null) => void;
  /** Category keys with something in the window — see EventsView. */
  presentCategories: Set<string>;
  /** The small pill beside the search, rather than the full row. */
  compact?: boolean;
  style?: StyleProp<ViewStyle>;
}

interface EventFilterValue {
  choice: LocationChoice;
  category: string | null;
}

/**
 * Location and type, folded into one row.
 *
 * The two chip rows took a third of the screen above the events they filter,
 * and most visits never touch them. The row says what's applied; tapping it
 * opens both in a panel; taps there mark a draft, and Apply applies it.
 *
 * The two combine — Northwest *and* Cars & Coffee — and the row names each
 * that's applied.
 *
 * The row and the panel are FilterSummaryRow's, shared with groups,
 * members and cars; what's here is only what events filter by.
 */
export default function EventFilters({
  location, regions, category, onCategory, presentCategories, compact, style,
}: EventFiltersProps) {
  const activeCategory = category ? EVENT_CATEGORIES.find((c) => c.key === category) : undefined;
  const typeLabel = category ? activeCategory?.label ?? category : 'All types';
  const where = locationPill(location.choice, regions);
  // The place, and the type when there is one. The type keeps its own
  // colour, as it has in the panel.
  const applied = [
    where,
    ...(category ? [{ key: 'type', label: typeLabel, color: activeCategory?.color }] : []),
  ];

  return (
    <FilterSummaryRow<EventFilterValue>
      value={{ choice: location.choice, category }}
      onApply={(next) => {
        location.choose(next.choice);
        onCategory(next.category);
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
              regions={regions}
            />

            <FilterChoiceRow<string | null>
              label="Type"
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
