import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TextInput,
  TouchableOpacity,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Search, X } from 'lucide-react-native';
import { formatDistanceToNow } from 'date-fns';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useGetPostsQuery } from '../../api/apiService';
import Spinner from '../../components/ui/Spinner';
import EmptyState from '../../components/ui/EmptyState';
import Badge from '../../components/ui/Badge';
import { Colors } from '../../constants/colors';
import { firstGalleryUrl } from '../../utils/image';
import type { AppStackParamList } from '../../navigation/types';
import type { Post } from '../../types/api';

type Tab = 'listing' | 'want';
type AppNav = NativeStackNavigationProp<AppStackParamList>;

function ListingRow({ post, onPress }: { post: Post; onPress: () => void }) {
  const hero = firstGalleryUrl(post.gallery);
  const timeAgo = post.created_at
    ? formatDistanceToNow(new Date(post.created_at), { addSuffix: true })
    : '';

  return (
    <TouchableOpacity style={styles.row} onPress={onPress} activeOpacity={0.8}>
      {hero ? (
        <Image source={{ uri: hero }} style={styles.thumb} contentFit="cover" />
      ) : (
        <View style={[styles.thumb, styles.thumbPlaceholder]} />
      )}
      <View style={styles.rowInfo}>
        {post.title && (
          <Text style={styles.rowTitle} numberOfLines={2}>{post.title}</Text>
        )}
        {post.price && (
          <Text style={styles.rowPrice}>${Number(post.price).toLocaleString()}</Text>
        )}
        <View style={styles.rowMeta}>
          <Badge variant={post.entry_type ?? post.type ?? 'listing'} />
          <Text style={styles.rowTime}>{timeAgo}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

export default function MarketplaceScreen() {
  const appNav = useNavigation<AppNav>();
  const [tab, setTab] = useState<Tab>('listing');
  const [search, setSearch] = useState('');
  const [activeSearch, setActiveSearch] = useState('');

  const { data, isLoading } = useGetPostsQuery({
    type: tab,
    search: activeSearch || undefined,
    limit: 30,
  });
  const posts = data?.entries ?? [];

  const handleSearch = useCallback(() => {
    setActiveSearch(search.trim());
  }, [search]);

  const clearSearch = useCallback(() => {
    setSearch('');
    setActiveSearch('');
  }, []);

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      {/* Search bar */}
      <View style={styles.searchBar}>
        <Search size={16} color={Colors.grey} />
        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          onSubmitEditing={handleSearch}
          returnKeyType="search"
          placeholder={tab === 'listing' ? 'Search listings…' : 'Search want ads…'}
          placeholderTextColor={Colors.grey}
        />
        {(search.length > 0) && (
          <TouchableOpacity onPress={clearSearch}>
            <X size={16} color={Colors.grey} />
          </TouchableOpacity>
        )}
      </View>

      {/* Tabs */}
      <View style={styles.tabBar}>
        {(['listing', 'want'] as Tab[]).map((t) => (
          <TouchableOpacity
            key={t}
            style={[styles.tabItem, tab === t && styles.tabItemActive]}
            onPress={() => setTab(t)}
          >
            <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>
              {t === 'listing' ? 'Listings' : 'Want Ads'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {isLoading ? (
        <Spinner fullScreen />
      ) : (
        <FlatList
          data={posts}
          keyExtractor={(p) => p.internal_id}
          renderItem={({ item }) => (
            <ListingRow
              post={item}
              onPress={() => appNav.navigate('PostDetailModal', { postId: item.internal_id })}
            />
          )}
          ListEmptyComponent={
            <EmptyState
              title={tab === 'listing' ? 'No listings' : 'No want ads'}
              message={activeSearch ? 'Try a different search.' : undefined}
            />
          }
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.list}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:           { flex: 1, backgroundColor: Colors.cream },
  searchBar:      {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#FFFFFF', paddingHorizontal: 12, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  searchInput:    { flex: 1, fontSize: 14, color: Colors.fg },
  tabBar:         {
    flexDirection: 'row', backgroundColor: '#FFFFFF',
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  tabItem:        {
    flex: 1, alignItems: 'center', paddingVertical: 12,
    borderBottomWidth: 2, borderBottomColor: 'transparent',
  },
  tabItemActive:  { borderBottomColor: Colors.brg },
  tabText:        { fontSize: 14, fontWeight: '600', color: Colors.grey },
  tabTextActive:  { color: Colors.brg },
  list:           { paddingBottom: 24 },
  row:            {
    flexDirection: 'row', gap: 12, alignItems: 'center',
    backgroundColor: '#FFFFFF', paddingHorizontal: 14, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: '#F0F0F0',
  },
  thumb:          { width: 80, height: 60, borderRadius: 8 },
  thumbPlaceholder: { backgroundColor: Colors.brg },
  rowInfo:        { flex: 1, gap: 4 },
  rowTitle:       { fontSize: 14, fontWeight: '700', color: Colors.fg, lineHeight: 20 },
  rowPrice:       { fontSize: 16, fontWeight: '800', color: Colors.brg },
  rowMeta:        { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rowTime:        { fontSize: 11, color: Colors.grey },
});
