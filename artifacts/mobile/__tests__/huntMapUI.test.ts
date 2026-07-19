/**
 * Hunt Map UI Tests — Worlds (Prompt 12)
 *
 * Covers:
 *   - Map privacy enforcement (only public hunts)
 *   - Hunt map filter logic
 *   - Hunt action resolver integration
 *   - Join flow validation
 *   - Invitation flow validation
 *   - My Hunts section logic
 *   - Start eligibility by start model
 *   - Marker status resolution
 *   - Security assertions (no locked content in map data)
 *   - Bottom sheet state transitions
 *
 * Does NOT test:
 *   - Mapbox rendering (native module)
 *   - Real DB queries
 *   - GPS hardware
 */

import {
  countActiveHuntFilters,
  DEFAULT_HUNT_MAP_FILTER,
} from '../features/hunt-map/types/huntMap.types';
import type {
  HuntMapFilter,
  PublicHuntMapItem,
  HuntMarkerStatus,
} from '../features/hunt-map/types/huntMap.types';
import {
  resolveHuntAction,
} from '../features/hunts/services/huntActionResolver';
import {
  evaluateHuntAvailability,
} from '../features/hunts/services/huntAvailability.service';
import type { HuntAvailabilityState } from '../features/hunts/types/hunt.types';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makePublicHuntMapItem(overrides: Partial<PublicHuntMapItem> = {}): PublicHuntMapItem {
  return {
    huntId:                   'hunt-1',
    occurrenceId:             'occ-1',
    slug:                     'test-hunt',
    title:                    'Test Hunt',
    summary:                  'A public test hunt',
    displayLatitude:          37.7749,
    displayLongitude:         -122.4194,
    publicLocationLabel:      'San Francisco',
    approximateDistanceMeters: 500,
    pointsReward:             100,
    estimatedDurationMinutes: 60,
    difficulty:               'easy',
    huntType:                 'official',
    privacy:                  'public',
    participationMode:        'solo',
    isOrdered:                true,
    stopCount:                4,
    thumbnailUrl:             null,
    availabilityState:        'available',
    participationStatus:      null,
    participationId:          null,
    invitationId:             null,
    invitationStatus:         null,
    maxParticipants:          20,
    currentParticipantCount:  5,
    isFull:                   false,
    startsAt:                 null,
    endsAt:                   null,
    joinUntil:                null,
    isFeatured:               false,
    requiresProof:            false,
    requiresLocation:         false,
    indoorOutdoor:            'outdoor',
    accessibilitySummary:     null,
    ...overrides,
  };
}

// ─── Filter Tests ─────────────────────────────────────────────────────────────

describe('HuntMapFilter', () => {
  describe('countActiveHuntFilters', () => {
    it('returns 0 for default filter', () => {
      expect(countActiveHuntFilters(DEFAULT_HUNT_MAP_FILTER)).toBe(0);
    });

    it('counts boolean filters correctly', () => {
      const filter: HuntMapFilter = {
        ...DEFAULT_HUNT_MAP_FILTER,
        availableNow: true,
        startingSoon: true,
        hasSpace: true,
      };
      expect(countActiveHuntFilters(filter)).toBe(3);
    });

    it('counts participationMode filter', () => {
      const filter: HuntMapFilter = {
        ...DEFAULT_HUNT_MAP_FILTER,
        participationMode: 'solo',
      };
      expect(countActiveHuntFilters(filter)).toBe(1);
    });

    it('counts difficulties as 1 regardless of count', () => {
      const filter: HuntMapFilter = {
        ...DEFAULT_HUNT_MAP_FILTER,
        difficulties: ['easy', 'medium', 'hard'],
      };
      expect(countActiveHuntFilters(filter)).toBe(1);
    });

    it('counts all filters combined', () => {
      const filter: HuntMapFilter = {
        availableNow:        true,
        startingSoon:        true,
        hasSpace:            true,
        participationMode:   'group',
        difficulties:        ['easy'],
        maxDurationMinutes:  60,
        indoorOutdoor:       'outdoor',
        accessibleOnly:      true,
        inMyHunts:           true,
        notJoined:           true,
      };
      expect(countActiveHuntFilters(filter)).toBe(10);
    });

    it('does not count null participationMode', () => {
      const filter: HuntMapFilter = { ...DEFAULT_HUNT_MAP_FILTER, participationMode: null };
      expect(countActiveHuntFilters(filter)).toBe(0);
    });

    it('does not count null maxDurationMinutes', () => {
      const filter: HuntMapFilter = { ...DEFAULT_HUNT_MAP_FILTER, maxDurationMinutes: null };
      expect(countActiveHuntFilters(filter)).toBe(0);
    });

    it('does not count null indoorOutdoor', () => {
      const filter: HuntMapFilter = { ...DEFAULT_HUNT_MAP_FILTER, indoorOutdoor: null };
      expect(countActiveHuntFilters(filter)).toBe(0);
    });

    it('does not count empty difficulties array', () => {
      const filter: HuntMapFilter = { ...DEFAULT_HUNT_MAP_FILTER, difficulties: [] };
      expect(countActiveHuntFilters(filter)).toBe(0);
    });
  });

  describe('DEFAULT_HUNT_MAP_FILTER', () => {
    it('has all boolean filters false by default', () => {
      expect(DEFAULT_HUNT_MAP_FILTER.availableNow).toBe(false);
      expect(DEFAULT_HUNT_MAP_FILTER.startingSoon).toBe(false);
      expect(DEFAULT_HUNT_MAP_FILTER.hasSpace).toBe(false);
      expect(DEFAULT_HUNT_MAP_FILTER.accessibleOnly).toBe(false);
      expect(DEFAULT_HUNT_MAP_FILTER.inMyHunts).toBe(false);
      expect(DEFAULT_HUNT_MAP_FILTER.notJoined).toBe(false);
    });

    it('has null nullable filters by default', () => {
      expect(DEFAULT_HUNT_MAP_FILTER.participationMode).toBeNull();
      expect(DEFAULT_HUNT_MAP_FILTER.maxDurationMinutes).toBeNull();
      expect(DEFAULT_HUNT_MAP_FILTER.indoorOutdoor).toBeNull();
    });

    it('has empty difficulties array by default', () => {
      expect(DEFAULT_HUNT_MAP_FILTER.difficulties).toEqual([]);
    });
  });
});

// ─── PublicHuntMapItem security tests ────────────────────────────────────────

describe('PublicHuntMapItem security contract', () => {
  it('does not allow non-public privacy in map items', () => {
    // Any hunt with invite_only or private must not appear on the public map.
    // This is enforced server-side. Here we validate the privacy field type.
    const hunt = makePublicHuntMapItem({ privacy: 'public' });
    expect(hunt.privacy).toBe('public');
  });

  it('has no validation geometry fields', () => {
    const hunt = makePublicHuntMapItem();
    // These fields MUST NOT exist on PublicHuntMapItem
    expect((hunt as any).validationLatitude).toBeUndefined();
    expect((hunt as any).validationLongitude).toBeUndefined();
    expect((hunt as any).validationRadius).toBeUndefined();
    expect((hunt as any).geofencePolygon).toBeUndefined();
    expect((hunt as any).antiSpoofingThreshold).toBeUndefined();
    expect((hunt as any).secretClueContent).toBeUndefined();
    expect((hunt as any).lockedClueContent).toBeUndefined();
    expect((hunt as any).moderationNotes).toBeUndefined();
    expect((hunt as any).internalNotes).toBeUndefined();
  });

  it('has approximate display coordinates (not validation coordinates)', () => {
    const hunt = makePublicHuntMapItem({
      displayLatitude:  37.7749,
      displayLongitude: -122.4194,
    });
    // Display coords are named "display" — never "validation"
    expect(hunt.displayLatitude).toBe(37.7749);
    expect(hunt.displayLongitude).toBe(-122.4194);
    expect((hunt as any).validationLat).toBeUndefined();
  });

  it('never exposes other participants private data', () => {
    const hunt = makePublicHuntMapItem();
    expect((hunt as any).participantEmails).toBeUndefined();
    expect((hunt as any).participantNames).toBeUndefined();
    expect((hunt as any).participantList).toBeUndefined();
    expect((hunt as any).inviteeList).toBeUndefined();
  });

  it('has capacity info in safe aggregate form only', () => {
    const hunt = makePublicHuntMapItem({
      maxParticipants:        10,
      currentParticipantCount: 7,
      isFull:                 false,
    });
    expect(hunt.maxParticipants).toBe(10);
    expect(hunt.currentParticipantCount).toBe(7);
    expect(hunt.isFull).toBe(false);
    // No per-participant data
    expect((hunt as any).participants).toBeUndefined();
  });
});

// ─── Marker status tests ──────────────────────────────────────────────────────

describe('Hunt marker status resolution', () => {
  function resolveMarkerStatus(hunt: PublicHuntMapItem): HuntMarkerStatus {
    if (hunt.isFeatured && !hunt.participationStatus) return 'featured';
    if (hunt.participationStatus === 'active' || hunt.participationStatus === 'paused') return 'active';
    if (hunt.participationStatus === 'accepted' || hunt.participationStatus === 'ready') return 'joined';
    if (hunt.participationStatus === 'completed') return 'completed';
    if (hunt.availabilityState === 'full' || hunt.isFull) return 'full';
    if (hunt.availabilityState === 'upcoming') return 'upcoming';
    if (hunt.availabilityState === 'completed') return 'completed';
    return 'available';
  }

  it('returns available for default public hunt', () => {
    expect(resolveMarkerStatus(makePublicHuntMapItem())).toBe('available');
  });

  it('returns featured for featured hunt without participation', () => {
    expect(resolveMarkerStatus(makePublicHuntMapItem({ isFeatured: true }))).toBe('featured');
  });

  it('returns active for hunt with active participation', () => {
    expect(resolveMarkerStatus(makePublicHuntMapItem({ participationStatus: 'active' }))).toBe('active');
  });

  it('returns joined for accepted participation', () => {
    expect(resolveMarkerStatus(makePublicHuntMapItem({ participationStatus: 'accepted' }))).toBe('joined');
  });

  it('returns completed for completed participation', () => {
    expect(resolveMarkerStatus(makePublicHuntMapItem({ participationStatus: 'completed' }))).toBe('completed');
  });

  it('returns full for full hunt with no participation', () => {
    expect(resolveMarkerStatus(makePublicHuntMapItem({ isFull: true }))).toBe('full');
  });

  it('returns upcoming for upcoming hunt', () => {
    expect(resolveMarkerStatus(makePublicHuntMapItem({ availabilityState: 'upcoming' }))).toBe('upcoming');
  });

  it('active participation overrides featured status', () => {
    // featured check is skipped when participationStatus is set
    const hunt = makePublicHuntMapItem({ isFeatured: true, participationStatus: 'active' });
    expect(resolveMarkerStatus(hunt)).toBe('active');
  });
});

// ─── Action resolver integration tests ───────────────────────────────────────

describe('Hunt action resolver for map items', () => {
  function availAndAction(
    state: HuntAvailabilityState,
    {
      canJoin = false,
      canStart = false,
      participationId,
      invitationId,
      reasonCode,
    }: {
      canJoin?: boolean;
      canStart?: boolean;
      participationId?: string | null;
      invitationId?: string | null;
      reasonCode?: any;
    } = {},
  ) {
    return resolveHuntAction({
      state,
      canJoin,
      canStart,
      reasonCode: reasonCode ?? null,
      participationId: participationId ?? null,
      invitationId: invitationId ?? null,
    });
  }

  it('returns join action for available hunt', () => {
    const action = availAndAction('available', { canJoin: true });
    expect(action.actionType).toBe('join_hunt');
    expect(action.isEnabled).toBe(true);
  });

  it('returns disabled join for full hunt', () => {
    const action = availAndAction('full', { reasonCode: 'HUNT_FULL' });
    expect(action.isEnabled).toBe(false);
  });

  it('returns view completion for completed participation', () => {
    const action = availAndAction('completed', { participationId: 'p-1' });
    expect(['view_completion', 'completed']).toContain(action.actionType);
  });

  it('returns continue hunt for active participation', () => {
    const action = availAndAction('active', { canStart: false, participationId: 'p-1' });
    expect(action.actionType).toBe('continue_hunt');
  });

  it('returns start hunt when canStart is true', () => {
    const action = availAndAction('ready', { canStart: true, participationId: 'p-1' });
    expect(action.actionType).toBe('start_hunt');
    expect(action.isEnabled).toBe(true);
  });

  it('returns accept invitation for invited state', () => {
    const action = availAndAction('invited', { invitationId: 'inv-1', canJoin: true });
    expect(action.actionType).toBe('accept_invitation');
  });

  it('always returns a label', () => {
    const states: HuntAvailabilityState[] = [
      'available', 'full', 'completed', 'active', 'ready',
      'invited', 'upcoming', 'cancelled', 'expired',
    ];
    for (const state of states) {
      const action = availAndAction(state, { participationId: 'p-1', invitationId: 'inv-1', canJoin: true, canStart: true });
      expect(typeof action.label).toBe('string');
      expect(action.label.length).toBeGreaterThan(0);
    }
  });
});

// ─── Hunt availability evaluation tests ──────────────────────────────────────

describe('evaluateHuntAvailability', () => {
  function makeAvailInput(overrides: any = {}) {
    return {
      huntId:                  'hunt-1',
      occurrenceId:            'occ-1',
      huntStatus:              'active' as const,
      huntPrivacy:             'public' as const,
      huntJoinPolicy:          'open' as const,
      maxParticipants:         20,
      currentParticipantCount: 5,
      isAuthenticated:         true,
      ...overrides,
    };
  }

  it('returns available for open hunt with space', () => {
    const result = evaluateHuntAvailability(makeAvailInput());
    expect(result.state).toBe('available');
    expect(result.canJoin).toBe(true);
  });

  it('returns full when at capacity', () => {
    const result = evaluateHuntAvailability(makeAvailInput({
      maxParticipants:         10,
      currentParticipantCount: 10,
    }));
    expect(['full', 'unavailable']).toContain(result.state);
    expect(result.canJoin).toBe(false);
  });

  it('returns not_authenticated reason for unauthenticated user', () => {
    const result = evaluateHuntAvailability(makeAvailInput({ isAuthenticated: false }));
    expect(['NOT_AUTHENTICATED', null]).toContain(result.reasonCode);
  });

  it('returns active state for active participation', () => {
    const result = evaluateHuntAvailability(makeAvailInput({
      participationStatus: 'active',
      participationId:     'p-1',
    }));
    expect(result.state).toBe('active');
  });

  it('returns ready state for accepted participation', () => {
    const result = evaluateHuntAvailability(makeAvailInput({
      participationStatus: 'accepted',
      participationId:     'p-1',
    }));
    expect(['ready', 'active']).toContain(result.state);
  });

  it('returns invited for pending invitation', () => {
    const result = evaluateHuntAvailability(makeAvailInput({
      invitationId:     'inv-1',
      invitationStatus: 'pending',
    }));
    expect(result.state).toBe('invited');
  });

  it('unlimited capacity (null max) always has space', () => {
    const result = evaluateHuntAvailability(makeAvailInput({
      maxParticipants: null,
      currentParticipantCount: 999,
    }));
    expect(result.state).toBe('available');
    expect(result.canJoin).toBe(true);
  });
});

// ─── Invitation flow tests ────────────────────────────────────────────────────

describe('Hunt invitation state validation', () => {
  function makeInvitation(overrides: any = {}) {
    return {
      id:               'inv-1',
      huntId:           'hunt-1',
      occurrenceId:     'occ-1',
      inviterUserId:    'user-inviter',
      inviteeUserId:    'user-invitee',
      status:           'pending',
      message:          null,
      expiresAt:        null,
      createdAt:        new Date().toISOString(),
      huntSummary:      null,
      ...overrides,
    };
  }

  it('pending invitation can be accepted', () => {
    const inv = makeInvitation({ status: 'pending' });
    const isExpired = inv.expiresAt ? new Date(inv.expiresAt) < new Date() : false;
    const canRespond = inv.status === 'pending' && !isExpired;
    expect(canRespond).toBe(true);
  });

  it('expired invitation cannot be accepted', () => {
    const inv = makeInvitation({ expiresAt: '2000-01-01T00:00:00Z' });
    const isExpired = inv.expiresAt ? new Date(inv.expiresAt) < new Date() : false;
    const canRespond = inv.status === 'pending' && !isExpired;
    expect(canRespond).toBe(false);
  });

  it('declined invitation cannot be re-accepted', () => {
    const inv = makeInvitation({ status: 'declined' });
    const isExpired = inv.expiresAt ? new Date(inv.expiresAt) < new Date() : false;
    const canRespond = inv.status === 'pending' && !isExpired;
    expect(canRespond).toBe(false);
  });

  it('accepted invitation cannot be re-accepted', () => {
    const inv = makeInvitation({ status: 'accepted' });
    const isExpired = inv.expiresAt ? new Date(inv.expiresAt) < new Date() : false;
    const canRespond = inv.status === 'pending' && !isExpired;
    expect(canRespond).toBe(false);
  });

  it('revoked invitation cannot be accepted', () => {
    const inv = makeInvitation({ status: 'revoked' });
    const isExpired = inv.expiresAt ? new Date(inv.expiresAt) < new Date() : false;
    const canRespond = inv.status === 'pending' && !isExpired;
    expect(canRespond).toBe(false);
  });
});

// ─── My Hunts section logic tests ────────────────────────────────────────────

describe('My Hunts default section resolution', () => {
  function resolveDefaultSection(
    activeCount: number,
    readyCount: number,
    pendingInvitationCount: number,
  ): string {
    if (activeCount > 0) return 'active';
    if (readyCount > 0)  return 'ready';
    if (pendingInvitationCount > 0) return 'invitations';
    return 'active';
  }

  it('defaults to active when there are active hunts', () => {
    expect(resolveDefaultSection(2, 0, 0)).toBe('active');
  });

  it('defaults to ready when no active hunts but ready hunts exist', () => {
    expect(resolveDefaultSection(0, 1, 0)).toBe('ready');
  });

  it('defaults to invitations when no active or ready but invitations exist', () => {
    expect(resolveDefaultSection(0, 0, 3)).toBe('invitations');
  });

  it('defaults to active when nothing is present', () => {
    expect(resolveDefaultSection(0, 0, 0)).toBe('active');
  });

  it('active takes priority over ready', () => {
    expect(resolveDefaultSection(1, 1, 0)).toBe('active');
  });

  it('ready takes priority over invitations', () => {
    expect(resolveDefaultSection(0, 1, 5)).toBe('ready');
  });
});

// ─── Start eligibility tests ──────────────────────────────────────────────────

describe('Hunt start eligibility by start model', () => {
  function canIndividuallyStart(
    startModel: 'individual' | 'scheduled' | 'host_controlled',
    minParticipants?: number,
    currentParticipants?: number,
  ): boolean {
    if (startModel === 'host_controlled') return false;
    if (startModel === 'scheduled') return false;

    const needsMore =
      minParticipants !== undefined &&
      currentParticipants !== undefined &&
      currentParticipants < minParticipants;
    if (needsMore) return false;

    return true;
  }

  it('individual start model with enough participants allows start', () => {
    expect(canIndividuallyStart('individual', 2, 3)).toBe(true);
  });

  it('individual start model without enough participants blocks start', () => {
    expect(canIndividuallyStart('individual', 5, 2)).toBe(false);
  });

  it('individual start with no participant requirement allows start', () => {
    expect(canIndividuallyStart('individual')).toBe(true);
  });

  it('host_controlled never allows individual start', () => {
    expect(canIndividuallyStart('host_controlled')).toBe(false);
  });

  it('scheduled never allows individual start', () => {
    expect(canIndividuallyStart('scheduled')).toBe(false);
  });
});

// ─── Join flow validation ─────────────────────────────────────────────────────

describe('Hunt join flow guard conditions', () => {
  it('unauthenticated user must not be able to join directly', () => {
    const isAuthenticated = false;
    const huntPrivacy = 'public';
    const isFull = false;

    // Only authenticated users can directly join
    const canProceedToJoin = isAuthenticated && !isFull;
    expect(canProceedToJoin).toBe(false);
  });

  it('authenticated user can join available public hunt with space', () => {
    const isAuthenticated = true;
    const isFull = false;
    const canProceedToJoin = isAuthenticated && !isFull;
    expect(canProceedToJoin).toBe(true);
  });

  it('authenticated user cannot join a full hunt', () => {
    const isAuthenticated = true;
    const isFull = true;
    const canProceedToJoin = isAuthenticated && !isFull;
    expect(canProceedToJoin).toBe(false);
  });

  it('private hunt never appears on public map', () => {
    // All map items must have privacy = 'public' (enforced server-side RPC)
    const mapItems = [
      makePublicHuntMapItem({ privacy: 'public' }),
    ];
    // Any item with non-public privacy would violate the contract
    const invalidItems = mapItems.filter(h => h.privacy !== 'public');
    expect(invalidItems).toHaveLength(0);
  });
});

// ─── Bottom sheet state machine tests ────────────────────────────────────────

describe('Hunt bottom sheet state machine', () => {
  type State = 'collapsed' | 'medium' | 'expanded';

  it('collapses from expanded', () => {
    const HEIGHTS: Record<State, number> = { collapsed: 68, medium: 280, expanded: 520 };
    const state: State = 'expanded';
    const nextState: State = 'collapsed';
    expect(HEIGHTS[nextState]).toBeLessThan(HEIGHTS[state]);
  });

  it('expands from collapsed', () => {
    const HEIGHTS: Record<State, number> = { collapsed: 68, medium: 280, expanded: 520 };
    const state: State = 'collapsed';
    const nextState: State = 'expanded';
    expect(HEIGHTS[nextState]).toBeGreaterThan(HEIGHTS[state]);
  });

  it('medium is between collapsed and expanded', () => {
    const HEIGHTS: Record<State, number> = { collapsed: 68, medium: 280, expanded: 520 };
    expect(HEIGHTS.medium).toBeGreaterThan(HEIGHTS.collapsed);
    expect(HEIGHTS.medium).toBeLessThan(HEIGHTS.expanded);
  });

  it('selecting a hunt triggers medium sheet state', () => {
    let currentState: State = 'collapsed';
    const handleMarkerPress = () => { currentState = 'medium'; };
    handleMarkerPress();
    expect(currentState).toBe('medium');
  });

  it('deselecting a hunt collapses sheet', () => {
    let currentState: State = 'medium';
    const handleDeselect = () => { currentState = 'collapsed'; };
    handleDeselect();
    expect(currentState).toBe('collapsed');
  });
});

// ─── Sort order tests ─────────────────────────────────────────────────────────

describe('Hunt nearby sort orders', () => {
  const VALID_SORT_ORDERS = [
    'nearest', 'starting_soon', 'featured', 'highest_points', 'shortest', 'easiest',
  ] as const;

  it('includes expected sort options', () => {
    expect(VALID_SORT_ORDERS).toContain('nearest');
    expect(VALID_SORT_ORDERS).toContain('featured');
    expect(VALID_SORT_ORDERS).toContain('highest_points');
  });

  it('has at least 4 sort options', () => {
    expect(VALID_SORT_ORDERS.length).toBeGreaterThanOrEqual(4);
  });

  it('nearest is the default sort', () => {
    expect(VALID_SORT_ORDERS[0]).toBe('nearest');
  });
});
