import React, { useMemo, useState } from 'react';
import { View, TouchableOpacity, StyleSheet, ActivityIndicator, ScrollView } from 'react-native';
import { Text, TextInput } from '../theme/Text';
import { useRoomAbove } from '../keyboard/FormScrollView';
import { MapPin, Plus, X } from 'lucide-react-native';
import { useColors, useBrandColor } from '../theme/useColors';
import { useOrsSelector } from '../store/createStore';
import { useGetPhotoSpotsQuery, useGetPhotoSpotQuery } from '../api/orsApi';
import type { PhotoSpot } from '../types/ors';
import { FONT_INTER } from '../theme/fonts';


/** The most the recent/matching spots and the create row take before they scroll. */
const LIST_MAX_H = 280;
/** How many characters before the search asks the server. */
const MIN_QUERY = 2;
const MAX_RESULTS = 8;

export interface SpotPickerProps {
  /** The chosen spot, shown as a chip with a clear. Null shows the search. */
  spotId: string | null;
  onChange: (spot: PhotoSpot | null) => void;
  /** "Create a new pin", with whatever was typed as its name. */
  onCreateNew: (name: string) => void;
  /**
   * Spots the member has used before, most recent first — the host knows
   * where (a gallery's pin, a post's tag). Offered before anything is typed,
   * ahead of the member's own pins.
   */
  recentIds?: string[];
  placeholder?: string;
  inputStyle?: any;
  /**
   * Something before the text — a search glyph. With `boxStyle`, the input
   * sits in a row inside that box beside it; without, the input stands alone
   * as it always has.
   */
  leading?: React.ReactNode;
  /** The box around `leading` and the input. */
  boxStyle?: any;
}

/**
 * Pick a photo spot on the map — for a gallery to be pinned to, a post to tag.
 *
 * Empty, it offers what you're likely to want: the spots you've used before
 * (`recentIds`), then your own pins. Typing searches every spot by name. And
 * when the place isn't pinned yet, the last row makes it one — the host opens
 * the create form with the name typed, and hands the new pin back.
 */
export default function SpotPicker({
  spotId, onChange, onCreateNew, recentIds, placeholder = 'Search pinned spots by name', inputStyle,
  leading, boxStyle,
}: SpotPickerProps) {
  const colors = useColors();
  // The list opens above the field, so the field is brought down onto the
  // keyboard and the list gets what's left above it — see useRoomAbove.
  const room = useRoomAbove(LIST_MAX_H);
  const brand = useBrandColor();
  const me = useOrsSelector((s) => s.auth.userInfo);
  const [query, setQuery] = useState('');
  const [focused, setFocused] = useState(false);
  const q = query.trim();
  const searching = q.length >= MIN_QUERY;

  // The chosen spot, by name — the form only holds its id.
  const { data: chosen } = useGetPhotoSpotQuery(spotId as string, { skip: !spotId });

  // Recent: what the host says was used before, then the member's own pins.
  const taggedIds = useMemo(() => [...new Set(recentIds ?? [])], [recentIds]);
  const { data: tagged } = useGetPhotoSpotsQuery({ ids: taggedIds.join(','), limit: 20 }, { skip: taggedIds.length === 0 || !!spotId });
  const { data: own } = useGetPhotoSpotsQuery({ user_id: me?.user_id, limit: 10 }, { skip: !me?.user_id || !!spotId });
  const { data: found, isFetching } = useGetPhotoSpotsQuery({ q, limit: MAX_RESULTS }, { skip: !searching });

  const results = useMemo(() => {
    if (searching) return found?.entries ?? [];
    const seen = new Set<string>();
    const list: PhotoSpot[] = [];
    // In the order the host gave them, so the last spot used is first.
    taggedIds.forEach((id) => {
      const spot = tagged?.entries.find((s) => s.internal_id === id);
      if (spot && !seen.has(id)) { seen.add(id); list.push(spot); }
    });
    (own?.entries ?? []).forEach((s) => { if (!seen.has(s.internal_id)) { seen.add(s.internal_id); list.push(s); } });
    return list.slice(0, MAX_RESULTS);
  }, [searching, found, tagged, own, taggedIds]);

  if (spotId) {
    return (
      <View style={[styles.chosen, { borderColor: colors.borderStrong, backgroundColor: colors.card }]}>
        <MapPin size={14} color={brand} />
        <View style={styles.chosenText}>
          <Text style={[styles.chosenTitle, { color: colors.fg }]} numberOfLines={1}>
            {chosen?.title ?? 'Photo spot'}
          </Text>
          {chosen?.location ? (
            <Text style={[styles.detail, { color: colors.grey }]} numberOfLines={1}>{chosen.location}</Text>
          ) : null}
        </View>
        <TouchableOpacity onPress={() => onChange(null)} hitSlop={10} accessibilityLabel="Remove the photo spot">
          <X size={16} color={colors.grey} />
        </TouchableOpacity>
      </View>
    );
  }

  const showList = focused || searching;

  const input = (style: any) => (
    <TextInput
      value={query}
      onChangeText={setQuery}
      onFocus={() => {
        setFocused(true);
        room.onFocus();
      }}
      onBlur={() => {
        setFocused(false);
        room.onBlur();
      }}
      placeholder={placeholder}
      placeholderTextColor={colors.grey}
      autoCorrect={false}
      style={style}
    />
  );

  return (
    // Raised for good, not only while the list shows — a zIndex that changes
    // re-orders the native views and the field loses focus mid-word.
    <View ref={room.ref} collapsable={false} style={styles.wrap}>
      {boxStyle ? (
        <View style={[styles.box, boxStyle]}>
          {leading}
          {input([styles.boxedInput, inputStyle])}
        </View>
      ) : input(inputStyle)}

      {showList && (
        <View style={[styles.list, { borderColor: colors.border, backgroundColor: colors.card }]}>
          <ScrollView keyboardShouldPersistTaps="handled" nestedScrollEnabled style={{ maxHeight: room.maxHeight }}>
          {!searching && results.length > 0 && (
            <Text style={[styles.heading, { color: colors.grey }]}>Recent</Text>
          )}
          {results.map((spot) => (
            <TouchableOpacity
              key={spot.internal_id}
              style={[styles.row, { borderBottomColor: colors.border }]}
              onPress={() => { setQuery(''); onChange(spot); }}
              activeOpacity={0.7}
            >
              <MapPin size={14} color={colors.grey} />
              <View style={styles.rowText}>
                <Text style={[styles.title, { color: colors.fg }]} numberOfLines={1}>{spot.title || 'Photo spot'}</Text>
                {spot.location ? (
                  <Text style={[styles.detail, { color: colors.grey }]} numberOfLines={1}>{spot.location}</Text>
                ) : null}
              </View>
            </TouchableOpacity>
          ))}
          {searching && isFetching && results.length === 0 && (
            <View style={styles.wait}><ActivityIndicator size="small" color={colors.grey} /></View>
          )}
          {searching && !isFetching && results.length === 0 && (
            <Text style={[styles.none, { color: colors.grey }]}>No pinned spot called that.</Text>
          )}
          <TouchableOpacity
            style={styles.row}
            onPress={() => onCreateNew(q)}
            activeOpacity={0.7}
            accessibilityRole="button"
          >
            <Plus size={14} color={brand} strokeWidth={2.6} />
            <Text style={[styles.create, { color: brand }]} numberOfLines={1}>
              {q ? `Create a new pin "${q}"` : 'Create a new pin'}
            </Text>
          </TouchableOpacity>
          </ScrollView>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  box:        { flexDirection: 'row', alignItems: 'center' },
  boxedInput: { flex: 1, padding: 0 },
  chosen: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10,
  },
  chosenText:  { flex: 1, minWidth: 0 },
  chosenTitle: { fontSize: 14, fontFamily: FONT_INTER.bold },
  wrap:    { zIndex: 20, elevation: 20 },
  // Hangs off the top of the field, over whatever's above it: below the
  // field is where the keyboard is. Capped by useRoomAbove, so it stops
  // short of the top of the form rather than being clipped by it.
  list:    {
    position: 'absolute', left: 0, right: 0, bottom: '100%', marginBottom: 6,
    borderWidth: 1, borderRadius: 10, overflow: 'hidden',
    boxShadow: '0px 6px 18px rgba(0, 0, 0, 0.45)',
  },
  heading: { fontSize: 10.5, fontFamily: FONT_INTER.extrabold, letterSpacing: 0.6, textTransform: 'uppercase', paddingHorizontal: 12, paddingTop: 10 },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 9,
    paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowText: { flex: 1, minWidth: 0 },
  title:   { fontSize: 14, fontFamily: FONT_INTER.semibold },
  detail:  { fontSize: 12, marginTop: 1 },
  wait:    { paddingVertical: 10, alignItems: 'center' },
  none:    { fontSize: 12.5, paddingHorizontal: 12, paddingVertical: 10 },
  create:  { fontSize: 14, fontFamily: FONT_INTER.bold, flexShrink: 1 },
});
