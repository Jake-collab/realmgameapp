/**
 * Hunt Map Repository — Worlds
 *
 * Public-safe Hunt data access for the map experience.
 * All queries enforce:
 *   - Only published (status = 'active') hunts
 *   - Only public or user-authorized hunts
 *   - No private geometry, locked clues, or moderation data
 *
 * Endpoint: supabase direct queries + view `public_hunt_map_items`
 * created in migration 022.
 */

import { requireSupabase } from '@/lib/supabase/client';
import { normalizeError } from '@/lib/errors/normalizeError';
import type {
  PublicHuntMapItem,
  HuntMapFilter,
  HuntNearbySortOrder,
  HuntViewportResponse,
} from '../types/huntMap.types';
import type { BoundingBox } from '../../maps/utils/geoUtils';

// ─── DB client ────────────────────────────────────────────────────────────────

function db() {
  return requireSupabase();
}

// ─── Viewport query ───────────────────────────────────────────────────────────

/**
 * Fetch public Hunt map items within a bounding box.
 * Server enforces: published + public privacy only.
 * Results capped at `limit` (default 60).
 */
export async function fetchHuntsInViewport(
  bounds: BoundingBox,
  filter: HuntMapFilter,
  userId: string | null,
  limit = 60,
): Promise<HuntViewportResponse> {
  const supabase = db();

  // Call the migration-022 RPC for viewport queries
  const { data, error } = await supabase
    .rpc('get_hunt_map_viewport', {
      p_west:    bounds.west,
      p_south:   bounds.south,
      p_east:    bounds.east,
      p_north:   bounds.north,
      p_user_id: userId,
      p_limit:   limit,
      // Filter params
      p_available_now:        filter.availableNow,
      p_starting_soon:        filter.startingSoon,
      p_has_space:            filter.hasSpace,
      p_participation_mode:   filter.participationMode,
      p_max_duration_minutes: filter.maxDurationMinutes,
      p_indoor_outdoor:       filter.indoorOutdoor,
      p_accessible_only:      filter.accessibleOnly,
    } as any);

  if (error) {
    // Graceful degradation: return empty result rather than crashing the map
    console.warn('[HuntMap] Viewport query error:', error.message);
    return { hunts: [], totalCount: 0, isLimitReached: false };
  }

  const rows: any[] = Array.isArray(data) ? data : [];

  // Apply client-side participation/status filters that require userId context
  let hunts: PublicHuntMapItem[] = rows.map(rowToPublicHuntMapItem);

  if (filter.notJoined) {
    hunts = hunts.filter(h => !h.participationStatus || h.participationStatus === 'declined');
  }
  if (filter.inMyHunts) {
    hunts = hunts.filter(h => !!h.participationStatus && h.participationStatus !== 'declined');
  }
  if (filter.difficulties.length > 0) {
    hunts = hunts.filter(h => h.difficulty && filter.difficulties.includes(h.difficulty));
  }

  return {
    hunts,
    totalCount: hunts.length,
    isLimitReached: rows.length >= limit,
  };
}

// ─── Nearby query ─────────────────────────────────────────────────────────────

/**
 * Fetch nearby public Hunts sorted by user preference.
 * When lat/lng are null, returns featured or recently active hunts.
 */
export async function fetchNearbyHunts(
  approximateLat: number | null,
  approximateLng: number | null,
  filter: HuntMapFilter,
  sortOrder: HuntNearbySortOrder,
  userId: string | null,
  limit = 20,
): Promise<PublicHuntMapItem[]> {
  const supabase = db();

  const { data, error } = await supabase
    .rpc('get_nearby_hunts', {
      p_lat:                  approximateLat,
      p_lng:                  approximateLng,
      p_user_id:              userId,
      p_sort:                 sortOrder,
      p_limit:                limit,
      p_available_now:        filter.availableNow,
      p_starting_soon:        filter.startingSoon,
      p_has_space:            filter.hasSpace,
      p_participation_mode:   filter.participationMode,
      p_max_duration_minutes: filter.maxDurationMinutes,
      p_accessible_only:      filter.accessibleOnly,
    } as any);

  if (error) {
    console.warn('[HuntMap] Nearby query error:', error.message);
    return [];
  }

  let hunts: PublicHuntMapItem[] = Array.isArray(data)
    ? (data as any[]).map(rowToPublicHuntMapItem)
    : [];

  if (filter.notJoined) {
    hunts = hunts.filter(h => !h.participationStatus || h.participationStatus === 'declined');
  }
  if (filter.inMyHunts) {
    hunts = hunts.filter(h => !!h.participationStatus && h.participationStatus !== 'declined');
  }
  if (filter.difficulties.length > 0) {
    hunts = hunts.filter(h => h.difficulty && filter.difficulties.includes(h.difficulty));
  }

  return hunts;
}

// ─── Row mapper ───────────────────────────────────────────────────────────────

function rowToPublicHuntMapItem(row: any): PublicHuntMapItem {
  return {
    huntId:                   row.hunt_id ?? row.id,
    occurrenceId:             row.occurrence_id ?? null,
    slug:                     row.slug ?? '',
    title:                    row.title ?? '',
    summary:                  row.summary ?? '',
    displayLatitude:          row.display_lat ?? 0,
    displayLongitude:         row.display_lng ?? 0,
    publicLocationLabel:      row.public_location_label ?? null,
    approximateDistanceMeters: row.distance_meters ?? null,
    pointsReward:             row.points_reward ?? 0,
    estimatedDurationMinutes: row.estimated_duration_minutes ?? null,
    difficulty:               row.difficulty ?? null,
    huntType:                 row.hunt_type ?? 'official',
    privacy:                  row.privacy ?? 'public',
    participationMode:        row.participation_mode ?? 'solo',
    isOrdered:                row.is_ordered ?? true,
    stopCount:                row.stop_count ?? 0,
    thumbnailUrl:             row.thumbnail_url ?? null,
    availabilityState:        row.availability_state ?? 'available',
    participationStatus:      row.participation_status ?? null,
    participationId:          row.participation_id ?? null,
    invitationId:             row.invitation_id ?? null,
    invitationStatus:         row.invitation_status ?? null,
    maxParticipants:          row.max_participants ?? null,
    currentParticipantCount:  row.participant_count ?? 0,
    isFull:                   row.is_full ?? false,
    startsAt:                 row.starts_at ?? null,
    endsAt:                   row.ends_at ?? null,
    joinUntil:                row.join_until ?? null,
    isFeatured:               row.is_featured ?? false,
    requiresProof:            row.requires_proof ?? false,
    requiresLocation:         row.requires_location ?? false,
    indoorOutdoor:            row.indoor_outdoor ?? null,
    accessibilitySummary:     row.accessibility_summary ?? null,
  };
}
