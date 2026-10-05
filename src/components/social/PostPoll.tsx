import React, { useState } from 'react';
import { View, TouchableOpacity, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { Text } from '@ors/kit';
import * as Haptics from 'expo-haptics';
import { Check, Lock } from 'lucide-react-native';
import AvatarStack from '../ui/AvatarStack';
import OilSheen from '../ui/OilSheen';
import PollVotersSheet from './PollVotersSheet';
import { SummaryTouchable, type SummaryOrigin } from '../ui/SummaryModal';
import { useVotePollMutation, useUnvotePollMutation } from '../../api/apiService';
import { useColors } from '../../hooks/useColors';
import type { Post, PollOptionSummary } from '../../types/api';
import { COLOR_GRAY_14, COLOR_BLACK } from '../../constants/config';
import { FONT_INTER } from '../../constants/fonts';

/** Faces shown on an option before the rest collapse into "+N". */
const FACES_PER_OPTION = 5;
const FACE_SIZE = 20;
/** How much each face covers the one before — a tight stack, like the likers'. */
const FACE_OVERLAP = 0.4;
const CARD_RADIUS = 14;

/**
 * A post's poll — the question, then its options, in a card of its own on
 * the post: a dark ground with a faint oil-sheen film, set apart from the
 * words above and the photo below.
 *
 * The results are always up. Every option is a bar: its share as a fill
 * behind the row, the percentage at the end, and up to five of the people
 * who chose it. Tapping a row is the vote — no confirm, no submit button, the
 * bar moving is the receipt — and your pick carries a check. The faces open
 * the full list for that option in a panel over the card.
 *
 * (Results used to be withheld until you'd voted, against bandwagons. They
 * are shown up front now: a poll on a feed is read far more than it is
 * answered, and a row of blank buttons told the reader nothing.)
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
  const [votePoll] = useVotePollMutation();
  const [unvotePoll] = useUnvotePollMutation();
  // The option whose voters are open, and the faces the panel grew out of.
  const [voters, setVoters] = useState<{ option: PollOptionSummary; origin: SummaryOrigin | null } | null>(null);

  const poll = post.poll_summary;
  if (!poll || poll.options.length === 0) return null;

  const myVote = poll.my_option_id;
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
    <View style={style}>
    <View style={styles.card}>
      {/* The film, under everything: the cool tone whoever's looking — the
          poll is the post's, not the viewer's — and faint enough to be a
          tint, not a picture. */}
      {/* Blown up past the card, so the bands run wide across it rather
          than crowding in as they do on a button-sized film. The card clips. */}
      <View style={[StyleSheet.absoluteFill, styles.sheenScale]} pointerEvents="none">
        <OilSheen tone="cool" radius={0} opacity={0.2} />
      </View>
      <View style={styles.head}>
        {poll.question ? (
          <Text style={[styles.question, { color: colors.fg }]}>{poll.question}</Text>
        ) : <View style={styles.headSpacer} />}
        <Text style={[styles.votes, { color: colors.muted }]}>
          {poll.total_votes} {poll.total_votes === 1 ? 'vote' : 'votes'}
        </Text>
      </View>

      <View style={styles.options}>
      {poll.options.map((o) => {
        const mine = o.internal_id === myVote;
        const share = pct(o);
        return (
          <TouchableOpacity
            key={o.internal_id}
            style={styles.option}
            onPress={() => tap(o)}
            disabled={!canVote}
            activeOpacity={0.75}
            accessibilityRole="button"
            accessibilityState={{ selected: mine }}
            accessibilityLabel={`${o.label}, ${share} percent${canVote ? '. Tap to vote' : ''}`}
          >
            {/* The share, as a fill behind the row. Width is the percentage,
                so the bar is the number drawn — the text beside it is the
                same fact for people who want it exact. Nothing at zero: the
                row's own ground is what an unpicked option looks like. */}
            {share > 0 && (
              <View
                style={[styles.bar, { width: `${share}%` }]}
                pointerEvents="none"
              />
            )}
            <View style={styles.optionRow}>
              {mine && <Check size={14} color={colors.fg} strokeWidth={3} />}
              <Text
                style={[styles.optionLabel, { color: colors.fg }, mine && styles.optionLabelMine]}
                numberOfLines={2}
              >
                {o.label}
              </Text>
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
                    overlap={FACE_OVERLAP}
                  />
                </SummaryTouchable>
              )}
              <Text style={[styles.pct, { color: mine ? colors.fg : colors.muted }]}>{share}%</Text>
            </View>
          </TouchableOpacity>
        );
      })}
      </View>

      {poll.closed ? (
        <View style={styles.foot}>
          <Lock size={11} color={colors.grey} />
          <Text style={[styles.footText, { color: colors.grey }]}>Closed</Text>
        </View>
      ) : !myVote ? (
        <Text style={[styles.footText, styles.foot, { color: colors.grey }]}>Tap an option to vote</Text>
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
  // Its own card on the post: a step darker than the post's ground with the
  // sheen laid over it. No edge — the film is what sets it apart.
  card: {
    borderRadius: CARD_RADIUS,
    backgroundColor: COLOR_GRAY_14,
    paddingHorizontal: 10, paddingTop: 10, paddingBottom: 8,
    overflow: 'hidden',
  },
  // The question, and the tally at its right.
  head:       { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 8 },
  headSpacer: { flex: 1 },
  question:   { flex: 1, minWidth: 0, fontSize: 14, fontFamily: FONT_INTER.bold, lineHeight: 19 },
  votes:      { fontSize: 12, fontFamily: FONT_INTER.semibold, lineHeight: 19, flexShrink: 0 },
  options:  { gap: 5 },
  // A bar, not a button: no outline, the fill behind it is its shape. The
  // row is the sheen dimmed, the share is solid black on it.
  option: {
    borderRadius: 9,
    overflow: 'hidden',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  bar: { position: 'absolute', left: 0, top: 0, bottom: 0, borderRadius: 9, backgroundColor: COLOR_BLACK },
  sheenScale: { transform: [{ scale: 1.8 }] },
  optionRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 10, paddingVertical: 9,
  },
  optionLabel:     { flex: 1, minWidth: 0, fontSize: 14, fontFamily: FONT_INTER.semibold, lineHeight: 18 },
  optionLabelMine: { fontWeight: '800' },
  // Room for the last face's negative margin, so the stack ends inside the row.
  faces: { paddingRight: Math.round(FACE_SIZE * FACE_OVERLAP), paddingVertical: 1 },
  pct:   { fontSize: 13, fontFamily: FONT_INTER.extrabold, minWidth: 36, textAlign: 'right' },
  foot:     { flexDirection: 'row', alignItems: 'center', gap: 4, paddingTop: 8 },
  footText: { fontSize: 12, fontFamily: FONT_INTER.semibold },
});
