import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, ScrollView, TouchableOpacity, StyleSheet, Animated, Alert } from 'react-native';
import { Clapperboard } from 'lucide-react-native';
import ProSectionTitle from '../pro/ProSectionTitle';
import { Text } from '../../theme/Text';
import RowEndSpacer from '../ui/RowEndSpacer';
import ProVideoOverlay from './ProVideoOverlay';
import ProVideoTile from './ProVideoTile';
import ProVideoDetailsSheet from './ProVideoDetailsSheet';
import { pickProVideo, type PickedVideo } from '../../utils/proVideoUpload';
import { useIsPro } from '../../hooks/useBrandColor';
import { useGetProVideosInfiniteQuery } from '../../api/apiService';
import { useColors } from '../../hooks/useColors';
import { navigateFromOutside } from '../../navigation/navigationRef';
import { type ProVideo } from '../../types/proVideos';
import { FONT_INTER } from '../../constants/fonts';

/** How many of the newest videos the shelf holds. */
const COUNT = 8;
/**
 * How far each card tucks in under the one before it: the newest is on top,
 * and each older one peeks out from under its right edge.
 */
const OVERLAP = 44;
/** The cards under the top one, a tenth smaller. */
const UNDER_SCALE = 0.9;
/** PostStrip's left inset and its head's padding, so the shelves line up. */
const ROW_PAD_LEFT = 16;

/** PRO › Videos, from anywhere — see sections/pro.tsx. */
function openVideosTab() {
  navigateFromOutside('MainTabs', {
    screen: 'FeedTab',
    params: { screen: 'Feed', params: { tab: 'pro', sub: 'videos', at: Date.now() } },
  });
}

/**
 * "New Pro Videos": the newest ready videos, sideways, each its poster with
 * the title, who posted it and its length over the foot. "View all" opens the
 * PRO tab's Videos; the top card plays full screen, another is lifted to the top. Hides itself while there are none.
 */
export default function NewProVideosShelf() {
  const colors = useColors();
  const { data } = useGetProVideosInfiniteQuery({ sort: 'newest' }, { refetchOnMountOrArgChange: 60 });
  const videos = useMemo(
    () => (data?.pages?.[0]?.entries ?? []).filter((v) => v.status === 'ready' && !!v.playback_id).slice(0, COUNT),
    [data],
  );
  /**
   * The card on top: the newest to start with. Tapping another lifts it to
   * the top and brings it to full size; tapping the one on top plays it.
   */
  const [active, setActive] = useState(0);
  const isPro = useIsPro();
  /** A video picked from the phone, waiting on its details before it goes up. */
  const [picked, setPicked] = useState<PickedVideo | null>(null);
  const onUpload = async () => {
    try {
      const v = await pickProVideo();
      if (v) setPicked(v);
    } catch (err: any) {
      Alert.alert("Couldn't open your videos", err?.message ?? 'Check that the app is allowed to see your library.');
    }
  };
  /** The one playing full screen. */
  const [watching, setWatching] = useState<ProVideo | null>(null);
  useEffect(() => { if (active >= videos.length) setActive(0); }, [videos.length, active]);
  // Nothing to show: hidden — except to a Pro member, who keeps Add New.
  if (videos.length === 0 && !isPro) return null;

  return (
    <View style={styles.wrap}>
      <View style={styles.head}>
        <ProSectionTitle title="New Pro Videos" Icon={Clapperboard} />
        <View style={styles.headActions}>
        {/* Add New: pick a video from the phone and fill in its details — the Videos tab's Upload. */}
        {isPro ? (
          <TouchableOpacity
            style={[styles.viewAllBtn, { borderColor: colors.borderDark }]}
            onPress={onUpload}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Upload a Pro video"
          >
            <Text style={[styles.viewAllText, { color: colors.fg }]}>Add New</Text>
          </TouchableOpacity>
        ) : null}
        <TouchableOpacity
          style={[styles.viewAllBtn, { borderColor: colors.borderDark }]}
          onPress={openVideosTab}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="View all Pro videos"
        >
          <Text style={[styles.viewAllText, { color: colors.fg }]}>View all</Text>
        </TouchableOpacity>
        </View>
      </View>
      {videos.length ? (
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {videos.map((v, i) => (
          <VideoCard
            key={v.internal_id}
            video={v}
            first={i === 0}
            active={i === active}
            // The one on top highest, the rest lower the further they are from it.
            z={videos.length - Math.abs(i - active)}
            // The top card plays full screen, with its comments (ProVideoOverlay).
            onPress={() => (i === active ? setWatching(v) : setActive(i))}
          />
        ))}
        <RowEndSpacer width={ROW_PAD_LEFT} />
      </ScrollView>
      ) : null}
      <ProVideoOverlay video={watching} onClose={() => setWatching(null)} />
      <ProVideoDetailsSheet visible={!!picked} picked={picked} onClose={() => setPicked(null)} />
    </View>
  );
}

function VideoCard({ video, first, active, z, onPress }: {
  video: ProVideo; first: boolean; active: boolean; z: number; onPress: () => void;
}) {
  // The ones under the top card a tenth smaller, for depth; easing to full
  // size as one is lifted to the top.
  const scale = useRef(new Animated.Value(active ? 1 : UNDER_SCALE)).current;
  useEffect(() => {
    Animated.spring(scale, { toValue: active ? 1 : UNDER_SCALE, useNativeDriver: true, speed: 18, bounciness: 5 }).start();
  }, [active, scale]);
  return (
    <Animated.View style={[!first && styles.cardUnder, { zIndex: z, elevation: z, transform: [{ scale }] }]}>
    {/* The card itself is shared with PRO › Videos (ProVideoTile). */}
    <ProVideoTile video={video} onPress={onPress} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  // PostStrip's shelf spacing and head, so it sits in line with the shelves around it.
  wrap: { paddingTop: 30 },
  head: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingLeft: ROW_PAD_LEFT, paddingRight: 10, paddingBottom: 10,
  },
  title: { fontSize: 17, fontFamily: FONT_INTER.semibold },
  headActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  viewAllBtn: { height: 28, paddingHorizontal: 12, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  viewAllText: { fontSize: 12.5, fontFamily: FONT_INTER.semibold },
  row: { paddingLeft: ROW_PAD_LEFT },

  // Tucked under the one before it.
  cardUnder: { marginLeft: -OVERLAP },
});
