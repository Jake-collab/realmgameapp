import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import { Feather } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useColors } from '@/hooks/useColors';
import { fontFamily, fontSize } from '@/constants/typography';
import { radius, spacing } from '@/constants/spacing';
import { Button } from '@/components/ui/Button';
import { KeyboardAwareScrollViewCompat } from '@/components/KeyboardAwareScrollViewCompat';
import {
  useCreatorHuntDraft,
  useHuntCreator,
} from '@/features/hunts/hooks/useHuntCreator';
import type {
  CreatorProofType,
  HuntCreatorDraft,
  HuntCreatorStop,
} from '@/features/hunts/types/huntCreator.types';
import { MapProvider, getMapboxGL, useMapContext } from '@/features/maps/MapProvider';
import { DEFAULT_MAP_REGION, USER_LOCATION_ZOOM } from '@/features/maps/config/mapConfig';

const LOCAL_DRAFT_KEY = '@worlds/hunt-creator-draft';
const STEPS = ['Details', 'Stops', 'Clues', 'Proof', 'Schedule', 'Privacy', 'Publish'] as const;
type Step = (typeof STEPS)[number];

const DEFAULT_STOP: HuntCreatorStop = {
  title: '',
  description: '',
  clueText: '',
  hintText: '',
  completionMethod: 'none',
  isRequired: true,
  publicLat: null,
  publicLng: null,
  publicRadius: 500,
  validationRadius: 30,
};

const EMPTY_DRAFT: HuntCreatorDraft = {
  title: 'Untitled Hunt',
  summary: '',
  description: '',
  difficulty: 'medium',
  pointsReward: 100,
  estimatedDurationMinutes: 60,
  stopOrdering: 'ordered',
  participationMode: 'solo',
  startModel: 'individual',
  startsAt: null,
  endsAt: null,
  privacy: 'public',
  maxParticipants: null,
  publicMeetingInfo: '',
  safetyNote: '',
  accessibilityNote: '',
  coverMediaId: null,
  stops: [{ ...DEFAULT_STOP }],
};

export default function CreateHuntScreen() {
  const colors = useColors();
  const { draftId } = useLocalSearchParams<{ draftId?: string }>();
  const serverDraft = useCreatorHuntDraft(draftId);
  const { saveDraft, publish, uploadCover } = useHuntCreator();
  const [draft, setDraft] = useState<HuntCreatorDraft>(EMPTY_DRAFT);
  const [savedHuntId, setSavedHuntId] = useState<string | undefined>(draftId);
  const [stepIndex, setStepIndex] = useState(0);
  const [hydrated, setHydrated] = useState(false);
  const [draftReady, setDraftReady] = useState(!draftId);
  const [localRecovery, setLocalRecovery] = useState<HuntCreatorDraft | null>(null);
  const [saveState, setSaveState] = useState<'saving' | 'saved' | 'local' | 'error'>('saved');
  const draftCreationAttempted = useRef(Boolean(draftId));
  const step = STEPS[stepIndex];

  useEffect(() => {
    let active = true;
    (async () => {
      const stored = await AsyncStorage.getItem((savedHuntId ?? draftId) ? `${LOCAL_DRAFT_KEY}:${savedHuntId ?? draftId}` : LOCAL_DRAFT_KEY);
      if (active && stored) {
        try {
          const recovered = { ...EMPTY_DRAFT, ...JSON.parse(stored) } as HuntCreatorDraft;
          if (draftId) setLocalRecovery(recovered);
          else setDraft(recovered);
        } catch { /* ignore corrupt local draft */ }
      }
      setHydrated(true);
    })();
    return () => { active = false; };
  }, [draftId, savedHuntId]);

  useEffect(() => {
    if (!draftId || !hydrated || serverDraft.isLoading || draftReady) return;
    if (serverDraft.data) {
      const serverCopy = { ...EMPTY_DRAFT, ...serverDraft.data };
      const localIsNewer = localRecovery?.updatedAt && serverCopy.updatedAt
        ? new Date(localRecovery.updatedAt).getTime() > new Date(serverCopy.updatedAt).getTime()
        : Boolean(localRecovery);
      setDraft(localIsNewer ? { ...serverCopy, ...localRecovery } : serverCopy);
      setDraftReady(true);
      return;
    }
    // A failed or unavailable fetch must never cause an update against an
    // unknown server draft. Local recovery remains viewable but read-only.
    if (serverDraft.isError) {
      if (localRecovery) setDraft(localRecovery);
      setSaveState('local');
    }
  }, [draftId, draftReady, hydrated, localRecovery, serverDraft.data, serverDraft.isError, serverDraft.isLoading]);

  const update = useCallback((patch: Partial<HuntCreatorDraft>) => {
    setDraft(current => ({ ...current, ...patch }));
  }, []);

  const persistLocal = useCallback(async (nextDraft = draft) => {
    await AsyncStorage.setItem(
      (savedHuntId ?? draftId) ? `${LOCAL_DRAFT_KEY}:${savedHuntId ?? draftId}` : LOCAL_DRAFT_KEY,
      JSON.stringify(nextDraft),
    );
  }, [draft, draftId, savedHuntId]);

  const saveToServer = useCallback(async () => {
    setSaveState('saving');
    const result = await saveDraft.mutateAsync({ huntId: savedHuntId, draft });
    if (result.id) setSavedHuntId(result.id);
    await AsyncStorage.setItem(
      result.id ? `${LOCAL_DRAFT_KEY}:${result.id}` : ((savedHuntId ?? draftId) ? `${LOCAL_DRAFT_KEY}:${savedHuntId ?? draftId}` : LOCAL_DRAFT_KEY),
      JSON.stringify(result),
    );
    setSaveState('saved');
    return result;
  }, [draft, draftId, savedHuntId, saveDraft]);

  // Start a server-owned draft as soon as the creator opens. If the account
  // service is unavailable, local persistence remains the explicit fallback.
  useEffect(() => {
    if (!hydrated || savedHuntId || draftCreationAttempted.current) return;
    draftCreationAttempted.current = true;
    saveToServer().catch(async () => {
      await persistLocal();
      setSaveState('local');
    });
  }, [hydrated, persistLocal, savedHuntId, saveToServer]);

  // Keep a confirmed recovery point while the creator works; writes are
  // debounced so typing never creates a network request per keystroke.
  useEffect(() => {
    if (!hydrated || !draftReady || !savedHuntId) return;
    const timer = setTimeout(() => {
      saveToServer().catch(async () => {
        await persistLocal();
        setSaveState('error');
      });
    }, 900);
    return () => clearTimeout(timer);
  }, [draft, draftReady, hydrated, persistLocal, savedHuntId, saveToServer]);

  const next = useCallback(async () => {
    if (stepIndex === 0 && draft.title.trim().length < 3) {
      Alert.alert('Add a title', 'Give your Hunt a title with at least 3 characters.');
      return;
    }
    if (stepIndex === 1 && draft.stops.length === 0) {
      Alert.alert('Add a stop', 'A Hunt needs at least one stop.');
      return;
    }
    await persistLocal();
    setStepIndex(value => Math.min(STEPS.length - 1, value + 1));
  }, [draft, persistLocal, stepIndex]);

  const publishNow = useCallback(async () => {
    if (draft.title.trim().length < 3 || draft.summary.trim().length < 10) {
      Alert.alert('Complete the details', 'Add a title and a summary of at least 10 characters before submitting.');
      setStepIndex(0);
      return;
    }
    if (draft.stops.some(stop => stop.title.trim().length < 3 || stop.clueText.trim().length < 3)) {
      Alert.alert('Complete every stop', 'Each stop needs a title and clue before you submit.');
      setStepIndex(2);
      return;
    }
    try {
      const saved = await saveToServer();
      if (!saved.id) {
        Alert.alert('Draft saved', 'Your Hunt is saved on this device. Connect your account service to publish it.');
        return;
      }
      await publish.mutateAsync(saved.id);
      await AsyncStorage.removeItem(`${LOCAL_DRAFT_KEY}:${saved.id}`);
      await AsyncStorage.removeItem(LOCAL_DRAFT_KEY);
      Alert.alert('Submitted for review', 'Your Hunt will be available after it is approved.', [
        { text: 'View My Hunts', onPress: () => router.replace('/(main)/hunt/my-hunts') },
      ]);
    } catch (error) {
      Alert.alert('Could not publish', error instanceof Error ? error.message : 'Please try again.');
    }
  }, [draft, publish, saveToServer]);

  if (!hydrated || (draftId && !draftReady && serverDraft.isLoading)) {
    return <View style={[styles.centered, { backgroundColor: colors.background }]}><ActivityIndicator color={colors.hunt} /></View>;
  }

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <View style={[styles.topBar, { borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} accessibilityLabel="Close Hunt creator">
          <Feather name="x" size={22} color={colors.foreground} />
        </Pressable>
        <View style={styles.topBarCopy}>
          <Text style={[styles.eyebrow, { color: colors.hunt }]}>HUNT CREATOR</Text>
          <Text style={[styles.topTitle, { color: colors.foreground }]}>{step}</Text>
        </View>
        <View style={styles.saveState}>
          <Text style={[styles.saveText, { color: saveState === 'error' ? colors.destructive : colors.hunt }]}>
            {saveState === 'saving' ? 'Saving…' : saveState === 'saved' ? 'Saved' : saveState === 'local' ? 'Saved locally' : 'Retry save'}
          </Text>
          <Pressable onPress={() => saveToServer().catch(async () => { await persistLocal(); setSaveState('error'); })} accessibilityLabel="Save Hunt draft">
            <Feather name="save" size={18} color={colors.hunt} />
          </Pressable>
        </View>
      </View>

      <View style={styles.progressRow}>
        {STEPS.map((label, index) => (
          <View key={label} style={styles.progressItem}>
            <View style={[styles.progressDot, { backgroundColor: index <= stepIndex ? colors.hunt : colors.border }]} />
            {index < STEPS.length - 1 && <View style={[styles.progressLine, { backgroundColor: index < stepIndex ? colors.hunt : colors.border }]} />}
          </View>
        ))}
      </View>

      <KeyboardAwareScrollViewCompat contentContainerStyle={styles.content} bottomOffset={90}>
        {step === 'Details' && <DetailsStep draft={draft} update={update} colors={colors} huntId={savedHuntId} uploadCover={uploadCover} />}
        {step === 'Stops' && <StopsStep draft={draft} update={update} colors={colors} />}
        {step === 'Clues' && <CluesStep draft={draft} update={update} colors={colors} />}
        {step === 'Proof' && <ProofStep draft={draft} update={update} colors={colors} />}
        {step === 'Schedule' && <ScheduleStep draft={draft} update={update} colors={colors} />}
        {step === 'Privacy' && <PrivacyStep draft={draft} update={update} colors={colors} />}
        {step === 'Publish' && <PublishStep draft={draft} colors={colors} />}
      </KeyboardAwareScrollViewCompat>

      <View style={[styles.footer, { backgroundColor: colors.background, borderTopColor: colors.border }]}>
        {stepIndex > 0 ? (
          <Button variant="outline" onPress={() => setStepIndex(value => value - 1)}>Back</Button>
        ) : <View />}
        {step === 'Publish' ? (
          <Button onPress={publishNow} loading={saveDraft.isPending || publish.isPending} testID="publish-hunt-button">Submit for Review</Button>
        ) : (
          <Button onPress={next} testID="creator-next-button">Continue <Feather name="arrow-right" size={16} color={colors.primaryForeground} /></Button>
        )}
      </View>
    </View>
  );
}

type StepProps = {
  draft: HuntCreatorDraft;
  update: (patch: Partial<HuntCreatorDraft>) => void;
  colors: ReturnType<typeof useColors>;
};

function Field({ label, value, onChangeText, placeholder, multiline, keyboardType, colors }: {
  label: string; value: string; onChangeText: (text: string) => void; placeholder?: string;
  multiline?: boolean; keyboardType?: 'default' | 'numeric'; colors: ReturnType<typeof useColors>;
}) {
  return (
    <View style={styles.field}>
      <Text style={[styles.label, { color: colors.foreground }]}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.mutedForeground}
        multiline={multiline}
        keyboardType={keyboardType}
        style={[styles.input, multiline && styles.multiline, { color: colors.foreground, backgroundColor: colors.input, borderColor: colors.inputBorder }]}
      />
    </View>
  );
}

function Choice<T extends string>({ value, options, onChange, colors }: {
  value: T; options: { value: T; label: string; icon?: string }[]; onChange: (value: T) => void; colors: ReturnType<typeof useColors>;
}) {
  return <View style={styles.choiceGrid}>{options.map(option => (
    <Pressable key={option.value} onPress={() => onChange(option.value)} style={[styles.choice, { backgroundColor: value === option.value ? colors.hunt + '18' : colors.card, borderColor: value === option.value ? colors.hunt : colors.border }]}>
      {option.icon && <Feather name={option.icon as any} size={18} color={value === option.value ? colors.hunt : colors.mutedForeground} />}
      <Text style={[styles.choiceText, { color: value === option.value ? colors.hunt : colors.foreground }]}>{option.label}</Text>
    </Pressable>
  ))}</View>;
}

function DetailsStep({ draft, update, colors, huntId, uploadCover }: StepProps & {
  huntId?: string;
  uploadCover: ReturnType<typeof useHuntCreator>['uploadCover'];
}) {
  return <View>
    <Intro icon="compass" title="Bring an adventure to life" body="Create a route, add clues, and invite friends to play together." colors={colors} />
    <Field label="Hunt title" value={draft.title} onChangeText={title => update({ title })} placeholder="e.g. The Hidden Garden" colors={colors} />
    <Field label="Short summary" value={draft.summary} onChangeText={summary => update({ summary })} placeholder="A quick line players will see first" colors={colors} />
    <Field label="Description" value={draft.description} onChangeText={description => update({ description })} placeholder="Tell players what makes this Hunt special" multiline colors={colors} />
    <Field label="Public starting area" value={draft.publicMeetingInfo} onChangeText={publicMeetingInfo => update({ publicMeetingInfo })} placeholder="Where should players begin?" colors={colors} />
    <Field label="Safety note (optional)" value={draft.safetyNote} onChangeText={safetyNote => update({ safetyNote })} placeholder="Weather, traffic, or other preparation" multiline colors={colors} />
    <Field label="Accessibility note (optional)" value={draft.accessibilityNote} onChangeText={accessibilityNote => update({ accessibilityNote })} placeholder="Terrain, stairs, mobility, or sensory details" multiline colors={colors} />
    <CoverImagePicker
      huntId={huntId}
      coverMediaId={draft.coverMediaId}
      isUploading={uploadCover.isPending}
      onPick={async (uri) => {
        if (!huntId) throw new Error('Your draft is still being created. Try again in a moment.');
        const coverMediaId = await uploadCover.mutateAsync({ huntId, uri });
        update({ coverMediaId });
      }}
      colors={colors}
    />
    <Text style={[styles.label, { color: colors.foreground }]}>Difficulty</Text>
    <Choice value={draft.difficulty} onChange={difficulty => update({ difficulty })} colors={colors} options={[
      { value: 'very_easy', label: 'Very easy' }, { value: 'easy', label: 'Easy' }, { value: 'medium', label: 'Medium' }, { value: 'hard', label: 'Hard' }, { value: 'epic', label: 'Epic' },
    ]} />
    <View style={styles.row}>
      <View style={styles.half}><Field label="Reward points" value={String(draft.pointsReward)} onChangeText={value => update({ pointsReward: Number(value.replace(/[^0-9]/g, '')) || 0 })} keyboardType="numeric" colors={colors} /></View>
      <View style={styles.half}><Field label="Minutes" value={String(draft.estimatedDurationMinutes)} onChangeText={value => update({ estimatedDurationMinutes: Number(value.replace(/[^0-9]/g, '')) || 0 })} keyboardType="numeric" colors={colors} /></View>
    </View>
  </View>;
}

function StopsStep({ draft, update, colors }: StepProps) {
  const updateStop = (index: number, patch: Partial<HuntCreatorStop>) => update({ stops: draft.stops.map((stop, i) => i === index ? { ...stop, ...patch } : stop) });
  const locate = async (index: number) => {
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== 'granted') { Alert.alert('Location permission needed', 'Allow location access to place this stop on the map.'); return; }
      const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      updateStop(index, { publicLat: position.coords.latitude, publicLng: position.coords.longitude });
    } catch { Alert.alert('Could not get your location', 'You can try again or add the location later.'); }
  };
  return <View>
    <Intro icon="map-pin" title="Place your stops" body="Add the places players will discover. Use your current location or enter coordinates from a map." colors={colors} />
    <Choice value={draft.stopOrdering} onChange={stopOrdering => update({ stopOrdering })} colors={colors} options={[{ value: 'ordered', label: 'In order', icon: 'list' }, { value: 'unordered', label: 'Any order', icon: 'grid' }]} />
    {draft.stops.map((stop, index) => <View key={stop.id ?? index} style={[styles.stopCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.stopHeader}><View style={[styles.number, { backgroundColor: colors.hunt }]}><Text style={styles.numberText}>{index + 1}</Text></View><Text style={[styles.cardTitle, { color: colors.foreground }]}>Stop {index + 1}</Text>{draft.stops.length > 1 && <Pressable onPress={() => update({ stops: draft.stops.filter((_, i) => i !== index) })}><Feather name="trash-2" size={17} color={colors.destructive} /></Pressable>}</View>
      <Field label="Stop name" value={stop.title} onChangeText={title => updateStop(index, { title })} placeholder="e.g. Fountain entrance" colors={colors} />
      <Field label="What players should notice" value={stop.description} onChangeText={description => updateStop(index, { description })} placeholder="Optional context" multiline colors={colors} />
      <Pressable onPress={() => locate(index)} style={[styles.locationButton, { borderColor: colors.hunt, backgroundColor: colors.hunt + '10' }]}>
        <Feather name="crosshair" size={17} color={colors.hunt} />
        <Text style={[styles.locationText, { color: colors.hunt }]}>{stop.publicLat ? `${stop.publicLat.toFixed(4)}, ${stop.publicLng?.toFixed(4)}` : 'Place on map with current location'}</Text>
      </Pressable>
      <StopMapPicker
        latitude={stop.publicLat}
        longitude={stop.publicLng}
        onPick={(publicLat, publicLng) => updateStop(index, { publicLat, publicLng })}
        colors={colors}
      />
      <View style={styles.row}><View style={styles.half}><Field label="Public radius (m)" value={String(stop.publicRadius)} onChangeText={value => updateStop(index, { publicRadius: Number(value.replace(/[^0-9]/g, '')) || 100 })} keyboardType="numeric" colors={colors} /></View><View style={styles.half}><Field label="Validation radius (m)" value={String(stop.validationRadius)} onChangeText={value => updateStop(index, { validationRadius: Number(value.replace(/[^0-9]/g, '')) || 30 })} keyboardType="numeric" colors={colors} /></View></View>
    </View>)}
    <Button variant="outline" fullWidth onPress={() => update({ stops: [...draft.stops, { ...DEFAULT_STOP }] })}><Feather name="plus" size={16} color={colors.primary} /> Add another stop</Button>
  </View>;
}

function CluesStep({ draft, update, colors }: StepProps) {
  const updateStop = (index: number, patch: Partial<HuntCreatorStop>) => update({ stops: draft.stops.map((stop, i) => i === index ? { ...stop, ...patch } : stop) });
  return <View>
    <Intro icon="help-circle" title="Write the clues" body="Give players a nudge without giving away the answer. A hint stays hidden until they ask for it." colors={colors} />
    {draft.stops.map((stop, index) => <View key={stop.id ?? index} style={[styles.stopCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <Text style={[styles.cardTitle, { color: colors.foreground }]}>Stop {index + 1}: {stop.title || 'Untitled stop'}</Text>
      <Field label="Clue" value={stop.clueText} onChangeText={clueText => updateStop(index, { clueText })} placeholder="What should players solve?" multiline colors={colors} />
      <Field label="Optional hint" value={stop.hintText} onChangeText={hintText => updateStop(index, { hintText })} placeholder="A little help if they get stuck" multiline colors={colors} />
    </View>)}
  </View>;
}

function ProofStep({ draft, update, colors }: StepProps) {
  const updateStop = (index: number, completionMethod: CreatorProofType) => update({ stops: draft.stops.map((stop, i) => i === index ? { ...stop, completionMethod } : stop) });
  return <View>
    <Intro icon="check-square" title="Set proof requirements" body="Choose how players prove they reached each stop. You can mix requirements across your route." colors={colors} />
    {draft.stops.map((stop, index) => <View key={stop.id ?? index} style={[styles.stopCard, { backgroundColor: colors.card, borderColor: colors.border }]}><Text style={[styles.cardTitle, { color: colors.foreground }]}>Stop {index + 1}: {stop.title || 'Untitled stop'}</Text><Choice value={stop.completionMethod} onChange={value => updateStop(index, value)} colors={colors} options={[{ value: 'none', label: 'Self confirm', icon: 'check' }, { value: 'location', label: 'Geo-fence location', icon: 'map-pin' }, { value: 'photo', label: 'Photo', icon: 'camera' }, { value: 'text', label: 'Written answer', icon: 'edit-3' }, { value: 'photo_and_location', label: 'Photo + location', icon: 'shield' }]} /></View>)}
  </View>;
}

function ScheduleStep({ draft, update, colors }: StepProps) {
  return <View>
    <Intro icon="calendar" title="Choose when it runs" body="Leave dates blank for an always-open Hunt, or schedule a window for a special event." colors={colors} />
    <Field label="Starts at (ISO date/time)" value={draft.startsAt ?? ''} onChangeText={value => update({ startsAt: value || null })} placeholder="2026-09-12T10:00:00Z" colors={colors} />
    <Field label="Ends at (ISO date/time)" value={draft.endsAt ?? ''} onChangeText={value => update({ endsAt: value || null })} placeholder="2026-09-12T14:00:00Z" colors={colors} />
    <Text style={[styles.label, { color: colors.foreground }]}>How does it start?</Text>
    <Choice value={draft.startModel} onChange={startModel => update({ startModel })} colors={colors} options={[{ value: 'individual', label: 'Each player', icon: 'user' }, { value: 'scheduled', label: 'On schedule', icon: 'clock' }, { value: 'host_controlled', label: 'Host starts', icon: 'play' }]} />
    <View style={[styles.infoBox, { backgroundColor: colors.secondary }]}><Feather name="info" size={16} color={colors.info} /><Text style={[styles.infoText, { color: colors.secondaryForeground }]}>Players can see the schedule before joining. Exact stop validation stays server-side.</Text></View>
  </View>;
}

function PrivacyStep({ draft, update, colors }: StepProps) {
  return <View>
    <Intro icon="lock" title="Set the audience" body="Control who can find and join your Hunt. You can still invite friends after publishing." colors={colors} />
    <Choice value={draft.privacy} onChange={privacy => update({ privacy })} colors={colors} options={[{ value: 'public', label: 'Public', icon: 'globe' }, { value: 'unlisted', label: 'Unlisted', icon: 'link' }, { value: 'invite_only', label: 'Invite only', icon: 'mail' }, { value: 'private', label: 'Private', icon: 'lock' }]} />
    <Field label="Maximum players (optional)" value={draft.maxParticipants ? String(draft.maxParticipants) : ''} onChangeText={value => update({ maxParticipants: value ? Number(value.replace(/[^0-9]/g, '')) : null })} placeholder="Leave blank for unlimited" keyboardType="numeric" colors={colors} />
    <Field label="Meeting point note (optional)" value={draft.publicMeetingInfo} onChangeText={publicMeetingInfo => update({ publicMeetingInfo })} placeholder="A safe, public place to meet" multiline colors={colors} />
    <View style={[styles.privacyRow, { borderColor: colors.border }]}><View style={styles.privacyCopy}><Text style={[styles.cardTitle, { color: colors.foreground }]}>Require players to follow the route</Text><Text style={[styles.small, { color: colors.mutedForeground }]}>Stops unlock one at a time in order.</Text></View><Switch value={draft.stopOrdering === 'ordered'} onValueChange={enabled => update({ stopOrdering: enabled ? 'ordered' : 'unordered' })} trackColor={{ true: colors.hunt }} /></View>
  </View>;
}

function PublishStep({ draft, colors }: { draft: HuntCreatorDraft; colors: ReturnType<typeof useColors> }) {
  return <View>
    <Intro icon="send" title="Ready to launch?" body="Review your Hunt before it goes live. You can edit drafts any time before publishing." colors={colors} />
    <View style={[styles.previewCard, { backgroundColor: colors.card, borderColor: colors.border }]}><View style={[styles.previewIcon, { backgroundColor: colors.hunt + '18' }]}><Feather name="compass" size={25} color={colors.hunt} /></View><Text style={[styles.previewTitle, { color: colors.foreground }]}>{draft.title || 'Untitled Hunt'}</Text><Text style={[styles.previewSummary, { color: colors.mutedForeground }]}>{draft.summary || 'Add a short summary on the Details step.'}</Text><View style={styles.metaRow}><Meta icon="map-pin" text={`${draft.stops.length} stops`} colors={colors} /><Meta icon="award" text={`${draft.pointsReward} points`} colors={colors} /><Meta icon="lock" text={draft.privacy.replace('_', ' ')} colors={colors} /></View></View>
    <View style={styles.checkList}>{[['check-circle', draft.title.trim().length >= 3, 'A clear title'], ['check-circle', draft.summary.trim().length >= 3, 'A short summary'], ['check-circle', draft.stops.length > 0 && draft.stops.every(stop => stop.title.trim()), 'Every stop is named'], ['check-circle', draft.stops.every(stop => stop.clueText.trim()), 'Every stop has a clue']].map(([icon, ok, label]) => <View key={String(label)} style={styles.checkRow}><Feather name={icon as any} size={17} color={ok ? colors.success : colors.mutedForeground} /><Text style={[styles.checkText, { color: ok ? colors.foreground : colors.mutedForeground }]}>{label}</Text></View>)}</View>
  </View>;
}

function Intro({ icon, title, body, colors }: { icon: string; title: string; body: string; colors: ReturnType<typeof useColors> }) {
  return <View style={styles.intro}><View style={[styles.introIcon, { backgroundColor: colors.hunt + '18' }]}><Feather name={icon as any} size={23} color={colors.hunt} /></View><Text style={[styles.heading, { color: colors.foreground }]}>{title}</Text><Text style={[styles.body, { color: colors.mutedForeground }]}>{body}</Text></View>;
}
function Meta({ icon, text, colors }: { icon: string; text: string; colors: ReturnType<typeof useColors> }) {
  return <View style={styles.meta}><Feather name={icon as any} size={14} color={colors.mutedForeground} /><Text style={[styles.small, { color: colors.mutedForeground }]}>{text}</Text></View>;
}

function CoverImagePicker({ huntId, coverMediaId, isUploading, onPick, colors }: {
  huntId?: string;
  coverMediaId: string | null;
  isUploading: boolean;
  onPick: (uri: string) => Promise<void>;
  colors: ReturnType<typeof useColors>;
}) {
  const selectCover = async () => {
    if (!huntId) {
      Alert.alert('Creating your draft', 'Wait a moment for the first draft save, then add a cover image.');
      return;
    }
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Photo permission needed', 'Allow photo access to choose a Hunt cover image.');
      return;
    }
    const picked = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.85 });
    if (!picked.canceled && picked.assets[0]) {
      try { await onPick(picked.assets[0].uri); }
      catch { Alert.alert('Could not upload cover', 'Your image was not added. Please try again.'); }
    }
  };
  return (
    <Pressable onPress={selectCover} disabled={isUploading} style={[styles.coverPicker, { borderColor: colors.border, backgroundColor: colors.muted }]}>
      {isUploading ? <ActivityIndicator color={colors.hunt} /> : <Feather name={coverMediaId ? 'check-circle' : 'image'} size={20} color={colors.hunt} />}
      <View style={styles.coverPickerCopy}>
        <Text style={[styles.label, { color: colors.foreground }]}>{coverMediaId ? 'Cover image added' : 'Add cover image (optional)'}</Text>
        <Text style={[styles.small, { color: colors.mutedForeground }]}>{coverMediaId ? 'Replace cover image' : 'Choose a photo from your library'}</Text>
      </View>
    </Pressable>
  );
}

function StopMapPicker({ latitude, longitude, onPick, colors }: {
  latitude: number | null;
  longitude: number | null;
  onPick: (latitude: number, longitude: number) => void;
  colors: ReturnType<typeof useColors>;
}) {
  return (
    <MapProvider>
      <StopMapPickerInner latitude={latitude} longitude={longitude} onPick={onPick} colors={colors} />
    </MapProvider>
  );
}

function StopMapPickerInner({ latitude, longitude, onPick, colors }: {
  latitude: number | null;
  longitude: number | null;
  onPick: (latitude: number, longitude: number) => void;
  colors: ReturnType<typeof useColors>;
}) {
  const { isReady } = useMapContext();
  const MapboxGL = getMapboxGL();
  const center = [longitude ?? DEFAULT_MAP_REGION.longitude, latitude ?? DEFAULT_MAP_REGION.latitude] as [number, number];

  if (!MapboxGL || !isReady) {
    return (
      <View style={[styles.mapFallback, { borderColor: colors.border, backgroundColor: colors.muted }]}>
        <Feather name="map" size={18} color={colors.mutedForeground} />
        <Text style={[styles.mapFallbackText, { color: colors.mutedForeground }]}>Map preview appears when maps are available. Use your location to place this stop.</Text>
      </View>
    );
  }

  return (
    <View style={[styles.mapWrap, { borderColor: colors.border }]}>
      <MapboxGL.MapView
        style={styles.map}
        onPress={(event: any) => {
          const coordinates = event?.geometry?.coordinates;
          if (Array.isArray(coordinates) && coordinates.length >= 2) onPick(coordinates[1], coordinates[0]);
        }}
      >
        <MapboxGL.Camera defaultSettings={{ centerCoordinate: center, zoomLevel: latitude ? USER_LOCATION_ZOOM : DEFAULT_MAP_REGION.zoomLevel }} />
        {latitude !== null && longitude !== null && (
          <MapboxGL.PointAnnotation id="creator-stop" coordinate={[longitude, latitude]}>
            <View style={[styles.mapPin, { backgroundColor: colors.hunt }]} />
          </MapboxGL.PointAnnotation>
        )}
      </MapboxGL.MapView>
      <View style={[styles.mapHint, { backgroundColor: colors.card }]}>
        <Feather name="mouse-pointer" size={13} color={colors.hunt} />
        <Text style={[styles.mapHintText, { color: colors.foreground }]}>Tap the map to move this stop</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  topBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing[4], paddingVertical: spacing[3], borderBottomWidth: StyleSheet.hairlineWidth, gap: spacing[3] },
  topBarCopy: { flex: 1 },
  eyebrow: { fontFamily: fontFamily.bold, fontSize: fontSize.xs, letterSpacing: 1.2 },
  topTitle: { fontFamily: fontFamily.semiBold, fontSize: fontSize.lg, marginTop: 1 },
  saveText: { fontFamily: fontFamily.semiBold, fontSize: fontSize.sm },
  saveState: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  progressRow: { flexDirection: 'row', paddingHorizontal: spacing[5], paddingVertical: spacing[4], alignItems: 'center' },
  progressItem: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  progressDot: { width: 9, height: 9, borderRadius: 5 },
  progressLine: { flex: 1, height: 2, marginHorizontal: 2 },
  content: { paddingHorizontal: spacing[4], paddingBottom: 120 },
  intro: { alignItems: 'center', paddingVertical: spacing[4], marginBottom: spacing[2] },
  introIcon: { width: 50, height: 50, borderRadius: 25, alignItems: 'center', justifyContent: 'center', marginBottom: spacing[3] },
  heading: { fontFamily: fontFamily.bold, fontSize: fontSize['2xl'], textAlign: 'center' },
  body: { fontFamily: fontFamily.regular, fontSize: fontSize.base, lineHeight: 22, textAlign: 'center', marginTop: spacing[2], maxWidth: 340 },
  field: { marginBottom: spacing[4], flex: 1 },
  label: { fontFamily: fontFamily.semiBold, fontSize: fontSize.sm, marginBottom: spacing[2] },
  input: { minHeight: 48, borderWidth: 1, borderRadius: radius.md, paddingHorizontal: spacing[3], fontFamily: fontFamily.regular, fontSize: fontSize.base },
  multiline: { minHeight: 92, paddingTop: spacing[3], textAlignVertical: 'top' },
  choiceGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2], marginBottom: spacing[4] },
  choice: { minHeight: 44, borderRadius: radius.md, borderWidth: 1, paddingHorizontal: spacing[3], paddingVertical: spacing[2], flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  choiceText: { fontFamily: fontFamily.medium, fontSize: fontSize.sm },
  row: { flexDirection: 'row', gap: spacing[3] },
  half: { flex: 1 },
  stopCard: { borderWidth: 1, borderRadius: radius.lg, padding: spacing[4], marginBottom: spacing[4] },
  stopHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], marginBottom: spacing[4] },
  number: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  numberText: { color: '#fff', fontFamily: fontFamily.bold, fontSize: fontSize.sm },
  cardTitle: { flex: 1, fontFamily: fontFamily.semiBold, fontSize: fontSize.base },
  locationButton: { minHeight: 46, borderRadius: radius.md, borderWidth: 1, flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing[3], gap: spacing[2], marginBottom: spacing[4] },
  locationText: { fontFamily: fontFamily.medium, fontSize: fontSize.sm, flex: 1 },
  mapWrap: { height: 170, borderWidth: 1, borderRadius: radius.md, overflow: 'hidden', marginBottom: spacing[4] },
  map: { flex: 1 },
  mapHint: { position: 'absolute', bottom: spacing[2], alignSelf: 'center', borderRadius: radius.full, paddingHorizontal: spacing[3], paddingVertical: spacing[1], flexDirection: 'row', alignItems: 'center', gap: spacing[1] },
  mapHintText: { fontFamily: fontFamily.medium, fontSize: fontSize.xs },
  mapPin: { width: 16, height: 16, borderRadius: 8, borderWidth: 3, borderColor: '#fff' },
  mapFallback: { minHeight: 64, borderRadius: radius.md, borderWidth: 1, padding: spacing[3], flexDirection: 'row', alignItems: 'center', gap: spacing[2], marginBottom: spacing[4] },
  mapFallbackText: { flex: 1, fontFamily: fontFamily.regular, fontSize: fontSize.xs, lineHeight: 17 },
  coverPicker: { borderWidth: 1, borderStyle: 'dashed', borderRadius: radius.md, minHeight: 66, padding: spacing[3], flexDirection: 'row', alignItems: 'center', gap: spacing[3], marginBottom: spacing[4] },
  coverPickerCopy: { flex: 1 },
  infoBox: { padding: spacing[3], borderRadius: radius.md, flexDirection: 'row', gap: spacing[2], alignItems: 'flex-start', marginTop: spacing[2] },
  infoText: { flex: 1, fontFamily: fontFamily.regular, fontSize: fontSize.sm, lineHeight: 19 },
  privacyRow: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: radius.lg, padding: spacing[4], marginTop: spacing[2] },
  privacyCopy: { flex: 1, gap: 4 },
  small: { fontFamily: fontFamily.regular, fontSize: fontSize.sm },
  previewCard: { borderWidth: 1, borderRadius: radius.xl, padding: spacing[5], alignItems: 'center', marginTop: spacing[3] },
  previewIcon: { width: 54, height: 54, borderRadius: 27, alignItems: 'center', justifyContent: 'center', marginBottom: spacing[3] },
  previewTitle: { fontFamily: fontFamily.bold, fontSize: fontSize.xl, textAlign: 'center' },
  previewSummary: { fontFamily: fontFamily.regular, fontSize: fontSize.base, textAlign: 'center', marginTop: spacing[2], lineHeight: 21 },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: spacing[3], marginTop: spacing[4] },
  meta: { flexDirection: 'row', alignItems: 'center', gap: spacing[1] },
  checkList: { gap: spacing[3], marginTop: spacing[5], paddingHorizontal: spacing[2] },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  checkText: { fontFamily: fontFamily.medium, fontSize: fontSize.base },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, borderTopWidth: StyleSheet.hairlineWidth, paddingHorizontal: spacing[4], paddingTop: spacing[3], paddingBottom: spacing[7], flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
});