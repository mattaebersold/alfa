import React from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { format } from 'date-fns';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ArrowUpRight } from 'lucide-react-native';
import { useGetArticlesQuery } from '../../api/apiService';
import Spinner from '../../components/ui/Spinner';
import EmptyState from '../../components/ui/EmptyState';
import Avatar from '../../components/ui/Avatar';
import AppHeader, { useHeaderPad } from '../../components/ui/AppHeader';
import ScreenHeading from '../../components/ui/ScreenHeading';
import { useHeaderScroll } from '../../hooks/useHeaderScroll';
import { colors } from '../../constants/colors';
import { useColors } from '../../hooks/useColors';
import { firstGalleryUrl } from '../../utils/image';
import type { FeedStackParamList } from '../../navigation/types';
import type { Article } from '../../types/api';
import { stripHtml } from '../../utils/text';
import { ss } from '../../styles/shared';
import { useRefreshControl } from '../../hooks/useRefreshControl';

type AppNav = NativeStackNavigationProp<FeedStackParamList>;

function ArticleCard({ article, onPress }: { article: Article; onPress: () => void }) {
  const colors = useColors();
  const hero = firstGalleryUrl(article.gallery) ?? firstGalleryUrl(article.banners);
  const displayName = article.user?.username ?? '';
  // Shorthand date so it sits alongside the title without crowding it.
  const date = article.created_at
    ? format(new Date(article.created_at), 'M/d/yy')
    : '';

  const categoryBadge = article.category ? (
    <View style={styles.categoryBadge}>
      <Text style={styles.category}>{article.category.toUpperCase()}</Text>
    </View>
  ) : null;

  return (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: colors.card }]}
      onPress={onPress}
      activeOpacity={0.85}
    >
      {hero ? (
        <View style={styles.heroWrap}>
          <Image source={{ uri: hero }} style={styles.hero} contentFit="cover" />
          {/* Scrim keeps the badge legible over light photography. */}
          {categoryBadge && <View style={styles.heroScrim} pointerEvents="none" />}
          {categoryBadge && <View style={styles.heroBadges}>{categoryBadge}</View>}

          {/* Explicit affordance for opening the article pane. The whole card is
              tappable too — this just makes the action discoverable. */}
          <TouchableOpacity
            style={[styles.openBtn, styles.openBtnOnHero, { backgroundColor: colors.primaryAlt }]}
            onPress={onPress}
            activeOpacity={0.8}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={`Open article: ${article.title}`}
          >
            <ArrowUpRight size={18} color="#000000" />
          </TouchableOpacity>
        </View>
      ) : null}

      <View style={styles.cardBody}>
        {/* No hero to overlay — fall back to an inline badge. */}
        {!hero && categoryBadge}

        <View style={styles.titleRow}>
          <Text style={[styles.title, { color: colors.fg }]} numberOfLines={3}>
            {article.title}
          </Text>
          {date ? (
            <Text style={[styles.date, { color: colors.grey }]}>{date}</Text>
          ) : null}
        </View>

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
          {displayName ? (
            <Text style={[styles.metaText, { color: colors.grey }]} numberOfLines={1}>
              @{displayName}
            </Text>
          ) : null}

          {/* No hero to overlay — keep the open button reachable inline. */}
          {!hero && (
            <>
              <View style={ss.fill} />
              <TouchableOpacity
                style={[styles.openBtn, { backgroundColor: colors.primaryAlt }]}
                onPress={onPress}
                activeOpacity={0.8}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={`Open article: ${article.title}`}
              >
                <ArrowUpRight size={18} color="#000000" />
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}

export default function ArticlesScreen() {
  const colors = useColors();
  const appNav = useNavigation<AppNav>();
  const headerPad = useHeaderPad();
  const onScroll = useHeaderScroll(headerPad);
  const { data, isLoading, refetch } = useGetArticlesQuery({ limit: 20 });
  const refreshControl = useRefreshControl(refetch, headerPad);
  const articles = data?.entries ?? [];

  if (isLoading) return <Spinner fullScreen />;

  return (
    <SafeAreaView style={[ss.fill, { backgroundColor: colors.cream }]} edges={[]}>
      <AppHeader />
      <FlatList
        refreshControl={refreshControl}
        style={{ flex: 1, backgroundColor: colors.cream }}
        data={articles}
        keyExtractor={(a) => a.internal_id}
        // Heading rides in the list so it scrolls away with the content.
        ListHeaderComponent={<ScreenHeading title="Articles" />}
        renderItem={({ item }) => (
          <ArticleCard
            article={item}
            onPress={() => appNav.navigate('ArticleDetail', { articleId: item.internal_id })}
          />
        )}
        ListEmptyComponent={<EmptyState title="No articles yet" />}
        showsVerticalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        contentContainerStyle={[styles.list, { paddingTop: headerPad }]}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  list:      { paddingBottom: 24, paddingTop: 8 },
  card:      {
    borderRadius: 12,
    marginHorizontal: 12,
    marginVertical: 6,
    overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
  },
  heroWrap:  { position: 'relative' },
  hero:      { width: '100%', aspectRatio: 16 / 9 },
  heroScrim: {
    position: 'absolute', top: 0, left: 0, right: 0, height: 72,
    backgroundColor: 'rgba(0,0,0,0.28)',
  },
  heroBadges: {
    position: 'absolute', top: 10, left: 10,
    flexDirection: 'row', flexWrap: 'wrap', gap: 6,
  },

  cardBody:  { padding: 14, gap: 6 },
  categoryBadge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.primaryAlt,
    borderRadius: 4, paddingHorizontal: 8, paddingVertical: 3,
  },
  category:  { fontSize: 11, fontWeight: '800', color: '#FFFFFF', letterSpacing: 0.8 },

  titleRow:  { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  title:     { flex: 1, fontSize: 17, fontWeight: '800', lineHeight: 24 },
  date:      { fontSize: 12, fontWeight: '600', marginTop: 4 },

  excerpt:   { fontSize: 13, lineHeight: 19 },
  meta:      { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  metaText:  { fontSize: 12, flexShrink: 1 },
  openBtn: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
  },
  openBtnOnHero: {
    position: 'absolute', right: 10, bottom: 10,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3, shadowRadius: 5, elevation: 4,
  },
});
