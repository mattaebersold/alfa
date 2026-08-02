import type { ImageSourcePropType } from 'react-native';

// Background images crossfaded on the auth (login/register) screens.
// Metro requires static require() paths, so they're listed explicitly.
export const SPLASH_IMAGES: ImageSourcePropType[] = [
  require('../../assets/splash.jpg'),
  require('../../assets/splash2.jpg'),
  require('../../assets/splash3.jpg'),
  require('../../assets/splash4.jpg'),
  require('../../assets/splash5.jpg'),
];
