import React, { useCallback, useEffect, useState, useRef } from 'react';
import { View, StyleSheet, FlatList, RefreshControl } from 'react-native';
import { Text, TextInput } from '@ors/kit';
import { Search } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useGetRoutesQuery } from '../../api/apiService';
import RouteCard from '../../components/cards/RouteCard';
import {
  DEFAULT_FILTERS, SORTS, buildRouteQuery,
} from '../../components/routes/RouteFilters';
import FilterSummaryRow, { FilterChoiceRow } from '../../components/ui/FilterSummaryRow';
import LocationFilterRow, { NO_ZIP_NOTE, locationPill } from '../../components/ui/LocationFilterRow';
import { useLocationFilter, useWidenWhenEmpty } from '../../hooks/useLocationFilter';
import { REGIONS } from '../../constants/regions';
import type { RouteSort } from '../../types/api';
import AppHeader, { useHeaderPad } from '../../components/ui/AppHeader';
import { useScrollTopOnBack } from '../../hooks/useScrollTopOnBack';
import { useCreateRoute } from '../../hooks/useCreateRoute';
import Spinner from '../../components/ui/Spinner';
import EmptyState from '../../components/ui/EmptyState';
import { useColors } from '../../hooks/useColors';
import { useBrandColor, useIsPro } from '../../hooks/useBrandColor';
import ScreenHeading from '../../components/ui/ScreenHeading';
import HeadingActionButton from '../../components/ui/HeadingActionButton';
import { COLOR_GRAY_17, GUTTER } from '../../constants/config';

export default function RoutesScreen() {
  // The header's back button lands here at the top — see useScrollTopOnBack.
  const scrollRef = useRef<FlatList<any>>(null);
  useScrollTopOnBack(scrollRef);
  const colors = useColors();
  const brand = useBrandColor();

  const headerPad = useHeaderPad();
  const isPro = useIsPro();
  // Pro gets the two ways to make one; everyone else, the pitch.
  const { create, upsell } = useCreateRoute();

  /**
   * Search on the left, the filter on the right — the members and cars
   * pattern. The filter's panel holds where (near me by default, measured
   * from your profile's zip) and the order.
   */
  const [query, setQuery] = useState('');
  // What's asked for trails the typing a beat, so a word isn't a request a letter.
  const [debounced, setDebounced] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), 300);
    return () => clearTimeout(t);
  }, [query]);
  const location = useLocationFilter('near');
  const [sort, setSort] = useState<RouteSort>(DEFAULT_FILTERS.sort);

  const { data, isLoading, isFetching, refetch } = useGetRoutesQuery({
    ...buildRouteQuery({ ...DEFAULT_FILTERS, sort }),
    ...(debounced ? { q: debounced } : {}),
    ...location.params,
  });
  const routes = data?.entries ?? [];

  // Near me with no zip to measure from falls back to everything, saying why.
  const { fallBack } = location;
  useEffect(() => {
    if (data?.near_unavailable) fallBack();
  }, [data?.near_unavailable, fallBack]);
  // Nothing near you: everything, rather than an empty list. Not while searching.
  useWidenWhenEmpty(location, {
    settled: !!data && !isFetching && !data.near_unavailable,
    empty: routes.length === 0,
    narrowed: !!debounced,
  });

  const applyFilters = useCallback((next: { location: string; sort: RouteSort }) => {
    if (next.location !== location.choice) location.choose(next.location);
    setSort(next.sort);
  }, [location]);
  const sortLabel = SORTS.find((x) => x.key === sort)?.label ?? 'Newest';

  const onRefresh = useCallback(() => { refetch(); }, [refetch]);

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: colors.bg }]} edges={[]}>
      {/* The app header floats over the content, so the section heading below
          starts clear of it via useHeaderPad(). */}
      <AppHeader />

      <View style={[styles.header, { paddingTop: headerPad }]}>
        <ScreenHeading
          title="Driving Routes"
          inline
          // Shown to everyone, as on the route cards: Pro gets the two ways to
          // make one (record a drive, or plot one already driven), a basic
          // member the pitch for Pro — the API won't take one from them.
          right={
            <HeadingActionButton
              label="New route"
              onPress={create}
              accessibilityLabel="New route"
            />
          }
        />
      </View>

      <View style={styles.toolsRow}>
        <View style={[styles.searchBar, { backgroundColor: CONTROL_BG, borderColor: colors.border }]}>
          <Search size={16} color={colors.grey} />
          <TextInput
            style={[styles.searchInput, { color: colors.fg }]}
            value={query}
            onChangeText={setQuery}
            placeholder="Search routes..."
            placeholderTextColor={colors.grey}
            autoCapitalize="none"
            returnKeyType="search"
          />
        </View>
        <FilterSummaryRow<{ location: string; sort: RouteSort }>
          value={{ location: location.choice, sort }}
          onApply={applyFilters}
          pills={[
            locationPill(location.choice),
            // The order only when it isn't the default, so the pill stays short.
            ...(sort !== DEFAULT_FILTERS.sort ? [{ key: 'sort', label: sortLabel }] : []),
          ]}
          compact
        >
          {(draft, setDraft) => (
            <>
              <LocationFilterRow
                choice={draft.location}
                onChoose={(next) => setDraft((d) => ({ ...d, location: next }))}
              />
              <FilterChoiceRow<RouteSort>
                label="Sort"
                options={SORTS}
                selected={draft.sort}
                onSelect={(next) => setDraft((d) => ({ ...d, sort: next }))}
              />
            </>
          )}
        </FilterSummaryRow>
      </View>
      {/* On the screen, not in the panel — it explains the list below. */}
      {location.fellBack && (
        <Text style={[styles.note, { color: colors.grey }]}>{NO_ZIP_NOTE}</Text>
      )}

      {isLoading ? (
        <Spinner />
      ) : (
        <FlatList
          ref={scrollRef}
          data={routes}
          keyExtractor={(r) => r.internal_id}
          // The home feed's card, as-is: like, comment, its menu, and the
          // create button — and it opens the route the same way.
          renderItem={({ item }) => <RouteCard route={item} />}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={isFetching} onRefresh={onRefresh} tintColor={brand} />
          }
          ListEmptyComponent={debounced || location.choice !== 'all' ? (
            <EmptyState
              title={debounced
                ? `No routes match "${debounced}"`
                : `No routes ${location.choice === 'near'
                  ? `within ${location.radius} miles`
                  : `in the ${REGIONS.find((r) => r.key === location.choice)?.label ?? location.choice}`}`}
            />
          ) : (
            <EmptyState
              title="No routes yet"
              message={isPro
                ? 'Record a drive, or plot one you\'ve already done, with Create your own.'
                : 'Pro members can record and share the roads they drive.'}
            />
          )}
        />
      )}

      {upsell}
    </SafeAreaView>
  );
}

/** The search box's ground, a shade under the card colour — as on members and cars. */
const CONTROL_BG = COLOR_GRAY_17;

const styles = StyleSheet.create({
  root: { flex: 1 },

  // The search and the filter pill, side by side — MembersScreen's measures.
  toolsRow:    { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: GUTTER, marginTop: 6, marginBottom: 4 },
  searchBar:   {
    flex: 1, minWidth: 0, height: 38,
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 14,
    borderRadius: 999, borderWidth: 1,
  },
  searchInput: { flex: 1, fontSize: 15 },
  note:        { fontSize: 12, lineHeight: 17, paddingHorizontal: 12, marginBottom: 6 },

  // ScreenHeading sits at zero; the gutter is here, on the same 12 as the
  // other list screens.
  header: { paddingHorizontal: 12, paddingBottom: 2 },

  // The feed's gutter, so the cards sit exactly as they do there.
  list: { paddingHorizontal: GUTTER, paddingTop: 8, paddingBottom: 100 },
});
