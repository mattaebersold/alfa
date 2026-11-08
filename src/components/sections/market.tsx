import { Tag, Megaphone, ClipboardList, Eye } from 'lucide-react-native';
import type { SectionSub } from './types';
import { ListingsScreen, WantAdsScreen } from './market/MarketBrowseScreens';
import MyListingsScreen from './market/MyListingsScreen';
import WatchlistScreen from './market/WatchlistScreen';

/** Marketplace › Listings, Want Ads, My Listings, Watchlist. */
export const MARKET_SUBS: SectionSub[] = [
  { key: 'listings',  label: 'Listings',    Icon: Tag,           Component: ListingsScreen },
  { key: 'want',      label: 'Want Ads',    Icon: Megaphone,     Component: WantAdsScreen },
  { key: 'mine',      label: 'My Listings', Icon: ClipboardList, Component: MyListingsScreen },
  { key: 'watchlist', label: 'Watchlist',   Icon: Eye,           Component: WatchlistScreen },
];
