/**
 * Quest Map Domain Types — Worlds
 *
 * All types for the Geo-Quest map experience: public data contracts,
 * validation requests/responses, filters, and UI state.
 *
 * Privacy rules enforced here:
 * - PublicGeoQuestMapItem NEVER contains private validation geometry.
 * - GeoValidationRequest is sent ONLY to the trusted validation endpoint.
 * - GeoValidationResponse NEVER includes the secret geometry or hidden radius.
 */

import type { LatLng, BoundingBox } from '../../maps/utils/geoUtils';
import type { DistanceUnit } from '../../maps/config/mapConfig';

// ─── Public map item ──────────────────────────────────────────────────────────

/**
 * Public-safe Geo-Quest data returned from the viewport or nearby RPC.
 * Contains ONLY what is safe to render on a map without authentication.
 *
 * MUST NOT contain: exact validation coordinates, polygon/radius data,
 * review config, anti-spoofing thresholds, other users' data.
 */
export interface PublicGeoQuestMapItem {
  questId: string;
  occurrenceId: string | null;
  title: string;
  shortObjective: string;
  /** Public approximate display coordinate — NOT the validation point */
  displayLatitude: number;
  displayLongitude: number;
  publicLocationName: string | null;
  /** Straight-line distance from user — labeled approximate in UI */
  approximateDistanceMeters: number | null;
  pointsReward: number;
  estimatedDurationMinutes: number | null;
  difficulty: 'beginner' | 'intermediate' | 'advanced' | null;
  questType: 'daily' | 'monthly' | 'geo';
  availabilityState:
    | 'available'
    | 'active'
    | 'completed'
    | 'upcoming'
    | 'unavailable'
    | 'under_review'
    | 'awaiting_proof';
  participationState:
    | 'not_started'
    | 'in_progress'
    | 'awaiting_proof'
    | 'under_review'
    | 'completed'
    | null;
  thumbnailUrl: string | null;
  isFeatured: boolean;
  accessibilitySummary: string | null;
  /** Whether this Quest requires physical presence to start */
  requiresStartLocation: boolean;
  /** Whether this Quest requires physical presence to complete */
  requiresCompletionLocation: boolean;
  indoorOutdoor: 'indoor' | 'outdoor' | 'both' | null;
  /** Public venue hours note — NOT operational hours used for validation */
  publicVenueHoursNote: string | null;
  /** ISO 8601 — when upcoming availability begins */
  availableFrom: string | null;
  /** ISO 8601 — when the Quest expires */
  expiresAt: string | null;
}

// ─── Viewport query ───────────────────────────────────────────────────────────

export interface GeoQuestViewportRequest {
  bounds: BoundingBox;
  zoomLevel: number;
  filters: GeoQuestMapFilter;
  /** Maximum results — capped server-side regardless of this value */
  limit: number;
  /** Approximate user location for sorting — rounded to 2dp, never stored */
  approximateUserLat?: number;
  approximateUserLng?: number;
}

// ─── Filters ──────────────────────────────────────────────────────────────────

export interface GeoQuestMapFilter {
  availableNow: boolean;
  difficulties: Array<'beginner' | 'intermediate' | 'advanced'>;
  maxDurationMinutes: number | null;
  accessibleOnly: boolean;
  notCompleted: boolean;
  inAction: boolean;
  indoorOutdoor: 'indoor' | 'outdoor' | 'both' | null;
  questType: 'all' | 'daily' | 'monthly';
}

export const DEFAULT_GEO_QUEST_FILTER: GeoQuestMapFilter = {
  availableNow: false,
  difficulties: [],
  maxDurationMinutes: null,
  accessibleOnly: false,
  notCompleted: false,
  inAction: false,
  indoorOutdoor: null,
  questType: 'all',
};

/** Count of active (non-default) filter dimensions */
export function countActiveFilters(filter: GeoQuestMapFilter): number {
  let count = 0;
  if (filter.availableNow) count++;
  if (filter.difficulties.length > 0) count++;
  if (filter.maxDurationMinutes !== null) count++;
  if (filter.accessibleOnly) count++;
  if (filter.notCompleted) count++;
  if (filter.inAction) count++;
  if (filter.indoorOutdoor !== null) count++;
  if (filter.questType !== 'all') count++;
  return count;
}

// ─── Nearby sort options ──────────────────────────────────────────────────────

export type NearbySortOrder =
  | 'nearest'
  | 'featured'
  | 'ending_soon'
  | 'highest_points'
  | 'easiest'
  | 'shortest';

export const NEARBY_SORT_LABELS: Record<NearbySortOrder, string> = {
  nearest: 'Nearest',
  featured: 'Featured',
  ending_soon: 'Ending soon',
  highest_points: 'Highest points',
  easiest: 'Easiest first',
  shortest: 'Shortest',
};

// ─── Geo validation ───────────────────────────────────────────────────────────

/**
 * Trusted validation request — sent ONLY to the secure backend endpoint.
 * Never pass this to a public API or log the coordinates.
 */
export interface GeoValidationRequest {
  participationId: string;
  /** Present for step-specific validation; absent for start/completion validation */
  questStepId?: string;
  /** Exact foreground reading — sent to trusted backend only */
  latitude: number;
  longitude: number;
  horizontalAccuracyMeters: number;
  /** ISO 8601 — when the reading was captured on-device */
  capturedAt: string;
  /** App-generated idempotency key — prevents duplicate submissions */
  requestId: string;
  /** Validation context */
  validationType: 'start' | 'step' | 'completion';
  /** App version — used for anti-spoofing signal, not client-enforced */
  appVersion?: string;
}

/**
 * Trusted validation response — NEVER includes private geometry.
 * canRetry communicates whether the user may attempt again soon.
 */
export interface GeoValidationResponse {
  result:
    | 'validated'
    | 'outside_region'
    | 'accuracy_insufficient'
    | 'location_stale'
    | 'not_required'
    | 'invalid_state'
    | 'rate_limited'
    | 'unavailable';
  /** Server-assigned attempt ID for audit trail */
  validationAttemptId?: string;
  /** True when the user may retry immediately or after a short delay */
  canRetry: boolean;
  /** Safe user-facing message — no hidden geometry details */
  userMessage?: string;
  /** Seconds to wait before next attempt — present when rate_limited */
  retryAfterSeconds?: number;
}

export function isValidationSuccess(response: GeoValidationResponse): boolean {
  return response.result === 'validated' || response.result === 'not_required';
}

export function validationResultUserMessage(result: GeoValidationResponse['result']): string {
  switch (result) {
    case 'validated':      return 'Location verified successfully.';
    case 'not_required':   return 'No location check needed for this step.';
    case 'outside_region': return 'You are not in the required area yet.';
    case 'accuracy_insufficient':
      return 'Your location signal is not accurate enough yet. Move to an open area and try again.';
    case 'location_stale': return 'Your location reading is outdated. Please try again.';
    case 'invalid_state':  return 'This quest is no longer in a valid state for location check.';
    case 'rate_limited':   return 'Too many attempts. Please wait a moment before trying again.';
    case 'unavailable':    return 'Location validation is temporarily unavailable. Try again shortly.';
  }
}

// ─── Map UI state ─────────────────────────────────────────────────────────────

export type BottomSheetState = 'collapsed' | 'medium' | 'expanded';

export type MapLoadState =
  | 'idle'
  | 'loading'
  | 'loaded'
  | 'error'
  | 'disconnected'  // Mapbox not configured
  | 'permission_needed'
  | 'offline';

export interface MapUIState {
  loadState: MapLoadState;
  selectedQuestId: string | null;
  selectedOccurrenceId: string | null;
  bottomSheetState: BottomSheetState;
  showSearchThisArea: boolean;
  nearbySort: NearbySortOrder;
  distanceUnit: DistanceUnit;
  isFilterSheetVisible: boolean;
  isSearchVisible: boolean;
  searchText: string;
}

// ─── Place search ─────────────────────────────────────────────────────────────

export interface PlaceSuggestion {
  placeId: string;
  placeName: string;
  placeType: string;
  centerLatitude: number;
  centerLongitude: number;
  /** Approximate bounding box for camera fitting */
  boundingBox: BoundingBox | null;
}

// ─── Marker state ─────────────────────────────────────────────────────────────

export type QuestMarkerStatus =
  | 'available'
  | 'active'
  | 'completed'
  | 'upcoming'
  | 'unavailable'
  | 'featured';

export interface QuestMarkerData {
  questId: string;
  occurrenceId: string | null;
  latitude: number;
  longitude: number;
  status: QuestMarkerStatus;
  isSelected: boolean;
  pointsReward: number;
  title: string;
}

// ─── Camera state ─────────────────────────────────────────────────────────────

export interface MapCameraState {
  centerLatitude: number;
  centerLongitude: number;
  zoomLevel: number;
  /** Approximate bounds visible — not exact pixel-perfect */
  bounds?: BoundingBox;
}

// ─── Development fixtures ─────────────────────────────────────────────────────

export type GeoFixtureScenario =
  | 'valid_location'
  | 'outside_region'
  | 'poor_accuracy'
  | 'stale_reading'
  | 'rate_limited'
  | 'server_unavailable';
