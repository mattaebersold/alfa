import React, { useRef, useState } from 'react';
import { View, FlatList, TouchableOpacity, StyleSheet } from 'react-native';
import { Text } from '@ors/kit';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { X } from 'lucide-react-native';
import GrowPanel, { type GrowOrigin } from '../ui/GrowPanel';
import DropPane from '../ui/DropPane';
import GarageCarCard from './GarageCarCard';
import HeadingActionButton from '../ui/HeadingActionButton';
import EmptyState from '../ui/EmptyState';
import Spinner from '../ui/Spinner';
import { GetProButton, ProUpsellModal } from '../pro/ProUpsell';
import { useGetUserGarageQuery, useGetCarsQuery } from '../../api/apiService';
import { useAppSelector } from '../../store/store';
import { useColors } from '../../hooks/useColors';
import { useIsPro } from '../../hooks/useBrandColor';
import { PILL_RADIUS, carLimitFor, garageFull, showProGarageFull, GARAGE_UPSELL } from '../../constants/config';
import { FONT_INTER } from '../../constants/fonts'

/**
 * Your garage, grown out of the header's garage button.
 *
 * It used to be a screen the button navigated to — a page transition, for the
 * one header button whose neighbours (the bell, the menu) open in place. Now
 * all three behave the same: press, and the button becomes the panel. The
 * cars scroll inside it, and every way out — a car, a task list, the edit
 * form, the add-car form — closes the panel first and goes afterwards, since
 * iOS won't run a stack transition over a modal that's still closing.
 *
 * The garage *screen* still exists for the tab and for deep links; this is the
 * header's way in.
 *
 * Given someone else as `owner` — from the garage button on their profile —
 * it's their garage, read-only: their cars, a count, and none of the adding,
 * the car limit, the Pro pitch or the task counts, which are all yours.
 */
export default function GaragePanel({ visible, origin, onClose, owner, drop = false }: {
  visible: boolean;
  origin?: GrowOrigin | null;
  onClose: () => void;
  /** Whose garage. Omitted, or yourself, means yours. */
  owner?: { user_id: string; username?: string } | null;
  /**
   * Full height, down from the top of the screen (DropPane) rather than grown
   * out of the button — the header's garage tab opens it this way.
   */
  drop?: boolean;
}) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const isPro = useIsPro();
  const navigation = useNavigation<any>();
  const myId = useAppSelector((s) => s.auth.userInfo?.user_id);
  const visiting = !!owner && owner.user_id !== myId;
  const own = useGetUserGarageQuery(undefined, { skip: !visible || visiting });
  const theirs = useGetCarsQuery({ user_id: owner?.user_id, limit: 50 }, { skip: !visible || !visiting });
  const { data, isLoading } = visiting ? theirs : own;
  const cars = data?.entries ?? [];

  // The cap bites in one place: the add button, which opens the upsell rather
  // than a form the server will refuse.
  const [upsell, setUpsell] = useState(false);
  // The head's and the list's heights, which together size the panel.
  const headH = useRef(0);
  const listH = useRef(0);
  const atLimit = garageFull(isPro, cars.length);

  const body = ({ closeThen, fitHeight }: { closeThen: (run?: () => void) => void; fitHeight: (h: number) => void }) => {
    const go = (name: string, params?: object) => closeThen(() => navigation.navigate(name, params));
    const addCar = () => (atLimit ? (isPro ? showProGarageFull() : setUpsell(true)) : go('CarCreate', {}));
    // The panel is as tall as the head plus the list's own content — up to
    // most of the screen, past which the list scrolls. A garage of one
    // car no longer opens onto a screenful of empty panel.
    const measure = () => {
      if (headH.current && listH.current) fitHeight(headH.current + listH.current);
    };

    return (
      <>
        <View style={styles.fill}>
          {/* The head: the action, how full the garage is, and the way
              out. No title — you pressed the garage button and the panel
              is full of cars; a word saying "Garage" would be doing no
              work. The count says what's left as well as what's there on
              a basic account; Pro has no cap to count against. */}
          <View style={styles.head} onLayout={(e) => { headH.current = e.nativeEvent.layout.height; measure(); }}>
            <View style={styles.headText}>
              {/* Someone else's garage does get a title: here the button
                  was theirs, and the panel should say whose cars these are. */}
              {/* The full-height pane is a page of its own, so it names
                  itself, and its Add Car moves over beside the close. */}
              {visiting ? (
                <Text style={[styles.title, { color: colors.fg }]} numberOfLines={1}>
                  {owner?.username ? `@${owner.username}'s garage` : 'Garage'}
                </Text>
              ) : drop ? (
                <Text style={[styles.title, { color: colors.fg }]} numberOfLines={1}>Your Garage</Text>
              ) : (
                <HeadingActionButton label="Add Car" onPress={addCar} accessibilityLabel="Add a car" />
              )}
              <View style={[styles.countPill, { backgroundColor: colors.segment }]}>
                <Text style={[styles.countText, { color: colors.fg }]}>
                  {visiting ? (theirs.data?.total ?? cars.length) : `${cars.length}/${carLimitFor(isPro)}`}
                </Text>
              </View>
            </View>
            <View style={styles.headActions}>
              {!isPro && !visiting && <GetProButton onPress={() => setUpsell(true)} />}
              {drop && !visiting && (
                <HeadingActionButton label="Add Car" onPress={addCar} accessibilityLabel="Add a car" compact />
              )}
              <TouchableOpacity
                onPress={() => closeThen()}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                accessibilityRole="button"
                accessibilityLabel="Close garage"
              >
                <X size={26} color={colors.fg} strokeWidth={2.4} />
              </TouchableOpacity>
            </View>
          </View>

          {isLoading ? (
            <View style={styles.loading} onLayout={(e) => { listH.current = e.nativeEvent.layout.height; measure(); }}><Spinner /></View>
          ) : (
            <FlatList
              data={cars}
              keyExtractor={(item) => item.internal_id}
              renderItem={({ item }) => visiting ? (
                <GarageCarCard car={item} onPress={() => go('CarDetail', { carId: item.internal_id })} />
              ) : (
                <GarageCarCard
                  car={item}
                  onPress={() => go('CarDetail', { carId: item.internal_id })}
                  onTasksPress={() => go('CarTasks', {
                    carId: item.internal_id,
                    carTitle: [item.year, item.make, item.model].filter(Boolean).join(' '),
                  })}
                  onEditPress={() => go('CarCreate', { carId: item.internal_id })}
                />
              )}
              // Just the line: the Add Car button sits in the head above it,
              // so a second one here would be the same control twice.
              ListEmptyComponent={<EmptyState title="No cars yet" />}
              // Full height, the list runs to the screen's foot: clear of the
              // system's navigation bar (Android) or home indicator (iOS).
              contentContainerStyle={[styles.list, drop && { paddingBottom: LIST_FOOT + insets.bottom }]}
              onContentSizeChange={(_, h) => { listH.current = h; measure(); }}
              showsVerticalScrollIndicator={false}
            />
          )}
        </View>

        {/* Inside the panel's Modal, so it presents over it on iOS. */}
        <ProUpsellModal
          visible={upsell}
          onClose={() => setUpsell(false)}
          title={GARAGE_UPSELL.title}
          message={GARAGE_UPSELL.message}
        />
      </>
    );
  };

  return drop ? (
    <DropPane visible={visible} onClose={onClose}>{body}</DropPane>
  ) : (
    <GrowPanel visible={visible} origin={origin} onClose={onClose} backdrop="summary">{body}</GrowPanel>
  );
}

/** Clear space under the last car. */
const LIST_FOOT = 24;

const styles = StyleSheet.create({
  fill: { flex: 1 },
  head: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10,
    paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8,
  },
  headText:    { flexDirection: 'row', alignItems: 'center', gap: 10, flexShrink: 1 },
  title:       { fontSize: 18, fontFamily: FONT_INTER.bold, flexShrink: 1 },
  countPill: {
    minWidth: 28, height: 28, borderRadius: PILL_RADIUS, paddingHorizontal: 7,
    alignItems: 'center', justifyContent: 'center',
  },
  countText:   { fontSize: 13, fontFamily: FONT_INTER.extrabold },
  headActions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  loading:     { paddingVertical: 60, alignItems: 'center' },
  // No flexGrow: the list's content height is what sizes the panel, and
  // stretched to fill it, it would only ever report the panel back.
  list:        { paddingTop: 8, paddingBottom: LIST_FOOT },
});
