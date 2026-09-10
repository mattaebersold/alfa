import React, { useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Check, Lock } from 'lucide-react-native';
import ScreenHeading from '../../components/ui/ScreenHeading';
import Spinner from '../../components/ui/Spinner';
import {
  useGetNotificationTypesQuery,
  useUpdateNotificationSettingsMutation,
  useGetLoggedInUserQuery,
} from '../../api/apiService';
import { useColors } from '../../hooks/useColors';
import { useBrandColor } from '../../hooks/useBrandColor';
import { ss } from '../../styles/shared';
import type { NotificationSettings } from '../../types/api';

/**
 * What you get told about, and how.
 *
 * A table rather than a list of switches: the question a member has is "does
 * this reach my phone, or my inbox, or both", and a stacked list of
 * "Comments — push" / "Comments — email" makes them read the same word twice
 * to answer it. Side by side the row is the subject and the columns are the
 * channels, which is the shape of the actual decision.
 *
 * In-app isn't a column. A notification always lands in the bell, because that
 * list is also the record of what happened — switching it off would mean
 * events with nowhere to be seen.
 *
 * The rows come from the server (horacio's helpers/notificationPrefs), so a
 * new notification type shows up here without an app release.
 */

/** One checkbox. */
function Box({ on, locked, onPress, brand, colors }: {
  on: boolean;
  locked?: boolean;
  onPress: () => void;
  brand: string;
  colors: any;
}) {
  return (
    <TouchableOpacity
      style={[
        styles.box,
        on
          ? { backgroundColor: brand, borderColor: brand }
          : { borderColor: colors.borderDark },
        locked && styles.boxLocked,
      ]}
      onPress={locked ? undefined : onPress}
      disabled={locked}
      hitSlop={8}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: on, disabled: !!locked }}
    >
      {locked
        ? <Lock size={11} color={colors.grey} />
        : on
          ? <Check size={14} color="#000000" strokeWidth={3.5} />
          : null}
    </TouchableOpacity>
  );
}

export default function NotificationSettingsScreen() {
  const colors = useColors();
  const brand = useBrandColor();

  const { data: typesData, isLoading: loadingTypes, isError, refetch } = useGetNotificationTypesQuery();
  const { data: user } = useGetLoggedInUserQuery();
  const [save, { isLoading: saving }] = useUpdateNotificationSettingsMutation();

  const types = useMemo(() => typesData?.types ?? [], [typesData]);

  /**
   * The table, cut into sections.
   *
   * Grouping comes from the server rather than a copy of the list held here, so
   * this screen and the web dashboard section the rows the same way and a new
   * type lands in the right place without an app release. Order is the order
   * the server sent; a type with no `group` falls into a single leading
   * untitled section, which is how an older server still renders correctly.
   */
  const sections = useMemo(() => {
    const out: { title: string | null; rows: typeof types }[] = [];
    for (const t of types) {
      const title = t.group ?? null;
      let section = out.find((s) => s.title === title);
      if (!section) { section = { title, rows: [] }; out.push(section); }
      section.rows.push(t);
    }
    return out;
  }, [types]);
  const [settings, setSettings] = useState<NotificationSettings>({});
  const [dirty, setDirty] = useState(false);

  /**
   * Start from the type's default when nothing is saved for it.
   *
   * A member who has never opened this screen sees the boxes that describe
   * what they're actually receiving, rather than an empty table implying
   * they've turned everything off.
   */
  useEffect(() => {
    if (!types.length) return;
    const saved = user?.notificationSettings ?? {};
    const next: NotificationSettings = {};
    for (const t of types) {
      next[t.key] = {
        push: saved[t.key]?.push ?? t.push,
        email: saved[t.key]?.email ?? t.email,
      };
    }
    setSettings(next);
    setDirty(false);
  }, [types, user?.notificationSettings]);

  const toggle = (key: string, channel: 'push' | 'email') => {
    setSettings((prev) => ({
      ...prev,
      [key]: { ...prev[key], [channel]: !prev[key]?.[channel] },
    }));
    setDirty(true);
  };

  const onSave = async () => {
    try {
      await save(settings).unwrap();
      setDirty(false);
      Alert.alert('Saved', 'Your notification settings are updated.');
    } catch {
      Alert.alert('Error', "Couldn't save that. Please try again.");
    }
  };

  return (
    <SafeAreaView style={[ss.fill, { backgroundColor: colors.cream }]} edges={['top']}>
      {loadingTypes ? (
        <Spinner fullScreen />
      ) : (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <ScreenHeading title="Notifications" dense />
          <Text style={[styles.intro, { color: colors.grey }]}>
            Everything still appears in your notifications list. These control
            whether it also reaches your phone or your inbox.
          </Text>

          {/*
            An empty list is a failure, not a state worth rendering as one.
            The rows come from the server, so an unreachable or out-of-date API
            used to leave a column header over nothing at all — which reads as
            "you have no options" rather than "this didn't load".
          */}
          {!types.length ? (
            <View style={[styles.notice, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.noticeTitle, { color: colors.fg }]}>
                {isError ? "Couldn't load your settings" : 'No settings available'}
              </Text>
              <Text style={[styles.noticeBody, { color: colors.grey }]}>
                {isError
                  ? 'Check your connection and try again.'
                  : 'This app needs a newer version of the server to show these options.'}
              </Text>
              <TouchableOpacity
                style={[styles.retry, { borderColor: colors.borderDark }]}
                onPress={() => refetch()}
                activeOpacity={0.7}
              >
                <Text style={[styles.retryText, { color: colors.fg }]}>Try again</Text>
              </TouchableOpacity>
            </View>
          ) : (
          <View style={[styles.table, { backgroundColor: colors.card, borderColor: colors.border }]}>
            {/* The header row is what makes the two columns readable — without
                it they're a pair of unlabelled boxes. */}
            <View style={[styles.headRow, { borderBottomColor: colors.borderDark }]}>
              <View style={styles.labelCell} />
              <Text style={[styles.headText, { color: colors.grey }]}>Push</Text>
              <Text style={[styles.headText, { color: colors.grey }]}>Email</Text>
            </View>

            {sections.map((section, si) => (
              <View key={section.title ?? `_${si}`}>
                {section.title && (
                  <View
                    style={[
                      styles.groupRow,
                      { backgroundColor: colors.segment, borderColor: colors.border },
                      si > 0 && styles.groupRowTop,
                    ]}
                  >
                    <Text style={[styles.groupText, { color: colors.grey }]}>
                      {section.title}
                    </Text>
                  </View>
                )}

                {section.rows.map((t, i) => (
                  <View
                    key={t.key}
                    style={[
                      styles.row,
                      // Only between rows of a section — the group header
                      // already draws the line that opens one.
                      i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
                    ]}
                  >
                    <View style={styles.labelCell}>
                      <Text style={[styles.label, { color: colors.fg }]}>{t.label}</Text>
                    </View>
                    <View style={styles.cell}>
                      <Box
                        on={settings[t.key]?.push ?? t.push}
                        locked={t.locked}
                        onPress={() => toggle(t.key, 'push')}
                        brand={brand}
                        colors={colors}
                      />
                    </View>
                    <View style={styles.cell}>
                      <Box
                        on={settings[t.key]?.email ?? t.email}
                        locked={t.locked}
                        onPress={() => toggle(t.key, 'email')}
                        brand={brand}
                        colors={colors}
                      />
                    </View>
                  </View>
                ))}
              </View>
            ))}
          </View>
          )}

          {types.length > 0 && (
            <Text style={[styles.footnote, { color: colors.grey }]}>
              Account and safety notices always send — they're how we reach you
              about your own account.
            </Text>
          )}

          {/* Only once something has changed. A permanently-enabled Save on a
              screen of checkboxes reads as "you have unsaved work" forever. */}
          {dirty && (
            <TouchableOpacity
              style={[styles.save, { backgroundColor: brand }]}
              onPress={onSave}
              disabled={saving}
              activeOpacity={0.85}
            >
              {saving
                ? <ActivityIndicator size="small" color="#000000" />
                : <Text style={styles.saveText}>Save changes</Text>}
            </TouchableOpacity>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const CELL_W = 62;

const styles = StyleSheet.create({
  content: { padding: 12, paddingBottom: 40 },
  intro:   { fontSize: 13, lineHeight: 19, marginBottom: 14, paddingHorizontal: 2 },

  table:   { borderRadius: 12, borderWidth: 1, overflow: 'hidden' },
  headRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 9, paddingHorizontal: 12,
    borderBottomWidth: 1,
  },
  headText: {
    width: CELL_W, textAlign: 'center',
    fontSize: 11, fontWeight: '700',
  },

  groupRow: {
    paddingVertical: 7, paddingHorizontal: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  // Every section but the first closes the one above it as well as opening its
  // own, so the two never sit against each other unseparated.
  groupRowTop: { borderTopWidth: StyleSheet.hairlineWidth },
  groupText: {
    fontSize: 11, fontWeight: '700',
    textTransform: 'uppercase', letterSpacing: 0.6,
  },

  row: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 12, paddingHorizontal: 12,
  },
  // Takes the row so the two checkbox columns stay a fixed width and line up
  // down the table however long a label runs.
  labelCell: { flex: 1, minWidth: 0, paddingRight: 8 },
  label:     { fontSize: 14, fontWeight: '500' },
  cell:      { width: CELL_W, alignItems: 'center' },

  box: {
    width: 24, height: 24, borderRadius: 6, borderWidth: 1.5,
    alignItems: 'center', justifyContent: 'center',
  },
  boxLocked: { opacity: 0.45 },

  notice: {
    borderRadius: 12, borderWidth: 1,
    paddingVertical: 20, paddingHorizontal: 16,
    alignItems: 'center',
  },
  noticeTitle: { fontSize: 15, fontWeight: '700', marginBottom: 6, textAlign: 'center' },
  noticeBody:  { fontSize: 13, lineHeight: 19, textAlign: 'center', marginBottom: 14 },
  retry: {
    borderWidth: 1, borderRadius: 8,
    paddingVertical: 9, paddingHorizontal: 18,
  },
  retryText: { fontSize: 13, fontWeight: '700' },

  footnote: { fontSize: 12, lineHeight: 17, marginTop: 12, paddingHorizontal: 2 },

  save: {
    marginTop: 20, paddingVertical: 14, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
  },
  saveText: { fontSize: 15, fontWeight: '800', color: '#000000' },
});
