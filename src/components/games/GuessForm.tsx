import React, { useMemo, useState } from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import { ChevronDown } from 'lucide-react-native';
import { Text } from '../../theme/Text';
import { useColors } from '../../hooks/useColors';
import { useBrandColor, useBrandTextColor } from '../../hooks/useBrandColor';
import { useGetCarMakeOptionsQuery, useGetCarModelOptionsQuery } from '../../api/apiService';
import { COLOR_BLACK } from '../../constants/config';
import { MAX_ATTEMPTS } from '../../types/games';
import OptionPicker from './OptionPicker';
import ModelLabel from './ModelLabel';
import { GAME_CARD, GAME_INSET, GUESS_ROW_H, HIT_SOFT } from './game';

/**
 * Which guess this is, as a bar filling toward the last — the brand colour
 * (the Pro red) up to where you are, and "2/5" at its start.
 */
export function AttemptBar({ attempt }: { attempt: number }) {
  const brand = useBrandColor();
  const brandText = useBrandTextColor();
  return (
    <View style={styles.track} accessibilityRole="progressbar" accessibilityValue={{ min: 1, max: MAX_ATTEMPTS, now: attempt }}>
      <View style={[styles.fill, { width: `${(attempt / MAX_ATTEMPTS) * 100}%`, backgroundColor: brand }]} />
      <Text style={[styles.trackText, { color: brandText }]}>{attempt}/{MAX_ATTEMPTS}</Text>
    </View>
  );
}

/**
 * A make's models, one line each: every generation folded into its model —
 * "200SX (S13)" and "200SX (S14)" are just "200SX". The server counts the
 * model right against any of its generations.
 */
function collapseGenerations(models: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const m of models) {
    const base = m.replace(/\s*\([^()]+\)\s*$/, '').trim() || m;
    const key = base.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(base);
  }
  return out;
}

/** A half already got right: shown, green, and not for changing. */
function LockedField({ value }: { value: string }) {
  return (
    <View style={styles.locked}>
      <ModelLabel value={value} style={styles.lockedText} />
    </View>
  );
}

/** A half still open: shaped like a text field, but a button onto the picker. */
function PickField({ value, placeholder, onPress, disabled = false }: {
  value: string;
  placeholder: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  const colors = useColors();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[styles.field, { borderColor: colors.inputBorder }, disabled && styles.fieldOff]}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      accessibilityLabel={value ? `${placeholder}: ${value}` : `Choose a ${placeholder.toLowerCase()}`}
    >
      {value
        ? <ModelLabel value={value} style={[styles.fieldText, { color: colors.fg }]} />
        : <Text style={[styles.fieldText, { color: colors.grey }]} numberOfLines={1}>{placeholder}</Text>}
      <ChevronDown size={16} color={colors.grey} />
    </Pressable>
  );
}

/**
 * The guess: make and model, picked from the reference lists rather than
 * typed, so a typo can't cost a guess. Once a half is right it's locked —
 * the server keeps a solved half correct anyway. Held by the screen, whose
 * Guess button is pinned under the scroll this sits in.
 */
export default function GuessForm({
  solvedMake, solvedModel, make, model, onMakeChange: setMake, onModelChange: setModel,
}: {
  solvedMake: string | null;
  solvedModel: string | null;
  make: string;
  model: string;
  onMakeChange: (v: string) => void;
  onModelChange: (v: string) => void;
}) {
  // Which list the sheet holds, apart from whether it's up: it keeps its list
  // while it slides away, rather than flashing the other one on the way out.
  const [pane, setPane] = useState<'make' | 'model'>('make');
  const [open, setOpen] = useState(false);
  const show = (p: 'make' | 'model') => { setPane(p); setOpen(true); };

  const {
    data: makes = [], isLoading: makesLoading, isError: makesFailed, refetch: refetchMakes,
  } = useGetCarMakeOptionsQuery(undefined, { skip: !!solvedMake });
  // `currentData`: while a new make's list is coming, `data` is still the last make's.
  const modelsOf = solvedMake ?? make;
  const {
    currentData: models, isFetching: modelsLoading, isError: modelsFailed, refetch: refetchModels,
  } = useGetCarModelOptionsQuery(modelsOf, { skip: !modelsOf || !!solvedModel });
  const modelOptions = useMemo(() => collapseGenerations(models ?? []), [models]);

  const pickMake = (v: string) => {
    if (v !== make) {
      setMake(v);
      // The old model belonged to the old make.
      setModel('');
    }
    setOpen(false);
  };
  const pickModel = (v: string) => {
    setModel(v);
    setOpen(false);
  };
  const onModel = pane === 'model';

  return (
    <View style={styles.fields}>
      <View style={styles.column}>
        {solvedMake ? <LockedField value={solvedMake} /> : <PickField value={make} placeholder="Make" onPress={() => show('make')} />}
      </View>
      <View style={styles.column}>
        {solvedModel
          ? <LockedField value={solvedModel} />
          // Nothing to choose from until there's a make to choose within.
          : <PickField value={model} placeholder="Model" onPress={() => show('model')} disabled={!modelsOf} />}
      </View>
      <OptionPicker
        visible={open}
        title={onModel ? `${modelsOf} model` : 'Make'}
        options={onModel ? modelOptions : makes}
        value={onModel ? model : make}
        loading={onModel ? modelsLoading : makesLoading}
        failed={onModel ? modelsFailed : makesFailed}
        onRetry={onModel ? refetchModels : refetchMakes}
        onPick={onModel ? pickModel : pickMake}
        onClose={() => setOpen(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: GAME_CARD,
    height: GUESS_ROW_H, borderWidth: 1, borderRadius: 999, paddingHorizontal: 14,
  },
  fieldText: { flex: 1, fontSize: 15 },
  fieldOff: { opacity: 0.5 },
  track: {
    height: 28, borderRadius: 14, backgroundColor: GAME_INSET, overflow: 'hidden',
    justifyContent: 'center', paddingHorizontal: 16,
  },
  fill: { position: 'absolute', left: 0, top: 0, bottom: 0, borderRadius: 14 },
  trackText: { fontSize: 13, fontWeight: '800', fontVariant: ['tabular-nums'] },
  // Make and model side by side.
  fields: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  column: { flex: 1, minWidth: 0 },
  locked: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    height: GUESS_ROW_H, backgroundColor: HIT_SOFT, borderRadius: 999, paddingHorizontal: 14,
  },
  lockedText: { flex: 1, color: COLOR_BLACK, fontSize: 15, fontWeight: '600' },
});
