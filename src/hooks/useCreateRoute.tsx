import React, { useState } from 'react';
import { Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useIsPro } from './useBrandColor';
import { ProUpsellModal } from '../components/pro/ProUpsell';
import { ROUTE_UPSELL } from '../constants/config';

/**
 * "Make a route of your own", wherever it's offered — the Routes screen's
 * heading and every route card.
 *
 * Two ways in, as there always were: record a drive as it happens, or plot
 * one already driven. Making routes is Pro (the API says so too), so a basic
 * member gets the pitch rather than a form the server would refuse. Render
 * `upsell` somewhere in the host.
 */
export function useCreateRoute() {
  const navigation = useNavigation<any>();
  const isPro = useIsPro();
  const [pitch, setPitch] = useState(false);

  const create = () => {
    if (!isPro) { setPitch(true); return; }
    Alert.alert('New route', "Record a drive as you go, or plot one you've already done.", [
      { text: 'Record a drive', onPress: () => navigation.navigate('RouteRecord') },
      { text: 'Plot a past drive', onPress: () => navigation.navigate('RoutePlot') },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const upsell = (
    <ProUpsellModal
      visible={pitch}
      onClose={() => setPitch(false)}
      title={ROUTE_UPSELL.title}
      message={ROUTE_UPSELL.message}
    />
  );

  return { create, upsell };
}
