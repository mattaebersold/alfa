import React from 'react';
import { TouchableOpacity, StyleSheet } from 'react-native';
import { Bookmark } from 'lucide-react-native';
import { useGetLoggedInUserQuery, useToggleModelBookmarkMutation } from '../../api/apiService';
import { useBrandColor } from '../../hooks/useBrandColor';

/**
 * Bookmark this model — a round button; filled once it's saved. Bookmarked
 * models are a row in the menu (BookmarkedModelsRow), each straight back here.
 */
export default function ModelBookmarkButton({ make, model, modelHandle, generation, generationHandle, standalone }: {
  make: string;
  model: string;
  modelHandle: string;
  /** On a generation's page, the bookmark is that generation's. */
  generation?: string;
  generationHandle?: string;
  standalone?: boolean;
}) {
  const brand = useBrandColor();
  const { data: me } = useGetLoggedInUserQuery();
  const [toggle] = useToggleModelBookmarkMutation();
  if (!me) return null;

  const genHandle = generation ? (generationHandle ?? null) : null;
  const saved = (me.modelBookmarks ?? []).some(
    (b) => b.model_handle === modelHandle
      && b.make.toLowerCase() === make.toLowerCase()
      && (b.generation_handle || null) === genHandle,
  );
  const label = generation ? (standalone ? `${make} ${generation}` : `${make} ${model} ${generation}`) : `${make} ${model}`;

  return (
    <TouchableOpacity
      style={[styles.btn, saved ? { backgroundColor: brand } : styles.btnOff]}
      onPress={() => toggle({
        make, model, model_handle: modelHandle,
        ...(generation ? { generation, generation_handle: genHandle, standalone: !!standalone } : {}),
      })}
      hitSlop={6}
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityState={{ selected: saved }}
      accessibilityLabel={saved ? `Remove ${label} from bookmarks` : `Bookmark ${label}`}
    >
      <Bookmark size={17} color={saved ? '#000000' : '#FFFFFF'} fill={saved ? '#000000' : 'transparent'} strokeWidth={2.2} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  btn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  btnOff: { backgroundColor: '#2A2A2A' },
});
