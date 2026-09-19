import React, { useEffect, useState } from 'react';
import ListingSummaryModal from '../../components/marketplace/ListingSummaryModal';
import { useGetListingQuery } from '../../api/apiService';
import type { AppScreenProps } from '../../navigation/types';

/**
 * One listing, opened from outside the marketplace.
 *
 * The marketplace screen shows a listing as a panel over its own list, which
 * needs no route. A notification tap has nowhere to open a panel *over*, so it
 * needs a destination — this is that destination, and it draws the same panel
 * so the two ways in look identical.
 *
 * ## Legacy ids
 *
 * The migration out of Post hasn't run, so a notification that's a few weeks
 * old points at a post that *was* a listing, and the listing endpoint has never
 * heard of it. Rather than showing "not found" for something that plainly
 * exists, a 404 hands the id to the post detail screen, which is where that
 * record still lives. Anything else (a real deletion, a network failure) leaves
 * the panel to say so itself and the back gesture to close it.
 */
export default function ListingDetailModalScreen({ navigation, route }: AppScreenProps<'ListingDetailModal'>) {
  const { listingId } = route.params;
  const { error } = useGetListingQuery(listingId, { skip: !listingId });
  /** Cleared on close so the panel animates out before the screen pops. */
  const [open, setOpen] = useState(true);

  const status = (error as { status?: number } | undefined)?.status;
  useEffect(() => {
    if (status !== 404) return;
    // `replace`, not navigate: the listing route should not sit in the stack
    // behind a post that answered for it.
    navigation.replace('PostDetailModal', { postId: listingId });
  }, [status, listingId, navigation]);

  return (
    <ListingSummaryModal
      listingId={open && status !== 404 ? listingId : null}
      onClose={() => {
        setOpen(false);
        navigation.goBack();
      }}
    />
  );
}
