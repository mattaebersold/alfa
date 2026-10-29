import React from 'react';
import { View, TouchableOpacity, Switch, StyleSheet } from 'react-native';
import { Text } from '@ors/kit';
import { BarChart3, Plus, X } from 'lucide-react-native';
import FormInput from '../ui/FormInput';
import { useColors } from '../../hooks/useColors';
import { useBrandColor } from '../../hooks/useBrandColor';
import type { PollInput, StoredPoll } from '../../types/api';
import { COMMON_RADIUS, COLOR_GRAY_46, COLOR_WHITE, INPUT_LINE_HEIGHT } from '../../constants/config';
import { FONT_INTER } from '../../constants/fonts'

/** What the server accepts — see horacio's helpers/polls. */
export const POLL_MIN_OPTIONS = 2;
export const POLL_MAX_OPTIONS = 6;
const MAX_LABEL = 80;
const MAX_QUESTION = 200;
/** The fields' vertical padding — FormInput's. */
const FIELD_PAD_V = 12;
/** Room at the field's right end for its remove X. */
const REMOVE_ROOM = 40;

/**
 * One option as the form holds it. `internal_id` is set on an option the
 * post already had, and travels back with it so a relabel keeps its votes —
 * see PollInput.
 */
export interface PollDraftOption { key: string; internal_id?: string; label: string }

export interface PollDraft {
  /** Whether the post carries a poll at all — off, and nothing is sent. */
  enabled: boolean;
  question: string;
  options: PollDraftOption[];
  allowChange: boolean;
}

let seq = 0;
const nextKey = () => `o${++seq}_${Date.now()}`;

/** A fresh draft: off, two empty options ready for when it's switched on. */
export const emptyPollDraft = (): PollDraft => ({
  enabled: false,
  question: '',
  options: [{ key: nextKey(), label: '' }, { key: nextKey(), label: '' }],
  allowChange: true,
});

/** The draft an edit starts from — the post's own poll, or an empty one. */
export const pollDraftFrom = (poll?: StoredPoll | null): PollDraft => {
  if (!poll || poll.options.length === 0) return emptyPollDraft();
  return {
    enabled: true,
    question: poll.question ?? '',
    options: poll.options.map((o) => ({ key: nextKey(), internal_id: o.internal_id, label: o.label })),
    allowChange: poll.allow_change !== false,
  };
};

/**
 * What the draft sends, or why it can't.
 *
 * Blank options are dropped rather than refused — an author who opened a
 * third field and left it is not asking for a three-way poll. Whatever is
 * left has to meet the server's floor, and the message is the one the server
 * would send, so nobody has to fail a round trip to learn the rule.
 */
export function pollDraftToInput(draft: PollDraft): { poll: PollInput | null; error?: string } {
  if (!draft.enabled) return { poll: null };
  const kept = draft.options
    .map((o) => ({ ...o, label: o.label.trim() }))
    .filter((o) => o.label.length > 0);
  if (kept.length < POLL_MIN_OPTIONS) {
    return { poll: null, error: `A poll needs at least ${POLL_MIN_OPTIONS} options.` };
  }
  const seen = new Set<string>();
  for (const o of kept) {
    const k = o.label.toLowerCase();
    if (seen.has(k)) return { poll: null, error: 'Poll options must be different from each other.' };
    seen.add(k);
  }
  return {
    poll: {
      question: draft.question.trim() || undefined,
      // Existing options go back by id; new ones are plain labels.
      options: kept.map((o) => (o.internal_id ? { internal_id: o.internal_id, label: o.label } : o.label)),
      allow_change: draft.allowChange,
    },
  };
}

/**
 * The "Add a poll" section of the post form.
 *
 * Off by default and folded to one row, because most posts aren't polls and a
 * standing block of empty option fields would make every post look like it
 * was missing one. Switched on, it's the question, the options with add and
 * remove, and whether a vote can be changed later.
 *
 * Controlled: the host owns the draft, since it's the host that turns it into
 * the multipart field on submit (see pollDraftToInput).
 */
export default function PollEditor({
  draft,
  onChange,
  /**
   * Options that already have votes on the server. Their labels can change
   * but they can't be removed — the server refuses the whole edit if one goes
   * missing — so the remove button sits out for them.
   */
  lockedOptionIds,
  fixed = false,
}: {
  draft: PollDraft;
  onChange: (next: PollDraft) => void;
  lockedOptionIds?: Set<string>;
  /**
   * The poll is the point, not an add-on: no switch, always open. For the
   * create screen's Poll tab, where the whole form is the poll.
   */
  fixed?: boolean;
}) {
  const colors = useColors();
  const brand = useBrandColor();

  const setOption = (key: string, label: string) =>
    onChange({ ...draft, options: draft.options.map((o) => (o.key === key ? { ...o, label } : o)) });
  const addOption = () => {
    if (draft.options.length >= POLL_MAX_OPTIONS) return;
    onChange({ ...draft, options: [...draft.options, { key: nextKey(), label: '' }] });
  };
  const removeOption = (key: string) => {
    if (draft.options.length <= POLL_MIN_OPTIONS) return;
    onChange({ ...draft, options: draft.options.filter((o) => o.key !== key) });
  };

  return (
    // Fixed, the poll is the form: no card around it and no heading over it —
    // the Poll tab says what it is, and the fields sit in line with the
    // form's others. As an add-on (the edit sheet), the card and its heading
    // carry the switch that turns it on.
    <View style={fixed ? styles.bare : [styles.card, { backgroundColor: colors.card, borderColor: COLOR_GRAY_46 }]}>
      {!fixed && (
      <View style={styles.headRow}>
        {/* White, like the tag cards' icons — the switch says whether it's on. */}
        <BarChart3 size={15} color={COLOR_WHITE} />
        <Text style={[styles.headLabel, { color: colors.fg }]}>Add a poll</Text>
        <Switch
          value={draft.enabled}
          onValueChange={(enabled) => onChange({ ...draft, enabled })}
          trackColor={{ true: brand }}
          accessibilityLabel="Add a poll"
        />
      </View>
      )}

      {(fixed || draft.enabled) && (
        <View style={[styles.body, fixed && styles.bodyBare]}>
          {/* Two lines tall to start, so a question has room to be one, and
              growing to three. Return finishes it rather than adding a line —
              a question has no paragraphs. */}
          <FormInput
            style={styles.question}
            value={draft.question}
            onChangeText={(question) => onChange({ ...draft, question })}
            placeholder="Question"
            maxLength={MAX_QUESTION}
            multiline
            submitBehavior="blurAndSubmit"
            returnKeyType="next"
          />

          {draft.options.map((o, i) => {
            const locked = !!o.internal_id && !!lockedOptionIds?.has(o.internal_id);
            // The first two are the poll's floor — always there, so no X.
            const extra = i >= POLL_MIN_OPTIONS;
            const removable = extra && !locked;
            return (
              <View key={o.key}>
                <FormInput
                  style={extra && styles.optionWithRemove}
                  value={o.label}
                  onChangeText={(label) => setOption(o.key, label)}
                  placeholder={`Option ${i + 1}`}
                  maxLength={MAX_LABEL}
                  returnKeyType="next"
                />
                {/* Inside the field's right end, so every field is one width
                    whether it has one or not. Shown dimmed on an option with
                    votes (the edit sheet), which can't be removed. */}
                {extra && (
                  <TouchableOpacity
                    style={[styles.removeBtn, !removable && styles.removeBtnOff]}
                    onPress={() => removeOption(o.key)}
                    disabled={!removable}
                    hitSlop={6}
                    accessibilityRole="button"
                    accessibilityLabel={locked ? 'This option has votes and can’t be removed' : `Remove option ${i + 1}`}
                  >
                    <X size={16} color={colors.grey} />
                  </TouchableOpacity>
                )}
              </View>
            );
          })}

          {draft.options.length < POLL_MAX_OPTIONS && (
            <TouchableOpacity style={styles.addBtn} onPress={addOption} activeOpacity={0.7} hitSlop={6}>
              <Plus size={14} color={brand} />
              <Text style={[styles.addText, { color: brand }]}>Add option</Text>
            </TouchableOpacity>
          )}

          <View style={[styles.settingRow, { borderTopColor: colors.border }]}>
            <Text style={[styles.settingLabel, { color: colors.fg }]}>Allow changing votes</Text>
            <Switch
              value={draft.allowChange}
              onValueChange={(allowChange) => onChange({ ...draft, allowChange })}
              trackColor={{ true: brand }}
            />
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  // The same card the tag rows and the Post To block wear, so the form reads
  // as one set of sections.
  card: {
    marginHorizontal: 12, marginTop: 12,
    paddingHorizontal: 14, paddingVertical: 12,
    borderRadius: COMMON_RADIUS, borderWidth: 1,
  },
  // In the form's flow: its side margin only, so the fields line up with the
  // title and description.
  bare: { marginHorizontal: 12 },
  headRow:   { flexDirection: 'row', alignItems: 'center', gap: 7 },
  // The form's section title — Optional Details, the tag cards, Post To.
  headLabel: { flex: 1, fontSize: 15, fontFamily: FONT_INTER.bold },
  body:      { paddingTop: 10, gap: 8 },
  // Clear of the tabs above: with the Poll tab's own 4, the 12 the form's
  // fields keep between them.
  bodyBare:  { paddingTop: 8 },
  // Two lines to start, three at most, then it scrolls.
  question: {
    minHeight: INPUT_LINE_HEIGHT * 2 + FIELD_PAD_V * 2,
    maxHeight: INPUT_LINE_HEIGHT * 3 + FIELD_PAD_V * 2,
  },
  optionWithRemove: { paddingRight: REMOVE_ROOM },
  removeBtn: {
    position: 'absolute', top: 0, bottom: 0, right: 0, width: REMOVE_ROOM,
    alignItems: 'center', justifyContent: 'center',
  },
  removeBtnOff: { opacity: 0.3 },
  addBtn:  { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', paddingVertical: 6 },
  addText: { fontSize: 13, fontFamily: FONT_INTER.bold },
  settingRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: 10, marginTop: 2, borderTopWidth: StyleSheet.hairlineWidth,
  },
  settingLabel: { fontSize: 14, fontFamily: FONT_INTER.semibold },
});
