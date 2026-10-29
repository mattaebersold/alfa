import React, { useEffect, useState } from 'react';
import { View, ScrollView, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import Reanimated, {
  LinearTransition, Easing, interpolate, useAnimatedStyle, useSharedValue, withDelay, withTiming,
} from 'react-native-reanimated';
import { X } from 'lucide-react-native';
import { Text } from '@ors/kit';
import { Image } from '../ui/AppImage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import SharedModal, { PANE_GRABBER_H } from '../ui/SharedModal';
import EmptyState from '../ui/EmptyState';
import Spinner from '../ui/Spinner';
import TaskProgressPie from './TaskProgressPie';
import CarTaskList, { taskTally } from './CarTaskList';
import { apiService, useGetUserGarageQuery, useGetCarTasksQuery } from '../../api/apiService';
import { useAppDispatch, useAppSelector } from '../../store/store';
import { useColors } from '../../hooks/useColors';
import { carHeroUrl } from '../../utils/image';
import type { GarageCar } from '../../types/api';
import { COLOR_BLACK } from '../../constants/config';
import { FONT_INTER } from '../../constants/fonts';

/** A car's row — black, well under the pane, so the sections' cards inside it stand out (CarTaskList). */
const ROW_BG = COLOR_BLACK;
/** How an opened car's list grows in, and the rows below it move down. */
const OPEN_MS = 240;
/** CSS's ease-out, for the row's height and the header moving with it. */
const OPEN_EASE = Easing.bezier(0, 0, 0.58, 1);
const ROW_LAYOUT = LinearTransition.duration(OPEN_MS).easing(OPEN_EASE);

/**
 * An opened car's list doesn't fade: it's there at full strength from the
 * start, and the row growing round it (ROW_LAYOUT, clipped) wipes it into
 * view. Closing, it stays drawn while the row shrinks over it, and only goes
 * once the row has.
 */
const HOLD_UNTIL_CLOSED = () => {
  'worklet';
  return {
    initialValues: { opacity: 1 },
    animations: { opacity: withDelay(OPEN_MS, withTiming(0, { duration: 0 })) },
  };
};

/** The header's photo: a square flush to the row closed, a circle set in from its corner open. */
const PHOTO = 76;
const PHOTO_OPEN = 40;
const PHOTO_INSET = 12;
/** The close button the count and pie step aside for, and the room they leave it. */
const CLOSE = 30;
const CLOSE_ROOM = CLOSE + 10;
/** The header's moves run with the row opening — the same clock and curve, so the two read as one. */
const STEP_EASE = OPEN_EASE;

/**
 * Every task across your garage, tallied — the menu's All Car Tasks pill.
 *
 * One subscription per car to the same query each car's own list reads, so
 * the counts stay in step with ticks made anywhere, and opening a car in the
 * pane finds its tasks already there.
 */
export function useAllCarTasksTally(enabled = true) {
  const dispatch = useAppDispatch();
  const { data } = useGetUserGarageQuery(undefined, { skip: !enabled });
  const ids = (data?.entries ?? []).map((c) => c.internal_id);
  const key = ids.join(',');
  useEffect(() => {
    if (!enabled) return;
    const subs = ids.map((id) => dispatch(apiService.endpoints.getCarTasks.initiate(id)));
    return () => subs.forEach((s) => s.unsubscribe());
  }, [enabled, key]); // eslint-disable-line react-hooks/exhaustive-deps
  return useAppSelector((state) => {
    const all = ids.flatMap((id) => apiService.endpoints.getCarTasks.select(id)(state).data?.entries ?? []);
    return taskTally(all);
  }, (a, b) => a.done === b.done && a.total === b.total);
}

/**
 * Every car's tasks in one pane, from the menu: an accordion per car in your
 * garage — its photo, its name, how many are still open and a pie of how much
 * is done — that opens onto the same list the car's tasks screen shows
 * (CarTaskList), menus and all. No title: the menu pill that opens it said
 * what it is.
 */
export default function AllCarTasksSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const { data, isLoading } = useGetUserGarageQuery(undefined, { skip: !visible });
  const cars = data?.entries ?? [];
  const [openId, setOpenId] = useState<string | null>(null);

  const toggle = (id: string) => setOpenId((cur) => (cur === id ? null : id));

  return (
    <SharedModal
      visible={visible}
      onClose={onClose}
      onDismissed={() => setOpenId(null)}
      hideHeader
      heightRatio={0.9}
      // The list runs to the foot of the screen and pads itself clear.
      edgeToEdge
    >
      <ScrollView
        contentContainerStyle={[
          styles.body,
          // Clear of the grabber, with no title row to do it.
          { paddingTop: PANE_GRABBER_H + 4 },
          // Android's navigation bar can report no inset inside a Modal, so
          // it gets a floor of its own — as ActionSheet's does.
          { paddingBottom: Math.max(insets.bottom, Platform.OS === 'android' ? 48 : 12) + 16 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {isLoading ? (
          <Spinner />
        ) : cars.length === 0 ? (
          <EmptyState title="No cars yet" message="Add a car to your garage to keep its tasks." />
        ) : (
          cars.map((car) => (
            <CarTasksAccordion key={car.internal_id} car={car} open={openId === car.internal_id} onToggle={() => toggle(car.internal_id)} />
          ))
        )}
      </ScrollView>
    </SharedModal>
  );
}

/** One car: the header that opens it, and its tasks once it's open. */
function CarTasksAccordion({ car, open, onToggle }: { car: GarageCar; open: boolean; onToggle: () => void }) {
  const colors = useColors();
  const { data } = useGetCarTasksQuery(car.internal_id);
  const { done, open: left, total } = taskTally(data?.entries ?? []);
  const photo = carHeroUrl(car);
  const name = car.title || [car.year, car.make, car.model].filter(Boolean).join(' ') || 'Car';

  // Opening, the photo shrinks into a circle while the count and pie slide
  // over to show the close, all as the row grows; closing runs it back.
  const progress = useSharedValue(open ? 1 : 0);
  useEffect(() => {
    progress.value = withTiming(open ? 1 : 0, { duration: OPEN_MS, easing: STEP_EASE });
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const photoStyle = useAnimatedStyle(() => {
    const size = interpolate(progress.value, [0, 1], [PHOTO, PHOTO_OPEN]);
    const inset = interpolate(progress.value, [0, 1], [0, PHOTO_INSET]);
    // Closed, its left corners are the row's own; open, it's round all over.
    const near = interpolate(progress.value, [0, 1], [0, PHOTO_OPEN / 2]);
    const far = interpolate(progress.value, [0, 1], [12, PHOTO_OPEN / 2]);
    return {
      width: size, height: size, margin: inset,
      marginRight: 0,
      borderTopLeftRadius: near, borderBottomLeftRadius: near,
      borderTopRightRadius: far, borderBottomRightRadius: far,
    };
  });
  const tallyStyle = useAnimatedStyle(() => ({ marginRight: progress.value * CLOSE_ROOM }));
  const closeStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateX: (1 - progress.value) * 12 }, { scale: 0.7 + progress.value * 0.3 }],
  }));

  return (
    // Moves as one when a car above it opens or closes.
    <Reanimated.View layout={ROW_LAYOUT} style={[styles.car, { backgroundColor: ROW_BG }]}>
      <TouchableOpacity
        style={styles.head}
        onPress={onToggle}
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={`${name}, ${left} open`}
      >
        <Reanimated.View style={[styles.photo, { backgroundColor: colors.segment }, photoStyle]}>
          {photo ? (
            <Image small source={{ uri: photo }} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} />
          ) : null}
        </Reanimated.View>
        <View style={styles.headText}>
          <Text style={[styles.name, { color: colors.fg }]} numberOfLines={1}>{name}</Text>
        </View>
        {/* How many are open, then the pie of how much is done. */}
        <Reanimated.View style={[styles.tally, tallyStyle]}>
          {left > 0 && <Text style={[styles.count, { color: colors.fg }]}>{left}</Text>}
          {total > 0 && <TaskProgressPie completed={done} total={total} size={26} color={colors.pro} />}
        </Reanimated.View>
        {/* Where the count and pie were, once they've stepped aside. */}
        <Reanimated.View style={[styles.closeWrap, closeStyle]} pointerEvents={open ? 'auto' : 'none'}>
          <TouchableOpacity
            style={[styles.close, { backgroundColor: colors.segment }]}
            onPress={onToggle}
            activeOpacity={0.8}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={`Close ${name}`}
          >
            <X size={16} color={colors.fg} />
          </TouchableOpacity>
        </Reanimated.View>
      </TouchableOpacity>
      {/* The car's own list, as on its tasks screen — its sections hold
          themselves off the card's edges. */}
      {open && (
        <Reanimated.View exiting={HOLD_UNTIL_CLOSED} style={styles.list}>
          <CarTaskList carId={car.internal_id} />
        </Reanimated.View>
      )}
    </Reanimated.View>
  );
}

const styles = StyleSheet.create({
  body:     { paddingHorizontal: 12, gap: 12 },
  car:      { borderRadius: 22, overflow: 'hidden' },
  // The photo runs flush to the row's top, bottom and left edge, so only the
  // right side pads.
  head:     { flexDirection: 'row', alignItems: 'center', gap: 14, paddingRight: 14 },
  // Closed: square, its left corners the row's own (the row clips them),
  // rounded on the right where it meets the name. Open: see photoStyle.
  photo:    { width: PHOTO, height: PHOTO, overflow: 'hidden', borderTopRightRadius: 12, borderBottomRightRadius: 12 },
  tally:    { flexDirection: 'row', alignItems: 'center', gap: 14 },
  closeWrap: { position: 'absolute', right: 14, top: 0, bottom: 0, justifyContent: 'center' },
  close:    { width: CLOSE, height: CLOSE, borderRadius: CLOSE / 2, alignItems: 'center', justifyContent: 'center' },
  headText: { flex: 1, minWidth: 0 },
  name:     { fontSize: 15, fontFamily: FONT_INTER.bold },
  count:    { fontSize: 15, fontFamily: FONT_INTER.bold },
  // CarTaskList's sections open with their own top margin.
  list:     { marginTop: -10, paddingBottom: 12 },
});
