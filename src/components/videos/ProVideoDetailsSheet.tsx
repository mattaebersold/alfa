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
import { startProVideoUpload, startProVideoReplace, pickProVideo, type PickedVideo } from '../../utils/proVideoUpload';
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
 * one already posted (the player's owner menu): its title, category and
 * description — not the car, which an edit leaves as it was — and "Replace
 * video", which sends a new file to Mux for it. The video keeps playing its
 * current file until the new one is ready, then the server swaps it in, its
 * likes, comments and views carried over.
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

  /** Pick a new file for the video being edited and send it up in the background. */
  const replace = async () => {
    if (!video || !userId) return;
    let next: PickedVideo | null = null;
    try {
      next = await pickProVideo();
    } catch (err: any) {
      Alert.alert("Couldn't open your videos", err?.message ?? 'Check that the app is allowed to see your library.');
      return;
    }
    if (!next) return;
    if (next.durationSecs && meta && next.durationSecs > meta.max_duration_secs) {
      Alert.alert('Too long', `That video is ${formatDuration(next.durationSecs)} long — the most is ${formatDuration(meta.max_duration_secs)}.`);
      return;
    }
    startProVideoReplace(next, video, userId);
    Alert.alert(
      'Uploading the new file',
      "It goes up in the background — its progress is on the Videos tab. This video keeps playing as it is until the new one is ready, then it's swapped in.",
    );
  };
  const replaceStatus = video?.replacement?.status;

  const submit = async () => {
    if (!title.trim()) return;
    if (video) {
      try {
        // Empty strings, not undefined, so a cleared field is cleared on the
        // server. The car isn't sent: an edit leaves it as it was.
        const f = fields();
        await updateVideo({
          id: video.internal_id, title: f.title, category: f.category, description: f.description ?? '',
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

        {/* The car — only when posting; an edit doesn't offer it. */}
        {!video ? (
          <>
            <FilterLabel>The car (optional)</FilterLabel>
            <MakeModelFields make={make} model={model} onMakeChange={setMake} onModelChange={setModel} hideMissingLink />
            <FormInput value={year} onChangeText={(t) => setYear(t.replace(/\D/g, '').slice(0, 4))} placeholder="Year" keyboardType="number-pad" maxLength={4} />
          </>
        ) : null}

        <FilterLabel>Description (optional)</FilterLabel>
        <FormInput value={description} onChangeText={setDescription} placeholder="Tell people about it" multiline maxLength={5000} />

        {/* A new file for it, sent to Mux; swapped in once it's ready. */}
        {video ? (
          <>
            <FilterLabel>Video file</FilterLabel>
            {replaceStatus === 'uploading' || replaceStatus === 'processing' ? (
              <Text style={[styles.note, styles.left, { color: colors.grey }]}>
                {replaceStatus === 'uploading' ? 'A new file is uploading' : 'Mux is getting the new file ready'} — this video keeps playing the current one until it's swapped in.
              </Text>
            ) : replaceStatus === 'errored' ? (
              <Text style={[styles.error]}>
                The new file didn't work{video.replacement?.error?.message ? `: ${video.replacement.error.message}` : ''}. The video is as it was — try another.
              </Text>
            ) : null}
            <Button
              label={replaceStatus === 'uploading' || replaceStatus === 'processing' ? 'Replace with another file' : 'Replace video'}
              onPress={replace}
              size="full"
              variant="outline"
              disabled={video.status !== 'ready'}
            />
          </>
        ) : null}

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
  left: { textAlign: 'left' },
});
