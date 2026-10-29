import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { Text } from '@ors/kit';
import { Car, FileText } from 'lucide-react-native';
import Avatar from '../ui/Avatar';
import RegionBadge from '../ui/RegionBadge';
import { SummaryTouchable, type SummaryOrigin } from '../ui/SummaryModal';
import { regionForCityState } from '../../constants/regions';
import SteeringWheel from '../ui/SteeringWheel';
import FollowButton from '../social/FollowButton';
import { useGetCarsQuery, useGetPostsQuery } from '../../api/apiService';
import { useAppSelector } from '../../store/store';
import { useColors } from '../../hooks/useColors';
import { ss } from '../../styles/shared';
import type { User } from '../../types/api';
import { FONT_INTER } from '../../constants/fonts';
import { COLOR_BLACK, COLOR_GRAY_32, COLOR_PRO, COLOR_WHITE } from '../../constants/config';

/**
 * One member, in a list of them.
 *
 * The canonical row: pro members carry their ring and wheel, the counts say
 * what they bring to the place, and following is done from here rather than by
 * visiting the profile first. Anywhere a list of people appears, this is what a
 * line of it should look like.
 *
 * It lived inside the members screen until the dashboard's followers and
 * following lists needed it too — those were rendering a bare avatar and a
 * handle, with no way to follow anyone back from the one screen where you are
 * literally looking at people who followed you.
 */
export default function MemberRow({ user, onPress, isFollowing, showStats = true, plain = false, showRegion = true }: {
  user: User;
  /**
   * Handed the row's position on screen, for callers that open a summary
   * panel growing out of it. Callers that just navigate can ignore it.
   */
  onPress: (origin?: SummaryOrigin | null) => void;
  /**
   * From a caller's single bulk lookup. `undefined` means the button should go
   * and find out for itself.
   */
  isFollowing?: boolean;
  /**
   * Car and post counts cost a request each per row. A long list that only
   * needs names can turn them off.
   */
  showStats?: boolean;
  /**
   * No fill — the row sits straight on the page, parted from the next by a
   * near-black rule. For a long list on a screen of its own, where a filled
   * band per member was a column of grey slabs.
   */
  plain?: boolean;
  /**
   * The map of where they are. Off for a list already narrowed to near you,
   * where every row's map would light the same patch.
   */
  showRegion?: boolean;
}) {
  const colors = useColors();
  const { userInfo } = useAppSelector((s: any) => s.auth);

  const { data: carsData } = useGetCarsQuery(
    { user_id: user.user_id, limit: 1 },
    { skip: !user.user_id || !showStats },
  );
  const { data: postsData } = useGetPostsQuery(
    { user_id: user.user_id, limit: 1 },
    { skip: !user.user_id || !showStats },
  );
  const carCount = carsData?.total ?? 0;
  const postCount = postsData?.total ?? 0;

  const isPro = user.accountType === 'pro' || user.accountType === 'admin';

  return (
    <SummaryTouchable
      style={[
        ss.listRow,
        plain
          ? { borderBottomColor: COLOR_GRAY_32, borderBottomWidth: StyleSheet.hairlineWidth }
          : { backgroundColor: colors.card, borderBottomColor: colors.border },
      ]}
      onPress={onPress}
    >
      <View style={[styles.avatarWrap, isPro && styles.proRing]}>
        {/* Larger, and without the 1pt edge — the photo alone. */}
        <Avatar user={user} size={52} edge={false} />
        {isPro && (
          <View style={styles.proWheelBadge}>
            <SteeringWheel size={19} color={COLOR_BLACK} strokeWidth={2.5} />
          </View>
        )}
      </View>

      <View style={styles.info}>
        <View style={styles.nameRow}>
          <Text style={[styles.name, { color: colors.fg }]} numberOfLines={1}>{user.username}</Text>
          {/* Said in words beside the name, as well as by the ring and wheel. */}
          {isPro && (
            <View style={styles.proPill}>
              <Text style={styles.proPillText}>PRO</Text>
            </View>
          )}
        </View>
        {showStats && (
          <View style={styles.statsRow}>
            {/* Icon and number, no words — the glyphs say which is which, and
                in a darker grey they sit under the name rather than beside it. */}
            {carCount > 0 && (
              <View style={[styles.statChip, { backgroundColor: colors.segment }]} accessibilityLabel={`${carCount} ${carCount === 1 ? 'car' : 'cars'}`}>
                <Car size={15} color={COLOR_WHITE} />
                <Text style={styles.statText}>{carCount}</Text>
              </View>
            )}
            {postCount > 0 && (
              <View style={[styles.statChip, { backgroundColor: colors.segment }]} accessibilityLabel={`${postCount} ${postCount === 1 ? 'post' : 'posts'}`}>
                <FileText size={14} color={COLOR_WHITE} />
                <Text style={styles.statText}>{postCount}</Text>
              </View>
            )}
          </View>
        )}
      </View>

      {/* Where in the country they are, as a map — "Bothell, WA" only places
          someone if you already know where Bothell is. */}
      {/* No backdrop: a row is a plain dark ground, not a photo the map has
          to stand out from, and the pad only boxed it in. Larger to make up
          for the room the pad took. */}
      {showRegion && (
        <RegionBadge
          region={regionForCityState(user.cityState)?.key}
          size={42}
          backdrop={false}
        />
      )}

      {/* No follow button against your own row. An icon rather than a word:
          the same size either way, so a row doesn't jump when followed. */}
      {user.username && user.user_id !== userInfo?.user_id && (
        <FollowButton username={user.username} isFollowing={isFollowing} iconOnly />
      )}
    </SummaryTouchable>
  );
}

const styles = StyleSheet.create({
  info:      { flex: 1, minWidth: 0 },
  nameRow:   { flexDirection: 'row', alignItems: 'center', gap: 6 },
  // Gives way to the PRO pill, which keeps its size.
  name:      { flexShrink: 1, fontSize: 15, fontFamily: FONT_INTER.bold },
  proPill:   { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 999, backgroundColor: COLOR_PRO },
  proPillText: { fontSize: 9.5, fontFamily: FONT_INTER.extrabold, color: COLOR_BLACK, letterSpacing: 0.4 },
  statsRow:  { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 5 },
  // Each count in a small pill of its own, white on the segment grey.
  statChip:  { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  statText:  { fontSize: 12, fontFamily: FONT_INTER.semibold, color: COLOR_WHITE },
  avatarWrap:{ position: 'relative' },
  // Tight to the photo — no dark gap between the ring and the picture.
  proRing:   { borderWidth: 3.5, borderColor: COLOR_PRO, borderRadius: 999 },
  // Larger, and a touch further out past the ring's lower right.
  proWheelBadge: {
    position: 'absolute', bottom: -4, right: -4,
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: COLOR_PRO,
    alignItems: 'center', justifyContent: 'center',
  },
});
