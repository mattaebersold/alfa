import React, { useMemo, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, Dimensions,
} from 'react-native';
import { Image } from 'expo-image';
import {
  useGetCarsQuery, useGetUserGarageQuery, useGetFollowedCarsQuery,
} from '../../api/apiService';
import { useAppSelector } from '../../store/store';
import { useColors } from '../../hooks/useColors';
import { firstGalleryUrl, imageUrl } from '../../utils/image';
import RowEndSpacer from '../ui/RowEndSpacer';
import SuggestionCard, { SUGGESTION_CARD_PAD } from './SuggestionCard';
import { shuffle } from '../../utils/array';
import type { GarageCar } from '../../types/api';
import CarSummaryModal from '../cars/CarSummaryModal';
import { SummaryTouchable, type SummaryOrigin } from '../ui/SummaryModal';

/**
 * "Suggested Cars" — cars you don't follow that share a make (better, a model)
 * with something in your garage, falling back to the newest cars overall when
 * your garage is empty or nothing matches.
 *
 * Two pools feed this. The related pool is a targeted server query on your most
 * common make; the recent pool is the newest cars generally, which doubles as
 * the fallback and as a source of matches for the *other* makes you own — one
 * query per make isn't possible when the make list is dynamic and hooks aren't.
 */

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = SCREEN_WIDTH * 0.44;
const CARD_GAP = 10;
const ROW_PAD = SUGGESTION_CARD_PAD;
const RELATED_POOL = 24;
const RECENT_POOL = 30;
const MAX_SUGGESTIONS = 10;
/** What the fallback shows when there's nothing to match against. */
const FALLBACK_COUNT = 5;

function CarCardMini({ car, onPress }: {
  car: GarageCar;
  onPress: (origin: SummaryOrigin | null) => void;
}) {
  const colors = useColors();
  const hero = firstGalleryUrl(car.gallery) ?? imageUrl(car.profile_image);

  return (
    <SummaryTouchable style={styles.card} onPress={onPress}>
      <View style={styles.thumb}>
        <Image
          source={hero ? { uri: hero } : require('../../../assets/car-placeholder.jpg')}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
        />
      </View>
      <Text style={[styles.carName, { color: colors.fg }]} numberOfLines={1}>
        {[car.year, car.make, car.model].filter(Boolean).join(' ')}
      </Text>
    </SummaryTouchable>
  );
}

interface Props {
  /** Opens the shared hide dialog. Omit and no close button is drawn. */
  onRequestHide?: () => void;
}

export default function SuggestedCarsRow({ onRequestHide }: Props) {
  const { userInfo } = useAppSelector((s) => s.auth);
  const [summary, setSummary] = useState<{ carId: string; origin: SummaryOrigin | null } | null>(null);
  const myId = userInfo?.user_id ?? '';

  const { data: myGarage } = useGetUserGarageQuery();
  const { data: followedCars } = useGetFollowedCarsQuery();

  const myCars = useMemo(() => myGarage?.entries ?? [], [myGarage]);

  // The make you own most of leads the targeted query — with one shot at the
  // server, the make you have three of is a better guess than an arbitrary one.
  const topMake = useMemo(() => {
    const counts = new Map<string, number>();
    for (const car of myCars) {
      if (car.make_handle) counts.set(car.make_handle, (counts.get(car.make_handle) ?? 0) + 1);
    }
    let best: string | undefined;
    let bestCount = 0;
    for (const [make, count] of counts) {
      if (count > bestCount) { best = make; bestCount = count; }
    }
    return best;
  }, [myCars]);

  const { data: relatedData } = useGetCarsQuery(
    { filter: 'related', make: topMake, limit: RELATED_POOL },
    { skip: !topMake },
  );
  const { data: recentData } = useGetCarsQuery({ limit: RECENT_POOL });

  const suggestions = useMemo<GarageCar[]>(() => {
    // Your own cars and the ones you already follow are never suggestions.
    const excluded = new Set<string>([
      ...myCars.map((c) => c.internal_id),
      ...(followedCars?.entries ?? []).map((c) => c.internal_id),
    ]);

    const seen = new Set<string>();
    const pool: GarageCar[] = [];
    for (const car of [...(relatedData?.entries ?? []), ...(recentData?.entries ?? [])]) {
      if (!car?.internal_id || seen.has(car.internal_id)) continue;
      if (excluded.has(car.internal_id) || car.user_id === myId) continue;
      seen.add(car.internal_id);
      pool.push(car);
    }

    const myMakes = new Set(myCars.map((c) => c.make_handle).filter(Boolean) as string[]);
    const myModels = new Set(myCars.map((c) => c.model_handle).filter(Boolean) as string[]);

    // A shared model is a much stronger signal than a shared make, so those
    // lead — someone with an E30 cares more about other E30s than other BMWs.
    //
    // Each tier is shuffled within itself rather than the list being shuffled as
    // a whole: that keeps model matches ahead of make matches, so the ordering
    // still means something, while stopping the same cars from taking the front
    // of the shelf on every visit.
    const modelMatches = shuffle(pool.filter((c) => c.model_handle && myModels.has(c.model_handle)));
    const makeMatches = shuffle(pool.filter(
      (c) => c.make_handle && myMakes.has(c.make_handle) && !(c.model_handle && myModels.has(c.model_handle)),
    ));
    const matches = [...modelMatches, ...makeMatches];

    // Empty garage, or nothing in the pools matched it — show cars you don't
    // already follow instead of showing nothing. Nothing ranks these, so the
    // whole fallback pool shuffles.
    if (!matches.length) return shuffle(pool).slice(0, FALLBACK_COUNT);
    return matches.slice(0, MAX_SUGGESTIONS);
  }, [relatedData, recentData, myCars, followedCars, myId]);

  if (!suggestions.length) return null;

  return (
    <SuggestionCard title="Suggested Cars" onClose={onRequestHide}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
        snapToInterval={CARD_WIDTH + CARD_GAP}
        decelerationRate="fast"
      >
        {suggestions.map((car) => (
          <CarCardMini
            key={car.internal_id}
            car={car}
            // A suggestion is an invitation to decide about a car, which is
            // what the summary is for — the full page is one button inside it.
            onPress={(origin) => setSummary({ carId: car.internal_id, origin })}
          />
        ))}
        <RowEndSpacer width={ROW_PAD} />
      </ScrollView>

      <CarSummaryModal
        carId={summary?.carId ?? null}
        origin={summary?.origin}
        onClose={() => setSummary(null)}
      />
    </SuggestionCard>
  );
}

const styles = StyleSheet.create({
  scroll:    { gap: CARD_GAP, paddingLeft: ROW_PAD },
  card:      { width: CARD_WIDTH, gap: 6 },
  thumb:     {
    width: CARD_WIDTH, height: CARD_WIDTH * 0.62,
    borderRadius: 10, overflow: 'hidden', backgroundColor: '#111',
  },
  carName:   { fontSize: 12, fontWeight: '600' },
});
