import React, { useState, useMemo } from 'react';
import {
  View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Search } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSearchUsersQuery } from '../../api/apiService';
import Avatar from '../../components/ui/Avatar';
import Spinner from '../../components/ui/Spinner';
import EmptyState from '../../components/ui/EmptyState';
import { Colors } from '../../constants/colors';
import type { AppStackParamList } from '../../navigation/types';
import type { User } from '../../types/api';

type NavProp = NativeStackNavigationProp<AppStackParamList>;

function MemberRow({ user, onPress }: { user: User; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.row} onPress={onPress} activeOpacity={0.7}>
      <Avatar filename={user.gallery?.[0]?.filename} name={user.firstName} size={44} />
      <View style={styles.info}>
        <Text style={styles.name}>{user.firstName} {user.lastName}</Text>
        <Text style={styles.username}>@{user.username}</Text>
        {user.cityState && <Text style={styles.location}>{user.cityState}</Text>}
      </View>
      <Text style={styles.arrow}>›</Text>
    </TouchableOpacity>
  );
}

export default function MembersScreen() {
  const navigation = useNavigation<NavProp>();
  const [query, setQuery] = useState('');

  const { data: users = [], isLoading } = useSearchUsersQuery(query, {
    skip: query.length < 1,
  });

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <View style={styles.searchBar}>
        <Search size={16} color={Colors.grey} />
        <TextInput
          style={styles.searchInput}
          value={query}
          onChangeText={setQuery}
          placeholder="Search members..."
          placeholderTextColor={Colors.grey}
          autoCapitalize="none"
        />
      </View>

      {isLoading ? (
        <Spinner fullScreen />
      ) : query.length < 1 ? (
        <View style={styles.hint}>
          <Text style={styles.hintText}>Search to find members</Text>
        </View>
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
  safe:        { flex: 1, backgroundColor: Colors.cream },
  searchBar:   {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    margin: 12, paddingHorizontal: 14, paddingVertical: 10,
    backgroundColor: '#FFFFFF', borderRadius: 10, borderWidth: 1, borderColor: Colors.border,
  },
  searchInput: { flex: 1, fontSize: 15, color: Colors.fg },
  hint:        { flex: 1, alignItems: 'center', paddingTop: 60 },
  hintText:    { fontSize: 15, color: Colors.grey },
  list:        { paddingBottom: 24 },
  row:         {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#FFFFFF', paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: '#F0F0F0',
  },
  info:        { flex: 1 },
  name:        { fontSize: 15, fontWeight: '700', color: Colors.fg },
  username:    { fontSize: 13, color: Colors.grey, marginTop: 1 },
  location:    { fontSize: 12, color: Colors.grey, marginTop: 2 },
  arrow:       { fontSize: 20, color: Colors.grey },
});
