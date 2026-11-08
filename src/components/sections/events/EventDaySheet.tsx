import React, { useMemo, useState } from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import { Text } from '@ors/kit';
import { LinearGradient } from 'expo-linear-gradient';
import SharedModal, { PANE_GRABBER_H, PANE_GUTTER } from '../../ui/SharedModal';
import SubTabs from '../../ui/SubTabs';
import ExpandableEventCard from '../../society/ExpandableEventCard';
import { categoryFor } from '../../../constants/eventTypes';
import { COLOR_WHITE, PANE_BG } from '../../../constants/config';
import { FONT_INTER } from '../../../constants/fonts';
import { ss } from '../../../styles/shared';
import type { SocietyEvent } from '../../../types/api';

/** How far the pane's head fades out below it. */
const DAY_HEAD_FADE = 20;

/**
 * A calendar day's events in a pane — EventsView's day sheet, as a component
 * of its own. Tapping through to an event closes the pane first and hands the
 * event to `onOpenEvent` once it's gone: iOS won't present a screen over a
 * modal that's still dismissing.
 */
export default function EventDaySheet({ day, onClose, onOpenEvent }: {
  day: { date: Date; events: SocietyEvent[] } | null;
  onClose: () => void;
  onOpenEvent: (event: SocietyEvent) => void;
}) {
  const [pendingEvent, setPendingEvent] = useState<SocietyEvent | null>(null);
  /** The category tab; null is All. */
  const [category, setCategory] = useState<string | null>(null);
  /** The open card — one at a time. */
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [headH, setHeadH] = useState(0);

  // The last day opened, kept through the close so the pane doesn't empty
  // as it slides away. A new day starts on All, nothing open.
  const [shownDay, setShownDay] = useState(day);
  if (day && day !== shownDay) {
    setShownDay(day);
    setCategory(null);
    setOpenKey(null);
  }

  const events = shownDay?.events ?? [];
  // All, then each category the day has — only when there's a choice.
  const categories = useMemo(() => {
    const seen = new Map<string, string>();
    for (const e of events) {
      const c = categoryFor(e.category);
      if (!seen.has(c.key)) seen.set(c.key, c.label);
    }
    return [...seen.entries()].map(([key, label]) => ({ key, label }));
  }, [events]);
  const shown = category ? events.filter((e) => categoryFor(e.category).key === category) : events;

  return (
    <SharedModal
      visible={!!day}
      onClose={onClose}
      onDismissed={() => {
        if (pendingEvent) {
          const event = pendingEvent;
          setPendingEvent(null);
          onOpenEvent(event);
        }
      }}
      hideHeader
      // Always full height: filtering by category shouldn't make the pane jump.
      heightRatio={0.9}
    >
      <View style={ss.fill}>
        <ScrollView
          contentContainerStyle={[styles.body, { paddingTop: headH + 4 }]}
          showsVerticalScrollIndicator={false}
        >
          {shown.map((event, i) => {
            const key = `${event.internal_id}-${i}`;
            return (
              <ExpandableEventCard
                key={key}
                event={event}
                expanded={openKey === key}
                onToggleExpanded={() => setOpenKey(openKey === key ? null : key)}
                onOpenFull={(e) => { setPendingEvent(e); onClose(); }}
              />
            );
          })}
        </ScrollView>
        {/* The day and its tabs float over the list, fading to clear below. */}
        <View style={styles.head} onLayout={(e) => setHeadH(e.nativeEvent.layout.height)}>
          <LinearGradient
            colors={[PANE_BG, PANE_BG, `${PANE_BG}00`]}
            locations={[0, 0.6, 1]}
            style={styles.headFade}
            pointerEvents="none"
          />
          <Text style={styles.title} numberOfLines={1}>
            {shownDay ? shownDay.date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }) : ''}
          </Text>
          {categories.length > 1 && (
            <SubTabs
              options={[{ key: 'all', label: 'All' }, ...categories]}
              value={category ?? 'all'}
              onChange={(k) => setCategory(k === 'all' ? null : k)}
            />
          )}
        </View>
      </View>
    </SharedModal>
  );
}

const styles = StyleSheet.create({
  body: { padding: 12, gap: 12, paddingBottom: 32 },
  head: { position: 'absolute', top: 0, left: 0, right: 0, paddingTop: PANE_GRABBER_H, gap: 10 },
  headFade: { position: 'absolute', top: 0, left: 0, right: 0, bottom: -DAY_HEAD_FADE },
  // The pane title's look (SharedModal's).
  title: { fontSize: 17, fontFamily: FONT_INTER.bold, color: COLOR_WHITE, paddingHorizontal: PANE_GUTTER },
});
