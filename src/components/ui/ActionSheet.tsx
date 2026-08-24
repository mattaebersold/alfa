import React from 'react';
import { View, Text, StyleSheet, Modal, Pressable, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '../../hooks/useColors';

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
export default function ActionSheet({ visible, onClose, title, message, options }: Props) {
  const colors = useColors();
  const insets = useSafeAreaInsets();

  // The choice runs after the sheet is closed: on iOS a screen or another modal
  // can't be presented while this one is still up.
  const choose = (option: ActionSheetOption) => {
    onClose();
    requestAnimationFrame(option.onPress);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close menu">
        {/* Swallows taps on the sheet itself so they don't reach the backdrop. */}
        <Pressable
          style={[
            styles.sheet,
            { backgroundColor: colors.card, paddingBottom: Math.max(insets.bottom, 12) + 8 },
          ]}
          onPress={() => {}}
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
                <option.Icon size={17} color={option.destructive ? colors.red : colors.primaryAlt} />
              )}
              <Text style={[styles.optionText, { color: option.destructive ? colors.red : colors.fg }]}>
                {option.label}
              </Text>
            </TouchableOpacity>
          ))}

          <TouchableOpacity
            style={[styles.cancel, { backgroundColor: colors.inputBg }]}
            onPress={onClose}
            activeOpacity={0.75}
            accessibilityRole="button"
          >
            <Text style={[styles.cancelText, { color: colors.fg }]}>Cancel</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1, justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  sheet: {
    borderTopLeftRadius: 16, borderTopRightRadius: 16,
    paddingHorizontal: 12, paddingTop: 8,
  },
  grabber: {
    alignSelf: 'center', width: 38, height: 4, borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.22)', marginBottom: 8,
  },
  head:    { paddingHorizontal: 6, paddingVertical: 10 },
  title:   { fontSize: 15, fontWeight: '800' },
  message: { fontSize: 13, marginTop: 3, lineHeight: 18 },

  option: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 6, paddingVertical: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  optionFirst: { borderTopWidth: 0 },
  optionText:  { fontSize: 16, fontWeight: '600' },

  cancel: {
    marginTop: 10, borderRadius: 12,
    paddingVertical: 14, alignItems: 'center',
  },
  cancelText: { fontSize: 16, fontWeight: '700' },
});
