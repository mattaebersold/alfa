import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Search } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useGetUsersQuery } from '../../api/apiService';
import FollowButton from '../../components/social/FollowButton';
import FeaturedMembersRow from '../../components/members/FeaturedMembersRow';
import Avatar from '../../components/ui/Avatar';
import Spinner from '../../components/ui/Spinner';
import EmptyState from '../../components/ui/EmptyState';
import { useColors } from '../../hooks/useColors';
import { useAppSelector } from '../../store/store';
import type { AppStackParamList } from '../../navigation/types';
import type { User } from '../../types/api';
import { ss } from '../../styles/shared';

type NavProp = NativeStackNavigationProp<AppStackParamList>;

const LIMIT = 20;

function MemberRow({ user, onPress }: { user: User; onPress: () => void }) {
  const colors = useColors();
  const { userInfo } = useAppSelector((s: any) => s.auth);
  return (
    <TouchableOpacity style={[ss.listRow, { backgroundColor: colors.card, borderBottomColor: colors.border }]} onPress={onPress} activeOpacity={0.7}>
      <Avatar filename={user.gallery?.[0]?.filename} name={user.username ?? '?'} size={44} />
      <View style={styles.info}>
        <Text style={[styles.name, { color: colors.fg }]}>@{user.username}</Text>
        {user.cityState && <Text style={[styles.location, { color: colors.grey }]}>{user.cityState}</Text>}
      </View>
      {user.username && user.user_id !== userInfo?.user_id && (
        <FollowButton username={user.username} />
      )}
    </TouchableOpacity>
  );
}

export default function MembersScreen() {
  const navigation = useNavigation<NavProp>();
  const colors = useColors();
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(0);
  const [allUsers, setAllUsers] = useState<User[]>([]);

  const { data, isLoading, isFetching } = useGetUsersQuery({ page, limit: LIMIT, q: query || undefined });

  React.useEffect(() => {
    if (data?.entries) {
      if (page === 0) setAllUsers(data.entries);
      else setAllUsers((prev) => {
        const ids = new Set(prev.map((u) => u.user_id));
        return [...prev, ...data.entries.filter((u) => !ids.has(u.user_id))];
      });
    }
  }, [data, page]);

  const handleQueryChange = useCallback((text: string) => {
    setQuery(text);
    setPage(0);
    setAllUsers([]);
  }, []);

  const handleLoadMore = useCallback(() => {
    if (!isFetching && data && allUsers.length < data.total) setPage((p) => p + 1);
  }, [isFetching, data, allUsers.length]);

  const handleRefresh = useCallback(() => {
    setPage(0);
    setAllUsers([]);
  }, []);

  const ListHeader = (
    <>
      <FeaturedMembersRow
        onMemberPress={(userId, username) => navigation.navigate('UserDetail', { userId, username })}
      />
      <View style={[styles.searchBar, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Search size={16} color={colors.grey} />
        <TextInput
          style={[styles.searchInput, { color: colors.fg }]}
          value={query}
          onChangeText={handleQueryChange}
          placeholder="Search members..."
          placeholderTextColor={colors.grey}
          autoCapitalize="none"
        />
      </View>
    </>
  );

  return (
    <SafeAreaView style={[ss.fill, { backgroundColor: colors.cream }]} edges={['bottom']}>
      <FlatList
        data={allUsers}
        keyExtractor={(u) => u.user_id}
        ListHeaderComponent={ListHeader}
        renderItem={({ item }) => (
          <MemberRow
            user={item}
            onPress={() => navigation.navigate('UserDetail', { userId: item.user_id, username: item.username })}
          />
        )}
        ListEmptyComponent={
          isLoading ? <Spinner fullScreen /> : <EmptyState title="No members found" />
        }
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.3}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.list}
        onRefresh={handleRefresh}
        refreshing={false}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  searchBar:   {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    margin: 12, paddingHorizontal: 14, paddingVertical: 10,
    borderRadius: 10, borderWidth: 1,
  },
  searchInput: { flex: 1, fontSize: 15 },
  list:        { paddingBottom: 24 },
  info:        { flex: 1 },
  name:        { fontSize: 15, fontWeight: '700' },
  location:    { fontSize: 12, marginTop: 2 },
});
