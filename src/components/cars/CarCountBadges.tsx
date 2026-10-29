import React, { useRef } from 'react';
import { View, TouchableOpacity, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { Text } from '@ors/kit';
import { Wrench, Users, Images, Tag, MessageCircle } from 'lucide-react-native';
import { useGetCarModsPageQuery, useGetCarGalleriesPageQuery, useGetCarTaggedPostsQuery } from '../../api/apiService';
import { SummaryTouchable, measureOrigin, type SummaryOrigin } from '../ui/SummaryModal';
import AnimatedHeart from '../social/AnimatedHeart';
import { usePostLike } from '../../hooks/usePostLike';
import { useAppSelector } from '../../store/store';
import type { GarageCar } from '../../types/api';
import type { CarActivityTab } from './CarActivitySummaryModal';
import { formatActionCount } from '../../utils/text';
import { COLOR_BLACK, COLOR_LIKE, COLOR_WHITE } from '../../constants/config';
import { FONT_INTER } from '../../constants/fonts';

/** The rail's icon size on a photo — PostActionRail's RAIL_ICON. */
const COUNT_ICON = 21;
/** How far a caption on the same photo stays in from the right, clear of the column. */
export const CAR_COUNTS_CLEARANCE = 52;

/**
 * What's been logged against a car and how it's been received — mods,
 * galleries and tagged posts (only the ones it has any of), then followers,
 * comments and likes (always, as a feed post's are) — as a column in a car
 * photo's bottom-right corner, drawn like a feed post's action rail
 * (PostActionRail): white icons at the rail's size, each count to its icon's
 * left, no ground, one shadow under the lot. A one-row page of each list is
 * enough for its total.
 *
 * The heart is a like, as a post's is (PostActionRail): not yet liked, a tap
 * likes it on the spot; liked already, or your own car, it opens the likes tab
 * instead — where an unlike would live.
 *
 * On the garage's cards, the feed's car cards and the car's summary. The host
 * positions nothing: the column pins itself to the corner of whatever photo
 * it's laid over, and the host lays a wash under it for a bright photo.
 */
export default function CarCountBadges({ car, followers, onOpen, style }: {
  car: GarageCar;
  followers: number;
  /** A count tapped: the car's activity summary, on that count's tab, grown from it. */
  onOpen: (tab: CarActivityTab, origin: SummaryOrigin | null) => void;
  style?: StyleProp<ViewStyle>;
}) {
  const carId = car.internal_id;
  // A shared car is the co-owner's too: theirs to see the likes of, not to like.
  const myId = useAppSelector((s) => s.auth.userInfo?.user_id);
  const like = usePostLike({
    postId: carId,
    entryType: 'garagecar',
    ownerId: myId && myId === car.coowner_id ? car.coowner_id : car.user_id,
    initialLiked: car.isLiked ?? false,
    initialCount: car.like_count ?? 0,
  });
  const heartRef = useRef<View>(null);
  const { data: mods } = useGetCarModsPageQuery({ carId, page: 0, limit: 1 }, { skip: !carId });
  const { data: albums } = useGetCarGalleriesPageQuery({ carId, page: 0, limit: 1 }, { skip: !carId });
  const { data: tagged } = useGetCarTaggedPostsQuery({ carId, page: 0, limit: 1 }, { skip: !carId });
  type Count = { key: CarActivityTab; Icon: typeof Wrench; n: number; label: (n: number) => string };
  const counts: Count[] = ([
    { key: 'mods', Icon: Wrench, n: mods?.total ?? 0, label: (n: number) => (n === 1 ? 'mod' : 'mods') },
    { key: 'galleries', Icon: Images, n: albums?.total ?? 0, label: (n: number) => (n === 1 ? 'gallery' : 'galleries') },
    { key: 'posts', Icon: Tag, n: tagged?.total ?? 0, label: (n: number) => (n === 1 ? 'post' : 'posts') },
  ] as Count[]).filter((c) => c.n > 0).concat([
    { key: 'followers', Icon: Users, n: followers, label: (n: number) => (n === 1 ? 'follower' : 'followers') },
    { key: 'comments', Icon: MessageCircle, n: car.comment_count ?? 0, label: (n: number) => (n === 1 ? 'comment' : 'comments') },
  ]);
  const showLikes = like.mine || like.liked;
  return (
    <View style={[styles.column, style]} pointerEvents="box-none">
      {counts.map(({ key, Icon, n, label }) => (
        // Each opens the car's activity on its own tab.
        <SummaryTouchable key={key} onPress={(o) => onOpen(key, o)} style={styles.item} accessibilityLabel={`${n} ${label(n)}`}>
          {/* The number alone — the icon says what of; the label is for screen
              readers. A zero is left out, so the icon stands on its own. */}
          {n > 0 ? <Text style={styles.count}>{formatActionCount(n)}</Text> : null}
          <Icon size={COUNT_ICON} color={COLOR_WHITE} strokeWidth={1.8} />
        </SummaryTouchable>
      ))}
      <TouchableOpacity
        ref={heartRef}
        // Not yet liked: likes, on the spot. Liked (or yours): the likes tab.
        onPress={() => (showLikes ? measureOrigin(heartRef.current, (o) => onOpen('likes', o)) : like.toggle())}
        style={styles.item}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel={showLikes ? `${like.count} ${like.count === 1 ? 'like' : 'likes'}. See who liked this` : 'Like'}
      >
        {like.count > 0 ? <Text style={styles.count}>{formatActionCount(like.count)}</Text> : null}
        <AnimatedHeart
          liked={like.liked}
          size={COUNT_ICON}
          color={like.liked ? COLOR_LIKE : COLOR_WHITE}
          fill={like.liked ? COLOR_LIKE : 'transparent'}
          strokeWidth={1.8}
        />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  // PostActionRail's column, item and count, at the same corner of the photo
  // as the feed's rail.
  column: {
    position: 'absolute', right: 4, bottom: 4,
    alignItems: 'flex-end', gap: 4,
    paddingVertical: 8, paddingHorizontal: 4,
    shadowColor: COLOR_BLACK, shadowOpacity: 0.5, shadowRadius: 4, shadowOffset: { width: 0, height: 1 },
  },
  // The count to its icon's left, as the like count sits by the heart.
  item: { flexDirection: 'row', alignItems: 'center', gap: 5, padding: 4 },
  count: {
    color: COLOR_WHITE, fontSize: 12, fontFamily: FONT_INTER.bold,
    textShadowColor: 'rgba(0,0,0,0.6)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3,
  },
});
