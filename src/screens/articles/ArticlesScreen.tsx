import React from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { format } from 'date-fns';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useGetArticlesQuery } from '../../api/apiService';
import Spinner from '../../components/ui/Spinner';
import EmptyState from '../../components/ui/EmptyState';
import Avatar from '../../components/ui/Avatar';
import AppHeader from '../../components/ui/AppHeader';
import { colors } from '../../constants/colors';
import { useColors } from '../../hooks/useColors';
import { firstGalleryUrl } from '../../utils/image';
import type { FeedStackParamList } from '../../navigation/types';
import type { Article } from '../../types/api';
import { stripHtml } from '../../utils/text';

type AppNav = NativeStackNavigationProp<FeedStackParamList>;

function ArticleCard({ article, onPress }: { article: Article; onPress: () => void }) {
  const colors = useColors();
  const hero = firstGalleryUrl(article.gallery) ?? firstGalleryUrl(article.banners);
  const displayName = article.user
    ? `${article.user.firstName} ${article.user.lastName}`.trim() || article.user.username
    : '';
  const date = article.created_at
    ? format(new Date(article.created_at), 'MMM d, yyyy')
    : '';

  return (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: colors.card }]}
      onPress={onPress}
      activeOpacity={0.85}
    >
      {hero && (
        <Image source={{ uri: hero }} style={styles.hero} contentFit="cover" />
      )}
      <View style={styles.cardBody}>
        {article.category && (
          <View style={styles.categoryBadge}>
            <Text style={styles.category}>{article.category.toUpperCase()}</Text>
          </View>
        )}
        <Text style={[styles.title, { color: colors.fg }]} numberOfLines={3}>{article.title}</Text>
        {article.body && (
          <Text style={[styles.excerpt, { color: colors.grey }]} numberOfLines={2}>
            {stripHtml(article.body)}
          </Text>
        )}
        <View style={styles.meta}>
          {article.user && (
            <Avatar
              filename={article.user.gallery?.[0]?.filename ?? article.user.profilePicture}
              name={displayName}
              size={24}
            />
          )}
          <Text style={[styles.metaText, { color: colors.grey }]}>{displayName}</Text>
          {date && <Text style={[styles.metaDot, { color: colors.grey }]}>·</Text>}
          <Text style={[styles.metaText, { color: colors.grey }]}>{date}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

export default function ArticlesScreen() {
  const colors = useColors();
  const appNav = useNavigation<AppNav>();
  const { data, isLoading } = useGetArticlesQuery({ limit: 20 });
  const articles = data?.entries ?? [];

  if (isLoading) return <Spinner fullScreen />;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.brg }]} edges={['top']}>
      <AppHeader />
      <FlatList
        style={{ flex: 1, backgroundColor: colors.cream }}
        data={articles}
        keyExtractor={(a) => a.internal_id}
        renderItem={({ item }) => (
          <ArticleCard
            article={item}
            onPress={() => appNav.navigate('ArticleDetail', { articleId: item.internal_id })}
          />
        )}
        ListEmptyComponent={<EmptyState title="No articles yet" />}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.list}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:      { flex: 1 },
  list:      { paddingBottom: 24, paddingTop: 8 },
  card:      {
    borderRadius: 12,
    marginHorizontal: 12,
    marginVertical: 6,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  hero:      { width: '100%', aspectRatio: 16 / 9 },
  cardBody:  { padding: 14, gap: 6 },
  categoryBadge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.cyan,
    borderRadius: 4, paddingHorizontal: 8, paddingVertical: 3,
  },
  category:  { fontSize: 11, fontWeight: '800', color: '#FFFFFF', letterSpacing: 0.8 },
  title:     { fontSize: 17, fontWeight: '800', lineHeight: 24 },
  excerpt:   { fontSize: 13, lineHeight: 19 },
  meta:      { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  metaText:  { fontSize: 12 },
  metaDot:   { fontSize: 12 },
});
