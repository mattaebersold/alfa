import React, { useMemo } from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Text } from '../../../theme/Text';
import FindsFeed from '../../marketplace/FindsFeed';
import Avatar from '../../ui/Avatar';
import { useGetUserByIdQuery } from '../../../api/apiService';
import { useColors } from '../../../hooks/useColors';
import { COLOR_WHITE, COMMON_RADIUS, GUTTER } from '../../../constants/config';
import { FONT_INTER } from '../../../constants/fonts';
import type { SectionScreenProps } from '../types';

/**
 * Who presents PRO › Finds: @SamGullett (his account with the photo — he has
 * a second, CascadeConsulting). Named over the feed, with his photo.
 */
const PRESENTER_USER_ID = '41a27b176f5c4619881ac92076dabfa1';

/** The card's ground: a shade darker than the app's grey (#161616). */
const CARD_BG = '#111111';

/**
 * PRO › Finds — Facebook Marketplace listings shared in from outside the app
 * (see components/marketplace/FindsFeed and horacio's
 * controllers/marketplaceFindController). Its own option rather than a
 * corner of PRO › Marketplace, which is ORS's own listings: these aren't
 * listings anyone here posted, and can't be messaged about here.
 */
export default function FindsScreen({ headerPad, onScroll, bottomPad }: SectionScreenProps) {
  const contentStyle = useMemo(
    () => ({ paddingTop: headerPad, paddingBottom: bottomPad }),
    [headerPad, bottomPad],
  );
  return (
    <FindsFeed
      onScroll={onScroll}
      contentContainerStyle={contentStyle}
      refreshOffset={headerPad}
      header={<PresentedBy />}
    />
  );
}

/**
 * The feed's heading, as a card of its own — bordered, held in at the
 * gutters, a shade darker than the app's grey: "Northwest marketplace finds"
 * over "presented by SamGullett", in white on the left, his photo on the right. The
 * whole card opens his profile. Its height is kept while he loads.
 */
function PresentedBy() {
  const colors = useColors();
  const nav = useNavigation<any>();
  const { data: user } = useGetUserByIdQuery(PRESENTER_USER_ID);
  const label = `Northwest marketplace finds presented by ${user?.username ?? ''}`.trim();
  return (
    <TouchableOpacity
      style={[styles.card, { borderColor: colors.border }]}
      onPress={user ? () => nav.navigate('UserDetail', { userId: user.user_id, username: user.username }) : undefined}
      disabled={!user}
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Text style={styles.label} numberOfLines={2}>
        Northwest marketplace finds{'\n'}presented by{user ? <Text style={styles.username}> {user.username}</Text> : null}
      </Text>
      {user ? <Avatar user={user} size={AVATAR} /> : <View style={styles.avatarSpace} />}
    </TouchableOpacity>
  );
}

/** His photo, a step up from a byline's. */
const AVATAR = 42;

const styles = StyleSheet.create({
  // Words left, the photo right.
  card: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12,
    marginHorizontal: GUTTER, marginBottom: 12,
    paddingHorizontal: 14, paddingVertical: 10,
    borderWidth: 1, borderRadius: COMMON_RADIUS,
    backgroundColor: CARD_BG,
  },
  label: { flex: 1, fontSize: 13.5, lineHeight: 19, fontFamily: FONT_INTER.semibold, color: COLOR_WHITE },
  username: { fontFamily: FONT_INTER.bold },
  avatarSpace: { width: AVATAR, height: AVATAR },
});
