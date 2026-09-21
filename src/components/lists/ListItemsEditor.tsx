import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { Check, ChevronDown, ChevronUp, Link2, Pencil, Plus, Trash2 } from 'lucide-react-native';
import { useColors } from '../../hooks/useColors';
import { listLinkLabel } from '../../utils/listLinks';
import { COMMON_RADIUS } from '../../constants/radius';

/** One entry as the editor shows it — a staged draft and a saved item both reduce to this. */
export interface ListItemRowData {
  key: string;
  title: string;
  description?: string | null;
  photoUrl?: string | null;
  link?: string | null;
  linkLabel?: string | null;
}

/**
 * A list's entries while it's being written: ranked rows you can reorder, open
 * and remove, with "Add item" under them.
 *
 * Presentational, because the two forms keep their entries in different places
 * — the create form in memory until the list exists, the edit form on the
 * server — and both want the same rows. What a tap *does* is the host's.
 *
 * Reordering is two arrows rather than a drag handle: these lists are five or
 * ten long, a drag needs a gesture library wired through a scroll view inside
 * a modal screen, and "move up one" is exactly the edit a ranking gets.
 */
export default function ListItemsEditor({
  rows, onAdd, onEdit, onRemove, onMove, orderDirty, onSaveOrder, savingOrder,
}: {
  rows: ListItemRowData[];
  onAdd: () => void;
  onEdit: (index: number) => void;
  onRemove: (index: number) => void;
  onMove: (from: number, to: number) => void;
  /**
   * Edit form only: the order on screen differs from the server's. The create
   * form never sets it — there, order is just the order things get sent in.
   */
  orderDirty?: boolean;
  onSaveOrder?: () => void;
  savingOrder?: boolean;
}) {
  const colors = useColors();

  return (
    <View style={styles.wrap}>
      <View style={styles.head}>
        <Text style={[styles.label, { color: colors.muted }]}>Items</Text>
        {orderDirty && onSaveOrder ? (
          <TouchableOpacity
            style={[styles.saveOrder, { backgroundColor: colors.segment }]}
            onPress={onSaveOrder}
            disabled={savingOrder}
            hitSlop={8}
            accessibilityRole="button"
          >
            <Check size={13} color={colors.fg} strokeWidth={2.6} />
            <Text style={[styles.saveOrderText, { color: colors.fg }]}>
              {savingOrder ? 'Saving…' : 'Save order'}
            </Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {rows.length === 0 ? (
        <Text style={[styles.hint, { color: colors.grey }]}>
          Nothing on it yet. A list needs at least one item before it's worth showing anyone.
        </Text>
      ) : (
        <View style={[styles.rows, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {rows.map((row, index) => (
            <View
              key={row.key}
              style={[styles.row, index > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border }]}
            >
              <View style={styles.arrows}>
                <TouchableOpacity
                  onPress={() => onMove(index, index - 1)}
                  disabled={index === 0}
                  hitSlop={{ top: 6, bottom: 2, left: 8, right: 8 }}
                  style={{ opacity: index === 0 ? 0.2 : 0.7 }}
                  accessibilityRole="button"
                  accessibilityLabel={`Move ${row.title} up`}
                >
                  <ChevronUp size={18} color={colors.fg} />
                </TouchableOpacity>
                <Text style={[styles.rank, { color: colors.grey }]}>{index + 1}</Text>
                <TouchableOpacity
                  onPress={() => onMove(index, index + 1)}
                  disabled={index === rows.length - 1}
                  hitSlop={{ top: 2, bottom: 6, left: 8, right: 8 }}
                  style={{ opacity: index === rows.length - 1 ? 0.2 : 0.7 }}
                  accessibilityRole="button"
                  accessibilityLabel={`Move ${row.title} down`}
                >
                  <ChevronDown size={18} color={colors.fg} />
                </TouchableOpacity>
              </View>

              {/* The row is the edit button; the pencil is there because a
                  bare row in a form doesn't look like it opens. */}
              <TouchableOpacity
                style={styles.main}
                onPress={() => onEdit(index)}
                activeOpacity={0.75}
                accessibilityRole="button"
                accessibilityLabel={`Edit ${row.title}`}
              >
                {row.photoUrl ? (
                  <Image source={{ uri: row.photoUrl }} style={styles.photo} contentFit="cover" />
                ) : (
                  <View style={[styles.photo, { backgroundColor: colors.segment }]} />
                )}
                <View style={styles.text}>
                  <Text style={[styles.title, { color: colors.fg }]} numberOfLines={1}>{row.title}</Text>
                  {row.description ? (
                    <Text style={[styles.desc, { color: colors.muted }]} numberOfLines={1}>{row.description}</Text>
                  ) : null}
                  {row.link ? (
                    <View style={styles.linkLine}>
                      <Link2 size={11} color={colors.grey} />
                      <Text style={[styles.linkText, { color: colors.grey }]} numberOfLines={1}>
                        {listLinkLabel(row.link, row.linkLabel)}
                      </Text>
                    </View>
                  ) : null}
                </View>
                <Pencil size={14} color={colors.grey} />
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => onRemove(index)}
                style={styles.remove}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={`Remove ${row.title}`}
              >
                <Trash2 size={16} color={colors.grey} />
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}

      <TouchableOpacity
        style={[styles.add, { borderColor: colors.border }]}
        onPress={onAdd}
        activeOpacity={0.8}
        accessibilityRole="button"
      >
        <Plus size={15} color={colors.fg} strokeWidth={2.4} />
        <Text style={[styles.addText, { color: colors.fg }]}>Add item</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 20 },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6, minHeight: 26 },
  label: { fontSize: 13, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  hint:  { fontSize: 12.5, lineHeight: 18, marginBottom: 10 },
  saveOrder: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: COMMON_RADIUS,
  },
  saveOrderText: { fontSize: 12, fontWeight: '800' },

  rows: { borderRadius: COMMON_RADIUS, borderWidth: 1, overflow: 'hidden', marginBottom: 10 },
  row:  { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, paddingRight: 10 },
  arrows: { width: 40, alignItems: 'center' },
  rank:   { fontSize: 12, fontWeight: '800' },
  main:   { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 10 },
  photo:  { width: 46, height: 46, borderRadius: 8 },
  text:   { flex: 1, minWidth: 0, gap: 1 },
  title:  { fontSize: 14.5, fontWeight: '700' },
  desc:   { fontSize: 12.5 },
  linkLine: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  linkText: { fontSize: 11.5, fontWeight: '600', flexShrink: 1 },
  remove: { paddingLeft: 12, paddingVertical: 6 },

  add: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 12, borderRadius: COMMON_RADIUS, borderWidth: 1, borderStyle: 'dashed',
  },
  addText: { fontSize: 14, fontWeight: '700' },
});
