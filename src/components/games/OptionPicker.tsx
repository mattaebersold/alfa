import React, { useEffect, useMemo, useState } from 'react';
import { View, Modal, FlatList, Pressable, StyleSheet, ActivityIndicator, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Check, Search, X } from 'lucide-react-native';
import { Text, TextInput } from '../../theme/Text';
import KeyboardAvoidingView from '../../keyboard/KeyboardAvoidingView';
import { useColors } from '../../hooks/useColors';
import { useBrandColor } from '../../hooks/useBrandColor';
import { COMMON_RADIUS, COLOR_WHITE } from '../../constants/config';
import ModelLabel from './ModelLabel';
import { GAME_BG, GAME_CARD, GAME_GUTTER } from './game';

/** The list's rows sit further in than the page's gutter — easier to read and to tap. */
const ROW_PAD = 20;

/**
 * Pick one name from a list, by typing to narrow it: a sheet of its own
 * (iOS's page sheet; full screen on Android, where back closes it) with the
 * search field at the top, already focused, and the whole height under it
 * for the list. Rows a finger can't miss, and nothing to fit between a field
 * and the keyboard.
 */
export default function OptionPicker({
  visible, title, options, value, loading = false, failed = false, onRetry, onPick, onClose,
}: {
  visible: boolean;
  title: string;
  options: string[];
  /** What's picked now, ticked in the list. */
  value?: string;
  loading?: boolean;
  failed?: boolean;
  onRetry?: () => void;
  onPick: (v: string) => void;
  onClose: () => void;
}) {
  const colors = useColors();
  const brand = useBrandColor();
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');

  useEffect(() => { setQuery(''); }, [visible]);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    // What starts with the typing comes first — "911" shouldn't be buried
    // under every model with a 9 in it.
    const starts = options.filter((o) => o.toLowerCase().startsWith(q));
    const rest = options.filter((o) => !o.toLowerCase().startsWith(q) && o.toLowerCase().includes(q));
    return [...starts, ...rest];
  }, [options, query]);

  let empty: React.ReactNode = null;
  if (loading) {
    empty = <ActivityIndicator color={colors.grey} />;
  } else if (failed && options.length === 0) {
    empty = (
      <>
        <Text style={[styles.emptyText, { color: colors.grey }]}>Couldn't load the list. Check your connection.</Text>
        {onRetry ? (
          <Pressable onPress={onRetry} hitSlop={10} accessibilityRole="button">
            <Text style={[styles.action, { color: brand }]}>Try again</Text>
          </Pressable>
        ) : null}
      </>
    );
  } else if (matches.length === 0) {
    empty = (
      <Text style={[styles.emptyText, { color: colors.grey }]}>
        {query.trim() ? `Nothing matches "${query.trim()}".` : 'Nothing to choose from.'}
      </Text>
    );
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      {/* A page sheet starts below the status bar by itself; Android's is the whole screen. */}
      <KeyboardAvoidingView style={[styles.sheet, Platform.OS !== 'ios' && { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <View style={styles.side} />
          <Text style={[styles.title, { color: colors.fg }]} numberOfLines={1}>{title}</Text>
          <View style={[styles.side, styles.sideEnd]}>
            <Pressable onPress={onClose} hitSlop={8} style={styles.close} accessibilityRole="button" accessibilityLabel="Close">
              <X size={20} color={COLOR_WHITE} />
            </Pressable>
          </View>
        </View>

        <View style={[styles.search, { borderColor: colors.inputBorder }]}>
          <Search size={16} color={colors.grey} />
          <TextInput
            style={[styles.searchInput, { color: colors.fg }]}
            value={query}
            onChangeText={setQuery}
            placeholder="Search"
            placeholderTextColor={colors.grey}
            autoFocus
            autoCorrect={false}
            spellCheck={false}
            autoCapitalize="words"
            clearButtonMode="while-editing"
            returnKeyType="done"
            // Return takes the top of the list, so a name can be typed and
            // entered without leaving the keyboard.
            onSubmitEditing={() => { if (query.trim() && matches.length > 0) onPick(matches[0]); }}
          />
        </View>

        <FlatList
          style={styles.list}
          data={empty ? [] : matches}
          keyExtractor={(o) => o}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          initialNumToRender={20}
          contentContainerStyle={{ paddingBottom: insets.bottom + 16 }}
          ListEmptyComponent={<View style={styles.empty}>{empty}</View>}
          ItemSeparatorComponent={() => <View style={[styles.separator, { backgroundColor: colors.border }]} />}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => onPick(item)}
              style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
              accessibilityRole="button"
              accessibilityState={{ selected: item === value }}
            >
              <ModelLabel value={item} style={[styles.rowText, { color: colors.fg }]} />
              {item === value ? <Check size={18} color={brand} /> : null}
            </Pressable>
          )}
        />
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  sheet: { flex: 1, backgroundColor: GAME_BG },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: GAME_GUTTER, paddingTop: 18, paddingBottom: 12 },
  // Equal sides, so the title is centred whatever flanks it.
  side: { flex: 1, flexDirection: 'row' },
  sideEnd: { justifyContent: 'flex-end' },
  title: { fontSize: 16, fontWeight: '800' },
  close: {
    width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center',
    backgroundColor: GAME_CARD,
  },
  search: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginHorizontal: GAME_GUTTER, marginBottom: 8, paddingHorizontal: 12,
    height: 44, borderWidth: 1, borderRadius: COMMON_RADIUS, backgroundColor: GAME_CARD,
  },
  searchInput: { flex: 1, height: '100%', paddingVertical: 0, fontSize: 16 },
  action: { fontSize: 16, fontWeight: '600' },
  list: { flex: 1 },
  row: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12,
    minHeight: 50, paddingHorizontal: ROW_PAD,
  },
  rowPressed: { backgroundColor: 'rgba(255,255,255,0.08)' },
  rowText: { flex: 1, fontSize: 16, fontWeight: '500' },
  separator: { height: StyleSheet.hairlineWidth, marginLeft: ROW_PAD },
  empty: { alignItems: 'center', gap: 12, paddingHorizontal: 24, paddingTop: 40 },
  emptyText: { fontSize: 14, fontWeight: '600', textAlign: 'center' },
});
