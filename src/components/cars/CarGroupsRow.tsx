import React, { useState } from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import { Text } from '@ors/kit';
import { Image } from 'expo-image';
import { Users } from 'lucide-react-native';
import { SummaryTouchable, type SummaryOrigin } from '../ui/SummaryModal';
import GroupSummaryModal from '../groups/GroupSummaryModal';
import { useGetGroupsForCarQuery } from '../../api/apiService';
import { useColors } from '../../hooks/useColors';
import { firstGalleryUrl } from '../../utils/image';
import { groupCarsLine } from '../../utils/groupCars';
import { COMMON_RADIUS, COLOR_GRAY_17, COLOR_GRAY_22 } from '../../constants/config';
import { FONT_INTER } from '../../constants/fonts'

const CARD_WIDTH = 150;

/**
 * The groups about a make — or one model of it — as a row of cards. On a
 * model's page: groups for that model, then make-wide ones. On a make's page:
 * every group of the make. A tap opens the group's summary. Nothing at all
 * when there are none.
 */
export default function CarGroupsRow({ make, model }: { make: string; model?: string }) {
  const colors = useColors();
  const { data } = useGetGroupsForCarQuery({ make, ...(model ? { model } : {}) });
  const groups = data?.entries ?? [];
  const [open, setOpen] = useState<{ id: string; origin: SummaryOrigin | null } | null>(null);
  if (!groups.length) return null;

  return (
    <View style={styles.wrap}>
      <Text style={[styles.heading, { color: colors.fg }]}>Groups</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {groups.map((g) => {
          const cover = firstGalleryUrl(g.banners) ?? firstGalleryUrl(g.gallery);
          return (
            <SummaryTouchable
              key={g.internal_id}
              style={[styles.card, { borderColor: colors.border }]}
              onPress={(origin) => setOpen({ id: g.internal_id, origin })}
              accessibilityLabel={g.title ?? 'Group'}
            >
              {cover
                ? <Image source={{ uri: cover }} style={styles.cover} contentFit="cover" />
                : <View style={[styles.cover, styles.coverBlank]}><Users size={22} color={colors.grey} /></View>}
              <View style={styles.text}>
                <Text style={[styles.title, { color: colors.fg }]} numberOfLines={2}>{g.title}</Text>
                <Text style={[styles.sub, { color: colors.grey }]} numberOfLines={1}>
                  {groupCarsLine(g, make, model)}
                </Text>
              </View>
            </SummaryTouchable>
          );
        })}
      </ScrollView>
      <GroupSummaryModal groupId={open?.id ?? null} origin={open?.origin} onClose={() => setOpen(null)} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingTop: 16 },
  heading: { fontSize: 17, fontFamily: FONT_INTER.bold, paddingHorizontal: 16, paddingBottom: 10 },
  row: { paddingHorizontal: 12, gap: 10, alignItems: 'flex-start' },
  card: {
    width: CARD_WIDTH, borderRadius: COMMON_RADIUS, overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth, backgroundColor: COLOR_GRAY_17,
  },
  cover: { width: '100%', aspectRatio: 16 / 10, backgroundColor: COLOR_GRAY_22 },
  coverBlank: { alignItems: 'center', justifyContent: 'center' },
  text: { padding: 10, gap: 2 },
  title: { fontSize: 14, fontFamily: FONT_INTER.extrabold },
  sub: { fontSize: 11.5, fontFamily: FONT_INTER.semibold },
});
