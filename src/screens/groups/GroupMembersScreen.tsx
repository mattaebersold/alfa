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
import { colors } from '../../constants/colors';
import { useColors } from '../../hooks/useColors';
import type { GroupsScreenProps, AppStackParamList } from '../../navigation/types';
import type { GroupMember } from '../../types/api';
import { ss } from '../../styles/shared';

type AppNav = NativeStackNavigationProp<AppStackParamList>;

function MemberRow({ member, onPress }: { member: GroupMember; onPress: () => void }) {
  const colors = useColors();
  const isAdmin = member.member_type === 'admin';
  return (
    <TouchableOpacity style={[ss.listRow, { backgroundColor: colors.card, borderBottomColor: colors.border }]} onPress={onPress} activeOpacity={0.7}>
      <Avatar
        filename={member.user?.gallery?.[0]?.filename}
        name={member.user?.firstName ?? '?'}
        size={42}
      />
      <View style={styles.info}>
        <Text style={[styles.name, { color: colors.fg }]}>
          {member.user?.firstName} {member.user?.lastName}
        </Text>
        <Text style={[styles.username, { color: colors.grey }]}>@{member.user?.username}</Text>
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
  const colors = useColors();
  const { data: members = [], isLoading } = useGetGroupMembersQuery(groupId);

  const active = members.filter((m) => m.status === 'active');

  if (isLoading) return <Spinner fullScreen />;

  return (
    <SafeAreaView style={[ss.fill, { backgroundColor: colors.cream }]} edges={['bottom']}>
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
          <View style={[styles.listHeader, { backgroundColor: colors.segment, borderBottomColor: colors.border }]}>
            <Text style={[styles.listHeaderText, { color: colors.grey }]}>{active.length} Member{active.length !== 1 ? 's' : ''}</Text>
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
  list:        { flexGrow: 1, paddingBottom: 24 },
  listHeader:  { paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1 },
  listHeaderText: { fontSize: 12, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },
  info:        { flex: 1 },
  name:        { fontSize: 15, fontWeight: '600' },
  username:    { fontSize: 13, marginTop: 1 },
  adminBadge:  { backgroundColor: colors.primaryAlt, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  adminText:   { fontSize: 11, fontWeight: '700', color: '#FFFFFF' },
});
