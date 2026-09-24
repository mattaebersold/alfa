import React, { useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking, Alert } from 'react-native';
import { Image } from 'expo-image';
import { Car, ExternalLink, Lock, Settings, PenSquare, Trash2 } from 'lucide-react-native';
import Avatar from '../ui/Avatar';
import ActionSheet from '../ui/ActionSheet';
import { measureOrigin, type SummaryOrigin } from '../ui/SummaryModal';
import { useColors } from '../../hooks/useColors';
import { firstGalleryUrl } from '../../utils/image';
import { stripHtml } from '../../utils/text';
import { isOpenableLink, listLinkLabel } from '../../utils/listLinks';
import type { List, ListItem } from '../../types/api';
import { COMMON_RADIUS, PILL_RADIUS } from '../../constants/radius';

/** What a list calls its car: the owner's own name for it, else year make model. */
export function listCarLabel(car?: List['car']): string {
  if (!car) return '';
  return car.title || [car.year, car.make, car.model].filter(Boolean).join(' ') || 'Car';
}

/**
 * One entry, with its rank.
 *
 * Numbered because of what these lists are — "Top 5 favourite car designers",
 * "5 mods I want to do next year". The order is the author's argument, and a
 * bulleted list would throw it away.
 */
function ItemRow({ item, rank }: { item: ListItem; rank: number }) {
  const colors = useColors();
  const photo = firstGalleryUrl(item.gallery);
  const description = item.description ? stripHtml(item.description).trim() : '';
  // Checked here as well as in the form: the form is this build's, the record
  // may be another client's. Anything that isn't http(s) gets no button at all
  // rather than a button that does something other than open a web page.
  const link = isOpenableLink(item.link) ? item.link.trim() : null;

  const open = () => {
    if (!link) return;
    Linking.openURL(link).catch(() => Alert.alert("Couldn't open link", link));
  };

  const rankBadge = (
    <View style={[styles.rank, { backgroundColor: colors.segment }]}>
      <Text style={[styles.rankText, { color: colors.fg }]}>{rank}</Text>
    </View>
  );

  return (
    <View style={[styles.item, { borderTopColor: colors.borderDark }]}>
      {/* The photo takes the panel's full width, with the rank worn on its
          corner. Without one, the rank sits beside the title instead. */}
      {photo ? (
        <View>
          <Image source={{ uri: photo }} style={styles.itemPhoto} contentFit="cover" transition={150} />
          <View style={styles.rankOnPhoto}>{rankBadge}</View>
        </View>
      ) : null}
      <View style={styles.itemText}>
        <View style={styles.itemTitleRow}>
          {photo ? null : rankBadge}
          <Text style={[styles.itemTitle, { color: colors.fg }]}>{item.title}</Text>
        </View>
        {description ? (
          <Text style={[styles.itemDesc, { color: colors.muted }]}>{description}</Text>
        ) : null}
        {link ? (
          <TouchableOpacity
            style={[styles.linkBtn, { backgroundColor: colors.segment }]}
            onPress={open}
            activeOpacity={0.8}
            hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
            accessibilityRole="link"
            accessibilityLabel={`${listLinkLabel(link, item.link_label)}, opens in your browser`}
          >
            <Text style={[styles.linkText, { color: colors.fg }]} numberOfLines={1}>
              {listLinkLabel(link, item.link_label)}
            </Text>
            <ExternalLink size={11} color={colors.grey} />
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
}

/**
 * A list, read — everything about one except the chrome around it.
 *
 * Split from ListSummaryModal because the same thing is shown in two places:
 * in the panel that opens over a profile or a car's page, and on the
 * ListDetail screen that a notification lands on. Two renderings of "a list"
 * would drift the first time one of them learned about a new field, and links
 * were that field.
 *
 * It navigates nowhere itself. Opening the author and opening the car mean
 * different things in a panel (stack a summary; close, then push) than on a
 * screen (just push), so the host says what they do.
 */
export default function ListSummaryContent({
  list,
  onOpenUser,
  onOpenCar,
  hideCar,
  onEdit,
  onDelete,
}: {
  list: List;
  /**
   * The author's controls. Given either, a cog beside the title opens them —
   * a sheet rather than a full-width button, since reading the list is what
   * the panel is for and editing is the rarer errand.
   */
  onEdit?: () => void;
  onDelete?: () => void;
  onOpenUser?: (userId: string, origin: SummaryOrigin | null) => void;
  onOpenCar?: (carId: string) => void;
  /** On the car's own page, "attached to this car" is the page you're on. */
  hideCar?: boolean;
}) {
  const colors = useColors();
  const authorRef = useRef<View>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const hasMenu = !!(onEdit || onDelete);

  const cover = firstGalleryUrl(list.gallery);
  const body = list.body ? stripHtml(list.body).trim() : '';
  // The server strips soft-deleted items now, but it didn't always, and a
  // cached response from before it did would number a ghost.
  const items = (list.items ?? []).filter((i) => !i.deleted);
  const author = list.user ?? null;
  const car = !hideCar && list.car_id ? list.car ?? null : null;

  return (
    <View>
      {cover ? <Image source={{ uri: cover }} style={styles.cover} contentFit="cover" transition={150} /> : null}

      <View style={styles.body}>
        <View style={styles.titleRow}>
          <Text style={[styles.title, { color: colors.fg }]}>{list.title}</Text>
          {hasMenu && (
            <TouchableOpacity
              style={[styles.cogBtn, { backgroundColor: colors.segment }]}
              onPress={() => setMenuOpen(true)}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="List options"
            >
              <Settings size={17} color={colors.fg} />
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.badges}>
          <View style={[styles.badge, { backgroundColor: colors.segment }]}>
            <Text style={[styles.badgeText, { color: colors.grey }]}>
              {items.length} item{items.length === 1 ? '' : 's'}
            </Text>
          </View>
          {list.category ? (
            <View style={[styles.badge, { backgroundColor: colors.segment }]}>
              <Text style={[styles.badgeText, styles.capitalize, { color: colors.grey }]}>{list.category}</Text>
            </View>
          ) : null}
          {list.private ? (
            <View style={[styles.badge, { backgroundColor: colors.segment }]}>
              <Lock size={10} color={colors.grey} />
              <Text style={[styles.badgeText, { color: colors.grey }]}>Private</Text>
            </View>
          ) : null}
          {/* Only the author is ever sent a draft, so this is a note to self. */}
          {list.status === 'draft' ? (
            <View style={[styles.badge, { backgroundColor: colors.segment }]}>
              <Text style={[styles.badgeText, { color: colors.grey }]}>Draft</Text>
            </View>
          ) : null}
        </View>

        {body ? <Text style={[styles.about, { color: colors.muted }]}>{body}</Text> : null}

        {/* Whose list it is. On a profile that's the page you came from, but
            the same panel opens from a car's page and from a notification,
            where it's the first thing you'd ask. */}
        {author ? (
          <TouchableOpacity
            ref={authorRef}
            style={styles.authorRow}
            onPress={() => measureOrigin(authorRef.current, (origin) => onOpenUser?.(author.user_id, origin))}
            disabled={!onOpenUser}
            activeOpacity={0.75}
            accessibilityRole="button"
            accessibilityLabel={`View @${author.username}`}
          >
            <Avatar user={author} size={26} />
            <Text style={[styles.authorName, { color: colors.fg }]} numberOfLines={1}>@{author.username}</Text>
          </TouchableOpacity>
        ) : null}

        {/* The car it's about — the same row a listing uses for the car it
            was listed off. The summary carries no photo, so the glyph stands in. */}
        {car ? (
          <TouchableOpacity
            style={[styles.carRow, { backgroundColor: colors.segment }]}
            onPress={() => onOpenCar?.(car.internal_id)}
            disabled={!onOpenCar}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel={`View ${listCarLabel(car)}`}
          >
            <View style={styles.carGlyph}><Car size={16} color={colors.grey} /></View>
            <View style={styles.carText}>
              <Text style={[styles.carLabel, { color: colors.grey }]}>A list for</Text>
              <Text style={[styles.carTitle, { color: colors.fg }]} numberOfLines={1}>{listCarLabel(car)}</Text>
            </View>
          </TouchableOpacity>
        ) : null}

        {items.length > 0 ? (
          <View style={styles.items}>
            {items.map((item, i) => <ItemRow key={item.internal_id} item={item} rank={i + 1} />)}
          </View>
        ) : (
          <Text style={[styles.empty, { color: colors.grey }]}>Nothing on this list yet.</Text>
        )}
      </View>

      {hasMenu && (
        <ActionSheet
          visible={menuOpen}
          onClose={() => setMenuOpen(false)}
          title={list.title}
          options={[
            ...(onEdit ? [{ label: 'Edit list', Icon: PenSquare, onPress: onEdit }] : []),
            ...(onDelete ? [{ label: 'Delete list', Icon: Trash2, destructive: true, onPress: onDelete }] : []),
          ]}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  cover: { width: '100%', height: 140, backgroundColor: '#161616' },
  body:  { padding: 18, paddingBottom: 22, gap: 8 },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  title: { flex: 1, fontSize: 20, fontWeight: '800', letterSpacing: -0.3 },
  cogBtn: {
    width: 34, height: 34, borderRadius: COMMON_RADIUS,
    alignItems: 'center', justifyContent: 'center',
  },

  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  badge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: PILL_RADIUS,
  },
  badgeText:  { fontSize: 11, fontWeight: '700' },
  capitalize: { textTransform: 'capitalize' },

  about: { fontSize: 13.5, lineHeight: 19, marginTop: 2 },

  authorRow:  { flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start', marginTop: 2 },
  authorName: { fontSize: 14, fontWeight: '700', flexShrink: 1 },

  carRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    padding: 8, borderRadius: COMMON_RADIUS, marginTop: 4,
  },
  carGlyph: {
    width: 44, height: 34, borderRadius: 6, backgroundColor: '#161616',
    alignItems: 'center', justifyContent: 'center',
  },
  carText:  { flex: 1, minWidth: 0 },
  carLabel: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  carTitle: { fontSize: 14, fontWeight: '700', marginTop: 1 },

  items: { marginTop: 8 },
  item: {
    gap: 8,
    paddingVertical: 12, borderTopWidth: StyleSheet.hairlineWidth,
  },
  // A disc, fixed size, so 1 and 10 sit the same.
  rank: {
    width: 26, height: 26, borderRadius: 13,
    alignItems: 'center', justifyContent: 'center',
  },
  rankText:    { fontSize: 13, fontWeight: '800' },
  rankOnPhoto: { position: 'absolute', top: 8, left: 8 },
  // The panel's full width: the car is the point of the entry.
  itemPhoto: { width: '100%', aspectRatio: 16 / 10, borderRadius: COMMON_RADIUS, backgroundColor: '#161616' },
  itemText:  { minWidth: 0, gap: 3 },
  itemTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  itemTitle: { flex: 1, fontSize: 15, fontWeight: '700' },
  itemDesc:  { fontSize: 13, lineHeight: 18 },
  // Small, and the panel's secondary grey: it's a way out of the list, not the
  // thing the list is for.
  linkBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start',
    maxWidth: '100%', marginTop: 5,
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: PILL_RADIUS,
  },
  linkText: { fontSize: 12, fontWeight: '700', flexShrink: 1 },
  empty:    { fontSize: 13, marginTop: 8 },
});
