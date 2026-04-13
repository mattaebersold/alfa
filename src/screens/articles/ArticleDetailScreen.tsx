import React from 'react';
import {
  View, Text, StyleSheet, ScrollView,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { format } from 'date-fns';
import {
  useGetArticleQuery,
  useGetArticleBlocksQuery,
} from '../../api/apiService';
import Avatar from '../../components/ui/Avatar';
import Spinner from '../../components/ui/Spinner';
import { Colors } from '../../constants/colors';
import { firstGalleryUrl, imageUrl } from '../../utils/image';
import type { AppScreenProps } from '../../navigation/types';

interface ArticleBlock {
  internal_id?: string;
  _id?: string;
  type: 'copy' | 'image';
  content?: string;
  image?: { filename: string; internal_id?: string } | null;
  order?: number;
}

export default function ArticleDetailScreen({ route }: AppScreenProps<'ArticleDetail'>) {
  const { articleId } = route.params;

  const { data: article, isLoading: loadingArticle } = useGetArticleQuery(articleId);
  const { data: blocksData, isLoading: loadingBlocks } = useGetArticleBlocksQuery(articleId);

  if (loadingArticle || !article) return <Spinner fullScreen />;

  const hero = firstGalleryUrl(article.gallery) ?? firstGalleryUrl(article.banners);
  const displayName = article.user
    ? `${article.user.firstName} ${article.user.lastName}`.trim() || article.user.username
    : '';
  const date = article.created_at
    ? format(new Date(article.created_at), 'MMMM d, yyyy')
    : '';

  const blocks: ArticleBlock[] = blocksData?.blocks ?? [];

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        {/* Hero image */}
        {hero && (
          <Image source={{ uri: hero }} style={styles.hero} contentFit="cover" />
        )}

        {/* Article header */}
        <View style={styles.header}>
          {article.category && (
            <Text style={styles.category}>{article.category.toUpperCase()}</Text>
          )}
          <Text style={styles.title}>{article.title}</Text>

          {/* Author + date */}
          <View style={styles.byline}>
            {article.user && (
              <Avatar
                filename={article.user.gallery?.[0]?.filename ?? article.user.profilePicture}
                name={displayName}
                size={32}
              />
            )}
            <View>
              {displayName ? (
                <Text style={styles.authorName}>{displayName}</Text>
              ) : null}
              {date ? <Text style={styles.date}>{date}</Text> : null}
            </View>
          </View>
        </View>

        {/* Article intro body (from article.body field) */}
        {article.body ? (
          <View style={styles.block}>
            <Text style={styles.copyText}>
              {article.body.replace(/<[^>]*>/g, '')}
            </Text>
          </View>
        ) : null}

        {/* Content blocks */}
        {loadingBlocks ? (
          <Spinner />
        ) : (
          blocks.map((block, idx) => {
            const key = block.internal_id ?? block._id ?? String(idx);
            if (block.type === 'image' && block.image?.filename) {
              return (
                <Image
                  key={key}
                  source={{ uri: imageUrl(block.image.filename) }}
                  style={styles.blockImage}
                  contentFit="cover"
                />
              );
            }
            if (block.type === 'copy' && block.content) {
              return (
                <View key={key} style={styles.block}>
                  <Text style={styles.copyText}>
                    {block.content.replace(/<[^>]*>/g, '')}
                  </Text>
                </View>
              );
            }
            return null;
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:        { flex: 1, backgroundColor: Colors.cream },
  content:     { paddingBottom: 40 },
  hero:        { width: '100%', aspectRatio: 16 / 9 },
  header:      { backgroundColor: '#FFFFFF', padding: 20, gap: 10 },
  category:    { fontSize: 11, fontWeight: '800', color: Colors.brg, letterSpacing: 0.8 },
  title:       { fontSize: 24, fontWeight: '800', color: Colors.fg, lineHeight: 32 },
  byline:      { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4 },
  authorName:  { fontSize: 14, fontWeight: '700', color: Colors.fg },
  date:        { fontSize: 12, color: Colors.grey, marginTop: 2 },
  block:       {
    backgroundColor: '#FFFFFF', paddingHorizontal: 20, paddingVertical: 16,
    marginTop: 2,
  },
  copyText:    { fontSize: 16, color: Colors.fg, lineHeight: 26 },
  blockImage:  { width: '100%', aspectRatio: 16 / 9, marginTop: 2 },
});
