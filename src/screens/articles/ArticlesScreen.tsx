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
import { Colors } from '../../constants/colors';
import { firstGalleryUrl } from '../../utils/image';
import type { AppStackParamList } from '../../navigation/types';
import type { Article } from '../../types/api';

type AppNav = NativeStackNavigationProp<AppStackParamList>;

function ArticleCard({ article, onPress }: { article: Article; onPress: () => void }) {
  const hero = firstGalleryUrl(article.gallery) ?? firstGalleryUrl(article.banners);
  const displayName = article.user
    ? `${article.user.firstName} ${article.user.lastName}`.trim() || article.user.username
    : '';
  const date = article.created_at
    ? format(new Date(article.created_at), 'MMM d, yyyy')
    : '';

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.85}>
      {hero && (
        <Image source={{ uri: hero }} style={styles.hero} contentFit="cover" />
      )}
      <View style={styles.cardBody}>
        {article.category && (
          <Text style={styles.category}>{article.category.toUpperCase()}</Text>
        )}
        <Text style={styles.title} numberOfLines={3}>{article.title}</Text>
        {article.body && (
          <Text style={styles.excerpt} numberOfLines={2}>
            {article.body.replace(/<[^>]*>/g, '')}
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
          <Text style={styles.metaText}>{displayName}</Text>
          {date && <Text style={styles.metaDot}>·</Text>}
          <Text style={styles.metaText}>{date}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

export default function ArticlesScreen() {
  const appNav = useNavigation<AppNav>();
  const { data, isLoading } = useGetArticlesQuery({ limit: 20 });
  const articles = data?.entries ?? [];

  if (isLoading) return <Spinner fullScreen />;

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <FlatList
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
  safe:      { flex: 1, backgroundColor: Colors.cream },
  list:      { paddingBottom: 24, paddingTop: 8 },
  card:      {
    backgroundColor: '#FFFFFF',
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
  category:  { fontSize: 11, fontWeight: '800', color: Colors.brg, letterSpacing: 0.8 },
  title:     { fontSize: 17, fontWeight: '800', color: Colors.fg, lineHeight: 24 },
  excerpt:   { fontSize: 13, color: Colors.grey, lineHeight: 19 },
  meta:      { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  metaText:  { fontSize: 12, color: Colors.grey },
  metaDot:   { fontSize: 12, color: Colors.grey },
});
