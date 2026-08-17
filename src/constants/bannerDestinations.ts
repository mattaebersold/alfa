import type { AppStackParamList } from '../navigation/types';

/**
 * Where the home feature banner can send you.
 *
 * One registry drives both ends: the admin picker lists exactly these, and the
 * banner's tap handler resolves whatever was picked through the same table. That
 * is the point of a registry rather than storing a raw screen name — an admin
 * can't save a destination the app can't open, because the only things offerable
 * are the ones defined here.
 *
 * What's stored on the banner is the `key`, never a navigator route name, so a
 * navigation refactor is a change to this file and not a data migration.
 *
 * Adding a destination: add an entry. Nested tab screens go through `MainTabs`
 * with the tab and inner screen as params, which is how the rest of the app
 * navigates across stacks.
 */

export interface BannerDestination {
  key: string;
  label: string;
  /** Grouping for the picker; purely presentational. */
  group: 'Society' | 'Cars' | 'Community' | 'Content' | 'Other';
  /** Resolves to a navigate() call. `id` is present only for `needsId` entries. */
  target: (id?: string) => { name: keyof AppStackParamList; params?: any };
  /**
   * The destination points at one specific record, so the admin has to supply
   * its id. `idLabel` is the hint shown next to that field.
   */
  needsId?: boolean;
  idLabel?: string;
}

const tab = (
  tabName: string,
  screen: string,
  params?: object,
): { name: keyof AppStackParamList; params?: any } => ({
  name: 'MainTabs',
  params: { screen: tabName, params: { screen, ...(params ? { params } : {}) } },
});

export const BANNER_DESTINATIONS: BannerDestination[] = [
  // ── Society ───────────────────────────────────────────────────────────────
  { key: 'rallys',        label: 'ORS Rallys',        group: 'Society', target: () => tab('SocietyTab', 'Rallys') },
  { key: 'events',        label: 'All Events',        group: 'Society', target: () => tab('SocietyTab', 'Events') },
  {
    key: 'rally_detail',
    label: 'A specific rally',
    group: 'Society',
    needsId: true,
    idLabel: 'Rally ID',
    target: (id) => ({ name: 'RallyDetailModal', params: { rallyId: id } }),
  },

  // ── Cars ──────────────────────────────────────────────────────────────────
  { key: 'cars',          label: 'Member Cars',       group: 'Cars', target: () => tab('CarsTab', 'Cars') },
  { key: 'garage',        label: 'My Garage',         group: 'Cars', target: () => tab('CarsTab', 'Garage') },
  { key: 'brands',        label: 'Brands',            group: 'Cars', target: () => tab('CarsTab', 'Brands') },
  {
    key: 'car_detail',
    label: 'A specific car',
    group: 'Cars',
    needsId: true,
    idLabel: 'Car ID',
    target: (id) => ({ name: 'CarDetail', params: { carId: id } }),
  },

  // ── Community ─────────────────────────────────────────────────────────────
  { key: 'groups',        label: 'Groups',            group: 'Community', target: () => tab('GroupsTab', 'Groups') },
  { key: 'members',       label: 'Members',           group: 'Community', target: () => tab('FeedTab', 'Members') },
  { key: 'routes',        label: 'Driving Routes',    group: 'Community', target: () => tab('RoutesTab', 'Routes') },
  {
    key: 'group_detail',
    label: 'A specific group',
    group: 'Community',
    needsId: true,
    idLabel: 'Group ID',
    target: (id) => ({ name: 'GroupDetail', params: { groupId: id } }),
  },

  // ── Content ───────────────────────────────────────────────────────────────
  { key: 'articles',      label: 'Articles',          group: 'Content', target: () => ({ name: 'Articles' }) },
  { key: 'podcasts',      label: 'Podcasts',          group: 'Content', target: () => ({ name: 'Podcasts' }) },
  { key: 'marketplace',   label: 'Marketplace',       group: 'Content', target: () => ({ name: 'Marketplace' }) },
  { key: 'shop',          label: 'Shop',              group: 'Content', target: () => ({ name: 'Shop' }) },
  {
    key: 'article_detail',
    label: 'A specific article',
    group: 'Content',
    needsId: true,
    idLabel: 'Article ID',
    target: (id) => ({ name: 'ArticleDetail', params: { articleId: id } }),
  },
  {
    key: 'post_detail',
    label: 'A specific post',
    group: 'Content',
    needsId: true,
    idLabel: 'Post ID',
    target: (id) => ({ name: 'PostDetailModal', params: { postId: id } }),
  },

  // ── Other ─────────────────────────────────────────────────────────────────
  { key: 'about',         label: 'About ORS',         group: 'Other', target: () => ({ name: 'About' }) },
];

/**
 * Legacy sentinel meaning "this banner links to a web address, not a screen".
 *
 * The two are no longer exclusive — a banner carries an app destination *and* a
 * web URL, so each platform can use the one it can act on (murray follows the
 * URL, the app navigates). Banners saved under the old either/or model still
 * hold this value in `destination`, where it resolves to no destination and the
 * URL fallback takes over. Kept only so those keep working; not offered in the
 * picker.
 */
export const BANNER_EXTERNAL_URL = 'url';

export const bannerDestination = (key?: string | null): BannerDestination | undefined =>
  BANNER_DESTINATIONS.find((d) => d.key === key);
