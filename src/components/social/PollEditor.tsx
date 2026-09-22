import React from 'react';
import { View, Text, TextInput, TouchableOpacity, Switch, StyleSheet } from 'react-native';
import { BarChart3, Plus, X } from 'lucide-react-native';
import { useColors } from '../../hooks/useColors';
import { useBrandColor } from '../../hooks/useBrandColor';
import type { PollInput, StoredPoll } from '../../types/api';
import { COMMON_RADIUS } from '../../constants/radius';

/** What the server accepts — see horacio's helpers/polls. */
export const POLL_MIN_OPTIONS = 2;
export const POLL_MAX_OPTIONS = 6;
const MAX_LABEL = 80;
const MAX_QUESTION = 200;

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
}: {
  draft: PollDraft;
  onChange: (next: PollDraft) => void;
  lockedOptionIds?: Set<string>;
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

  const fieldStyle = [styles.field, { color: colors.fg, backgroundColor: colors.inputBg, borderColor: colors.inputBorder }];

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.borderDark }]}>
      <View style={styles.headRow}>
        <BarChart3 size={16} color={draft.enabled ? brand : colors.grey} />
        <Text style={[styles.headLabel, { color: colors.fg }]}>Add a poll</Text>
        <Switch
          value={draft.enabled}
          onValueChange={(enabled) => onChange({ ...draft, enabled })}
          trackColor={{ true: brand }}
          accessibilityLabel="Add a poll"
        />
      </View>

      {draft.enabled && (
        <View style={styles.body}>
          <TextInput
            style={fieldStyle}
            value={draft.question}
            onChangeText={(question) => onChange({ ...draft, question })}
            placeholder="Question (optional)"
            placeholderTextColor={colors.grey}
            maxLength={MAX_QUESTION}
            returnKeyType="next"
          />

          {draft.options.map((o, i) => {
            const locked = !!o.internal_id && !!lockedOptionIds?.has(o.internal_id);
            const removable = draft.options.length > POLL_MIN_OPTIONS && !locked;
            return (
              <View key={o.key} style={styles.optionRow}>
                <TextInput
                  style={[...fieldStyle, styles.optionField]}
                  value={o.label}
                  onChangeText={(label) => setOption(o.key, label)}
                  placeholder={`Option ${i + 1}`}
                  placeholderTextColor={colors.grey}
                  maxLength={MAX_LABEL}
                  returnKeyType="next"
                />
                {/* Kept in the row even when it can't be pressed, so the
                    fields stay one width down the list. */}
                <TouchableOpacity
                  style={[styles.removeBtn, { borderColor: colors.inputBorder }, !removable && styles.removeBtnOff]}
                  onPress={() => removeOption(o.key)}
                  disabled={!removable}
                  hitSlop={6}
                  accessibilityRole="button"
                  accessibilityLabel={locked ? 'This option has votes and can’t be removed' : `Remove option ${i + 1}`}
                >
                  <X size={14} color={colors.grey} />
                </TouchableOpacity>
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
    paddingHorizontal: 14, paddingVertical: 10,
    borderRadius: COMMON_RADIUS, borderWidth: 1,
  },
  headRow:   { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headLabel: { flex: 1, fontSize: 14, fontWeight: '700' },
  body:      { paddingTop: 10, gap: 8 },
  field: {
    fontSize: 14, paddingHorizontal: 12, paddingVertical: 10,
    borderWidth: 1, borderRadius: 10,
  },
  optionRow:   { flexDirection: 'row', alignItems: 'center', gap: 8 },
  optionField: { flex: 1 },
  removeBtn: {
    width: 36, height: 36, borderRadius: 10, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
  },
  removeBtnOff: { opacity: 0.3 },
  addBtn:  { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', paddingVertical: 6 },
  addText: { fontSize: 13, fontWeight: '700' },
  settingRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: 10, marginTop: 2, borderTopWidth: StyleSheet.hairlineWidth,
  },
  settingLabel: { fontSize: 14, fontWeight: '600' },
});
