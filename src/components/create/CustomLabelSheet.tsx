import React, { useEffect, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { Text } from '../../theme/Text';
import SharedModal, { PANE_GUTTER } from '../ui/SharedModal';
import FormInput from '../ui/FormInput';
import Button from '../ui/Button';
import { useColors } from '../../hooks/useColors';
import { FONT_INTER } from '../../constants/fonts';
import { COLOR_RED } from '../../constants/config';

/** As the server allows (postTaxonomyController): 24 characters, letters, numbers and a little punctuation. */
export const CUSTOM_LABEL_MAX = 24;
const LABEL = /^[\p{L}\p{N}][\p{L}\p{N} &'\-\/+!]*$/u;

/** Trimmed, single-spaced, first letter capitalised — as the server stores it. */
export const cleanLabel = (raw: string) => {
  const s = raw.trim().replace(/\s+/g, ' ');
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : '';
};

/**
 * Names a type or category of your own — adding one, or renaming or deleting
 * one you made. Used by the new-post form and the garage car form.
 *
 * `taken` is every name already in the row, built-in or yours; a new name
 * can't repeat one (ignoring case). `onDelete` adds a Delete button.
 */
export default function CustomLabelSheet({ visible, title, placeholder, note, initial = '', taken, onSave, onDelete, onClose }: {
  visible: boolean;
  /** Under the field while there's no error. */
  note?: string;
  title: string;
  placeholder: string;
  initial?: string;
  taken: string[];
  onSave: (label: string) => void;
  onDelete?: () => void;
  onClose: () => void;
}) {
  const colors = useColors();
  const [text, setText] = useState(initial);
  useEffect(() => { if (visible) setText(initial); }, [visible, initial]);

  const label = cleanLabel(text);
  const takenSet = new Set(taken.map((t) => t.toLowerCase()).filter((t) => t !== initial.toLowerCase()));
  const error = !label ? null
    : !LABEL.test(label) ? 'Letters, numbers, spaces and & \' - / + ! only.'
    : takenSet.has(label.toLowerCase()) ? 'There\'s already one called that.'
    : null;
  const canSave = !!label && !error && label !== initial;

  return (
    <SharedModal visible={visible} onClose={onClose} title={title}>
      <View style={styles.body}>
        <FormInput
          value={text}
          onChangeText={setText}
          placeholder={placeholder}
          maxLength={CUSTOM_LABEL_MAX}
          autoFocus
          autoCapitalize="words"
          returnKeyType="done"
          onSubmitEditing={() => { if (canSave) onSave(label); }}
        />
        <Text style={[styles.hint, { color: error ? COLOR_RED : colors.muted }]}>
          {error ?? `${label.length}/${CUSTOM_LABEL_MAX}${note ? ` · ${note}` : ''}`}
        </Text>
        <Button label="Save" onPress={() => onSave(label)} disabled={!canSave} size="full" />
        {onDelete ? <Button label="Delete" onPress={onDelete} variant="destructive" size="full" /> : null}
      </View>
    </SharedModal>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: PANE_GUTTER, paddingTop: 4, paddingBottom: 16, gap: 10 },
  hint: { fontSize: 12, fontFamily: FONT_INTER.medium, marginTop: -2 },
});
