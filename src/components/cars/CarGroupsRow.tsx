import React, { useState } from 'react';
import { View, ScrollView, StyleSheet, Dimensions } from 'react-native';
import { Text } from '@ors/kit';
import { Image } from 'expo-image';
import { Users } from 'lucide-react-native';
import { SummaryTouchable, type SummaryOrigin } from '../ui/SummaryModal';
import GroupSummaryModal from '../groups/GroupSummaryModal';
import { useGetGroupsForCarQuery } from '../../api/apiService';
import { useColors } from '../../hooks/useColors';
import { firstGalleryUrl } from '../../utils/image';
import { groupCarsLine } from '../../utils/groupCars';
import type { Group } from '../../types/api';
import { COMMON_RADIUS, COLOR_GRAY_22, COLOR_GRAY_26, COLOR_WHITE, GUTTER, PILL_RADIUS } from '../../constants/config';
import { FONT_INTER } from '../../constants/fonts';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
/** A card's width in the row — 60% of the screen, so the next peeks in. */
const CARD_WIDTH = Math.round(SCREEN_WIDTH * 0.6);

/**
 * The groups about a make — or one model of it — as cards. On a model's
 * page: groups for that model, then make-wide ones. On a make's page: every
 * group of the make. A tap opens the group's summary. Nothing at all when
 * there are none.
 *
 * `layout="row"` (the make page): a heading and a row that scrolls across.
 * `layout="list"` (the model page's Groups tab): the cards stacked, full width.
 */
export default function CarGroupsRow({ make, model, layout = 'row' }: {
  make: string;
  model?: string;
  layout?: 'row' | 'list';
}) {
  const colors = useColors();
  const { data } = useGetGroupsForCarQuery({ make, ...(model ? { model } : {}) });
  const groups = data?.entries ?? [];
  const [open, setOpen] = useState<{ id: string; origin: SummaryOrigin | null } | null>(null);
  if (!groups.length) {
    return layout === 'list'
      ? <Text style={[styles.empty, { color: colors.grey }]}>No groups for this car yet.</Text>
      : null;
  }

  const cards = groups.map((g) => (
    <GroupCard
      key={g.internal_id}
      group={g}
      line={groupCarsLine(g, make, model)}
      style={layout === 'row' ? styles.cardRow : styles.cardList}
      onPress={(origin) => setOpen({ id: g.internal_id, origin })}
    />
  ));

  return (
    <View style={layout === 'row' ? styles.wrap : styles.list}>
      {layout === 'row' ? (
        <>
          <Text style={[styles.heading, { color: colors.fg }]}>Groups</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
            {cards}
          </ScrollView>
        </>
      ) : cards}
      <GroupSummaryModal groupId={open?.id ?? null} origin={open?.origin} onClose={() => setOpen(null)} />
    </View>
  );
}

/**
 * One group: its picture full-bleed across the top, rounded at the foot to
 * the card's radius, with how many members on its bottom-right corner — then
 * its name and the cars it's about.
 */
function GroupCard({ group, line, style, onPress }: {
  group: Group;
  line: string;
  style: object;
  onPress: (origin: SummaryOrigin | null) => void;
}) {
  const colors = useColors();
  const cover = firstGalleryUrl(group.banners) ?? firstGalleryUrl(group.gallery);
  const members = group.member_count;
  return (
    <SummaryTouchable style={[styles.card, style]} onPress={onPress} accessibilityLabel={group.title ?? 'Group'}>
      <View style={styles.coverWrap}>
        {cover
          ? <Image source={{ uri: cover }} style={styles.cover} contentFit="cover" />
          : <View style={[styles.cover, styles.coverBlank]}><Users size={22} color={colors.grey} /></View>}
        {members != null && (
          <View style={styles.members} accessibilityLabel={`${members} ${members === 1 ? 'member' : 'members'}`}>
            <Users size={12} color={COLOR_WHITE} strokeWidth={2.4} />
            <Text style={styles.membersText}>{members}</Text>
          </View>
        )}
      </View>
      <View style={styles.text}>
        <Text style={[styles.title, { color: colors.fg }]} numberOfLines={2}>{group.title}</Text>
        {line ? <Text style={[styles.sub, { color: colors.grey }]} numberOfLines={1}>{line}</Text> : null}
      </View>
    </SummaryTouchable>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingTop: 16 },
  heading: { fontSize: 17, fontFamily: FONT_INTER.bold, paddingHorizontal: 16, paddingBottom: 10 },
  row: { paddingHorizontal: 12, gap: 10, alignItems: 'flex-start' },
  list: { paddingHorizontal: GUTTER + 8, gap: 12, paddingTop: 4 },
  empty: { fontSize: 14, textAlign: 'center', paddingTop: 30, paddingHorizontal: 24 },
  // No border — a step lighter than the page, as the car and make tiles.
  card: { borderRadius: COMMON_RADIUS, overflow: 'hidden', backgroundColor: COLOR_GRAY_26 },
  cardRow: { width: CARD_WIDTH },
  cardList: { width: '100%' },
  // Rounded at the foot too, where it meets the words — the card's radius.
  coverWrap: {
    borderBottomLeftRadius: COMMON_RADIUS, borderBottomRightRadius: COMMON_RADIUS, overflow: 'hidden',
  },
  cover: { width: '100%', aspectRatio: 16 / 9, backgroundColor: COLOR_GRAY_22 },
  coverBlank: { alignItems: 'center', justifyContent: 'center' },
  // Bottom right of the picture, lifted off it.
  members: {
    position: 'absolute', right: 8, bottom: 8,
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: PILL_RADIUS,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  membersText: { fontSize: 12, fontFamily: FONT_INTER.bold, color: COLOR_WHITE },
  text: { paddingHorizontal: 12, paddingTop: 8, paddingBottom: 12, gap: 2 },
  title: { fontSize: 15, fontFamily: FONT_INTER.bold },
  sub: { fontSize: 12, fontFamily: FONT_INTER.semibold },
});
