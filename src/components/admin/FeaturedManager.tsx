import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, FlatList, StyleSheet, ActivityIndicator,
} from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import DraggableFlatList, { ScaleDecorator, type RenderItemParams } from 'react-native-draggable-flatlist';
import { Image } from 'expo-image';
import { Search, X, GripVertical, Plus, Check } from 'lucide-react-native';
import {
  useGetSiteSettingsQuery,
  useSearchUsersQuery,
  useGetCarsQuery,
  useUpdateFeaturedUsersMutation,
  useUpdateFeaturedCarsMutation,
} from '../../api/apiService';
import Avatar from '../ui/Avatar';
import { useColors } from '../../hooks/useColors';
import { colors as palette } from '../../constants/colors';
import { firstGalleryUrl, imageUrl } from '../../utils/image';
import { ss } from '../../styles/shared';
import type { User, GarageCar } from '../../types/api';
import { COMMON_RADIUS } from '../../constants/radius';

/**
 * Admin: who and what is featured on the Members and Cars screens.
 *
 * Both lists live on the site settings as ordered ids, and the order is the
 * order the rows show them in. Every change — an addition, a removal, a drop
 * after dragging — saves the whole list straight away. There's no Save button
 * to forget on the way out of the sheet.
 *
 * Saves are queued rather than fired side by side. Each sends the full list,
 * so two in flight at once could land out of order and leave the server with
 * the older one.
 */

type Tab = 'members' | 'cars';
type SaveState = 'idle' | 'saving' | 'saved' | 'error';

/** Below this a search is noise — two characters match most of the directory. */
const MIN_QUERY = 2;
const SEARCH_DEBOUNCE_MS = 300;
const CAR_RESULTS = 20;

const carName = (car: GarageCar) =>
  [car.year, car.make, car.model].filter(Boolean).join(' ') || car.title || 'Untitled car';
const carThumb = (car: GarageCar) => firstGalleryUrl(car.gallery) ?? imageUrl(car.profile_image);
const personName = (u: User) => [u.firstName, u.lastName].filter(Boolean).join(' ');

export default function FeaturedManager() {
  const colors = useColors();
  const [tab, setTab] = useState<Tab>('members');

  const { data: settings, isLoading } = useGetSiteSettingsQuery();
  const [saveUsers] = useUpdateFeaturedUsersMutation();
  const [saveCars] = useUpdateFeaturedCarsMutation();

  const [members, setMembers] = useState<User[]>([]);
  const [cars, setCars] = useState<GarageCar[]>([]);

  const [saveState, setSaveState] = useState<SaveState>('idle');
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const inFlight = useRef(0);
  /** The last list that failed, per tab, so "Retry" knows what to send. */
  const failed = useRef<{ tab: Tab; ids: string[] } | null>(null);

  /**
   * Follow the server, except while our own saves are still landing.
   *
   * Each save invalidates the settings and refetches them, and a refetch that
   * answers between two queued saves carries the older list — adopting it would
   * make a just-dropped row jump back for a moment.
   */
  useEffect(() => {
    if (!settings || inFlight.current > 0) return;
    setMembers(settings.featured_users ?? []);
    setCars(settings.featured_cars ?? []);
  }, [settings]);

  const persist = useCallback((which: Tab, ids: string[]) => {
    inFlight.current += 1;
    setSaveState('saving');
    queue.current = queue.current
      .then((): Promise<unknown> => (which === 'members' ? saveUsers(ids).unwrap() : saveCars(ids).unwrap()))
      .then(() => {
        if (failed.current?.tab === which) failed.current = null;
      })
      .catch(() => {
        failed.current = { tab: which, ids };
      })
      .finally(() => {
        inFlight.current -= 1;
        if (inFlight.current === 0) setSaveState(failed.current ? 'error' : 'saved');
      });
  }, [saveUsers, saveCars]);

  const updateMembers = (next: User[]) => {
    setMembers(next);
    persist('members', next.map((u) => u.user_id));
  };
  const updateCars = (next: GarageCar[]) => {
    setCars(next);
    persist('cars', next.map((c) => c.internal_id));
  };

  const retry = () => {
    const last = failed.current;
    if (last) persist(last.tab, last.ids);
  };

  // ── Search ───────────────────────────────────────────────────────────────
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  useEffect(() => {
    const id = setTimeout(() => setDebounced(query.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(id);
  }, [query]);
  // A search belongs to the tab it was typed on.
  useEffect(() => { setQuery(''); setDebounced(''); }, [tab]);

  const searching = debounced.length >= MIN_QUERY;
  const { data: userResults, isFetching: usersFetching } = useSearchUsersQuery(debounced, {
    skip: !searching || tab !== 'members',
  });
  const { data: carResults, isFetching: carsFetching } = useGetCarsQuery(
    { search: debounced, limit: CAR_RESULTS },
    { skip: !searching || tab !== 'cars' },
  );

  const featuredIds = new Set(tab === 'members'
    ? members.map((u) => u.user_id)
    : cars.map((c) => c.internal_id));

  const add = (item: User | GarageCar) => {
    // Added to the end: the newest feature goes last, where it's easy to find
    // and drag up, rather than bumping the current lead out of first place.
    if (tab === 'members') updateMembers([...members, item as User]);
    else updateCars([...cars, item as GarageCar]);
  };

  // ── Rendering ────────────────────────────────────────────────────────────
  const renderThumb = (item: User | GarageCar) => {
    if (tab === 'members') return <Avatar user={item as User} size={40} />;
    const uri = carThumb(item as GarageCar);
    return (
      <View style={[styles.carThumb, { backgroundColor: colors.segment }]}>
        {uri ? <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" /> : null}
      </View>
    );
  };

  const titleOf = (item: User | GarageCar) =>
    tab === 'members' ? `@${(item as User).username}` : carName(item as GarageCar);
  const subtitleOf = (item: User | GarageCar) =>
    tab === 'members' ? personName(item as User) : ((item as GarageCar).title ?? '');

  const renderFeatured = ({ item, drag, isActive, getIndex }: RenderItemParams<User | GarageCar>) => {
    const index = getIndex() ?? 0;
    const remove = () => {
      if (tab === 'members') updateMembers(members.filter((u) => u.user_id !== (item as User).user_id));
      else updateCars(cars.filter((c) => c.internal_id !== (item as GarageCar).internal_id));
    };
    const subtitle = subtitleOf(item);
    return (
      <ScaleDecorator>
        <TouchableOpacity
          style={[
            styles.row,
            { borderBottomColor: colors.border, backgroundColor: isActive ? colors.segment : colors.cream },
          ]}
          onLongPress={drag}
          delayLongPress={200}
          disabled={isActive}
          activeOpacity={1}
        >
          {/* The handle starts a drag the moment it's touched; the rest of the
              row needs a hold, so scrolling the list doesn't pick rows up. */}
          <TouchableOpacity
            onPressIn={drag}
            hitSlop={10}
            accessibilityLabel={`Reorder ${titleOf(item)}`}
          >
            <GripVertical size={18} color={colors.grey} />
          </TouchableOpacity>
          <Text style={[styles.position, { color: colors.grey }]}>{index + 1}</Text>
          {renderThumb(item)}
          <View style={ss.fill}>
            <Text style={[styles.name, { color: colors.fg }]} numberOfLines={1}>{titleOf(item)}</Text>
            {subtitle ? (
              <Text style={[styles.sub, { color: colors.grey }]} numberOfLines={1}>{subtitle}</Text>
            ) : null}
          </View>
          <TouchableOpacity
            style={[styles.iconBtn, { borderColor: colors.border }]}
            onPress={remove}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={`Remove ${titleOf(item)} from featured`}
          >
            <X size={16} color={palette.red} />
          </TouchableOpacity>
        </TouchableOpacity>
      </ScaleDecorator>
    );
  };

  const renderResult = ({ item }: { item: User | GarageCar }) => {
    const id = tab === 'members' ? (item as User).user_id : (item as GarageCar).internal_id;
    const already = featuredIds.has(id);
    const subtitle = subtitleOf(item);
    return (
      <View style={[styles.row, { borderBottomColor: colors.border }]}>
        {renderThumb(item)}
        <View style={ss.fill}>
          <Text style={[styles.name, { color: colors.fg }]} numberOfLines={1}>{titleOf(item)}</Text>
          {subtitle ? (
            <Text style={[styles.sub, { color: colors.grey }]} numberOfLines={1}>{subtitle}</Text>
          ) : null}
        </View>
        {already ? (
          <View style={[styles.addBtn, { borderColor: colors.border }]}>
            <Check size={14} color={colors.grey} />
            <Text style={[styles.addText, { color: colors.grey }]}>Featured</Text>
          </View>
        ) : (
          <TouchableOpacity
            style={[styles.addBtn, { borderColor: colors.primaryAlt }]}
            onPress={() => add(item)}
            accessibilityRole="button"
            accessibilityLabel={`Feature ${titleOf(item)}`}
          >
            <Plus size={14} color={colors.primaryAlt} />
            <Text style={[styles.addText, { color: colors.primaryAlt }]}>Feature</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  const list: (User | GarageCar)[] = tab === 'members' ? members : cars;
  const results: (User | GarageCar)[] = tab === 'members'
    ? (userResults?.entries ?? []).filter((u) => u.user_id)
    : (carResults?.entries ?? []).filter((c) => c.internal_id);
  const resultsFetching = tab === 'members' ? usersFetching : carsFetching;

  return (
    // Its own gesture root: this renders inside a Modal, which on Android sits
    // outside the app's root view, and a drag started there would never reach
    // the handler.
    <GestureHandlerRootView style={ss.fill}>
      <View style={styles.controls}>
        <View style={[styles.tabs, { backgroundColor: colors.segment }]}>
          {(['members', 'cars'] as Tab[]).map((t) => {
            const active = tab === t;
            const count = t === 'members' ? members.length : cars.length;
            return (
              <TouchableOpacity
                key={t}
                style={[styles.tab, active && { backgroundColor: colors.card }]}
                onPress={() => setTab(t)}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
              >
                <Text style={[styles.tabText, { color: active ? colors.fg : colors.grey }]}>
                  {t === 'members' ? 'Members' : 'Cars'} ({count})
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={[styles.search, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder }]}>
          <Search size={15} color={colors.grey} />
          <TextInput
            style={[styles.searchInput, { color: colors.fg }]}
            value={query}
            onChangeText={setQuery}
            placeholder={tab === 'members' ? 'Search members to feature…' : 'Search cars to feature…'}
            placeholderTextColor={colors.grey}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => setQuery('')} hitSlop={10} accessibilityLabel="Clear search">
              <X size={15} color={colors.grey} />
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.statusRow}>
          <Text style={[styles.hint, { color: colors.grey }]}>
            {searching ? 'Tap Feature to add to the end of the list.' : 'Drag the handle to reorder. Changes save automatically.'}
          </Text>
          {saveState === 'saving' && <ActivityIndicator size="small" color={colors.grey} />}
          {saveState === 'saved' && <Text style={[styles.status, { color: colors.grey }]}>Saved</Text>}
          {saveState === 'error' && (
            <TouchableOpacity onPress={retry} hitSlop={8} accessibilityRole="button">
              <Text style={[styles.status, { color: palette.red }]}>Didn't save — Retry</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {searching ? (
        <FlatList
          data={results}
          keyExtractor={(item) => (tab === 'members' ? (item as User).user_id : (item as GarageCar).internal_id)}
          renderItem={renderResult}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            resultsFetching
              ? <ActivityIndicator style={styles.empty} color={colors.grey} />
              : <Text style={[styles.emptyText, { color: colors.grey }]}>Nothing matches "{debounced}"</Text>
          }
        />
      ) : isLoading ? (
        <ActivityIndicator style={styles.empty} color={colors.grey} />
      ) : (
        <DraggableFlatList
          data={list}
          keyExtractor={(item) => (tab === 'members' ? (item as User).user_id : (item as GarageCar).internal_id)}
          onDragEnd={({ data, from, to }) => {
            if (from === to) return;
            if (tab === 'members') updateMembers(data as User[]);
            else updateCars(data as GarageCar[]);
          }}
          renderItem={renderFeatured}
          activationDistance={12}
          containerStyle={ss.fill}
          style={ss.fill}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <Text style={[styles.emptyText, { color: colors.grey }]}>
              {tab === 'members'
                ? 'No featured members yet. Search above to add some.'
                : 'No featured cars yet. Search above to add some.'}
            </Text>
          }
        />
      )}
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  controls:   { paddingHorizontal: 16, paddingTop: 14, gap: 10 },
  tabs:       { flexDirection: 'row', borderRadius: 10, padding: 3 },
  tab:        { flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: 8 },
  tabText:    { fontSize: 14, fontWeight: '700' },
  search:     {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 12, height: 42, borderRadius: 10, borderWidth: 1,
  },
  searchInput: { flex: 1, fontSize: 15, padding: 0 },
  statusRow:  { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 20, paddingBottom: 6 },
  hint:       { flex: 1, fontSize: 12 },
  status:     { fontSize: 12, fontWeight: '700' },
  listContent: { paddingBottom: 40 },
  row:        {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  position:   { width: 18, fontSize: 13, fontWeight: '700', textAlign: 'center' },
  carThumb:   { width: 56, height: 40, borderRadius: 6, overflow: 'hidden' },
  name:       { fontSize: 15, fontWeight: '600' },
  sub:        { fontSize: 12, marginTop: 1 },
  iconBtn:    {
    width: 32, height: 32, borderRadius: COMMON_RADIUS, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
  },
  addBtn:     {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: COMMON_RADIUS, borderWidth: 1,
  },
  addText:    { fontSize: 12, fontWeight: '700' },
  empty:      { marginTop: 40 },
  emptyText:  { fontSize: 14, textAlign: 'center', marginTop: 40, paddingHorizontal: 24 },
});
