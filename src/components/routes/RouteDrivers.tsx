import React, { useState } from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { Text } from '@ors/kit';
import { format } from 'date-fns';
import { Timer, Trophy, CarFront } from 'lucide-react-native';
import Avatar from '../ui/Avatar';
import DriveLogSheet from './DriveLogSheet';
import { ConditionTags } from './ConditionChips';
import { useColors } from '../../hooks/useColors';
import { useBrandColor, contrastText } from '../../hooks/useBrandColor';
import { formatDuration } from '../../utils/routeGeometry';
import type { RouteDriver } from '../../types/api';
import { COMMON_RADIUS } from '../../constants/config';
import { FONT_INTER } from '../../constants/fonts';

/**
 * Who has driven this route — the creator first, then everyone who's said "I
 * drove this" — each with their time, day and conditions, and a trophy on the
 * quickest time when there's more than one to compare. Under it, your way in:
 * "I drove this", or "Edit my drive" once you have.
 */
export default function RouteDrivers({ routeId, drivers, myId, canJoin }: {
  routeId: string;
  drivers: RouteDriver[];
  myId?: string | null;
  /** Signed in, and the route is one you can add to. */
  canJoin: boolean;
}) {
  const colors = useColors();
  const brand = useBrandColor();
  const onBrand = contrastText(brand);
  const [logOpen, setLogOpen] = useState(false);

  const mine = myId ? drivers.find((d) => d.user_id === myId) ?? null : null;

  return (
    <View style={styles.wrap}>
      <Text style={[styles.sectionTitle, { color: colors.fg }]}>
        Drivers{drivers.length > 1 ? ` · ${drivers.length}` : ''}
      </Text>

      <View style={[styles.list, { borderColor: colors.border }]}>
        {drivers.map((d, i) => (
          <View
            key={d.user_id}
            style={[styles.row, i > 0 && { borderTopColor: colors.border, borderTopWidth: StyleSheet.hairlineWidth }]}
          >
            <Avatar user={d.user as any} size={34} />
            <View style={styles.who}>
              <Text style={[styles.name, { color: colors.fg }]} numberOfLines={1}>
                {d.user?.username ? `@${d.user.username}` : 'A member'}
                {d.user_id === myId ? <Text style={{ color: colors.grey }}> (you)</Text> : null}
              </Text>
              <Text style={[styles.meta, { color: colors.grey }]} numberOfLines={1}>
                {[
                  d.is_creator ? 'Created it' : null,
                  d.driven_on ? format(new Date(d.driven_on), 'MMM d, yyyy') : null,
                ].filter(Boolean).join(' · ') || 'Drove it'}
              </Text>
              <ConditionTags conditions={d.conditions} style={styles.tags} />
            </View>
            {d.duration_ms ? (
              <View style={styles.time}>
                {d.is_fastest
                  ? <Trophy size={14} color={brand} />
                  : <Timer size={14} color={colors.grey} />}
                <Text style={[styles.timeText, { color: d.is_fastest ? brand : colors.fg }]}>
                  {formatDuration(d.duration_ms)}
                </Text>
              </View>
            ) : null}
          </View>
        ))}
      </View>

      {canJoin && (
        <TouchableOpacity
          style={[
            styles.join,
            mine ? { borderColor: colors.border, borderWidth: 1.5 } : { backgroundColor: brand },
          ]}
          onPress={() => setLogOpen(true)}
          activeOpacity={0.85}
          accessibilityRole="button"
        >
          <CarFront size={16} color={mine ? colors.fg : onBrand} />
          <Text style={[styles.joinText, { color: mine ? colors.fg : onBrand }]}>
            {mine ? 'Edit my drive' : 'I drove this'}
          </Text>
        </TouchableOpacity>
      )}

      <DriveLogSheet
        visible={logOpen}
        onClose={() => setLogOpen(false)}
        routeId={routeId}
        mine={mine}
        isCreator={!!mine?.is_creator}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap:         { marginTop: 8, gap: 8 },
  sectionTitle: { fontSize: 16, fontFamily: FONT_INTER.bold },
  list:  { borderWidth: 1, borderRadius: 12, paddingHorizontal: 12 },
  row:   { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10 },
  who:   { flex: 1, gap: 2 },
  name:  { fontSize: 14, fontFamily: FONT_INTER.bold },
  meta:  { fontSize: 12 },
  tags:  { marginTop: 4 },
  time:  { flexDirection: 'row', alignItems: 'center', gap: 4 },
  timeText: { fontSize: 14, fontFamily: FONT_INTER.bold, fontVariant: ['tabular-nums'] },
  join: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    height: 44, borderRadius: COMMON_RADIUS,
  },
  joinText: { fontSize: 15, fontFamily: FONT_INTER.bold },
});
