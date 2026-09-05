import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  useGetGroupQuery,
  useGetGroupMembersQuery,
  useLeaveGroupMutation,
} from '../../api/apiService';
import { useAppSelector } from '../../store/store';
import Avatar from '../../components/ui/Avatar';
import Spinner from '../../components/ui/Spinner';
import { colors } from '../../constants/colors';
import { useColors } from '../../hooks/useColors';
import { regionLabel } from '../../constants/regions';
import type { GroupsScreenProps, GroupsStackParamList } from '../../navigation/types';
import { ss } from '../../styles/shared';

type NavProp = NativeStackNavigationProp<GroupsStackParamList>;

export default function GroupSettingsScreen({ route }: GroupsScreenProps<'GroupSettings'>) {
  const { groupId } = route.params;
  const navigation = useNavigation<NavProp>();
  const colors = useColors();
  const { userInfo } = useAppSelector((s) => s.auth);

  const { data: group, isLoading } = useGetGroupQuery(groupId);
  const { data: members = [] } = useGetGroupMembersQuery(groupId);
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
          navigation.goBack();
        },
      },
    ]);
  };

  if (isLoading) return <Spinner fullScreen />;

  return (
    <SafeAreaView style={[ss.fill, { backgroundColor: colors.cream }]} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Group info */}
        <View style={[styles.section, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { backgroundColor: colors.segment, color: colors.grey }]}>Group Info</Text>
          <View style={[styles.infoRow, { borderTopColor: colors.border }]}>
            <Text style={[styles.infoLabel, { color: colors.grey }]}>Name</Text>
            <Text style={[styles.infoValue, { color: colors.fg }]}>{group?.title}</Text>
          </View>
          {group?.region && (
            <View style={[styles.infoRow, { borderTopColor: colors.border }]}>
              <Text style={[styles.infoLabel, { color: colors.grey }]}>Region</Text>
              <Text style={[styles.infoValue, { color: colors.fg }]}>{regionLabel(group.region)}</Text>
            </View>
          )}
          <View style={[styles.infoRow, { borderTopColor: colors.border }]}>
            <Text style={[styles.infoLabel, { color: colors.grey }]}>Members</Text>
            <Text style={[styles.infoValue, { color: colors.fg }]}>{active.length}</Text>
          </View>
        </View>

        {/* Pending requests */}
        {pending.length > 0 && (
          <View style={[styles.section, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
            <Text style={[styles.sectionTitle, { backgroundColor: colors.segment, color: colors.grey }]}>Pending Requests ({pending.length})</Text>
            {pending.map((m) => (
              <View key={m.user_id} style={[styles.memberRow, { borderTopColor: colors.border }]}>
                <Avatar user={m.user} size={36} />
                <View style={styles.memberInfo}>
                  <Text style={[styles.memberName, { color: colors.fg }]}>@{m.user?.username}</Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Danger zone */}
        <View style={[styles.section, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { backgroundColor: colors.segment, color: colors.grey }]}>Danger Zone</Text>
          <TouchableOpacity style={[styles.dangerBtn, { borderTopColor: colors.border }]} onPress={handleLeave}>
            <Text style={styles.dangerText}>Leave Group</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  scroll:      { paddingBottom: 40 },
  section:     { marginBottom: 0, borderBottomWidth: 1 },
  sectionTitle:{ paddingHorizontal: 16, paddingVertical: 8, fontSize: 12, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },
  infoRow:     { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: 1 },
  infoLabel:   { fontSize: 14 },
  infoValue:   { fontSize: 14, fontWeight: '600' },
  memberRow:   { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 10, borderTopWidth: 1 },
  memberInfo:  { flex: 1 },
  memberName:  { fontSize: 14, fontWeight: '600' },
  memberHandle:{ fontSize: 12 },
  dangerBtn:   { paddingHorizontal: 16, paddingVertical: 14, borderTopWidth: 1 },
  dangerText:  { fontSize: 15, fontWeight: '600', color: colors.red },
});
