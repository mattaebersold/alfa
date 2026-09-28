import React, { useState } from 'react';
import { View, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { Text } from '@ors/kit';
import { formatDistanceToNow } from 'date-fns';
import { Plus, ArrowUp, Link2 } from 'lucide-react-native';
import Avatar from '../ui/Avatar';
import EmptyState from '../ui/EmptyState';
import GroupItemDetailModal from '../groups/GroupItemDetailModal';
import GroupCreateSheet from '../groups/GroupCreateSheet';
import { useGetModelDiscussionQuery, useGetModelResourcesQuery } from '../../api/apiService';
import { useAppSelector } from '../../store/store';
import { useColors } from '../../hooks/useColors';
import { useBrandColor, useBrandTextColor } from '../../hooks/useBrandColor';
import { DISCUSSION_CATEGORIES, RESOURCE_CATEGORIES } from '../../constants/groupCategories';
import { carScopeKey } from '../../utils/carScope';
import { stripHtml } from '../../utils/text';
import { COMMON_RADIUS, COLOR_GRAY_17 } from '../../constants/config';
import { FONT_INTER } from '../../constants/fonts'

type Kind = 'discussion' | 'resource';

/**
 * A car model's discussion or resources — a group's sections, on the model's
 * page, and open to anyone: no membership to start a thread or share a link.
 *
 * The rows open the same detail a group item does (votes, comments, the
 * author's edit and delete), and "New" opens the same form, pointed at the
 * model instead of a group.
 */
export default function ModelPostsSection({ kind, make, model }: {
  kind: Kind;
  make: string;
  model: string;
}) {
  const colors = useColors();
  const brand = useBrandColor();
  const brandText = useBrandTextColor();
  const signedIn = !!useAppSelector((s) => s.auth.userInfo);
  const [open, setOpen] = useState<any | null>(null);
  const [creating, setCreating] = useState(false);

  const discussion = useGetModelDiscussionQuery({ make, model }, { skip: kind !== 'discussion' });
  const resources = useGetModelResourcesQuery({ make, model }, { skip: kind !== 'resource' });
  const { data, isLoading } = kind === 'discussion' ? discussion : resources;
  const items = data?.entries ?? [];

  const categories = kind === 'discussion' ? DISCUSSION_CATEGORIES : RESOURCE_CATEGORIES;
  const labelFor = (key?: string) => categories.find((c) => c.key === key)?.label ?? 'General';
  const noun = kind === 'discussion' ? 'discussion' : 'resource';

  return (
    <View style={styles.wrap}>
      {signedIn && (
        <TouchableOpacity
          style={[styles.newBtn, { backgroundColor: brand }]}
          onPress={() => setCreating(true)}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel={kind === 'discussion' ? 'Start a discussion' : 'Share a resource'}
        >
          <Plus size={16} color={brandText} strokeWidth={2.6} />
          <Text style={[styles.newText, { color: brandText }]}>
            {kind === 'discussion' ? 'Start a discussion' : 'Share a resource'}
          </Text>
        </TouchableOpacity>
      )}

      {isLoading ? (
        <ActivityIndicator color={colors.primaryAlt} style={{ marginTop: 24 }} />
      ) : items.length === 0 ? (
        <EmptyState
          title={`No ${noun}s yet`}
          message={kind === 'discussion'
            ? `Ask a question or start a thread about the ${make} ${model}.`
            : `Share a guide, a part source or a shop for the ${make} ${model}.`}
        />
      ) : (
        items.map((item: any) => {
          const preview = item.body ? stripHtml(item.body).trim() : '';
          const score = (item.upvotes ?? 0) - (item.downvotes ?? 0);
          return (
            <TouchableOpacity
              key={item.internal_id}
              style={[styles.row, { borderColor: colors.border }]}
              onPress={() => setOpen(item)}
              activeOpacity={0.8}
            >
              <View style={styles.rowHead}>
                <View style={[styles.catPill, { backgroundColor: colors.segment }]}>
                  <Text style={[styles.catText, { color: colors.fg }]}>{labelFor(item.category)}</Text>
                </View>
                {kind === 'resource' && item.url ? <Link2 size={14} color={colors.grey} /> : null}
                <View style={styles.score}>
                  <ArrowUp size={13} color={colors.grey} strokeWidth={2.6} />
                  <Text style={[styles.scoreText, { color: colors.grey }]}>{score}</Text>
                </View>
              </View>
              <Text style={[styles.title, { color: colors.fg }]} numberOfLines={2}>{item.title}</Text>
              {preview ? <Text style={[styles.preview, { color: colors.muted }]} numberOfLines={2}>{preview}</Text> : null}
              <View style={styles.meta}>
                <Avatar user={item.user} size={18} />
                <Text style={[styles.metaText, { color: colors.grey }]} numberOfLines={1}>
                  @{item.user?.username ?? 'member'}
                  {item.created_at ? ` · ${formatDistanceToNow(new Date(item.created_at), { addSuffix: true })}` : ''}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })
      )}

      <GroupItemDetailModal
        item={open}
        kind={open ? kind : null}
        categoryLabel={open ? labelFor(open.category) : null}
        categories={categories}
        groupTitle={`${make} ${model}`}
        visible={!!open}
        onClose={() => setOpen(null)}
      />
      <GroupCreateSheet
        kind={kind === 'discussion' ? 'discussion' : 'resources'}
        groupId={carScopeKey(make, model)}
        scope={{ make, model }}
        groupTitle={`${make} ${model}`}
        categories={categories}
        visible={creating}
        onClose={() => setCreating(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: 12, paddingTop: 4, gap: 10 },
  newBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7,
    paddingVertical: 12, borderRadius: COMMON_RADIUS,
  },
  newText: { fontSize: 14, fontFamily: FONT_INTER.extrabold },
  row: {
    padding: 12, gap: 6,
    borderRadius: COMMON_RADIUS, borderWidth: StyleSheet.hairlineWidth,
    backgroundColor: COLOR_GRAY_17,
  },
  rowHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  catPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  catText: { fontSize: 11, fontFamily: FONT_INTER.bold },
  score: { flexDirection: 'row', alignItems: 'center', gap: 2, marginLeft: 'auto' },
  scoreText: { fontSize: 12, fontFamily: FONT_INTER.bold },
  title: { fontSize: 15, fontFamily: FONT_INTER.bold },
  preview: { fontSize: 13, lineHeight: 18 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  metaText: { fontSize: 12, flexShrink: 1 },
});
