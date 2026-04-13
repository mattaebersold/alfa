import React from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useGetGroupMembersQuery } from '../../api/apiService';
import Avatar from '../../components/ui/Avatar';
import Spinner from '../../components/ui/Spinner';
import EmptyState from '../../components/ui/EmptyState';
import { Colors } from '../../constants/colors';
import type { GroupsScreenProps, AppStackParamList } from '../../navigation/types';
import type { GroupMember } from '../../types/api';

type AppNav = NativeStackNavigationProp<AppStackParamList>;

function MemberRow({ member, onPress }: { member: GroupMember; onPress: () => void }) {
  const isAdmin = member.member_type === 'admin';
  return (
    <TouchableOpacity style={styles.row} onPress={onPress} activeOpacity={0.7}>
      <Avatar
        filename={member.user?.gallery?.[0]?.filename}
        name={member.user?.firstName ?? '?'}
        size={42}
      />
      <View style={styles.info}>
        <Text style={styles.name}>
          {member.user?.firstName} {member.user?.lastName}
        </Text>
        <Text style={styles.username}>@{member.user?.username}</Text>
      </View>
      {isAdmin && (
        <View style={styles.adminBadge}>
          <Text style={styles.adminText}>Admin</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

export default function GroupMembersScreen({ route }: GroupsScreenProps<'GroupMembers'>) {
  const { groupId } = route.params;
  const navigation = useNavigation<AppNav>();
  const { data: members = [], isLoading } = useGetGroupMembersQuery(groupId);

  const active = members.filter((m) => m.status === 'active');

  if (isLoading) return <Spinner fullScreen />;

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <FlatList
        data={active}
        keyExtractor={(m) => m.user_id}
        renderItem={({ item }) => (
          <MemberRow
            member={item}
            onPress={() => item.user_id && navigation.navigate('UserDetail', { userId: item.user_id })}
          />
        )}
        ListHeaderComponent={
          <View style={styles.listHeader}>
            <Text style={styles.listHeaderText}>{active.length} Member{active.length !== 1 ? 's' : ''}</Text>
          </View>
        }
        ListEmptyComponent={<EmptyState title="No members yet" />}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.list}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:        { flex: 1, backgroundColor: Colors.cream },
  list:        { flexGrow: 1, paddingBottom: 24 },
  listHeader:  { paddingHorizontal: 16, paddingVertical: 10, backgroundColor: Colors.segment, borderBottomWidth: 1, borderBottomColor: Colors.border },
  listHeaderText: { fontSize: 12, fontWeight: '800', color: Colors.grey, textTransform: 'uppercase', letterSpacing: 0.5 },
  row:         {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#FFFFFF', paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: '#F0F0F0',
  },
  info:        { flex: 1 },
  name:        { fontSize: 15, fontWeight: '600', color: Colors.fg },
  username:    { fontSize: 13, color: Colors.grey, marginTop: 1 },
  adminBadge:  { backgroundColor: Colors.brg, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  adminText:   { fontSize: 11, fontWeight: '700', color: '#FFFFFF' },
});
