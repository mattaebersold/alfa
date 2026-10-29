import React, { useState } from 'react';
import { View, TouchableOpacity, ScrollView, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { Text } from '@ors/kit';
import { Calendar } from 'lucide-react-native';
import { useSearchQuery } from '../../api/apiService';
import { useDebounced } from '../../hooks/useDebounced';
import { useColors } from '../../hooks/useColors';
import SearchPill from '../ui/SearchPill';
import { FONT_INTER } from '../../constants/fonts';

/** Before this, a search matches too much to be worth sending. */
const MIN_CHARS = 2;

/**
 * Find an event by name — the search half of the Events tab's search-and-
 * filter row, as the address search is on the photography map's.
 *
 * Results drop down under the field, floating over the screen rather than
 * pushing it down, and a tap on one opens that event's sheet, as a card in
 * the carousel does. The field is raised for good (see `wrap`): a zIndex that
 * changes re-orders the native views, and the input would lose focus mid-word.
 */
export default function EventSearchField({ onPick, style }: {
  onPick: (eventId: string) => void;
  style?: StyleProp<ViewStyle>;
}) {
  const colors = useColors();
  const [q, setQ] = useState('');
  const [focused, setFocused] = useState(false);
  const term = useDebounced(q.trim());
  const { data, isFetching } = useSearchQuery(term, { skip: term.length < MIN_CHARS });
  const events: any[] = term.length >= MIN_CHARS ? (data?.events ?? []).slice(0, 8) : [];
  const open = focused && q.trim().length >= MIN_CHARS;

  const pick = (id: string) => {
    setQ('');
    onPick(id);
  };

  return (
    <View style={[styles.wrap, style]}>
      {/* The search pill every filter row shares (SearchPill). */}
      <SearchPill
        style={styles.field}
        value={q}
        onChangeText={setQ}
        onClear={() => setQ('')}
        onFocus={() => setFocused(true)}
        // Deferred, so a tap on a result lands before the list closes.
        onBlur={() => setTimeout(() => setFocused(false), 150)}
        placeholder="Search events…"
        autoCorrect={false}
      />

      {open && (
        <View style={[styles.list, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {events.length > 0 ? (
            <ScrollView keyboardShouldPersistTaps="handled" nestedScrollEnabled style={styles.listScroll}>
              {events.map((e, i) => (
                <TouchableOpacity
                  key={e.internal_id}
                  style={[styles.row, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border }]}
                  onPress={() => pick(e.internal_id)}
                  activeOpacity={0.7}
                >
                  <Calendar size={14} color={colors.grey} />
                  <Text style={[styles.rowText, { color: colors.fg }]} numberOfLines={1}>{e.title || 'Event'}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          ) : (
            <Text style={[styles.hint, { color: colors.grey }]}>
              {isFetching || term !== q.trim() ? 'Searching…' : 'No events match'}
            </Text>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  // Raised whatever state it's in — see the note above.
  wrap:   { zIndex: 20, elevation: 20 },
  // Its own height in this column, not a share of it.
  field:  { flex: 0 },
  list: {
    position: 'absolute', left: 0, right: 0, top: '100%', marginTop: 6,
    borderRadius: 14, borderWidth: 1, overflow: 'hidden',
    boxShadow: '0px 6px 18px rgba(0, 0, 0, 0.45)',
  },
  listScroll: { maxHeight: 240 },
  row:     { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 12 },
  rowText: { flex: 1, fontSize: 14, fontFamily: FONT_INTER.semibold },
  hint:    { fontSize: 13, paddingHorizontal: 14, paddingVertical: 12 },
});
