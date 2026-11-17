import { Clapperboard, Gamepad2, ShoppingBag } from 'lucide-react-native';
import type { SectionSub } from './types';
import VideosScreen from './pro/VideosScreen';
import GamesScreen from './pro/GamesScreen';
import MarketplaceScreen from './pro/MarketplaceScreen';
import { PRO_GAMES_SUB } from '../games/openDailyGames';

/**
 * PRO › Videos, Games, Marketplace — after its landing, Home (ProHomeScreen:
 * today's Daily Games, the Pro group, Pro members' posts and cars). Pro members only: for everyone else the PRO
 * tab is the sign-up page, with no options row (see FeedScreen).
 *
 * Games is today's two games and today's results (pro/GamesScreen); each
 * game's Past Games and Leaderboard open from its own screen.
 */
export const PRO_SUBS: SectionSub[] = [
  { key: 'videos', label: 'Videos', Icon: Clapperboard, Component: VideosScreen },
  { key: PRO_GAMES_SUB, label: 'Games', Icon: Gamepad2, Component: GamesScreen },
  // The marketplace's home now — it's out of the header's main row and the menu.
  { key: 'market', label: 'Marketplace', Icon: ShoppingBag, Component: MarketplaceScreen },
];
