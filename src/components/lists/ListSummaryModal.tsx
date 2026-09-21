import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import SummaryModal, { useSummaryPanel, type SummaryOrigin } from '../ui/SummaryModal';
import Spinner from '../ui/Spinner';
import ListSummaryContent from './ListSummaryContent';
import { useStackedUserSummary } from '../members/useStackedUserSummary';
import { useGetListQuery } from '../../api/apiService';
import { useAppSelector } from '../../store/store';
import { useColors } from '../../hooks/useColors';
import type { List } from '../../types/api';

/**
 * The list, inside the panel.
 *
 * Its own component for one reason: `useSummaryPanel()` answers with the panel
 * the *caller* is inside, so it has to be called from the panel's contents.
 * Called from ListSummaryModal itself it would find nothing (or, stacked, the
 * wrong panel) — and the car row needs this one, to close it before pushing.
 */
function PanelBody({ list, hideCar, onOpenUser }: {
  list: List;
  hideCar?: boolean;
  onOpenUser: (userId: string, origin: SummaryOrigin | null) => void;
}) {
  const nav = useNavigation<any>();
  const panel = useSummaryPanel();

  return (
    <ListSummaryContent
      list={list}
      hideCar={hideCar}
      onOpenUser={onOpenUser}
      // Close, *then* push. A screen pushed while the panel is up opens
      // underneath it, and iOS won't present over a modal mid-dismissal.
      onOpenCar={(carId) => {
        const go = () => nav.navigate('CarDetail', { carId });
        if (panel) panel.closeThen(go); else go();
      }}
    />
  );
}

/**
 * A list, answered in place.
 *
 * A list on a profile is a title and a count; what's on it is the whole point,
 * and finding out used to mean leaving the profile for a screen and coming
 * back. This opens it over whatever you were reading — a profile, a car's
 * page — the same way a group or a listing does.
 *
 * Open to everyone. Making lists is the Pro feature; reading one never was.
 *
 * The author gets Edit as the panel's button. Nobody else gets a button at
 * all: there's no fuller page to "view more" of — the panel *is* the list.
 */
export default function ListSummaryModal({ listId, origin, onClose, hideCar }: {
  /** The list to show. `null` closes the panel. */
  listId: string | null;
  /** The card that was tapped — the panel grows out of it. */
  origin?: SummaryOrigin | null;
  onClose: () => void;
  /** Set on a car's own page, where naming the car again is noise. */
  hideCar?: boolean;
}) {
  const colors = useColors();
  const nav = useNavigation<any>();
  const myId = useAppSelector((s) => s.auth.userInfo?.user_id);

  const { data: list, isLoading, isError } = useGetListQuery(listId ?? '', { skip: !listId });

  // The author's summary opens over this one rather than replacing it, so you
  // can see who wrote the list and still be in it.
  const { openUser, stacked } = useStackedUserSummary(!!listId);

  const isMine = !!list && !!myId && list.user_id === myId;

  return (
    <SummaryModal
      visible={!!listId}
      onClose={onClose}
      origin={origin}
      actionLabel="Edit list"
      // Runs once the panel has finished closing — see SummaryModal.
      onAction={isMine && listId ? () => nav.navigate('EditList', { listId }) : undefined}
      stacked={stacked}
    >
      {isError ? (
        // A list deleted or made private between the card rendering and the
        // tap. Sized like the loading state so the panel doesn't open as a sliver.
        <View style={styles.loading}>
          <Text style={[styles.gone, { color: colors.grey }]}>This list isn't available.</Text>
        </View>
      ) : isLoading || !list ? (
        // Reserved height rather than a bare spinner: the panel takes its size
        // from its content, so an unsized loading state opens as a sliver.
        <View style={styles.loading}><Spinner /></View>
      ) : (
        <PanelBody list={list} hideCar={hideCar} onOpenUser={openUser} />
      )}
    </SummaryModal>
  );
}

const styles = StyleSheet.create({
  loading: { height: 240, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  gone:    { fontSize: 14, fontWeight: '600', textAlign: 'center' },
});
