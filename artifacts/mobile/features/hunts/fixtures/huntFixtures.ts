/**
 * Hunt Dev Fixtures — Worlds
 *
 * Development-only fixtures for Hunt domain testing and UI development.
 * NEVER shipped to production. All IDs are fake UUIDs. No private geometry.
 *
 * Usage:
 *   import { DEV_HUNT_FIXTURES } from './fixtures/huntFixtures';
 *   // Use only inside __DEV__ guards or test files.
 */

if (!__DEV__) {
  // Belt-and-suspenders: if this file is ever imported in production, throw.
  throw new Error('[DEV] Hunt fixtures must not be used in production.');
}

import type {
  HuntDetail,
  HuntSummary,
  HuntInvitation,
  ActiveHunt,
  HuntParticipant,
  MyHuntsSummary,
  HuntOccurrence,
} from '../types/hunt.types';

const NOW = new Date().toISOString();
const FUTURE_1H = new Date(Date.now() + 60 * 60_000).toISOString();
const FUTURE_24H = new Date(Date.now() + 24 * 60 * 60_000).toISOString();
const FUTURE_7D  = new Date(Date.now() + 7 * 24 * 60 * 60_000).toISOString();
const PAST_1H    = new Date(Date.now() - 60 * 60_000).toISOString();
const PAST_7D    = new Date(Date.now() - 7 * 24 * 60 * 60_000).toISOString();

// ─── Fake user IDs ────────────────────────────────────────────────────────────
const DEV_USER_ID        = '00000000-dead-beef-0001-000000000001';
const DEV_CREATOR_ID     = '00000000-dead-beef-0001-000000000002';
const DEV_INVITER_ID     = '00000000-dead-beef-0001-000000000003';

// ─── Hunt IDs ─────────────────────────────────────────────────────────────────
const HUNT_A_ID = '10000000-aaaa-aaaa-aaaa-000000000001';
const HUNT_B_ID = '10000000-aaaa-aaaa-aaaa-000000000002';
const HUNT_C_ID = '10000000-aaaa-aaaa-aaaa-000000000003';
const HUNT_D_ID = '10000000-aaaa-aaaa-aaaa-000000000004';
const HUNT_E_ID = '10000000-aaaa-aaaa-aaaa-000000000005';

// ─── Base capacity state ──────────────────────────────────────────────────────
const UNLIMITED_CAPACITY = {
  maxParticipants: null,
  currentCount: 0,
  isUnlimited: true,
  isFull: false,
  availableSlots: null,
  pendingInvitationCount: 0,
};

// ─── Hunt fixtures ────────────────────────────────────────────────────────────

/**
 * [DEV] Hunt A — Public, open, official. User has not joined.
 * Represents the most common discovery state: available to join.
 */
export const DEV_HUNT_A: HuntDetail = {
  id:                      HUNT_A_ID,
  slug:                    '[dev]-downtown-photo-walk',
  title:                   '[DEV] Downtown Photo Walk',
  summary:                 'A walking hunt through the historic downtown district.',
  description:             'Join us for a guided photo challenge through downtown. Visit 5 landmarks, capture creative shots, and earn points along the way. Great for solo explorers or groups.',
  huntType:                'official',
  privacy:                 'public',
  difficulty:              'easy',
  estimatedDurationMinutes: 90,
  pointsReward:            500,
  stopCount:               5,
  isOrdered:               true,
  participationMode:       'solo',
  availabilityState:       'available',
  participationStatus:     null,
  participationId:         null,
  invitationId:            null,
  invitationStatus:        null,
  thumbnailUrl:            null,
  occurrenceId:            '20000000-aaaa-aaaa-aaaa-000000000001',
  startsAt:                NOW,
  endsAt:                  FUTURE_7D,
  capacityState:           { ...UNLIMITED_CAPACITY, currentCount: 12 },
  displayLat:              37.7749,
  displayLng:              -122.4194,
  publicLocationLabel:     'City Hall Plaza',
  safetyNote:              'Use crosswalks. Watch for traffic.',
  accessibilityNote:       'Paved surfaces throughout. Wheelchair accessible.',
  publicMeetingInfo:       'Meet at the fountain on Market Street.',
  venueHoursNote:          'Most locations open 9am–8pm.',
  creator:                 { userId: null, displayName: 'Worlds Team', avatarUrl: null, isAdmin: true },
  occurrence:              DEV_OCCURRENCE_A(),
  prerequisites:           [],
  primaryAction: {
    actionType:           'join_hunt',
    label:                'Join Hunt',
    isEnabled:            true,
    requiresConfirmation: true,
    confirmationMessage:  "Ready to join? You'll receive stops and clues once the hunt starts.",
    reasonCode:           null,
    loadingBehavior:      'replace_label',
  },
  stops: [
    {
      id: '30000000-stop-aaaa-0001-000000000001',
      sortOrder: 0,
      title: 'The Grand Fountain',
      description: 'Start at the historic fountain in the heart of downtown.',
      stopRole: 'start',
      isRequired: true,
      estimatedDurationMinutes: 10,
      safetyNote: null,
      accessibilityNote: 'Fountain is wheelchair accessible.',
      completionMethod: 'image',
      publicLat: 37.7749,
      publicLng: -122.4194,
      publicRadius: 100,
    },
    {
      id: '30000000-stop-aaaa-0001-000000000002',
      sortOrder: 1,
      title: 'Historic Clocktower',
      description: 'Find the old clocktower and capture its reflection.',
      stopRole: 'waypoint',
      isRequired: true,
      estimatedDurationMinutes: 15,
      safetyNote: null,
      accessibilityNote: null,
      completionMethod: 'image',
      publicLat: null,
      publicLng: null,
      publicRadius: null,
    },
    {
      id: '30000000-stop-aaaa-0001-000000000003',
      sortOrder: 2,
      title: 'Mural District',
      description: null,
      stopRole: 'waypoint',
      isRequired: true,
      estimatedDurationMinutes: 20,
      safetyNote: null,
      accessibilityNote: null,
      completionMethod: 'image',
      publicLat: null,
      publicLng: null,
      publicRadius: null,
    },
    {
      id: '30000000-stop-aaaa-0001-000000000004',
      sortOrder: 3,
      title: 'Market Hall',
      description: null,
      stopRole: 'waypoint',
      isRequired: true,
      estimatedDurationMinutes: 20,
      safetyNote: null,
      accessibilityNote: null,
      completionMethod: 'image_and_location',
      publicLat: null,
      publicLng: null,
      publicRadius: null,
    },
    {
      id: '30000000-stop-aaaa-0001-000000000005',
      sortOrder: 4,
      title: 'Victory Square',
      description: 'The final stop — a historic square with a surprise.',
      stopRole: 'final',
      isRequired: true,
      estimatedDurationMinutes: 25,
      safetyNote: null,
      accessibilityNote: null,
      completionMethod: 'image',
      publicLat: null,
      publicLng: null,
      publicRadius: null,
    },
  ],
  rewardSnapshot: null,
};

/**
 * [DEV] Hunt B — Invite-only. User has a pending invitation.
 */
export const DEV_HUNT_B: HuntSummary = {
  id:                      HUNT_B_ID,
  slug:                    '[dev]-rooftop-challenge',
  title:                   '[DEV] Rooftop Challenge',
  summary:                 'An exclusive private hunt across rooftop venues.',
  huntType:                'custom',
  privacy:                 'invite_only',
  difficulty:              'hard',
  estimatedDurationMinutes: 180,
  pointsReward:            1200,
  stopCount:               8,
  isOrdered:               true,
  participationMode:       'solo',
  availabilityState:       'invited',
  participationStatus:     null,
  participationId:         null,
  invitationId:            '40000000-inv-aaaa-0001-000000000001',
  invitationStatus:        'pending',
  thumbnailUrl:            null,
  occurrenceId:            '20000000-aaaa-aaaa-aaaa-000000000002',
  startsAt:                FUTURE_1H,
  endsAt:                  FUTURE_24H,
  capacityState:           { ...UNLIMITED_CAPACITY, maxParticipants: 10, currentCount: 4, isUnlimited: false, availableSlots: 6 },
  displayLat:              37.7891,
  displayLng:              -122.4089,
  publicLocationLabel:     'Arts District Entrance',
};

/**
 * [DEV] Hunt C — Active hunt the user is currently participating in.
 */
export const DEV_HUNT_C: HuntSummary = {
  id:                      HUNT_C_ID,
  slug:                    '[dev]-harbor-expedition',
  title:                   '[DEV] Harbor Expedition',
  summary:                 'Discover hidden history along the waterfront.',
  huntType:                'official',
  privacy:                 'public',
  difficulty:              'medium',
  estimatedDurationMinutes: 120,
  pointsReward:            800,
  stopCount:               6,
  isOrdered:               true,
  participationMode:       'solo',
  availabilityState:       'active',
  participationStatus:     'active',
  participationId:         '50000000-part-aaaa-0001-000000000001',
  invitationId:            null,
  invitationStatus:        null,
  thumbnailUrl:            null,
  occurrenceId:            '20000000-aaaa-aaaa-aaaa-000000000003',
  startsAt:                PAST_1H,
  endsAt:                  FUTURE_24H,
  capacityState:           { ...UNLIMITED_CAPACITY, currentCount: 7 },
  displayLat:              37.8045,
  displayLng:              -122.4113,
  publicLocationLabel:     'Ferry Building',
};

/**
 * [DEV] Hunt D — Completed hunt (user finished).
 */
export const DEV_HUNT_D: HuntSummary = {
  id:                      HUNT_D_ID,
  slug:                    '[dev]-golden-gate-trail',
  title:                   '[DEV] Golden Gate Trail',
  summary:                 'An iconic route with stunning views.',
  huntType:                'official',
  privacy:                 'public',
  difficulty:              'medium',
  estimatedDurationMinutes: 150,
  pointsReward:            750,
  stopCount:               7,
  isOrdered:               true,
  participationMode:       'solo',
  availabilityState:       'completed',
  participationStatus:     'completed',
  participationId:         '50000000-part-aaaa-0001-000000000002',
  invitationId:            null,
  invitationStatus:        null,
  thumbnailUrl:            null,
  occurrenceId:            null,
  startsAt:                PAST_7D,
  endsAt:                  PAST_1H,
  capacityState:           { ...UNLIMITED_CAPACITY, currentCount: 42 },
  displayLat:              37.8197,
  displayLng:              -122.4786,
  publicLocationLabel:     'Visitor Center',
};

/**
 * [DEV] Hunt E — Upcoming scheduled hunt.
 */
export const DEV_HUNT_E: HuntSummary = {
  id:                      HUNT_E_ID,
  slug:                    '[dev]-night-mystery-walk',
  title:                   '[DEV] Night Mystery Walk',
  summary:                 'A spooky evening hunt through historic landmarks.',
  huntType:                'official',
  privacy:                 'public',
  difficulty:              'hard',
  estimatedDurationMinutes: 120,
  pointsReward:            1000,
  stopCount:               6,
  isOrdered:               false,
  participationMode:       'solo_or_group',
  availabilityState:       'upcoming',
  participationStatus:     null,
  participationId:         null,
  invitationId:            null,
  invitationStatus:        null,
  thumbnailUrl:            null,
  occurrenceId:            '20000000-aaaa-aaaa-aaaa-000000000005',
  startsAt:                FUTURE_24H,
  endsAt:                  FUTURE_7D,
  capacityState:           { ...UNLIMITED_CAPACITY, maxParticipants: 50, currentCount: 8, isUnlimited: false, availableSlots: 42 },
  displayLat:              37.7833,
  displayLng:              -122.4167,
  publicLocationLabel:     'Old City Theater',
};

export const DEV_HUNT_FIXTURES: HuntSummary[] = [
  DEV_HUNT_A as HuntSummary,
  DEV_HUNT_B,
  DEV_HUNT_C,
  DEV_HUNT_D,
  DEV_HUNT_E,
];

// ─── Active hunt fixture ──────────────────────────────────────────────────────

export const DEV_ACTIVE_HUNT: ActiveHunt = {
  huntId:              HUNT_C_ID,
  huntTitle:           '[DEV] Harbor Expedition',
  occurrenceId:        '20000000-aaaa-aaaa-aaaa-000000000003',
  participationId:     '50000000-part-aaaa-0001-000000000001',
  participationStatus: 'active',
  participantRole:     'player',
  startedAt:           PAST_1H,
  completionDeadline:  FUTURE_24H,
  completedStopCount:  2,
  requiredStopCount:   6,
  totalStopCount:      6,
  rewardSnapshot: {
    huntVersion:       1,
    occurrenceId:      '20000000-aaaa-aaaa-aaaa-000000000003',
    pointsReward:      800,
    requiredStopCount: 6,
    proofConfigVersion: 1,
    completionDeadline: FUTURE_24H,
    participationMode: 'solo',
    groupRewardRule:   'individual_full_reward',
    snapshotAt:        PAST_1H,
  },
  currentStops: [
    {
      id: '30000000-stop-cccc-0001-000000000001',
      sortOrder: 0,
      title: 'Ferry Building',
      description: 'Start at the iconic ferry building.',
      stopRole: 'start',
      isRequired: true,
      estimatedDurationMinutes: 10,
      safetyNote: null,
      accessibilityNote: 'Fully accessible.',
      completionMethod: 'image',
      publicLat: 37.7955,
      publicLng: -122.3937,
      publicRadius: 100,
      progressStatus: 'completed',
      progressId: '60000000-prog-cccc-0001-000000000001',
      revealedAt: PAST_1H,
      clue: {
        id: '70000000-clue-cccc-0001-000000000001',
        clueText: 'Start where the bay meets the city. Look for the famous clock.',
        imageUrl: null,
        visibilityState: 'completed',
        hintAvailable: false,
        revealRule: 'on_stop_reveal',
      },
      proofSubmissionId: null,
      attemptCount: 1,
    },
    {
      id: '30000000-stop-cccc-0001-000000000002',
      sortOrder: 1,
      title: 'The Embarcadero',
      description: 'Walk along the waterfront promenade.',
      stopRole: 'waypoint',
      isRequired: true,
      estimatedDurationMinutes: 20,
      safetyNote: null,
      accessibilityNote: null,
      completionMethod: 'image',
      publicLat: 37.7988,
      publicLng: -122.3972,
      publicRadius: 150,
      progressStatus: 'completed',
      progressId: '60000000-prog-cccc-0001-000000000002',
      revealedAt: PAST_1H,
      clue: {
        id: '70000000-clue-cccc-0001-000000000002',
        clueText: 'Find the historic pier number where the old ferries docked. Look for the wooden structure.',
        imageUrl: null,
        visibilityState: 'completed',
        hintAvailable: false,
        revealRule: 'on_stop_reveal',
      },
      proofSubmissionId: null,
      attemptCount: 1,
    },
    {
      id: '30000000-stop-cccc-0001-000000000003',
      sortOrder: 2,
      title: 'Fisherman\'s Wharf',
      description: 'The current active stop.',
      stopRole: 'waypoint',
      isRequired: true,
      estimatedDurationMinutes: 25,
      safetyNote: null,
      accessibilityNote: null,
      completionMethod: 'image_and_location',
      publicLat: 37.8080,
      publicLng: -122.4177,
      publicRadius: 200,
      progressStatus: 'in_progress',
      progressId: '60000000-prog-cccc-0001-000000000003',
      revealedAt: PAST_1H,
      clue: {
        id: '70000000-clue-cccc-0001-000000000003',
        clueText: 'The sea lions know where to rest. Join the crowd at the famous pier and capture their greeting.',
        imageUrl: null,
        visibilityState: 'revealed',
        hintAvailable: true,
        revealRule: 'on_stop_reveal',
      },
      proofSubmissionId: null,
      attemptCount: 0,
    },
  ],
  primaryAction: {
    actionType: 'continue_hunt',
    label: 'Continue Hunt',
    isEnabled: true,
    requiresConfirmation: false,
    confirmationMessage: null,
    reasonCode: null,
    loadingBehavior: 'spinner',
  },
  revealedStopLocations: [],
  groupSummary: null,
};

// ─── Invitation fixtures ──────────────────────────────────────────────────────

export const DEV_PENDING_INVITATION: HuntInvitation = {
  id:              '40000000-inv-aaaa-0001-000000000001',
  huntId:          HUNT_B_ID,
  occurrenceId:    '20000000-aaaa-aaaa-aaaa-000000000002',
  inviterUserId:   DEV_INVITER_ID,
  inviteeUserId:   DEV_USER_ID,
  status:          'pending',
  message:         'Hey! I think you\'d love this rooftop challenge. Join us!',
  roleOffered:     'player',
  expiresAt:       FUTURE_7D,
  respondedAt:     null,
  createdAt:       PAST_1H,
  huntSummary:     DEV_HUNT_B,
};

export const DEV_INVITATIONS: HuntInvitation[] = [DEV_PENDING_INVITATION];

// ─── My Hunts summary fixture ─────────────────────────────────────────────────

export const DEV_MY_HUNTS_SUMMARY: MyHuntsSummary = {
  active:      [DEV_HUNT_C as any],
  ready:       [],
  completed:   [DEV_HUNT_D as any],
  invitations: [DEV_PENDING_INVITATION],
  totalActiveCount: 1,
};

// ─── Dev occurrence ───────────────────────────────────────────────────────────

function DEV_OCCURRENCE_A(): HuntOccurrence {
  return {
    id:                            '20000000-aaaa-aaaa-aaaa-000000000001',
    huntId:                        HUNT_A_ID,
    occurrenceKey:                 `hunt:[dev]-downtown-photo-walk:open-${new Date().toISOString().slice(0, 7)}`,
    status:                        'active',
    startsAt:                      NOW,
    endsAt:                        FUTURE_7D,
    joinUntil:                     FUTURE_7D,
    startUntil:                    FUTURE_7D,
    completeUntil:                 FUTURE_7D,
    startedUsersGracePeriodMinutes: 60,
    hardExpiresAt:                 FUTURE_7D,
    maxParticipants:               null,
    minParticipants:               1,
    participantCount:              12,
    rewardOverridePoints:          null,
    startModel:                    'individual',
    publicMeetingInfo:             'Meet at the fountain on Market Street.',
    hostUserId:                    null,
    cancelledAt:                   null,
    cancellationReason:            null,
    createdAt:                     PAST_7D,
    updatedAt:                     NOW,
  };
}

// ─── Dev validation responses ─────────────────────────────────────────────────

export const DEV_VALIDATION_RESPONSES = {
  /** [DEV] Simulated successful location validation */
  success: {
    success: true,
    stopId: '30000000-stop-cccc-0001-000000000003',
    newStatus: 'completed' as const,
    nextStops: [],
    huntCompletionReady: false,
    reasonCode: null,
    userMessage: 'Location confirmed! Stop completed.',
  },
  /** [DEV] Simulated failed location validation */
  tooFar: {
    success: false,
    stopId: '30000000-stop-cccc-0001-000000000003',
    newStatus: 'in_progress' as const,
    nextStops: [],
    huntCompletionReady: false,
    reasonCode: 'LOCATION_VALIDATION_FAILED',
    userMessage: "You don't appear to be at the required location. Try again when you arrive.",
  },
};
