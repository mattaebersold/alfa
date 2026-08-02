/**
 * Detail screens are registered twice: inside the tab stacks (where the bottom
 * navigation stays visible) and at the root (the fallback for deep links and
 * root-modal contexts, which renders with no tab bar).
 *
 * Navigating from a modal targets the root copy by default, which drops the
 * footer. This routes those pushes into the owning tab stack instead, so the
 * header and bottom navigation are present wherever you arrive from.
 */
const TAB_FOR_ROUTE: Record<string, string> = {
  UserDetail: 'FeedTab',
  Profile:    'FeedTab',
  CarDetail:  'CarsTab',
  Articles:   'FeedTab',
  Groups:     'FeedTab',
  Members:    'FeedTab',
};

export function navigateInTabs(nav: any, name: string, params?: any) {
  const tab = TAB_FOR_ROUTE[name];
  if (tab) {
    nav.navigate('MainTabs', { screen: tab, params: { screen: name, params } });
  } else {
    nav.navigate(name, params);
  }
}

/**
 * A navigation-shaped object whose `navigate` routes through the tab stacks.
 * Hand this to components that take a navigate callback (tag badges, etc) from
 * inside a modal.
 */
export function tabNavProxy(nav: any) {
  return {
    ...nav,
    navigate: (name: string, params?: any) => navigateInTabs(nav, name, params),
  };
}
