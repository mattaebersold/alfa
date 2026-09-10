import React from 'react';
import {
  View, Text, StyleSheet, ScrollView, Dimensions,
} from 'react-native';
import { Image } from 'expo-image';
import UserSummaryModal from '../members/UserSummaryModal';
import CarSummaryModal from '../cars/CarSummaryModal';
import GroupSummaryModal from '../groups/GroupSummaryModal';
import { useEventSheet } from '../../providers/EventSheetProvider';
import { Users, Car as CarIcon, User as UserIcon, Calendar, ChevronRight } from 'lucide-react-native';
import {
  useGetGroupQuery, useGetUserByIdQuery, useGetCarQuery, useGetSocietyEventQuery,
  useGetPostTagsQuery,
} from '../../api/apiService';
import { SummaryTouchable, type SummaryOrigin } from '../ui/SummaryModal';
import { useColors } from '../../hooks/useColors';
import { colors } from '../../constants/colors';
import { imageUrl, firstGalleryUrl } from '../../utils/image';
import type { Post } from '../../types/api';

const SCREEN_WIDTH = Dimensions.get('window').width;
/** The card's own horizontal inset — tiles line up with everything else on it. */
const GUTTER = 8;
const GAP = 8;

/**
 * How wide each tile is, given how many there are.
 *
 * One fills the row: there's nothing to scroll to, and a lone tile floating at
 * 40% next to empty space reads as a loading state. Two split it evenly, for
 * the same reason. Past that the row genuinely scrolls, and the tiles go
 * narrower than half so the next one is visibly cut off by the edge — the peek
 * is the only thing that says there is more.
 */
function tileWidth(count: number): number {
  const inner = SCREEN_WIDTH - GUTTER * 2;
  if (count <= 1) return inner;
  if (count === 2) return (inner - GAP) / 2;
  return SCREEN_WIDTH * 0.4;
}

type Kind = 'group' | 'user' | 'car' | 'event';

const KIND_BADGE: Record<Kind, { label: string; bg: string }> = {
  group: { label: 'Group', bg: colors.badgeGroup },
  user:  { label: 'User',  bg: colors.badgeGarage },
  car:   { label: 'Car',   bg: colors.badgeRecord },
  event: { label: 'Event', bg: colors.badgeEvent },
};

const KIND_ICON = {
  group: Users,
  user:  UserIcon,
  car:   CarIcon,
  event: Calendar,
} as const;

/**
 * One tile.
 *
 * The group row's look, at tile scale: the subject's own picture pushed back
 * under an even scrim, with a badge and a name over it. Stacked and centred
 * rather than side by side — at 40% of a phone's width a badge and a name on
 * one line leave the name about four characters, and the name is the half that
 * matters.
 */
function Tile({ kind, name, image, width, onPress }: {
  kind: Kind;
  name: string;
  image?: string | null;
  width: number;
  onPress: (origin: SummaryOrigin | null) => void;
}) {
  const c = useColors();
  const badge = KIND_BADGE[kind];
  const Icon = KIND_ICON[kind];

  return (
    // `SummaryTouchable`, not a plain button: it hands its own rectangle to the
    // press handler so the panel it opens can grow out of this tile rather
    // than appearing from nowhere.
    <SummaryTouchable
      style={[styles.tile, { width }]}
      onPress={onPress}
      activeOpacity={0.85}
      accessibilityLabel={`${badge.label}: ${name}`}
    >
      {image ? (
        <Image source={{ uri: image }} style={StyleSheet.absoluteFill} contentFit="cover" />
      ) : (
        <View style={[StyleSheet.absoluteFill, styles.blank, { backgroundColor: c.segment }]}>
          <Icon size={20} color={c.grey} />
        </View>
      )}

      {/* An even wash rather than a gradient. These are footnotes to the post
          above them, and a flat scrim pushes the picture back far enough that
          the tile reads as a label with a texture behind it instead of as a
          second photo competing with the post's own. */}
      <View style={[StyleSheet.absoluteFill, styles.scrim]} pointerEvents="none" />

      <View style={styles.row}>
        <View style={styles.body}>
          <View style={[styles.badge, { backgroundColor: badge.bg }]}>
            <Text style={styles.badgeText}>{badge.label}</Text>
          </View>
          <Text style={styles.name} numberOfLines={1}>{name}</Text>
        </View>
        {/* Squared off and darker than the scrim it sits on, so it reads as the
            thing you press rather than as part of the wash. */}
        <View style={styles.chevron}>
          <ChevronRight size={14} color="rgba(255,255,255,0.85)" strokeWidth={2.5} />
        </View>
      </View>
    </SummaryTouchable>
  );
}

// ── One per kind: each resolves its own subject ──────────────────────────────
// Separate components rather than a lookup in the parent, so every hook runs
// unconditionally and the number of them doesn't change with the data.

type Open = (origin: SummaryOrigin | null) => void;

function GroupTile({ id, width, onOpen }: { id: string; width: number; onOpen: Open }) {
  const { data: group } = useGetGroupQuery(id, { skip: !id });
  if (!group) return null;
  return (
    <Tile
      kind="group"
      name={group.title ?? 'Group'}
      image={firstGalleryUrl(group.banners) ?? firstGalleryUrl(group.gallery)}
      width={width}
      onPress={onOpen}
    />
  );
}

function UserTile({ id, width, onOpen }: { id: string; width: number; onOpen: Open }) {
  const { data: user } = useGetUserByIdQuery(id, { skip: !id });
  if (!user) return null;
  return (
    <Tile
      kind="user"
      name={`@${user.username}`}
      image={firstGalleryUrl(user.gallery) ?? (user.profilePicture ? imageUrl(user.profilePicture) : null)}
      width={width}
      onPress={onOpen}
    />
  );
}

function CarTile({ id, width, onOpen }: { id: string; width: number; onOpen: Open }) {
  const { data: car } = useGetCarQuery(id, { skip: !id });
  if (!car) return null;
  const name = car.title || [car.year, car.make, car.model].filter(Boolean).join(' ') || 'Car';
  return (
    <Tile
      kind="car"
      name={name}
      image={firstGalleryUrl(car.gallery) ?? (car.profile_image ? imageUrl(car.profile_image) : null)}
      width={width}
      onPress={onOpen}
    />
  );
}

function EventTile({ id, width, onOpen }: { id: string; width: number; onOpen: Open }) {
  /**
   * A society event, not the legacy `Event`.
   *
   * There are two event collections behind two endpoints, and an event tag
   * always points at the newer one: the tag picker's suggestions come from
   * search, and search's `events` are SocietyEvents. Resolving them through
   * `api/event/detail` found nothing, so the tile rendered null and vanished —
   * while still counting toward the tile widths, which is why a post tagged
   * with an event showed one half-width tile and a gap.
   *
   * It's also the collection the sheet these open reads from, so this is now
   * the same event end to end.
   */
  const { data: event } = useGetSocietyEventQuery(id, { skip: !id });
  if (!event) return null;
  return (
    <Tile
      kind="event"
      name={event.title ?? 'Event'}
      image={firstGalleryUrl(event.gallery)}
      width={width}
      onPress={onOpen}
    />
  );
}

/** Server entry types, normalised. */
function kindFromEntryType(t?: string): Exclude<Kind, 'group'> | null {
  if (t === 'user') return 'user';
  if (t === 'garagecar' || t === 'car') return 'car';
  if (t === 'event') return 'event';
  return null;
}

/**
 * Everything this post is attached to, as one scrolling row.
 *
 * A post used to say only where it was posted — a single group banner — and
 * said nothing at all about who or what was tagged in it, which was information
 * the post already carried and the card simply dropped. Groups and tags are the
 * same kind of fact ("this post is connected to that thing"), so they're one
 * row rather than a banner plus a list somewhere else.
 *
 * Groups lead, because where a post lives frames everything else about it.
 *
 * Tags come off the post when the endpoint attached them — the feed batches
 * them server-side — and are fetched only when it didn't. Each tile still
 * resolves its own subject, which is cached, so a feed full of posts tagging
 * the same car costs one request for it.
 */
export default function PostContextRow({ post }: { post: Post }) {
  const { openEventSheet } = useEventSheet();

  /**
   * Which panel is open, and where it should grow from.
   *
   * One piece of state rather than one per kind: only one panel is ever open,
   * and tracking them separately is how you end up with two on screen.
   */
  const [open, setOpen] = React.useState<
    { kind: Kind; id: string; origin: SummaryOrigin | null } | null
  >(null);

  const groupIds = React.useMemo(() => {
    const ids = post.group_ids?.length ? post.group_ids : [post.group_id];
    return [...new Set(ids.filter(Boolean) as string[])];
  }, [post.group_ids, post.group_id]);

  // The feed sends tags with the post; other surfaces don't, and only those pay
  // for a request.
  const inlineTags = Array.isArray(post.tags) ? post.tags : null;
  const { data: fetchedTags } = useGetPostTagsQuery(post.internal_id, {
    skip: !!inlineTags || !post.internal_id,
  });
  const tags = inlineTags ?? fetchedTags ?? [];

  const items = React.useMemo(() => {
    const out: { key: string; kind: Kind; id: string }[] =
      groupIds.map((id) => ({ key: `group-${id}`, kind: 'group' as Kind, id }));

    tags.forEach((t: any) => {
      const kind = kindFromEntryType(t.tag_entry_type);
      const id = t.tag_internal_id;
      if (!kind || !id) return;
      const key = `${kind}-${id}`;
      // The same car tagged twice is one tile.
      if (out.some((o) => o.key === key)) return;
      out.push({ key, kind, id });
    });

    return out;
  }, [groupIds, tags]);

  if (items.length === 0) return null;

  /**
   * A tap summarises; it doesn't travel.
   *
   * Every one of these tiles is a detour from the post you were reading, and
   * sending you to a whole screen to answer "which car is that" costs the
   * place you were in. The panels all carry their own "view more" for when the
   * answer is worth leaving for.
   *
   * Events are the exception in mechanism only: their sheet already exists at
   * the root — it's the same one the calendar and the drawer open — so they
   * get that rather than a second, thinner version of it.
   */
  const openFor = (kind: Kind, id: string) => (origin: SummaryOrigin | null) => {
    if (kind === 'event') return openEventSheet({ eventId: id });
    setOpen({ kind, id, origin });
  };

  const width = tileWidth(items.length);
  // Nothing to scroll when the tiles already fit, and a scrollable row that
  // can't move swallows a horizontal swipe the carousel above it might want.
  const scrolls = items.length > 2;

  const tiles = items.map((item) => {
    const props = { id: item.id, width, onOpen: openFor(item.kind, item.id) };
    if (item.kind === 'group') return <GroupTile key={item.key} {...props} />;
    if (item.kind === 'user')  return <UserTile key={item.key} {...props} />;
    if (item.kind === 'car')   return <CarTile key={item.key} {...props} />;
    return <EventTile key={item.key} {...props} />;
  });

  const close = () => setOpen(null);

  return (
    <>
      {scrolls ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.scroller}
          contentContainerStyle={styles.strip}
        >
          {tiles}
        </ScrollView>
      ) : (
        <View style={styles.strip}>{tiles}</View>
      )}

      <UserSummaryModal
        userId={open?.kind === 'user' ? open.id : null}
        origin={open?.origin}
        onClose={close}
      />
      <CarSummaryModal
        carId={open?.kind === 'car' ? open.id : null}
        origin={open?.origin}
        onClose={close}
      />
      <GroupSummaryModal
        groupId={open?.kind === 'group' ? open.id : null}
        origin={open?.origin}
        onClose={close}
      />
    </>
  );
}
const styles = StyleSheet.create({
  // `flexGrow: 0` or the row takes the height left over in the card's column
  // and stretches the tiles to fill it.
  scroller: { flexGrow: 0, flexShrink: 0 },
  strip: {
    flexDirection: 'row', alignItems: 'center', gap: GAP,
    paddingHorizontal: GUTTER, paddingTop: 12, paddingBottom: 1,
  },
  tile: {
    height: 58,
    borderRadius: 10, overflow: 'hidden',
    justifyContent: 'center',
  },
  blank: { alignItems: 'center', justifyContent: 'center' },
  scrim: { backgroundColor: 'rgba(0,0,0,0.62)' },
  // The tile's contents: the stacked badge-and-name on the left, the chevron
  // pinned right.
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 10,
  },
  body: {
    flex: 1, minWidth: 0,
    alignItems: 'flex-start', justifyContent: 'center', gap: 3,
  },
  // `alignSelf` keeps the badge the width of its word rather than the width of
  // the name under it.
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 6, paddingVertical: 1.5, borderRadius: 3,
  },
  badgeText: {
    fontSize: 8, fontWeight: '800', color: '#000000',
  },
  // Regular weight: the badge above it is already doing the emphasis, and two
  // bold things stacked read as one loud block.
  name: {
    maxWidth: '100%',
    fontSize: 13, fontWeight: '500', color: 'rgba(255,255,255,0.95)',
  },
  chevron: {
    width: 24, height: 24, borderRadius: 6,
    flexShrink: 0,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
});
