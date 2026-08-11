import React, { useEffect, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, Modal,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MapPin } from 'lucide-react-native';
import { useGetNearbyPlacesQuery } from '../../api/apiService';
import { useColors } from '../../hooks/useColors';
import { useBrandColor, contrastText } from '../../hooks/useBrandColor';

/**
 * Names a pit stop.
 *
 * A plain `Alert.prompt` would be shorter, but it exists only on iOS — on
 * Android it silently does nothing, which would make the button appear broken
 * on half the devices. This is the same interaction on both platforms.
 *
 * The stop's coordinates are captured the instant the button is tapped, not
 * when this is submitted, so typing a name at the roadside doesn't drag the pin
 * down the road with you.
 */

const SUGGESTIONS = ['Viewpoint', 'Coffee', 'Fuel', 'Photo spot', 'Food', 'Rest stop'];

interface PitStopSheetProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (label: string, note?: string, placeId?: string) => void;
  /** Where the stop was pinned — the anchor for the nearby lookup. */
  at?: { lat: number; lng: number } | null;
}

export default function PitStopSheet({ visible, onClose, onSubmit, at }: PitStopSheetProps) {
  const colors = useColors();
  const brand = useBrandColor();
  const onBrand = contrastText(brand);
  const insets = useSafeAreaInsets();

  const [label, setLabel] = useState('');
  const [note, setNote] = useState('');
  const [placeId, setPlaceId] = useState<string | undefined>();

  useEffect(() => {
    if (visible) { setLabel(''); setNote(''); setPlaceId(undefined); }
  }, [visible]);

  // Only queried while the sheet is actually open — Nearby Search is the
  // priciest call in the feature, so it never runs speculatively.
  const { data: nearby, isFetching } = useGetNearbyPlacesQuery(
    { lat: at?.lat ?? 0, lng: at?.lng ?? 0 },
    { skip: !visible || !at },
  );
  const places = nearby?.places ?? [];

  const submit = () => {
    onSubmit(label.trim() || 'Pit stop', note.trim() || undefined, placeId);
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={[styles.sheet, { backgroundColor: colors.card, paddingBottom: insets.bottom + 16 }]}>
            <Text style={[styles.title, { color: colors.fg }]}>Add pit stop</Text>
            <Text style={[styles.subtitle, { color: colors.grey }]}>
              Pinned where you are right now.
            </Text>

            {/* Real places first — tapping one is faster and more accurate
                than typing, and records exactly what you stopped at. */}
            {at && (isFetching || places.length > 0) && (
              <View style={styles.nearby}>
                <Text style={[styles.nearbyLabel, { color: colors.grey }]}>NEARBY</Text>
                {isFetching ? (
                  <ActivityIndicator size="small" color={brand} style={{ alignSelf: 'flex-start' }} />
                ) : (
                  places.map((p) => {
                    const active = placeId === p.place_id;
                    return (
                      <TouchableOpacity
                        key={p.place_id}
                        style={[styles.placeRow, { borderBottomColor: colors.border }]}
                        onPress={() => { setLabel(p.name); setPlaceId(p.place_id); }}
                        activeOpacity={0.7}
                      >
                        <MapPin size={15} color={active ? brand : colors.grey} />
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.placeName, { color: active ? brand : colors.fg }]} numberOfLines={1}>
                            {p.name}
                          </Text>
                          {p.category && (
                            <Text style={[styles.placeMeta, { color: colors.grey }]} numberOfLines={1}>
                              {p.category}{p.distance != null ? ` · ${p.distance}m away` : ''}
                            </Text>
                          )}
                        </View>
                      </TouchableOpacity>
                    );
                  })
                )}
              </View>
            )}

            <View style={styles.chips}>
              {SUGGESTIONS.map((s) => (
                <TouchableOpacity
                  key={s}
                  style={[
                    styles.chip,
                    { borderColor: colors.border },
                    label === s && { backgroundColor: brand, borderColor: brand },
                  ]}
                  onPress={() => { setLabel(s); setPlaceId(undefined); }}
                >
                  <Text style={[styles.chipText, { color: label === s ? onBrand : colors.fg }]}>{s}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <TextInput
              style={[styles.input, { color: colors.fg, borderColor: colors.inputBorder, backgroundColor: colors.inputBg }]}
              value={label}
              onChangeText={(t) => { setLabel(t); setPlaceId(undefined); }}
              placeholder="Name this stop"
              placeholderTextColor={colors.grey}
              maxLength={80}
              autoFocus
            />
            <TextInput
              style={[styles.input, styles.note, { color: colors.fg, borderColor: colors.inputBorder, backgroundColor: colors.inputBg }]}
              value={note}
              onChangeText={setNote}
              placeholder="Anything worth knowing? (optional)"
              placeholderTextColor={colors.grey}
              multiline
              textAlignVertical="top"
              maxLength={500}
            />

            <View style={styles.actions}>
              <TouchableOpacity style={[styles.btn, styles.cancel, { borderColor: colors.border }]} onPress={onClose}>
                <Text style={[styles.cancelText, { color: colors.fg }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.btn, { backgroundColor: brand, flex: 1 }]} onPress={submit}>
                <Text style={[styles.submitText, { color: onBrand }]}>Add stop</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: {
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: 20, gap: 10,
  },
  title:    { fontSize: 18, fontWeight: '800' },
  subtitle: { fontSize: 13, marginTop: -6 },

  chips:    { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginVertical: 4 },
  chip:     { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 100, borderWidth: 1.5 },
  chipText: { fontSize: 13, fontWeight: '700' },

  nearby:      { gap: 2, maxHeight: 210 },
  nearbyLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },
  placeRow:    { flexDirection: 'row', alignItems: 'center', gap: 9, paddingVertical: 9, borderBottomWidth: StyleSheet.hairlineWidth },
  placeName:   { fontSize: 14, fontWeight: '700' },
  placeMeta:   { fontSize: 11, marginTop: 1 },

  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 11, fontSize: 15 },
  note:  { minHeight: 70 },

  actions:    { flexDirection: 'row', gap: 10, marginTop: 6 },
  btn:        { height: 50, borderRadius: 14, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 22 },
  cancel:     { borderWidth: 1.5 },
  cancelText: { fontSize: 15, fontWeight: '700' },
  submitText: { fontSize: 15, fontWeight: '800' },
});
