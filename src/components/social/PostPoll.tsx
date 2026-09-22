import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Check, Lock } from 'lucide-react-native';
import AvatarStack from '../ui/AvatarStack';
import PollVotersSheet from './PollVotersSheet';
import { SummaryTouchable, type SummaryOrigin } from '../ui/SummaryModal';
import { useVotePollMutation, useUnvotePollMutation } from '../../api/apiService';
import { useAppSelector } from '../../store/store';
import { useColors } from '../../hooks/useColors';
import { useBrandColor } from '../../hooks/useBrandColor';
import type { Post, PollOptionSummary } from '../../types/api';
import { COMMON_RADIUS } from '../../constants/radius';

/** Faces shown on an option before the rest collapse into "+N". */
const FACES_PER_OPTION = 5;
const FACE_SIZE = 20;

/**
 * A post's poll — the question, then its options.
 *
 * Two faces. Before you've voted the options are plain rows, and tapping one
 * is the vote: no confirm, no submit button, the bar filling is the receipt.
 * Once you have — or once the poll is closed, or when it's your own — every
 * option shows its share as a filled bar and a percentage, your pick carries
 * a check, and up to five of the people who chose it sit at the row's end.
 * The faces open the full list for that option in a panel over the card.
 *
 * Results are withheld until you vote on purpose: seeing the tally first is
 * how a poll turns into a bandwagon. The author is the exception, since
 * asking them to vote on their own question to see the answer is absurd.
 *
 * Everything it draws comes off `post.poll_summary`, which the vote mutations
 * patch in the cache (optimistically, then with the server's word) — so this
 * holds no tally of its own and can't drift from the copy a scroll away.
 */
export default function PostPoll({ post, style }: {
  post: Post;
  /** Outer spacing, which differs between the feed card and the detail sheet. */
  style?: StyleProp<ViewStyle>;
}) {
  const colors = useColors();
  const brand = useBrandColor();
  const { userInfo } = useAppSelector((s) => s.auth);
  const [votePoll] = useVotePollMutation();
  const [unvotePoll] = useUnvotePollMutation();
  // The option whose voters are open, and the faces the panel grew out of.
  const [voters, setVoters] = useState<{ option: PollOptionSummary; origin: SummaryOrigin | null } | null>(null);

  const poll = post.poll_summary;
  if (!poll || poll.options.length === 0) return null;

  const isAuthor = !!userInfo?.user_id && userInfo.user_id === post.user_id;
  const myVote = poll.my_option_id;
  const showResults = poll.closed || !!myVote || isAuthor;
  // Whether a cast vote can be moved. A refused change (409 `vote_locked`)
  // is undone by the mutation, so a stale summary still ends up right.
  const canChange = poll.allow_change !== false;
  const canVote = !poll.closed && (!myVote || canChange);
  // An anonymous poll sends no voters, so there's nothing to stack or list.
  const showFaces = !poll.anonymous;

  const tap = (option: PollOptionSummary) => {
    if (!canVote) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (option.internal_id === myVote) {
      // Tapping your own pick again takes it back.
      unvotePoll({ postId: post.internal_id });
    } else {
      votePoll({ postId: post.internal_id, option_id: option.internal_id });
    }
  };

  const pct = (o: PollOptionSummary) =>
    poll.total_votes > 0 ? Math.round((o.count / poll.total_votes) * 100) : 0;

  return (
    <View style={[styles.wrap, style]}>
      {poll.question ? (
        <Text style={[styles.question, { color: colors.fg }]}>{poll.question}</Text>
      ) : null}

      {poll.options.map((o) => {
        const mine = o.internal_id === myVote;
        const share = pct(o);
        return (
          <TouchableOpacity
            key={o.internal_id}
            style={[
              styles.option,
              { backgroundColor: colors.inputBg, borderColor: colors.inputBorder },
              showResults && mine && { borderColor: brand },
            ]}
            onPress={() => tap(o)}
            disabled={!canVote}
            activeOpacity={0.75}
            accessibilityRole="button"
            accessibilityState={{ selected: mine }}
            accessibilityLabel={showResults ? `${o.label}, ${share} percent` : `Vote ${o.label}`}
          >
            {/* The share, as a fill behind the row. Width is the percentage,
                so the bar is the number drawn — the text beside it is the
                same fact for people who want it exact. */}
            {showResults && (
              <View
                style={[styles.bar, { width: `${share}%`, backgroundColor: brand, opacity: mine ? 0.32 : 0.16 }]}
                pointerEvents="none"
              />
            )}
            <View style={styles.optionRow}>
              {showResults && mine && (
                <Check size={14} color={brand} strokeWidth={3} />
              )}
              <Text
                style={[styles.optionLabel, { color: colors.fg }, showResults && mine && styles.optionLabelMine]}
                numberOfLines={2}
              >
                {o.label}
              </Text>
              {showResults && (
                <>
                  {showFaces && o.voter_total > 0 && (
                    // The faces are the way into the list, so they're the
                    // pressable part — the row itself is still the vote.
                    <SummaryTouchable
                      onPress={(origin) => setVoters({ option: o, origin })}
                      accessibilityLabel={`See who voted ${o.label}`}
                      // Room for the stack's trailing overlap, which AvatarStack
                      // leaves as a negative margin on its last face.
                      style={styles.faces}
                    >
                      <AvatarStack
                        users={o.voters}
                        total={o.voter_total}
                        max={FACES_PER_OPTION}
                        size={FACE_SIZE}
                        ringColor={colors.inputBg}
                      />
                    </SummaryTouchable>
                  )}
                  <Text style={[styles.pct, { color: mine ? colors.fg : colors.muted }]}>{share}%</Text>
                </>
              )}
            </View>
          </TouchableOpacity>
        );
      })}

      <View style={styles.foot}>
        <Text style={[styles.footText, { color: colors.grey }]}>
          {poll.total_votes} {poll.total_votes === 1 ? 'vote' : 'votes'}
        </Text>
        {poll.closed ? (
          <View style={styles.closed}>
            <Lock size={11} color={colors.grey} />
            <Text style={[styles.footText, { color: colors.grey }]}>Closed</Text>
          </View>
        ) : showResults && myVote && canChange ? (
          <Text style={[styles.footText, { color: colors.grey }]}>Tap another to change</Text>
        ) : null}
      </View>

      <PollVotersSheet
        option={voters?.option ?? null}
        visible={voters !== null}
        origin={voters?.origin}
        onClose={() => setVoters(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap:     { gap: 6 },
  question: { fontSize: 14, fontWeight: '700', lineHeight: 19, marginBottom: 2 },
  option: {
    borderRadius: COMMON_RADIUS, borderWidth: 1,
    overflow: 'hidden',
  },
  bar: { position: 'absolute', left: 0, top: 0, bottom: 0 },
  optionRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 12, paddingVertical: 10,
  },
  optionLabel:     { flex: 1, minWidth: 0, fontSize: 14, fontWeight: '600', lineHeight: 18 },
  optionLabelMine: { fontWeight: '800' },
  // The ring adds 2px a side to each face, so the row leaves room for it.
  faces: { paddingRight: Math.round(FACE_SIZE * 0.22) + 2, paddingVertical: 2 },
  pct:   { fontSize: 13, fontWeight: '800', minWidth: 36, textAlign: 'right' },
  foot:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 2 },
  footText: { fontSize: 12, fontWeight: '600' },
  closed:   { flexDirection: 'row', alignItems: 'center', gap: 4 },
});
