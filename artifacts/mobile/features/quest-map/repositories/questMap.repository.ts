/**
 * Quest Map Repository — Worlds
 *
 * Server-backed geospatial data access for the Quest Map experience.
 *
 * Rules:
 * - NEVER returns private validation geometry (quest_geofences).
 * - NEVER returns another user's data.
 * - All public-facing functions return PublicGeoQuestMapItem only.
 * - Coordinate bounds are validated before query.
 * - Result counts are capped by both server and client.
 * - Private validation geometry is loaded ONLY inside the RPC (server-side).
 */

import { requireSupabase } from '@/lib/supabase/client';
import { normalizeError } from '@/lib/errors/normalizeError';
import type { PublicGeoQuestMapItem, GeoQuestMapFilter, GeoValidationRequest, GeoValidationResponse } from '../types/questMap.types';
import type { BoundingBox } from '../../maps/utils/geoUtils';
import { isValidBoundingBox } from '../../maps/utils/geoUtils';
import { VIEWPORT_RESULT_LIMIT } from '../../maps/config/mapConfig';

// ─── Viewport query ───────────────────────────────────────────────────────────

/**
 * Fetch public-safe Geo-Quests within a map viewport.
 * Calls the `get_geo_quest_viewport` RPC (migration 020).
 * Returns public display coordinates only — never validation geometry.
 */
export async function fetchGeoQuestViewport(
  userId: string,
  bounds: BoundingBox,
  filter: GeoQuestMapFilter,
  limit = VIEWPORT_RESULT_LIMIT,
  approximateUserLat?: number,
  approximateUserLng?: number,
): Promise<PublicGeoQuestMapItem[]> {
  if (!isValidBoundingBox(bounds)) {
    throw new Error('Invalid map bounds — bounding box too large or out of range');
  }

  const client = requireSupabase();
  const { data, error } = await (client.rpc as any)('get_geo_quest_viewport', {
    p_west:   bounds.west,
    p_south:  bounds.south,
    p_east:   bounds.east,
    p_north:  bounds.north,
    p_limit:  Math.min(limit, VIEWPORT_RESULT_LIMIT),
    p_available_now:    filter.availableNow,
    p_accessible_only:  filter.accessibleOnly,
    p_not_completed:    filter.notCompleted,
    p_in_action:        filter.inAction,
    p_max_duration:     filter.maxDurationMinutes,
    p_difficulties:     filter.difficulties.length > 0 ? filter.difficulties : null,
    p_quest_type:       filter.questType !== 'all' ? filter.questType : null,
    p_indoor_outdoor:   filter.indoorOutdoor,
    p_user_lat:         approximateUserLat ?? null,
    p_user_lng:         approximateUserLng ?? null,
  });

  if (error) throw normalizeError(error);
  return mapViewportRows(data ?? [], approximateUserLat, approximateUserLng);
}

/**
 * Fetch nearby Geo-Quests sorted by approximate distance from user.
 * Uses the `get_nearby_geo_quests` RPC.
 */
export async function fetchNearbyGeoQuests(
  userId: string,
  approximateLat: number,
  approximateLng: number,
  radiusMeters: number,
  filter: GeoQuestMapFilter,
  limit = 30,
): Promise<PublicGeoQuestMapItem[]> {
  const client = requireSupabase();
  const { data, error } = await (client.rpc as any)('get_nearby_geo_quests', {
    p_lat:             approximateLat,
    p_lng:             approximateLng,
    p_radius_meters:   Math.min(radiusMeters, 50_000),
    p_limit:           Math.min(limit, 50),
    p_available_now:   filter.availableNow,
    p_accessible_only: filter.accessibleOnly,
    p_not_completed:   filter.notCompleted,
    p_difficulties:    filter.difficulties.length > 0 ? filter.difficulties : null,
    p_quest_type:      filter.questType !== 'all' ? filter.questType : null,
  });

  if (error) throw normalizeError(error);
  return mapViewportRows(data ?? [], approximateLat, approximateLng);
}

// ─── Geo validation ───────────────────────────────────────────────────────────

/**
 * Submit a trusted location validation request to the server.
 * Private validation geometry is loaded server-side — NEVER returned here.
 * This function goes to the Supabase RPC validate_geo_quest_location (migration 020).
 */
export async function submitGeoValidation(
  request: GeoValidationRequest,
): Promise<GeoValidationResponse> {
  const client = requireSupabase();

  const { data, error } = await (client.rpc as any)('validate_geo_quest_location', {
    p_participation_id:           request.participationId,
    p_quest_step_id:              request.questStepId ?? null,
    p_latitude:                   request.latitude,
    p_longitude:                  request.longitude,
    p_horizontal_accuracy_meters: request.horizontalAccuracyMeters,
    p_captured_at:                request.capturedAt,
    p_request_id:                 request.requestId,
    p_validation_type:            request.validationType,
    p_app_version:                request.appVersion ?? null,
  });

  if (error) {
    // Normalize RPC errors — never expose PostGIS internals
    if (error.code === 'PGRST202') {
      // Function not found — migration not applied yet
      return {
        result: 'unavailable',
        canRetry: true,
        userMessage: 'Location validation is currently unavailable. Please try again later.',
      };
    }
    throw normalizeError(error);
  }

  // The RPC returns a single JSON object
  const row = Array.isArray(data) ? data[0] : data;
  return mapValidationResponse(row);
}

// ─── Place search (Mapbox Geocoding API) ──────────────────────────────────────

import type { PlaceSuggestion } from '../types/questMap.types';
import { MAPBOX_ACCESS_TOKEN, SEARCH_BBOX_US, SEARCH_MAX_SUGGESTIONS } from '../../maps/config/mapConfig';

/**
 * Search for places using Mapbox Geocoding API.
 * Restricted to US bounding box for Build 1.
 * The access token is a client-safe public token (pk.*).
 */
export async function searchPlaces(
  query: string,
  limit = SEARCH_MAX_SUGGESTIONS,
): Promise<PlaceSuggestion[]> {
  if (!query.trim() || !MAPBOX_ACCESS_TOKEN) return [];

  const params = new URLSearchParams({
    access_token: MAPBOX_ACCESS_TOKEN,
    country: 'us',
    bbox: SEARCH_BBOX_US,
    limit: String(Math.min(limit, 10)),
    types: 'place,district,postcode,poi,address',
    language: 'en',
  });

  const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?${params}`;

  try {
    const resp = await fetch(url);
    if (!resp.ok) return [];
    const json = await resp.json();
    return (json.features ?? []).map(mapGeocodingFeature);
  } catch {
    return [];
  }
}

// ─── Row mappers ──────────────────────────────────────────────────────────────

function mapViewportRows(
  rows: any[],
  userLat?: number,
  userLng?: number,
): PublicGeoQuestMapItem[] {
  return rows.map(row => ({
    questId:                  row.quest_id,
    occurrenceId:             row.occurrence_id ?? null,
    title:                    row.title ?? '',
    shortObjective:           row.short_objective ?? '',
    displayLatitude:          row.display_lat ?? 0,
    displayLongitude:         row.display_lng ?? 0,
    publicLocationName:       row.public_location_name ?? null,
    approximateDistanceMeters: row.distance_meters ?? null,
    pointsReward:             row.points_reward ?? 0,
    estimatedDurationMinutes: row.estimated_duration_minutes ?? null,
    difficulty:               row.difficulty ?? null,
    questType:                row.quest_type ?? 'geo',
    availabilityState:        row.availability_state ?? 'unavailable',
    participationState:       row.participation_state ?? null,
    thumbnailUrl:             row.thumbnail_url ?? null,
    isFeatured:               row.is_featured ?? false,
    accessibilitySummary:     row.accessibility_summary ?? null,
    requiresStartLocation:    row.requires_start_location ?? false,
    requiresCompletionLocation: row.requires_completion_location ?? false,
    indoorOutdoor:            row.indoor_outdoor ?? null,
    publicVenueHoursNote:     row.public_venue_hours_note ?? null,
    availableFrom:            row.available_from ?? null,
    expiresAt:                row.expires_at ?? null,
  }));
}

function mapValidationResponse(row: any): GeoValidationResponse {
  if (!row) {
    return { result: 'unavailable', canRetry: true };
  }
  return {
    result:              row.result ?? 'unavailable',
    validationAttemptId: row.validation_attempt_id ?? undefined,
    canRetry:            row.can_retry ?? true,
    userMessage:         row.user_message ?? undefined,
    retryAfterSeconds:   row.retry_after_seconds ?? undefined,
  };
}

function mapGeocodingFeature(feature: any): PlaceSuggestion {
  const [west, south, east, north] = feature.bbox ?? [];
  const [lng, lat] = feature.center ?? [0, 0];
  return {
    placeId:         feature.id ?? '',
    placeName:       feature.place_name ?? feature.text ?? '',
    placeType:       (feature.place_type ?? [])[0] ?? 'place',
    centerLatitude:  lat,
    centerLongitude: lng,
    boundingBox: west != null ? { west, south, east, north } : null,
  };
}
