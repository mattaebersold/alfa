import React, { useEffect, useRef, useState } from 'react';
import {
  View, StyleSheet, ScrollView, TouchableOpacity, Alert, ActivityIndicator,
} from 'react-native';
import { Text } from '../theme/Text';
import { Image } from 'expo-image';
import { MapPin, Clock, ShieldAlert, Camera, Pencil, Trash2, ImagePlus, Settings } from 'lucide-react-native';
import SummaryModal, { SummaryTouchable, measureOrigin, type SummaryOrigin } from '../components/SummaryModal';
import Lightbox from '../components/Lightbox';
import AvatarStack from '../components/AvatarStack';
import SpotContributorsSheet, { contributorsOf } from './SpotContributorsSheet';
import { useColors, useBrandColor } from '../theme/useColors';
import { useOrsSelector } from '../store/createStore';
import {
  useGetPhotoSpotQuery, useDeletePhotoSpotMutation,
} from '../api/orsApi';
import { useAddSpotPhotos } from './useAddSpotPhotos';
import { useRemovePhotoSpotPhotoMutation } from './api';
import { imageUrl } from '../constants/appConfig';
import { spotTypeLabel, spotCategoryLabel, spotTypeColor } from './constants';
import type { PhotoSpotPhoto } from '../types/ors';
import { FONT_INTER } from '../theme/fonts'


/**
 * What a pin is, when you tap it.
 *
 * A summary rather than a screen: the map is the thing you're using, and a spot
 * is a paragraph and some photos — pushing a whole screen for that loses your
 * place on the map to read four lines.
 *
 * Fetched by id rather than handed the list row, because the map's listing is a
 * deliberately narrow projection (coordinate, title, owner) and everything worth
 * reading here — the body, the access note, the photos — isn't in it.
 *
 * Ported from alfa's components/photography/PhotoSpotSummaryModal, on alfa's
 * SummaryModal. Navigation-agnostic: Edit hands the id back through `onEdit`
 * (no `onEdit`, no Edit button — Remove stays), and what's tagged on the spot
 * is the host's to draw through `renderContext` — alfa passes its
 * PostContextRow of tagged members, cars and events; an app without tags
 * passes nothing.
 *
 * Who may do what: only the member who pinned the spot can edit or remove it,
 * from the cog beside the byline; anyone signed in can add their own photos to
 * a public one. Tap a photo to see it full-screen, hold one you may remove to
 * take it down.
 */
export interface PhotoSpotSummaryModalProps {
  spotId: string | null;
  onClose: () => void;
  /** The owner chose Edit. Runs once the summary has finished closing. */
  onEdit?: (spotId: string) => void;
  /** Drawn under the photos — who and what is tagged on this spot. */
  renderContext?: (spotId: string) => React.ReactNode;
  /**
   * The pinner's profile preview, stacked over this panel when their name is
   * tapped: typically the shared UserSummaryModal with the app's own stats and
   * follow button. Always render it — `open` is null while it's closed, so it
   * can animate away. Without this the byline isn't tappable.
   */
  renderUserSummary?: (
    open: { userId: string; origin: SummaryOrigin | null } | null,
    close: () => void,
  ) => React.ReactNode;
}

export default function PhotoSpotSummaryModal({
  spotId, onClose, onEdit, renderContext, renderUserSummary,
}: PhotoSpotSummaryModalProps) {
  const colors = useColors();
  const brand = useBrandColor();
  const { data: spot } = useGetPhotoSpotQuery(spotId as string, { skip: !spotId });
  const me = useOrsSelector((s) => s.auth.userInfo);
  const isOwner = !!spot && !!me?.user_id && spot.user_id === me.user_id;
  const [deleteSpot, { isLoading: deleting }] = useDeletePhotoSpotMutation();
  const { add: addSpotPhotos, adding, canAdd: mayAddTo } = useAddSpotPhotos();
  const [removePhoto] = useRemovePhotoSpotPhotoMutation();
  /** Which photo the lightbox is on; null when it's closed. */
  const [viewing, setViewing] = useState<number | null>(null);
  /** The pinner's cog menu — Edit and Remove — open. */
  const [menuOpen, setMenuOpen] = useState(false);
  /** A member's profile preview, when their name or face has been tapped. */
  const [userOpen, setUserOpen] = useState<{ userId: string; origin: SummaryOrigin | null } | null>(null);
  /** The list of everyone who added photos, when the faces have been tapped. */
  const [contributorsOpen, setContributorsOpen] = useState<{ origin: SummaryOrigin | null } | null>(null);
  /** How wide the sheet's content is — the photo tiles are a share of it. */
  const [contentWidth, setContentWidth] = useState(0);
  // A preview left up when the sheet goes some other way is forgotten, so
  // reopening the sheet doesn't bring it straight back.
  useEffect(() => { if (!spotId) { setUserOpen(null); setContributorsOpen(null); setMenuOpen(false); } }, [spotId]);

  /** Anyone signed in can add to a public spot — see useAddSpotPhotos. */
  const canAdd = mayAddTo(spot);
  const addYourPhotos = () => { if (spot) addSpotPhotos(spot); };

  /** Your own contribution, or anything on your own spot. */
  const mayRemove = (photo: PhotoSpotPhoto) =>
    !!me?.user_id && (photo.user_id === me.user_id || isOwner);

  const removeOne = (photo: PhotoSpotPhoto) => {
    if (!spot || !photo.filename) return;
    const whose = photo.user_id && photo.user_id !== me?.user_id
      ? `${photo.user?.username ?? 'their'}'s photo`
      : 'your photo';
    Alert.alert('Remove this photo?', `Takes ${whose} off the spot. This can't be undone.`, [
      { text: 'Keep', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          try {
            await removePhoto({ internal_id: spot.internal_id, filename: photo.filename! }).unwrap();
          } catch (err: any) {
            Alert.alert("Couldn't remove it", err?.data?.error ?? 'Please try again.');
          }
        },
      },
    ]);
  };

  /** Your own pin: change it, or take it off the map. */
  const edit = () => {
    if (!spot || !onEdit) return;
    const id = spot.internal_id;
    setMenuOpen(false);
    onClose();
    // After the summary has gone — iOS won't present a modal over one that's
    // still dismissing.
    setTimeout(() => onEdit(id), 350);
  };
  const remove = () => {
    if (!spot) return;
    setMenuOpen(false);
    Alert.alert('Remove this spot?', `"${spot.title}" comes off the map for everyone. This can't be undone.`, [
      { text: 'Keep', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteSpot(spot.internal_id).unwrap();
            onClose();
          } catch (err: any) {
            Alert.alert("Couldn't remove it", err?.data?.error ?? 'Please try again.');
          }
        },
      },
    ]);
  };

  const gallery = spot?.gallery ?? [];
  const contributors = spot ? contributorsOf(spot) : [];
  // 80% of the sheet: a photo you can actually see, with the next one peeking in. 3:2, like the shots.
  const tileWidth = Math.round(contentWidth * 0.8);
  const tileHeight = Math.round(tileWidth * 2 / 3);
  const avatarUrl = imageUrl(spot?.user?.profile?.[0] ?? spot?.user?.gallery?.[0]?.filename, 'thumb');
  const typeLabel = spotTypeLabel(spot?.type);
  const categoryLabel = spotCategoryLabel(spot?.category);

  return (
    <SummaryModal
      visible={!!spotId}
      onClose={onClose}
      // Presented over this panel — see SummaryModal's "Stacking": the full-screen
      // photo, and the pinner's preview.
      stacked={(
        <>
          <Lightbox images={gallery} index={viewing} onClose={() => setViewing(null)} />
          {/* The contributors list, with the member preview stacked on *it* — a
              row's tap opens a preview over the list, and iOS presents a panel
              only from inside the one it covers. */}
          <SpotContributorsSheet
            users={contributors}
            visible={!!contributorsOpen}
            origin={contributorsOpen?.origin}
            onClose={() => setContributorsOpen(null)}
            onOpenUser={renderUserSummary ? (userId, origin) => setUserOpen({ userId, origin }) : undefined}
            stacked={contributorsOpen ? renderUserSummary?.(userOpen, () => setUserOpen(null)) : null}
          />
          {!contributorsOpen && renderUserSummary?.(userOpen, () => setUserOpen(null))}
        </>
      )}
    >
      {!spot ? (
        <View style={styles.loading}>
          <Text style={{ color: colors.grey }}>Loading…</Text>
        </View>
      ) : (
        // The panel scrolls this itself; this only pads it away from the edges.
        <View style={styles.content} onLayout={(e) => setContentWidth(e.nativeEvent.layout.width)}>
          <View style={styles.body}>
            <View style={styles.byline}>
              {/* Who pinned it. Tapping them opens their preview over this sheet. */}
              <SummaryTouchable
                style={styles.pinner}
                disabled={!renderUserSummary || !spot.user_id}
                onPress={(origin) => spot.user_id && setUserOpen({ userId: spot.user_id, origin })}
                accessibilityLabel={spot.user?.username ? `${spot.user.username}, who pinned this` : 'Who pinned this'}
              >
                {avatarUrl ? (
                  <Image source={{ uri: avatarUrl }} style={styles.avatar} contentFit="cover" />
                ) : (
                  <View style={[styles.avatar, { backgroundColor: colors.segment }]} />
                )}
                <Text style={[styles.bylineText, { color: colors.fg }]} numberOfLines={1}>
                  {spot.user?.username ?? 'Member'}
                </Text>
              </SummaryTouchable>
              {/* The pinner's controls live behind a cog, out of everyone else's
                  way — nobody but the pinner sees it. */}
              {isOwner && (
                <TouchableOpacity
                  style={[styles.cog, { borderColor: colors.border }, menuOpen && { backgroundColor: colors.segment }]}
                  onPress={() => setMenuOpen((open) => !open)}
                  activeOpacity={0.75}
                  accessibilityRole="button"
                  accessibilityLabel="Pin options"
                  accessibilityState={{ expanded: menuOpen }}
                >
                  <Settings size={15} color={colors.fg} />
                </TouchableOpacity>
              )}
            </View>

            {isOwner && menuOpen && (
              <View style={[styles.menu, { borderColor: colors.border, backgroundColor: colors.segment }]}>
                {onEdit && (
                  <TouchableOpacity
                    style={[styles.menuRow, { borderBottomColor: colors.border }]}
                    onPress={edit}
                    activeOpacity={0.7}
                    accessibilityRole="menuitem"
                    accessibilityLabel="Edit this pin"
                  >
                    <Pencil size={15} color={colors.fg} />
                    <Text style={[styles.menuText, { color: colors.fg }]}>Edit pin</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  style={[styles.menuRow, styles.menuRowLast, deleting && { opacity: 0.5 }]}
                  onPress={remove}
                  disabled={deleting}
                  activeOpacity={0.7}
                  accessibilityRole="menuitem"
                  accessibilityLabel="Remove this pin"
                >
                  <Trash2 size={15} color="#E23B3B" />
                  <Text style={[styles.menuText, { color: '#E23B3B' }]}>Remove pin</Text>
                </TouchableOpacity>
              </View>
            )}

            <Text style={[styles.title, { color: colors.fg }]}>{spot.title}</Text>

            {(typeLabel || categoryLabel) && (
              <View style={styles.badges}>
                {typeLabel && (
                  <View style={[styles.badge, { backgroundColor: spotTypeColor(spot.type) }]}>
                    <Text style={styles.badgeText}>{typeLabel}</Text>
                  </View>
                )}
                {categoryLabel && (
                  <View style={[styles.badge, { backgroundColor: colors.segment }]}>
                    <Text style={[styles.badgeText, { color: colors.fg }]}>{categoryLabel}</Text>
                  </View>
                )}
              </View>
            )}

            {spot.location ? (
              <Row Icon={MapPin} text={spot.location} color={colors.grey} fg={colors.fg} />
            ) : null}
            {spot.best_time ? (
              <Row Icon={Clock} text={spot.best_time} color={colors.grey} fg={colors.fg} />
            ) : null}
            {spot.access_note ? (
              <Row Icon={ShieldAlert} text={spot.access_note} color={colors.grey} fg={colors.fg} />
            ) : null}

            {spot.body ? (
              <Text style={[styles.text, { color: colors.fg }]}>{spot.body}</Text>
            ) : null}
          </View>

          {/* Photos taken here — the evidence for the spot being worth the
              trip. The owner's carry no credit: the byline already says whose
              spot it is. One another member added is captioned with theirs.
              Tap one to see it full-screen; hold one you may remove to take it
              down. The strip runs edge to edge under the panel's padding. */}
          {gallery.length > 0 && tileWidth > 0 && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.shotsStrip}
              contentContainerStyle={styles.shots}
              snapToInterval={tileWidth + 8}
              decelerationRate="fast"
            >
              {gallery.map((g, i) => {
                const url = imageUrl(g.filename);
                if (!url) return null;
                const credit = g.user_id && g.user_id !== spot.user_id ? g.user : null;
                const creditAvatar = imageUrl(credit?.profile?.[0] ?? credit?.gallery?.[0]?.filename, 'thumb');
                return (
                  <TouchableOpacity
                    key={g.filename ?? i}
                    activeOpacity={0.85}
                    onPress={() => setViewing(i)}
                    onLongPress={mayRemove(g) ? () => removeOne(g) : undefined}
                    delayLongPress={350}
                    accessibilityRole="imagebutton"
                    accessibilityLabel={credit?.username ? `Photo by ${credit.username}` : 'Photo from this spot'}
                    accessibilityHint="Opens it full-screen"

                  >
                    <Image source={{ uri: url }} style={[styles.shot, { width: tileWidth, height: tileHeight }]} contentFit="cover" />
                    {credit && (
                      <View style={styles.credit}>
                        {creditAvatar ? (
                          <Image source={{ uri: creditAvatar }} style={styles.creditAvatar} contentFit="cover" />
                        ) : null}
                        <Text style={styles.creditText} numberOfLines={1}>
                          {credit.username ?? 'member'}
                        </Text>
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          )}

          {gallery.length === 0 && (
            <View style={[styles.noShots, { borderColor: colors.border }]}>
              <Camera size={14} color={colors.grey} />
              <Text style={[styles.noShotsText, { color: colors.grey }]}>
                No photos from here yet{canAdd ? ' — add yours' : ''}
              </Text>
            </View>
          )}

          {canAdd && (
            <TouchableOpacity
              style={[styles.addBtn, { borderColor: brand }, adding && { opacity: 0.6 }]}
              onPress={addYourPhotos}
              disabled={adding}
              activeOpacity={0.75}
              accessibilityRole="button"
              accessibilityLabel="Add your photos from this spot"
            >
              {adding
                ? <ActivityIndicator size="small" color={brand} />
                : <ImagePlus size={15} color={brand} strokeWidth={2.4} />}
              <Text style={[styles.addBtnText, { color: brand }]}>
                {adding ? 'Uploading…' : 'Add your photos'}
              </Text>
            </TouchableOpacity>
          )}

          {/* Who has photos here: faces, then the list. */}
          {contributors.length > 0 && (
            <ContributorsRow users={contributors} onPress={(origin) => setContributorsOpen({ origin })} />
          )}

          {/* Anything else the host associates with the spot — alfa's tag tiles, if it passes them. */}
          {renderContext?.(spot.internal_id)}


        </View>
      )}
    </SummaryModal>
  );
}

/** The stack of faces that opens the contributors list, measured so the list grows out of it. */
function ContributorsRow({ users, onPress }: {
  users: ReturnType<typeof contributorsOf>;
  onPress: (origin: SummaryOrigin | null) => void;
}) {
  const colors = useColors();
  const ref = useRef<View>(null);
  return (
    <TouchableOpacity
      ref={ref}
      style={[styles.contributors, { borderTopColor: colors.border }]}
      onPress={() => measureOrigin(ref.current, onPress)}
      activeOpacity={0.75}
      accessibilityRole="button"
      accessibilityLabel={`Photos from ${users.length} ${users.length === 1 ? 'member' : 'members'}`}
    >
      <AvatarStack users={users} size={30} ringColor="#000000" />
      <Text style={[styles.contributorsText, { color: colors.grey }]}>
        Photos from {users.length} {users.length === 1 ? 'member' : 'members'}
      </Text>
    </TouchableOpacity>
  );
}

function Row({ Icon, text, color, fg }: {
  Icon: typeof MapPin; text: string; color: string; fg: string;
}) {
  return (
    <View style={styles.row}>
      <Icon size={13} color={color} />
      <Text style={[styles.rowText, { color: fg }]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  loading: { paddingVertical: 40, alignItems: 'center' },
  content: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 18 },
  // The pinner's cog, at the end of the byline, and the menu it opens — in the
  // flow under the byline rather than floating, so the panel simply grows for it.
  cog: {
    width: 30, height: 30, borderRadius: 15, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center', marginLeft: 'auto',
  },
  menu:        { borderWidth: 1, borderRadius: 12, overflow: 'hidden', marginTop: 2 },
  menuRow:     { flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 14, paddingVertical: 11, borderBottomWidth: StyleSheet.hairlineWidth },
  menuRowLast: { borderBottomWidth: 0 },
  menuText:    { fontSize: 14, fontFamily: FONT_INTER.bold },
  body:    { gap: 8 },

  byline:     { flexDirection: 'row', alignItems: 'center', gap: 8 },
  pinner:     { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1 },
  avatar:     { width: 24, height: 24, borderRadius: 12 },
  bylineText: { fontSize: 13, fontFamily: FONT_INTER.bold, flexShrink: 1 },

  title: { fontSize: 20, fontFamily: FONT_INTER.bold, lineHeight: 25 },

  badges:    { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 2 },
  badge:     { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  // Never uppercase, no letter-spacing — the house rule for every badge.
  badgeText: { fontSize: 11, fontFamily: FONT_INTER.extrabold, color: '#FFFFFF', letterSpacing: 0 },

  row:     { flexDirection: 'row', alignItems: 'flex-start', gap: 7, marginTop: 2 },
  rowText: { flex: 1, fontSize: 13, lineHeight: 18 },

  text: { fontSize: 14, lineHeight: 20, marginTop: 4 },

  // Bleeds past the content padding, so the strip scrolls from edge to edge and
  // the first photo still lines up with the text above it.
  shotsStrip: { marginHorizontal: -16 },
  shots: { gap: 8, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 6 },
  // Sized inline — 80% of the sheet's width, 3:2.
  shot:  { borderRadius: 12 },
  contributors: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    marginTop: 14, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth,
  },
  contributorsText: { fontSize: 13, fontFamily: FONT_INTER.semibold, flexShrink: 1 },
  // Over the photo's bottom-left corner: who took it, for a contributed one.
  credit: {
    position: 'absolute', left: 6, bottom: 6, maxWidth: 138,
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 999,
    paddingHorizontal: 7, paddingVertical: 3,
  },
  creditAvatar: { width: 14, height: 14, borderRadius: 7 },
  creditText:   { color: '#FFFFFF', fontSize: 10.5, fontFamily: FONT_INTER.bold, flexShrink: 1 },

  addBtn: {
    alignSelf: 'flex-start',
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, borderWidth: 1.5,
    marginTop: 8,
  },
  addBtnText: { fontSize: 13, fontFamily: FONT_INTER.bold },

  noShots: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7,
    borderWidth: 1, borderRadius: 10, borderStyle: 'dashed',
    paddingVertical: 16, marginVertical: 14,
  },
  noShotsText: { fontSize: 12, fontFamily: FONT_INTER.semibold },

});
