import React from 'react';
import { View, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { Text } from '@ors/kit';
import { Plus } from 'lucide-react-native';
import { selectionHaptic } from '../../utils/haptics';
import { COLOR_WHITE, TAB_IDLE_FG } from '../../constants/config';
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

/** The row's height: an option's touch area. */
export const UNDERLINE_TABS_H = 36;
/** Each option's touch padding either side of its label. */
export const UNDERLINE_TAB_PAD_H = 10;

/**
 * The home header's sub-tabs, for anywhere: plain labels with no band or
 * track, the lit one white with a short bar under it, the rest grey — a
 * quieter level below whatever's above. An optional action closes the row as
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
            <View>
              <Text style={[styles.text, on && styles.textOn]} numberOfLines={1}>{t.label}</Text>
              {/* The label's own width, so the bar reads as underlining it. */}
              <View style={[styles.bar, on && styles.barOn]} />
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
  content: { alignItems: 'center', paddingRight: 24 },
  tab: { height: UNDERLINE_TABS_H, justifyContent: 'center', paddingHorizontal: UNDERLINE_TAB_PAD_H },
  // Under the label, its width: clear on the unlit options so all sit level.
  bar: { height: 2, borderRadius: 1, marginTop: 5, backgroundColor: 'transparent' },
  barOn: { backgroundColor: COLOR_WHITE },
  text: { fontSize: 14, fontFamily: FONT_INTER.medium, color: TAB_IDLE_FG },
  textOn: { fontFamily: FONT_INTER.semibold, color: COLOR_WHITE },
  action: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    height: 26, paddingHorizontal: 10, marginLeft: 6,
    borderRadius: 999, borderWidth: 1.5, borderColor: COLOR_WHITE,
  },
  actionText: { fontSize: 13, fontFamily: FONT_INTER.bold, color: COLOR_WHITE },
});
