import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Plus, ArrowDownUp } from 'lucide-react-native';
import SearchPill from '../ui/SearchPill';
import FormInput from '../ui/FormInput';
import FilterSummaryRow, { FilterChoiceRow, FilterLabel, FilterDivider, COMPACT_FILTER_HEIGHT } from '../ui/FilterSummaryRow';
import { colors } from '../../constants/colors';
import { COLOR_BLACK, GUTTER } from '../../constants/config';
import type { ProVideoLength, ProVideoMeta, ProVideoSort } from '../../types/proVideos';

/** What the panel holds — the less-used choices, behind the one pill. */
export interface VideoPanelFilters {
  sort: ProVideoSort;
  length: ProVideoLength | null;
  make: string;
}

/** The space between search, filter and Upload. */
const TOOL_GAP = 8;

const SORT_LABEL: Record<ProVideoSort, string> = {
  newest: 'Newest', popular: 'Popular', longest: 'Longest', shortest: 'Shortest', oldest: 'Oldest',
};
const SORT_ORDER: ProVideoSort[] = ['newest', 'popular', 'longest', 'shortest', 'oldest'];
const LENGTH_LABEL: Record<ProVideoLength, string> = { short: 'Under 5 min', medium: '5–20 min', long: 'Over 20 min' };

/**
 * The Videos pane's filters, laid out as the other browse screens lay theirs
 * out (Cars, Members, the marketplace): search on the left with the filter
 * button beside it (just its icon), and here Upload after it (a red circle,
 * a black +) — all three one height, one gap apart. No scope tabs and no
 * category chips: every video, narrowed by search and the panel.
 *
 * Sort, length and make live in the pill's panel (FilterSummaryRow): they
 * combine, and nothing refetches until Apply.
 */
export default function ProVideoFilters({
  meta, search, onSearch, panel, onPanel, onUpload,
}: {
  meta?: ProVideoMeta;
  search: string;
  onSearch: (q: string) => void;
  panel: VideoPanelFilters;
  onPanel: (f: VideoPanelFilters) => void;
  onUpload: () => void;
}) {
  const sorts = (meta?.sorts?.length ? SORT_ORDER.filter((s) => meta.sorts.includes(s)) : SORT_ORDER);
  const lengths = (meta?.lengths ?? ['short', 'medium', 'long']) as ProVideoLength[];
  const pills = [
    { key: 'sort', label: SORT_LABEL[panel.sort], icon: <ArrowDownUp size={14} color="#000" /> },
    ...(panel.length ? [{ key: 'length', label: LENGTH_LABEL[panel.length] }] : []),
    ...(panel.make ? [{ key: 'make', label: panel.make }] : []),
  ];

  return (
    <View style={styles.wrap}>
      <View style={styles.tools}>
        <SearchPill value={search} onChangeText={onSearch} onClear={() => onSearch('')} placeholder="Search videos..." style={styles.search} />
        <FilterSummaryRow<VideoPanelFilters> value={panel} onApply={onPanel} pills={pills} compact compactVariant="icon" label="Sort and filter">
          {(draft, setDraft) => (
            <>
              <FilterChoiceRow<ProVideoSort>
                label="Sort by"
                options={sorts.map((s) => ({ key: s, label: SORT_LABEL[s] }))}
                selected={draft.sort}
                onSelect={(sort) => setDraft((d) => ({ ...d, sort }))}
              />
              <FilterDivider />
              <FilterChoiceRow<ProVideoLength | null>
                label="Length"
                options={[{ key: null, label: 'Any' }, ...lengths.map((l) => ({ key: l, label: LENGTH_LABEL[l] }))]}
                selected={draft.length}
                onSelect={(length) => setDraft((d) => ({ ...d, length: length === d.length ? null : length }))}
              />
              <FilterDivider />
              <FilterLabel>Make</FilterLabel>
              <FormInput
                value={draft.make}
                onChangeText={(make) => setDraft((d) => ({ ...d, make }))}
                placeholder="Any make — e.g. Porsche"
                autoCapitalize="words"
                autoCorrect={false}
              />
            </>
          )}
        </FilterSummaryRow>
        {/* Upload: a Pro-red circle with a black +. */}
        <TouchableOpacity style={styles.upload} onPress={onUpload} activeOpacity={0.85} accessibilityRole="button" accessibilityLabel="Upload a video">
          <Plus size={20} color={COLOR_BLACK} strokeWidth={2.8} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 10, paddingBottom: 14 },
  // One height for all three (COMPACT_FILTER_HEIGHT) and one gap between them.
  tools: { flexDirection: 'row', alignItems: 'center', gap: TOOL_GAP, paddingHorizontal: GUTTER + 4 },
  search: { flex: 1, height: COMPACT_FILTER_HEIGHT, marginHorizontal: 0 },
  upload: {
    width: COMPACT_FILTER_HEIGHT, height: COMPACT_FILTER_HEIGHT, borderRadius: COMPACT_FILTER_HEIGHT / 2,
    alignItems: 'center', justifyContent: 'center', backgroundColor: colors.pro,
  },
});
