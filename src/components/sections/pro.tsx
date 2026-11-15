import { History, ShoppingBag, Trophy } from 'lucide-react-native';
import type { SectionSub } from './types';
import PastGamesScreen from './pro/PastGamesScreen';
import LeaderboardsScreen from './pro/LeaderboardsScreen';
import MarketplaceScreen from './pro/MarketplaceScreen';

/**
 * PRO › Past Games, Leaderboards, Marketplace — after its landing, Daily Games
 * (pro/DailyGamesLanding). Pro members only: for everyone else the PRO tab is
 * the sign-up page, with no options row (see FeedScreen).
 */
export const PRO_SUBS: SectionSub[] = [
  { key: 'past',   label: 'Past Games',   Icon: History, Component: PastGamesScreen },
  { key: 'boards', label: 'Leaderboards', Icon: Trophy,  Component: LeaderboardsScreen },
  // The marketplace's home now — it's out of the header's main row and the menu.
  { key: 'market', label: 'Marketplace',  Icon: ShoppingBag, Component: MarketplaceScreen },
];
