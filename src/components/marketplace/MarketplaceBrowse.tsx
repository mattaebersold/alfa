import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View, StyleSheet, Animated, FlatList, TouchableOpacity, ActivityIndicator, RefreshControl, Platform, type NativeScrollEvent, type NativeSyntheticEvent, type StyleProp, type ViewStyle,
} from 'react-native';
import { Text, TextInput } from '@ors/kit';
import { Search, X, Plus, Tag, Megaphone } from 'lucide-react-native';
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
import {
  LISTING_LIMIT_UPSELL,
  COMMON_RADIUS,
  PILL_RADIUS,
  COLOR_BLACK, GUTTER,
} from '../../constants/config';
import { useLocationFilter, useWidenWhenEmpty } from '../../hooks/useLocationFilter';
import { useColors } from '../../hooks/useColors';
import { useBrandColor, useIsPro } from '../../hooks/useBrandColor';
import type { Listing, ListingKind, ListingShipping, ListingSort } from '../../types/api';
import { FONT_INTER } from '../../constants/fonts';
import { SkeletonGrid } from '../ui/Skeleton';

const PAGE_SIZE = 12;
/** The list's one item — see the mosaic in the FlatList below. */
const MOSAIC = ['mosaic'];

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
  stickyTop = 0,
}: {
  /**
   * Narrow to one group's listings. The server reads it as "only things in
   * this group" — `group_id` against the listing's `group_ids` — so nothing
   * public leaks into a group's market and nothing group-only leaks out.
   */
  groupId?: string;
  /** Shown above the list, scrolling away with it. Omitted where the host titles itself. */
  heading?: string;
  /** Typed loosely: the list's one item is the mosaic, not a listing. */
  listRef?: React.Ref<FlatList<any>>;
  onScroll?: (e: NativeSyntheticEvent<NativeScrollEvent>) => void;
  /** The host's padding — a header to clear, a tab bar to sit above. */
  contentContainerStyle?: StyleProp<ViewStyle>;
  style?: StyleProp<ViewStyle>;
  /**
   * How far down the list the switch and search pin once scrolled to — under
   * a floating header, say, following it as it hides. The list's own top when
   * omitted.
   */
  stickyTop?: number | Animated.Value | Animated.AnimatedInterpolation<number>;
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
  // The switch's thumb: 0 on For sale, 1 on Want ads, sprung between like
  // Segmented's. Slid by half the track's inner width, known once it's laid out.
  const thumb = useRef(new Animated.Value(0)).current;
  const [trackW, setTrackW] = useState(0);
  useEffect(() => {
    Animated.spring(thumb, { toValue: kind === 'want' ? 1 : 0, tension: 170, friction: 22, useNativeDriver: true }).start();
  }, [kind, thumb]);
  const half = Math.max(0, (trackW - KIND_TRACK_PAD * 2) / 2);

  // The sticky bar: where it sits in the list (barY, in content), how tall it
  // is, and the scroll — so it can ride with the list until it reaches
  // stickyTop, then hold there. All on the native driver.
  const scrollY = useRef(new Animated.Value(0)).current;
  const barY = useRef(new Animated.Value(0)).current;
  const [barH, setBarH] = useState(0);
  const padTop = Number(StyleSheet.flatten(contentContainerStyle)?.paddingTop ?? 0) || 0;
  const barTranslate = useMemo(() => {
    const top = typeof stickyTop === 'number' ? new Animated.Value(stickyTop) : stickyTop;
    // max(barY - scroll, top), as top + max(barY - scroll - top, 0).
    const below = Animated.subtract(Animated.subtract(barY, scrollY), top)
      .interpolate({ inputRange: [0, 1], outputRange: [0, 1], extrapolateLeft: 'clamp' });
    return Animated.add(top, below);
  }, [stickyTop, barY, scrollY]);
  const handleScroll = useMemo(() => Animated.event(
    [{ nativeEvent: { contentOffset: { y: scrollY } } }],
    { useNativeDriver: true, listener: onScroll },
  ), [scrollY, onScroll]);
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

  // Nothing near you on the first look: All, rather than an empty market.
  useWidenWhenEmpty(location, {
    settled: !!data && !isFetching && !data.near_unavailable,
    empty: (data?.entries?.length ?? 0) === 0,
    narrowed: !!activeSearch,
  });

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

  // For sale or wanted, at the top of the list — it scrolls away with it.
  const kindSwitch = (
    <>
      {/* For sale or wanted — two halves of the same market rather than
          two screens, so the filters above apply to whichever you're
          looking at. */}
      <View style={styles.kindRow}>
        {/* A switch, the width of the row — the same two-sided pill as
            the photography map's Map / List: a track, and the side
            you're on filled in the brand colour. */}
        <View style={[styles.kindSwitch, { backgroundColor: COLOR_BLACK }]} accessibilityRole="tablist">
          <View
            style={StyleSheet.absoluteFill}
            onLayout={(e) => setTrackW(e.nativeEvent.layout.width)}
            pointerEvents="none"
          >
            {half > 0 ? (
              <Animated.View
                style={[styles.kindThumb, {
                  width: half, backgroundColor: brand,
                  transform: [{ translateX: thumb.interpolate({ inputRange: [0, 1], outputRange: [0, half] }) }],
                }]}
              />
            ) : null}
          </View>
          {([
            { key: 'sale' as const, label: 'For sale', Icon: Tag },
            { key: 'want' as const, label: 'Want ads', Icon: Megaphone },
          ]).map(({ key, label, Icon }) => {
            const on = kind === key;
            const ink = on ? COLOR_BLACK : colors.fg;
            return (
              <TouchableOpacity
                key={key}
                style={[styles.kindBtn, on && half === 0 && { backgroundColor: brand }]}
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
    </>
  );

  // The search and filter, pinned once you scroll past them: drawn over the
  // list at their place in it (barY, less the scroll), never above `stickyTop`.
  const stickyBar = (
    <Animated.View
      style={[styles.stickyBar, { backgroundColor: colors.cream, transform: [{ translateY: barTranslate }] }]}
      onLayout={(e) => setBarH(e.nativeEvent.layout.height)}
    >
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
    </Animated.View>
  );

  return (
    <View style={[styles.fill, style]}>
      <Animated.FlatList
        ref={listRef}
        style={styles.fill}
        // One item, the whole mosaic — the Cars page's grid: two columns,
        // each card its photo's own shape, so rows would leave gaps beside
        // the short ones. Alternating rather than balanced by height, since a
        // card's shape is only known once its photo loads.
        data={entries.length ? MOSAIC : []}
        keyExtractor={(item) => item}
        onScroll={handleScroll}
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
            <ManageListingsEntry
              variant="card"
              // The + inside the card, after the counts. The allowance check
              // is the same one the group's + runs — at the limit it's the
              // pitch, not a form the server would refuse.
              onNew={() => (listingAllowance?.reached
                ? setUpsell(true)
                : nav.navigate('ListingCreate', { kind, ...(groupId ? { groupId } : {}) }))}
            />

            {kindSwitch}

            {/* Where the search and filter sit until you scroll past them —
                they're drawn over the list (stickyBar, below) so they can pin
                under the header; this holds their place in the flow. */}
            <View
              style={{ height: barH }}
              onLayout={(e) => barY.setValue(padTop + e.nativeEvent.layout.y)}
            />

            {/* On the screen, not in the panel — it explains the list below. */}
            {location.fellBack && (
              <Text style={[styles.note, { color: colors.grey }]}>{NO_ZIP_NOTE}</Text>
            )}

          </>
        }
        renderItem={() => (
          <View style={styles.mosaic}>
            {[0, 1].map((col) => (
              <View key={col} style={styles.column}>
                {entries.filter((_, i) => i % 2 === col).map((item) => (
                  <ListingCard
                    key={item.internal_id}
                    listing={item}
                    natural
                    conditions={meta?.conditions}
                    onPress={(origin) => setSummary({ id: item.internal_id, origin })}
                  />
                ))}
              </View>
            ))}
          </View>
        )}
        ListEmptyComponent={
          isLoading ? (
            <SkeletonGrid count={6} ratio={16 / 9} style={{ paddingHorizontal: GUTTER, paddingTop: 8 }} />
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

      {stickyBar}

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
    </View>
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

// The switch track's inset around its thumb.
const KIND_TRACK_PAD = 4;

const styles = StyleSheet.create({
  fill: { flex: 1 },
  // Two columns of cards, each its photo's shape — the Cars page's mosaic.
  mosaic: { flexDirection: 'row', gap: 10, paddingHorizontal: GUTTER },
  column: { flex: 1, gap: 10 },
  // Over the list, at its top; moved into place by a translate.
  // The top pad keeps the search off the header's edge once pinned.
  stickyBar: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10, paddingTop: 6 },
  // Every row's edge inset is the app's GUTTER, so the browse lines up with
  // the header's tabs and the rest of the home screen.
  kindRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: GUTTER, paddingTop: 8, paddingBottom: 4 },
  // The track; each side takes half of it.
  kindSwitch: { flex: 1, flexDirection: 'row', padding: KIND_TRACK_PAD, borderRadius: PILL_RADIUS },
  // The brand-filled half, sliding under the labels.
  kindThumb: { position: 'absolute', top: KIND_TRACK_PAD, bottom: KIND_TRACK_PAD, left: KIND_TRACK_PAD, borderRadius: PILL_RADIUS },
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
    flex: 1, height: 38,
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
