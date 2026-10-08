import React, { useEffect, useState } from 'react';
import { View, TouchableOpacity, StyleSheet, Modal, Alert, ActivityIndicator } from 'react-native';
import { Text, TextInput } from '@ors/kit';
import { FormScrollView, KeyboardAvoidingView } from '@ors/kit';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DateField } from '../ui/DateTimeField';
import { ConditionPicker } from './ConditionChips';
import { useAddRouteDriverMutation, useRemoveRouteDriverMutation } from '../../api/apiService';
import { useColors } from '../../hooks/useColors';
import { useBrandColor, contrastText } from '../../hooks/useBrandColor';
import type { RouteCondition, RouteDriver } from '../../types/api';
import { COMMON_RADIUS } from '../../constants/config';
import { FONT_INTER } from '../../constants/fonts';

/**
 * "I drove this" — log your own drive of a route: how long it took, the day,
 * the conditions. All optional; saying you drove it is the point. Opened on a
 * drive you've already logged it edits that, and — unless the route is yours,
 * which makes you its first driver for good — offers to take you off.
 */
export default function DriveLogSheet({ visible, onClose, routeId, mine, isCreator }: {
  visible: boolean;
  onClose: () => void;
  routeId: string;
  /** Your row, if you've logged a drive already. */
  mine?: RouteDriver | null;
  isCreator: boolean;
}) {
  const colors = useColors();
  const brand = useBrandColor();
  const onBrand = contrastText(brand);
  const insets = useSafeAreaInsets();
  const [addDriver, { isLoading: saving }] = useAddRouteDriverMutation();
  const [removeDriver, { isLoading: removing }] = useRemoveRouteDriverMutation();

  const [hours, setHours] = useState('');
  const [minutes, setMinutes] = useState('');
  const [drivenOn, setDrivenOn] = useState('');
  const [conditions, setConditions] = useState<RouteCondition[]>([]);

  // Starts from what you said last time, each time it opens.
  useEffect(() => {
    if (!visible) return;
    const ms = mine?.duration_ms ?? 0;
    const totalMin = Math.round(ms / 60000);
    setHours(ms ? String(Math.floor(totalMin / 60)) : '');
    setMinutes(ms ? String(totalMin % 60) : '');
    setDrivenOn(mine?.driven_on ? String(mine.driven_on).slice(0, 10) : '');
    setConditions(mine?.conditions ?? []);
  }, [visible, mine]);

  const durationMs = () => {
    const h = parseInt(hours, 10) || 0;
    const m = parseInt(minutes, 10) || 0;
    const total = (h * 60 + m) * 60000;
    return total > 0 ? total : null;
  };

  const save = async () => {
    try {
      await addDriver({
        internal_id: routeId,
        duration_ms: durationMs(),
        driven_on: drivenOn || null,
        conditions,
      }).unwrap();
      onClose();
    } catch (err: any) {
      Alert.alert('Not saved', err?.data?.error ?? 'Try again in a moment.');
    }
  };

  const remove = async () => {
    try {
      await removeDriver(routeId).unwrap();
      onClose();
    } catch (err: any) {
      Alert.alert('Not removed', err?.data?.error ?? 'Try again in a moment.');
    }
  };

  const inputStyle = [styles.input, { color: colors.fg, borderColor: colors.inputBorder, backgroundColor: colors.inputBg }];
  const busy = saving || removing;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose} statusBarTranslucent navigationBarTranslucent>
      <KeyboardAvoidingView style={[styles.backdrop, { paddingTop: insets.top }]}>
        <View style={[styles.sheet, { backgroundColor: colors.card }]}>
          <FormScrollView contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + 16 }]}>
            <Text style={[styles.title, { color: colors.fg }]}>
              {mine ? 'Your drive' : 'I drove this'}
            </Text>
            <Text style={[styles.subtitle, { color: colors.grey }]}>
              Everything here is optional.
            </Text>

            <Text style={[styles.label, { color: colors.fg }]}>How long did it take?</Text>
            <View style={styles.timeRow}>
              <TextInput
                style={[inputStyle, styles.timeInput]}
                value={hours}
                onChangeText={(t) => setHours(t.replace(/\D/g, '').slice(0, 2))}
                keyboardType="number-pad"
                placeholder="0"
                placeholderTextColor={colors.grey}
                accessibilityLabel="Hours"
              />
              <Text style={[styles.unit, { color: colors.grey }]}>hr</Text>
              <TextInput
                style={[inputStyle, styles.timeInput]}
                value={minutes}
                onChangeText={(t) => setMinutes(t.replace(/\D/g, '').slice(0, 2))}
                keyboardType="number-pad"
                placeholder="0"
                placeholderTextColor={colors.grey}
                accessibilityLabel="Minutes"
              />
              <Text style={[styles.unit, { color: colors.grey }]}>min</Text>
            </View>

            <Text style={[styles.label, { color: colors.fg }]}>When?</Text>
            <DateField
              value={drivenOn}
              onChange={setDrivenOn}
              placeholder="Optional"
              clearable
              maximumDate={new Date()}
            />

            <Text style={[styles.label, { color: colors.fg }]}>Conditions</Text>
            <ConditionPicker value={conditions} onChange={setConditions} />

            <View style={styles.actions}>
              <TouchableOpacity
                style={[styles.btn, styles.cancel, { borderColor: colors.border }]}
                onPress={onClose}
                disabled={busy}
              >
                <Text style={[styles.cancelText, { color: colors.fg }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.btn, { backgroundColor: brand, flex: 1 }]}
                onPress={save}
                disabled={busy}
              >
                {saving
                  ? <ActivityIndicator color={onBrand} />
                  : <Text style={[styles.submitText, { color: onBrand }]}>{mine ? 'Save' : 'Add my drive'}</Text>}
              </TouchableOpacity>
            </View>

            {mine && !isCreator && (
              <TouchableOpacity style={styles.removeBtn} onPress={remove} disabled={busy}>
                <Text style={[styles.removeText, { color: colors.red }]}>
                  {removing ? 'Removing…' : "I didn't drive this — take me off"}
                </Text>
              </TouchableOpacity>
            )}
          </FormScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: { maxHeight: '100%', borderTopLeftRadius: 20, borderTopRightRadius: 20, overflow: 'hidden' },
  body:     { padding: 20, gap: 10 },
  title:    { fontSize: 18, fontFamily: FONT_INTER.bold },
  subtitle: { fontSize: 13, marginTop: -6 },
  label:    { fontSize: 14, fontFamily: FONT_INTER.bold, marginTop: 8 },

  input:     { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 11, fontSize: 15 },
  timeRow:   { flexDirection: 'row', alignItems: 'center', gap: 8 },
  timeInput: { width: 64, textAlign: 'center' },
  unit:      { fontSize: 14, fontFamily: FONT_INTER.semibold, marginRight: 8 },

  actions:    { flexDirection: 'row', gap: 10, marginTop: 14 },
  btn:        { height: 50, borderRadius: COMMON_RADIUS, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 22 },
  cancel:     { borderWidth: 1.5 },
  cancelText: { fontSize: 15, fontFamily: FONT_INTER.bold },
  submitText: { fontSize: 15, fontFamily: FONT_INTER.extrabold },
  removeBtn:  { alignSelf: 'center', paddingVertical: 10 },
  removeText: { fontSize: 14, fontFamily: FONT_INTER.semibold },
});
