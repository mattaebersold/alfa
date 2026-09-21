import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { Users, UserPlus, FileText, Car } from 'lucide-react-native';
import SummaryModal, { type SummaryOrigin } from '../ui/SummaryModal';
import Avatar from '../ui/Avatar';
import RegionBadge from '../ui/RegionBadge';
import { regionForCityState } from '../../constants/regions';
import Spinner from '../ui/Spinner';
import FollowButton from '../social/FollowButton';
import {
  useGetPublicUserByIdQuery,
  useGetUserFollowersQuery,
  useGetUserFollowingQuery,
  useGetPostsQuery,
  useGetCarsQuery,
} from '../../api/apiService';
import { useAppSelector } from '../../store/store';
import { useColors } from '../../hooks/useColors';
import { stripHtml } from '../../utils/text';
import { imageUrl } from '../../utils/image';
import SummaryMessageButton from './SummaryMessageButton';

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

export default function UserSummaryModal({
  userId,
  origin,
  onClose,
}: {
  /** The member to summarise. `null` closes the panel. */
  userId: string | null;
  /** The row that was tapped — the panel grows out of it. */
  origin?: SummaryOrigin | null;
  onClose: () => void;
}) {
  const colors = useColors();
  const nav = useNavigation<any>();
  const { userInfo } = useAppSelector((s) => s.auth);

  const { data: user, isLoading } = useGetPublicUserByIdQuery(userId ?? '', { skip: !userId });
  // Limit 1: only the totals are shown, and the lists themselves belong to the
  // profile page.
  const { data: followers } = useGetUserFollowersQuery({ userId: userId ?? '', limit: 1 }, { skip: !userId });
  const { data: following } = useGetUserFollowingQuery({ userId: userId ?? '', limit: 1 }, { skip: !userId });
  /**
   * How much this person has made. `limit: 1` on both — only the totals are
   * shown, and asking for a page of rows to count them would be a page of rows
   * thrown away.
   */
  const { data: postsData } = useGetPostsQuery({ user_id: userId ?? '', limit: 1 }, { skip: !userId });
  // A handful of the cars themselves, not just how many: "what do they drive"
  // is the question a summary gets asked most — by an admin weighing a join
  // request above all — and a count doesn't answer it.
  const { data: carsData }  = useGetCarsQuery({ user_id: userId ?? '', limit: GARAGE_PREVIEW }, { skip: !userId });
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
        // Reserved height rather than a bare spinner: the panel takes its size
        // from its content, so an unsized loading state opens as a sliver.
        <View style={styles.loading}><Spinner /></View>
      ) : (
        <View>
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

            {/* What's in the garage, by name. Chips rather than cards: this is
                a glance, and the profile behind "View Profile" has the photos. */}
            {garage.length > 0 && (
              <View style={styles.garage}>
                <Text style={[styles.garageLabel, { color: colors.grey }]}>In the garage</Text>
                <View style={styles.garageChips}>
                  {garage.map((car) => (
                    <View key={car.internal_id} style={[styles.garageChip, { backgroundColor: colors.segment }]}>
                      <Car size={11} color={colors.grey} />
                      <Text style={[styles.garageChipText, { color: colors.fg }]} numberOfLines={1}>
                        {[car.year, car.make, car.model].filter(Boolean).join(' ') || car.title || 'Car'}
                      </Text>
                    </View>
                  ))}
                  {(carsData?.total ?? 0) > garage.length && (
                    <View style={[styles.garageChip, { backgroundColor: colors.segment }]}>
                      <Text style={[styles.garageChipText, { color: colors.grey }]}>
                        +{(carsData?.total ?? 0) - garage.length} more
                      </Text>
                    </View>
                  )}
                </View>
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
        </View>
      )}
    </SummaryModal>
  );
}

/** Cars named in the summary before "+N more". */
const GARAGE_PREVIEW = 6;

const styles = StyleSheet.create({
  garage:      { gap: 7 },
  garageLabel: { fontSize: 11, fontWeight: '800', letterSpacing: 0.6, textTransform: 'uppercase' },
  garageChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  garageChip:  {
    flexDirection: 'row', alignItems: 'center', gap: 5, maxWidth: '100%',
    paddingHorizontal: 9, paddingVertical: 5, borderRadius: 999,
  },
  garageChipText: { fontSize: 12, fontWeight: '600', flexShrink: 1 },
  loading: { height: 200, alignItems: 'center', justifyContent: 'center' },
  // 3:1 — wide enough to read as a banner, short enough that it doesn't push
  // the name and the buttons off a short phone.
  bannerWrap: { width: '100%', aspectRatio: 3 / 1 },
  banner:     { width: '100%', height: '100%' },
  body:    { padding: 18, paddingBottom: 22, gap: 14 },

  head:     { flexDirection: 'row', alignItems: 'center', gap: 14 },
  headText: { flex: 1, alignItems: 'flex-start', gap: 4 },
  username: { fontSize: 19, fontWeight: '800', flexShrink: 1 },
  placeRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3 },
  place: { fontSize: 13, fontWeight: '600', flexShrink: 1 },
  // Neutral rather than brand-filled: a member number is a fact about the
  // account, not a status, and in the brand colour it read as loudly as the
  // username beside it.
  memberBadge: {
    paddingHorizontal: 7, paddingVertical: 2, borderRadius: 999,
    backgroundColor: '#8A8A8A',
  },
  memberBadgeText: { fontSize: 11, fontWeight: '500', color: '#000000' },

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
  statValue: { fontSize: 17, fontWeight: '800' },
  statLabel: { fontSize: 10, fontWeight: '600' },
  bio: { fontSize: 13, lineHeight: 19 },

  actions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
});
