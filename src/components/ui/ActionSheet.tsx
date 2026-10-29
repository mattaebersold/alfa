import React, { useRef } from 'react';
import { View, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { Text } from '@ors/kit';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '../../hooks/useColors';
import { FONT_INTER } from '../../constants/fonts'
import SlideSheet from './SlideSheet';
import { COLOR_WHITE, PANE_BG, SHEET_RADIUS } from '../../constants/config';

export interface ActionSheetOption {
  label: string;
  onPress: () => void;
  /** Red label, for anything that removes something. */
  destructive?: boolean;
  Icon?: React.ComponentType<{ size?: number; color?: string }>;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  title?: string;
  /** Sits under the title in smaller type — context, not another choice. */
  message?: string;
  options: ActionSheetOption[];
  /** The Cancel at the foot. Off where a tap outside or the grabber is enough. */
  showCancel?: boolean;
}

/**
 * A menu of choices, as a bottom sheet.
 *
 * This exists because `Alert.alert` with a list of buttons is not a menu on
 * Android — the platform dialog takes **three** buttons and React Native
 * silently drops the rest, so a five-option menu arrived missing two options
 * *and* its Cancel. On top of that, RN's Android alerts default to
 * `cancelable: false`, so neither a tap outside nor the back button dismissed
 * what was left. Between them that produced a dialog you could get stuck in.
 *
 * Here every option is shown on both platforms, tapping outside closes, and the
 * hardware back button closes (`onRequestClose`).
 *
 * A plain `Alert.alert` is still the right thing for a *question* — one or two
 * buttons, "are you sure" — and those work fine as they are.
 */
export default function ActionSheet({ visible, onClose, title, message, options, showCancel = true }: Props) {
  const colors = useColors();
  const insets = useSafeAreaInsets();

  // The choice runs once the sheet has slid away and unmounted: on iOS a
  // screen or another modal can't be presented while this one is still up,
  // and a frame's wait wasn't long enough — a dialog opened from here (Rename,
  // Edit) never appeared.
  const chosen = useRef<(() => void) | null>(null);
  const choose = (option: ActionSheetOption) => {
    chosen.current = option.onPress;
    onClose();
  };
  const runChosen = () => {
    const run = chosen.current;
    chosen.current = null;
    // A frame on, once the sheet's Modal has actually gone.
    if (run) requestAnimationFrame(run);
  };

  return (
    // Slides up over the panes' fading wash, as every pane does (SlideSheet).
    <SlideSheet
      visible={visible}
      onClose={onClose}
      onDismissed={runChosen}
      sheetStyle={[
        styles.sheet,
        // Clear of the home indicator, or Android's navigation bar — which
        // can report no inset inside a Modal, so it gets a floor of its own.
        { backgroundColor: PANE_BG, paddingBottom: Math.max(insets.bottom, Platform.OS === 'android' ? 48 : 12) + 8 },
      ]}
    >
      <View style={styles.grabber} />

      {(title || message) && (
        <View style={styles.head}>
          {title ? <Text style={[styles.title, { color: colors.fg }]} numberOfLines={2}>{title}</Text> : null}
          {message ? <Text style={[styles.message, { color: colors.grey }]}>{message}</Text> : null}
        </View>
      )}

      {options.map((option, i) => (
        <TouchableOpacity
          key={option.label}
          style={[
            styles.option,
            { borderTopColor: colors.border },
            i === 0 && !title && !message && styles.optionFirst,
          ]}
          onPress={() => choose(option)}
          activeOpacity={0.75}
          accessibilityRole="button"
        >
          {option.Icon && (
            // White, beside white words; only a destructive option keeps its red.
            <option.Icon size={17} color={option.destructive ? colors.red : COLOR_WHITE} />
          )}
          <Text style={[styles.optionText, { color: option.destructive ? colors.red : colors.fg }]}>
            {option.label}
          </Text>
        </TouchableOpacity>
      ))}

      {showCancel && (
        <TouchableOpacity
          style={[styles.cancel, { backgroundColor: colors.inputBg }]}
          onPress={onClose}
          activeOpacity={0.75}
          accessibilityRole="button"
        >
          <Text style={[styles.cancelText, { color: colors.fg }]}>Cancel</Text>
        </TouchableOpacity>
      )}
    </SlideSheet>
  );
}

const styles = StyleSheet.create({
  sheet: {
    borderTopLeftRadius: SHEET_RADIUS, borderTopRightRadius: SHEET_RADIUS,
    paddingHorizontal: 12, paddingTop: 8,
  },
  grabber: {
    alignSelf: 'center', width: 38, height: 4, borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.22)', marginBottom: 8,
  },
  head:    { paddingHorizontal: 6, paddingVertical: 10 },
  title:   { fontSize: 15, fontFamily: FONT_INTER.bold },
  message: { fontSize: 13, marginTop: 3, lineHeight: 18 },

  option: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 6, paddingVertical: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  optionFirst: { borderTopWidth: 0 },
  optionText:  { fontSize: 16, fontFamily: FONT_INTER.semibold },

  cancel: {
    marginTop: 10, borderRadius: 12,
    paddingVertical: 14, alignItems: 'center',
  },
  cancelText: { fontSize: 16, fontFamily: FONT_INTER.bold },
});
