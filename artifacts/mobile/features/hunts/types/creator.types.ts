import type { Difficulty, HuntPrivacy, ParticipationMode, StopCompletionMethod, StopOrdering, HuntStatus } from './hunt.types';

export type CreatorStep = 'details' | 'privacy' | 'start' | 'stops' | 'invite' | 'preview' | 'review';
export type CreatorSaveState = 'idle' | 'saving' | 'saved' | 'saved_local' | 'unsynced' | 'error';
export type CreatorStopType = 'location' | 'activity' | 'clue' | 'mixed';
export type CollectibleRarity = 'COMMON' | 'UNCOMMON' | 'RARE' | 'EPIC' | 'LEGENDARY' | 'UNIQUE';

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
  };
}

export function normalizeCreatorPayload(value: Partial<HuntCreatorPayload> | null | undefined): HuntCreatorPayload {
  return { ...CREATOR_DEFAULT_PAYLOAD, ...(value ?? {}),
    stops: value?.stops ?? [], intendedInviteeIds: value?.intendedInviteeIds ?? [] };
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
  });
  return { valid: issues.length === 0, issues };
}