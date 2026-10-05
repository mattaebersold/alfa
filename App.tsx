// First: configures @ors/kit (API base, app id) before the store — which
// includes the kit's API — or any screen is created.
import './src/kitSetup';
import './src/global.css';
import React from 'react';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { Provider } from 'react-redux';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { ShopifyCheckoutSheetProvider, ColorScheme } from '@shopify/checkout-sheet-kit';
import { StatusBar } from 'expo-status-bar';
import { PortalHost, enableKitFonts } from '@ors/kit';
import { FONT_FILES } from './src/constants/fonts';
import { store } from './src/store/store';
import RootNavigator from './src/navigation/RootNavigator';
import OfflineOverlay from './src/components/ui/OfflineOverlay';
// Registers the route background-location task. Imported for its side
// effect: defineTask must run before React mounts, because the OS can
// relaunch the app directly into the task with no UI.
import './src/hooks/routeBackgroundTask';
// Side effect: makes Android's alerts dismissible by back / tapping outside.
import './src/utils/alertDefaults';

// Held until the fonts are in (see App), so the first screen draws in them
// rather than flashing the system font first.
SplashScreen.preventAutoHideAsync().catch(() => {});

export default function App() {
  /**
   * Comfortaa and Inter, before anything draws. The kit's Text sets every
   * string in them once enabled (see kit theme/Text). A font that fails to
   * load isn't worth a blank app: the splash lifts anyway, and text stays in
   * the system font.
   */
  const [fontsLoaded, fontError] = useFonts(FONT_FILES);
  if (fontsLoaded) enableKitFonts();
  React.useEffect(() => {
    if (fontsLoaded || fontError) SplashScreen.hideAsync().catch(() => {});
  }, [fontsLoaded, fontError]);
  if (!fontsLoaded && !fontError) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        {/* Edge-to-edge on Android (always, from Expo 57), so both bars are
            translucent as far as the keyboard is concerned. */}
        <KeyboardProvider statusBarTranslucent navigationBarTranslucent preserveEdgeToEdge>
        <Provider store={store}>
        {/* Shopify's native checkout sheet, for the shop. The URL to present
            comes from horacio per product; see screens/shop/ProductDetailScreen. */}
        <ShopifyCheckoutSheetProvider configuration={{ colorScheme: ColorScheme.automatic, preloading: true, title: 'Checkout' }}>
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
        </ShopifyCheckoutSheetProvider>
        </Provider>
        </KeyboardProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
