import React, { useEffect, useState } from 'react';
import { View, StyleSheet, Alert } from 'react-native';
import { Text } from '../../theme/Text';
import Sheet from '../Sheet';
import FormInput from '../ui/FormInput';
import Button from '../ui/Button';
import MakeModelFields from '../MakeModelFields';
import { FilterChoiceRow, FilterLabel } from '../ui/FilterSummaryRow';
import { useGetProVideoMetaQuery, useUpdateProVideoMutation } from '../../api/apiService';
import { useAppSelector } from '../../store/store';
import { startProVideoUpload, type PickedVideo } from '../../utils/proVideoUpload';
import { formatBytes, formatDuration, type ProVideo, type ProVideoFields } from '../../types/proVideos';
import { COLOR_RED } from '../../constants/config';
import { FONT_INTER } from '../../constants/fonts';
import { useColors } from '../../hooks/useColors';

/**
 * A video's details: title (required), category, the car (make, model,
 * year — all optional) and a description.
 *
 * Two jobs. With `picked`, it's the step between choosing a file and
 * sending it: Upload hands everything to the upload manager and closes —
 * the banner on the Videos pane takes it from there. With `video`, it edits
 * one already posted (the player's owner menu).
 */
export default function ProVideoDetailsSheet({ visible, onClose, picked, video, onSaved }: {
  visible: boolean;
  onClose: () => void;
  picked?: PickedVideo | null;
  video?: ProVideo | null;
  onSaved?: () => void;
}) {
  const colors = useColors();
  const userId = useAppSelector((s) => s.auth.userInfo?.user_id);
  const { data: meta } = useGetProVideoMetaQuery();
  const [updateVideo, { isLoading: saving }] = useUpdateProVideoMutation();
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<string>('other');
  const [make, setMake] = useState('');
  const [model, setModel] = useState('');
  const [year, setYear] = useState('');
  const [description, setDescription] = useState('');

  // Every open starts from the video being edited, or blank for a new one.
  useEffect(() => {
    if (!visible) return;
    setTitle(video?.title ?? picked?.fileName?.replace(/\.[a-z0-9]+$/i, '').replace(/[_-]+/g, ' ').slice(0, 120) ?? '');
    setCategory(video?.category ?? 'other');
    setMake(video?.make ?? '');
    setModel(video?.model ?? '');
    setYear(video?.year ?? '');
    setDescription(video?.description ?? '');
  }, [visible, video, picked]);

  // Too long is refused here, before anything is prepared or sent; size is
  // checked once it's prepared (compression can bring a big file under).
  const tooLong = !!(picked?.durationSecs && meta && picked.durationSecs > meta.max_duration_secs);
  const fields = (): ProVideoFields => ({
    title: title.trim(),
    category,
    make: make.trim() || undefined,
    model: model.trim() || undefined,
    year: /^\d{4}$/.test(year.trim()) ? year.trim() : undefined,
    description: description.trim() || undefined,
  });

  const submit = async () => {
    if (!title.trim()) return;
    if (video) {
      try {
        // Empty strings, not undefined, so a cleared field is cleared on the server.
        const f = fields();
        await updateVideo({
          id: video.internal_id, title: f.title, category: f.category,
          make: f.make ?? '', model: f.model ?? '', year: f.year ?? '', description: f.description ?? '',
        }).unwrap();
        onSaved?.();
        onClose();
      } catch (err: any) {
        Alert.alert("Couldn't save", err?.data?.error ?? 'Try again in a moment.');
      }
      return;
    }
    if (!picked || !userId) return;
    startProVideoUpload(picked, fields(), userId);
    onSaved?.();
    onClose();
  };

  return (
    <Sheet visible={visible} onClose={onClose} title={video ? 'Edit video' : 'Upload a video'} heightRatio={0.88}>
      <View style={styles.body}>
        {picked ? (
          <Text style={[styles.fileLine, { color: colors.grey }]}>
            {[picked.fileName, formatBytes(picked.size), picked.durationSecs ? formatDuration(picked.durationSecs) : null].filter(Boolean).join(' · ')}
          </Text>
        ) : null}
        {tooLong && meta ? (
          <Text style={styles.error}>
            That video is {formatDuration(picked!.durationSecs)} long — the most is {formatDuration(meta.max_duration_secs)}. Trim it and try again.
          </Text>
        ) : null}

        <FilterLabel>Title</FilterLabel>
        <FormInput value={title} onChangeText={setTitle} placeholder="What's it called?" maxLength={120} returnKeyType="next" />

        {meta?.categories?.length ? (
          <FilterChoiceRow<string>
            label="Category"
            options={meta.categories}
            selected={category}
            onSelect={setCategory}
          />
        ) : null}

        <FilterLabel>The car (optional)</FilterLabel>
        <MakeModelFields make={make} model={model} onMakeChange={setMake} onModelChange={setModel} hideMissingLink />
        <FormInput value={year} onChangeText={(t) => setYear(t.replace(/\D/g, '').slice(0, 4))} placeholder="Year" keyboardType="number-pad" maxLength={4} />

        <FilterLabel>Description (optional)</FilterLabel>
        <FormInput value={description} onChangeText={setDescription} placeholder="Tell people about it" multiline maxLength={5000} />

        <View style={styles.footer}>
          <Button
            label={video ? 'Save' : 'Upload'}
            onPress={submit}
            size="full"
            variant="dark"
            loading={saving}
            disabled={!title.trim() || tooLong || (!video && !picked)}
          />
          {!video ? (
            <Text style={[styles.note, { color: colors.grey }]}>
              It uploads in the background — you can leave this screen. Keep the app open for the fastest upload; if it's closed, it picks up where it stopped next time you open it.
            </Text>
          ) : null}
        </View>
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  body: { padding: 16, gap: 10, paddingBottom: 24 },
  fileLine: { fontSize: 12.5, fontFamily: FONT_INTER.medium },
  error: { color: COLOR_RED, fontSize: 13, fontFamily: FONT_INTER.semibold },
  footer: { marginTop: 10, gap: 10 },
  note: { fontSize: 12, lineHeight: 17, textAlign: 'center' },
});
