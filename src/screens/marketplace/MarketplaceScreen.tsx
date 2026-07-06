import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TextInput,
  TouchableOpacity,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Search, X, MessageCircle } from 'lucide-react-native';
import { formatDistanceToNow } from 'date-fns';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useGetPostsQuery } from '../../api/apiService';
import AppHeader from '../../components/ui/AppHeader';
import Spinner from '../../components/ui/Spinner';
import EmptyState from '../../components/ui/EmptyState';
import Badge, { CATEGORY_LABELS } from '../../components/ui/Badge';
import { colors } from '../../constants/colors';
import { useColors } from '../../hooks/useColors';
import { firstGalleryUrl } from '../../utils/image';
import type { AppStackParamList } from '../../navigation/types';
import type { Post } from '../../types/api';
import { ss } from '../../styles/shared';

type Tab = 'listing' | 'want';
type AppNav = NativeStackNavigationProp<AppStackParamList>;

function ListingRow({ post, onPress, onMessage }: { post: Post; onPress: () => void; onMessage: () => void }) {
  const colors = useColors();
  const hero = firstGalleryUrl(post.gallery);
  const timeAgo = post.created_at
    ? formatDistanceToNow(new Date(post.created_at), { addSuffix: true })
    : '';

  return (
    <TouchableOpacity style={[styles.row, { backgroundColor: colors.card, borderBottomColor: colors.border }]} onPress={onPress} activeOpacity={0.8}>
      {hero ? (
        <Image source={{ uri: hero }} style={styles.thumb} contentFit="cover" />
      ) : (
        <View style={[styles.thumb, styles.thumbPlaceholder]} />
      )}
      <View style={styles.rowInfo}>
        {post.title && (
          <Text style={[styles.rowTitle, { color: colors.fg }]} numberOfLines={2}>{post.title}</Text>
        )}
        <View style={styles.rowPriceRow}>
          {post.price && (
            <View style={styles.pricePill}>
              <Text style={styles.priceText}>${Number(post.price).toLocaleString()}</Text>
            </View>
          )}
        </View>
        <View style={styles.rowMeta}>
          {post.category && (
            <Badge variant={post.category} label={CATEGORY_LABELS[post.category] ?? post.category} />
          )}
          <Text style={[styles.rowTime, { color: colors.grey }]}>{timeAgo}</Text>
        </View>
      </View>
      <TouchableOpacity
        style={[styles.msgBtn, { backgroundColor: colors.primaryAlt + '18', borderColor: colors.primaryAlt + '44' }]}
        onPress={(e) => { e.stopPropagation(); onMessage(); }}
        hitSlop={4}
        activeOpacity={0.7}
      >
        <MessageCircle size={15} color={colors.primaryAlt} />
        <Text style={[styles.msgBtnText, { color: colors.primaryAlt }]}>Message</Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

export default function MarketplaceScreen() {
  const appNav = useNavigation<AppNav>();
  const colors = useColors();
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
    <SafeAreaView style={[ss.fill, { backgroundColor: colors.primaryAlt }]} edges={['top']}>
      <AppHeader />
      <View style={[styles.content, { backgroundColor: colors.cream }]}>
      {/* Search bar */}
      <View style={[styles.searchBar, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <Search size={16} color={colors.grey} />
        <TextInput
          style={[styles.searchInput, { color: colors.fg }]}
          value={search}
          onChangeText={setSearch}
          onSubmitEditing={handleSearch}
          returnKeyType="search"
          placeholder={tab === 'listing' ? 'Search listings…' : 'Search want ads…'}
          placeholderTextColor={colors.grey}
        />
        {(search.length > 0) && (
          <TouchableOpacity onPress={clearSearch}>
            <X size={16} color={colors.grey} />
          </TouchableOpacity>
        )}
      </View>

      {/* Tabs */}
      <View style={[ss.tabBar, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        {(['listing', 'want'] as Tab[]).map((t) => (
          <TouchableOpacity
            key={t}
            style={[ss.tabItem, tab === t && styles.tabItemActive]}
            onPress={() => setTab(t)}
          >
            <Text style={[ss.tabText, { color: colors.grey }, tab === t && styles.tabTextActive]}>
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
              onMessage={() => item.user && appNav.navigate('ComposeMessage', {
                userId: item.user.user_id,
                username: item.user.username,
                subject: `Re: ${item.title || 'your listing'}`,
                initialBody: `I'm interested in your listing "${item.title}"…`,
              })}
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
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  content:        { flex: 1 },
  searchBar:      {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 12, paddingVertical: 10,
    borderBottomWidth: 1,
  },
  searchInput:    { flex: 1, fontSize: 14 },
  tabBar:         {
    flexDirection: 'row',
    borderBottomWidth: 1,
  },
  tabItem:        {
    flex: 1, alignItems: 'center', paddingVertical: 12,
    borderBottomWidth: 2, borderBottomColor: 'transparent',
  },
  tabItemActive:  { borderBottomColor: colors.primaryAlt },
  tabTextActive:  { color: colors.primaryAlt },
  list:           { paddingBottom: 24 },
  row:            {
    flexDirection: 'row', gap: 12, alignItems: 'center',
    paddingHorizontal: 14, paddingVertical: 12,
    borderBottomWidth: 1,
  },
  thumb:          { width: 80, height: 60, borderRadius: 8 },
  thumbPlaceholder: { backgroundColor: colors.primaryAlt },
  rowInfo:        { flex: 1, gap: 4 },
  rowTitle:       { fontSize: 14, fontWeight: '700', lineHeight: 20 },
  rowPriceRow:    { flexDirection: 'row' },
  pricePill:      { backgroundColor: '#16A34A', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, alignSelf: 'flex-start' },
  priceText:      { color: '#FFFFFF', fontSize: 13, fontWeight: '800' },
  rowMeta:        { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rowTime:        { fontSize: 11 },
  msgBtn:         {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 9, paddingVertical: 6,
    borderRadius: 8, borderWidth: 1,
    alignSelf: 'center', marginLeft: 4,
  },
  msgBtnText:     { fontSize: 12, fontWeight: '700' },
});
