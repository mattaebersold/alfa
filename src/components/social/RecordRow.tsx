import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Image } from 'expo-image';
import { MoreVertical } from 'lucide-react-native';
import Avatar from '../ui/Avatar';
import { CATEGORY_LABELS } from '../ui/Badge';
import { categoryColor, pillTextColor } from '../../utils/categoryColor';
import { useColors } from '../../hooks/useColors';

/**
 * One row of a record-style list: photo, title, a line of meta, a category pill.
 *
 * Shared by a car's Records pane and a group's Posts tab — the two show the same
 * kind of thing and had drifted into two layouts. The surface colours are props
 * because the car pane draws on a near-black sheet while the group screen draws
 * on a card; everything else is identical by design.
 */

interface Props {
  title?: string | null;
  /**
   * Already-resolved image URL. Without one the row drops the thumbnail
   * entirely and gives the space to the words — a placeholder square told you
   * nothing except that there was no picture.
   */
  imageUri?: string | null;
  /** One line under the title — a timestamp, or "@author · timestamp". */
  meta?: string | null;
  /**
   * The author's photo, shown against the meta line. Supply it where who
   * posted is part of the answer — a group's feed — and leave it off where
   * everything in the list is by the same person.
   */
  avatarFilename?: string | null;
  avatarName?: string | null;
  category?: string | null;
  onPress?: () => void;
  /** Supply to show the ⋮; omitted means no menu for this viewer. */
  onMenuPress?: () => void;
  /** Text colour. Defaults to the theme foreground. */
  fg?: string;
  /** Row separator colour. */
  border?: string;
  /**
   * Fill for the image placeholder.
   * @deprecated A row without a photo has no placeholder to fill any more.
   */
  placeholder?: string;
}

const THUMB = 108;

export default function RecordRow({
  title, imageUri, meta, avatarFilename, avatarName, category, onPress, onMenuPress,
  fg, border, placeholder,
}: Props) {
  const c = useColors();
  const titleColor = fg ?? c.fg;
  const tint = category ? categoryColor(category) : null;
  const hasImage = !!imageUri;

  return (
    <TouchableOpacity
      style={[styles.row, { borderBottomColor: border ?? c.borderDark }]}
      onPress={onPress}
      disabled={!onPress}
      activeOpacity={0.75}
    >
      {hasImage && (
        <Image source={{ uri: imageUri! }} style={styles.thumb} contentFit="cover" />
      )}

      <View style={styles.content}>
        {title ? (
          // Bigger without a picture: the text is the whole row then, and at
          // the thumbnail-sized type it looked like a caption missing its
          // photo.
          <Text
            style={[hasImage ? styles.title : styles.titleAlone, { color: titleColor }]}
            numberOfLines={hasImage ? 2 : 4}
          >
            {title}
          </Text>
        ) : null}
        {meta ? (
          <View style={styles.metaRow}>
            {avatarFilename !== undefined && (
              <Avatar filename={avatarFilename ?? undefined} name={avatarName ?? '?'} size={20} />
            )}
            <Text style={[styles.meta, { color: c.grey }]} numberOfLines={1}>{meta}</Text>
          </View>
        ) : null}
        {category && tint ? (
          <View style={[styles.pill, { backgroundColor: tint }]}>
            <Text style={[styles.pillText, { color: pillTextColor(tint) }]}>
              {CATEGORY_LABELS[category] ?? category}
            </Text>
          </View>
        ) : null}
      </View>

      {onMenuPress && (
        <TouchableOpacity
          onPress={onMenuPress}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          style={styles.menuBtn}
          accessibilityRole="button"
          accessibilityLabel={`Options for ${title ?? 'item'}`}
        >
          <MoreVertical size={18} color={c.grey} />
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingLeft: 12, paddingRight: 4, paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  thumb:    { width: THUMB, height: THUMB, borderRadius: 10 },
  content:  { flex: 1, minWidth: 0, gap: 6 },
  title:    { fontSize: 16, fontWeight: '600', lineHeight: 21 },
  // The picture-less variant: larger, and given a little more room to run.
  titleAlone: { fontSize: 19, fontWeight: '700', lineHeight: 25 },
  metaRow:  { flexDirection: 'row', alignItems: 'center', gap: 7 },
  meta:     { fontSize: 11, flexShrink: 1 },
  // `alignSelf` keeps the pill hugging its label instead of stretching the row.
  pill:     { alignSelf: 'flex-start', paddingHorizontal: 9, paddingVertical: 3, borderRadius: 999 },
  pillText: { fontSize: 11, fontWeight: '700' },
  menuBtn:  { padding: 2 },
});
