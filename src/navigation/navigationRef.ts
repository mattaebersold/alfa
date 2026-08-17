import { createNavigationContainerRef } from '@react-navigation/native';
import type { AppStackParamList } from './types';

/**
 * A navigation handle for code that runs outside the React tree.
 *
 * Push-notification listeners are registered on the module, not on a screen, so
 * they have no `useNavigation` to reach for — this is how a tapped push gets to
 * navigate. Everything inside a component should keep using `useNavigation`.
 */
export const navigationRef = createNavigationContainerRef<AppStackParamList>();

/**
 * Navigates once the container is ready; a no-op before then.
 *
 * The cast is the standard escape hatch for the typed ref's `navigate`
 * overloads, which can't express "some route name with some params" when the
 * pair is only known at runtime — here it comes from a push payload.
 */
export function navigateFromOutside(name: keyof AppStackParamList, params?: object) {
  if (!navigationRef.isReady()) return false;
  (navigationRef.navigate as (n: string, p?: object) => void)(name, params);
  return true;
}
