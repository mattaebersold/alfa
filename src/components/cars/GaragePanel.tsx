import React, { useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { X } from 'lucide-react-native';
import GrowPanel, { type GrowOrigin } from '../ui/GrowPanel';
import CarPosterCard from '../cards/CarPosterCard';
import HeadingActionButton from '../ui/HeadingActionButton';
import EmptyState from '../ui/EmptyState';
import Spinner from '../ui/Spinner';
import { GetProButton, ProUpsellModal } from '../pro/ProUpsell';
import { useGetUserGarageQuery, useGetCarTasksQuery } from '../../api/apiService';
import { useColors } from '../../hooks/useColors';
import { useIsPro } from '../../hooks/useBrandColor';
import { CAR_LIMIT_BASIC } from '../../constants/limits';
import { PILL_RADIUS } from '../../constants/radius';

/** The panel's ground — true black, the same as the menu. */
const SURFACE = '#000000';

/**
 * A garage card that knows how many tasks are open on it — the same wrapper
 * the garage screen uses, kept here so the two lists can't drift.
 */
function CarCardWithTasks({ car, isPro, onPress, onTasksPress, onEditPress }: {
  car: any;
  isPro: boolean;
  onPress: () => void;
  onTasksPress: () => void;
  onEditPress: () => void;
}) {
  const { data: tasksData } = useGetCarTasksQuery(car.internal_id, { skip: !isPro });
  const tasks = tasksData?.entries ?? [];
  return (
    <CarPosterCard
      car={car}
      plain
      onPress={onPress}
      onTasksPress={isPro ? onTasksPress : undefined}
      onEditPress={onEditPress}
      taskCount={isPro ? tasks.filter((t) => !t.completed).length : 0}
    />
  );
}

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
 */
export default function GaragePanel({ visible, origin, onClose }: {
  visible: boolean;
  origin?: GrowOrigin | null;
  onClose: () => void;
}) {
  const colors = useColors();
  const isPro = useIsPro();
  const navigation = useNavigation<any>();
  const { data, isLoading } = useGetUserGarageQuery(undefined, { skip: !visible });
  const cars = data?.entries ?? [];

  // The cap bites in one place: the add button, which opens the upsell rather
  // than a form the server will refuse.
  const [upsell, setUpsell] = useState(false);
  const atLimit = !isPro && cars.length >= CAR_LIMIT_BASIC;

  return (
    <GrowPanel visible={visible} origin={origin} onClose={onClose} surface={SURFACE}>
      {({ closeThen }) => {
        const go = (name: string, params?: object) => closeThen(() => navigation.navigate(name, params));
        const addCar = () => (atLimit ? setUpsell(true) : go('CarCreate', {}));

        return (
          <>
            <View style={styles.fill}>
              {/* The head: the action, how full the garage is, and the way
                  out. No title — you pressed the garage button and the panel
                  is full of cars; a word saying "Garage" would be doing no
                  work. The count says what's left as well as what's there on
                  a basic account; Pro has no cap to count against. */}
              <View style={styles.head}>
                <View style={styles.headText}>
                  <HeadingActionButton label="Add Car" onPress={addCar} accessibilityLabel="Add a car" />
                  <View style={[styles.countPill, { backgroundColor: colors.segment }]}>
                    <Text style={[styles.countText, { color: colors.fg }]}>
                      {isPro ? cars.length : `${cars.length}/${CAR_LIMIT_BASIC}`}
                    </Text>
                  </View>
                </View>
                <View style={styles.headActions}>
                  {!isPro && <GetProButton onPress={() => setUpsell(true)} />}
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
                <View style={styles.loading}><Spinner /></View>
              ) : (
                <FlatList
                  data={cars}
                  keyExtractor={(item) => item.internal_id}
                  renderItem={({ item }) => (
                    <CarCardWithTasks
                      car={item}
                      isPro={isPro}
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
                  contentContainerStyle={styles.list}
                  showsVerticalScrollIndicator={false}
                />
              )}
            </View>

            {/* Inside the panel's Modal, so it presents over it on iOS. */}
            <ProUpsellModal
              visible={upsell}
              onClose={() => setUpsell(false)}
              title="Unlimited garage with Pro"
              message={`A basic membership holds ${CAR_LIMIT_BASIC} cars. Pro removes the limit — every car you've owned, kept in one place.`}
            />
          </>
        );
      }}
    </GrowPanel>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  head: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10,
    paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8,
  },
  headText:    { flexDirection: 'row', alignItems: 'center', gap: 10, flexShrink: 1 },
  countPill: {
    minWidth: 28, height: 28, borderRadius: PILL_RADIUS, paddingHorizontal: 7,
    alignItems: 'center', justifyContent: 'center',
  },
  countText:   { fontSize: 13, fontWeight: '800' },
  headActions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  loading:     { paddingVertical: 60, alignItems: 'center' },
  list:        { flexGrow: 1, paddingTop: 8, paddingBottom: 24 },
});
