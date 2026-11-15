import React from 'react';
import { View, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { Text } from '../../theme/Text';
import { Plus } from 'lucide-react-native';
import { selectionHaptic } from '../../utils/haptics';
import { COLOR_GRAY_58, COLOR_WHITE, TAB_IDLE_FG } from '../../constants/config';
import { FONT_INTER } from '../../constants/fonts';

/** One option in an UnderlineTabs row. */
export interface UnderlineTab {
  key: string;
  label: string;
}

/** An action at the end of the row — a section's Add New. */
export interface UnderlineTabsAction {
  label: string;
  onPress: () => void;
  accessibilityLabel?: string;
}

/** The row's height: an option's touch area, with room above and below its pill. */
export const UNDERLINE_TABS_H = 44;
/** The lit option's pill: its height, and its padding either side of the label. */
const PILL_H = 30;
const PILL_PAD_H = 12;
/** Between one option's pill and the next. */
const TAB_GAP = 2;
/** From an option's edge to its label — what `inset` is measured against. */
export const UNDERLINE_TAB_PAD_H = PILL_PAD_H;

/**
 * The home header's sub-tabs, for anywhere: plain labels with no band or
 * track, the lit one white on a grey pill (the main tabs' lit grey,
 * #3A3A3A), the rest grey — a quieter level below whatever's above. (It was
 * an underline; the name stayed.) An optional action closes the row as
 * a small white outline, so it reads as a button rather than another option.
 * Scrolls sideways if it runs long.
 *
 * `inset` is where the first label starts, from the row's left edge.
 */
export default function UnderlineTabs<K extends string = string>({ tabs, value, onChange, action, inset }: {
  tabs: (UnderlineTab & { key: K })[];
  value?: K;
  onChange?: (key: K) => void;
  action?: UnderlineTabsAction;
  inset: number;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.row}
      contentContainerStyle={[styles.content, { paddingLeft: Math.max(0, inset - UNDERLINE_TAB_PAD_H) }]}
      keyboardShouldPersistTaps="handled"
    >
      {tabs.map((t) => {
        const on = t.key === value;
        return (
          <TouchableOpacity
            key={t.key}
            onPress={() => { if (!on) selectionHaptic(); onChange?.(t.key); }}
            activeOpacity={0.75}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            accessibilityLabel={t.label}
            style={styles.tab}
          >
            <View style={[styles.pill, on && styles.pillOn]}>
              <Text style={[styles.text, on && styles.textOn]} numberOfLines={1}>{t.label}</Text>
            </View>
          </TouchableOpacity>
        );
      })}
      {action ? (
        <TouchableOpacity
          onPress={action.onPress}
          activeOpacity={0.75}
          accessibilityRole="button"
          accessibilityLabel={action.accessibilityLabel ?? action.label}
          style={styles.action}
        >
          <Plus size={13} color={COLOR_WHITE} strokeWidth={2.8} />
          <Text style={styles.actionText}>{action.label}</Text>
        </TouchableOpacity>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { flexGrow: 0, height: UNDERLINE_TABS_H },
  content: { alignItems: 'center', gap: TAB_GAP, paddingRight: 24 },
  tab: { height: UNDERLINE_TABS_H, justifyContent: 'center' },
  // Every option has the pill's box, filled only on the lit one, so the labels sit level.
  pill: { height: PILL_H, paddingHorizontal: PILL_PAD_H, borderRadius: PILL_H / 2, justifyContent: 'center' },
  pillOn: { backgroundColor: COLOR_GRAY_58 },
  text: { fontSize: 14, fontFamily: FONT_INTER.medium, color: TAB_IDLE_FG },
  textOn: { fontFamily: FONT_INTER.semibold, color: COLOR_WHITE },
  action: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    height: 26, paddingHorizontal: 10, marginLeft: 6,
    borderRadius: 999, borderWidth: 1.5, borderColor: COLOR_WHITE,
  },
  actionText: { fontSize: 13, fontFamily: FONT_INTER.bold, color: COLOR_WHITE },
});
