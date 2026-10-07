import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { Image } from 'expo-image';
import CarSummaryModal, { type CarPreview } from '../components/cars/CarSummaryModal';
import UserSummaryModal, { type UserPreview } from '../components/members/UserSummaryModal';
import type { SummaryOrigin } from '../components/ui/SummaryModal';
import { apiService } from '../api/apiService';
import { useAppDispatch } from '../store/store';

type OpenCar = (id: string, origin?: SummaryOrigin | null, preview?: CarPreview | null) => void;
type OpenUser = (id: string, origin?: SummaryOrigin | null, preview?: UserPreview | null) => void;

const SummaryContext = createContext<{ openCar: OpenCar; openUser: OpenUser }>({
  openCar: () => {},
  openUser: () => {},
});

/**
 * One car summary and one member summary for the whole app.
 *
 * Every card used to carry its own copy of each: a feed of forty cards was
 * eighty closed panels, each running its queries (skipped, but subscribed),
 * its keyboard listeners and its measurements on every render of the list.
 * Tapping a card then re-rendered the card's whole list to open one of
 * them. Hosted here instead, like the group summary and the event sheet,
 * a card asks for a summary and renders nothing of its own.
 *
 * A card also hands over what it already knows — the name, the photo — as a
 * `preview`, and the fetch for the rest starts here, on the tap, so the
 * panel opens showing the thing rather than a spinner where it will be.
 */
export function SummaryProvider({ children }: { children: React.ReactNode }) {
  const dispatch = useAppDispatch();
  const [car, setCar] = useState<{ id: string; origin?: SummaryOrigin | null; preview?: CarPreview | null } | null>(null);
  const [user, setUser] = useState<{ id: string; origin?: SummaryOrigin | null; preview?: UserPreview | null } | null>(null);

  const openCar = useCallback<OpenCar>((id, origin, preview) => {
    dispatch(apiService.util.prefetch('getCarWithUser', id, { ifOlderThan: 300 }));
    if (preview?.hero) Image.prefetch(preview.hero);
    setCar({ id, origin, preview });
  }, [dispatch]);
  const openUser = useCallback<OpenUser>((id, origin, preview) => {
    dispatch(apiService.util.prefetch('getPublicUserById', id, { ifOlderThan: 300 }));
    setUser({ id, origin, preview });
  }, [dispatch]);
  const closeCar = useCallback(() => setCar(null), []);
  const closeUser = useCallback(() => setUser(null), []);
  const value = useMemo(() => ({ openCar, openUser }), [openCar, openUser]);

  return (
    <SummaryContext.Provider value={value}>
      {children}
      <CarSummaryModal carId={car?.id ?? null} origin={car?.origin} preview={car?.preview} onClose={closeCar} />
      <UserSummaryModal userId={user?.id ?? null} origin={user?.origin} preview={user?.preview} onClose={closeUser} />
    </SummaryContext.Provider>
  );
}

export const useSummary = () => useContext(SummaryContext);
