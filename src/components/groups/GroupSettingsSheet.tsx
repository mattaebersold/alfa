import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { UserMinus } from 'lucide-react-native';
import {
  useGetGroupQuery,
  useGetGroupMembersQuery,
  useLeaveGroupMutation,
  useRemoveGroupMemberMutation,
} from '../../api/apiService';
import { useAppSelector } from '../../store/store';
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
  const [removeMember] = useRemoveGroupMemberMutation();
  const { userInfo } = useAppSelector((s) => s.auth);

  const pending = members.filter((m) => m.status === 'pending');
  const active  = members.filter((m) => m.status === 'active');
  const isAdmin = active.some(
    (m) => m.user_id === userInfo?.user_id && m.member_type === 'admin',
  );

  /**
   * Remove someone, once. The server is the authority on whether it's allowed
   * — it refuses to strip the last admin — so its message is what gets shown
   * rather than a guess made here.
   */
  const handleRemove = (userId: string, username?: string) => {
    Alert.alert(
      `Remove @${username ?? 'member'}?`,
      'They lose access to the group and can ask to join again.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              await removeMember({ groupId, userId }).unwrap();
            } catch (err: any) {
              Alert.alert(
                "Couldn't remove",
                err?.data?.error ?? 'Please try again.',
              );
            }
          },
        },
      ],
    );
  };

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

          {/* Members — admins only. This is where you manage who's in, so it's
              where removing someone belongs; the roster elsewhere is for
              reading. */}
          {isAdmin && active.length > 0 && (
            <View style={[styles.section, { backgroundColor: c.card, borderBottomColor: c.borderDark }]}>
              <Text style={[styles.sectionTitle, { backgroundColor: c.secondary, color: c.grey }]}>
                Members ({active.length})
              </Text>
              {active.map((m) => {
                const isMe = m.user_id === userInfo?.user_id;
                return (
                  <View key={m.user_id} style={[styles.memberRow, { borderTopColor: c.borderDark }]}>
                    <Avatar filename={m.user?.gallery?.[0]?.filename} name={m.user?.username ?? '?'} size={36} />
                    <View style={styles.memberInfo}>
                      <Text style={[styles.memberName, { color: c.fg }]}>@{m.user?.username}</Text>
                      {m.member_type === 'admin' && (
                        <Text style={[styles.memberRole, { color: c.grey }]}>Admin</Text>
                      )}
                    </View>
                    {/* No remove button against your own row: leaving is the
                        thing you do to yourself, and it's below. */}
                    {!isMe && (
                      <TouchableOpacity
                        style={[styles.removeBtn, { borderColor: colors.red }]}
                        onPress={() => handleRemove(m.user_id, m.user?.username)}
                        activeOpacity={0.8}
                        accessibilityRole="button"
                        accessibilityLabel={`Remove @${m.user?.username ?? 'member'}`}
                      >
                        <UserMinus size={13} color={colors.red} />
                        <Text style={styles.removeText}>Remove</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                );
              })}
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
  memberRole:  { fontSize: 11, marginTop: 1 },
  removeBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: 999, borderWidth: 1,
  },
  removeText:  { fontSize: 12, fontWeight: '700', color: colors.red },
  dangerBtn:   { paddingHorizontal: 16, paddingVertical: 14, borderTopWidth: StyleSheet.hairlineWidth },
  dangerText:  { fontSize: 15, fontWeight: '600', color: colors.red },
});
