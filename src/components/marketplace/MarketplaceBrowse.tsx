import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity,
  ActivityIndicator, RefreshControl,
  type NativeScrollEvent, type NativeSyntheticEvent,
  type StyleProp, type ViewStyle,
} from 'react-native';
import { Search, X, Plus } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import ScreenHeading from '../ui/ScreenHeading';
import EmptyState from '../ui/EmptyState';
import FilterSummaryRow, { FilterLabel, FilterChoiceRow, type FilterPill } from '../ui/FilterSummaryRow';
import LocationFilterRow, { NO_ZIP_NOTE, locationPill } from '../ui/LocationFilterRow';
import ListingCard from './ListingCard';
import ManageListingsEntry from './ManageListingsEntry';
import ListingSummaryModal from './ListingSummaryModal';
import { categoryLabel } from './listingFormat';
import type { SummaryOrigin } from '../ui/SummaryModal';
import { useGetListingsQuery, useGetListingMetaQuery, useGetUsageQuery } from '../../api/apiService';
import { ProUpsellModal } from '../pro/ProUpsell';
import { LISTING_LIMIT_UPSELL } from '../../constants/limits';
import { useLocationFilter } from '../../hooks/useLocationFilter';
import { useColors } from '../../hooks/useColors';
import { useBrandColor, useIsPro } from '../../hooks/useBrandColor';
import { COMMON_RADIUS, PILL_RADIUS } from '../../constants/radius';
import type { Listing, ListingKind, ListingShipping, ListingSort } from '../../types/api';

const PAGE_SIZE = 12;

/**
 * Everything the panel asks, other than where — that's LocationFilterRow's.
 *
 * Held as one object so FilterSummaryRow can hand the whole set to the panel as
 * a draft and apply it in one go: a filter that refetched on every chip meant
 * trying a combination reran the screen four times on the way to it.
 */
interface MarketFilters {
  /** A LocationChoice: 'near', 'all' or a region key. */
  location: string;
  radius: number;
  /** One category key, or null for all of them. */
  category: string | null;
  /** A floor on the 0-5 scale — "Good or better". */
  conditionMin: number | null;
  shipping: ListingShipping | null;
  minPrice: string;
  maxPrice: string;
  sort: ListingSort;
}

/**
 * How the list is ordered.
 *
 * 'match' is the default and does the work the marketplace exists for: the
 * server floats listings that fit a car in your garage, nearest first
 * underneath. Distance is only offered once there's a point from which to
 * measure.
 */
const SORT_OPTIONS: { key: ListingSort; label: string; needsLocation?: boolean }[] = [
  { key: 'match',      label: 'Best match' },
  { key: 'recent',     label: 'Newest' },
  { key: 'price_asc',  label: 'Price: low' },
  { key: 'price_desc', label: 'Price: high' },
  { key: 'distance',   label: 'Nearest', needsLocation: true },
];

const SHIPPING_OPTIONS: { key: ListingShipping | null; label: string }[] = [
  { key: null,     label: 'Any' },
  { key: 'pickup', label: 'Pickup' },
  { key: 'ship',   label: 'Ships' },
  { key: 'both',   label: 'Either' },
];

/** A price box's contents as the API wants it — never NaN, which matches nothing. */
const asPrice = (v: string): number | undefined => {
  const n = Number(String(v).replace(/[^0-9.]/g, ''));
  return Number.isFinite(n) && String(v).trim() !== '' ? n : undefined;
};

/**
 * The marketplace, as a list you can drop anywhere.
 *
 * For sale on one side, want ads on the other, and one row of filters over
 * both. It browses the listing collection (`/api/marketplace`) rather than the
 * posts the old marketplace read — see horacio's models/Listing.js for why
 * those are two different things.
 *
 * The default is near you with your garage's makes floated to the top, and that
 * ordering is the server's: every card that was lifted says so, because a list
 * reordered without saying why reads as a list in no order at all.
 *
 * Two hosts share this: the Marketplace tab, which wraps it in the app header
 * and a heading, and a group's Market section, which passes `groupId` and gets
 * the same browse narrowed to what was posted into that group. Extracted rather
 * than copied because the two were the same screen, and "the same" is not
 * something two copies stay.
 */
export default function MarketplaceBrowse({
  groupId,
  heading,
  listRef,
  onScroll,
  contentContainerStyle,
  style,
}: {
  /**
   * Narrow to one group's listings. The server reads it as "only things in
   * this group" — `group_id` against the listing's `group_ids` — so nothing
   * public leaks into a group's market and nothing group-only leaks out.
   */
  groupId?: string;
  /** Shown above the list, scrolling away with it. Omitted where the host titles itself. */
  heading?: string;
  listRef?: React.Ref<FlatList<Listing>>;
  onScroll?: (e: NativeSyntheticEvent<NativeScrollEvent>) => void;
  /** The host's padding — a header to clear, a tab bar to sit above. */
  contentContainerStyle?: StyleProp<ViewStyle>;
  style?: StyleProp<ViewStyle>;
}) {
  const nav = useNavigation<any>();
  const colors = useColors();
  const brand = useBrandColor();
  const isPro = useIsPro();

  /**
   * What's left of this month's listings — the same read the events screen
   * does before its add button. Pro has nothing to count and doesn't ask; a
   * server that doesn't report `listings` gates nothing.
   */
  const { data: usage } = useGetUsageQuery(undefined, { skip: isPro });
  const listingAllowance = !isPro && usage?.listings?.limit != null ? usage.listings : null;
  // At the limit the plus opens the pitch rather than a form the server will
  // refuse after five steps of it have been filled in.
  const [upsell, setUpsell] = useState(false);

  const [kind, setKind] = useState<ListingKind>('sale');
  const [search, setSearch] = useState('');
  const [activeSearch, setActiveSearch] = useState('');
  const [page, setPage] = useState(0);
  const [entries, setEntries] = useState<Listing[]>([]);
  const [summary, setSummary] = useState<{ id: string; origin: SummaryOrigin | null } | null>(null);

  // The categories and condition labels come from the server, so the filter UI
  // can't drift from the collection it describes.
  const { data: meta } = useGetListingMetaQuery();

  const location = useLocationFilter();
  const [filters, setFilters] = useState<MarketFilters>({
    location: 'near',
    radius: 100,
    category: null,
    conditionMin: null,
    shipping: null,
    minPrice: '',
    maxPrice: '',
    sort: 'match',
  });

  const params = useMemo(() => ({
    kind,
    page,
    limit: PAGE_SIZE,
    ...location.params,
    ...(groupId ? { group_id: groupId } : {}),
    ...(activeSearch ? { q: activeSearch } : {}),
    ...(filters.category ? { category: filters.category } : {}),
    // A want ad has no condition — it has a wish — so the floor is only ever
    // sent on the sale side, where the server stores one.
    ...(kind === 'sale' && filters.conditionMin !== null ? { condition_min: filters.conditionMin } : {}),
    ...(filters.shipping ? { shipping: filters.shipping } : {}),
    ...(asPrice(filters.minPrice) !== undefined ? { min_price: asPrice(filters.minPrice) } : {}),
    ...(asPrice(filters.maxPrice) !== undefined ? { max_price: asPrice(filters.maxPrice) } : {}),
    sort: filters.sort,
  }), [kind, page, location.params, groupId, activeSearch, filters]);

  const { data, isFetching, isLoading, refetch } = useGetListingsQuery(params);

  // Near me couldn't be answered — the server sent everything instead, and the
  // note under the row says why rather than leaving an empty-looking market.
  const { fallBack } = location;
  useEffect(() => {
    if (data?.near_unavailable) fallBack();
  }, [data?.near_unavailable, fallBack]);

  useEffect(() => {
    if (!data?.entries) return;
    if (page === 0) setEntries(data.entries);
    else setEntries((prev) => {
      const seen = new Set(prev.map((e) => e.internal_id));
      return [...prev, ...data.entries.filter((e) => !seen.has(e.internal_id))];
    });
  }, [data, page]);

  /**
   * Start the list again.
   *
   * Every filter change does, because a page 2 of the old query appended to a
   * page 1 of the new one is a list of two different searches.
   */
  const restart = useCallback(() => {
    setPage(0);
    setEntries([]);
  }, []);

  const applyFilters = useCallback((draft: MarketFilters) => {
    // Only a real change restarts: applying the same thing would empty the list
    // and get the cached page straight back, which never re-runs the effect
    // that fills it.
    const same =
      draft.location === location.choice
      && draft.radius === location.radius
      && draft.category === filters.category
      && draft.conditionMin === filters.conditionMin
      && draft.shipping === filters.shipping
      && draft.minPrice === filters.minPrice
      && draft.maxPrice === filters.maxPrice
      && draft.sort === filters.sort;
    if (same) return;

    if (draft.location !== location.choice) location.choose(draft.location);
    if (draft.radius !== location.radius) location.setRadius(draft.radius);
    setFilters(draft);
    restart();
  }, [location, filters, restart]);

  const switchKind = useCallback((next: ListingKind) => {
    if (next === kind) return;
    setKind(next);
    restart();
  }, [kind, restart]);

  const runSearch = useCallback(() => {
    const next = search.trim();
    if (next === activeSearch) return;
    setActiveSearch(next);
    restart();
  }, [search, activeSearch, restart]);

  const clearSearch = useCallback(() => {
    setSearch('');
    if (!activeSearch) return;
    setActiveSearch('');
    restart();
  }, [activeSearch, restart]);

  const loadMore = useCallback(() => {
    if (!isFetching && data && entries.length < data.total) setPage((p) => p + 1);
  }, [isFetching, data, entries.length]);

  const handleRefresh = useCallback(() => {
    restart();
    refetch();
  }, [restart, refetch]);

  /** What the row shows as applied — the current value, never the draft. */
  const pills: FilterPill[] = useMemo(() => {
    const out: FilterPill[] = [locationPill(location.choice, location.radius)];
    if (filters.category) out.push({ key: 'category', label: categoryLabel(filters.category) });
    if (kind === 'sale' && filters.conditionMin !== null) {
      const label = meta?.conditions?.[filters.conditionMin];
      if (label) out.push({ key: 'condition', label: `${label}+` });
    }
    if (filters.shipping) {
      out.push({
        key: 'shipping',
        label: SHIPPING_OPTIONS.find((s) => s.key === filters.shipping)?.label ?? filters.shipping,
      });
    }
    const min = asPrice(filters.minPrice);
    const max = asPrice(filters.maxPrice);
    if (min !== undefined || max !== undefined) {
      out.push({
        key: 'price',
        label: min !== undefined && max !== undefined ? `$${min}–$${max}`
          : min !== undefined ? `$${min}+`
          : `Under $${max}`,
      });
    }
    if (filters.sort !== 'match') {
      out.push({
        key: 'sort',
        label: SORT_OPTIONS.find((s) => s.key === filters.sort)?.label ?? filters.sort,
      });
    }
    return out;
  }, [location.choice, location.radius, filters, kind, meta]);

  const categoryOptions = useMemo(() => [
    { key: null as string | null, label: 'All' },
    ...(meta?.categories ?? []).map((c) => ({ key: c as string | null, label: categoryLabel(c) })),
  ], [meta]);

  const filterValue: MarketFilters = {
    ...filters,
    location: location.choice,
    radius: location.radius,
  };

  return (
    <>
      <FlatList
        ref={listRef}
        style={style}
        data={entries}
        keyExtractor={(item) => item.internal_id}
        onScroll={onScroll}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={contentContainerStyle}
        ListHeaderComponent={
          <>
            {/* Heading rides in the list so it scrolls away with the content. */}
            {!!heading && <ScreenHeading title={heading} />}

            {/* Your own side of the market, above the browse: what you're
                selling, what sold, and anyone waiting on an answer — the
                unread bubble is the reason it sits this high. */}
            <ManageListingsEntry variant="card" />

            {/* For sale or wanted — two halves of the same market rather than
                two screens, so the filters above apply to whichever you're
                looking at. */}
            <View style={styles.kindRow}>
              {([
                { key: 'sale' as const, label: 'For sale' },
                { key: 'want' as const, label: 'Want ads' },
              ]).map((opt) => {
                const on = kind === opt.key;
                return (
                  <TouchableOpacity
                    key={opt.key}
                    style={[
                      styles.kindBtn,
                      { borderColor: colors.border, backgroundColor: colors.card },
                      on && { backgroundColor: brand, borderColor: brand },
                    ]}
                    onPress={() => switchKind(opt.key)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: on }}
                  >
                    <Text style={[styles.kindText, { color: on ? '#000000' : colors.fg }]}>
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
              {/* Listing something is the other reason to be here. Inside a
                  group, the group comes with it — see the create form's
                  "Where to post" step. */}
              <TouchableOpacity
                style={[styles.newBtn, { backgroundColor: brand }]}
                onPress={() => (listingAllowance?.reached
                  ? setUpsell(true)
                  : nav.navigate('ListingCreate', { kind, ...(groupId ? { groupId } : {}) }))}
                accessibilityRole="button"
                accessibilityLabel={
                  // A basic member's allowance, read aloud on the button that
                  // spends it — the plus itself has no room for a count.
                  listingAllowance
                    ? `${kind === 'want' ? 'Post a want ad' : 'List something for sale'}, ${listingAllowance.used} of ${listingAllowance.limit} used this month`
                    : kind === 'want' ? 'Post a want ad' : 'List something for sale'
                }
              >
                <Plus size={16} color="#000000" strokeWidth={2.8} />
              </TouchableOpacity>
            </View>

            <View style={[styles.searchBar, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Search size={15} color={colors.grey} />
              <TextInput
                style={[styles.searchInput, { color: colors.fg }]}
                value={search}
                onChangeText={setSearch}
                onSubmitEditing={runSearch}
                onBlur={runSearch}
                returnKeyType="search"
                placeholder={kind === 'want' ? 'Search want ads…' : 'Search listings…'}
                placeholderTextColor={colors.grey}
                autoCapitalize="none"
              />
              {search.length > 0 && (
                <TouchableOpacity onPress={clearSearch} hitSlop={8}>
                  <X size={15} color={colors.grey} />
                </TouchableOpacity>
              )}
            </View>

            <FilterSummaryRow<MarketFilters>
              value={filterValue}
              onApply={applyFilters}
              pills={pills}
              style={styles.filterRow}
            >
              {(draft, setDraft) => (
                <>
                  <LocationFilterRow
                    choice={draft.location}
                    onChoose={(choice) => setDraft((d) => ({
                      ...d,
                      location: choice,
                      // Nearest means nothing once you've stopped measuring
                      // from anywhere — fall back to the default order.
                      sort: choice === 'near' || d.sort !== 'distance' ? d.sort : 'match',
                    }))}
                    radius={draft.radius}
                    onRadius={(radius) => setDraft((d) => ({ ...d, radius }))}
                  />

                  <FilterChoiceRow
                    label="Category"
                    options={categoryOptions}
                    selected={draft.category}
                    onSelect={(category) => setDraft((d) => ({ ...d, category }))}
                  />

                  {/* Sale only — a want ad has no condition, it has a wish. */}
                  {kind === 'sale' && (meta?.conditions?.length ?? 0) > 0 && (
                    <FilterChoiceRow
                      label="Condition"
                      options={[
                        { key: null as string | null, label: 'Any' },
                        ...meta!.conditions.map((label, i) => ({
                          key: String(i) as string | null,
                          // A floor, not an exact match: picking "Good" wants
                          // everything that good or better.
                          label: i === meta!.conditions.length - 1 ? label : `${label}+`,
                        })),
                      ]}
                      selected={draft.conditionMin === null ? null : String(draft.conditionMin)}
                      onSelect={(key) => setDraft((d) => ({
                        ...d, conditionMin: key === null ? null : Number(key),
                      }))}
                    />
                  )}

                  <FilterChoiceRow
                    label="Shipping"
                    options={SHIPPING_OPTIONS}
                    selected={draft.shipping}
                    onSelect={(shipping) => setDraft((d) => ({ ...d, shipping }))}
                  />

                  <FilterLabel>Price</FilterLabel>
                  <View style={styles.priceRow}>
                    <TextInput
                      style={[styles.priceInput, { borderColor: colors.inputBorder, color: colors.fg, backgroundColor: colors.inputBg }]}
                      value={draft.minPrice}
                      onChangeText={(minPrice) => setDraft((d) => ({ ...d, minPrice }))}
                      placeholder="Min"
                      placeholderTextColor={colors.grey}
                      keyboardType="numeric"
                    />
                    <Text style={[styles.priceDash, { color: colors.grey }]}>to</Text>
                    <TextInput
                      style={[styles.priceInput, { borderColor: colors.inputBorder, color: colors.fg, backgroundColor: colors.inputBg }]}
                      value={draft.maxPrice}
                      onChangeText={(maxPrice) => setDraft((d) => ({ ...d, maxPrice }))}
                      placeholder="Max"
                      placeholderTextColor={colors.grey}
                      keyboardType="numeric"
                    />
                  </View>

                  <FilterChoiceRow
                    label="Sort"
                    options={SORT_OPTIONS
                      .filter((s) => !s.needsLocation || draft.location === 'near')
                      .map((s) => ({ key: s.key, label: s.label }))}
                    selected={draft.sort}
                    onSelect={(sort) => setDraft((d) => ({ ...d, sort }))}
                  />
                </>
              )}
            </FilterSummaryRow>

            {/* On the screen, not in the panel — it explains the list below. */}
            {location.fellBack && (
              <Text style={[styles.note, { color: colors.grey }]}>{NO_ZIP_NOTE}</Text>
            )}
          </>
        }
        renderItem={({ item }) => (
          <ListingCard
            listing={item}
            conditions={meta?.conditions}
            onPress={(origin) => setSummary({ id: item.internal_id, origin })}
          />
        )}
        ListEmptyComponent={
          isLoading ? (
            <ActivityIndicator size="large" color={colors.primaryAlt} style={{ marginTop: 40 }} />
          ) : (
            <EmptyState
              title={kind === 'want' ? 'No want ads' : 'Nothing for sale'}
              message={
                activeSearch || pills.length > 1
                  ? 'Try a wider radius or fewer filters.'
                  : groupId
                    ? 'Nothing has been posted to this group yet.'
                    : 'Be the first to list something.'
              }
            />
          )
        }
        ListFooterComponent={
          isFetching && page > 0 ? (
            <ActivityIndicator size="small" color={colors.grey} style={{ padding: 20 }} />
          ) : null
        }
        refreshControl={
          <RefreshControl refreshing={false} onRefresh={handleRefresh} tintColor={colors.primaryAlt} />
        }
        onEndReached={loadMore}
        onEndReachedThreshold={0.3}
      />

      <ListingSummaryModal
        listingId={summary?.id ?? null}
        origin={summary?.origin}
        onClose={() => setSummary(null)}
      />

      <ProUpsellModal
        visible={upsell}
        onClose={() => setUpsell(false)}
        title={LISTING_LIMIT_UPSELL.title}
        message={LISTING_LIMIT_UPSELL.message}
      />
    </>
  );
}

const styles = StyleSheet.create({
  kindRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 12, paddingTop: 8, paddingBottom: 10 },
  kindBtn: {
    flex: 1, alignItems: 'center',
    paddingVertical: 9, borderRadius: PILL_RADIUS, borderWidth: 1,
  },
  kindText: { fontSize: 13, fontWeight: '800' },
  newBtn: {
    width: 38, alignItems: 'center', justifyContent: 'center',
    borderRadius: COMMON_RADIUS,
  },

  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginHorizontal: 12, marginBottom: 8,
    paddingHorizontal: 12, paddingVertical: 9,
    borderRadius: COMMON_RADIUS, borderWidth: 1,
  },
  searchInput: { flex: 1, fontSize: 14 },

  filterRow: { marginHorizontal: 12, marginTop: 0, marginBottom: 10 },
  note: { fontSize: 12, lineHeight: 17, paddingHorizontal: 14, marginBottom: 10 },

  priceRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, marginBottom: 6 },
  priceInput: {
    flex: 1, minHeight: 40, borderWidth: 1, borderRadius: COMMON_RADIUS,
    paddingHorizontal: 12, fontSize: 14,
  },
  priceDash: { fontSize: 12, fontWeight: '700' },
});
