/**
 * Geo-Quest Development Fixtures — Worlds
 *
 * Safe development-only fixtures for testing the Quest Map without a live backend.
 *
 * Rules:
 * - All coordinates are in clearly public park/open areas.
 * - No private residences, schools during hours, or sensitive infrastructure.
 * - Development-only validation stubs NEVER award production points.
 * - These fixtures are removed from production builds via __DEV__ guard at callsite.
 */

import type { PublicGeoQuestMapItem } from '../types/questMap.types';
import type { GeoValidationResponse } from '../types/questMap.types';
import type { PlaceSuggestion } from '../types/questMap.types';

// ─── Fixture Quest Locations ──────────────────────────────────────────────────
// All in well-known public parks — Central Park NY, Golden Gate Park SF, etc.

export const DEV_GEO_QUEST_FIXTURES: PublicGeoQuestMapItem[] = [
  // Available Quest — Central Park, NY
  {
    questId:                   'dev-quest-001',
    occurrenceId:              'dev-occ-001',
    title:                     'Central Park Morning Walk',
    shortObjective:            'Explore the Bethesda Fountain and Great Lawn',
    displayLatitude:           40.7812,
    displayLongitude:          -73.9665,
    publicLocationName:        'Central Park, New York',
    approximateDistanceMeters: 1200,
    pointsReward:              150,
    estimatedDurationMinutes:  45,
    difficulty:                'beginner',
    questType:                 'geo',
    availabilityState:         'available',
    participationState:        'not_started',
    thumbnailUrl:              null,
    isFeatured:                false,
    accessibilitySummary:      'Paved paths, wheelchair accessible',
    requiresStartLocation:     false,
    requiresCompletionLocation: true,
    indoorOutdoor:             'outdoor',
    publicVenueHoursNote:      'Open daily, 6am–1am',
    availableFrom:             null,
    expiresAt:                 null,
  },
  // Active Quest — Golden Gate Park, SF
  {
    questId:                   'dev-quest-002',
    occurrenceId:              'dev-occ-002',
    title:                     'Golden Gate Botanical Discovery',
    shortObjective:            'Find three native species in the Botanical Garden',
    displayLatitude:           37.7694,
    displayLongitude:          -122.4862,
    publicLocationName:        'Golden Gate Park, San Francisco',
    approximateDistanceMeters: 3400,
    pointsReward:              250,
    estimatedDurationMinutes:  60,
    difficulty:                'intermediate',
    questType:                 'geo',
    availabilityState:         'active',
    participationState:        'in_progress',
    thumbnailUrl:              null,
    isFeatured:                true,
    accessibilitySummary:      'Some unpaved sections',
    requiresStartLocation:     true,
    requiresCompletionLocation: true,
    indoorOutdoor:             'outdoor',
    publicVenueHoursNote:      'Garden open 9am–5pm',
    availableFrom:             null,
    expiresAt:                 null,
  },
  // Completed Quest — Millennium Park, Chicago
  {
    questId:                   'dev-quest-003',
    occurrenceId:              'dev-occ-003',
    title:                     'Cloud Gate Reflection',
    shortObjective:            'Photograph the Bean from five angles',
    displayLatitude:           41.8827,
    displayLongitude:          -87.6233,
    publicLocationName:        'Millennium Park, Chicago',
    approximateDistanceMeters: 8900,
    pointsReward:              100,
    estimatedDurationMinutes:  20,
    difficulty:                'beginner',
    questType:                 'geo',
    availabilityState:         'completed',
    participationState:        'completed',
    thumbnailUrl:              null,
    isFeatured:                false,
    accessibilitySummary:      'Fully wheelchair accessible',
    requiresStartLocation:     false,
    requiresCompletionLocation: false,
    indoorOutdoor:             'outdoor',
    publicVenueHoursNote:      'Open daily',
    availableFrom:             null,
    expiresAt:                 null,
  },
  // Upcoming Quest — National Mall, Washington DC
  {
    questId:                   'dev-quest-004',
    occurrenceId:              null,
    title:                     'Monument at Dawn',
    shortObjective:            'Photograph the Lincoln Memorial at sunrise',
    displayLatitude:           38.8893,
    displayLongitude:          -77.0502,
    publicLocationName:        'National Mall, Washington DC',
    approximateDistanceMeters: null,
    pointsReward:              300,
    estimatedDurationMinutes:  90,
    difficulty:                'advanced',
    questType:                 'geo',
    availabilityState:         'upcoming',
    participationState:        null,
    thumbnailUrl:              null,
    isFeatured:                true,
    accessibilitySummary:      'Paved, accessible',
    requiresStartLocation:     true,
    requiresCompletionLocation: true,
    indoorOutdoor:             'outdoor',
    publicVenueHoursNote:      'Open 24 hours',
    availableFrom:             new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
    expiresAt:                 null,
  },
  // Multi-step Quest — Balboa Park, San Diego
  {
    questId:                   'dev-quest-005',
    occurrenceId:              'dev-occ-005',
    title:                     'Balboa Park Cultural Trail',
    shortObjective:            'Visit five museums across the park',
    displayLatitude:           32.7341,
    displayLongitude:          -117.1440,
    publicLocationName:        'Balboa Park, San Diego',
    approximateDistanceMeters: 15000,
    pointsReward:              400,
    estimatedDurationMinutes:  180,
    difficulty:                'intermediate',
    questType:                 'geo',
    availabilityState:         'available',
    participationState:        'not_started',
    thumbnailUrl:              null,
    isFeatured:                false,
    accessibilitySummary:      'Mixed — some areas accessible',
    requiresStartLocation:     false,
    requiresCompletionLocation: true,
    indoorOutdoor:             'both',
    publicVenueHoursNote:      'Museums vary — check individual hours',
    availableFrom:             null,
    expiresAt:                 new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
  },
  // Unavailable Quest — Boston Common
  {
    questId:                   'dev-quest-006',
    occurrenceId:              null,
    title:                     'Frog Pond Winter Challenge',
    shortObjective:            'Skate at the Frog Pond',
    displayLatitude:           42.3554,
    displayLongitude:          -71.0657,
    publicLocationName:        'Boston Common, Boston',
    approximateDistanceMeters: null,
    pointsReward:              200,
    estimatedDurationMinutes:  60,
    difficulty:                'beginner',
    questType:                 'geo',
    availabilityState:         'unavailable',
    participationState:        null,
    thumbnailUrl:              null,
    isFeatured:                false,
    accessibilitySummary:      null,
    requiresStartLocation:     true,
    requiresCompletionLocation: true,
    indoorOutdoor:             'outdoor',
    publicVenueHoursNote:      'Seasonal — winter only',
    availableFrom:             null,
    expiresAt:                 null,
  },
];

// ─── Validation scenario fixtures ─────────────────────────────────────────────

/**
 * Development-only validation scenario stubs.
 * These NEVER call the production validation endpoint.
 * NEVER award production points.
 */
export const DEV_VALIDATION_RESPONSES: Record<string, GeoValidationResponse> = {
  valid_location: {
    result: 'validated',
    validationAttemptId: 'dev-attempt-001',
    canRetry: false,
    userMessage: '[DEV] Location verified successfully.',
  },
  outside_region: {
    result: 'outside_region',
    canRetry: true,
    userMessage: '[DEV] You are not in the required area yet.',
  },
  poor_accuracy: {
    result: 'accuracy_insufficient',
    canRetry: true,
    userMessage: '[DEV] Your location signal is not accurate enough yet. Move to an open area and try again.',
  },
  stale_reading: {
    result: 'location_stale',
    canRetry: true,
    userMessage: '[DEV] Your location reading is outdated. Please try again.',
  },
  rate_limited: {
    result: 'rate_limited',
    canRetry: true,
    userMessage: '[DEV] Too many attempts. Please wait a moment.',
    retryAfterSeconds: 30,
  },
  server_unavailable: {
    result: 'unavailable',
    canRetry: true,
    userMessage: '[DEV] Validation service is temporarily unavailable.',
  },
};

// ─── Place search fixtures ────────────────────────────────────────────────────

export const DEV_PLACE_SUGGESTIONS: PlaceSuggestion[] = [
  {
    placeId: 'dev-place-001',
    placeName: 'Central Park, New York, NY',
    placeType: 'poi',
    centerLatitude: 40.7829,
    centerLongitude: -73.9654,
    boundingBox: { west: -73.9816, south: 40.7644, east: -73.9494, north: 40.8005 },
  },
  {
    placeId: 'dev-place-002',
    placeName: 'Golden Gate Park, San Francisco, CA',
    placeType: 'poi',
    centerLatitude: 37.7694,
    centerLongitude: -122.4862,
    boundingBox: { west: -122.5143, south: 37.7647, east: -122.4583, north: 37.7752 },
  },
];
