import { useNavigationState } from '@react-navigation/native';

/**
 * Screens that want the bottom of the phone to themselves.
 *
 * A route's map now fills most of the screen, and a tab bar plus a create
 * button floating over the bottom of it turns the thing you came to look at
 * into a backdrop for navigation you weren't using. These screens hide both.
 *
 * Keyed by route name because that's what the navigation state carries — add a
 * name here and the tab bar and the create button both step aside for it.
 */
const IMMERSIVE_SCREENS = new Set<string>([
  'RouteDetail',
]);

export function isImmersiveScreen(routeName?: string): boolean {
  return !!routeName && IMMERSIVE_SCREENS.has(routeName);
}

/**
 * The name of the screen actually on show, however deeply nested.
 *
 * `getFocusedRouteNameFromRoute` only looks one level down, which isn't enough
 * here: the tab navigator holds a stack per tab, so the route being looked at
 * is two levels below the state this can see.
 */
function deepestRouteName(state: any): string | undefined {
  const route = state?.routes?.[state.index ?? 0];
  if (!route) return undefined;
  return (route.state && deepestRouteName(route.state)) || route.name;
}

export function useFocusedRouteName(): string | undefined {
  return useNavigationState((state) => deepestRouteName(state));
}
