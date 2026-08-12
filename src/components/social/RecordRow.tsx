import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Image } from 'expo-image';
import { MoreVertical } from 'lucide-react-native';
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
  /** Already-resolved image URL. Null renders a placeholder of the same size. */
  imageUri?: string | null;
  /** One line under the title — a timestamp, or "@author · timestamp". */
  meta?: string | null;
  category?: string | null;
  onPress?: () => void;
  /** Supply to show the ⋮; omitted means no menu for this viewer. */
  onMenuPress?: () => void;
  /** Text colour. Defaults to the theme foreground. */
  fg?: string;
  /** Row separator colour. */
  border?: string;
  /** Fill for the image placeholder. */
  placeholder?: string;
}

const THUMB = 108;

export default function RecordRow({
  title, imageUri, meta, category, onPress, onMenuPress,
  fg, border, placeholder,
}: Props) {
  const c = useColors();
  const titleColor = fg ?? c.fg;
  const tint = category ? categoryColor(category) : null;

  return (
    <TouchableOpacity
      style={[styles.row, { borderBottomColor: border ?? c.borderDark }]}
      onPress={onPress}
      disabled={!onPress}
      activeOpacity={0.75}
    >
      {imageUri
        ? <Image source={{ uri: imageUri }} style={styles.thumb} contentFit="cover" />
        : <View style={[styles.thumb, { backgroundColor: placeholder ?? c.segment }]} />}

      <View style={styles.content}>
        {title ? (
          <Text style={[styles.title, { color: titleColor }]} numberOfLines={2}>{title}</Text>
        ) : null}
        {meta ? <Text style={[styles.meta, { color: c.grey }]} numberOfLines={1}>{meta}</Text> : null}
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
  meta:     { fontSize: 11 },
  // `alignSelf` keeps the pill hugging its label instead of stretching the row.
  pill:     { alignSelf: 'flex-start', paddingHorizontal: 9, paddingVertical: 3, borderRadius: 999 },
  pillText: { fontSize: 11, fontWeight: '700' },
  menuBtn:  { padding: 2 },
});
