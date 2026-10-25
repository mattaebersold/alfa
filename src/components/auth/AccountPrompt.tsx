import React, { useEffect, useRef, useState } from 'react';
import {
  View, StyleSheet, TouchableOpacity, Modal, ScrollView, ActivityIndicator,
} from 'react-native';
import { Text, TextInput } from '@ors/kit';
import { KeyboardAvoidingView } from '@ors/kit';
import { BlurView } from 'expo-blur';
import { Image } from 'expo-image';
import { Camera, Check, ImageIcon } from 'lucide-react-native';
import {
  useGetLoggedInUserQuery, useCheckUsernameMutation, useUpdateUserSettingMutation,
} from '../../api/apiService';
import { useFeedPreferences } from '../../hooks/useFeedPreferences';
import { pickProfilePhoto, useSaveProfilePhoto } from '../members/ProfileSetupSheets';
import Avatar from '../ui/Avatar';
import { validateZip, sanitizeZip } from '../../utils/zip';
import { validateUsername, sanitizeUsername } from '../../utils/username';
import { useColors } from '../../hooks/useColors';
import { ss } from '../../styles/shared';
import type { User } from '../../types/api';
import { FONT_INTER } from '../../constants/fonts';
import {
  COLOR_BLACK, COLOR_ERROR_TEXT_LIGHT, COLOR_GREEN, COLOR_WHITE,
} from '../../constants/config';

/** An account this young, with no zip, is one Google or Apple just made. */
const NEW_ACCOUNT_MS = 24 * 60 * 60 * 1000;
/** How long typing has to pause before a username is checked. */
const CHECK_DELAY_MS = 400;
/** Long enough to read the last ✓ before the card goes. */
const CLOSE_AFTER_DONE_MS = 1200;
const PREVIEW = 80;

type Section = 'photo' | 'username' | 'zip';

/**
 * What the registration form would have asked, over the app, once.
 *
 * Google and Apple sign-ins never pass through that form. They arrive with no
 * zip — nothing to measure "near you" from — and with a made-up name like
 * `hd6kktm2sc_404` (the server's `hasTempUsername`). Anyone, however they
 * joined, may have no photo. This is one card with a section for each of
 * those still missing; the rest are left out.
 *
 * Each section saves on its own, in place, and says so with a ✓ — nothing
 * waits for a final submit. Once every section is done the card closes itself.
 *
 * The sections are fixed when the card opens. Saving one refetches the
 * profile, which stops it being "missing" — read live, it would vanish the
 * moment it was saved instead of showing that it worked.
 *
 * The zip is the one that can't be skipped: without it the member is filed
 * under no region and "near you" has nothing to measure from. So "Not now"
 * only appears once there's no zip left to ask for, and the card comes back
 * on every launch until there is. The photo and username can be put off, for
 * good — they're written to the account's dismissed setup prompts, so they
 * hold on every device (and the menu's setup card reads the same 'photo').
 */
export default function AccountPrompt() {
  const { data: user } = useGetLoggedInUserQuery();
  const { dismissedSetupPrompts, dismissSetupPrompt } = useFeedPreferences();
  const [sections, setSections] = useState<Section[] | null>(null);
  const [done, setDone] = useState<Set<Section>>(new Set());
  const [closed, setClosed] = useState(false);

  const created = user?.created_at ? new Date(user.created_at).getTime() : 0;
  const isNew = Date.now() - created < NEW_ACCOUNT_MS;

  // Decide once, when everything it depends on is known.
  useEffect(() => {
    if (sections || !user) return;
    const next: Section[] = [];
    if (!user.gallery?.length && !user.profilePicture && !dismissedSetupPrompts.includes('photo')) {
      next.push('photo');
    }
    if (user.hasTempUsername === true && !dismissedSetupPrompts.includes('username')) next.push('username');
    // `false`, not falsy: a server that predates the flag sends nothing.
    if (user.hasZip === false) next.push('zip');
    setSections(next);
  }, [sections, user, dismissedSetupPrompts]);

  const markDone = (s: Section) => setDone((prev) => new Set(prev).add(s));

  const close = () => {
    setClosed(true);
    for (const s of sections ?? []) {
      // The zip is never put off — "Not now" isn't offered until it's in.
      if (s !== 'zip' && !done.has(s)) dismissSetupPrompt(s);
    }
  };

  const allDone = !!sections?.length && sections.every((s) => done.has(s));
  const closeRef = useRef(close);
  closeRef.current = close;
  useEffect(() => {
    if (!allDone) return;
    const t = setTimeout(() => closeRef.current(), CLOSE_AFTER_DONE_MS);
    return () => clearTimeout(t);
  }, [allDone]);

  if (!user || closed || !sections?.length) return null;

  const zipRequired = sections.includes('zip') && !done.has('zip');
  const only = sections.length === 1 ? sections[0] : null;
  const title =
    only === 'zip' ? (isNew ? 'Add your zip code to finish registering' : 'Add your zip code')
    : only === 'photo' ? 'Add a profile photo'
    : only === 'username' ? 'Choose your username'
    : isNew && sections.includes('zip') ? 'Finish registering'
    : 'Finish setting up your profile';

  return (
    <Modal visible transparent animationType="fade" onRequestClose={() => !zipRequired && close()}>
      <KeyboardAvoidingView style={styles.backdrop}>
        <BlurView intensity={40} tint="dark" style={styles.card}>
          <ScrollView
            bounces={false}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.content}
          >
            <Text style={styles.title}>{title}</Text>

            {sections.includes('photo') && (
              <PhotoSection user={user} done={done.has('photo')} onDone={() => markDone('photo')} />
            )}
            {sections.includes('username') && (
              <UsernameSection user={user} done={done.has('username')} onDone={() => markDone('username')} />
            )}
            {sections.includes('zip') && (
              <ZipSection done={done.has('zip')} onDone={() => markDone('zip')} />
            )}

            {!zipRequired && !allDone && (
              <TouchableOpacity style={styles.later} onPress={close} activeOpacity={0.7}>
                <Text style={styles.laterLabel}>Not now</Text>
              </TouchableOpacity>
            )}
          </ScrollView>
        </BlurView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

/** Picking a photo uploads it — there's no separate save. */
function PhotoSection({ user, done, onDone }: { user: User; done: boolean; onDone: () => void }) {
  const { save, uploading } = useSaveProfilePhoto();
  const [photo, setPhoto] = useState<string | null>(null);

  const pick = async (source: 'library' | 'camera') => {
    const uri = await pickProfilePhoto(source);
    if (!uri) return;
    setPhoto(uri);
    if (await save(uri)) onDone();
  };

  return (
    <View style={styles.section}>
      <View style={styles.photo}>
        <View>
          {photo
            ? <Image source={{ uri: photo }} style={styles.preview} contentFit="cover" />
            : <Avatar user={user} size={PREVIEW} />}
          {uploading && (
            <View style={styles.previewBusy}><ActivityIndicator color={COLOR_WHITE} /></View>
          )}
        </View>
        {done ? (
          <Success text="Photo added" />
        ) : (
          <>
            <Text style={styles.hint}>Add a profile photo so members know who they're talking to.</Text>
            <View style={styles.pickRow}>
              <TouchableOpacity style={styles.pickBtn} onPress={() => pick('library')} disabled={uploading} activeOpacity={0.75}>
                <ImageIcon size={15} color={COLOR_WHITE} />
                <Text style={styles.pickText}>{photo ? 'Choose another' : 'Choose a photo'}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.pickBtn} onPress={() => pick('camera')} disabled={uploading} activeOpacity={0.75}>
                <Camera size={15} color={COLOR_WHITE} />
                <Text style={styles.pickText}>Take one</Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </View>
    </View>
  );
}

function UsernameSection({ user, done, onDone }: { user: User; done: boolean; onDone: () => void }) {
  const c = useColors();
  const [checkUsername] = useCheckUsernameMutation();
  const [updateSetting, { isLoading }] = useUpdateUserSettingMutation();
  const [username, setUsername] = useState('');
  const [error, setError] = useState<string | null>(null);
  /** The name the last availability check was for, and its answer. */
  const [checked, setChecked] = useState<{ name: string; free: boolean } | null>(null);

  const name = username.trim();
  const problem = name ? validateUsername(name) : null;

  // Checked as they type, so "taken" arrives before Set rather than after.
  useEffect(() => {
    if (!name || problem || done) return;
    let live = true;
    const t = setTimeout(() => {
      checkUsername({ username: name }).unwrap()
        .then(({ msg }) => { if (live) setChecked({ name, free: msg !== 'true' }); })
        .catch(() => {});
    }, CHECK_DELAY_MS);
    return () => { live = false; clearTimeout(t); };
  }, [name, problem, done, checkUsername]);

  const taken = checked?.name === name && !checked.free;
  const canSave = !!name && !problem && !taken && !isLoading;

  const save = async () => {
    if (!canSave) return;
    // The check above is a courtesy; the server's own (case-insensitive) is
    // the one that counts, and answers 409 when it's taken.
    try {
      await updateSetting({ type: 'username', userid: user.user_id, username: name }).unwrap();
      onDone();
    } catch (e: any) {
      setError(e?.data?.error ?? "Couldn't change your username. Try again.");
    }
  };

  return (
    <View style={styles.section}>
      <Text style={styles.label}>Username</Text>
      {done ? (
        <Success text={`Your username is now @${name}`} />
      ) : (
        <>
          <Text style={styles.hint}>
            {user.tempUsernameFrom === 'google' ? 'Signing in with Google' : 'Logging in with Apple'} generates a temporary username. If you want to change it, you can do that here.
          </Text>
          <View style={styles.inline}>
            <TextInput
              style={[ss.input, styles.inlineInput, { borderColor: c.inputBorder, color: c.fg, backgroundColor: c.inputBg }]}
              value={username}
              onChangeText={(v) => { setUsername(sanitizeUsername(v)); setError(null); }}
              placeholder={user.username}
              placeholderTextColor={c.grey}
              autoCapitalize="none"
              autoCorrect={false}
              textContentType="username"
              returnKeyType="done"
              onSubmitEditing={save}
            />
            <SetButton label="Set" onPress={save} disabled={!canSave} loading={isLoading} />
          </View>
          {(error || problem || taken) ? (
            <Text style={styles.error}>{error ?? problem ?? 'That username is already taken.'}</Text>
          ) : checked?.name === name && name ? (
            <Text style={styles.available}>@{name} is available</Text>
          ) : null}
        </>
      )}
    </View>
  );
}

function ZipSection({ done, onDone }: { done: boolean; onDone: () => void }) {
  const c = useColors();
  const [updateSetting, { isLoading }] = useUpdateUserSettingMutation();
  const [zip, setZip] = useState('');
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    const problem = validateZip(zip);
    if (problem) { setError(problem); return; }
    try {
      await updateSetting({ type: 'zip', zip: zip.trim() }).unwrap();
      onDone();
    } catch (e: any) {
      setError(e?.data?.error ?? "Couldn't save your zip code. Try again.");
    }
  };

  return (
    <View style={styles.section}>
      <Text style={styles.label}>Zip Code</Text>
      {done ? (
        <Success text="Zip code saved" />
      ) : (
        <>
          <Text style={styles.hint}>
            Used to find members, events, and marketplace items near you. Never shown to anyone.
          </Text>
          <View style={styles.inline}>
            <TextInput
              style={[ss.input, styles.inlineInput, { borderColor: c.inputBorder, color: c.fg, backgroundColor: c.inputBg }]}
              value={zip}
              onChangeText={(v) => { setZip(sanitizeZip(v)); setError(null); }}
              keyboardType="number-pad"
              textContentType="postalCode"
              autoComplete="postal-code"
              maxLength={5}
              returnKeyType="done"
              onSubmitEditing={save}
            />
            <SetButton label="Save" onPress={save} disabled={zip.length !== 5 || isLoading} loading={isLoading} />
          </View>
          {error && <Text style={styles.error}>{error}</Text>}
        </>
      )}
    </View>
  );
}

function SetButton({ label, onPress, disabled, loading }: {
  label: string; onPress: () => void; disabled: boolean; loading: boolean;
}) {
  return (
    <TouchableOpacity
      style={[styles.setBtn, disabled && styles.setBtnDisabled]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.8}
    >
      {loading ? <ActivityIndicator size="small" color={COLOR_BLACK} /> : <Text style={styles.setText}>{label}</Text>}
    </TouchableOpacity>
  );
}

function Success({ text }: { text: string }) {
  return (
    <View style={styles.success}>
      <Check size={16} color={COLOR_GREEN} strokeWidth={3} />
      <Text style={styles.successText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingVertical: 48,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  card: {
    flexShrink: 1,
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  content: { padding: 18 },
  title: { fontSize: 18, fontFamily: FONT_INTER.bold, color: COLOR_WHITE, marginBottom: 4 },
  section: { marginTop: 16 },
  label: { fontSize: 12, fontFamily: FONT_INTER.semibold, marginBottom: 4, color: COLOR_WHITE },
  hint: { fontSize: 13, lineHeight: 19, color: 'rgba(255,255,255,0.75)', marginBottom: 10 },
  error: { fontSize: 11, marginTop: 5, lineHeight: 15, color: COLOR_ERROR_TEXT_LIGHT, fontFamily: FONT_INTER.semibold },
  available: { fontSize: 11, marginTop: 5, lineHeight: 15, color: 'rgba(255,255,255,0.7)', fontFamily: FONT_INTER.semibold },

  inline: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  inlineInput: { flex: 1, borderWidth: 1.5 },
  setBtn: {
    minWidth: 64, height: 44, paddingHorizontal: 14, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center', backgroundColor: COLOR_WHITE,
  },
  setBtnDisabled: { opacity: 0.4 },
  setText: { fontSize: 14, fontFamily: FONT_INTER.bold, color: COLOR_BLACK },

  success: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 4 },
  successText: { fontSize: 14, fontFamily: FONT_INTER.semibold, color: COLOR_WHITE },

  photo: { alignItems: 'center', gap: 10 },
  preview: { width: PREVIEW, height: PREVIEW, borderRadius: PREVIEW / 2 },
  previewBusy: {
    ...StyleSheet.absoluteFill, borderRadius: PREVIEW / 2,
    alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.45)',
  },
  pickRow: { flexDirection: 'row', gap: 8 },
  pickBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingVertical: 8, paddingHorizontal: 12, borderRadius: 999,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.35)',
  },
  pickText: { fontSize: 13, fontFamily: FONT_INTER.semibold, color: COLOR_WHITE },

  later: { alignSelf: 'center', marginTop: 16, paddingVertical: 6, paddingHorizontal: 16 },
  laterLabel: { fontSize: 14, fontFamily: FONT_INTER.semibold, color: 'rgba(255,255,255,0.7)' },
});
