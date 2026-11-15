import React, { useEffect, useState } from 'react';
import {
  View, TouchableOpacity, StyleSheet, Linking, LayoutAnimation,
} from 'react-native';
import { Text } from '../../theme/Text';
import { UserPlus, UserCheck, CalendarPlus, Repeat, ChevronRight, MapPin } from 'lucide-react-native';
import EventCard from '../cards/EventCard';
import {
  useGetMyEventsQuery,
  useGetSocietyEventQuery,
  useGetUserGarageQuery,
  useSetEventAttendingCarMutation,
  useToggleEventInterestMutation,
} from '../../api/apiService';
import AttendCarSheet, { carName } from './AttendCarSheet';
import { Image } from '../ui/AppImage';
import { carHeroUrl } from '../../utils/image';
import { useAppSelector } from '../../store/store';
import { useColors } from '../../hooks/useColors';
import { useBrandColor } from '../../hooks/useBrandColor';
import { stripHtml } from '../../utils/text';
import { googleCalendarUrl } from '../../utils/calendarLinks';
import { openInMaps } from '../../utils/openInMaps';
import { occurrenceDate, eventDayKey } from '../../constants/eventTypes';
import { COMMON_RADIUS, COLOR_BLACK, PILL_RADIUS } from '../../constants/config';
import { FONT_INTER } from '../../constants/fonts';
import type { SocietyEvent } from '../../types/api';

/**
 * Whether you're attending one date of an event, and the toggle. Attending is
 * per occurrence — `openedOn` names it where the entry itself doesn't (the
 * detail pane, opened from a day).
 *
 * Read off My Events rather than the event row a list was handed: the day
 * pane holds the day's events as they were when it opened, so their own
 * `is_interested` goes stale the moment you tap. My Events refetches on
 * every toggle, so every card on the date agrees. The tap shows at once and
 * holds until the refetch catches up.
 */
export function useEventInterest(event: SocietyEvent, openedOn?: string | null) {
  const loggedIn = !!useAppSelector((s) => s.auth.userInfo);
  const { data } = useGetMyEventsQuery(undefined, { skip: !loggedIn });
  const { data: garage } = useGetUserGarageQuery(undefined, { skip: !loggedIn });
  const [toggle, { isLoading }] = useToggleEventInterestMutation();
  const [setCar, { isLoading: savingCar }] = useSetEventAttendingCarMutation();
  const day = eventDayKey(event, openedOn);
  const mine = data?.entries.find((e) => e.internal_id === event.internal_id && (!day || e.day === day));
  const server = data ? !!mine : !!event.is_interested;
  const [optimistic, setOptimistic] = useState<boolean | null>(null);
  useEffect(() => { setOptimistic(null); }, [server]);
  const interested = optimistic ?? server;

  const cars = garage?.entries ?? [];
  const myCarId = (mine ? mine.my_car_id : event.my_car_id) ?? null;
  const myCar = myCarId ? cars.find((c) => c.internal_id === myCarId) ?? null : null;
  /** 'attend' — choosing for a new RSVP; 'change' — swapping the car on one. */
  const [picking, setPicking] = useState<null | 'attend' | 'change'>(null);

  const attend = async (carId?: string | null) => {
    setOptimistic(!interested);
    try {
      const res = await toggle({
        event_id: event.internal_id,
        ...(day ? { day } : {}),
        ...(carId !== undefined ? { car_id: carId } : {}),
      }).unwrap();
      setOptimistic(res.is_interested);
    } catch {
      setOptimistic(null);
    }
  };

  // Going, with cars in the garage: ask which first. Nothing to choose from,
  // or un-attending: straight through.
  const onToggle = () => {
    if (!interested && cars.length > 0) setPicking('attend');
    else attend();
  };
  const changeCar = () => setPicking('change');

  const sheet = (
    <AttendCarSheet
      visible={picking !== null}
      cars={cars}
      selectedId={picking === 'change' ? myCarId : undefined}
      title={picking === 'change' ? 'Change your car' : undefined}
      onClose={() => setPicking(null)}
      onChoose={(carId) => {
        if (picking === 'change') {
          const target = day ?? mine?.day ?? event.interest_day;
          if (target) setCar({ event_id: event.internal_id, day: target, car_id: carId }).catch(() => {});
        } else {
          attend(carId);
        }
      }}
    />
  );

  return {
    interested, onToggle, busy: isLoading || savingCar,
    /** The car you said you're bringing, if it's still in your garage. */
    myCar,
    /** Can a car be picked at all — anything in the garage. */
    canChooseCar: cars.length > 0,
    changeCar,
    /** Render this alongside the Attend button — it's the car picker. */
    sheet,
  };
}

/**
 * "Bringing your 1973 911 · Change" — under a date you're attending. Offers
 * a car when you said none; nothing at all when your garage is empty.
 */
export function BringingRow({ myCar, canChooseCar, onChange }: {
  myCar: { title?: string; year?: string; make?: string; model?: string; profile_image?: string | null; gallery?: any[] } | null;
  canChooseCar: boolean;
  onChange: () => void;
}) {
  const colors = useColors();
  if (!myCar && !canChooseCar) return null;
  const uri = myCar ? carHeroUrl(myCar, 'thumb') : null;
  return (
    <TouchableOpacity
      style={[styles.bringing, { backgroundColor: colors.secondary }]}
      onPress={onChange}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel={myCar ? `Bringing ${carName(myCar)}. Change car` : 'Add the car you are bringing'}
    >
      {uri ? <Image source={{ uri }} style={styles.bringingThumb} contentFit="cover" /> : null}
      <Text style={[styles.bringingText, { color: colors.fg }]} numberOfLines={1}>
        {myCar ? `Bringing ${carName(myCar)}` : 'Bringing a car?'}
      </Text>
      <Text style={[styles.bringingAction, { color: colors.grey }]}>{myCar ? 'Change' : 'Add'}</Text>
    </TouchableOpacity>
  );
}

/**
 * An event card that opens in place: tap it and the details run on under the
 * card — the description, the map, Add to Calendar — rather than a detail
 * pane over the list. The small Attend pill on the card works open or shut.
 *
 * `onOpenFull` is the way on to the whole event (comments, tagged posts, the
 * owner's options), for a host that has somewhere to show it.
 */
export default function ExpandableEventCard({ event, expanded, onToggleExpanded, onOpenFull }: {
  event: SocietyEvent;
  expanded: boolean;
  onToggleExpanded: () => void;
  onOpenFull?: (event: SocietyEvent) => void;
}) {
  const colors = useColors();
  const brand = useBrandColor();
  const { interested, onToggle, busy, myCar, canChooseCar, changeCar, sheet } = useEventInterest(event);
  // The full record once it's open — a list row can be an expanded occurrence
  // with less on it than the event itself.
  const { data: full } = useGetSocietyEventQuery(event.internal_id, { skip: !expanded });
  const ev = { ...event, ...(full ?? {}), occurrence_date: event.occurrence_date };
  const shownDate = event.occurrence_date || occurrenceDate(ev);
  // The list row or the full record, whichever has it — and kept to its
  // paragraphs rather than run together.
  const body = stripHtml(full?.body || event.body || '').replace(/\n{3,}/g, '\n\n').trim();

  const openMap = () => openInMaps(ev);
  const repeats = !!(ev.frequency && ev.frequency !== 'single' && ev.schedule_label);
  // The place's own name — the address's first part ("Joe's Garage, 1 Main St…").
  const placeName = ev.location?.split(',')[0]?.trim() || null;

  const toggleOpen = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    onToggleExpanded();
  };

  /** The small Attend pill on the collapsed card, beside who's going. */
  const attendPill = (
    <TouchableOpacity
      onPress={onToggle}
      disabled={busy}
      hitSlop={8}
      style={[
        styles.attendPill,
        interested ? { backgroundColor: brand } : { backgroundColor: colors.secondary },
      ]}
      accessibilityRole="button"
      accessibilityState={{ selected: interested }}
      accessibilityLabel={interested ? 'Attending — tap to remove' : 'Attend'}
    >
      {interested
        ? <UserCheck size={13} color={COLOR_BLACK} strokeWidth={2.6} />
        : <UserPlus size={13} color={colors.fg} strokeWidth={2.6} />}
      <Text style={[styles.attendPillText, { color: interested ? COLOR_BLACK : colors.fg }]}>
        {interested ? 'Attending' : 'Attend'}
      </Text>
    </TouchableOpacity>
  );

  return (
    <View style={[styles.wrap, { backgroundColor: colors.card }]}>
      <EventCard event={event} side typePill={false} onPress={toggleOpen} accessory={attendPill} />
      {sheet}

      {expanded && (
        <View style={styles.details}>
          {/* How often, and what it is — set off from the card above. */}
          {(repeats || body) ? (
            <View style={styles.info}>
              {repeats ? (
                <View style={styles.line}>
                  <View style={[styles.repeatDot, { backgroundColor: colors.bg }]}>
                    <Repeat size={13} color={colors.fg} strokeWidth={2.4} />
                  </View>
                  <Text style={[styles.lineText, styles.repeatText, { color: colors.fg }]}>{ev.schedule_label}</Text>
                </View>
              ) : null}
              {body ? <Text style={[styles.body, { color: colors.muted }]}>{body}</Text> : null}
            </View>
          ) : null}


          {/* Attend again beside the calendar — the small pill on the card stays
              too, open or shut. */}
          <View style={styles.actions}>
            <TouchableOpacity
              style={[
                styles.interestBtn,
                { backgroundColor: interested ? brand : colors.secondary },
                busy && { opacity: 0.6 },
              ]}
              onPress={onToggle}
              disabled={busy}
              activeOpacity={0.85}
              accessibilityState={{ selected: interested }}
            >
              {interested
                ? <UserCheck size={16} color={COLOR_BLACK} strokeWidth={2.6} />
                : <UserPlus size={16} color={colors.fg} strokeWidth={2.6} />}
              <Text style={[styles.interestText, { color: interested ? COLOR_BLACK : colors.fg }]}>
                {interested ? 'Attending' : 'Attend'}
              </Text>
            </TouchableOpacity>
            {shownDate ? (
              <TouchableOpacity
                style={[styles.interestBtn, { backgroundColor: colors.secondary }]}
                onPress={() => {
                  const url = googleCalendarUrl(ev, shownDate);
                  if (url) Linking.openURL(url);
                }}
                activeOpacity={0.85}
              >
                <CalendarPlus size={16} color={colors.fg} />
                <Text style={[styles.interestText, { color: colors.fg }]}>Add to Calendar</Text>
              </TouchableOpacity>
            ) : null}
          </View>

          {interested ? <BringingRow myCar={myCar} canChooseCar={canChooseCar} onChange={changeCar} /> : null}

          {/* Where — the place's name, to the phone's maps app. */}
          {placeName ? (
            <TouchableOpacity
              style={[styles.more, { backgroundColor: colors.secondary }]}
              onPress={openMap}
              activeOpacity={0.85}
              accessibilityRole="link"
              accessibilityLabel={`Open ${placeName} in maps`}
            >
              <MapPin size={15} color={colors.fg} />
              <Text style={[styles.moreText, styles.placeText, { color: colors.fg }]} numberOfLines={1}>{placeName}</Text>
            </TouchableOpacity>
          ) : null}

          {onOpenFull ? (
            <TouchableOpacity
              style={[styles.more, { backgroundColor: colors.secondary }]}
              onPress={() => onOpenFull(event)}
              activeOpacity={0.85}
            >
              <Text style={[styles.moreText, { color: colors.fg }]}>Comments, posts and more</Text>
              <ChevronRight size={15} color={colors.fg} />
            </TouchableOpacity>
          ) : null}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { borderRadius: COMMON_RADIUS, overflow: 'hidden' },
  attendPill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    height: 28, paddingHorizontal: 11, borderRadius: PILL_RADIUS,
  },
  attendPillText: { fontSize: 12, fontFamily: FONT_INTER.extrabold },
  details: { paddingHorizontal: 12, paddingTop: 0, paddingBottom: 10, gap: 8 },
  info: { gap: 8, paddingTop: 10, paddingBottom: 6 },
  repeatText: { fontFamily: FONT_INTER.bold },
  repeatDot: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  line: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  lineText: { flex: 1, fontSize: 13.5, fontFamily: FONT_INTER.medium },
  body: { fontSize: 14, lineHeight: 20 },
  // Straight under the card's copy — the details' gap was a band of nothing.
  actions: { flexDirection: 'row', gap: 8, marginTop: -4 },
  interestBtn: {
    flex: 1, height: 42, borderRadius: PILL_RADIUS,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  interestText: { fontSize: 14, fontFamily: FONT_INTER.extrabold },
  more: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4,
    height: 42, borderRadius: PILL_RADIUS, paddingHorizontal: 16,
  },
  moreText: { fontSize: 14, fontFamily: FONT_INTER.extrabold },
  placeText: { flexShrink: 1 },
  bringing: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    height: 42, borderRadius: PILL_RADIUS, paddingLeft: 6, paddingRight: 16,
  },
  bringingThumb: { width: 44, height: 30, borderRadius: 15 },
  bringingText: { flex: 1, fontSize: 14, fontFamily: FONT_INTER.bold, marginLeft: 6 },
  bringingAction: { fontSize: 13, fontFamily: FONT_INTER.bold },
});
