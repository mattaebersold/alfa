import React, { useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { ThumbsUp, ThumbsDown } from 'lucide-react-native';
import {
  useUpvoteGroupDiscussionPostMutation,
  useDownvoteGroupDiscussionPostMutation,
  useUpvoteGroupResourceMutation,
  useDownvoteGroupResourceMutation,
  useUpvoteGroupNewsMutation,
  useDownvoteGroupNewsMutation,
} from '../../api/apiService';
import { useColors } from '../../hooks/useColors';
import { useAppSelector } from '../../store/store';

/**
 * The thumbs on group discussions, resources and news.
 *
 * They were broken three different ways: on the discussion list they were
 * plain icons with no handler at all, resources and news had no vote controls
 * anywhere, and nothing read back *your* vote — so since the server toggles, a
 * second press on the same thumb took the vote away and the count went down,
 * which looked like the count was simply wrong.
 *
 * One component for all three now. It colours the side you voted, and settles
 * on the counts the server sends back rather than guessing at them.
 */

export type VoteKind = 'discussion' | 'resource' | 'news';

interface Props {
  kind: VoteKind;
  internal_id: string;
  group_id: string;
  upvotes?: number;
  downvotes?: number;
  votes?: { user_id: string; vote_type: 'up' | 'down' }[];
  size?: number;
}

export default function GroupVoteButtons({
  kind, internal_id, group_id, upvotes = 0, downvotes = 0, votes, size = 15,
}: Props) {
  const colors = useColors();
  const me = useAppSelector((s) => s.auth.userInfo?.user_id);

  const [upDiscussion] = useUpvoteGroupDiscussionPostMutation();
  const [downDiscussion] = useDownvoteGroupDiscussionPostMutation();
  const [upResource] = useUpvoteGroupResourceMutation();
  const [downResource] = useDownvoteGroupResourceMutation();
  const [upNews] = useUpvoteGroupNewsMutation();
  const [downNews] = useDownvoteGroupNewsMutation();

  const up = kind === 'discussion' ? upDiscussion : kind === 'resource' ? upResource : upNews;
  const down = kind === 'discussion' ? downDiscussion : kind === 'resource' ? downResource : downNews;

  /**
   * The server's answer, once we have one.
   *
   * Held locally so the thumb responds to the press rather than waiting on a
   * refetch; the query's own data wins again on the next load.
   */
  const [local, setLocal] = useState<{
    upvotes: number; downvotes: number; mine: 'up' | 'down' | null;
  } | null>(null);
  const [busy, setBusy] = useState(false);

  const mine = useMemo(() => {
    if (local) return local.mine;
    if (!me) return null;
    return votes?.find((v) => v.user_id === me)?.vote_type ?? null;
  }, [local, me, votes]);

  const counts = local ?? { upvotes, downvotes };

  const cast = async (direction: 'up' | 'down') => {
    if (busy || !internal_id) return;
    setBusy(true);
    try {
      const fn = direction === 'up' ? up : down;
      const result = await fn({ internal_id, group_id }).unwrap();
      setLocal({
        upvotes: result.upvotes,
        downvotes: result.downvotes,
        mine: result.user_vote,
      });
    } catch (err: any) {
      // Silence here is what made this look broken in the first place.
      Alert.alert('Error', err?.data?.error || "Couldn't record that vote. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.row}>
      <TouchableOpacity
        style={styles.side}
        onPress={() => cast('up')}
        disabled={busy}
        hitSlop={8}
        activeOpacity={0.6}
      >
        <ThumbsUp
          size={size}
          color={mine === 'up' ? colors.primaryAlt : colors.grey}
          fill={mine === 'up' ? colors.primaryAlt : 'transparent'}
        />
        <Text style={[styles.num, { color: mine === 'up' ? colors.primaryAlt : colors.grey }]}>
          {counts.upvotes}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.side}
        onPress={() => cast('down')}
        disabled={busy}
        hitSlop={8}
        activeOpacity={0.6}
      >
        <ThumbsDown
          size={size}
          color={mine === 'down' ? colors.red : colors.grey}
          fill={mine === 'down' ? colors.red : 'transparent'}
        />
        <Text style={[styles.num, { color: mine === 'down' ? colors.red : colors.grey }]}>
          {counts.downvotes}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  side: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  num: { fontSize: 12, fontWeight: '700' },
});
