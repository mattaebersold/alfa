import React, { useRef } from 'react';
import { View, StyleSheet } from 'react-native';
import { Text } from '@ors/kit';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { Users, UserPlus, FileText, Car } from 'lucide-react-native';
import GarageDoor from '../ui/GarageDoor';
import GarageThumbs from '../cars/GarageThumbs';
import SummaryModal, { type SummaryOrigin } from '../ui/SummaryModal';
import Avatar from '../ui/Avatar';
import RegionBadge from '../ui/RegionBadge';
import { regionForCityState } from '../../constants/regions';
import { Skeleton, SkeletonLine, FadeIn } from '../ui/Skeleton';
import FollowButton from '../social/FollowButton';
import {
  useGetPublicUserByIdQuery,
  useGetUserFollowersQuery,
  useGetUserFollowingQuery,
  useGetPostsQuery,
  useGetCarsQuery,
} from '../../api/apiService';
import { useAppSelector } from '../../store/store';
import type { User } from '../../types/api';
import { useColors } from '../../hooks/useColors';
import { stripHtml } from '../../utils/text';
import { imageUrl } from '../../utils/image';
import SummaryMessageButton from './SummaryMessageButton';
import { FONT_INTER } from '../../constants/fonts'
import { COLOR_BLACK, COLOR_GRAY_138 } from '../../constants/config';

/**
 * Enough of a member to decide whether you want their profile.
 *
 * A group's roster is a list of people you mostly don't know yet, and the
 * questions it raises — who is this, are they worth following, can I message
 * them — all used to cost a screen push or a menu. This answers them in place.
 *
 * The panel, its animation and its "view more" button are SummaryModal's; this
 * only supplies what a member's summary is.
 */
/**
 * One count.
 *
 * Number over word rather than an icon beside a bare figure: four unlabelled
 * numbers behind four small glyphs asked you to decode which was which, and
 * "24 / Posts" needs no decoding.
 */
function Stat({ Icon, value, label, colors }: {
  Icon: React.ComponentType<{ size: number; color: string }>;
  value: number;
  label: string;
  colors: any;
}) {
  return (
    <View style={[styles.stat, { backgroundColor: colors.segment }]}>
      <Icon size={13} color={colors.grey} />
      <Text style={[styles.statValue, { color: colors.fg }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: colors.grey }]} numberOfLines={1}>{label}</Text>
    </View>
  );
}

/** What a card already knows about a member, for the panel to open with. */
export type UserPreview = Pick<User, 'user_id' | 'username' | 'gallery' | 'profilePicture' | 'avatarColor' | 'accountType' | 'cityState'>;

export const userPreview = (user: Partial<User> | null | undefined): UserPreview | null =>
  user && user.user_id ? {
    user_id: user.user_id, username: user.username, gallery: user.gallery, profilePicture: user.profilePicture,
    avatarColor: user.avatarColor, accountType: user.accountType, cityState: user.cityState,
  } as UserPreview : null;

export default function UserSummaryModal({
  userId,
  origin,
  preview,
  onClose,
}: {
  /** The member to summarise. `null` closes the panel. */
  userId: string | null;
  /** The row that was tapped — the panel grows out of it. */
  origin?: SummaryOrigin | null;
  /** What the tapped card already knew — shown until the fetch lands. */
  preview?: UserPreview | null;
  onClose: () => void;
}) {
  const colors = useColors();
  const nav = useNavigation<any>();
  const { userInfo } = useAppSelector((s) => s.auth);

  // The id goes null the moment the close begins, but the panel is still
  // fading for 180ms: keep the last one so the content doesn't flip to a
  // spinner on its way out.
  const lastUserId = useRef<string | null>(null);
  if (userId) lastUserId.current = userId;
  const shownUserId = userId ?? lastUserId.current;
  const { data: user, isLoading } = useGetPublicUserByIdQuery(shownUserId ?? '', { skip: !shownUserId });
  // Limit 1: only the totals are shown, and the lists themselves belong to the
  // profile page.
  const { data: followers } = useGetUserFollowersQuery({ userId: shownUserId ?? '', limit: 1 }, { skip: !shownUserId });
  const { data: following } = useGetUserFollowingQuery({ userId: shownUserId ?? '', limit: 1 }, { skip: !shownUserId });
  /**
   * How much this person has made. `limit: 1` on both — only the totals are
   * shown, and asking for a page of rows to count them would be a page of rows
   * thrown away.
   */
  const { data: postsData } = useGetPostsQuery({ user_id: shownUserId ?? '', limit: 1 }, { skip: !shownUserId });
  // A handful of the cars themselves, not just how many: "what do they drive"
  // is the question a summary gets asked most — by an admin weighing a join
  // request above all — and a count doesn't answer it.
  const { data: carsData }  = useGetCarsQuery({ user_id: shownUserId ?? '', limit: GARAGE_PREVIEW }, { skip: !shownUserId });
  const garage = carsData?.entries ?? [];

  const isMe = !!user && user.user_id === userInfo?.user_id;
  const bio = user?.bio ? stripHtml(user.bio) : '';
  const bannerUri = user?.banners?.[0]?.filename ? imageUrl(user.banners[0].filename) : null;

  return (
    <SummaryModal
      visible={!!userId}
      onClose={onClose}
      origin={origin}
      actionLabel="View Profile"
      onAction={userId ? () => nav.navigate('UserDetail', { userId, username: user?.username }) : undefined}
    >
      {isLoading || !user ? (
        // Their avatar and handle from the card that was tapped, with grey
        // stand-ins for the counts and the garage underneath.
        <View>
          <View style={styles.body}>
            <View style={styles.head}>
              {preview ? <Avatar user={preview as any} size={72} /> : <Skeleton width={72} height={72} radius={36} />}
              <View style={styles.headText}>
                {preview?.username
                  ? <Text style={[styles.username, { color: colors.fg }]} numberOfLines={1}>@{preview.username}</Text>
                  : <SkeletonLine width="55%" height={18} />}
                <SkeletonLine width="40%" height={12} style={{ marginTop: 8 }} />
              </View>
            </View>
            <View style={styles.placeholderStats}>
              <Skeleton width={64} height={40} radius={12} />
              <Skeleton width={64} height={40} radius={12} />
              <Skeleton width={64} height={40} radius={12} />
            </View>
            <SkeletonLine width="90%" style={{ marginTop: 14 }} />
            <SkeletonLine width="65%" style={{ marginTop: 10 }} />
          </View>
        </View>
      ) : (
        <FadeIn>
          {/* Their banner, where they have one — it's the thing they chose to
              represent themselves with, and the panel opened with an avatar on
              a flat grey instead. */}
          {bannerUri ? (
            <View style={styles.bannerWrap}>
              <Image source={{ uri: bannerUri }} style={styles.banner} contentFit="cover" />
              <LinearGradient
                colors={['transparent', 'rgba(0,0,0,0.65)']}
                locations={[0.4, 1]}
                style={StyleSheet.absoluteFill}
                pointerEvents="none"
              />
            </View>
          ) : null}

          <View style={styles.body}>
            <View style={styles.head}>
              <Avatar user={user} size={72} />
              <View style={styles.headText}>
                {/* The member number leads. It's the one fact that doesn't
                    change and isn't a count — a quiet line above the name
                    rather than a chip competing with it on the same line. */}
                {user.memberNumber ? (
                  <View style={styles.memberBadge}>
                    <Text style={styles.memberBadgeText}>#{user.memberNumber}</Text>
                  </View>
                ) : null}
                {/* The handle alone. A real name under it was a second name
                    for the same person in a panel that has one line to say
                    who they are. */}
                <Text style={[styles.username, { color: colors.fg }]} numberOfLines={1}>
                  @{user.username}
                </Text>
                {/* Where they are, said twice over: the town in words, and
                    the part of the country as a shape. Neither means much to
                    a stranger on its own. */}
                {user.cityState ? (
                  <View style={styles.placeRow}>
                    <RegionBadge region={regionForCityState(user.cityState)?.key} size={34} />
                    <Text style={[styles.place, { color: colors.grey }]} numberOfLines={1}>
                      {user.cityState}
                    </Text>
                  </View>
                ) : null}
              </View>
            </View>

            {/* Counts, on a row of their own above the bio.
                Tucked beside the avatar they were four chips sharing half the
                panel's width with a name, small enough to be decoration. What
                someone has made is most of what the panel is for, so it gets
                the full width and a size you can read. */}
            <View style={styles.stats}>
              <Stat Icon={Users}    value={followers?.total ?? 0} label="Followers" colors={colors} />
              <Stat Icon={UserPlus} value={following?.total ?? 0} label="Following" colors={colors} />
              <Stat Icon={FileText} value={postsData?.total ?? 0} label="Posts"     colors={colors} />
              <Stat Icon={Car}      value={carsData?.total ?? 0}  label="Cars"      colors={colors} />
            </View>

            {bio ? (
              <Text style={[styles.bio, { color: colors.muted }]} numberOfLines={6}>{bio}</Text>
            ) : null}

            {/* What's in the garage, as the header shows yours: the door, and
                the cars' own photos overlapping beside it. Larger here, and
                not a button — it's a glance; the profile behind "View Profile"
                is where the cars are. */}
            {garage.length > 0 && (
              <View style={styles.garage} accessibilityLabel={`${carsData?.total ?? garage.length} cars in the garage`}>
                <GarageDoor size={28} color={colors.fg} strokeWidth={2.2} />
                <GarageThumbs cars={garage} max={3} size={38} total={carsData?.total} />
              </View>
            )}

          {/* Nothing to follow or send when it's you. */}
          {!isMe && (
            <View style={styles.actions}>
              {/* Both buttons in the same grey — they're a pair of things you
                  can do to this person, not one offer and one afterthought.
                  The label still says which state Follow is in. */}
              {user.username ? <FollowButton username={user.username} variant="secondary" /> : null}
              <SummaryMessageButton userId={user.user_id} username={user.username} />
            </View>
          )}
          </View>
        </FadeIn>
      )}
    </SummaryModal>
  );
}

/** Cars named in the summary before "+N more". */
const GARAGE_PREVIEW = 6;

const styles = StyleSheet.create({
  garage:      { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 2 },
  placeholderStats: { flexDirection: 'row', gap: 12, marginTop: 16 },
  // 3:1 — wide enough to read as a banner, short enough that it doesn't push
  // the name and the buttons off a short phone.
  bannerWrap: { width: '100%', aspectRatio: 3 / 1 },
  banner:     { width: '100%', height: '100%' },
  body:    { padding: 18, paddingBottom: 22, gap: 14 },

  head:     { flexDirection: 'row', alignItems: 'center', gap: 14 },
  headText: { flex: 1, alignItems: 'flex-start', gap: 4 },
  username: { fontSize: 19, fontFamily: FONT_INTER.bold, flexShrink: 1 },
  placeRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3 },
  place: { fontSize: 13, fontFamily: FONT_INTER.semibold, flexShrink: 1 },
  // Neutral rather than brand-filled: a member number is a fact about the
  // account, not a status, and in the brand colour it read as loudly as the
  // username beside it.
  memberBadge: {
    paddingHorizontal: 7, paddingVertical: 2, borderRadius: 999,
    backgroundColor: COLOR_GRAY_138,
  },
  memberBadgeText: { fontSize: 11, fontFamily: FONT_INTER.medium, color: COLOR_BLACK },

  // Four equal cells across the panel. `flex: 1` rather than sizing to their
  // contents, so a member with 1 follower and 1,204 posts still gets an even
  // row rather than one wide cell and three narrow ones.
  stats: { flexDirection: 'row', gap: 8 },
  stat: {
    flex: 1, minWidth: 0,
    alignItems: 'center', gap: 2,
    paddingVertical: 10, paddingHorizontal: 4,
    borderRadius: 12,
  },
  statValue: { fontSize: 17, fontFamily: FONT_INTER.bold },
  statLabel: { fontSize: 10, fontFamily: FONT_INTER.semibold },
  bio: { fontSize: 13, lineHeight: 19 },

  actions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
});
