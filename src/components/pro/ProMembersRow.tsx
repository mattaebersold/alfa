import { useState } from 'react';
import { View, ScrollView, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Check, UserPlus } from 'lucide-react-native';
import { Text } from '../../theme/Text';
import Avatar from '../ui/Avatar';
import SearchPill from '../ui/SearchPill';
import RowEndSpacer from '../ui/RowEndSpacer';
import { useFollowUserMutation, useUnfollowUserMutation, useSearchProMembersQuery } from '../../api/apiService';
import { useDebounced } from '../../hooks/useDebounced';
import { useColors } from '../../hooks/useColors';
import { colors as palette } from '../../constants/colors';
import { COMMON_RADIUS, COLOR_BLACK, COLOR_GRAY_160, COLOR_WHITE, SURFACE_MID } from '../../constants/config';
import { FONT_INTER } from '../../constants/fonts';
import type { User } from '../../types/api';

const CARD_W = 120;
const AVATAR = 72;
const GAP = 10;
/** Below this a search matches half the club, so it doesn't run. */
const MIN_QUERY = 2;

/**
 * PRO › Home's "Find Pro Members": a search of every Pro member, its matches
 * opening under the field, then a row of the ones you don't follow yet. Each
 * has a + to follow them there and then (a tick once you do; again to take
 * it back), and a tap anywhere else opens them.
 */
export default function ProMembersRow({ members, inset }: { members: User[]; inset: number }) {
  const c = useColors();
  const [query, setQuery] = useState('');
  const settled = useDebounced(query.trim());
  const searching = query.trim().length >= MIN_QUERY;
  const { data, isFetching } = useSearchProMembersQuery(settled, { skip: settled.length < MIN_QUERY });
  const matches = searching && settled.length >= MIN_QUERY ? data?.members ?? [] : [];

  return (
    <View style={styles.wrap}>
      <Text style={[styles.heading, { color: c.fg, paddingHorizontal: inset }]}>Find Pro Members</Text>

      {/* The search, over the row while its matches are open. */}
      <View style={[styles.searchWrap, { paddingHorizontal: inset }, searching && styles.raised]}>
        {/* The browse screens' search pill. */}
        <SearchPill
          value={query}
          onChangeText={setQuery}
          onClear={() => setQuery('')}
          placeholder="Search Pro members"
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
          accessibilityLabel="Search Pro members"
          // On a row of its own, not sharing one — its own height, not a flex share.
          style={styles.searchPill}
        />
        {searching ? (
          <View style={[styles.results, { left: inset, right: inset, borderColor: c.borderDark }]}>
            {isFetching && !matches.length ? (
              <ActivityIndicator color={COLOR_GRAY_160} style={styles.loading} />
            ) : matches.length ? (
              matches.map((m, i) => (
                <ResultRow key={m.user_id} user={m} first={i === 0} />
              ))
            ) : settled.length >= MIN_QUERY ? (
              <Text style={styles.none}>No Pro members match.</Text>
            ) : null}
          </View>
        ) : null}
      </View>

      {members.length ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={[styles.row, { paddingLeft: inset }]}
          snapToInterval={CARD_W + GAP}
          snapToAlignment="start"
          decelerationRate="fast"
        >
          {members.map((m) => <MemberCard key={m.user_id} user={m} />)}
          <RowEndSpacer width={inset} />
        </ScrollView>
      ) : (
        <Text style={[styles.allFollowed, { paddingHorizontal: inset }]}>You follow every Pro member.</Text>
      )}
    </View>
  );
}

/** Follow and unfollow by username, straight away, put back if it fails. */
function useFollowToggle(user: User, initial = false) {
  const [following, setFollowing] = useState(initial);
  const [follow, { isLoading: f1 }] = useFollowUserMutation();
  const [unfollow, { isLoading: f2 }] = useUnfollowUserMutation();
  const busy = f1 || f2;
  const toggle = async () => {
    if (busy || !user.username) return;
    const next = !following;
    setFollowing(next);
    try {
      await (next ? follow : unfollow)(user.username).unwrap();
    } catch {
      setFollowing(!next);
    }
  };
  return { following, busy, toggle };
}

/** The + (or tick): Pro red, its icon black; white once you follow. */
function FollowButton({ user, following, busy, onPress, style }: {
  user: User; following: boolean; busy: boolean; onPress: () => void; style?: object;
}) {
  return (
    <TouchableOpacity
      style={[styles.follow, { backgroundColor: following ? COLOR_WHITE : palette.pro }, style]}
      onPress={onPress}
      disabled={busy}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={following ? `Unfollow @${user.username}` : `Follow @${user.username}`}
    >
      {following
        ? <Check size={15} color={COLOR_BLACK} strokeWidth={3} />
        : <UserPlus size={15} color={COLOR_BLACK} strokeWidth={2.4} />}
    </TouchableOpacity>
  );
}

function MemberCard({ user }: { user: User }) {
  const navigation = useNavigation<any>();
  const { following, busy, toggle } = useFollowToggle(user);
  return (
    <TouchableOpacity
      style={styles.card}
      onPress={() => navigation.navigate('UserDetail', { userId: user.user_id, username: user.username })}
      activeOpacity={0.85}
      accessibilityLabel={user.username}
    >
      <View>
        <Avatar user={user} size={AVATAR} edge={false} />
        <FollowButton user={user} following={following} busy={busy} onPress={toggle} style={styles.followOnAvatar} />
      </View>
      <Text style={styles.username} numberOfLines={1}>{user.username}</Text>
    </TouchableOpacity>
  );
}

function ResultRow({ user, first }: { user: User & { following?: boolean }; first: boolean }) {
  const navigation = useNavigation<any>();
  const c = useColors();
  const { following, busy, toggle } = useFollowToggle(user, !!user.following);
  return (
    <TouchableOpacity
      style={[styles.result, !first && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.borderDark }]}
      onPress={() => navigation.navigate('UserDetail', { userId: user.user_id, username: user.username })}
      activeOpacity={0.8}
      accessibilityLabel={user.username}
    >
      <Avatar user={user} size={32} edge={false} />
      <Text style={styles.resultName} numberOfLines={1}>{user.username}</Text>
      <FollowButton user={user} following={following} busy={busy} onPress={toggle} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingTop: 30 },
  heading: { fontSize: 17, fontFamily: FONT_INTER.bold, paddingBottom: 10 },
  searchWrap: { marginBottom: 12 },
  raised: { zIndex: 10, elevation: 10 },
  searchPill: { flex: 0 },
  // Opens under the field, over the row below it.
  results: {
    position: 'absolute', top: '100%', marginTop: 6,
    backgroundColor: SURFACE_MID, borderRadius: COMMON_RADIUS, borderWidth: 1, overflow: 'hidden',
    boxShadow: '0px 8px 24px rgba(0,0,0,0.5)',
  },
  result: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 9 },
  resultName: { flex: 1, color: COLOR_WHITE, fontSize: 14, fontFamily: FONT_INTER.semibold },
  loading: { marginVertical: 14 },
  none: { color: COLOR_GRAY_160, fontSize: 13, padding: 12 },
  row: { gap: GAP, paddingBottom: 4 },
  allFollowed: { color: COLOR_GRAY_160, fontSize: 13 },
  card: {
    width: CARD_W, alignItems: 'center',
    backgroundColor: SURFACE_MID, borderRadius: COMMON_RADIUS, paddingVertical: 16, paddingHorizontal: 8,
  },
  follow: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  // On the avatar's lower right.
  followOnAvatar: { position: 'absolute', right: -4, bottom: -4 },
  username: { color: COLOR_WHITE, fontSize: 13.5, fontFamily: FONT_INTER.bold, marginTop: 10, maxWidth: '100%' },
});
