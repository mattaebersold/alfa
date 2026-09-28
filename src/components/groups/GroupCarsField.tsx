import React, { useState } from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { Text } from '@ors/kit';
import { Plus, X } from 'lucide-react-native';
import MakeModelFields from '../cars/MakeModelFields';
import { useColors } from '../../hooks/useColors';
import { useBrandColor } from '../../hooks/useBrandColor';
import { groupCarLabel } from '../../utils/groupCars';
import type { GroupCar } from '../../types/api';
import { COLOR_BLACK, PILL_RADIUS } from '../../constants/config';
import { FONT_INTER } from '../../constants/fonts';

/**
 * The cars a group is about, as many as it likes — a repeater: each added
 * one a numbered row (× to drop it), and a dashed "Add another car" panel
 * below with the make/model pair for the next. A make with no
 * model is the whole make. Each puts the group on that make's page — and the
 * model's, when there is one.
 */
export default function GroupCarsField({ value, onChange }: {
  value: GroupCar[];
  onChange: (cars: GroupCar[]) => void;
}) {
  const colors = useColors();
  const brand = useBrandColor();
  const [make, setMake] = useState('');
  const [model, setModel] = useState('');

  const key = (c: GroupCar) => `${c.make.trim().toLowerCase()}|${(c.model ?? '').trim().toLowerCase()}`;
  const draft: GroupCar = { make: make.trim(), model: model.trim() || null };
  const canAdd = !!draft.make && !value.some((c) => key(c) === key(draft));

  const add = () => {
    if (!canAdd) return;
    onChange([...value, draft]);
    setMake('');
    setModel('');
  };

  return (
    <View style={styles.wrap}>
      {/* The list so far: one numbered row per car, each removable. */}
      {value.length > 0 ? (
        <View style={[styles.list, { borderColor: colors.border }]}>
          {value.map((c, i) => (
            <View
              key={key(c)}
              style={[styles.row, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border }]}
            >
              <View style={[styles.index, { backgroundColor: colors.card }]}>
                <Text style={[styles.indexText, { color: colors.grey }]}>{i + 1}</Text>
              </View>
              <View style={styles.rowText}>
                <Text style={[styles.rowMake, { color: colors.fg }]} numberOfLines={1}>{c.make}</Text>
                <Text style={[styles.rowModel, { color: colors.grey }]} numberOfLines={1}>
                  {c.model || 'Any model'}
                </Text>
              </View>
              <TouchableOpacity
                style={[styles.remove, { borderColor: colors.border }]}
                onPress={() => onChange(value.filter((x) => key(x) !== key(c)))}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={`Remove ${groupCarLabel(c)}`}
              >
                <X size={14} color={colors.grey} strokeWidth={2.4} />
              </TouchableOpacity>
            </View>
          ))}
        </View>
      ) : (
        <Text style={[styles.empty, { color: colors.grey }]}>
          No cars yet. Add each make — and model, if it's about one — this group is for.
        </Text>
      )}

      {/* The next one to add: its own dashed panel, so it reads as "another
          row" rather than as the fields of the ones above. */}
      <View style={[styles.adder, { borderColor: colors.border }]}>
        <Text style={[styles.adderTitle, { color: colors.fg }]}>
          {value.length ? 'Add another car' : 'Add a car'}
        </Text>
        <MakeModelFields make={make} model={model} onMakeChange={setMake} onModelChange={setModel} hideMissingLink />
        <TouchableOpacity
          style={[styles.addBtn, { backgroundColor: canAdd ? brand : colors.card, borderColor: canAdd ? brand : colors.border }]}
          onPress={add}
          disabled={!canAdd}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityState={{ disabled: !canAdd }}
          accessibilityLabel={draft.make ? `Add ${groupCarLabel(draft)}` : 'Add car'}
        >
          <Plus size={15} color={canAdd ? COLOR_BLACK : colors.grey} strokeWidth={2.6} />
          <Text style={[styles.addText, { color: canAdd ? COLOR_BLACK : colors.grey }]}>
            {draft.make ? `Add ${groupCarLabel(draft)}` : 'Choose a make to add'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap:     { gap: 12 },
  list:     { borderRadius: 14, borderWidth: 1, overflow: 'hidden' },
  row:      { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 10 },
  index: {
    width: 24, height: 24, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
  },
  indexText: { fontSize: 12, fontFamily: FONT_INTER.bold },
  rowText:  { flex: 1, minWidth: 0 },
  rowMake:  { fontSize: 14.5, fontFamily: FONT_INTER.semibold },
  rowModel: { fontSize: 12.5, marginTop: 1 },
  remove: {
    width: 28, height: 28, borderRadius: 14, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
  },
  empty:    { fontSize: 13, lineHeight: 18 },
  adder: {
    gap: 10, padding: 12,
    borderRadius: 14, borderWidth: 1, borderStyle: 'dashed',
  },
  adderTitle: { fontSize: 13, fontFamily: FONT_INTER.bold },
  // Full width in the panel — the one action it has.
  addBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 10,
    borderRadius: PILL_RADIUS, borderWidth: 1,
  },
  addText:  { fontSize: 13.5, fontFamily: FONT_INTER.bold },
});
