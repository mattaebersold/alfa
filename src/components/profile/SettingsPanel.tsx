import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { X } from 'lucide-react-native';
import GrowPanel, { type GrowOrigin } from '../ui/GrowPanel';
import SettingsScreen from '../../screens/profile/SettingsScreen';
import { useColors } from '../../hooks/useColors';

/**
 * Settings, grown out of the cog on your profile banner.
 *
 * The same settings as the Settings screen — that component, unchanged — in
 * the panel the garage and the bell open, so the banner's buttons all open in
 * place. The screen still exists for the menu and anywhere else that
 * navigates to it.
 */
export default function SettingsPanel({ visible, origin, onClose }: {
  visible: boolean;
  origin?: GrowOrigin | null;
  onClose: () => void;
}) {
  const colors = useColors();

  return (
    <GrowPanel visible={visible} origin={origin} onClose={onClose} surface={colors.cream}>
      {({ closeThen }) => (
        <View style={styles.fill}>
          <View style={styles.head}>
            <Text style={[styles.title, { color: colors.fg }]}>Settings</Text>
            <TouchableOpacity
              onPress={() => closeThen()}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              accessibilityRole="button"
              accessibilityLabel="Close settings"
            >
              <X size={26} color={colors.fg} strokeWidth={2.4} />
            </TouchableOpacity>
          </View>
          <SettingsScreen />
        </View>
      )}
    </GrowPanel>
  );
}

const styles = StyleSheet.create({
  fill:  { flex: 1 },
  head: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8,
  },
  title: { fontSize: 18, fontWeight: '800' },
});
