import React, { useCallback } from 'react';
import { useNavigation } from '@react-navigation/native';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { PhotographyScreen as KitPhotographyScreen } from '@ors/kit/src/photography';
import AppHeader from '../../components/ui/AppHeader';

/**
 * Photography — a map of places worth shooting a car.
 *
 * The screen itself is @ors/kit's (kit/src/photography/PhotographyScreen),
 * shared with the photo app: the map, the Location + Type filter, the list,
 * the hold-to-pin, the spot summary. What's alfa's is handed in — the app
 * header, where a dropped pin and an Edit go, and the tag tiles (members,
 * cars, events) on a spot's summary.
 */
export default function PhotographyScreen() {
  const nav = useNavigation<any>();
  const tabBarHeight = useBottomTabBarHeight();

  /** Start a pin here: the create screen opens with the point already placed. */
  const onDropPin = useCallback((point: { lat: number; lng: number; name?: string; address?: string }) => {
    nav.navigate('PhotoSpotCreate', { lat: point.lat, lng: point.lng, name: point.name, address: point.address });
  }, [nav]);

  const onEditSpot = useCallback((spotId: string) => {
    nav.navigate('PhotoSpotCreate', { spotId });
  }, [nav]);

  return (
    <KitPhotographyScreen
      header={<AppHeader spacer />}
      safeTop={false}
      bottomInset={tabBarHeight}
      onDropPin={onDropPin}
      onEditSpot={onEditSpot}
      // No tag tiles on the sheet: it shows who added photos instead. The
      // tags are still saved and still notify; the spot's page reads them.
    />
  );
}
