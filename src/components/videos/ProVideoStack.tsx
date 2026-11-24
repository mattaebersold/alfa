import React, { useCallback } from 'react';
import {
  View, StyleSheet, useWindowDimensions, type NativeScrollEvent, type NativeSyntheticEvent,
} from 'react-native';
import Animated from 'react-native-reanimated';
import ProVideoCard from './ProVideoCard';
import ProVideoTile, { TILE_RATIO } from './ProVideoTile';
import type { ProVideo } from '../../types/proVideos';
import type { ProVideoUpload } from '../../utils/proVideoUpload';
import { GUTTER } from '../../constants/config';

/** How far from the end the next page is asked for. */
const END_REACHED_PX = 600;
/** Cards to a row. */
const COLUMNS = 2;
/** Between the cards, across and down. */
const GAP = 10;

/**
 * PRO › Videos' list: every video as the Pro screen's "New Pro Videos" row
 * draws it (ProVideoTile — 3:4, the poster covering it, the poster's photo
 * top-left, length over title), two to a row. Tap one and it plays.
 *
 * Your own uploads that aren't ready yet have no poster to show, so those
 * take ProVideoCard's status face at the same size — where it's got to, with
 * Retry / Cancel / Delete.
 */
export default function ProVideoStack({
  videos, header, footer, empty, paddingTop, paddingBottom, onScroll, onEndReached,
  refreshControl, onOpen, uploads, canRetry, onRetry, onCancel, onDelete,
}: {
  videos: ProVideo[];
  header: React.ReactElement;
  footer?: React.ReactElement | null;
  empty?: React.ReactElement | null;
  /** Kept for callers; the grid doesn't need it. */
  headerHeight?: number;
  paddingTop: number;
  paddingBottom: number;
  onScroll?: (e: NativeSyntheticEvent<NativeScrollEvent>) => void;
  onEndReached?: () => void;
  refreshControl?: React.ReactElement<any>;
  onOpen: (v: ProVideo) => void;
  uploads?: Map<string, ProVideoUpload>;
  canRetry?: (v: ProVideo) => boolean;
  onRetry?: (v: ProVideo) => void;
  onCancel?: (v: ProVideo) => void;
  onDelete?: (v: ProVideo) => void;
}) {
  const { width } = useWindowDimensions();
  const tileW = Math.floor((width - (GUTTER + 4) * 2 - GAP * (COLUMNS - 1)) / COLUMNS);
  const tileH = Math.round(tileW * TILE_RATIO);

  const handleScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    onScroll?.(e);
    const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
    if (onEndReached && contentOffset.y + layoutMeasurement.height >= contentSize.height - END_REACHED_PX) onEndReached();
  }, [onScroll, onEndReached]);

  return (
    <Animated.ScrollView
      onScroll={handleScroll}
      scrollEventThrottle={16}
      refreshControl={refreshControl}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingTop, paddingBottom }}
    >
      {header}
      {videos.length === 0 ? empty : (
        <View style={styles.grid}>
          {videos.map((v) => (
            v.status === 'ready' && v.playback_id ? (
              <ProVideoTile key={v.internal_id} video={v} width={tileW} onPress={() => onOpen(v)} />
            ) : (
              <View key={v.internal_id} style={{ width: tileW, height: tileH }}>
                <ProVideoCard
                  video={v}
                  height={tileH}
                  onPress={onOpen}
                  upload={uploads?.get(v.internal_id) ?? null}
                  canRetry={canRetry?.(v)}
                  onRetry={onRetry}
                  onCancel={onCancel}
                  onDelete={onDelete}
                />
              </View>
            )
          ))}
        </View>
      )}
      {footer}
    </Animated.ScrollView>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: GAP, paddingHorizontal: GUTTER + 4 },
});
