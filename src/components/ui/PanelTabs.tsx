import React from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { StyleSheet } from 'react-native';
import MainTabs, { type MainTab } from './MainTabs';
import { COLOR_BLACK, COLOR_GRAY_58 } from '../../constants/config';

/** Side inset, matching the panel bodies under the tabs. */
export const PANEL_TABS_INSET = 16;

/**
 * The tabs at the head of a summary panel (SummaryModal) — one look for every
 * panel that splits its contents: a post's likes and comments, a car's
 * reactions, notifications, bookmarks.
 *
 * MainTabs underneath, dressed for a panel: a round pure-black track, the lit
 * tab's pill a dark grey with white lettering (as the home header's tabs), spread across the panel's width, and each
 * count in a round black/70 chip after the label or icon. Give
 * every tab an Icon and `iconOnly` for a row of icons; otherwise the labels
 * show.
 *
 * Its spacing is the panel's too: the room above it from the panel's top
 * edge, and the room under it before the content.
 */
export default function PanelTabs<K extends string>({
  tabs, value, onChange, iconOnly = false, style,
}: {
  tabs: MainTab<K>[];
  value: K;
  onChange: (key: K) => void;
  /** Icons and counts, no words — every tab needs an Icon. */
  iconOnly?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <MainTabs
      tabs={tabs}
      value={value}
      onChange={onChange}
      inset={PANEL_TABS_INSET}
      trackColor={COLOR_BLACK}
      thumbColor={COLOR_GRAY_58}
      iconOnly={iconOnly}
      pill
      plainCounts
      stretch
      style={[styles.tabs, style]}
    />
  );
}

const styles = StyleSheet.create({
  tabs: { marginTop: 18, marginBottom: 12 },
});
