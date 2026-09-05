import React from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Alert,
} from 'react-native';
import { Image } from 'expo-image';
import { Users, RotateCcw } from 'lucide-react-native';
import {
  useGetDeclinedInvitesQuery,
  useAllowGroupInvitesMutation,
} from '../../api/apiService';
import SharedModal from '../ui/SharedModal';
import EmptyState from '../ui/EmptyState';
import Spinner from '../ui/Spinner';
import { firstGalleryUrl } from '../../utils/image';
import { useColors } from '../../hooks/useColors';
import type { DeclinedInvite } from '../../types/api';

/**
 * The groups you said no to, and the way to change your mind.
 *
 * Declining an invitation used to delete the record, which meant it bought you
 * nothing: the group could ask again the next day, and the day after. The
 * record now survives as a standing "no" that the invite screen won't let
 * anyone past.
 *
 * That only works if the person it protects can also lift it, which is what
 * this is. Nobody else can reach it — a group clearing its own rejections would
 * defeat the entire point of keeping them.
 *
 * Lifting a decline does not rejoin the group or re-issue the invitation. It
 * puts you back where you were before you were asked: invitable. Someone in the
 * group still has to want you there, which is the honest reading of "allow
 * invites again" and not a back door into a group you turned down.
 */
export default function DeclinedInvitesSheet({
  visible, onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const c = useColors();
  const { data, isLoading } = useGetDeclinedInvitesQuery(undefined, { skip: !visible });
  const [allowInvites, { isLoading: clearing }] = useAllowGroupInvitesMutation();
  const [pendingId, setPendingId] = React.useState<string | null>(null);

  const entries = data?.entries ?? [];

  const undo = (entry: DeclinedInvite) => {
    const name = entry.group?.title ?? 'this group';
    Alert.alert(
      'Allow invites again?',
      `Members of ${name} will be able to invite you. You won't be added to the group — someone has to invite you, and you can decline again.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Allow',
          onPress: async () => {
            setPendingId(entry.group_id);
            try {
              await allowInvites(entry.group_id).unwrap();
            } catch (err: any) {
              Alert.alert(
                "Couldn't do that",
                err?.data?.error ?? 'Something went wrong. Please try again.',
              );
            } finally {
              setPendingId(null);
            }
          },
        },
      ],
    );
  };

  const renderRow = ({ item }: { item: DeclinedInvite }) => {
    const banner = firstGalleryUrl(item.group?.banners) ?? firstGalleryUrl(item.group?.gallery);
    const busy = clearing && pendingId === item.group_id;
    const when = item.declined_at
      ? new Date(item.declined_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
      : null;

    return (
      <View style={[styles.row, { borderBottomColor: c.borderDark }]}>
        {banner ? (
          <Image source={{ uri: banner }} style={styles.thumb} contentFit="cover" />
        ) : (
          <View style={[styles.thumb, styles.thumbEmpty, { backgroundColor: c.segment }]}>
            <Users size={16} color={c.grey} />
          </View>
        )}

        <View style={styles.rowText}>
          <Text style={[styles.title, { color: c.fg }]} numberOfLines={1}>
            {item.group?.title ?? 'Group'}
          </Text>
          {when ? (
            <Text style={[styles.sub, { color: c.grey }]}>Declined {when}</Text>
          ) : null}
        </View>

        <TouchableOpacity
          style={[styles.undoBtn, { borderColor: c.borderDark }]}
          onPress={() => undo(item)}
          disabled={busy}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel={`Allow ${item.group?.title ?? 'this group'} to invite you again`}
        >
          {busy ? (
            <ActivityIndicator size="small" color={c.grey} />
          ) : (
            <>
              <RotateCcw size={13} color={c.fg} strokeWidth={2.4} />
              <Text style={[styles.undoText, { color: c.fg }]}>Allow</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <SharedModal visible={visible} onClose={onClose} title="Declined invitations" heightRatio={0.7}>
      {isLoading ? (
        <Spinner />
      ) : (
        <FlatList
          data={entries}
          keyExtractor={(e) => e.group_id}
          renderItem={renderRow}
          contentContainerStyle={styles.list}
          ListHeaderComponent={
            entries.length > 0 ? (
              <Text style={[styles.intro, { color: c.grey }]}>
                These groups can't invite you while their invitation is declined.
                Allowing one lets its members ask again — it doesn't join you to
                anything.
              </Text>
            ) : null
          }
          ListEmptyComponent={
            <EmptyState
              title="Nothing declined"
              message="Invitations you turn down will show up here, so you can change your mind."
            />
          }
          showsVerticalScrollIndicator={false}
        />
      )}
    </SharedModal>
  );
}

const styles = StyleSheet.create({
  list:  { paddingBottom: 32 },
  intro: { fontSize: 12.5, lineHeight: 18, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 6 },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  thumb:      { width: 46, height: 46, borderRadius: 8 },
  thumbEmpty: { alignItems: 'center', justifyContent: 'center' },
  rowText:    { flex: 1, minWidth: 0 },
  title:      { fontSize: 15, fontWeight: '700' },
  sub:        { fontSize: 12, marginTop: 2 },
  undoBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    minWidth: 78, justifyContent: 'center',
    paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: 999, borderWidth: 1,
  },
  undoText: { fontSize: 13, fontWeight: '700' },
});
