import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator,
} from 'react-native';
import AutocompleteField from '../ui/AutocompleteField';
import SharedModal from '../ui/SharedModal';
import { useColors } from '../../hooks/useColors';
import { useBrandColor } from '../../hooks/useBrandColor';
import { COMMON_RADIUS } from '../../constants/radius';
import {
  useGetCarMakeOptionsQuery, useGetCarModelOptionsQuery, useRequestCarModelMutation,
} from '../../api/apiService';

/** How two spellings are compared: "porsche " is "Porsche". */
const norm = (s: string) => s.trim().replace(/\s+/g, ' ').toLowerCase();

/**
 * Make and model, picked from the reference list of every make and model.
 *
 * The two fields are paired because the second depends on the first: models
 * are fetched for the chosen make, so picking "Porsche" turns the model field
 * into a list of Porsches, and there is no model field to type into until a
 * make is picked.
 *
 * Picked, not typed. These used to be free text with suggestions, and free text
 * is how the same car arrived as "Porsche", "porsche " and "Posrche" — which
 * splits brand pages, group matching and search. So the box and the value are
 * kept apart: typing filters the list, and `make`/`model` only ever hold a
 * listed name. Text that isn't one (or isn't one *yet*) leaves the value empty,
 * which is what keeps Next/Save off, and the field says why. Typing a listed
 * name in full counts as picking it, so nobody has to tap a row that says
 * exactly what they typed.
 *
 * One exception, for editing: a car saved before this may hold a make or model
 * that isn't on the list. It's shown and kept as it is — refusing to save a
 * car's paint colour until its make is re-picked would be a trap — right up
 * until that field is edited, from when it's held to the list like any other.
 */
export default function MakeModelFields({
  make,
  model,
  onMakeChange,
  onModelChange,
  required = false,
  style,
  inputStyle,
}: {
  make: string;
  model: string;
  onMakeChange: (v: string) => void;
  onModelChange: (v: string) => void;
  required?: boolean;
  style?: any;
  inputStyle?: any;
}) {
  const colors = useColors();
  const [asking, setAsking] = useState(false);

  const {
    data: makes = [], isLoading: makesLoading, isError: makesFailed, refetch: refetchMakes,
  } = useGetCarMakeOptionsQuery();
  /**
   * The chosen make's models.
   *
   * Keyed on the committed make, not the box, so it's asked once per pick
   * rather than once per keystroke. `currentData`, not `data`: while a new
   * make's list is on its way, `data` is still the last make's, and a model
   * typed in that moment would be matched against the wrong car.
   */
  const {
    currentData: models, isFetching: modelsLoading,
  } = useGetCarModelOptionsQuery(make.trim(), { skip: !make.trim() });
  const modelList = models ?? [];

  // What's in each box. `make` and `model` are what's been picked.
  const [makeText, setMakeText] = useState(make);
  const [modelText, setModelText] = useState(model);
  // Red waits until you've left the field once: "not on the list" shouted
  // after the first letter is nagging, not help.
  const [makeTouched, setMakeTouched] = useState(false);
  const [modelTouched, setModelTouched] = useState(false);

  /**
   * The values this component last handed up.
   *
   * A change to `make` that isn't one of ours came from outside — an edit
   * screen's car arriving, a draft being cleared — and the box should show it.
   * One that is ours is only the echo of what's already in the box, and
   * copying it back would wipe what's being typed.
   */
  const sentMake = useRef(make);
  const sentModel = useRef(model);
  /**
   * The model set aside while the make is being retyped.
   *
   * Editing the make empties it, so the model goes too — a model with no make
   * isn't a car. But backspacing "Porsche" to fix a letter and landing back on
   * "Porsche" shouldn't cost you the 911: picking the same make again puts it
   * back, and picking a different one drops it.
   */
  const parked = useRef<{ make: string; model: string } | null>(null);

  useEffect(() => {
    if (make === sentMake.current) return;
    sentMake.current = make;
    parked.current = null;
    setMakeText(make);
    setMakeTouched(false);
  }, [make]);

  useEffect(() => {
    if (model === sentModel.current) return;
    sentModel.current = model;
    setModelText(model);
    setModelTouched(false);
  }, [model]);

  const sendMake = (v: string) => {
    if (v === make) return;
    sentMake.current = v;
    onMakeChange(v);
  };
  const sendModel = (v: string) => {
    if (v === model) return;
    sentModel.current = v;
    onModelChange(v);
  };

  const listedMake = (t: string) => makes.find((m) => norm(m) === norm(t));
  const listedModel = (t: string) => modelList.find((m) => norm(m) === norm(t));

  const chooseMake = (v: string) => {
    const back = parked.current;
    parked.current = null;
    sendMake(v);
    if (back && norm(back.make) === norm(v)) {
      sendModel(back.model);
    } else if (norm(v) !== norm(make)) {
      // The old model belonged to the old make.
      sendModel('');
      setModelText('');
      setModelTouched(false);
    }
  };

  const typeMake = (t: string) => {
    setMakeText(t);
    const hit = listedMake(t);
    if (hit) { chooseMake(hit); return; }
    if (make) {
      parked.current = { make, model };
      sendModel('');
      sendMake('');
    }
  };

  const typeModel = (t: string) => {
    setModelText(t);
    sendModel(listedModel(t) ?? '');
  };

  /**
   * A name typed before its list arrived.
   *
   * Typed matches are checked per keystroke, and a keystroke that lands before
   * the list does finds nothing to match — so "BMW", typed in full on a slow
   * connection, would sit unpicked. Checked again once the list is in.
   */
  useEffect(() => {
    if (!make && makeText.trim()) {
      const hit = listedMake(makeText);
      if (hit) chooseMake(hit);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [makes]);

  useEffect(() => {
    if (make && !model && modelText.trim()) {
      const hit = listedModel(modelText);
      if (hit) sendModel(hit);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [models]);

  // ── What each field says under itself ──────────────────────────────────────

  const makeTyped = !!makeText.trim();
  const makeNoMatch = makeTyped && makes.length > 0
    && !makes.some((m) => m.toLowerCase().includes(makeText.trim().toLowerCase()));
  let makeMessage: string | undefined;
  let makeInvalid = false;
  if (makesFailed && makes.length === 0) {
    // Retried when the field is left (see onBlur), so there's something to do
    // about it other than closing the form.
    makeMessage = "Couldn't load the list of makes. Check your connection, then tap in and out of the field to retry.";
    makeInvalid = true;
  } else if (!make && makeTyped) {
    if (makesLoading) {
      makeMessage = 'Loading makes…';
    } else if (makeNoMatch) {
      makeMessage = `No make on our list matches "${makeText.trim()}".`;
      makeInvalid = true;
    } else {
      // Said while typing too, quietly — a disabled Next with no reason next
      // to it is the thing this is meant to avoid. Red once you've moved on.
      makeMessage = 'Choose a make from the list.';
      makeInvalid = makeTouched;
    }
  } else if (!make && required && makeTouched) {
    makeMessage = 'Choose a make from the list.';
    makeInvalid = true;
  } else if (make && makes.length > 0 && !listedMake(make)) {
    makeMessage = `"${make.trim()}" isn't on our list. It stays as saved unless you change it.`;
  }

  const modelTyped = !!modelText.trim();
  const modelsIn = !!make && models !== undefined && !modelsLoading;
  let modelMessage: string | undefined;
  let modelInvalid = false;
  if (!make) {
    // Nothing to say: the placeholder already asks for a make first.
  } else if (modelsIn && modelList.length === 0 && (modelTyped || modelTouched) && !model) {
    modelMessage = `We have no models listed for ${make.trim()}. Choose another make, or tell us what's missing below.`;
    modelInvalid = true;
  } else if (!model && modelTyped) {
    if (!modelsIn) {
      modelMessage = 'Loading models…';
    } else if (!modelList.some((m) => m.toLowerCase().includes(modelText.trim().toLowerCase()))) {
      modelMessage = `No ${make.trim()} model on our list matches "${modelText.trim()}".`;
      modelInvalid = true;
    } else {
      modelMessage = 'Choose a model from the list.';
      modelInvalid = modelTouched;
    }
  } else if (!model && required && modelTouched) {
    modelMessage = 'Choose a model from the list.';
    modelInvalid = true;
  } else if (model && modelsIn && !listedModel(model)) {
    modelMessage = `"${model.trim()}" isn't on our list for ${make.trim()}. It stays as saved unless you change it.`;
  }

  return (
    <View style={style}>
      <AutocompleteField
        label={required ? 'Make *' : 'Make'}
        value={makeText}
        onChangeText={typeMake}
        onSelect={(v) => { setMakeText(v); chooseMake(v); }}
        onBlur={() => {
          setMakeTouched(true);
          // Show the list's spelling of what was matched ("bmw" → "BMW").
          if (make && norm(makeText) === norm(make)) setMakeText(make);
          if (makesFailed) refetchMakes();
        }}
        suggestions={makes}
        placeholder={makesLoading ? 'Loading makes…' : 'Search makes'}
        message={makeMessage}
        invalid={makeInvalid}
        inputStyle={inputStyle}
      />

      <AutocompleteField
        label={required ? 'Model *' : 'Model'}
        value={modelText}
        onChangeText={typeModel}
        onSelect={(v) => { setModelText(v); sendModel(v); }}
        onBlur={() => {
          setModelTouched(true);
          if (model && norm(modelText) === norm(model)) setModelText(model);
        }}
        suggestions={modelList}
        // Nothing to choose from until there's a make to choose within.
        editable={!!make}
        placeholder={make ? 'Search models' : 'Choose a make first'}
        message={modelMessage}
        invalid={modelInvalid}
        style={styles.second}
        inputStyle={inputStyle}
      />

      {/* The lists are a reference table, so a missing marque is only ours to
          fix. Offered here, where someone hits it, rather than leaving them to
          abandon the car and find support afterwards. */}
      <TouchableOpacity
        style={styles.missing}
        onPress={() => setAsking(true)}
        activeOpacity={0.6}
        accessibilityRole="button"
      >
        <Text style={[styles.missingText, { color: colors.grey }]}>
          Can't find your car? Reach out and we'll add it
        </Text>
      </TouchableOpacity>

      <CarRequestModal visible={asking} onClose={() => setAsking(false)} />
    </View>
  );
}

/** The ask itself: what's missing, in their words. */
function CarRequestModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const colors = useColors();
  const brand = useBrandColor();
  const [message, setMessage] = useState('');
  const [sent, setSent] = useState(false);
  const [requestCarModel, { isLoading }] = useRequestCarModelMutation();

  // Each opening starts fresh, including after a send.
  useEffect(() => {
    if (visible) { setMessage(''); setSent(false); }
  }, [visible]);

  const send = async () => {
    if (!message.trim()) return;
    try {
      await requestCarModel({ message: message.trim() }).unwrap();
      setSent(true);
    } catch (err: any) {
      Alert.alert('Error', err?.data?.error || "Couldn't send that. Please try again.");
    }
  };

  return (
    <SharedModal visible={visible} onClose={onClose} title="Add a car">
      <View style={styles.askBody}>
        {sent ? (
          <>
            <Text style={[styles.askThanks, { color: colors.fg }]}>
              Thanks — we'll add it shortly.
            </Text>
            <TouchableOpacity
              style={[styles.askSend, { backgroundColor: brand }]}
              onPress={onClose}
              activeOpacity={0.85}
            >
              <Text style={styles.askSendText}>Done</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <Text style={[styles.askHint, { color: colors.grey }]}>
              Tell us the make and model we're missing and we'll get it in.
            </Text>
            <TextInput
              style={[styles.askInput, {
                color: colors.fg,
                backgroundColor: colors.card,
                borderColor: colors.inputBorder,
              }]}
              value={message}
              onChangeText={setMessage}
              multiline
              autoFocus
              maxLength={1000}
              textAlignVertical="top"
            />
            <TouchableOpacity
              style={[styles.askSend, { backgroundColor: brand }, !message.trim() && styles.askSendOff]}
              onPress={send}
              disabled={isLoading || !message.trim()}
              activeOpacity={0.85}
            >
              {isLoading
                ? <ActivityIndicator size="small" color="#000000" />
                : <Text style={styles.askSendText}>Send</Text>}
            </TouchableOpacity>
          </>
        )}
      </View>
    </SharedModal>
  );
}

const styles = StyleSheet.create({
  missing: { alignSelf: 'flex-end', marginTop: 8, paddingVertical: 4 },
  missingText: { fontSize: 12, fontWeight: '600', textDecorationLine: 'underline' },

  askBody: { padding: 16, paddingBottom: 32, gap: 12 },
  askHint: { fontSize: 13, lineHeight: 18 },
  askThanks: { fontSize: 15, fontWeight: '700', lineHeight: 21 },
  askInput: {
    minHeight: 120, borderWidth: 1, borderRadius: 8,
    paddingHorizontal: 14, paddingVertical: 11, fontSize: 15,
  },
  askSend: {
    paddingVertical: 14, borderRadius: COMMON_RADIUS,
    alignItems: 'center', justifyContent: 'center',
  },
  askSendOff: { opacity: 0.5 },
  askSendText: { fontSize: 15, fontWeight: '800', color: '#000000' },
  // The same gap the plain fields leave between them.
  second: { marginTop: 16 },
});
