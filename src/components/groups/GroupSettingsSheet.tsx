import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import {
  useGetGroupQuery,
  useGetGroupMembersQuery,
  useLeaveGroupMutation,
} from '../../api/apiService';
import Avatar from '../ui/Avatar';
import Spinner from '../ui/Spinner';
import SharedModal from '../ui/SharedModal';
import { colors } from '../../constants/colors';
import { useColors } from '../../hooks/useColors';

/**
 * Group settings as a sheet.
 *
 * Same content the dedicated screen carried, but reachable from anywhere in the
 * group without leaving the section you're in — settings is a detour, and
 * pushing a screen for it means coming back to the top of a list you'd scrolled.
 */
export default function GroupSettingsSheet({
  groupId,
  visible,
  onClose,
}: {
  groupId: string;
  visible: boolean;
  onClose: () => void;
}) {
  const c = useColors();

  // Nothing to fetch until it's opened.
  const { data: group, isLoading } = useGetGroupQuery(groupId, { skip: !visible });
  const { data: members = [] } = useGetGroupMembersQuery(groupId, { skip: !visible });
  const [leaveGroup] = useLeaveGroupMutation();

  const pending = members.filter((m) => m.status === 'pending');
  const active  = members.filter((m) => m.status === 'active');

  const handleLeave = () => {
    Alert.alert('Leave group?', 'You can rejoin later.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Leave',
        style: 'destructive',
        onPress: async () => {
          await leaveGroup(groupId);
          onClose();
        },
      },
    ]);
  };

  return (
    <SharedModal visible={visible} onClose={onClose} title="Group Settings" heightRatio={0.8}>
      {isLoading ? <Spinner /> : (
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          {/* Group info */}
          <View style={[styles.section, { backgroundColor: c.card, borderBottomColor: c.borderDark }]}>
            <Text style={[styles.sectionTitle, { backgroundColor: c.secondary, color: c.grey }]}>Group Info</Text>
            <View style={[styles.infoRow, { borderTopColor: c.borderDark }]}>
              <Text style={[styles.infoLabel, { color: c.grey }]}>Name</Text>
              <Text style={[styles.infoValue, { color: c.fg }]}>{group?.title}</Text>
            </View>
            {group?.region && (
              <View style={[styles.infoRow, { borderTopColor: c.borderDark }]}>
                <Text style={[styles.infoLabel, { color: c.grey }]}>Region</Text>
                <Text style={[styles.infoValue, { color: c.fg }]}>{group.region}</Text>
              </View>
            )}
            <View style={[styles.infoRow, { borderTopColor: c.borderDark }]}>
              <Text style={[styles.infoLabel, { color: c.grey }]}>Members</Text>
              <Text style={[styles.infoValue, { color: c.fg }]}>{active.length}</Text>
            </View>
          </View>

          {/* Pending requests */}
          {pending.length > 0 && (
            <View style={[styles.section, { backgroundColor: c.card, borderBottomColor: c.borderDark }]}>
              <Text style={[styles.sectionTitle, { backgroundColor: c.secondary, color: c.grey }]}>
                Pending Requests ({pending.length})
              </Text>
              {pending.map((m) => (
                <View key={m.user_id} style={[styles.memberRow, { borderTopColor: c.borderDark }]}>
                  <Avatar filename={m.user?.gallery?.[0]?.filename} name={m.user?.username ?? '?'} size={36} />
                  <View style={styles.memberInfo}>
                    <Text style={[styles.memberName, { color: c.fg }]}>@{m.user?.username}</Text>
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* Danger zone */}
          <View style={[styles.section, { backgroundColor: c.card, borderBottomColor: c.borderDark }]}>
            <Text style={[styles.sectionTitle, { backgroundColor: c.secondary, color: c.grey }]}>Danger Zone</Text>
            <TouchableOpacity style={[styles.dangerBtn, { borderTopColor: c.borderDark }]} onPress={handleLeave}>
              <Text style={styles.dangerText}>Leave Group</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      )}
    </SharedModal>
  );
}

const styles = StyleSheet.create({
  scroll:      { paddingBottom: 40 },
  section:     { borderBottomWidth: StyleSheet.hairlineWidth },
  sectionTitle:{ paddingHorizontal: 16, paddingVertical: 8, fontSize: 12, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },
  infoRow:     { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: StyleSheet.hairlineWidth },
  infoLabel:   { fontSize: 14 },
  infoValue:   { fontSize: 14, fontWeight: '600' },
  memberRow:   { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 10, borderTopWidth: StyleSheet.hairlineWidth },
  memberInfo:  { flex: 1 },
  memberName:  { fontSize: 14, fontWeight: '600' },
  dangerBtn:   { paddingHorizontal: 16, paddingVertical: 14, borderTopWidth: StyleSheet.hairlineWidth },
  dangerText:  { fontSize: 15, fontWeight: '600', color: colors.red },
});
