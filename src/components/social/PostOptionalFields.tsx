import React, { useState } from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { Text, TextInput } from '@ors/kit';
import { ChevronDown, ChevronUp } from 'lucide-react-native';
import MakeModelFields from '../cars/MakeModelFields';
import { useColors } from '../../hooks/useColors';
import { COMMON_RADIUS, COLOR_GRAY_14 } from '../../constants/config';
import { FONT_INTER } from '../../constants/fonts'

/** Every optional field a post can carry. */
export interface OptionalFieldValues {
  year: string;
  make: string;
  model: string;
  trim: string;
  price: string;
  mileage: string;
  condition: string;
  vin: string;
  partNumber: string;
}

export const EMPTY_OPTIONAL_FIELDS: OptionalFieldValues = {
  year: '', make: '', model: '', trim: '', price: '',
  mileage: '', condition: '', vin: '', partNumber: '',
};

/**
 * The details a post *can* carry, in one collapsible block.
 *
 * Shared by the create form and the edit sheet, which is the point: editing a
 * post used to drop every one of these fields, so a listing with a price and a
 * VIN came back from an edit with neither. One component, one set of fields,
 * no way for the two forms to disagree about what a post has.
 *
 * A titled block a step darker than the form, with a count of what's filled
 * in while it's closed, so you can tell there's something inside without
 * opening it.
 */
export default function PostOptionalFields({
  values,
  onChange,
  /** Price only makes sense on something being bought or sold. */
  showPrice = true,
  defaultOpen = false,
}: {
  values: OptionalFieldValues;
  onChange: (patch: Partial<OptionalFieldValues>) => void;
  showPrice?: boolean;
  defaultOpen?: boolean;
}) {
  const colors = useColors();
  const [open, setOpen] = useState(defaultOpen);

  const filled = Object.values(values).filter((v) => v.trim().length > 0).length;
  const inputStyle = [
    styles.input,
    { color: colors.fg, borderColor: colors.inputBorder, backgroundColor: colors.inputBg },
  ];

  // No placeholders: the label over each says what it is, and an example
  // under it read as a value already there.
  const field = (
    label: string,
    key: keyof OptionalFieldValues,
    extra: object = {},
    /** Half the row, beside another — the pairs under make and model. */
    half = false,
  ) => (
    <View style={[styles.field, half && styles.fieldHalf]}>
      <Text style={[styles.label, { color: colors.fg }]}>{label}</Text>
      <TextInput
        style={inputStyle}
        value={values[key]}
        onChangeText={(v) => onChange({ [key]: v } as Partial<OptionalFieldValues>)}
        {...extra}
      />
    </View>
  );

  return (
    // A step darker than the form, and no edge of its own: the drop in tone
    // is what marks it off.
    <View style={[styles.card, { backgroundColor: COLOR_GRAY_14 }]}>
      <TouchableOpacity
        style={styles.header}
        onPress={() => setOpen((v) => !v)}
        activeOpacity={0.75}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
      >
        <View style={styles.headerText}>
          <Text style={[styles.headerTitle, { color: colors.fg }]}>Optional Details</Text>
        </View>
        {/* How many are filled, as a small count beside the chevron — the
            one thing worth saying while it's closed. */}
        {filled > 0 && !open && (
          <View style={[styles.countPill, { backgroundColor: colors.segment }]}>
            <Text style={[styles.countText, { color: colors.fg }]}>{filled}</Text>
          </View>
        )}
        {open ? <ChevronUp size={18} color={colors.grey} /> : <ChevronDown size={18} color={colors.grey} />}
      </TouchableOpacity>

      {open && (
        <View style={styles.body}>
          {field('Year', 'year', { keyboardType: 'numeric' })}

          {/* Make first, then its models — see MakeModelFields. */}
          <MakeModelFields
            make={values.make}
            model={values.model}
            onMakeChange={(v) => onChange({ make: v })}
            onModelChange={(v) => onChange({ model: v })}
            style={styles.field}
            inputStyle={inputStyle}
          />

          {field('Trim', 'trim')}
          {showPrice && field('Price ($)', 'price', { keyboardType: 'numeric' })}
          {/* Two to a row, like make and model above them: short answers
              that don't need the width. */}
          <View style={styles.columns}>
            {field('Mileage', 'mileage', { keyboardType: 'numeric' }, true)}
            {field('Condition', 'condition', {}, true)}
          </View>
          <View style={styles.columns}>
            {field('VIN', 'vin', { autoCapitalize: 'characters' }, true)}
            {field('Part #', 'partNumber', {}, true)}
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 12, marginTop: 12,
    borderRadius: COMMON_RADIUS, overflow: 'hidden',
  },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 14, paddingVertical: 14,
  },
  headerText:  { flex: 1, minWidth: 0 },
  headerTitle: { fontSize: 15, fontFamily: FONT_INTER.bold },
  countPill:   { minWidth: 22, height: 22, borderRadius: 11, paddingHorizontal: 7, alignItems: 'center', justifyContent: 'center' },
  countText:   { fontSize: 11, fontFamily: FONT_INTER.extrabold },

  // No rule under the header: the fields simply start, on the same ground.
  body:  { paddingHorizontal: 14, paddingTop: 4, paddingBottom: 16 },
  field:     { marginBottom: 14 },
  fieldHalf: { flex: 1, minWidth: 0 },
  // Side by side, the kit's MakeModelFields' row.
  columns:   { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  // The make and model labels' type (the kit's AutocompleteField): bold,
  // sentence case, in the foreground.
  label:     { fontSize: 13, fontFamily: FONT_INTER.bold, marginBottom: 6 },
  input: { height: 44, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, fontSize: 15 },
});
