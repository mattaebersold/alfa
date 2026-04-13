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
import { Colors } from '../../constants/colors';
import type { GroupsScreenProps, GroupsStackParamList } from '../../navigation/types';

type NavProp = NativeStackNavigationProp<GroupsStackParamList>;

export default function GroupSettingsScreen({ route }: GroupsScreenProps<'GroupSettings'>) {
  const { groupId } = route.params;
  const navigation = useNavigation<NavProp>();
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
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Group info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Group Info</Text>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Name</Text>
            <Text style={styles.infoValue}>{group?.title}</Text>
          </View>
          {group?.region && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Region</Text>
              <Text style={styles.infoValue}>{group.region}</Text>
            </View>
          )}
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Members</Text>
            <Text style={styles.infoValue}>{active.length}</Text>
          </View>
        </View>

        {/* Pending requests */}
        {pending.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Pending Requests ({pending.length})</Text>
            {pending.map((m) => (
              <View key={m.user_id} style={styles.memberRow}>
                <Avatar filename={m.user?.gallery?.[0]?.filename} name={m.user?.firstName ?? '?'} size={36} />
                <View style={styles.memberInfo}>
                  <Text style={styles.memberName}>{m.user?.firstName} {m.user?.lastName}</Text>
                  <Text style={styles.memberHandle}>@{m.user?.username}</Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Danger zone */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Danger Zone</Text>
          <TouchableOpacity style={styles.dangerBtn} onPress={handleLeave}>
            <Text style={styles.dangerText}>Leave Group</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:        { flex: 1, backgroundColor: Colors.cream },
  scroll:      { paddingBottom: 40 },
  section:     { backgroundColor: '#FFFFFF', marginBottom: 0, borderBottomWidth: 1, borderBottomColor: Colors.border },
  sectionTitle:{ paddingHorizontal: 16, paddingVertical: 8, backgroundColor: Colors.segment, fontSize: 12, fontWeight: '800', color: Colors.grey, textTransform: 'uppercase', letterSpacing: 0.5 },
  infoRow:     { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: 1, borderTopColor: '#F5F5F5' },
  infoLabel:   { fontSize: 14, color: Colors.grey },
  infoValue:   { fontSize: 14, fontWeight: '600', color: Colors.fg },
  memberRow:   { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 10, borderTopWidth: 1, borderTopColor: '#F5F5F5' },
  memberInfo:  { flex: 1 },
  memberName:  { fontSize: 14, fontWeight: '600', color: Colors.fg },
  memberHandle:{ fontSize: 12, color: Colors.grey },
  dangerBtn:   { paddingHorizontal: 16, paddingVertical: 14, borderTopWidth: 1, borderTopColor: '#F5F5F5' },
  dangerText:  { fontSize: 15, fontWeight: '600', color: Colors.red },
});
