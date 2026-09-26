import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Image } from 'expo-image';
import { Bookmark, Car } from 'lucide-react-native';
import { useSummaryPanel } from '../ui/SummaryModal';
import { useGetCarsQuery, useGetLoggedInUserQuery } from '../../api/apiService';
import { imageUrl } from '../../utils/image';
import { useBrandColor } from '../../hooks/useBrandColor';
import { useColors } from '../../hooks/useColors';
import { bookmarkTitle, bookmarkRoute } from '../../utils/modelBookmark';
import type { ModelBookmark } from '../../types/api';

/**
 * One bookmark as a row: a small photo of one of its cars, its name and how
 * many there are, and the bookmark mark.
 */
function BookmarkRow({ bookmark: b, onPress }: { bookmark: ModelBookmark; onPress: () => void }) {
  const colors = useColors();
  const brand = useBrandColor();
  const { data } = useGetCarsQuery({
    page: 0, limit: 1, make: b.make.toLowerCase(), model: b.model_handle,
    ...(b.generation_handle ? { generation: b.generation_handle } : {}),
  });
  const car = data?.entries?.[0];
  const photo = imageUrl(car?.profile_image || car?.gallery?.[0]?.filename);
  const title = bookmarkTitle(b);

  return (
    <TouchableOpacity
      style={[styles.row, { borderColor: colors.border }]}
      onPress={onPress}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel={title}
    >
      {photo ? (
        <Image source={{ uri: photo }} style={styles.thumb} contentFit="cover" transition={150} />
      ) : (
        <View style={[styles.thumb, styles.thumbBlank]}>
          <Car size={18} color={colors.grey} />
        </View>
      )}
      <View style={styles.rowText}>
        <Text style={[styles.rowTitle, { color: colors.fg }]} numberOfLines={1}>{title}</Text>
        {data?.total != null && (
          <Text style={[styles.rowSub, { color: colors.grey }]}>{data.total} {data.total === 1 ? 'car' : 'cars'}</Text>
        )}
      </View>
      <Bookmark size={16} color={brand} fill={brand} />
    </TouchableOpacity>
  );
}

/**
 * Your bookmarks, inside the summary panel the header's bookmark button
 * opens: the models you've saved, one to a row, each opening its page once
 * the panel has closed.
 */
export default function BookmarksPanel() {
  const colors = useColors();
  const nav = useNavigation<any>();
  const panel = useSummaryPanel();
  const { data: me } = useGetLoggedInUserQuery();
  const bookmarks = me?.modelBookmarks ?? [];

  const open = (b: ModelBookmark) => {
    const go = () => nav.navigate('MainTabs', {
      screen: 'CarsTab',
      params: { screen: 'ModelDetail', params: bookmarkRoute(b) },
    });
    if (panel) panel.closeThen(go); else go();
  };

  return (
    <View style={styles.body}>
      <Text style={[styles.title, { color: colors.fg }]}>Bookmarks</Text>
      {bookmarks.length === 0 ? (
        <Text style={[styles.empty, { color: colors.grey }]}>Nothing bookmarked yet.</Text>
      ) : (
        <View style={styles.list}>
          {bookmarks.map((b) => (
            <BookmarkRow
              key={`${b.make}-${b.model_handle}-${b.generation_handle ?? ''}`}
              bookmark={b}
              onPress={() => open(b)}
            />
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  body: { padding: 16, gap: 12 },
  title: { fontSize: 20, fontWeight: '800', letterSpacing: -0.3 },
  empty: { fontSize: 14 },
  list: { gap: 8 },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: 8, paddingRight: 14, borderRadius: 12, borderWidth: 1,
    backgroundColor: '#111111',
  },
  thumb: { width: 64, height: 48, borderRadius: 8, backgroundColor: '#1A1A1A' },
  thumbBlank: { alignItems: 'center', justifyContent: 'center' },
  rowText: { flex: 1, gap: 2 },
  rowTitle: { fontSize: 15, fontWeight: '800' },
  rowSub: { fontSize: 12.5, fontWeight: '600' },
});
