import React, { useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import ListShelf from '../lists/ListShelf';
import ListSummaryModal from '../lists/ListSummaryModal';
import type { SummaryOrigin } from '../ui/SummaryModal';
import { useGetListsQuery } from '../../api/apiService';

/**
 * The lists written for this car — "Future inspiration", "5 mods I want to do
 * next year".
 *
 * A list attached to a car lives here instead of on its author's profile: it's
 * about the car, and the car's page is where someone reading about the car
 * will look. The server only returns lists by the car's current owner or
 * co-owner, so a car that changes hands doesn't arrive with the last owner's
 * plans for it.
 *
 * Owns its query and its panel, the way TaggedPostsRow owns its query: the car
 * page is long enough without another fetch, another piece of state and
 * another modal threaded through it.
 *
 * For visitors it renders nothing when there's nothing — see ListShelf. For an
 * owner who may add one, the empty shelf stays, as the invitation.
 */
export default function CarListsRow({ carId, canAdd }: {
  carId: string;
  /**
   * An owner or co-owner of this car who is also Pro. A basic owner gets no
   * add button here rather than one that opens the pitch — the car page is
   * theirs to look at, not a place to be sold to on every visit.
   */
  canAdd: boolean;
}) {
  const nav = useNavigation<any>();
  const [open, setOpen] = useState<{ id: string; origin: SummaryOrigin | null } | null>(null);

  // The whole set in one go: a car has a handful of these, and the server
  // caps a page at 50 — which is also the most lists one member can have.
  const { data } = useGetListsQuery({ car_id: carId, limit: 50 }, { skip: !carId });
  const lists = data?.entries ?? [];

  return (
    <>
      <ListShelf
        title="Lists"
        lists={lists}
        total={data?.total}
        onListPress={(list, origin) => setOpen({ id: list.internal_id, origin })}
        // Arrives already attached to this car; the form can still change it.
        onAdd={canAdd ? () => nav.navigate('CreateList', { carId }) : undefined}
        addLabel="Add a list"
        emptyHint="Plans for this car, in order — the mods you want next, the cars that inspired it."
      />
      {/* `hideCar`: on this page, "a list for this car" is the page you're on. */}
      <ListSummaryModal
        listId={open?.id ?? null}
        origin={open?.origin}
        onClose={() => setOpen(null)}
        hideCar
      />
    </>
  );
}
