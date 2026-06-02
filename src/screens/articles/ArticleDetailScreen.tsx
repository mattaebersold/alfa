import React from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { format } from 'date-fns';
import { Car } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  useGetArticleQuery,
  useGetArticleBlocksQuery,
  useGetCarWithUserQuery,
} from '../../api/apiService';
import Avatar from '../../components/ui/Avatar';
import Spinner from '../../components/ui/Spinner';
import { colors } from '../../constants/colors';
import { useColors } from '../../hooks/useColors';
import { firstGalleryUrl, imageUrl } from '../../utils/image';
import type { AppScreenProps, AppStackParamList } from '../../navigation/types';
import { stripHtml } from '../../utils/text';
import { ss } from '../../styles/shared';

type NavProp = NativeStackNavigationProp<AppStackParamList>;

type ContentSegment = { type: 'text'; content: string } | { type: 'image'; src: string };

function parseContent(html: string): ContentSegment[] {
  const parts: ContentSegment[] = [];
  const regex = /\[img:([^\]]+)\]/g;
  let last = 0;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(html)) !== null) {
    if (match.index > last) {
      const text = stripHtml(html.slice(last, match.index)).trim();
      if (text) parts.push({ type: 'text', content: text });
    }
    parts.push({ type: 'image', src: match[1] });
    last = match.index + match[0].length;
  }
  if (last < html.length) {
    const text = stripHtml(html.slice(last)).trim();
    if (text) parts.push({ type: 'text', content: text });
  }
  return parts;
}

function renderSegments(segments: ContentSegment[], c: ReturnType<typeof useColors>) {
  return segments.map((seg, i) => {
    if (seg.type === 'image') {
      const uri = seg.src.startsWith('http') ? seg.src : (imageUrl(seg.src) ?? undefined);
      return (
        <Image
          key={i}
          source={{ uri }}
          style={styles.blockImage}
          contentFit="cover"
        />
      );
    }
    return (
      <View key={i} style={[styles.block, { backgroundColor: c.card }]}>
        <Text style={[styles.copyText, { color: c.fg }]}>{seg.content}</Text>
      </View>
    );
  });
}

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
  const colors = useColors();
  const navigation = useNavigation<NavProp>();

  const { data: article, isLoading: loadingArticle } = useGetArticleQuery(articleId);
  const { data: blocksData, isLoading: loadingBlocks } = useGetArticleBlocksQuery(articleId);
  const { data: featuredCar } = useGetCarWithUserQuery(article?.car_id ?? '', { skip: !article?.car_id });

  if (loadingArticle || !article) return <Spinner fullScreen />;

  const hero = firstGalleryUrl(article.gallery) ?? firstGalleryUrl(article.banners);
  const displayName = article.user?.username ?? '';
  const date = article.created_at
    ? format(new Date(article.created_at), 'MMMM d, yyyy')
    : '';

  const blocks: ArticleBlock[] = blocksData?.blocks ?? [];

  return (
    <SafeAreaView style={[ss.fill, { backgroundColor: colors.cream }]} edges={['bottom']}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        {/* Hero image */}
        {hero && (
          <Image source={{ uri: hero }} style={styles.hero} contentFit="cover" />
        )}

        {/* Article header */}
        <View style={[styles.header, { backgroundColor: colors.card }]}>
          {article.category && (
            <Text style={styles.category}>{article.category.toUpperCase()}</Text>
          )}
          <Text style={[styles.title, { color: colors.fg }]}>{article.title}</Text>

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
                <Text style={[styles.authorName, { color: colors.fg }]}>@{displayName}</Text>
              ) : null}
              {date ? <Text style={[styles.date, { color: colors.grey }]}>{date}</Text> : null}
            </View>
          </View>
        </View>

        {/* Featured car / author meta rows */}
        {(featuredCar) && (
          <View style={[styles.metaSection, { backgroundColor: colors.card, borderTopColor: colors.border }]}>
            {featuredCar && (
              <TouchableOpacity
                style={styles.metaRow}
                activeOpacity={0.7}
                onPress={() => navigation.navigate('CarDetailModal', { carId: featuredCar.internal_id })}
              >
                <View style={[styles.metaIconWrap, { backgroundColor: colors.primaryAlt + '22' }]}>
                  <Car size={14} color={colors.primaryAlt} />
                </View>
                <View style={styles.metaBody}>
                  <Text style={[styles.metaLabel, { color: colors.grey }]}>Featured Car</Text>
                  <Text style={[styles.metaValue, { color: colors.fg }]} numberOfLines={1}>
                    {[featuredCar.year, featuredCar.make, featuredCar.model].filter(Boolean).join(' ') || featuredCar.title || 'View Car'}
                  </Text>
                </View>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Article intro body (from article.body field) */}
        {article.body ? renderSegments(parseContent(article.body), colors) : null}

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
                  source={{ uri: imageUrl(block.image.filename) ?? undefined }}
                  style={styles.blockImage}
                  contentFit="cover"
                />
              );
            }
            if (block.type === 'copy' && block.content) {
              return (
                <React.Fragment key={key}>
                  {renderSegments(parseContent(block.content), colors)}
                </React.Fragment>
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
  content:     { paddingBottom: 40 },
  hero:        { width: '100%', aspectRatio: 16 / 9 },
  header:      { padding: 20, gap: 10 },
  category:    { fontSize: 11, fontWeight: '800', color: colors.primaryAlt, letterSpacing: 0.8 },
  title:       { fontSize: 24, fontWeight: '800', lineHeight: 32 },
  byline:      { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4 },
  authorName:  { fontSize: 14, fontWeight: '700' },
  date:        { fontSize: 12, marginTop: 2 },
  block:       {
    paddingHorizontal: 20, paddingVertical: 16,
    marginTop: 2,
  },
  copyText:    { fontSize: 16, lineHeight: 26 },
  blockImage:  { width: '100%', aspectRatio: 16 / 9, marginTop: 2 },

  metaSection: {
    marginTop: 2, borderTopWidth: StyleSheet.hairlineWidth,
  },
  metaRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingVertical: 12,
  },
  metaIconWrap: {
    width: 32, height: 32, borderRadius: 8,
    alignItems: 'center', justifyContent: 'center',
  },
  metaBody:  { flex: 1 },
  metaLabel: { fontSize: 11, fontWeight: '600', marginBottom: 1 },
  metaValue: { fontSize: 14, fontWeight: '700' },
});
