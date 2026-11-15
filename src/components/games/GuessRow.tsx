import React from 'react';
import { View, StyleSheet } from 'react-native';
import { COLOR_BLACK } from '../../constants/config';
import type { CarGuess } from '../../types/games';
import ModelLabel from './ModelLabel';
import { GUESS_ROW_H, HIT_SOFT, MISS_SOFT } from './game';

/** One half of a guess: what was said, green or red — the colour is the verdict. */
function Chip({ label, value, correct }: { label: string; value: string; correct: boolean }) {
  return (
    <View
      style={[styles.chip, { backgroundColor: correct ? HIT_SOFT : MISS_SOFT }]}
      accessible
      accessibilityLabel={`${label}: ${value || 'none'}, ${correct ? 'right' : 'wrong'}`}
    >
      <ModelLabel value={value || '—'} style={styles.chipValue} />
    </View>
  );
}

/** One guess: its make and model, each marked right or wrong on its own. */
export default function GuessRow({ guess }: { guess: CarGuess }) {
  return (
    <View style={styles.row}>
      <Chip label="Make" value={guess.make} correct={guess.make_correct} />
      <Chip label="Model" value={guess.model} correct={guess.model_correct} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'stretch', gap: 8 },
  chip: {
    flex: 1, height: GUESS_ROW_H, flexDirection: 'row', alignItems: 'center',
    borderRadius: 999, paddingHorizontal: 14,
  },
  chipValue: { color: COLOR_BLACK, fontSize: 15, fontWeight: '600' },
});
