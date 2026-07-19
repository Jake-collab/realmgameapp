/**
 * Hunt Map Domain Types — Worlds
 *
 * All types for the Hunt map experience: public data contracts,
 * filters, sort orders, and UI state.
 *
 * Privacy rules enforced here:
 * - PublicHuntMapItem NEVER contains private validation geometry.
 * - PublicHuntMapItem NEVER contains locked clue content.
 * - PublicHuntMapItem NEVER contains other participants' private data.
 * - PublicHuntMapItem NEVER contains internal moderation notes.
 */

import type { BoundingBox } from '../../maps/utils/geoUtils';
import type { DistanceUnit } from '../../maps/config/mapConfig';
import type {
  HuntType,
  HuntPrivacy,
  HuntAvailabilityState,
  ParticipantStatus,
  InvitationStatus,
  Difficulty,
  ParticipationMode,
} from '../../hunts/types/hunt.types';

// ─── Public map item ──────────────────────────────────────────────────────────

/**
 * Public-safe Hunt data returned from the viewport or nearby query.
 * Contains ONLY what is safe to render on the map without authentication.
 *
 * MUST NOT contain: exact validation coordinates, private geofences,
 * locked clue content, invitee lists, proof submissions, moderation notes,
 * internal capacity fields, exact validation thresholds, service secrets.
 */
export interface PublicHuntMapItem {
  huntId: string;
  occurrenceId: string | null;
  slug: string;
  title: string;
  summary: string;
  /** Public approximate display coordinate — NOT any validation geometry */
  displayLatitude: number;
  displayLongitude: number;
  publicLocationLabel: string | null;
  /** Straight-line distance from user — labeled approximate in UI */
  approximateDistanceMeters: number | null;
  pointsReward: number;
  estimatedDurationMinutes: number | null;
  difficulty: Difficulty | null;
  huntType: HuntType;
  privacy: HuntPrivacy;
  participationMode: ParticipationMode;
  isOrdered: boolean;
  stopCount: number;
  thumbnailUrl: string | null;
  /** Availability state, computed with current-user context when authenticated */
  availabilityState: HuntAvailabilityState;
  /** Current-user participation — null for unauthenticated or non-participant */
  participationStatus: ParticipantStatus | null;
  participationId: string | null;
  invitationId: string | null;
  invitationStatus: InvitationStatus | null;
  /** Capacity */
  maxParticipants: number | null;
  currentParticipantCount: number;
  isFull: boolean;
  /** Timing */
  startsAt: string | null;
  endsAt: string | null;
  joinUntil: string | null;
  /** Feature flags */
  isFeatured: boolean;
  /** Safe proof requirement summary */
  requiresProof: boolean;
  requiresLocation: boolean;
  indoorOutdoor: 'indoor' | 'outdoor' | 'both' | null;
  accessibilitySummary: string | null;
}

// ─── Marker data ──────────────────────────────────────────────────────────────

export type HuntMarkerStatus =
  | 'available'
  | 'joined'      // accepted/ready but not started
  | 'active'      // participant has an active participation
  | 'full'
  | 'upcoming'
  | 'completed'
  | 'featured';

export interface HuntMarkerData {
  huntId: string;
  occurrenceId: string | null;
  latitude: number;
  longitude: number;
  status: HuntMarkerStatus;
  isSelected: boolean;
  pointsReward: number;
  title: string;
}

// ─── Bottom sheet ─────────────────────────────────────────────────────────────

export type HuntBottomSheetState = 'collapsed' | 'medium' | 'expanded';

// ─── Sort orders ──────────────────────────────────────────────────────────────

export type HuntNearbySortOrder =
  | 'nearest'
  | 'starting_soon'
  | 'featured'
  | 'highest_points'
  | 'shortest'
  | 'easiest';

// ─── Filters ──────────────────────────────────────────────────────────────────

export interface HuntMapFilter {
  /** Availability */
  availableNow: boolean;
  startingSoon: boolean;
  hasSpace: boolean;
  /** Participation */
  participationMode: ParticipationMode | null; // null = all
  /** Difficulty */
  difficulties: Difficulty[];
  /** Duration */
  maxDurationMinutes: number | null;
  /** Environment */
  indoorOutdoor: 'indoor' | 'outdoor' | 'both' | null;
  /** Accessibility */
  accessibleOnly: boolean;
  /** My status */
  inMyHunts: boolean;
  notJoined: boolean;
}

export const DEFAULT_HUNT_MAP_FILTER: HuntMapFilter = {
  availableNow: false,
  startingSoon: false,
  hasSpace: false,
  participationMode: null,
  difficulties: [],
  maxDurationMinutes: null,
  indoorOutdoor: null,
  accessibleOnly: false,
  inMyHunts: false,
  notJoined: false,
};

export function countActiveHuntFilters(filter: HuntMapFilter): number {
  let count = 0;
  if (filter.availableNow) count++;
  if (filter.startingSoon) count++;
  if (filter.hasSpace) count++;
  if (filter.participationMode !== null) count++;
  if (filter.difficulties.length > 0) count++;
  if (filter.maxDurationMinutes !== null) count++;
  if (filter.indoorOutdoor !== null) count++;
  if (filter.accessibleOnly) count++;
  if (filter.inMyHunts) count++;
  if (filter.notJoined) count++;
  return count;
}

// ─── Viewport request ─────────────────────────────────────────────────────────

export interface HuntViewportRequest {
  bounds: BoundingBox;
  zoomLevel: number;
  filters: HuntMapFilter;
  limit: number;
  approximateUserLat?: number;
  approximateUserLng?: number;
}

// ─── Viewport response ────────────────────────────────────────────────────────

export interface HuntViewportResponse {
  hunts: PublicHuntMapItem[];
  totalCount: number;
  isLimitReached: boolean;
}

// ─── Nearby request ───────────────────────────────────────────────────────────

export interface HuntNearbyRequest {
  approximateLat: number | null;
  approximateLng: number | null;
  filters: HuntMapFilter;
  sortOrder: HuntNearbySortOrder;
  limit: number;
}
