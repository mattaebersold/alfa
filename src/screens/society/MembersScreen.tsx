import React, { useState, useMemo } from 'react';
import {
  View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Search } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSearchUsersQuery } from '../../api/apiService';
import FeaturedMembersRow from '../../components/members/FeaturedMembersRow';
import Avatar from '../../components/ui/Avatar';
import Spinner from '../../components/ui/Spinner';
import EmptyState from '../../components/ui/EmptyState';
import { Colors } from '../../constants/colors';
import { useColors } from '../../hooks/useColors';
import type { AppStackParamList } from '../../navigation/types';
import type { User } from '../../types/api';

type NavProp = NativeStackNavigationProp<AppStackParamList>;

function MemberRow({ user, onPress }: { user: User; onPress: () => void }) {
  const colors = useColors();
  return (
    <TouchableOpacity style={[styles.row, { backgroundColor: colors.card, borderBottomColor: colors.border }]} onPress={onPress} activeOpacity={0.7}>
      <Avatar filename={user.gallery?.[0]?.filename} name={user.firstName} size={44} />
      <View style={styles.info}>
        <Text style={[styles.name, { color: colors.fg }]}>{user.firstName} {user.lastName}</Text>
        <Text style={[styles.username, { color: colors.grey }]}>@{user.username}</Text>
        {user.cityState && <Text style={[styles.location, { color: colors.grey }]}>{user.cityState}</Text>}
      </View>
      <Text style={[styles.arrow, { color: colors.grey }]}>›</Text>
    </TouchableOpacity>
  );
}

export default function MembersScreen() {
  const navigation = useNavigation<NavProp>();
  const colors = useColors();
  const [query, setQuery] = useState('');

  const { data: usersData, isLoading } = useSearchUsersQuery(query, {
    skip: query.length < 1,
  });
  const users = usersData?.entries ?? [];

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.cream }]} edges={['bottom']}>
      <View style={[styles.searchBar, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Search size={16} color={colors.grey} />
        <TextInput
          style={[styles.searchInput, { color: colors.fg }]}
          value={query}
          onChangeText={setQuery}
          placeholder="Search members..."
          placeholderTextColor={colors.grey}
          autoCapitalize="none"
        />
      </View>

      {isLoading ? (
        <Spinner fullScreen />
      ) : query.length < 1 ? (
        <>
          <FeaturedMembersRow
            onMemberPress={(userId, username) => navigation.navigate('UserDetail', { userId, username })}
          />
          <View style={styles.hint}>
            <Text style={[styles.hintText, { color: colors.grey }]}>Search to find members</Text>
          </View>
        </>
      ) : (
        <FlatList
          data={users}
          keyExtractor={(u) => u.user_id}
          renderItem={({ item }) => (
            <MemberRow
              user={item}
              onPress={() => navigation.navigate('UserDetail', { userId: item.user_id, username: item.username })}
            />
          )}
          ListEmptyComponent={<EmptyState title="No members found" />}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.list}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:        { flex: 1 },
  searchBar:   {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    margin: 12, paddingHorizontal: 14, paddingVertical: 10,
    borderRadius: 10, borderWidth: 1,
  },
  searchInput: { flex: 1, fontSize: 15 },
  hint:        { flex: 1, alignItems: 'center', paddingTop: 60 },
  hintText:    { fontSize: 15 },
  list:        { paddingBottom: 24 },
  row:         {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1,
  },
  info:        { flex: 1 },
  name:        { fontSize: 15, fontWeight: '700' },
  username:    { fontSize: 13, marginTop: 1 },
  location:    { fontSize: 12, marginTop: 2 },
  arrow:       { fontSize: 20 },
});
