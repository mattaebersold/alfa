import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import SearchOverlay from '../components/search/SearchOverlay';

const SearchContext = createContext<{ openSearch: () => void }>({ openSearch: () => {} });

/**
 * Hosts the one search overlay, at the root.
 *
 * It used to live in `AppHeader`'s own state, which was fine while the only
 * way in was a button in that header. The tab bar is not inside the header —
 * it's a sibling of the whole navigator — so a tab that opens search needs the
 * overlay to be somewhere both can reach.
 *
 * One instance, like the event sheet beside it: two copies would each keep
 * their own query and their own scroll position, and whichever opened second
 * would render over a stale first.
 */
export function SearchProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);

  const openSearch = useCallback(() => setOpen(true), []);
  const value = useMemo(() => ({ openSearch }), [openSearch]);

  return (
    <SearchContext.Provider value={value}>
      {children}
      <SearchOverlay visible={open} onClose={() => setOpen(false)} />
    </SearchContext.Provider>
  );
}

export const useSearch = () => useContext(SearchContext);
