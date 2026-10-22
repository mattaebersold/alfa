import React from 'react';
import { Image } from 'expo-image';
import { useGetUserGarageQuery } from '../../api/apiService';
import { carHeroUrl } from '../../utils/image';
import type { GarageCar } from '../../types/api';
import type { TagItem } from './PostTagPicker';
import TagCardStrip from './TagCardStrip';

export const garageCarTag = (car: GarageCar): TagItem => ({
  id: car.internal_id,
  label: car.title || [car.year, car.make, car.model].filter(Boolean).join(' ') || 'Car',
  kind: 'car',
});

/**
 * Your own cars, as a row of thumbnails you tap to tag.
 *
 * Tagging one of your own cars is by far the commonest case, and the search
 * field made you type the name of a car you own to find it. These are the same
 * tags — tapping one is exactly what picking it out of the search results does
 * — so the field below is left to do what it's actually good for: finding
 * someone *else's* car.
 */
export default function GarageCarStrip({
  selectedIds,
  onToggle,
  bleed = 0,
}: {
  selectedIds: string[];
  onToggle: (tag: TagItem) => void;
  /** See TagCardStrip. */
  bleed?: number;
}) {
  const { data } = useGetUserGarageQuery();
  const cards = (data?.entries ?? []).map((car) => ({
    tag: garageCarTag(car),
    image: carHeroUrl(car),
    // A car with no photo gets the stock one, filling the tile like a photo would.
    fallback: <Image source={require('../../../assets/car-placeholder.jpg')} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} contentFit="cover" />,
  }));
  return <TagCardStrip cards={cards} selectedIds={selectedIds} onToggle={onToggle} bleed={bleed} />;
}
