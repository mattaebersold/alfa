import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { Search, X, Plus, User as UserIcon, Car as CarIcon, Flag, Users as UsersIcon } from 'lucide-react-native';
import {
  useSearchQuery,
  useGetPreviouslyTaggedUsersQuery,
  useGetPreviouslyTaggedCarsQuery,
  useGetPreviouslyTaggedEventsQuery,
  useGetPreviouslyTaggedGroupsQuery,
} from '../../api/apiService';
import GarageCarStrip from './GarageCarStrip';
import Avatar from '../ui/Avatar';
import { firstGalleryUrl, imageUrl } from '../../utils/image';
import { useColors } from '../../hooks/useColors';
import { contrastText } from '../../hooks/useBrandColor';

export type TagKind = 'user' | 'car' | 'event' | 'group';
export interface TagItem {
  id: string;
  label: string;
  kind: TagKind;
  /**
   * A gallery filename for a member (the Avatar resolves it) or a resolved URL
   * for a car. Optional: a tag is still a tag without a picture.
   */
  image?: string | null;
}

// Small debounce so each row's search only fires when typing settles.
function useDebounced(value: string, delay = 300) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value.trim()), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

interface RowProps {
  title: string;
  placeholder: string;
  Icon: any;
  accent: string;
  query: string;
  onQuery: (s: string) => void;
  selected: TagItem[];
  suggestions: TagItem[];   // matches from the active search (≥2 chars)
  recent: TagItem[];        // previously-tagged fallback
  onToggle: (t: TagItem) => void;
  /** Sits between the selected chips and the search field — see the cars row. */
  above?: React.ReactNode;
}

/**
 * The picture on a suggestion: a member's avatar, a car's photo, or the kind's
 * own icon where there's nothing to show (events and groups).
 */
function TagThumb({ item, accent }: { item: TagItem; accent: string }) {
  const colors = useColors();

  if (item.kind === 'user') {
    return <Avatar filename={item.image} name={item.label} size={38} />;
  }
  if (item.kind === 'car' && item.image) {
    return <Image source={{ uri: item.image }} style={styles.thumb} contentFit="cover" />;
  }
  const Icon = item.kind === 'car' ? CarIcon : item.kind === 'event' ? Flag : UsersIcon;
  return (
    <View style={[styles.thumb, styles.thumbBlank, { backgroundColor: colors.segment }]}>
      <Icon size={16} color={accent} />
    </View>
  );
}

function TagRow({ title, placeholder, Icon, accent, query, onQuery, selected, suggestions, recent, onToggle, above }: RowProps) {
  const colors = useColors();
  const selectedIds = new Set(selected.map((t) => t.id));
  const typing = query.trim().length >= 2;
  // Recently-tagged pills stay short (most recent 5); live search can show more.
  const list = (typing ? suggestions : recent).filter((i) => !selectedIds.has(i.id)).slice(0, typing ? 8 : 5);

  // Chips and count pills are filled with `accent`, so their text has to
  // follow the fill's brightness — black on gold, white on teal.
  const onAccent = contrastText(accent);

  return (
    // A card per kind rather than three bands divided by hairlines: tagging a
    // person and tagging a car are separate jobs, and stacked rules made them
    // read as one long form you scroll through by accident.
    <View style={[styles.row, { backgroundColor: colors.card, borderColor: colors.borderDark }]}>
      <View style={[styles.rowHeader, { borderBottomColor: accent }]}>
        <Icon size={15} color={accent} />
        <Text style={[styles.rowTitle, { color: colors.fg }]}>{title}</Text>
        {selected.length > 0 && (
          <View style={[styles.countPill, { backgroundColor: accent }]}>
            <Text style={[styles.countText, { color: onAccent }]}>{selected.length}</Text>
          </View>
        )}
      </View>

      {/* Selected chips */}
      {selected.length > 0 && (
        <View style={styles.chips}>
          {selected.map((t) => (
            <TouchableOpacity key={t.id} style={[styles.chip, { backgroundColor: accent }]} onPress={() => onToggle(t)} activeOpacity={0.8}>
              <Text style={[styles.chipText, { color: onAccent }]} numberOfLines={1}>{t.label}</Text>
              <X size={12} color={onAccent} />
            </TouchableOpacity>
          ))}
        </View>
      )}

      {above}

      {/* Search input */}
      <View style={[styles.inputBox, { borderColor: colors.inputBorder, backgroundColor: colors.inputBg }]}>
        <Search size={15} color={colors.grey} />
        <TextInput
          style={[styles.input, { color: colors.fg }]}
          value={query}
          onChangeText={onQuery}
          placeholder={placeholder}
          placeholderTextColor={colors.grey}
          autoCorrect={false}
          autoCapitalize="none"
          returnKeyType="search"
        />
        {query.length > 0 && (
          <TouchableOpacity onPress={() => onQuery('')} hitSlop={6}>
            <X size={15} color={colors.grey} />
          </TouchableOpacity>
        )}
      </View>

      {/* Autocomplete results (dropdown while typing) / recent suggestions (inline pills) */}
      {query.trim().length === 1 ? (
        <Text style={[styles.hint, { color: colors.grey }]}>Keep typing…</Text>
      ) : typing ? (
        list.length > 0 ? (
          <View style={[styles.suggestBox, { borderColor: colors.inputBorder, backgroundColor: colors.card }]}>
            {list.map((s, i) => (
              <TouchableOpacity
                key={s.id}
                style={[styles.suggestRow, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border }]}
                onPress={() => onToggle(s)}
                activeOpacity={0.7}
              >
                <Text style={[styles.suggestText, { color: colors.fg }]} numberOfLines={1}>{s.label}</Text>
                <Plus size={16} color={accent} />
              </TouchableOpacity>
            ))}
          </View>
        ) : (
          <Text style={[styles.hint, { color: colors.grey }]}>No matches</Text>
        )
      ) : list.length > 0 ? (
        <>
          <Text style={[styles.recentHeader, { color: colors.grey }]}>Recently tagged</Text>
          {/* A face or a car, not just a name: at a glance you're picking the
              @matt you meant rather than reading usernames. Horizontal, so a
              long list stays one line instead of wrapping into a wall. */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.recentRow}
            keyboardShouldPersistTaps="handled"
          >
            {list.map((s) => (
              <TouchableOpacity
                key={s.id}
                style={[styles.recentCard, { borderColor: accent, backgroundColor: colors.inputBg }]}
                onPress={() => onToggle(s)}
                activeOpacity={0.75}
              >
                <TagThumb item={s} accent={accent} />
                <Text style={[styles.recentCardText, { color: colors.fg }]} numberOfLines={2}>
                  {s.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </>
      ) : null}
    </View>
  );
}

interface Props {
  users: TagItem[];
  cars: TagItem[];
  events: TagItem[];
  /**
   * Groups. Opt-in: passing this array turns on the group row. Posts don't
   * pass it today, so their tag UI is unchanged; routes do.
   */
  groups?: TagItem[];
  /**
   * Put the member's own garage above the car search as a row of tappable
   * thumbnails. On by default — searching for a car you own is the long way
   * round to a tag you could have picked from a picture.
   */
  showGarage?: boolean;
  onToggle: (t: TagItem) => void;
}

export default function PostTagPicker({ users, cars, events, groups, showGarage = true, onToggle }: Props) {
  const colors = useColors();

  const [userQ, setUserQ]   = useState('');
  const [carQ, setCarQ]     = useState('');
  const [eventQ, setEventQ] = useState('');
  const [groupQ, setGroupQ] = useState('');
  const dUser  = useDebounced(userQ);
  const dCar   = useDebounced(carQ);
  const dEvent = useDebounced(eventQ);
  const dGroup = useDebounced(groupQ);

  const { data: userSearch }  = useSearchQuery(dUser,  { skip: dUser.length < 2 });
  const { data: carSearch }   = useSearchQuery(dCar,   { skip: dCar.length < 2 });
  const { data: eventSearch } = useSearchQuery(dEvent, { skip: dEvent.length < 2 });
  const { data: groupSearch } = useSearchQuery(dGroup, { skip: !groups || dGroup.length < 2 });
  const { data: prevUsers }  = useGetPreviouslyTaggedUsersQuery();
  const { data: prevCars }   = useGetPreviouslyTaggedCarsQuery();
  const { data: prevEvents } = useGetPreviouslyTaggedEventsQuery();
  const { data: prevGroups } = useGetPreviouslyTaggedGroupsQuery(undefined, { skip: !groups });

  const toUser  = (u: any): TagItem => ({
    id: u.user_id || u.internal_id,
    label: u.username ? `@${u.username}` : ([u.firstName, u.lastName].filter(Boolean).join(' ') || 'User'),
    kind: 'user',
    image: u.gallery?.[0]?.filename ?? u.profilePicture ?? null,
  });
  const toCar   = (c: any): TagItem => ({
    id: c.internal_id,
    label: [c.year, c.make, c.model].filter(Boolean).join(' ') || c.title || 'Car',
    kind: 'car',
    image: firstGalleryUrl(c.gallery) ?? (c.profile_image ? imageUrl(c.profile_image) : null),
  });
  const toEvent = (e: any): TagItem => ({ id: e.internal_id, label: e.title || 'Event', kind: 'event' });
  const toGroup = (g: any): TagItem => ({ id: g.internal_id, label: g.title || 'Group', kind: 'group' });

  return (
    <View>
      <TagRow
        title="Tag People" placeholder="Search people…" Icon={UserIcon} accent={colors.primaryAlt}
        query={userQ} onQuery={setUserQ} selected={users}
        suggestions={(userSearch?.users ?? []).map(toUser)}
        recent={(prevUsers?.users ?? []).map(toUser)}
        onToggle={onToggle}
      />
      <TagRow
        title="Tag Cars"
        // The field is for cars that aren't yours; yours are the row above it.
        placeholder={showGarage ? 'Search other members’ cars…' : 'Search cars…'}
        Icon={CarIcon} accent={colors.teal}
        query={carQ} onQuery={setCarQ} selected={cars}
        suggestions={(carSearch?.cars ?? []).map(toCar)}
        recent={(prevCars?.cars ?? []).map(toCar)}
        onToggle={onToggle}
        above={showGarage
          ? <GarageCarStrip selectedIds={cars.map((c) => c.id)} onToggle={onToggle} />
          : undefined}
      />
      <TagRow
        title="Tag Events" placeholder="Search events…" Icon={Flag} accent={colors.tangerine}
        query={eventQ} onQuery={setEventQ} selected={events}
        suggestions={(eventSearch?.events ?? []).map(toEvent)}
        recent={(prevEvents?.events ?? []).map(toEvent)}
        onToggle={onToggle}
      />
      {groups && (
        <TagRow
          title="Tag Groups" placeholder="Search groups…" Icon={UsersIcon} accent={colors.gold}
          query={groupQ} onQuery={setGroupQ} selected={groups}
          suggestions={(groupSearch?.groups ?? []).map(toGroup)}
          recent={(prevGroups?.groups ?? []).map(toGroup)}
          onToggle={onToggle}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    marginHorizontal: 12, marginTop: 12,
    paddingHorizontal: 14, paddingTop: 12, paddingBottom: 12,
    borderRadius: 14, borderWidth: 1,
  },
  // A rule in the row's own accent under its title — it's what tells the three
  // cards apart at a glance.
  rowHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    paddingBottom: 10, marginBottom: 12,
    borderBottomWidth: 2,
  },
  rowTitle:     { fontSize: 13, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4 },
  countPill:    { minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 5, alignItems: 'center', justifyContent: 'center' },
  countText:    { color: '#FFFFFF', fontSize: 11, fontWeight: '800' },

  chips:        { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 },
  chip:         { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20 },
  chipText:     { color: '#FFFFFF', fontSize: 12, fontWeight: '700', maxWidth: 150 },

  inputBox:     { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 10, borderWidth: 1.5, borderRadius: 10 },
  input:        { flex: 1, fontSize: 14, padding: 0 },

  suggestBox:   { marginTop: 8, borderWidth: 1, borderRadius: 10, overflow: 'hidden' },
  suggestHeader:{ fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4, paddingHorizontal: 12, paddingTop: 10, paddingBottom: 4 },
  suggestRow:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 12 },
  suggestText:  { flex: 1, fontSize: 14, fontWeight: '600', marginRight: 10 },

  recentHeader: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4, marginTop: 10, marginBottom: 6 },
  recentRow:  { flexDirection: 'row', gap: 8, paddingRight: 4, paddingBottom: 2 },
  recentCard: {
    width: 96, alignItems: 'center', gap: 6,
    paddingHorizontal: 8, paddingVertical: 10,
    borderRadius: 12, borderWidth: 1,
  },
  recentCardText: { fontSize: 12, fontWeight: '700', textAlign: 'center', lineHeight: 15 },
  thumb:      { width: 38, height: 38, borderRadius: 8 },
  thumbBlank: { alignItems: 'center', justifyContent: 'center' },

  hint:         { fontSize: 13, paddingVertical: 10 },
});
