import type { ModelBookmark } from '../types/api';

/** A bookmark's title — "Porsche 993", "Volkswagen Jetta Mk2", or just "Porsche 911". */
export function bookmarkTitle(b: ModelBookmark): string {
  if (!b.generation) return `${b.make} ${b.model}`;
  return b.standalone ? `${b.make} ${b.generation}` : `${b.make} ${b.model} ${b.generation}`;
}

/** The ModelDetail params a bookmark opens — its generation's page when it has one. */
export function bookmarkRoute(b: ModelBookmark) {
  return {
    brand: b.make,
    model: b.model,
    modelHandle: b.model_handle,
    ...(b.generation ? { generation: b.generation, generationHandle: b.generation_handle ?? undefined, standalone: !!b.standalone } : {}),
  };
}
