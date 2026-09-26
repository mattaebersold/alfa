// First: configures @ors/kit (API base, app id) before the store — which
// includes the kit's API — or any screen is created.
import './src/kitSetup';
import './src/global.css';
import React from 'react';
import { Provider } from 'react-redux';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { StatusBar } from 'expo-status-bar';
import { PortalHost } from '@ors/kit';
import { store } from './src/store/store';
import RootNavigator from './src/navigation/RootNavigator';
import OfflineOverlay from './src/components/ui/OfflineOverlay';
// Registers the route background-location task. Imported for its side
// effect: defineTask must run before React mounts, because the OS can
// relaunch the app directly into the task with no UI.
import './src/hooks/routeBackgroundTask';
// Side effect: makes Android's alerts dismissible by back / tapping outside.
import './src/utils/alertDefaults';

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        {/* Edge-to-edge on Android (always, from Expo 57), so both bars are
            translucent as far as the keyboard is concerned. */}
        <KeyboardProvider statusBarTranslucent navigationBarTranslucent preserveEdgeToEdge>
        <Provider store={store}>
          <StatusBar style="light" />
          {/* Floating lists (autocompletes) draw here, over the screens; each
              Modal has a host of its own. */}
          <PortalHost>
          <RootNavigator />
          </PortalHost>
          {/* Last child, so it covers the navigator rather than being covered
              by it — an outage has to be answerable from whatever screen the
              app happens to be on. */}
          <OfflineOverlay />
        </Provider>
        </KeyboardProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
