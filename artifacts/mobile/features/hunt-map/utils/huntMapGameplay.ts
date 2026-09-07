import type {
  ActiveHunt,
  ActiveHuntStop,
  HuntStopPublicLocation,
  StopProgressStatus,
} from '@/features/hunts/types/hunt.types';
import { bearingDegrees, compassDirection, haversineMeters } from '@/features/maps/utils/geoUtils';

export type HuntObjectiveMarkerStatus =
  | 'available'
  | 'ready'
  | 'active'
  | 'discovered'
  | 'completed'
  | 'locked'
  | 'hidden';

export interface HuntMapProgress {
  completed: number;
  required: number;
  remaining: number;
  percent: number | null;
}

export function buildHuntMapProgress(hunt: Pick<ActiveHunt, 'completedStopCount' | 'requiredStopCount'>): HuntMapProgress {
  const required = Math.max(0, Number(hunt.requiredStopCount ?? 0));
  const completed = Math.min(required, Math.max(0, Number(hunt.completedStopCount ?? 0)));
  return {
    completed,
    required,
    remaining: Math.max(0, required - completed),
    percent: required > 0 ? Math.round((completed / required) * 100) : null,
  };
}

export function selectCurrentHuntStop(
  hunt: Pick<ActiveHunt, 'currentStops' | 'isOrdered'>,
  selectedStopId?: string | null,
): ActiveHuntStop | null {
  const available = new Set<StopProgressStatus>([
    'available',
    'in_progress',
    'awaiting_proof',
    'under_review',
    'needs_resubmission',
    'rejected',
  ]);
  if (selectedStopId) {
    const selected = hunt.currentStops.find(stop => stop.id === selectedStopId);
    if (selected) return selected;
  }
  if (hunt.isOrdered) {
    return hunt.currentStops.find(stop => available.has(stop.progressStatus))
      ?? hunt.currentStops[hunt.currentStops.length - 1]
      ?? null;
  }
  return hunt.currentStops.find(stop => available.has(stop.progressStatus))
    ?? hunt.currentStops[0]
    ?? null;
}

export function resolveObjectiveMarkerStatus(
  stop: Pick<ActiveHuntStop, 'progressStatus'>,
  isCurrent: boolean,
): HuntObjectiveMarkerStatus {
  switch (stop.progressStatus) {
    case 'completed': return 'completed';
    case 'locked':
    case 'not_started':
    case 'expired': return 'locked';
    case 'in_progress':
    case 'awaiting_proof':
    case 'under_review':
    case 'needs_resubmission':
    case 'rejected': return 'active';
    case 'available': return isCurrent ? 'ready' : 'discovered';
    default: return 'hidden';
  }
}

export function getStopLocation(
  locations: HuntStopPublicLocation[],
  stopId: string | null | undefined,
): HuntStopPublicLocation | null {
  if (!stopId) return null;
  return locations.find(location => location.stopId === stopId) ?? null;
}

export function getObjectiveDirection(
  player: { latitude: number; longitude: number } | null,
  location: Pick<HuntStopPublicLocation, 'publicLat' | 'publicLng'> | null,
) {
  if (!player || !location) return null;
  return {
    distanceMeters: haversineMeters(
      { latitude: player.latitude, longitude: player.longitude },
      { latitude: location.publicLat, longitude: location.publicLng },
    ),
    bearing: bearingDegrees(
      { latitude: player.latitude, longitude: player.longitude },
      { latitude: location.publicLat, longitude: location.publicLng },
    ),
    direction: compassDirection(
      bearingDegrees(
        { latitude: player.latitude, longitude: player.longitude },
        { latitude: location.publicLat, longitude: location.publicLng },
      ),
    ),
  };
}