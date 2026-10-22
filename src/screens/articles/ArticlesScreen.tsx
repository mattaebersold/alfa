import { useRef, useState, useMemo } from 'react';
import { View, StyleSheet, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useGetArticlesQuery } from '../../api/apiService';
import Spinner from '../../components/ui/Spinner';
import EmptyState from '../../components/ui/EmptyState';
import AppHeader, { useHeaderPad } from '../../components/ui/AppHeader';
import { useScrollTopOnBack } from '../../hooks/useScrollTopOnBack';
import ScreenHeading from '../../components/ui/ScreenHeading';
import ChipRow from '../../components/ui/ChipRow';
import { useHeaderScroll } from '../../hooks/useHeaderScroll';
import { colors } from '../../constants/colors';
import { useColors } from '../../hooks/useColors';
import type { FeedStackParamList } from '../../navigation/types';
import { ss } from '../../styles/shared';
import { useRefreshControl } from '../../hooks/useRefreshControl';
import { GUTTER } from '../../constants/config';
import ArticleCard, { categoryLabel } from '../../components/articles/ArticleCard';

type AppNav = NativeStackNavigationProp<FeedStackParamList>;

export default function ArticlesScreen() {
  // The header's back button lands here at the top — see useScrollTopOnBack.
  const scrollRef = useRef<FlatList<any>>(null);
  useScrollTopOnBack(scrollRef);
  const colors = useColors();
  const appNav = useNavigation<AppNav>();
  const headerPad = useHeaderPad();
  const onScroll = useHeaderScroll(headerPad);
  const { data, isLoading, refetch } = useGetArticlesQuery({ limit: 20 });
  const refreshControl = useRefreshControl(refetch, headerPad);
  const all = data?.entries ?? [];

  /**
   * The filter under the heading: "All" and one chip per category the
   * loaded articles actually carry, in order of how many there are. Built
   * from the list rather than a fixed set, because the categories are
   * whatever editors have typed. Filtered here rather than by the server:
   * the screen holds the whole list, so there is nothing more to ask for.
   */
  const [category, setCategory] = useState<string>('all');
  const categories = useMemo(() => {
    const counts = new Map<string, number>();
    all.forEach((a) => { if (a.category) counts.set(a.category, (counts.get(a.category) ?? 0) + 1); });
    return [...counts.entries()].sort((x, y) => y[1] - x[1]).map(([key]) => ({ key, label: categoryLabel(key) }));
  }, [all]);
  const options = useMemo(() => [{ key: 'all', label: 'All' }, ...categories], [categories]);
  const articles = useMemo(
    () => (category === 'all' ? all : all.filter((a) => a.category === category)),
    [all, category],
  );

  if (isLoading) return <Spinner fullScreen />;

  return (
    <SafeAreaView style={[ss.fill, { backgroundColor: colors.cream }]} edges={[]}>
      <AppHeader />
      <FlatList
        ref={scrollRef}
        refreshControl={refreshControl}
        style={{ flex: 1, backgroundColor: colors.cream }}
        data={articles}
        keyExtractor={(a) => a.internal_id}
        // Heading and filter ride in the list so they scroll away with the content.
        ListHeaderComponent={
          <View>
            <ScreenHeading title="Articles" />
            {categories.length > 1 && (
              <View style={styles.filter}>
                <ChipRow options={options} value={category} onChange={setCategory} />
              </View>
            )}
          </View>
        }
        renderItem={({ item }) => (
          <ArticleCard
            article={item}
            onPress={() => appNav.navigate('ArticleDetail', { articleId: item.internal_id })}
          />
        )}
        ListEmptyComponent={<EmptyState title={category === 'all' ? 'No articles yet' : `No ${categoryLabel(category).toLowerCase()} articles`} />}
        showsVerticalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        contentContainerStyle={[styles.list, { paddingTop: headerPad }]}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  // The app's gutter on the list itself: the heading and the cards line up on it.
  list:      { paddingBottom: 24, paddingTop: 8, paddingHorizontal: GUTTER },
  filter:    { paddingBottom: 8 },
});
