import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useColors } from '../../hooks/useColors';

export interface RallySection {
  id: string;
  label: string;
}

/**
 * Section tabs for the rally page.
 *
 * `sections` is built by the screen from what the rally actually has, so one
 * with no itinerary and no FAQ never shows tabs pointing at nothing. Below two
 * sections the bar hides itself entirely — a single tab is a label, not
 * navigation.
 *
 * The active tab follows the scroll position rather than the last tap, which is
 * what makes reading down the page move the highlight along on its own. The
 * screen owns the scroll, so it owns that decision and passes `active` down.
 *
 * Mirrors murray's components/pages/rallys/RallySubNav.js.
 */
export default function RallySubNav({
  sections, active, onSelect,
}: {
  sections: RallySection[];
  active?: string;
  onSelect: (id: string) => void;
}) {
  const c = useColors();

  if (sections.length < 2) return null;

  return (
    <View style={[styles.bar, { backgroundColor: c.bg, borderBottomColor: c.border }]}>
      {/* Scrolls horizontally rather than wrapping: four tabs fit on a phone
          only just, and a bar that becomes two rows shoves the page down. */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
      >
        {sections.map((section) => {
          const isActive = active === section.id;
          return (
            <TouchableOpacity
              key={section.id}
              onPress={() => onSelect(section.id)}
              style={[
                styles.tab,
                { borderBottomColor: isActive ? c.primaryAlt : 'transparent' },
              ]}
              activeOpacity={0.7}
              accessibilityRole="tab"
              accessibilityState={{ selected: isActive }}
            >
              <Text style={[styles.tabText, { color: isActive ? c.fg : c.grey }]}>
                {section.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  bar:     { borderBottomWidth: StyleSheet.hairlineWidth },
  row:     { paddingHorizontal: 12 },
  tab:     { paddingHorizontal: 14, paddingVertical: 13, borderBottomWidth: 2 },
  tabText: { fontSize: 14, fontWeight: '700' },
});
