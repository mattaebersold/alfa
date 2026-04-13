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
import { Colors } from '../../constants/colors';
import { imageUrl, firstGalleryUrl } from '../../utils/image';
import type { AppStackParamList } from '../../navigation/types';
import type { User, Post, GarageCar } from '../../types/api';

type NavProp = NativeStackNavigationProp<AppStackParamList>;

function UserRow({ user, onPress }: { user: User; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.resultRow} onPress={onPress} activeOpacity={0.7}>
      <Avatar filename={user.gallery?.[0]?.filename} name={user.firstName} size={36} />
      <View style={styles.resultInfo}>
        <Text style={styles.resultTitle}>{user.firstName} {user.lastName}</Text>
        <Text style={styles.resultSub}>@{user.username}</Text>
      </View>
    </TouchableOpacity>
  );
}

function CarRow({ car, onPress }: { car: GarageCar; onPress: () => void }) {
  const hero = firstGalleryUrl(car.gallery) ?? (car.profile_image ? imageUrl(car.profile_image) : null);
  return (
    <TouchableOpacity style={styles.resultRow} onPress={onPress} activeOpacity={0.7}>
      {hero
        ? <Image source={{ uri: hero }} style={styles.resultThumb} contentFit="cover" />
        : <View style={[styles.resultThumb, styles.thumbPlaceholder]} />
      }
      <View style={styles.resultInfo}>
        <Text style={styles.resultTitle}>{car.year} {car.make} {car.model}</Text>
        {car.type && <Text style={styles.resultSub}>{car.type}</Text>}
      </View>
    </TouchableOpacity>
  );
}

function PostRow({ post, onPress }: { post: Post; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.resultRow} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.resultInfo}>
        <Text style={styles.resultTitle} numberOfLines={1}>{post.title ?? '(Untitled)'}</Text>
        {post.body && <Text style={styles.resultSub} numberOfLines={1}>{post.body.replace(/<[^>]*>/g, '')}</Text>}
      </View>
    </TouchableOpacity>
  );
}

export default function SearchScreen() {
  const navigation = useNavigation<NavProp>();
  const [query, setQuery] = useState('');
  const debouncedQuery = query.trim();

  const { data: results, isLoading } = useSearchQuery(debouncedQuery, {
    skip: debouncedQuery.length < 2,
  });

  const users: User[] = results?.users ?? [];
  const cars: GarageCar[] = results?.cars ?? [];
  const posts: Post[] = results?.posts ?? [];

  const hasResults = users.length > 0 || cars.length > 0 || posts.length > 0;

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      {/* Search bar */}
      <View style={styles.searchBar}>
        <SearchIcon size={16} color={Colors.grey} />
        <TextInput
          style={styles.searchInput}
          value={query}
          onChangeText={setQuery}
          placeholder="Search members, cars, posts..."
          placeholderTextColor={Colors.grey}
          autoFocus
          autoCapitalize="none"
          returnKeyType="search"
        />
        {query.length > 0 && (
          <TouchableOpacity onPress={() => setQuery('')}>
            <Text style={styles.clearBtn}>✕</Text>
          </TouchableOpacity>
        )}
      </View>

      {isLoading && debouncedQuery.length >= 2 ? (
        <Spinner fullScreen />
      ) : debouncedQuery.length < 2 ? (
        <View style={styles.hint}>
          <Text style={styles.hintText}>Type at least 2 characters to search</Text>
        </View>
      ) : !hasResults ? (
        <View style={styles.hint}>
          <Text style={styles.hintText}>No results for "{debouncedQuery}"</Text>
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.list}>
          {users.length > 0 && (
            <View>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Members</Text>
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
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Cars</Text>
              </View>
              {cars.slice(0, 5).map((c) => (
                <CarRow
                  key={c.internal_id}
                  car={c}
                  onPress={() => navigation.navigate('CarDetailModal', { carId: c.internal_id })}
                />
              ))}
            </View>
          )}

          {posts.length > 0 && (
            <View>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Posts</Text>
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:        { flex: 1, backgroundColor: Colors.cream },
  searchBar:   {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    margin: 12, paddingHorizontal: 14, paddingVertical: 10,
    backgroundColor: '#FFFFFF', borderRadius: 10, borderWidth: 1, borderColor: Colors.border,
  },
  searchInput: { flex: 1, fontSize: 15, color: Colors.fg },
  clearBtn:    { fontSize: 14, color: Colors.grey, padding: 4 },
  hint:        { flex: 1, alignItems: 'center', paddingTop: 60 },
  hintText:    { fontSize: 15, color: Colors.grey },
  list:        { paddingBottom: 24 },
  sectionHeader: {
    paddingHorizontal: 16, paddingVertical: 8,
    backgroundColor: Colors.segment, borderTopWidth: 1, borderBottomWidth: 1, borderColor: Colors.border,
  },
  sectionTitle:{ fontSize: 12, fontWeight: '800', color: Colors.grey, textTransform: 'uppercase', letterSpacing: 0.5 },
  resultRow:   {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#FFFFFF', paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: '#F0F0F0',
  },
  resultThumb: { width: 40, height: 40, borderRadius: 6 },
  thumbPlaceholder: { backgroundColor: Colors.secondary },
  resultInfo:  { flex: 1 },
  resultTitle: { fontSize: 15, fontWeight: '600', color: Colors.fg },
  resultSub:   { fontSize: 13, color: Colors.grey, marginTop: 2 },
});
