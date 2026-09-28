import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, RefreshControl, Platform, type NativeScrollEvent, type NativeSyntheticEvent, type StyleProp, type ViewStyle,
} from 'react-native';
import { Text, TextInput } from '@ors/kit';
import { Search, X, Plus, Tag, Megaphone } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import ScreenHeading from '../ui/ScreenHeading';
import EmptyState from '../ui/EmptyState';
import FilterSummaryRow, { FilterLabel, FilterChoiceRow, type FilterPill } from '../ui/FilterSummaryRow';
import LocationFilterRow, { NO_ZIP_NOTE, locationPill } from '../ui/LocationFilterRow';
import ListingCard, { LISTING_GRID_ROW } from './ListingCard';
import ManageListingsEntry from './ManageListingsEntry';
import ListingSummaryModal from './ListingSummaryModal';
import { categoryLabel } from './listingFormat';
import type { SummaryOrigin } from '../ui/SummaryModal';
import { useGetListingsQuery, useGetListingMetaQuery, useGetUsageQuery } from '../../api/apiService';
import { ProUpsellModal } from '../pro/ProUpsell';
import {
  LISTING_LIMIT_UPSELL,
  COMMON_RADIUS,
  PILL_RADIUS,
  COLOR_BLACK, GUTTER,
} from '../../constants/config';
import { useLocationFilter } from '../../hooks/useLocationFilter';
import { useColors } from '../../hooks/useColors';
import { useBrandColor, useIsPro } from '../../hooks/useBrandColor';
import type { Listing, ListingKind, ListingShipping, ListingSort } from '../../types/api';
import { FONT_INTER } from '../../constants/fonts';

const PAGE_SIZE = 12;

/**
 * Everything the panel asks — where, category, condition, shipping and price,
 * in any combination — plus the sort, which orders rather than filters.
 */
interface MarketFilters {
  /** A LocationChoice: 'near', 'all' or a region key. */
  location: string;
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
      && draft.category === filters.category
      && draft.conditionMin === filters.conditionMin
      && draft.shipping === filters.shipping
      && draft.minPrice === filters.minPrice
      && draft.maxPrice === filters.maxPrice
      && draft.sort === filters.sort;
    if (same) return;

    if (draft.location !== location.choice) location.choose(draft.location);
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

  /**
   * What the row shows as applied: where, then each filter that's on, and
   * the sort when it isn't the default.
   */
  const pills: FilterPill[] = useMemo(() => {
    const out: FilterPill[] = [];
    const min = asPrice(filters.minPrice);
    const max = asPrice(filters.maxPrice);
    const conditionLabel = kind === 'sale' && filters.conditionMin !== null
      ? meta?.conditions?.[filters.conditionMin] : undefined;
    out.push(locationPill(location.choice));
    if (filters.category) out.push({ key: 'category', label: categoryLabel(filters.category) });
    if (conditionLabel) out.push({ key: 'condition', label: `${conditionLabel}+` });
    if (filters.shipping) {
      out.push({
        key: 'shipping',
        label: SHIPPING_OPTIONS.find((s) => s.key === filters.shipping)?.label ?? filters.shipping,
      });
    }
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
  }, [location.choice, filters, kind, meta]);

  const categoryOptions = useMemo(() => [
    { key: null as string | null, label: 'All' },
    ...(meta?.categories ?? []).map((c) => ({ key: c as string | null, label: categoryLabel(c) })),
  ], [meta]);

  const filterValue: MarketFilters = {
    ...filters,
    location: location.choice,
  };

  return (
    <>
      <FlatList
        ref={listRef}
        style={style}
        data={entries}
        keyExtractor={(item) => item.internal_id}
        // Two tiles across — see ListingCard. The header still spans the row.
        numColumns={2}
        columnWrapperStyle={LISTING_GRID_ROW}
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
              {/* A switch, the width of the row — the same two-sided pill as
                  the photography map's Map / List: a track, and the side
                  you're on filled in the brand colour. */}
              <View style={[styles.kindSwitch, { backgroundColor: colors.segment }]} accessibilityRole="tablist">
                {([
                  { key: 'sale' as const, label: 'For sale', Icon: Tag },
                  { key: 'want' as const, label: 'Want ads', Icon: Megaphone },
                ]).map(({ key, label, Icon }) => {
                  const on = kind === key;
                  const ink = on ? COLOR_BLACK : colors.grey;
                  return (
                    <TouchableOpacity
                      key={key}
                      style={[styles.kindBtn, on && { backgroundColor: brand }]}
                      onPress={() => switchKind(key)}
                      activeOpacity={0.8}
                      accessibilityRole="tab"
                      accessibilityState={{ selected: on }}
                    >
                      <Icon size={16} color={ink} strokeWidth={2.4} />
                      <Text style={[styles.kindText, { color: ink }]}>{label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              {/* Listing something, inside a group — the group comes with it
                  (see the create form's "Where to post" step). On the main
                  marketplace this lives on the app's + instead (CreateFab),
                  beside a new post. */}
              {groupId ? (
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
                <Plus size={16} color={COLOR_BLACK} strokeWidth={2.8} />
              </TouchableOpacity>
              ) : null}
            </View>

            {/* Search on the left, the filter on the right — the pattern the
                photography map and the Events tab share. */}
            <View style={styles.toolsRow}>
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
              compact
            >
              {(draft, setDraft) => (
                <>
                  {/* Nearest-first means nothing once you've stopped
                      measuring from anywhere, so leaving near me drops it. */}
                  <LocationFilterRow
                    choice={draft.location}
                    onChoose={(choice) => setDraft((d) => ({
                      ...d,
                      location: choice,
                      sort: choice === 'near' || d.sort !== 'distance' ? d.sort : 'match',
                    }))}
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

                  {/* Typed into the draft as you go, so Apply takes it
                      without a Done first. Either end can be left empty. */}
                  <FilterLabel>Price</FilterLabel>
                  <PriceFilter
                    min={draft.minPrice}
                    max={draft.maxPrice}
                    onChange={(minPrice, maxPrice) => setDraft((d) => ({ ...d, minPrice, maxPrice }))}
                  />

                  {/* Ordering, not filtering. */}
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
            </View>

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

/** The price range, typed straight into the panel's draft. */
/**
 * iOS's number pad has no return key to put the keyboard away — so iOS gets
 * the numbers-and-punctuation keyboard, which has one. Android's number pad
 * has its own.
 */
const PRICE_KEYBOARD = Platform.OS === 'ios' ? 'numbers-and-punctuation' : 'numeric';

function PriceFilter({ min, max, onChange }: {
  min: string;
  max: string;
  onChange: (min: string, max: string) => void;
}) {
  const colors = useColors();
  const inputStyle = [styles.priceInput, { borderColor: colors.inputBorder, color: colors.fg, backgroundColor: colors.inputBg }];
  return (
    <View style={styles.priceRow}>
      <TextInput
        style={inputStyle}
        value={min}
        onChangeText={(lo) => onChange(lo.trim(), max)}
        placeholder="Min"
        placeholderTextColor={colors.grey}
        keyboardType={PRICE_KEYBOARD}
        returnKeyType="done"
      />
      <Text style={[styles.priceDash, { color: colors.grey }]}>to</Text>
      <TextInput
        style={inputStyle}
        value={max}
        onChangeText={(hi) => onChange(min, hi.trim())}
        placeholder="Max"
        placeholderTextColor={colors.grey}
        keyboardType={PRICE_KEYBOARD}
        returnKeyType="done"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  // Every row's edge inset is the app's GUTTER, so the browse lines up with
  // the header's tabs and the rest of the home screen.
  kindRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: GUTTER, paddingTop: 8, paddingBottom: 10 },
  // The track; each side takes half of it.
  kindSwitch: { flex: 1, flexDirection: 'row', padding: 4, borderRadius: PILL_RADIUS },
  kindBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7,
    paddingVertical: 10, borderRadius: PILL_RADIUS,
  },
  kindText: { fontSize: 14, fontFamily: FONT_INTER.bold },
  // Inside a group only — the switch's height, round like it.
  newBtn: {
    width: 44, height: 44, alignItems: 'center', justifyContent: 'center',
    borderRadius: PILL_RADIUS,
  },

  // The search and the filter pill, side by side.
  toolsRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginHorizontal: GUTTER, marginBottom: 10,
  },
  // A pill, the height of the filter beside it, taking the rest of the row.
  searchBar: {
    flex: 1, height: 44,
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 14,
    borderRadius: PILL_RADIUS, borderWidth: 1,
  },
  searchInput: { flex: 1, fontSize: 14 },

  note: { fontSize: 12, lineHeight: 17, paddingHorizontal: GUTTER, marginBottom: 10 },

  priceRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: GUTTER, marginBottom: 6 },
  priceInput: {
    flex: 1, minHeight: 40, borderWidth: 1, borderRadius: COMMON_RADIUS,
    paddingHorizontal: 12, fontSize: 14,
  },
  priceDash: { fontSize: 12, fontFamily: FONT_INTER.bold },
});
