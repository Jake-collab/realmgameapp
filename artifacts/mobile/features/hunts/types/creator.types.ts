import type { Difficulty, HuntPrivacy, ParticipationMode, StopCompletionMethod, StopOrdering, HuntStatus } from './hunt.types';

export type CreatorStep = 'details' | 'privacy' | 'start' | 'stops' | 'invite' | 'preview' | 'review';
export type CreatorSaveState = 'idle' | 'saving' | 'saved' | 'saved_local' | 'unsynced' | 'error';
export type CreatorStopType = 'location' | 'activity' | 'clue' | 'mixed';
export type CollectibleRarity = 'COMMON' | 'UNCOMMON' | 'RARE' | 'EPIC' | 'LEGENDARY' | 'UNIQUE';
export type HuntRevealMode =
  | 'ALWAYS_VISIBLE'
  | 'PROXIMITY_REVEAL'
  | 'PREREQUISITE_REVEAL'
  | 'HUNT_START_REVEAL'
  | 'ZONE_REVEAL'
  | 'CLUE_ONLY'
  | 'MANUAL_ADMIN_REVEAL';

export interface CreatorZone {
  key: string;
  name: string;
  sortOrder: number;
  required: boolean;
  prerequisiteZoneKeys: string[];
  publicCenterLat: number | null;
  publicCenterLng: number | null;
  publicRadiusMeters: number;
}

export interface CreatorStopCommerce {
  findLimit: number | null;
  collectibleName: string;
  collectibleDescription: string;
  priceMinor: number;
  quantity: number | null;
}

export interface CreatorLocation {
  label: string;
  latitude: number | null;
  longitude: number | null;
  radiusMeters: number;
  confirmed: boolean;
}

export interface CreatorStop {
  id: string;
  title: string;
  instruction: string;
  type: CreatorStopType;
  required: boolean;
  completionMethod: StopCompletionMethod;
  clueText: string;
  hintText: string;
  riddleAnswer: string;
  location: CreatorLocation | null;
  safetyNote: string;
  accessibilityNote: string;
  estimatedMinutes: number;
  /** Server-registered live camera sweep for the current Hunt revision. */
  sweepEvidenceMediaId?: string | null;
  commerce?: CreatorStopCommerce;
  revealMode: HuntRevealMode;
  revealRadiusMeters: number;
  revealAfterSeconds: number | null;
  zoneKey: string | null;
  prerequisiteStopIds: string[];
}

export interface HuntCreatorPayload {
  title: string;
  summary: string;
  description: string;
  difficulty: Difficulty;
  estimatedDurationMinutes: number;
  participationMode: ParticipationMode;
  stopOrdering: StopOrdering;
  privacy: HuntPrivacy;
  maxParticipants: number;
  startsAt: string | null;
  endsAt: string | null;
  joinUntil: string | null;
  startModel: 'individual' | 'scheduled' | 'host_controlled';
  publicStartingArea: CreatorLocation | null;
  startAnywhere: boolean;
  publicMeetingInfo: string;
  safetyAcknowledged: boolean;
  publicAccessConfirmed: boolean;
  accessibilityNote: string;
  pointsRequested: number;
  stops: CreatorStop[];
  intendedInviteeIds: string[];
  defaultRevealMode: HuntRevealMode;
  defaultRevealRadiusMeters: number;
  fogOfWarEnabled: boolean;
  persistentExploration: boolean;
  trailEnabled: boolean;
  zones: CreatorZone[];
}

export interface HuntCreatorDraft {
  id: string;
  ownerUserId: string;
  status: HuntStatus | 'changes_requested';
  creationVersion: number;
  revision: number;
  payload: HuntCreatorPayload;
  reviewSummary: string | null;
  updatedAt: string;
  submittedAt?: string | null;
}

export interface DraftValidationIssue {
  step: CreatorStep | 'details' | 'review';
  code: string;
  message: string;
}

export interface DraftValidationResult {
  valid: boolean;
  issues: DraftValidationIssue[];
}

export const CREATOR_DEFAULT_PAYLOAD: HuntCreatorPayload = {
  title: '', summary: '', description: '', difficulty: 'medium',
  estimatedDurationMinutes: 30, participationMode: 'solo',
  stopOrdering: 'ordered', privacy: 'private', maxParticipants: 10,
  startsAt: null, endsAt: null, joinUntil: null, startModel: 'individual',
  publicStartingArea: null, startAnywhere: true, publicMeetingInfo: '',
  safetyAcknowledged: false, publicAccessConfirmed: false, accessibilityNote: '',
  pointsRequested: 50, stops: [], intendedInviteeIds: [],
  defaultRevealMode: 'ALWAYS_VISIBLE',
  defaultRevealRadiusMeters: 250,
  fogOfWarEnabled: false,
  persistentExploration: false,
  trailEnabled: false,
  zones: [],
};

export function makeCreatorStop(order: number): CreatorStop {
  return {
    id: `local-stop-${Date.now()}-${order}`,
    title: '', instruction: '', type: 'mixed', required: true,
    completionMethod: 'manual_confirmation', clueText: '', hintText: '',
    riddleAnswer: '', location: null, safetyNote: '', accessibilityNote: '',
    estimatedMinutes: 10, sweepEvidenceMediaId: null,
    commerce: {
      findLimit: null, collectibleName: '', collectibleDescription: '',
      priceMinor: 0, quantity: null,
    },
    revealMode: 'ALWAYS_VISIBLE',
    revealRadiusMeters: 250,
    revealAfterSeconds: null,
    zoneKey: null,
    prerequisiteStopIds: [],
  };
}

export function normalizeCreatorPayload(value: Partial<HuntCreatorPayload> | null | undefined): HuntCreatorPayload {
  return { ...CREATOR_DEFAULT_PAYLOAD, ...(value ?? {}),
    stops: (value?.stops ?? []).map(stop => ({
      ...makeCreatorStop(0),
      ...stop,
      revealMode: stop.revealMode ?? value?.defaultRevealMode ?? 'ALWAYS_VISIBLE',
      revealRadiusMeters: stop.revealRadiusMeters ?? value?.defaultRevealRadiusMeters ?? 250,
      revealAfterSeconds: stop.revealAfterSeconds ?? null,
      zoneKey: stop.zoneKey ?? null,
      prerequisiteStopIds: stop.prerequisiteStopIds ?? [],
    })),
    zones: value?.zones ?? [],
    intendedInviteeIds: value?.intendedInviteeIds ?? [] };
}

export function validateCreatorDraft(payload: HuntCreatorPayload): DraftValidationResult {
  const issues: DraftValidationIssue[] = [];
  if (payload.title.trim().length < 3) issues.push({ step:'details', code:'title', message:'Add a title of at least 3 characters.' });
  if (payload.summary.trim().length < 10) issues.push({ step:'details', code:'summary', message:'Add a short summary of at least 10 characters.' });
  if (payload.description.trim().length < 20) issues.push({ step:'details', code:'description', message:'Add a little more detail about the adventure.' });
  if (!payload.maxParticipants || payload.maxParticipants < 1 || payload.maxParticipants > 500) issues.push({ step:'privacy', code:'capacity', message:'Choose between 1 and 500 participants.' });
  if (payload.startsAt && payload.endsAt && new Date(payload.endsAt) < new Date(payload.startsAt))
    issues.push({ step:'privacy', code:'schedule', message:'The end must be after the start.' });
  if (payload.startsAt && Number.isNaN(new Date(payload.startsAt).getTime()))
    issues.push({ step:'privacy', code:'schedule_start', message:'Enter a valid start date and time.' });
  if (payload.endsAt && Number.isNaN(new Date(payload.endsAt).getTime()))
    issues.push({ step:'privacy', code:'schedule_end', message:'Enter a valid end date and time.' });
  if (!payload.startAnywhere && (!payload.publicStartingArea?.label.trim() || !payload.publicStartingArea.confirmed))
    issues.push({ step:'start', code:'starting_area', message:'Confirm a public starting area or choose start anywhere.' });
  if (!payload.publicAccessConfirmed)
    issues.push({ step:'start', code:'public_access', message:'Confirm that participants can access the starting area without trespassing.' });
  if (!payload.safetyAcknowledged) issues.push({ step:'review', code:'safety', message:'Confirm that the Hunt is safe and does not require trespassing.' });
  const required = payload.stops.filter(stop => stop.required);
  if (!required.length) issues.push({ step:'stops', code:'required_stop', message:'Add at least one required stop.' });
  payload.stops.forEach((stop, index) => {
    if (!stop.title.trim()) issues.push({ step:'stops', code:`stop_${index}`, message:`Stop ${index + 1} needs a title.` });
    if (stop.location && (!stop.location.confirmed || stop.location.latitude === null || stop.location.longitude === null ||
      stop.location.latitude < -90 || stop.location.latitude > 90 || stop.location.longitude < -180 || stop.location.longitude > 180 ||
      (stop.location.latitude === 0 && stop.location.longitude === 0)))
      issues.push({ step:'stops', code:`location_${index}`, message:`Confirm a valid public location for stop ${index + 1}.` });
    if (!stop.clueText.trim() && stop.type !== 'activity')
      issues.push({ step:'stops', code:`clue_${index}`, message:`Add a clue or instruction for stop ${index + 1}.` });
    if (stop.completionMethod === 'trusted_code')
      issues.push({ step:'stops', code:`qr_${index}`, message:'QR/code validation is not available yet.' });
    if (stop.completionMethod !== 'manual_confirmation' && !stop.sweepEvidenceMediaId)
      issues.push({ step:'stops', code:`sweep_${index}`, message:`Capture a live camera safety sweep for stop ${index + 1}.` });
    if (!Number.isFinite(stop.revealRadiusMeters) || stop.revealRadiusMeters < 25 || stop.revealRadiusMeters > 5000)
      issues.push({ step:'stops', code:`reveal_radius_${index}`, message:`Use a reveal radius between 25m and 5km for stop ${index + 1}.` });
    if (stop.revealMode === 'PROXIMITY_REVEAL' && !stop.location)
      issues.push({ step:'stops', code:`reveal_location_${index}`, message:`A proximity-revealed stop needs a public display area.` });
    if (stop.zoneKey && !payload.zones.some(zone => zone.key === stop.zoneKey))
      issues.push({ step:'stops', code:`zone_${index}`, message:`Stop ${index + 1} references an unknown zone.` });
  });
  const stopKeys = new Set(payload.stops.map(stop => stop.id));
  const dependencies = new Map(payload.stops.map(stop => [stop.id, stop.prerequisiteStopIds]));
  payload.stops.forEach((stop, index) => {
    if (stop.prerequisiteStopIds.some(id => id === stop.id || !stopKeys.has(id)))
      issues.push({ step:'stops', code:`dependency_${index}`, message:`Stop ${index + 1} has an invalid prerequisite.` });
  });
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const visit = (stopId: string): boolean => {
    if (visiting.has(stopId)) return true;
    if (visited.has(stopId)) return false;
    visiting.add(stopId);
    const cycle = (dependencies.get(stopId) ?? []).some(visit);
    visiting.delete(stopId);
    visited.add(stopId);
    return cycle;
  };
  if ([...stopKeys].some(visit))
    issues.push({ step:'stops', code:'dependency_cycle', message:'Objective prerequisites cannot contain a circular dependency.' });
  const zoneKeys = new Set(payload.zones.map(zone => zone.key));
  payload.zones.forEach((zone, index) => {
    if (!zone.key.trim() || !zone.name.trim())
      issues.push({ step:'privacy', code:`zone_${index}`, message:`Zone ${index + 1} needs a name.` });
    if (zone.prerequisiteZoneKeys.some(key => key === zone.key || !zoneKeys.has(key)))
      issues.push({ step:'privacy', code:`zone_dependency_${index}`, message:`Zone ${index + 1} has an invalid prerequisite.` });
  });
  const zoneDependencies = new Map(payload.zones.map(zone => [zone.key, zone.prerequisiteZoneKeys]));
  const visitingZones = new Set<string>();
  const visitedZones = new Set<string>();
  const visitZone = (key: string): boolean => {
    if (visitingZones.has(key)) return true;
    if (visitedZones.has(key)) return false;
    visitingZones.add(key);
    const cycle = (zoneDependencies.get(key) ?? []).some(visitZone);
    visitingZones.delete(key);
    visitedZones.add(key);
    return cycle;
  };
  if ([...zoneKeys].some(visitZone))
    issues.push({ step:'privacy', code:'zone_dependency_cycle', message:'Zone prerequisites cannot contain a circular dependency.' });
  return { valid: issues.length === 0, issues };
}