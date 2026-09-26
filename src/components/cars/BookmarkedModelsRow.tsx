import React from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { Bookmark } from 'lucide-react-native';
import { useGetLoggedInUserQuery } from '../../api/apiService';
import { useBrandColor } from '../../hooks/useBrandColor';
import type { ModelBookmark } from '../../types/api';
import { bookmarkTitle, bookmarkRoute } from '../../utils/modelBookmark';

/**
 * Your bookmarked car models, as a row of pills — in the menu, above the main
 * links. Just the name and the bookmark, no photos: the menu is for getting
 * somewhere, not browsing. Each opens that model's page. Nothing at all
 * until you've bookmarked one.
 */
export default function BookmarkedModelsRow({ onOpen }: {
  /** The host navigates — it knows how to close itself first. */
  onOpen: (bookmark: ModelBookmark) => void;
}) {
  const brand = useBrandColor();
  const { data: me } = useGetLoggedInUserQuery();
  const bookmarks = me?.modelBookmarks ?? [];
  if (!bookmarks.length) return null;

  return (
    <View style={styles.wrap}>
      <Text style={styles.heading}>Bookmarked models</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {bookmarks.map((b) => (
          <TouchableOpacity
            key={`${b.make}-${b.model_handle}-${b.generation_handle ?? ''}`}
            style={styles.pill}
            onPress={() => onOpen(b)}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel={bookmarkTitle(b)}
          >
            <Bookmark size={13} color={brand} fill={brand} />
            <Text style={styles.pillText} numberOfLines={1}>{bookmarkTitle(b)}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 10 },
  heading: { fontSize: 13, fontWeight: '800', color: 'rgba(255,255,255,0.7)', marginBottom: 8 },
  row: { gap: 8, paddingRight: 4 },
  pill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999,
    backgroundColor: '#1A1A1A', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
  },
  pillText: { fontSize: 14, fontWeight: '700', color: '#FFFFFF' },
});
