import React from 'react';
import { View, TouchableOpacity, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Eye, Play } from 'lucide-react-native';
import { Text } from '../../theme/Text';
import { Image } from '../ui/AppImage';
import Avatar from '../ui/Avatar';
import { muxPoster, formatDuration, formatViewCount, type ProVideo } from '../../types/proVideos';
import { authorName } from './ProVideoCard';
import { COLOR_WHITE } from '../../constants/config';
import { FONT_INTER } from '../../constants/fonts';

/** The Pro screen's videos row card: 160 wide, 3:4. */
export const TILE_W = 160;
/** Height over width — 3:4, a portrait frame. */
export const TILE_RATIO = 4 / 3;

/**
 * A ready Pro video as the Pro screen's "New Pro Videos" row draws it, and
 * PRO › Videos too: the poster covering a 3:4 card in a thin grey frame, a
 * play disc in the middle, who posted it as just their photo top-left in a
 * dark ring, and its length and views over the title along the foot.
 *
 * `width` sizes it (the height follows, 3:4); the row's 160 by default.
 */
export default function ProVideoTile({ video, onPress, width = TILE_W, style }: {
  video: ProVideo;
  onPress: () => void;
  width?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const duration = formatDuration(video.duration);
  // Hidden at none, as the other cards' counts are.
  const views = video.views > 0 ? formatViewCount(video.views) : null;
  const viewsLabel = views ? `${video.views} ${video.views === 1 ? 'view' : 'views'}` : null;
  return (
    <TouchableOpacity
      style={[styles.card, { width, height: Math.round(width * TILE_RATIO) }, style]}
      onPress={onPress}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel={[`${video.title}, by ${authorName(video.user)}`, duration, viewsLabel].filter(Boolean).join(', ')}
    >
      {video.playback_id ? (
        <Image source={{ uri: muxPoster(video.playback_id, 480) }} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} />
      ) : null}
      <View style={styles.play} pointerEvents="none">
        <View style={styles.playDisc}><Play size={22} color={COLOR_WHITE} fill={COLOR_WHITE} /></View>
      </View>
      <LinearGradient
        colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.55)', 'rgba(0,0,0,0.85)']}
        locations={[0, 0.45, 1]}
        style={styles.scrim}
        pointerEvents="none"
      />
      {/* Who posted it: just their photo, top-left. */}
      {video.user ? (
        <View style={styles.avatar} pointerEvents="none">
          <Avatar user={video.user as any} size={26} edge={false} />
        </View>
      ) : null}
      {/* Length and views over the title, across the card's width. */}
      <View style={styles.foot} pointerEvents="none">
        {duration || views ? (
          <View style={styles.badges}>
            {duration ? (
              <View style={styles.duration}>
                <Text style={styles.durationText}>{duration}</Text>
              </View>
            ) : null}
            {views ? (
              <View style={[styles.duration, styles.views]}>
                <Eye size={11} color={COLOR_WHITE} strokeWidth={2.4} />
                <Text style={styles.durationText}>{views}</Text>
              </View>
            ) : null}
          </View>
        ) : null}
        <Text style={styles.cardTitle} numberOfLines={2}>{video.title}</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  // The poster covers the card, in a grey frame; a shadow off its edges
  // (an outset boxShadow isn't clipped by the card's own overflow).
  card: {
    borderRadius: 18, overflow: 'hidden', backgroundColor: '#222',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.22)',
    boxShadow: '0px 0px 14px rgba(0, 0, 0, 0.55)',
  },
  play: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  // Larger, a white play on the dark disc.
  playDisc: { width: 52, height: 52, borderRadius: 26, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center', paddingLeft: 3 },
  // A 3px black/40 ring round the photo, no shadow.
  avatar: { position: 'absolute', top: 8, left: 8, borderRadius: 16, borderWidth: 3, borderColor: 'rgba(0,0,0,0.4)' },
  badges: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  views: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  // A see-through bubble.
  duration: { alignSelf: 'flex-start', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, backgroundColor: 'rgba(0,0,0,0.5)' },
  durationText: { fontSize: 11, fontFamily: FONT_INTER.semibold, color: COLOR_WHITE, fontVariant: ['tabular-nums'] },
  scrim: { position: 'absolute', left: 0, right: 0, bottom: 0, height: '60%' },
  foot: { position: 'absolute', left: 10, right: 10, bottom: 10, gap: 4 },
  cardTitle: { fontSize: 14, fontFamily: FONT_INTER.bold, color: COLOR_WHITE },
});
