import React, { useEffect, useMemo, useState } from 'react';
import { View, StyleSheet, TouchableOpacity, Modal } from 'react-native';
import { Text } from '../../theme/Text';
import { NavigationContext, useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft } from 'lucide-react-native';
import DashboardScreen from '../../screens/profile/DashboardScreen';
import SettingsScreen from '../../screens/profile/SettingsScreen';
import { useColors } from '../../hooks/useColors';
import { FONT_INTER } from '../../constants/fonts';
import { APP_BG, COLOR_WHITE } from '../../constants/config';

/**
 * Dashboard & Settings, full screen over the menu.
 *
 * It used to be a route: the menu closed, then the page pushed — so the menu
 * was gone before anything replaced it. As a pane it opens over the menu and
 * closing it lands you back in the menu where you were.
 *
 * Mounted inside the menu's own Modal (see NavDrawer), for the same reason
 * the car form is: on iOS a Modal outside it would be presented by the root,
 * which is busy showing the menu, and never appear.
 *
 * The two screens still call `navigation.navigate` as they do in the stack.
 * Here that's intercepted: Account Settings swaps the pane to Settings in
 * place, and anywhere else (a car, a post, Alerts…) is a real screen in the
 * app, so `onLeave` closes the pane and the menu first and goes there after.
 */
export default function SettingsPane({ visible, onClose, onLeave }: {
  visible: boolean;
  onClose: () => void;
  /** Close the pane and the menu, then run `go`. */
  onLeave: (go: () => void) => void;
}) {
  const navigation = useNavigation();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [page, setPage] = useState<'dashboard' | 'settings'>('dashboard');

  // Every open starts on the dashboard.
  useEffect(() => { if (visible) setPage('dashboard'); }, [visible]);

  const paneNavigation = useMemo(() => ({
    ...navigation,
    navigate: (...args: any[]) => {
      if (args[0] === 'Settings') { setPage('settings'); return; }
      onLeave(() => (navigation.navigate as any)(...args));
    },
  }), [navigation, onLeave]) as unknown as React.ContextType<typeof NavigationContext>;

  const back = () => (page === 'settings' ? setPage('dashboard') : onClose());

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={back}>
      <View style={styles.fill}>
        <NavigationContext.Provider value={paneNavigation}>
          {page === 'dashboard' ? (
            <DashboardScreen onClose={onClose} />
          ) : (
            <>
              <View style={[styles.bar, { paddingTop: insets.top + 8 }]}>
                <TouchableOpacity
                  style={[styles.circleBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
                  onPress={back}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel="Back to dashboard"
                >
                  <ArrowLeft size={20} color={COLOR_WHITE} strokeWidth={2.2} />
                </TouchableOpacity>
                <Text style={styles.title}>Settings</Text>
                <View style={styles.circleSpacer} />
              </View>
              <SettingsScreen />
            </>
          )}
        </NavigationContext.Provider>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: APP_BG },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  circleBtn: { width: 38, height: 38, borderRadius: 19, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  circleSpacer: { width: 38 },
  title: { fontSize: 17, fontFamily: FONT_INTER.bold, color: COLOR_WHITE },
});
