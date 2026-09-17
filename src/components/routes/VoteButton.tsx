import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { ThumbsUp, ThumbsDown } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useUpvoteRouteMutation, useDownvoteRouteMutation } from '../../api/apiService';
import { useColors } from '../../hooks/useColors';
import { useAppSelector } from '../../store/store';
import type { RouteVote } from '../../types/api';
import { COMMON_RADIUS } from '../../constants/radius';

/**
 * The vote control for a route: thumbs up, the score, thumbs down.
 *
 * Voting works the way it does on a group discussion post — the same server
 * helper casts both — so pressing your current side again takes the vote back
 * and pressing the other side switches it. The score in the middle is upvotes
 * minus downvotes, which is what the "Top" sort orders by.
 *
 * It used to be a single thumbs-up stored as a Like. Routes can be liked for
 * real now, and a vote that was also a like meant one tap said two things, so
 * the vote moved onto the route and gained a down side.
 *
 * The press lands optimistically and then settles on the server's numbers —
 * someone else may have voted between render and tap. On failure it rolls back
 * rather than leaving a count that disagrees with the server.
 */
interface VoteButtonProps {
  routeId: string;
  /** Upvotes minus downvotes. */
  score: number;
  userVote?: RouteVote;
  /** Larger presentation for the detail screen. */
  large?: boolean;
}

/** What one press does to the score, given the vote it was pressed over. */
function nextState(score: number, mine: RouteVote, direction: 'up' | 'down') {
  const sign = direction === 'up' ? 1 : -1;
  if (mine === direction) return { score: score - sign, mine: null };
  if (mine) return { score: score + 2 * sign, mine: direction };
  return { score: score + sign, mine: direction };
}

export default function VoteButton({
  routeId,
  score,
  userVote = null,
  large = false,
}: VoteButtonProps) {
  const colors = useColors();
  const signedIn = useAppSelector((s) => !!s.auth.userInfo?.user_id);

  const [state, setState] = useState<{ score: number; mine: RouteVote }>({ score, mine: userVote });
  const [busy, setBusy] = useState(false);
  const [upvote] = useUpvoteRouteMutation();
  const [downvote] = useDownvoteRouteMutation();

  // A refetch (after a vote elsewhere, or a pull to refresh) is the truth again.
  useEffect(() => { setState({ score, mine: userVote }); }, [score, userVote]);

  const cast = async (direction: 'up' | 'down') => {
    if (busy) return;
    if (!signedIn) {
      Alert.alert('Sign in to vote', 'Voting on routes needs an account.');
      return;
    }
    const before = state;
    setState(nextState(before.score, before.mine, direction));
    setBusy(true);
    Haptics.selectionAsync().catch(() => {});

    try {
      const result = await (direction === 'up' ? upvote : downvote)(routeId).unwrap();
      setState({ score: result.score ?? result.vote_count, mine: result.user_vote });
    } catch (err: any) {
      setState(before);
      Alert.alert('Error', err?.data?.error || "Couldn't record that vote. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const iconSize = large ? 18 : 15;
  const upColor = state.mine === 'up' ? colors.primaryAlt : colors.fg;
  const downColor = state.mine === 'down' ? colors.red : colors.fg;
  const scoreColor = state.mine === 'up' ? colors.primaryAlt : state.mine === 'down' ? colors.red : colors.fg;

  return (
    <View style={[styles.pill, large && styles.pillLarge, { borderColor: colors.border }]}>
      <TouchableOpacity
        style={[styles.side, large && styles.sideLarge]}
        onPress={() => cast('up')}
        disabled={busy}
        hitSlop={{ top: 6, bottom: 6 }}
        activeOpacity={0.6}
        accessibilityRole="button"
        accessibilityState={{ selected: state.mine === 'up' }}
        accessibilityLabel={state.mine === 'up' ? 'Remove your upvote' : 'Upvote this route'}
      >
        <ThumbsUp
          size={iconSize}
          color={upColor}
          fill={state.mine === 'up' ? colors.primaryAlt : 'transparent'}
          strokeWidth={2.2}
        />
      </TouchableOpacity>

      <Text
        style={[large ? styles.scoreLarge : styles.score, { color: scoreColor }]}
        accessibilityLabel={`Score ${state.score}`}
      >
        {state.score}
      </Text>

      <TouchableOpacity
        style={[styles.side, large && styles.sideLarge]}
        onPress={() => cast('down')}
        disabled={busy}
        hitSlop={{ top: 6, bottom: 6 }}
        activeOpacity={0.6}
        accessibilityRole="button"
        accessibilityState={{ selected: state.mine === 'down' }}
        accessibilityLabel={state.mine === 'down' ? 'Remove your downvote' : 'Downvote this route'}
      >
        <ThumbsDown
          size={iconSize}
          color={downColor}
          fill={state.mine === 'down' ? colors.red : 'transparent'}
          strokeWidth={2.2}
        />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  // One outline around all three, so the score reads as belonging to the
  // thumbs either side of it rather than as a stray number.
  pill: {
    flexDirection: 'row', alignItems: 'center',
    height: 32, borderRadius: COMMON_RADIUS, borderWidth: 1.5,
  },
  pillLarge:  { height: 42 },
  side:       { height: '100%', paddingHorizontal: 9, alignItems: 'center', justifyContent: 'center' },
  sideLarge:  { paddingHorizontal: 13 },
  // A minimum width so the pill doesn't change size as the score gains a digit
  // or a minus sign under your thumb.
  score:      { minWidth: 16, textAlign: 'center', fontSize: 14, fontWeight: '800' },
  scoreLarge: { minWidth: 22, textAlign: 'center', fontSize: 16, fontWeight: '800' },
});
