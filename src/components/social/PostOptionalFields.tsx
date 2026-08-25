import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { ChevronDown, ChevronUp, SlidersHorizontal } from 'lucide-react-native';
import MakeModelFields from '../cars/MakeModelFields';
import { useColors } from '../../hooks/useColors';
import { useBrandColor } from '../../hooks/useBrandColor';

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
 * It announces itself rather than hiding as another grey header: a titled card
 * with a rule in the brand colour, and a count of what's filled in so you can
 * tell there's something inside without opening it.
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
  const brand = useBrandColor();
  const [open, setOpen] = useState(defaultOpen);

  const filled = Object.values(values).filter((v) => v.trim().length > 0).length;
  const inputStyle = [
    styles.input,
    { color: colors.fg, borderColor: colors.inputBorder, backgroundColor: colors.inputBg },
  ];

  const field = (
    label: string,
    key: keyof OptionalFieldValues,
    placeholder: string,
    extra: object = {},
  ) => (
    <View style={styles.field}>
      <Text style={[styles.label, { color: colors.grey }]}>{label}</Text>
      <TextInput
        style={inputStyle}
        value={values[key]}
        onChangeText={(v) => onChange({ [key]: v } as Partial<OptionalFieldValues>)}
        placeholder={placeholder}
        placeholderTextColor={colors.grey}
        {...extra}
      />
    </View>
  );

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.borderDark }]}>
      <TouchableOpacity
        style={styles.header}
        onPress={() => setOpen((v) => !v)}
        activeOpacity={0.75}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
      >
        <View style={[styles.headerIcon, { backgroundColor: brand + '22' }]}>
          <SlidersHorizontal size={15} color={brand} />
        </View>
        <View style={styles.headerText}>
          <Text style={[styles.headerTitle, { color: colors.fg }]}>Optional Details</Text>
          <Text style={[styles.headerHint, { color: colors.grey }]}>
            {filled > 0
              ? `${filled} filled in — year, make, price and more`
              : 'Year, make, model, price, mileage, VIN…'}
          </Text>
        </View>
        {open ? <ChevronUp size={18} color={colors.grey} /> : <ChevronDown size={18} color={colors.grey} />}
      </TouchableOpacity>

      {open && (
        <View style={[styles.body, { borderTopColor: brand }]}>
          {field('Year', 'year', 'e.g. 2003', { keyboardType: 'numeric' })}

          {/* Make first, then its models — see MakeModelFields. */}
          <MakeModelFields
            make={values.make}
            model={values.model}
            onMakeChange={(v) => onChange({ make: v })}
            onModelChange={(v) => onChange({ model: v })}
            style={styles.field}
            inputStyle={inputStyle}
          />

          {field('Trim', 'trim', 'e.g. Carrera S')}
          {showPrice && field('Price ($)', 'price', '0', { keyboardType: 'numeric' })}
          {field('Mileage', 'mileage', '0', { keyboardType: 'numeric' })}
          {field('Condition', 'condition', 'e.g. Excellent')}
          {field('VIN', 'vin', 'Vehicle ID', { autoCapitalize: 'characters' })}
          {field('Part #', 'partNumber', 'Part number')}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 12, marginTop: 12,
    borderRadius: 14, borderWidth: 1, overflow: 'hidden',
  },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 14, paddingVertical: 14,
  },
  headerIcon: {
    width: 30, height: 30, borderRadius: 15,
    alignItems: 'center', justifyContent: 'center',
  },
  headerText:  { flex: 1, minWidth: 0 },
  headerTitle: { fontSize: 15, fontWeight: '800' },
  headerHint:  { fontSize: 11.5, marginTop: 2 },

  // The brand-coloured rule is what separates the open block from the header
  // above it — a plain hairline read as one more divider in a stack of them.
  body:  { borderTopWidth: 2, paddingHorizontal: 14, paddingTop: 14, paddingBottom: 16 },
  field: { marginBottom: 14 },
  label: { fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 },
  input: { height: 44, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, fontSize: 15 },
});
