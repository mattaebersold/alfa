import React, { useState } from 'react';
import { View, TouchableOpacity, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { Text } from '@ors/kit';
import * as Haptics from 'expo-haptics';
import { Lock } from 'lucide-react-native';
import AvatarStack from '../ui/AvatarStack';
import PollVotersSheet from './PollVotersSheet';
import { SummaryTouchable, type SummaryOrigin } from '../ui/SummaryModal';
import { useVotePollMutation, useUnvotePollMutation } from '../../api/apiService';
import { useColors } from '../../hooks/useColors';
import type { Post, PollOptionSummary } from '../../types/api';
import { COLOR_PRO, COLOR_BLACK } from '../../constants/config';
import { FONT_INTER } from '../../constants/fonts';

/** Faces shown on an option before the rest collapse into "+N". */
const FACES_PER_OPTION = 5;
const FACE_SIZE = 20;
/** How much each face covers the one before — a tight stack, like the likers'. */
const FACE_OVERLAP = 0.4;

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
  /** Each option row's width — the black copy of its words is laid out at it. */
  const [rowW, setRowW] = useState<Record<string, number>>({});
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
      <View style={styles.head}>
        {/* The question, set apart from the post's own title above it: the
            Pro red, as its bars are, and a lighter weight. */}
        {poll.question ? (
          <Text style={[styles.question, { color: COLOR_PRO }]}>{poll.question}</Text>
        ) : <View style={styles.headSpacer} />}
      </View>

      <View style={styles.options}>
      {poll.options.map((o) => {
        const mine = o.internal_id === myVote;
        const share = pct(o);
        /** The row's words and tally, in one ink — drawn twice, see the bar. */
        const content = (ink: string, live: boolean) => (
          <View style={styles.optionRow}>
            <Text
              style={[styles.optionLabel, { color: ink }, mine && styles.optionLabelMine]}
              numberOfLines={2}
            >
              {o.label}
            </Text>
            {/* The faces and the share together, at the row's end. */}
            <View style={styles.tally}>
              {showFaces && o.voter_total > 0 && (
                // The faces are the way into the list, so they're the
                // pressable part — the row itself is still the vote.
                <SummaryTouchable
                  onPress={(origin) => setVoters({ option: o, origin })}
                  disabled={!live}
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
              {/* The share in a small black bubble — the same on the bar
                  and off it, so it doesn't take the row's ink. */}
              <View style={styles.pctBubble}>
                <Text style={styles.pct}>{share}%</Text>
              </View>
            </View>
          </View>
        );
        return (
          <TouchableOpacity
            key={o.internal_id}
            style={styles.option}
            onPress={() => tap(o)}
            onLayout={(e) => {
              const w = e.nativeEvent.layout.width;
              setRowW((prev) => (prev[o.internal_id] === w ? prev : { ...prev, [o.internal_id]: w }));
            }}
            disabled={!canVote}
            activeOpacity={0.75}
            accessibilityRole="button"
            accessibilityState={{ selected: mine }}
            accessibilityLabel={`${o.label}, ${share} percent${canVote ? '. Tap to vote' : ''}`}
          >
            {content(colors.fg, true)}
            {/* The share, as a solid Pro red fill. Width is the percentage, so
                the bar is the number drawn. Over the row, carrying the same
                words in black clipped to its width — so wherever the bar is,
                the text on it is black, and past its end it's white again.
                Taps fall through to the row and its faces underneath. */}
            {share > 0 && (
              <View style={[styles.bar, { width: `${share}%` }]} pointerEvents="none">
                {rowW[o.internal_id] ? (
                  <View style={[styles.barInk, { width: rowW[o.internal_id] }]}>
                    {content(COLOR_BLACK, false)}
                  </View>
                ) : null}
              </View>
            )}
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
  // No panel of its own: the question and the options sit straight on the
  // post — a card inside the card read as a box in a box. The option rows
  // are what give it shape. The host's padding sets the sides.
  card: { paddingTop: 4 },
  // The question, and the tally at its right.
  head:       { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 8 },
  headSpacer: { flex: 1 },
  question:   { flex: 1, minWidth: 0, fontSize: 14, fontFamily: FONT_INTER.semibold, lineHeight: 19 },
  options:  { gap: 5 },
  // A bar, not a button: no outline, the fill behind it is its shape. The
  // row is a dark well in the post; the share is the Pro red on it.
  option: {
    borderRadius: 9,
    overflow: 'hidden',
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  bar: { position: 'absolute', left: 0, top: 0, bottom: 0, borderRadius: 9, overflow: 'hidden', backgroundColor: COLOR_PRO },
  barInk: { position: 'absolute', left: 0, top: 0, bottom: 0 },
  tally: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  optionRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 10, paddingVertical: 9,
  },
  optionLabel:     { flex: 1, minWidth: 0, fontSize: 14, fontFamily: FONT_INTER.semibold, lineHeight: 18 },
  optionLabelMine: { fontWeight: '800' },
  // Room for the last face's negative margin, so the stack ends inside the row.
  faces: { paddingRight: Math.round(FACE_SIZE * FACE_OVERLAP), paddingVertical: 1 },
  pctBubble: {
    height: 20, minWidth: 34, paddingHorizontal: 7, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center', backgroundColor: COLOR_BLACK,
  },
  pct:   { color: '#FFFFFF', fontSize: 11, lineHeight: 14, fontFamily: FONT_INTER.bold, includeFontPadding: false },
  foot:     { flexDirection: 'row', alignItems: 'center', gap: 4, paddingTop: 8 },
  footText: { fontSize: 12, fontFamily: FONT_INTER.semibold },
});
