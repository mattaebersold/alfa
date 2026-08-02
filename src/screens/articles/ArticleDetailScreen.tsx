import React from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, useWindowDimensions,
} from 'react-native';
import { Image } from 'expo-image';
import { format } from 'date-fns';
import { Car } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  useGetArticleQuery,
  useGetArticleBlocksQuery,
  useGetCarWithUserQuery,
} from '../../api/apiService';
import Spinner from '../../components/ui/Spinner';
import RichText from '../../components/ui/RichText';
import SharedModal from '../../components/ui/SharedModal';
import ArticleBadges from '../../components/articles/ArticleBadges';
import { useColors } from '../../hooks/useColors';
import { firstGalleryUrl, imageUrl } from '../../utils/image';
import type { AppScreenProps, AppStackParamList } from '../../navigation/types';

type NavProp = NativeStackNavigationProp<AppStackParamList>;

interface BlockImage {
  filename: string;
  internal_id?: string;
}

interface ArticleBlock {
  internal_id?: string;
  _id?: string;
  type: 'copy' | 'image';
  content?: string;
  images?: BlockImage[];
  /** Legacy single-image field, normalised server-side but tolerated here. */
  image?: BlockImage | null;
  order?: number;
}

/** Image blocks carry an array; fall back to the legacy field defensively. */
function blockImages(block: ArticleBlock): BlockImage[] {
  if (Array.isArray(block.images) && block.images.length > 0) return block.images;
  return block.image?.filename ? [block.image] : [];
}

/**
 * Full-width article image. Height comes from the intrinsic aspect ratio once
 * known, so portrait shots aren't cropped into a 16:9 letterbox.
 */
function BlockImageView({ filename, width }: { filename: string; width: number }) {
  const [ratio, setRatio] = React.useState<number | null>(null);
  const uri = imageUrl(filename) ?? undefined;

  return (
    <Image
      source={{ uri }}
      style={{ width, height: width / (ratio ?? 16 / 9) }}
      contentFit="cover"
      transition={180}
      onLoad={(e) => {
        const { width: w, height: h } = e.source ?? {};
        if (w && h) setRatio(w / h);
      }}
    />
  );
}

export default function ArticleDetailScreen({ route }: AppScreenProps<'ArticleDetail'>) {
  const { articleId } = route.params;
  const c = useColors();
  const navigation = useNavigation<NavProp>();
  const { width } = useWindowDimensions();

  // The sheet owns its own visibility so it can play its close animation before
  // the route unmounts. `pendingNav` lets a badge tap chain into another screen
  // once this modal has fully dismissed — pushing while the RN Modal is still
  // mounted would render the next screen behind it.
  const [visible, setVisible] = React.useState(true);
  const pendingNav = React.useRef<((nav: NavProp) => void) | null>(null);

  const { data: article, isLoading: loadingArticle } = useGetArticleQuery(articleId);
  const { data: blocksData, isLoading: loadingBlocks } = useGetArticleBlocksQuery(articleId);
  const { data: featuredCar } = useGetCarWithUserQuery(article?.car_id ?? '', { skip: !article?.car_id });

  const handleDismissed = () => {
    const go = pendingNav.current;
    pendingNav.current = null;
    navigation.goBack();
    go?.(navigation);
  };

  const navigateAway = (go: (nav: NavProp) => void) => {
    pendingNav.current = go;
    setVisible(false);
  };

  const hero = firstGalleryUrl(article?.gallery) ?? firstGalleryUrl(article?.banners);
  const date = article?.created_at
    ? format(new Date(article.created_at), 'MMMM d, yyyy')
    : '';

  const blocks: ArticleBlock[] = [...(blocksData?.blocks ?? [])].sort(
    (a, b) => (a.order ?? 0) - (b.order ?? 0)
  );

  return (
    <SharedModal
      visible={visible}
      onClose={() => setVisible(false)}
      onDismissed={handleDismissed}
      title={article?.title || 'Article'}
    >
      {loadingArticle || !article ? (
        <Spinner />
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
          {/* Hero */}
          {hero && (
            <Image source={{ uri: hero }} style={styles.hero} contentFit="cover" transition={200} />
          )}

          {/* Header */}
          <View style={styles.header}>
            {article.category && (
              <Text style={[styles.category, { color: c.primaryAlt }]}>
                {article.category.toUpperCase()}
              </Text>
            )}
            <Text style={[styles.title, { color: c.fg }]}>{article.title}</Text>
            {date ? <Text style={[styles.date, { color: c.grey }]}>{date}</Text> : null}
          </View>

          {/* Author + tag badges */}
          <View style={[styles.badges, { borderTopColor: c.border }]}>
            <ArticleBadges
              articleId={articleId}
              author={article.user}
              onNavigate={navigateAway}
            />
          </View>

          {/* Featured car */}
          {featuredCar && (
            <TouchableOpacity
              style={[styles.metaRow, { backgroundColor: c.inputBg, borderColor: c.border }]}
              activeOpacity={0.7}
              onPress={() => navigateAway((nav) =>
                nav.navigate('CarDetail', { carId: featuredCar.internal_id })
              )}
            >
              <View style={[styles.metaIconWrap, { backgroundColor: c.primaryAlt + '22' }]}>
                <Car size={14} color={c.primaryAlt} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.metaLabel, { color: c.grey }]}>Featured Car</Text>
                <Text style={[styles.metaValue, { color: c.fg }]} numberOfLines={1}>
                  {[featuredCar.year, featuredCar.make, featuredCar.model].filter(Boolean).join(' ')
                    || featuredCar.title
                    || 'View Car'}
                </Text>
              </View>
            </TouchableOpacity>
          )}

          {/* Body blocks */}
          {loadingBlocks ? (
            <Spinner />
          ) : blocks.length > 0 ? (
            blocks.map((block, idx) => {
              const key = block.internal_id ?? block._id ?? String(idx);

              if (block.type === 'image') {
                const imgs = blockImages(block);
                if (imgs.length === 0) return null;
                return (
                  <View key={key} style={styles.imageBlock}>
                    {imgs.map((img, i) => (
                      <BlockImageView
                        key={img.internal_id ?? img.filename ?? i}
                        filename={img.filename}
                        width={width}
                      />
                    ))}
                  </View>
                );
              }

              if (block.content) {
                return (
                  <View key={key} style={styles.copyBlock}>
                    <RichText html={block.content} />
                  </View>
                );
              }

              return null;
            })
          ) : article.body ? (
            // Articles that predate blocks and haven't been migrated yet.
            <View style={styles.copyBlock}>
              <RichText html={article.body} />
            </View>
          ) : null}
        </ScrollView>
      )}
    </SharedModal>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: 32 },

  hero:     { width: '100%', aspectRatio: 16 / 9 },
  header:   { paddingHorizontal: 20, paddingTop: 18, gap: 8 },
  category: { fontSize: 11, fontWeight: '800', letterSpacing: 1 },
  title:    { fontSize: 25, fontWeight: '800', lineHeight: 32, letterSpacing: -0.3 },
  date:     { fontSize: 12 },

  badges: {
    paddingHorizontal: 20, paddingTop: 14, marginTop: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
  },

  metaRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    marginHorizontal: 20, marginTop: 16,
    paddingHorizontal: 14, paddingVertical: 12,
    borderRadius: 12, borderWidth: StyleSheet.hairlineWidth,
  },
  metaIconWrap: {
    width: 32, height: 32, borderRadius: 8,
    alignItems: 'center', justifyContent: 'center',
  },
  metaLabel: { fontSize: 11, fontWeight: '600', marginBottom: 1 },
  metaValue: { fontSize: 14, fontWeight: '700' },

  // Copy is inset for readability; images run edge-to-edge against it.
  copyBlock:  { paddingHorizontal: 20, paddingTop: 22 },
  // `gap` spaces stacked images within a block; the margins space the block
  // itself against adjacent copy.
  imageBlock: { marginVertical: 16, gap: 14 },
});
