import React, { useCallback, useLayoutEffect, useState } from 'react';
import { useNavigation, useRoute } from '@react-navigation/native';
import {
  PhotoSpotCreateScreen as KitPhotoSpotCreateScreen, FormSection,
} from '@ors/kit/src/photography';
import type { PhotoSpot } from '@ors/kit';
import PostTagPicker, { type TagItem } from '../../components/social/PostTagPicker';
import { useSyncPostTagsMutation } from '../../api/apiService';

/**
 * Pinning a spot — @ors/kit's form (kit/src/photography/PhotoSpotCreateScreen),
 * shared with the photo app, with alfa's tag picker added under the photos and
 * the tags saved against the spot once it exists.
 */
export default function PhotoSpotCreateScreen() {
  const nav = useNavigation<any>();
  // The point the member held the map at, when that's how they got here — or
  // the spot they're editing, when that's how.
  const params = (useRoute().params as {
    lat?: number; lng?: number; spotId?: string; name?: string; address?: string; pickFor?: { screen: 'Create' };
  } | undefined) ?? undefined;
  const editId = params?.spotId;
  const isEdit = !!editId;
  const droppedPoint = Number.isFinite(params?.lat) && Number.isFinite(params?.lng)
    ? { lat: params!.lat!, lng: params!.lng! }
    : null;

  useLayoutEffect(() => {
    if (isEdit) nav.setOptions({ title: 'Edit Spot' });
  }, [nav, isEdit]);

  // Tags aren't prefilled on an edit — the picker is search-only, and the sync
  // below only runs when something was picked, so what's tagged is left alone.
  const [tags, setTags] = useState<TagItem[]>([]);
  const [syncTags] = useSyncPostTagsMutation();

  const toggleTag = (t: TagItem) =>
    setTags((prev) => prev.some((p) => p.id === t.id && p.kind === t.kind)
      ? prev.filter((p) => !(p.id === t.id && p.kind === t.kind))
      : [...prev, t]);

  const onSaved = useCallback(async (entry: PhotoSpot) => {
    /**
     * Tags go up separately, and their failure isn't the spot's.
     *
     * The spot is saved by this point. If tagging fails there is nothing to
     * roll back and nothing useful to say — the member's spot exists, it just
     * doesn't credit the car they meant to credit, which is fixable by
     * editing. Losing the spot over it would not be.
     */
    const ids = (kind: TagItem['kind']) =>
      tags.filter((t) => t.kind === kind).map((t) => t.id);

    if (tags.length > 0) {
      try {
        await syncTags({
          post_id: entry.internal_id,
          entity_type: 'photospot',
          tagged_users: ids('user'),
          tagged_cars: ids('car'),
          tagged_events: ids('event'),
        }).unwrap();
      } catch {
        // Deliberately silent — see above.
      }
    }

    // Back to the form that asked for a pin, with the pin — it's still in the
    // stack under this one, so this returns to it rather than pushing another.
    if (params?.pickFor?.screen === 'Create') {
      nav.navigate({ name: 'Create', params: { spotId: entry.internal_id, spotTitle: entry.title }, merge: true });
    } else {
      nav.goBack();
    }
  }, [tags, syncTags, nav, params?.pickFor]);

  return (
    <KitPhotoSpotCreateScreen
      spotId={editId}
      initialPoint={droppedPoint}
      initialPlace={params?.name || params?.address ? { name: params.name, address: params.address } : null}
      onSaved={onSaved}
      onUpsell={() => nav.navigate('ProUpsell')}
      extraFields={(
        <FormSection label="Tag people, cars and events">
          <PostTagPicker
            users={tags.filter((t) => t.kind === 'user')}
            cars={tags.filter((t) => t.kind === 'car')}
            events={tags.filter((t) => t.kind === 'event')}
            onToggle={toggleTag}
          />
        </FormSection>
      )}
    />
  );
}
