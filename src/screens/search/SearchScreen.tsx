import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Search as SearchIcon } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Image } from 'expo-image';
import { useSearchQuery } from '../../api/apiService';
import Avatar from '../../components/ui/Avatar';
import Spinner from '../../components/ui/Spinner';
import AppHeader from '../../components/ui/AppHeader';
import { colors } from '../../constants/colors';
import { useColors } from '../../hooks/useColors';
import { imageUrl, firstGalleryUrl } from '../../utils/image';
import type { AppStackParamList } from '../../navigation/types';
import type { User, Post, GarageCar } from '../../types/api';
import { stripHtml } from '../../utils/text';
import { ss } from '../../styles/shared';
import { useRefreshControl } from '../../hooks/useRefreshControl';

type NavProp = NativeStackNavigationProp<AppStackParamList>;

function UserRow({ user, onPress }: { user: User; onPress: () => void }) {
  const colors = useColors();
  return (
    <TouchableOpacity style={[styles.resultRow, { backgroundColor: colors.card, borderBottomColor: colors.border }]} onPress={onPress} activeOpacity={0.7}>
      <Avatar filename={user.gallery?.[0]?.filename} name={user.username ?? '?'} size={36} />
      <Text style={[styles.resultTitle, { color: colors.fg }]}>@{user.username}</Text>
    </TouchableOpacity>
  );
}

function CarRow({ car, onPress }: { car: GarageCar; onPress: () => void }) {
  const colors = useColors();
  const hero = firstGalleryUrl(car.gallery) ?? (car.profile_image ? imageUrl(car.profile_image) : null);
  return (
    <TouchableOpacity style={[styles.resultRow, { backgroundColor: colors.card, borderBottomColor: colors.border }]} onPress={onPress} activeOpacity={0.7}>
      {hero
        ? <Image source={{ uri: hero }} style={styles.resultThumb} contentFit="cover" />
        : <View style={[styles.resultThumb, { backgroundColor: colors.secondary }]} />
      }
      <View style={styles.resultInfo}>
        <Text style={[styles.resultTitle, { color: colors.fg }]}>{car.year} {car.make} {car.model}</Text>
        {car.type && <Text style={[styles.resultSub, { color: colors.grey }]}>{car.type}</Text>}
      </View>
    </TouchableOpacity>
  );
}

function PostRow({ post, onPress }: { post: Post; onPress: () => void }) {
  const colors = useColors();
  return (
    <TouchableOpacity style={[styles.resultRow, { backgroundColor: colors.card, borderBottomColor: colors.border }]} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.resultInfo}>
        <Text style={[styles.resultTitle, { color: colors.fg }]} numberOfLines={1}>{post.title ?? '(Untitled)'}</Text>
        {post.body && <Text style={[styles.resultSub, { color: colors.grey }]} numberOfLines={1}>{stripHtml(post.body)}</Text>}
      </View>
    </TouchableOpacity>
  );
}

export default function SearchScreen() {
  const navigation = useNavigation<NavProp>();
  const colors = useColors();
  const [query, setQuery] = useState('');
  const debouncedQuery = query.trim();

  const { data: results, isLoading, refetch } = useSearchQuery(debouncedQuery, {
    skip: debouncedQuery.length < 2,
  });
  const refreshControl = useRefreshControl(() => {
    if (debouncedQuery.length >= 2) return refetch();
  });

  const users: User[] = results?.users ?? [];
  const cars: GarageCar[] = results?.cars ?? [];
  const posts: Post[] = results?.posts ?? [];

  const hasResults = users.length > 0 || cars.length > 0 || posts.length > 0;

  return (
    <SafeAreaView style={[ss.fill, { backgroundColor: colors.cream }]} edges={[]}>
      <AppHeader spacer />
      <View style={[styles.searchContent, { backgroundColor: colors.cream }]}>
      {/* Search bar */}
      <View style={[styles.searchBar, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <SearchIcon size={16} color={colors.grey} />
        <TextInput
          style={[styles.searchInput, { color: colors.fg }]}
          value={query}
          onChangeText={setQuery}
          placeholder="Search members, cars, posts..."
          placeholderTextColor={colors.grey}
          autoFocus
          autoCapitalize="none"
          returnKeyType="search"
        />
        {query.length > 0 && (
          <TouchableOpacity onPress={() => setQuery('')}>
            <Text style={[styles.clearBtn, { color: colors.grey }]}>✕</Text>
          </TouchableOpacity>
        )}
      </View>

      {isLoading && debouncedQuery.length >= 2 ? (
        <Spinner fullScreen />
      ) : debouncedQuery.length < 2 ? (
        <View style={styles.hint}>
          <Text style={[styles.hintText, { color: colors.grey }]}>Type at least 2 characters to search</Text>
        </View>
      ) : !hasResults ? (
        <View style={styles.hint}>
          <Text style={[styles.hintText, { color: colors.grey }]}>No results for "{debouncedQuery}"</Text>
        </View>
      ) : (
        <ScrollView refreshControl={refreshControl} showsVerticalScrollIndicator={false} contentContainerStyle={styles.list}>
          {users.length > 0 && (
            <View>
              <View style={[ss.sectionHeader, { backgroundColor: colors.segment, borderColor: colors.border }]}>
                <Text style={[ss.sectionTitle, { color: colors.grey }]}>Members</Text>
              </View>
              {users.slice(0, 5).map((u) => (
                <UserRow
                  key={u.user_id}
                  user={u}
                  onPress={() => navigation.navigate('UserDetail', { userId: u.user_id, username: u.username })}
                />
              ))}
            </View>
          )}

          {cars.length > 0 && (
            <View>
              <View style={[ss.sectionHeader, { backgroundColor: colors.segment, borderColor: colors.border }]}>
                <Text style={[ss.sectionTitle, { color: colors.grey }]}>Cars</Text>
              </View>
              {cars.slice(0, 5).map((c) => (
                <CarRow
                  key={c.internal_id}
                  car={c}
                  onPress={() => (navigation as any).navigate('CarDetail', { carId: c.internal_id })}
                />
              ))}
            </View>
          )}

          {posts.length > 0 && (
            <View>
              <View style={[ss.sectionHeader, { backgroundColor: colors.segment, borderColor: colors.border }]}>
                <Text style={[ss.sectionTitle, { color: colors.grey }]}>Posts</Text>
              </View>
              {posts.slice(0, 5).map((p) => (
                <PostRow
                  key={p.internal_id}
                  post={p}
                  onPress={() => navigation.navigate('PostDetailModal', { postId: p.internal_id })}
                />
              ))}
            </View>
          )}
        </ScrollView>
      )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  searchContent: { flex: 1 },
  searchBar:   {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    margin: 12, paddingHorizontal: 14, paddingVertical: 10,
    borderRadius: 10, borderWidth: 1,
  },
  searchInput: { flex: 1, fontSize: 15 },
  clearBtn:    { fontSize: 14, padding: 4 },
  hint:        { flex: 1, alignItems: 'center', paddingTop: 60 },
  hintText:    { fontSize: 15 },
  list:        { paddingBottom: 24 },
  resultRow:   {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1,
  },
  resultThumb: { width: 40, height: 40, borderRadius: 6 },
  resultInfo:  { flex: 1 },
  resultTitle: { fontSize: 15, fontWeight: '600' },
  resultSub:   { fontSize: 13, marginTop: 2 },
});
