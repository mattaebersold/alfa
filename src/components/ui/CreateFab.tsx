import React from 'react';
import { TouchableOpacity, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Plus } from 'lucide-react-native';
import { useBrandColor, contrastText } from '../../hooks/useBrandColor';

const FAB_SIZE = 62;
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
      <Plus size={30} color={contrastText(tint)} strokeWidth={3} />
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
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.45,
    shadowRadius: 10,
    elevation: 10,
    zIndex: 30,
  },
});
