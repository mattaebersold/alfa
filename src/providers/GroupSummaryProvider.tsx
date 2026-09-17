import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import GroupSummaryModal from '../components/groups/GroupSummaryModal';
import type { SummaryOrigin } from '../components/ui/SummaryModal';
import { useGetUserGroupsQuery } from '../api/apiService';
import { useAppSelector } from '../store/store';
import { navigateFromOutside } from '../navigation/navigationRef';

type OpenGroup = (groupId: string, origin?: SummaryOrigin | null) => void;

const GroupSummaryContext = createContext<{ openGroup: OpenGroup }>({
  openGroup: () => {},
});

/**
 * The one way into a group from anywhere else in the app.
 *
 * A group's page is for its members. Everywhere that links to a group — a
 * post's attribution, a car's groups, a notification, a banner — goes through
 * here: a member lands on the page, and anyone else gets the group's summary,
 * with Join in it.
 *
 * Membership comes from your own group list, which is cached, so the common
 * case decides instantly. Before that list has loaded the summary is shown —
 * it offers a member the way in too, so the fallback is never a dead end.
 *
 * Hosted at the root, like the event sheet, so a surface that is itself a modal
 * can open it.
 */
export function GroupSummaryProvider({ children }: { children: React.ReactNode }) {
  const myId = useAppSelector((s) => s.auth.userInfo?.user_id);
  const { data: myGroups } = useGetUserGroupsQuery(myId ?? '', { skip: !myId });
  const [open, setOpen] = useState<{ groupId: string; origin?: SummaryOrigin | null } | null>(null);

  const openGroup = useCallback<OpenGroup>((groupId, origin) => {
    const mine = myGroups?.find((g) => g.internal_id === groupId);
    if (mine && (mine.membership?.status ?? 'active') === 'active') {
      navigateFromOutside('GroupDetail', { groupId });
      return;
    }
    setOpen({ groupId, origin });
  }, [myGroups]);

  const value = useMemo(() => ({ openGroup }), [openGroup]);

  return (
    <GroupSummaryContext.Provider value={value}>
      {children}
      <GroupSummaryModal
        groupId={open?.groupId ?? null}
        origin={open?.origin}
        onClose={() => setOpen(null)}
      />
    </GroupSummaryContext.Provider>
  );
}

export const useGroupSummary = () => useContext(GroupSummaryContext);
