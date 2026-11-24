import React, { useState } from 'react';
import { View, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import LabelPills from './LabelPills';
import CustomLabelSheet, { RESERVED_TYPE_NAMES } from './CustomLabelSheet';
import { useGetPostTaxonomyQuery, useUpdatePostTaxonomyMutation } from '../../api/apiService';
import { useAppSelector } from '../../store/store';
import { POST_TYPES, CREATABLE_POST_TYPES, POST_CATEGORIES, type PostType } from '../../constants/postTypes';

type Option = { key: string; label: string };

/**
 * A post's type, then the type's categories — one choice in two steps, as two
 * rows of pills (LabelPills). Shared by the new-post form and the Edit Post
 * sheet, so the two offer the same choices and look the same.
 *
 * Your own types and categories follow the built-in ones. A custom one's key
 * is its label: that's what the post stores, so everyone reads the same
 * words. Each row ends in "+ New"; long-press one of your own to rename or
 * delete it. Built-ins can't be.
 *
 * Editing, the post's own value always shows as picked even when it's in
 * neither list: a listing or want ad from before those left the form (offered
 * only to that post), one made by an older build, or a name you've since
 * deleted from your list.
 */
export default function PostTypePicker({ type, category, onChange, style }: {
  type: string;
  category: string;
  /** A new type comes with its first category (or none); a category keeps the type. */
  onChange: (next: { type: string; category: string }) => void;
  style?: StyleProp<ViewStyle>;
}) {
  const userId = useAppSelector((s) => s.auth.userInfo?.user_id);
  const { data: taxonomy } = useGetPostTaxonomyQuery(undefined, { skip: !userId });
  const [saveTaxonomy] = useUpdatePostTaxonomyMutation();
  const customTypes = taxonomy?.types ?? [];
  const customCategories = taxonomy?.categories ?? {};
  const asOption = (label: string): Option => ({ key: label, label });

  const typeOptions: Option[] = [
    ...CREATABLE_POST_TYPES.map(({ type: key, label }) => ({ key: key as string, label })),
    ...customTypes.map(asOption),
  ];
  if (type && !typeOptions.some((t) => t.key === type)) {
    // A legacy type leads, so an old listing shows what it is.
    const legacy = POST_TYPES.find((t) => t.type === type);
    if (legacy) typeOptions.unshift({ key: legacy.type, label: legacy.label });
    else typeOptions.push(asOption(type));
  }

  const categoriesFor = (t: string): Option[] => [
    ...(POST_CATEGORIES[t as PostType] ?? []),
    ...(customCategories[t] ?? []).map(asOption),
  ];
  const categories = categoriesFor(type);
  if (category && !categories.some((c) => c.key === category)) categories.push(asOption(category));

  const isCustomType = (t: string) => customTypes.includes(t);
  const isCustomCategory = (c: string) => (customCategories[type] ?? []).includes(c);
  const pickType = (t: string) => onChange({ type: t, category: categoriesFor(t)[0]?.key ?? '' });

  /** The naming sheet: adding a type or category, or editing one of yours. */
  const [sheet, setSheet] = useState<{ what: 'type' | 'category'; editing?: string } | null>(null);
  const close = () => setSheet(null);

  const save = (label: string) => {
    if (!sheet) return;
    const types = [...customTypes];
    const cats: Record<string, string[]> = { ...customCategories };
    const { what, editing } = sheet;
    if (what === 'type') {
      if (editing) {
        types[types.indexOf(editing)] = label;
        // Its categories go with it to the new name.
        if (cats[editing]) { cats[label] = cats[editing]; delete cats[editing]; }
        if (type === editing) onChange({ type: label, category });
      } else {
        types.push(label);
        onChange({ type: label, category: '' });
      }
    } else {
      const list = [...(cats[type] ?? [])];
      if (editing) list[list.indexOf(editing)] = label; else list.push(label);
      cats[type] = list;
      if (!editing || category === editing) onChange({ type, category: label });
    }
    saveTaxonomy({ types, categories: cats });
    close();
  };

  const remove = () => {
    const editing = sheet?.editing;
    if (!sheet || !editing) return;
    const cats: Record<string, string[]> = { ...customCategories };
    let types = customTypes;
    if (sheet.what === 'type') {
      types = customTypes.filter((t) => t !== editing);
      delete cats[editing];
      if (type === editing) pickType('general');
    } else {
      cats[type] = (cats[type] ?? []).filter((c) => c !== editing);
      if (category === editing) onChange({ type, category: POST_CATEGORIES[type as PostType]?.[0]?.key ?? '' });
    }
    saveTaxonomy({ types, categories: cats });
    close();
  };

  return (
    <View style={style}>
      <LabelPills
        tone="type"
        options={typeOptions}
        value={type}
        onChange={pickType}
        onLongPress={(t) => { if (isCustomType(t)) setSheet({ what: 'type', editing: t }); }}
        onAdd={() => setSheet({ what: 'type' })}
        addLabel="New post type"
      />
      {/* Shown even when the type has none yet, for its "+ New". */}
      <LabelPills
        tone="category"
        options={categories}
        value={category}
        onChange={(c) => onChange({ type, category: c })}
        onLongPress={(c) => { if (isCustomCategory(c)) setSheet({ what: 'category', editing: c }); }}
        onAdd={() => setSheet({ what: 'category' })}
        addLabel="New category"
        style={styles.categories}
      />

      <CustomLabelSheet
        visible={sheet !== null}
        title={sheet?.what === 'type'
          ? (sheet.editing ? 'Edit post type' : 'New post type')
          : (sheet?.editing ? 'Edit category' : `New ${typeOptions.find((t) => t.key === type)?.label ?? ''} category`)}
        placeholder={sheet?.what === 'type' ? 'e.g. Track Day' : 'e.g. Wheels'}
        note="Saved to your list for next time. Your post shows it to everyone."
        initial={sheet?.editing ?? ''}
        taken={sheet?.what === 'type' ? [...typeOptions.map((t) => t.label), ...RESERVED_TYPE_NAMES] : categories.map((c) => c.label)}
        onSave={save}
        onDelete={sheet?.editing ? remove : undefined}
        onClose={close}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  // A clear gap between the type row and its categories.
  categories: { marginTop: 16 },
});
