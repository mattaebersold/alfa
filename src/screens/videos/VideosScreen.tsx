import React, { useState } from 'react';
import { View, FlatList, TouchableOpacity, StyleSheet, RefreshControl, Linking } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from '@ors/kit';
import { Image } from 'expo-image';
import { WebView } from 'react-native-webview';
import { Eye, Play } from 'lucide-react-native';
import { formatDistanceToNow } from 'date-fns';
import { formatActionCount } from '../../utils/text';
import AppHeader, { useHeaderPad } from '../../components/ui/AppHeader';
import Spinner from '../../components/ui/Spinner';
import { YouTubeIcon } from '../../components/ui/BrandIcons';
import { useHeaderScroll } from '../../hooks/useHeaderScroll';
import { useColors } from '../../hooks/useColors';
import { useGetChannelVideosQuery, type ChannelVideo } from '../../api/apiService';
import { ss } from '../../styles/shared';
import { COLOR_BLACK, COLOR_GRAY_40, COLOR_WHITE, GUTTER, PILL_RADIUS } from '../../constants/config';
import { FONT_INTER } from '../../constants/fonts';

/**
 * The page the player is embedded in.
 *
 * YouTube's embedded player refuses to play in a web view that can't say
 * which site it's on ("video player configuration error"), so each player
 * loads as a tiny page with the society's site as its base URL, and the
 * iframe names that origin.
 */
const SITE = 'https://openroadsociety.co';

/** The channel itself, as the menu's YouTube link opens it. */
const CHANNEL_URL = 'https://www.youtube.com/@openroadsocietyco';
const playerHtml = (id: string) => `<!doctype html><html><head>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1">
<style>html,body{margin:0;padding:0;background:#000;height:100%;overflow:hidden}iframe{position:absolute;inset:0;width:100%;height:100%;border:0}</style>
</head><body>
<iframe src="https://www.youtube.com/embed/${id}?autoplay=1&playsinline=1&rel=0&modestbranding=1&origin=${encodeURIComponent(SITE)}"
  allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen></iframe>
</body></html>`;

/**
 * One video: its thumbnail until tapped, then the player in the same place.
 * Only one plays at a time — tapping another swaps the player over.
 */
function VideoCard({ video, playing, onPlay }: { video: ChannelVideo; playing: boolean; onPlay: () => void }) {
  const colors = useColors();
  const when = video.published_at
    ? formatDistanceToNow(new Date(video.published_at), { addSuffix: true })
    : '';
  return (
    <View style={[styles.card, { borderColor: colors.border }]}>
      <View style={styles.media}>
        {playing ? (
          <WebView
            source={{ html: playerHtml(video.id), baseUrl: SITE }}
            style={styles.player}
            allowsInlineMediaPlayback
            mediaPlaybackRequiresUserAction={false}
            allowsFullscreenVideo
            javaScriptEnabled
            originWhitelist={['*']}
          />
        ) : (
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            onPress={onPlay}
            activeOpacity={0.9}
            accessibilityRole="button"
            accessibilityLabel={`Play ${video.title}`}
          >
            <Image source={{ uri: video.thumbnail }} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} />
            <View style={styles.playWrap}>
              <View style={styles.playDisc}>
                <Play size={22} color={COLOR_BLACK} fill={COLOR_BLACK} style={styles.playGlyph} />
              </View>
            </View>
          </TouchableOpacity>
        )}
      </View>
      <View style={styles.info}>
        {/* The title, and how many have watched it on the right. */}
        <View style={styles.titleRow}>
          <Text style={[styles.title, { color: colors.fg }]} numberOfLines={2}>{video.title}</Text>
          {video.views != null ? (
            <View
              style={styles.views}
              accessibilityLabel={`${video.views} ${video.views === 1 ? 'view' : 'views'}`}
            >
              <Eye size={14} color={colors.grey} />
              <Text style={[styles.viewsText, { color: colors.grey }]}>{formatActionCount(video.views)}</Text>
            </View>
          ) : null}
        </View>
        {when ? <Text style={[styles.when, { color: colors.grey }]}>{when}</Text> : null}
      </View>
    </View>
  );
}

/**
 * ORS Videos — the society's YouTube channel, newest first, watched in place.
 *
 * The list comes from horacio (/api/videos), which reads the channel's public
 * feed: the latest fifteen, which is all YouTube's feed carries.
 */
export default function VideosScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const headerPad = useHeaderPad();
  const onScroll = useHeaderScroll(headerPad);
  const { data, isLoading, refetch, isFetching } = useGetChannelVideosQuery();
  const [playingId, setPlayingId] = useState<string | null>(null);
  const videos = data?.entries ?? [];

  return (
    <SafeAreaView style={[ss.fill, { backgroundColor: colors.cream }]} edges={[]}>
      <AppHeader />
      {isLoading ? (
        <Spinner fullScreen />
      ) : (
        <FlatList
          data={videos}
          keyExtractor={(v) => v.id}
          renderItem={({ item }) => (
            <VideoCard video={item} playing={playingId === item.id} onPlay={() => setPlayingId(item.id)} />
          )}
          ListHeaderComponent={
            <View style={styles.head}>
              <Text style={[styles.heading, { color: colors.fg }]}>ORS Videos</Text>
              <TouchableOpacity
                style={[styles.channelBtn, { borderColor: colors.border }]}
                onPress={() => Linking.openURL(CHANNEL_URL)}
                activeOpacity={0.75}
                accessibilityRole="link"
                accessibilityLabel="View the ORS YouTube channel"
              >
                <YouTubeIcon size={15} color={colors.fg} />
                <Text style={[styles.channelText, { color: colors.fg }]}>View channel</Text>
              </TouchableOpacity>
            </View>
          }
          ListEmptyComponent={
            <Text style={[styles.empty, { color: colors.grey }]}>No videos to show right now.</Text>
          }
          contentContainerStyle={{ paddingTop: headerPad, paddingBottom: insets.bottom + 110, paddingHorizontal: GUTTER, gap: 14 }}
          onScroll={onScroll}
          scrollEventThrottle={16}
          refreshControl={<RefreshControl refreshing={isFetching && !isLoading} onRefresh={refetch} tintColor={colors.grey} />}
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  // The title on the left, the way out to YouTube on the right.
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingTop: 8, paddingBottom: 4 },
  heading: { flexShrink: 1, fontSize: 22, fontFamily: FONT_INTER.bold },
  channelBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: PILL_RADIUS, borderWidth: 1,
  },
  channelText: { fontSize: 13, fontFamily: FONT_INTER.semibold },
  empty: { fontSize: 14, textAlign: 'center', paddingTop: 40 },

  card: { borderRadius: 14, borderWidth: 1, overflow: 'hidden', backgroundColor: COLOR_GRAY_40 },
  // Rounded at the foot too, where it meets the words — the card's radius, as
  // the listing and event cards' pictures are.
  media: {
    width: '100%', aspectRatio: 16 / 9, backgroundColor: COLOR_BLACK,
    borderBottomLeftRadius: 14, borderBottomRightRadius: 14, overflow: 'hidden',
  },
  player: { flex: 1, backgroundColor: COLOR_BLACK },
  // Written out: RN 0.86 dropped StyleSheet.absoluteFillObject.
  playWrap: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.2)' },
  playDisc: {
    width: 56, height: 56, borderRadius: PILL_RADIUS,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.92)',
  },
  // Nudged right: a triangle's weight sits left of its box's centre.
  playGlyph: { marginLeft: 3 },
  info: { paddingHorizontal: 12, paddingTop: 10, paddingBottom: 12, gap: 4 },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  // On the title's first line.
  views: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingTop: 3 },
  viewsText: { fontSize: 12, fontFamily: FONT_INTER.semibold },
  title: { flex: 1, fontSize: 15, fontFamily: FONT_INTER.semibold, lineHeight: 20, color: COLOR_WHITE },
  when: { fontSize: 12 },
});
