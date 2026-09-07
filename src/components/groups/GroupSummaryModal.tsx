import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { useNavigation } from '@react-navigation/native';
import { Users, Lock, MapPin } from 'lucide-react-native';
import SummaryModal, { type SummaryOrigin } from '../ui/SummaryModal';
import Spinner from '../ui/Spinner';
import { useGetGroupQuery, useGetGroupMembersQuery } from '../../api/apiService';
import { useColors } from '../../hooks/useColors';
import { firstGalleryUrl } from '../../utils/image';
import { stripHtml } from '../../utils/text';
import { regionLabel } from '../../constants/regions';

/**
 * A group, answered in place.
 *
 * The questions a group's name raises from somewhere else in the app — what is
 * this, how many people are in it, is it the kind of thing I'd join — all used
 * to cost a screen push and a scroll back. This answers them over whatever you
 * were reading, and the button at the bottom is there for when the answer is
 * "yes, show me".
 *
 * The panel, its animation and that button are SummaryModal's; this only
 * supplies what a group's summary is.
 */
export default function GroupSummaryModal({
  groupId,
  origin,
  onClose,
}: {
  /** The group to summarise. `null` closes the panel. */
  groupId: string | null;
  /** The tile that was tapped — the panel grows out of it. */
  origin?: SummaryOrigin | null;
  onClose: () => void;
}) {
  const colors = useColors();
  const nav = useNavigation<any>();

  const { data: group, isLoading } = useGetGroupQuery(groupId ?? '', { skip: !groupId });
  const { data: members } = useGetGroupMembersQuery(groupId ?? '', { skip: !groupId });

  const memberCount = members?.filter((m) => m.status === 'active').length ?? 0;
  const banner = firstGalleryUrl(group?.banners) ?? firstGalleryUrl(group?.gallery);
  const body = group?.body ? stripHtml(group.body) : '';
  const region = regionLabel(group?.region);

  return (
    <SummaryModal
      visible={!!groupId}
      onClose={onClose}
      origin={origin}
      actionLabel="View Group"
      onAction={groupId ? () => nav.navigate('GroupDetail', { groupId }) : undefined}
    >
      {isLoading || !group ? (
        // Reserved height rather than a bare spinner: the panel takes its size
        // from its content, so an unsized loading state opens as a sliver.
        <View style={styles.loading}><Spinner /></View>
      ) : (
        <View>
          {/* The banner leads, because a group's picture is most of what tells
              you what kind of group it is. */}
          {banner ? (
            <Image source={{ uri: banner }} style={styles.banner} contentFit="cover" />
          ) : (
            <View style={[styles.banner, styles.blank, { backgroundColor: colors.segment }]}>
              <Users size={26} color={colors.grey} />
            </View>
          )}

          <View style={styles.body}>
            <Text style={[styles.title, { color: colors.fg }]} numberOfLines={2}>{group.title}</Text>
            {group.subtitle ? (
              <Text style={[styles.subtitle, { color: colors.muted }]} numberOfLines={2}>
                {group.subtitle}
              </Text>
            ) : null}

            {/* Counts and qualifiers, not sentences — the icons say what each
                one is. */}
            <View style={styles.badges}>
              <View style={[styles.badge, { backgroundColor: colors.segment }]}>
                <Users size={10} color={colors.grey} />
                <Text style={[styles.badgeText, { color: colors.grey }]}>{memberCount}</Text>
              </View>
              {region ? (
                <View style={[styles.badge, { backgroundColor: colors.segment }]}>
                  <MapPin size={10} color={colors.grey} />
                  <Text style={[styles.badgeText, { color: colors.grey }]}>{region}</Text>
                </View>
              ) : null}
              {group.private ? (
                <View style={[styles.badge, { backgroundColor: colors.segment }]}>
                  <Lock size={10} color={colors.grey} />
                  <Text style={[styles.badgeText, { color: colors.grey }]}>Private</Text>
                </View>
              ) : null}
            </View>

            {body ? (
              <Text style={[styles.about, { color: colors.muted }]} numberOfLines={6}>{body}</Text>
            ) : null}
          </View>
        </View>
      )}
    </SummaryModal>
  );
}

const styles = StyleSheet.create({
  loading: { height: 200, alignItems: 'center', justifyContent: 'center' },
  banner:  { width: '100%', height: 130 },
  blank:   { alignItems: 'center', justifyContent: 'center' },
  body:    { padding: 18, paddingBottom: 22, gap: 8 },
  title:    { fontSize: 20, fontWeight: '800', letterSpacing: -0.3 },
  subtitle: { fontSize: 14, lineHeight: 19, marginTop: -2 },
  badges:   { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 2 },
  badge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999,
  },
  badgeText: { fontSize: 11, fontWeight: '700' },
  about:     { fontSize: 13.5, lineHeight: 19, marginTop: 4 },
});
