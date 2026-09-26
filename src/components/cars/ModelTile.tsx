import React from 'react';
import MakeTile from './MakeTile';
import { useGetCarsQuery } from '../../api/apiService';

/**
 * A model's tile, with photos of that model's own cars. The server sends a
 * random few with the models list; where there are none to hand — a server
 * that predates that, or a bookmark, which carries no photos — the tile asks
 * for the model's first three cars itself.
 */
export default function ModelTile({ brand, modelHandle, generationHandle, photos, ...tile }: React.ComponentProps<typeof MakeTile> & {
  brand: string;
  modelHandle: string;
  /** One generation's cars' photos, for a generation's tile. */
  generationHandle?: string | null;
}) {
  const needOwn = !photos?.length;
  const { data } = useGetCarsQuery(
    { page: 0, limit: 3, make: brand.toLowerCase(), model: modelHandle, ...(generationHandle ? { generation: generationHandle } : {}) },
    { skip: !needOwn },
  );
  const own = (data?.entries ?? [])
    .map((c) => c.profile_image || c.gallery?.[0]?.filename)
    .filter((f): f is string => !!f);
  return <MakeTile {...tile} photos={needOwn ? own : photos} />;
}
