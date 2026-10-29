import React, { useRef } from 'react';
import { View, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { Text } from '@ors/kit';
import { PenSquare, Trash2 } from 'lucide-react-native';
import { format } from 'date-fns';
import SummaryModal from '../ui/SummaryModal';
import PostMediaCarousel from '../media/PostMediaCarousel';
import { useColors } from '../../hooks/useColors';
import { imageUrl } from '../../utils/image';
import type { CarJournalEntry } from '../../types/api';
import { FONT_INTER } from '../../constants/fonts';
import { COMMON_RADIUS } from '../../constants/config';

/**
 * A journal entry, read in full: its photos as a post's are — swiped,
 * pinched — then its title, when it was written, and every word of it.
 *
 * The owner gets Edit and Delete at the foot, as buttons in the panel rather
 * than a menu over it: a sheet over a summary is one modal over another,
 * which iOS won't present. Edit opens the form once the panel has closed.
 */
export default function JournalEntrySummaryModal({ entry, onClose, onEdit, onDelete }: {
  entry: CarJournalEntry | null;
  onClose: () => void;
  /** The owner's: open the form on this entry. Run once the panel has closed. */
  onEdit?: (entry: CarJournalEntry) => void;
  /** The owner's: delete it, once confirmed. */
  onDelete?: (entry: CarJournalEntry) => void;
}) {
  const colors = useColors();
  // Kept through the close, so it fades out on its entry rather than emptying.
  const last = useRef<CarJournalEntry | null>(null);
  if (entry) last.current = entry;
  const shown = entry ?? last.current;
  const afterClose = useRef<(() => void) | null>(null);

  const photos = (shown?.gallery ?? []).filter((g) => g.filename && g.type !== 'video');
  const when = shown?.created_at ? format(new Date(shown.created_at), 'MMMM d, yyyy') : '';

  const confirmDelete = (e: CarJournalEntry) => {
    Alert.alert('Delete this entry?', `"${e.title ?? 'Untitled'}" and its photos will be gone for good.`, [
      { text: 'Keep it', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => { onDelete?.(e); onClose(); },
      },
    ]);
  };

  return (
    <SummaryModal
      visible={!!entry}
      onClose={onClose}
      onClosed={() => {
        const run = afterClose.current;
        afterClose.current = null;
        run?.();
      }}
    >
      {shown ? (
        <View>
          {photos.length > 0 && (
            <PostMediaCarousel
              media={photos.map((g) => ({ kind: 'image' as const, key: g.internal_id ?? g.filename!, url: imageUrl(g.filename)! }))}
              adaptiveHeight
              pinchZoom
            />
          )}
          <View style={styles.text}>
            <Text style={[styles.title, { color: colors.fg }]}>{shown.title}</Text>
            {when ? <Text style={[styles.when, { color: colors.grey }]}>{when}</Text> : null}
            {shown.body ? <Text style={[styles.body, { color: colors.fgDark }]}>{shown.body}</Text> : null}
          </View>
          {(onEdit || onDelete) && (
            <View style={styles.actions}>
              {onEdit && (
                <TouchableOpacity
                  style={[styles.action, { backgroundColor: colors.inputBg }]}
                  onPress={() => { afterClose.current = () => onEdit(shown); onClose(); }}
                  activeOpacity={0.8}
                  accessibilityRole="button"
                >
                  <PenSquare size={16} color={colors.fg} />
                  <Text style={[styles.actionText, { color: colors.fg }]}>Edit</Text>
                </TouchableOpacity>
              )}
              {onDelete && (
                <TouchableOpacity
                  style={[styles.action, { backgroundColor: colors.inputBg }]}
                  onPress={() => confirmDelete(shown)}
                  activeOpacity={0.8}
                  accessibilityRole="button"
                >
                  <Trash2 size={16} color={colors.red} />
                  <Text style={[styles.actionText, { color: colors.red }]}>Delete</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>
      ) : null}
    </SummaryModal>
  );
}

const styles = StyleSheet.create({
  text:       { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 6 },
  title:      { fontSize: 19, fontFamily: FONT_INTER.bold },
  when:       { fontSize: 12, fontFamily: FONT_INTER.medium, marginTop: 4 },
  body:       { fontSize: 15, lineHeight: 22, marginTop: 12 },
  actions:    { flexDirection: 'row', gap: 10, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 16 },
  action:     {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7,
    paddingVertical: 12, borderRadius: COMMON_RADIUS,
  },
  actionText: { fontSize: 14, fontFamily: FONT_INTER.bold },
});
