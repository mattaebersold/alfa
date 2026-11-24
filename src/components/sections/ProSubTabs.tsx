import React, { createContext, useContext } from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { Text } from '../../theme/Text';
import { colors } from '../../constants/colors';
import { COLOR_BLACK, GUTTER, PILL_RADIUS } from '../../constants/config';
import { FONT_INTER } from '../../constants/fonts';

type Tab = { key: string; label: string; Icon?: React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }> };

/** PRO's options — Home, Videos, Games, Marketplace — handed down by FeedScreen. */
export const ProSubTabsContext = createContext<{
  tabs: Tab[];
  value: string;
  onChange: (key: string) => void;
} | null>(null);

/**
 * PRO's options as the first row of each PRO pane's content, rather than a
 * row fixed in the header: they scroll away with the page. On the app's
 * gutters, in the Pro red, no outline or icon; the one you're on filled red,
 * lettered black.
 * Nothing outside PRO (no context).
 */
export default function ProSubTabs() {
  const ctx = useContext(ProSubTabsContext);
  if (!ctx) return null;
  return (
    // Spread across the gutters, first and last on the edges (they fit: four short labels).
    <View style={styles.row} accessibilityRole="tablist">
      {ctx.tabs.map((t) => {
        const on = t.key === ctx.value;
        const fg = on ? COLOR_BLACK : colors.pro;
        return (
          <TouchableOpacity
            key={t.key}
            style={[styles.tab, on ? styles.tabOn : styles.tabOff]}
            onPress={() => ctx.onChange(t.key)}
            activeOpacity={0.8}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
          >
            <Text style={[styles.label, { color: fg }]}>{t.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row:    { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: GUTTER, paddingBottom: 14 },
  tab:    {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    height: 34, paddingHorizontal: 14, borderRadius: PILL_RADIUS,
  },
  tabOn:  { backgroundColor: colors.pro },
  tabOff: {},
  label:  { fontSize: 14, fontFamily: FONT_INTER.semibold },
});
