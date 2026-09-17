import React from 'react';
import FilterSummaryRow, { FilterChoiceRow } from '../ui/FilterSummaryRow';
import LocationFilterRow, { locationPill } from '../ui/LocationFilterRow';
import { EVENT_CATEGORIES } from '../../constants/eventTypes';
import type { LocationChoice } from '../../hooks/useLocationFilter';

interface EventFiltersProps {
  location: {
    choice: LocationChoice;
    choose: (next: LocationChoice) => void;
    radius: number;
    setRadius: (miles: number) => void;
  };
  /** Regions with something coming up. */
  regions: { key: string; label: string }[];
  category: string | null;
  onCategory: (key: string | null) => void;
  /** Category keys with something in the window — see EventsScreen. */
  presentCategories: Set<string>;
}

interface EventFilterValue {
  choice: LocationChoice;
  radius: number;
  category: string | null;
}

/**
 * Location and type, folded into one row.
 *
 * The two chip rows took a third of the screen above the events they filter,
 * and most visits never touch them. The row says what's applied; tapping it
 * opens both in a panel, and nothing changes until Apply — so trying a
 * combination doesn't refetch the screen behind you on every chip.
 *
 * The row, the panel and the draft are FilterSummaryRow's, shared with groups,
 * members and cars; what's here is only what events filter by.
 */
export default function EventFilters({
  location, regions, category, onCategory, presentCategories,
}: EventFiltersProps) {
  const activeCategory = category ? EVENT_CATEGORIES.find((c) => c.key === category) : undefined;
  const typeLabel = category ? activeCategory?.label ?? category : 'All types';
  const where = locationPill(location.choice, location.radius, regions);

  return (
    <FilterSummaryRow<EventFilterValue>
      value={{ choice: location.choice, radius: location.radius, category }}
      onApply={(draft) => {
        location.choose(draft.choice);
        location.setRadius(draft.radius);
        onCategory(draft.category);
      }}
      // Brand for location, the type's own colour for type — the same fills
      // the panel gives them when selected.
      pills={[where, { key: 'type', label: typeLabel, color: activeCategory?.color }]}
      accessibilityLabel={`Filter events: ${where.label}, ${typeLabel}`}
    >
      {(draft, setDraft) => {
        // Only types with something coming up, as before — plus whichever is
        // picked, applied or drafted, so a choice can't vanish from under you.
        const categories = EVENT_CATEGORIES.filter(
          (c) => presentCategories.has(c.key) || c.key === category || c.key === draft.category,
        );
        return (
          <>
            <LocationFilterRow
              choice={draft.choice}
              onChoose={(choice) => setDraft((d) => ({ ...d, choice }))}
              radius={draft.radius}
              onRadius={(radius) => setDraft((d) => ({ ...d, radius }))}
              regions={regions}
            />

            <FilterChoiceRow<string | null>
              label="Type"
              options={[
                { key: null, label: 'All' },
                ...categories.map((c) => ({ key: c.key, label: c.label, color: c.color })),
              ]}
              selected={draft.category}
              // A second tap on a type goes back to All.
              onSelect={(key) => setDraft((d) => ({ ...d, category: key === d.category ? null : key }))}
            />
          </>
        );
      }}
    </FilterSummaryRow>
  );
}
