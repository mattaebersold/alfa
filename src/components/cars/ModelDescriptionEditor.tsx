import React, { useEffect, useState } from 'react';
import {
  View, Modal, StyleSheet, TouchableOpacity, KeyboardAvoidingView, Platform, Alert, ActivityIndicator,
} from 'react-native';
import { Text, TextInput } from '@ors/kit';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useProposeModelDescriptionMutation } from '../../api/apiService';
import { useColors } from '../../hooks/useColors';
import { useBrandColor } from '../../hooks/useBrandColor';
import { COLOR_BLACK, COLOR_GRAY_26, COMMON_RADIUS, GUTTER, PILL_RADIUS } from '../../constants/config';
import { FONT_INTER } from '../../constants/fonts';

const MIN_CHARS = 20;
const MAX_CHARS = 1200;

/**
 * Propose a model page's description — an edit to the one there, or the
 * first one. A sheet with the text to change; Submit sends it to the admins
 * to review (horacio's modelProposalController), and the member hears back
 * in their notifications either way.
 */
export default function ModelDescriptionEditor({ visible, onClose, page, current }: {
  visible: boolean;
  onClose: () => void;
  page: { title: string; make: string; model: string; generation?: string; standalone?: boolean };
  /** The description as it is, to start from; none, and the box starts empty. */
  current?: string | null;
}) {
  const colors = useColors();
  const brand = useBrandColor();
  const [text, setText] = useState(current ?? '');
  const [propose, { isLoading }] = useProposeModelDescriptionMutation();

  // Fresh from the page's text each time it opens.
  useEffect(() => { if (visible) setText(current ?? ''); }, [visible, current]);

  const trimmed = text.trim();
  const unchanged = !!current && trimmed === current.trim();
  const canSend = trimmed.length >= MIN_CHARS && trimmed.length <= MAX_CHARS && !unchanged && !isLoading;

  const submit = async () => {
    try {
      const res = await propose({
        make: page.make,
        model: page.model,
        generation: page.generation,
        standalone: page.standalone,
        description: trimmed,
      }).unwrap();
      onClose();
      Alert.alert(
        res.replaced ? 'Suggestion updated' : 'Thanks!',
        res.replaced
          ? 'Your earlier suggestion was replaced with this one. An admin will review it.'
          : "An admin will review it, and you'll get a notification when they do.",
      );
    } catch (err: any) {
      Alert.alert("Couldn't send that", err?.data?.error ?? 'Please try again.');
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={[styles.fill, { backgroundColor: colors.cream }]} edges={['top', 'bottom']}>
        <KeyboardAvoidingView style={styles.fill} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.bar}>
            <TouchableOpacity onPress={onClose} hitSlop={8}>
              <Text style={[styles.barBtn, { color: colors.grey }]}>Cancel</Text>
            </TouchableOpacity>
            <Text style={[styles.barTitle, { color: colors.fg }]} numberOfLines={1}>
              {current ? 'Suggest an edit' : 'Add a description'}
            </Text>
            <TouchableOpacity
              onPress={submit}
              disabled={!canSend}
              style={[styles.send, { backgroundColor: brand }, !canSend && styles.sendOff]}
            >
              {isLoading
                ? <ActivityIndicator size="small" color={COLOR_BLACK} />
                : <Text style={styles.sendText}>Submit</Text>}
            </TouchableOpacity>
          </View>

          <View style={styles.body}>
            <Text style={[styles.page, { color: colors.fg }]}>{page.title}</Text>
            <Text style={[styles.hint, { color: colors.grey }]}>
              Straight facts: what it is, who made it, when, and what it's known for. An admin reviews every change.
            </Text>
            <TextInput
              style={[styles.input, { color: colors.fg, borderColor: colors.border }]}
              value={text}
              onChangeText={setText}
              multiline
              autoFocus
              placeholder={`Describe the ${page.title}…`}
              placeholderTextColor={colors.grey}
              maxLength={MAX_CHARS}
              textAlignVertical="top"
            />
            <Text style={[styles.counter, { color: colors.grey }]}>
              {unchanged ? 'No changes yet' : trimmed.length < MIN_CHARS ? `At least ${MIN_CHARS} characters` : `${trimmed.length} / ${MAX_CHARS}`}
            </Text>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  bar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12,
    paddingHorizontal: GUTTER + 8, paddingVertical: 12,
  },
  barBtn: { fontSize: 15, fontFamily: FONT_INTER.medium },
  barTitle: { flexShrink: 1, fontSize: 16, fontFamily: FONT_INTER.bold },
  send: { minWidth: 76, height: 34, paddingHorizontal: 14, borderRadius: PILL_RADIUS, alignItems: 'center', justifyContent: 'center' },
  sendOff: { opacity: 0.4 },
  sendText: { fontSize: 14, fontFamily: FONT_INTER.bold, color: COLOR_BLACK },
  body: { flex: 1, paddingHorizontal: GUTTER + 8, paddingTop: 8, gap: 8 },
  page: { fontSize: 22, fontFamily: FONT_INTER.bold },
  hint: { fontSize: 13, lineHeight: 18 },
  input: {
    flex: 1, marginTop: 6,
    padding: 14, borderRadius: COMMON_RADIUS, borderWidth: 1,
    backgroundColor: COLOR_GRAY_26,
    fontSize: 15, lineHeight: 22,
  },
  counter: { fontSize: 12, alignSelf: 'flex-end', paddingBottom: 8 },
});
