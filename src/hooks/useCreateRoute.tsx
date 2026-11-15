import React, { useState } from 'react';
import { Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useRouteAllowance } from './useRouteAllowance';
import { ProUpsellModal } from '../components/pro/ProUpsell';
import { ROUTE_UPSELL, ROUTE_PRO_FULL } from '../constants/config';
import { useIsPro } from './useBrandColor';

/**
 * "Make a route of your own", wherever it's offered — the Routes screen's
 * heading and every route card.
 *
 * Two ways in, as there always were: record a drive as it happens, or plot
 * one already driven. A basic member keeps one route (the API says so too),
 * so one at the limit gets the pitch rather than a form the server would refuse. Render
 * `upsell` somewhere in the host.
 */
export function useCreateRoute() {
  const navigation = useNavigation<any>();
  const allowance = useRouteAllowance();
  const isPro = useIsPro();
  const [pitch, setPitch] = useState(false);

  const create = () => {
    if (allowance.status === 'blocked') {
      // Pro at its ten: say so; there's nothing to upgrade to.
      if (isPro) Alert.alert(ROUTE_PRO_FULL.title, ROUTE_PRO_FULL.message);
      else setPitch(true);
      return;
    }
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
