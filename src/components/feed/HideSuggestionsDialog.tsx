import React from 'react';
import {
  View, Text, Modal, Pressable, TouchableOpacity, StyleSheet,
} from 'react-native';
import { useColors } from '../../hooks/useColors';

/**
 * Asked when someone closes a suggestion row: gone for a month, or gone for
 * good?
 *
 * Both answers apply to the suggestion rows as a set rather than to the one row
 * that was closed. Closing "Suggested Cars" is a statement about being shown
 * suggestions, not about cars, and hiding one of two near-identical shelves
 * while leaving the other would read as a bug.
 */
interface Props {
  visible: boolean;
  onClose: () => void;
  onChoose: (mode: 'temporary' | 'permanent') => void;
}

export default function HideSuggestionsDialog({ visible, onClose, onChoose }: Props) {
  const colors = useColors();

  const choose = (mode: 'temporary' | 'permanent') => {
    onChoose(mode);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.borderDark }]}>
          <Text style={[styles.heading, { color: colors.fg }]}>Hide suggestions</Text>
          <Text style={[styles.blurb, { color: colors.grey }]}>
            Suggested Members and Suggested Cars will stop showing on your feed.
          </Text>

          <TouchableOpacity
            style={[styles.option, { borderColor: colors.borderDark }]}
            onPress={() => choose('temporary')}
            activeOpacity={0.75}
          >
            <Text style={[styles.optionTitle, { color: colors.fg }]}>Hide temporarily</Text>
            <Text style={[styles.optionSub, { color: colors.grey }]}>Gone for a month, then back.</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.option, { borderColor: colors.borderDark }]}
            onPress={() => choose('permanent')}
            activeOpacity={0.75}
          >
            <Text style={[styles.optionTitle, { color: colors.fg }]}>Hide permanently</Text>
            <Text style={[styles.optionSub, { color: colors.grey }]}>Never show these again.</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.cancel} onPress={onClose} activeOpacity={0.7}>
            <Text style={[styles.cancelText, { color: colors.grey }]}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)', padding: 24,
  },
  card:        { width: '100%', maxWidth: 400, borderRadius: 16, borderWidth: 1, padding: 18 },
  heading:     { fontSize: 17, fontWeight: '800' },
  blurb:       { fontSize: 13, lineHeight: 18, marginTop: 6, marginBottom: 16 },
  option:      { borderWidth: 1, borderRadius: 12, padding: 14, marginBottom: 10 },
  optionTitle: { fontSize: 15, fontWeight: '700' },
  optionSub:   { fontSize: 12, marginTop: 3 },
  cancel:      { alignItems: 'center', paddingVertical: 10, marginTop: 2 },
  cancelText:  { fontSize: 15, fontWeight: '600' },
});
