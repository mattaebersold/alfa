import React, { useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useGetUsersQuery, useGetUserFollowingQuery } from '../../api/apiService';
import { useAppSelector } from '../../store/store';
import { useColors } from '../../hooks/useColors';
import Avatar from '../ui/Avatar';
import RowEndSpacer from '../ui/RowEndSpacer';

/**
 * "Suggested Members" — recent joiners you don't already follow.
 *
 * The filtering happens here rather than server-side: `api/users` already
 * answers newest-first, and your following list is small enough to hold in
 * memory, so a suggestion set is two cached queries and a set difference. No new
 * endpoint, and both queries are ones other screens already warm.
 */

const CARD_WIDTH = 96;
const CARD_GAP = 10;
const ROW_PAD = 12;
/** Pulled deep enough that filtering out everyone you follow still leaves some. */
const POOL_SIZE = 30;
const MAX_SUGGESTIONS = 10;

function MemberCard({ member, onPress }: { member: any; onPress: () => void }) {
  const colors = useColors();
  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.85}>
      <Avatar
        filename={member.gallery?.[0]?.filename ?? member.profilePicture}
        name={member.username ?? '?'}
        size={64}
      />
      <Text style={[styles.username, { color: colors.fg }]} numberOfLines={1}>
        @{member.username}
      </Text>
    </TouchableOpacity>
  );
}

export default function SuggestedMembersRow() {
  const navigation = useNavigation<any>();
  const colors = useColors();
  const { userInfo } = useAppSelector((s) => s.auth);
  const myId = userInfo?.user_id ?? '';

  const { data: usersData } = useGetUsersQuery({ limit: POOL_SIZE });
  const { data: followingData } = useGetUserFollowingQuery(
    { userId: myId, limit: 100 },
    { skip: !myId },
  );

  const suggestions = useMemo(() => {
    const pool = usersData?.entries ?? [];
    const followed = new Set((followingData?.entries ?? []).map((u) => u.user_id));
    return pool
      .filter((u) => u.user_id && u.user_id !== myId && !followed.has(u.user_id))
      .slice(0, MAX_SUGGESTIONS);
  }, [usersData, followingData, myId]);

  // Nothing to suggest is a normal state for someone who follows everyone —
  // render nothing rather than an empty shelf.
  if (!suggestions.length) return null;

  return (
    <View style={[styles.container, { backgroundColor: colors.bgDark, borderColor: colors.borderDark }]}>
      <Text style={[styles.heading, { color: colors.fg }]}>Suggested Members</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
      >
        {suggestions.map((member) => (
          <MemberCard
            key={member.user_id}
            member={member}
            onPress={() => navigation.navigate('UserDetail', {
              userId: member.user_id,
              username: member.username,
            })}
          />
        ))}
        <RowEndSpacer width={ROW_PAD} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  // Its own band — a lighter ground between two rules — so a suggestion shelf
  // reads as something the app is offering rather than as more feed content.
  // Each row bands itself instead of sharing a wrapper: either can come back
  // empty, and a shared one would leave the rules around nothing.
  container: {
    paddingTop: 14, paddingBottom: 12,
    marginTop: 12, marginBottom: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  heading:   { fontSize: 15, fontWeight: '800', letterSpacing: 0.3, paddingHorizontal: ROW_PAD, marginBottom: 10 },
  scroll:    { gap: CARD_GAP, paddingLeft: ROW_PAD },
  card:      { width: CARD_WIDTH, alignItems: 'center', gap: 7 },
  username:  { fontSize: 12, fontWeight: '600', maxWidth: CARD_WIDTH },
});
