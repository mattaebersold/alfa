import React from 'react';
import { TouchableOpacity, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Plus } from 'lucide-react-native';
import { useBrandColor } from '../../hooks/useBrandColor';

/**
 * 50, down from 62.
 *
 * It reserves a lane on the right of the tab bar (see FAB_LANE) and every point
 * it takes comes off the width the tabs share. At 62 it was sized for a bar
 * that had fewer tabs in it than it does now, and the smaller circle is still a
 * comfortable target while giving the labels beside it room to set.
 */
const FAB_SIZE = 50;
const FAB_RIGHT = 18;
/**
 * Width the tab bar keeps clear on its right for this button.
 *
 * The button sits in the corner, over the bar rather than above it, so without
 * this the last tab would end up underneath it and unpressable.
 */
export const FAB_LANE = FAB_SIZE + FAB_RIGHT + 8;

/**
 * "New post", as a circle in the bottom-right corner of the screen.
 *
 * It used to be one of four equal squares in the header, where the single most
 * common thing anyone does here looked exactly as important as opening the
 * menu. Down here it's the only round thing on the screen, in the corner a
 * thumb already rests on — right at the bottom, in the tab bar's own row rather
 * than hovering above it.
 *
 * Rendered once by MainTabNavigator rather than per screen, so it stays put
 * while tabs change underneath it.
 */
export default function CreateFab() {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const tint = useBrandColor();

  return (
    <TouchableOpacity
      style={[styles.fab, { backgroundColor: tint, bottom: insets.bottom + 8 }]}
      onPress={() => navigation.navigate('Create')}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel="New post"
    >
      {/* Always black, rather than whatever contrasts with the fill.
          `contrastText` put a white plus on the basic account's blue — correct
          by contrast, but it made the same button look like two different
          controls depending on the account. The mark is black on gold and
          black on blue; both are legible, and it stays one button. */}
      <Plus size={24} color="#000000" strokeWidth={3} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    right: FAB_RIGHT,
    width: FAB_SIZE, height: FAB_SIZE, borderRadius: FAB_SIZE / 2,
    alignItems: 'center', justifyContent: 'center',
    // Heavier than the header buttons carried: it has to read as sitting on top
    // of the feed rather than in it.
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.45,
    shadowRadius: 8,
    elevation: 10,
    zIndex: 30,
  },
});
