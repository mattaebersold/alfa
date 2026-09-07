import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Dimensions, TouchableOpacity,
} from 'react-native';
import { Image } from 'expo-image';
import { useNavigation } from '@react-navigation/native';
import { Wrench, Images } from 'lucide-react-native';
import SummaryModal, { type SummaryOrigin } from '../ui/SummaryModal';
import LikeButton from '../social/LikeButton';
import CommentButton from '../social/CommentButton';
import CommentsSheet from '../social/CommentsSheet';
import { useColors } from '../../hooks/useColors';
import { usePosterRatio } from '../../hooks/usePosterRatio';
import { imageUrl } from '../../utils/image';
import { stripHtml } from '../../utils/text';
import type { GalleryItem } from '../../types/api';

/** The panel is 90% of the screen; its gallery matches so pages land square. */
const PAGE_WIDTH = Dimensions.get('window').width * 0.9;

export interface CarItem {
  internal_id: string;
  kind: 'mod' | 'gallery';
  /** Stored type — what likes and comments are keyed by. */
  entryType: string;
  title?: string | null;
  body?: string | null;
  /** The mod's own sub-type ("exterior", "engine"), where it has one. */
  type?: string | null;
  gallery?: GalleryItem[];
  carId: string;
  carName: string;
  like_count?: number;
  isLiked?: boolean;
  comment_count?: number;
}

/**
 * A mod or a gallery, opened in place.
 *
 * Tapping one of these in the feed used to jump straight to the car — past the
 * thing you tapped, to the page it lives on, with the photos you were looking
 * at now behind another tap. The card only ever showed one image and a
 * two-line description, so everything else about the mod was unreachable
 * without leaving the feed.
 *
 * This is the whole of it: every photo, swipeable, the full description, and
 * the same like and comment the card carries. "View Car" is still there for
 * when the car is what you actually wanted — it's just no longer the only
 * thing a tap can do.
 */
export default function CarItemSummaryModal({
  item,
  origin,
  onClose,
}: {
  /** The mod or gallery to show. `null` closes the panel. */
  item: CarItem | null;
  origin?: SummaryOrigin | null;
  onClose: () => void;
}) {
  const c = useColors();
  const nav = useNavigation<any>();
  const [page, setPage] = useState(0);
  const [commentsOpen, setCommentsOpen] = useState(false);
  /**
   * One shape for the whole strip, taken from the first photo.
   *
   * The pages have to be the same height or the panel resizes mid-swipe, so a
   * mixed set of portrait and landscape shots can't each have their own — the
   * lead photo is the one the card showed, which makes it the one the panel
   * opens on.
   */
  const { ratio, onLoad } = usePosterRatio();

  const photos = item?.gallery ?? [];
  const description = item?.body ? stripHtml(item.body).trim() : '';
  const isMod = item?.kind === 'mod';
  const Mark = isMod ? Wrench : Images;

  return (
    <>
      <SummaryModal
        visible={!!item}
        onClose={onClose}
        origin={origin}
        actionLabel="View Car"
        onAction={item ? () => nav.navigate('CarDetail', { carId: item.carId }) : undefined}
      >
        {item ? (
          <View>
            {photos.length > 0 ? (
              <View>
                <ScrollView
                  horizontal
                  pagingEnabled
                  showsHorizontalScrollIndicator={false}
                  onMomentumScrollEnd={(e) =>
                    setPage(Math.round(e.nativeEvent.contentOffset.x / PAGE_WIDTH))}
                >
                  {photos.map((g, i) => (
                    <Image
                      key={`${g.filename}_${i}`}
                      source={{ uri: imageUrl(g.filename)! }}
                      style={[styles.photo, { aspectRatio: ratio }]}
                      contentFit="cover"
                      contentPosition="center"
                      transition={150}
                      onLoad={i === 0 ? onLoad : undefined}
                    />
                  ))}
                </ScrollView>

                {/* Dots rather than a counter: at this size the count is the
                    only thing a counter adds, and there are rarely enough
                    photos for the number to beat seeing the row. */}
                {photos.length > 1 && (
                  <View style={styles.dots} pointerEvents="none">
                    {photos.map((g, i) => (
                      <View
                        key={`${g.filename}_dot_${i}`}
                        style={[styles.dot, i === page && styles.dotOn]}
                      />
                    ))}
                  </View>
                )}
              </View>
            ) : null}

            <View style={styles.body}>
              <View style={styles.kindRow}>
                <View style={[styles.kindPill, { backgroundColor: c.segment }]}>
                  <Mark size={11} color={c.grey} strokeWidth={2.4} />
                  <Text style={[styles.kindText, { color: c.grey }]}>
                    {isMod ? 'Car Mod' : 'Car Gallery'}
                  </Text>
                </View>
                {item.type ? (
                  <View style={[styles.kindPill, { backgroundColor: c.segment }]}>
                    <Text style={[styles.kindText, { color: c.grey }]}>{item.type}</Text>
                  </View>
                ) : null}
              </View>

              <Text style={[styles.title, { color: c.fg }]} numberOfLines={2}>
                {item.title || (isMod ? 'New mod' : 'New photos')}
              </Text>
              <Text style={[styles.car, { color: c.grey }]} numberOfLines={1}>
                on {item.carName}
              </Text>

              {description ? (
                <Text style={[styles.desc, { color: c.muted }]}>{description}</Text>
              ) : null}

              <View style={styles.actions}>
                <LikeButton
                  documentId={item.internal_id}
                  entryType={item.entryType}
                  initialCount={item.like_count ?? 0}
                  initialLiked={item.isLiked ?? false}
                  color={c.grey}
                />
                <CommentButton
                  count={item.comment_count ?? 0}
                  onPress={() => setCommentsOpen(true)}
                  color={c.grey}
                />
              </View>
            </View>
          </View>
        ) : null}
      </SummaryModal>

      {/* Outside the panel, so the thread isn't inside something that's about
          to animate away when you tap through to the car. */}
      {item && (
        <CommentsSheet
          postId={item.internal_id}
          entryType={item.entryType}
          visible={commentsOpen}
          onClose={() => setCommentsOpen(false)}
        />
      )}
    </>
  );
}

const styles = StyleSheet.create({
  photo: { width: PAGE_WIDTH },
  dots: {
    position: 'absolute', left: 0, right: 0, bottom: 10,
    flexDirection: 'row', justifyContent: 'center', gap: 5,
  },
  dot: {
    width: 6, height: 6, borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.45)',
  },
  dotOn: { backgroundColor: '#FFFFFF' },

  body:    { padding: 18, paddingBottom: 20, gap: 6 },
  kindRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  kindPill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999,
  },
  kindText: {
    fontSize: 10, fontWeight: '700',
  },
  title: { fontSize: 20, fontWeight: '800', letterSpacing: -0.3, marginTop: 2 },
  car:   { fontSize: 13, marginTop: -2 },
  desc:  { fontSize: 14, lineHeight: 20, marginTop: 6 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8, marginLeft: -6 },
});
