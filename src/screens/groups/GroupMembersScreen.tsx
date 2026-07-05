import React, { useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Search } from 'lucide-react-native';
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
        name={member.user?.username ?? '?'}
        size={42}
      />
      <View style={styles.info}>
        <Text style={[styles.name, { color: colors.fg }]}>@{member.user?.username}</Text>
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
  const [query, setQuery] = useState('');
  const { data: members = [], isLoading } = useGetGroupMembersQuery(groupId);

  const q = query.trim().toLowerCase();
  const active = members
    .filter((m) => m.status === 'active')
    .filter((m) => !q || (m.user?.username ?? '').toLowerCase().includes(q));

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
          <View>
            <View style={[styles.searchBar, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Search size={15} color={colors.grey} />
              <TextInput
                style={[styles.searchInput, { color: colors.fg }]}
                value={query}
                onChangeText={setQuery}
                placeholder="Search by username..."
                placeholderTextColor={colors.grey}
                autoCapitalize="none"
              />
            </View>
            <View style={[styles.listHeader, { backgroundColor: colors.segment, borderBottomColor: colors.border }]}>
              <Text style={[styles.listHeaderText, { color: colors.grey }]}>{active.length} Member{active.length !== 1 ? 's' : ''}</Text>
            </View>
          </View>
        }
        ListEmptyComponent={<EmptyState title={query ? 'No members match' : 'No members yet'} />}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.list}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  list:        { flexGrow: 1, paddingBottom: 24 },
  searchBar:   {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    margin: 12, paddingHorizontal: 12, paddingVertical: 9,
    borderRadius: 10, borderWidth: 1,
  },
  searchInput: { flex: 1, fontSize: 14 },
  listHeader:  { paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1 },
  listHeaderText: { fontSize: 12, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },
  info:        { flex: 1 },
  name:        { fontSize: 15, fontWeight: '600' },
  username:    { fontSize: 13, marginTop: 1 },
  adminBadge:  { backgroundColor: colors.primaryAlt, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  adminText:   { fontSize: 11, fontWeight: '700', color: '#FFFFFF' },
});
