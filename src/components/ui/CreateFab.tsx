import React from 'react';
import { View, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Plus } from 'lucide-react-native';
import { BlurView } from 'expo-blur';
import { useBrandColor, useIsPro } from '../../hooks/useBrandColor';
import OilSheen from './OilSheen';
import { GUTTER, COLOR_BLACK } from '../../constants/config';

/**
 * The + — 48, a touch over the header's 42-point buttons: it's the one thing here
 * you're most likely to reach for. (It was 46, 50, 62, 54 and 60 before that.)
 */
const FAB_SIZE = 48;
/** A full circle. */
const FAB_RADIUS = FAB_SIZE / 2;
/**
 * In from the right edge — clear of an iPhone's rounded corner, not tucked
 * into it. Android's corners are square or barely rounded, and its GUTTER is
 * wider to begin with, so there it sits just past the gutter instead.
 */
export const FAB_RIGHT = Platform.OS === 'android' ? GUTTER + 4 : 12;
/** Clear space kept around the +, inside its box. */
const FAB_PAD = 6;
/** The box: the + and its padding. */
export const FAB_BOX = FAB_SIZE + FAB_PAD * 2;
const BOX = FAB_BOX;
/**
 * Offset from the safe-area inset. With no tab row left to line up with, the
 * button sits low: on iOS a little way into the home indicator's inset (which is
 * mostly empty space above the bar itself), on Android just clear of the
 * system navigation.
 */
export const FAB_BOTTOM = Platform.OS === 'android' ? 22 : 0;
/**
 * Width the tab bar keeps clear on its right for this button.
 *
 * The button sits in the corner, over the bar rather than above it, so without
 * this the last tab would end up underneath it and unpressable.
 */
export const FAB_LANE = BOX + FAB_RIGHT + 8;

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
  const isPro = useIsPro();

  return (
    <View style={[styles.cluster, { bottom: insets.bottom + FAB_BOTTOM }]} pointerEvents="box-none">
    {/* The ring around the +: what's behind blurred, 60% black over it. */}
    <View style={styles.ring} pointerEvents="none">
      <BlurView
        intensity={30}
        tint="dark"
        experimentalBlurMethod="dimezisBlurView"
        style={StyleSheet.absoluteFill}
      />
      <View style={[StyleSheet.absoluteFill, styles.ringTint]} />
    </View>
    <TouchableOpacity
      // The brand colour: solid Pro red for a Pro account, blue otherwise.
      style={[styles.fab, { backgroundColor: tint }]}
      // The form; its Add Media is where the camera is.
      onPress={() => navigation.navigate('Create')}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel="New post"
    >
      {/* The oil-slick film on blue only — Pro's red is solid. Clips to its
          own radius, so it has to track the button's. */}
      {!isPro && <OilSheen tone="cool" radius={FAB_RADIUS} />}
      {/* Always black, rather than whatever contrasts with the fill.
          `contrastText` put a white plus on the basic account's blue — correct
          by contrast, but it made the same button look like two different
          controls depending on the account. The mark is black on gold and
          black on blue; both are legible, and it stays one button. */}
      <Plus size={25} color={COLOR_BLACK} strokeWidth={3.3} />
    </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  // The + inset by its padding, in a frosted circle.
  cluster: {
    position: 'absolute',
    right: FAB_RIGHT,
    width: BOX, height: BOX,
    alignItems: 'center', justifyContent: 'center',
    zIndex: 30,
  },
  ring: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    borderRadius: BOX / 2,
    overflow: 'hidden',
  },
  ringTint: { backgroundColor: 'rgba(0,0,0,0.6)' },
  fab: {
    width: FAB_SIZE, height: FAB_SIZE, borderRadius: FAB_RADIUS,
    alignItems: 'center', justifyContent: 'center',
  },
});
