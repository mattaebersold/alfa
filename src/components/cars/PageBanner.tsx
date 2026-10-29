import React from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import { Image } from '../ui/AppImage';
import { LinearGradient } from 'expo-linear-gradient';
import { Car } from 'lucide-react-native';
import { useColors } from '../../hooks/useColors';
import { COLOR_GRAY_26 } from '../../constants/config';

const SCREEN_WIDTH = Dimensions.get('window').width;

/** The banner photo's height — behind the status bar and the header's buttons too. */
export const PAGE_BANNER_H = Math.round(SCREEN_WIDTH * 0.72);
/**
 * How far a page's content is pulled up over the banner — the title and what
 * follows it sit on the photo, not under it. Give the content
 * `marginTop: -PAGE_BANNER_OVERLAP`.
 */
export const PAGE_BANNER_OVERLAP = 180;

/**
 * The top of a make's or a model's page: one photo from a member's car of it,
 * shaded back so it reads as a backdrop, dark at the top for the header and
 * the status bar, and fading into the page's own ground at the foot — where
 * the page's content floats over it (PAGE_BANNER_OVERLAP).
 *
 * `overlay` is laid over the top of the photo and scrolls away with it — the
 * Cars tab's breadcrumb trail.
 */
export default function PageBanner({ photo, overlay, ground }: {
  photo?: string | null;
  overlay?: React.ReactNode;
  /** The page's ground, which the foot fades into. The app's own by default. */
  ground?: string;
}) {
  const colors = useColors();
  return (
    <View style={styles.banner}>
      {photo ? (
        <Image source={{ uri: photo }} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} />
      ) : (
        <View style={[StyleSheet.absoluteFill, styles.blank]}>
          <Car size={44} color={colors.grey} />
        </View>
      )}
      {/* A shade over the whole photo, so it sits back as a backdrop and the
          page's words read wherever they land on it. */}
      <View style={[StyleSheet.absoluteFill, styles.shade]} pointerEvents="none" />
      {/* Dark at the top, for the back button and the status bar… */}
      <LinearGradient
        colors={['rgba(0,0,0,0.55)', 'rgba(0,0,0,0)']}
        style={styles.top}
        pointerEvents="none"
      />
      {/* …and into the page's own ground at the foot. */}
      <LinearGradient
        colors={['rgba(10,10,10,0)', ground ?? colors.cream]}
        style={styles.foot}
        pointerEvents="none"
      />
      {overlay ? <View style={styles.overlay}>{overlay}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  banner:  { width: '100%', height: PAGE_BANNER_H, backgroundColor: COLOR_GRAY_26 },
  blank:   { alignItems: 'center', justifyContent: 'center' },
  overlay: { position: 'absolute', left: 0, right: 0, top: 0 },
  top:     { position: 'absolute', left: 0, right: 0, top: 0, height: 130 },
  shade:   { backgroundColor: 'rgba(0,0,0,0.5)' },
  // A point past the foot, so no hairline of photo shows under it. Tall
  // enough to sit under all of the content that overlaps the photo.
  foot:    { position: 'absolute', left: 0, right: 0, bottom: -1, height: '80%' },
});
