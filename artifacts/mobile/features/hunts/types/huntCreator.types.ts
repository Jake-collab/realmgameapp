import type {
  Difficulty,
  HuntPrivacy,
  HuntStartModel,
  ParticipationMode,
  StopOrdering,
} from './hunt.types';

export type CreatorProofType = 'none' | 'text' | 'photo' | 'location' | 'photo_and_location';

export interface HuntCreatorStop {
  id?: string;
  title: string;
  description: string;
  clueText: string;
  hintText: string;
  completionMethod: CreatorProofType;
  isRequired: boolean;
  publicLat: number | null;
  publicLng: number | null;
  publicRadius: number;
  validationRadius: number;
}

export interface HuntCreatorDraft {
  id?: string;
  title: string;
  summary: string;
  description: string;
  difficulty: Difficulty;
  pointsReward: number;
  estimatedDurationMinutes: number;
  stopOrdering: StopOrdering;
  participationMode: ParticipationMode;
  startModel: HuntStartModel;
  startsAt: string | null;
  endsAt: string | null;
  privacy: HuntPrivacy;
  maxParticipants: number | null;
  publicMeetingInfo: string;
  safetyNote: string;
  accessibilityNote: string;
  coverMediaId: string | null;
  stops: HuntCreatorStop[];
  updatedAt?: string;
  status?: string;
}

export interface CreatedHuntSummary {
  id: string;
  title: string;
  summary: string;
  status: string;
  privacy: HuntPrivacy;
  pointsReward: number;
  stopCount: number;
  startsAt: string | null;
  updatedAt: string;
  occurrenceId: string | null;
}