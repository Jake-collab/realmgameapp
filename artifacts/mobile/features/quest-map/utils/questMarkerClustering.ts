import type { QuestMarkerData, QuestMarkerStatus } from '../types/questMap.types';

export const QUEST_CLUSTER_RADIUS = 48;
export const QUEST_CLUSTER_MAX_ZOOM = 13;

export interface QuestMarkerFeatureProperties {
  questId: string;
  occurrenceId: string | null;
  status: QuestMarkerStatus;
  isSelected: boolean;
  pointsReward: number;
  title: string;
  isFeatured: boolean;
  glyph: string;
}

export type QuestMarkerFeature = GeoJSON.Feature<
  GeoJSON.Point,
  QuestMarkerFeatureProperties
>;

export type QuestMarkerFeatureCollection = GeoJSON.FeatureCollection<
  GeoJSON.Point,
  QuestMarkerFeatureProperties
>;

export type QuestMarkerPressTarget =
  | { kind: 'cluster'; feature: GeoJSON.Feature }
  | { kind: 'marker'; questId: string; occurrenceId: string | null };

const STATUS_GLYPHS: Record<QuestMarkerStatus, string> = {
  available: '•',
  active: '→',
  completed: '✓',
  upcoming: '◷',
  unavailable: '•',
  awaiting_proof: '◷',
  under_review: '◷',
  locked: '•',
  featured: '★',
};

/**
 * Builds the public point source consumed by Mapbox's native clustering engine.
 * Only fields already safe for Quest map rendering are copied into properties.
 */
export function buildQuestMarkerFeatureCollection(
  markers: readonly QuestMarkerData[],
): QuestMarkerFeatureCollection {
  return {
    type: 'FeatureCollection',
    features: markers
      .filter(marker =>
        Number.isFinite(marker.latitude) && Number.isFinite(marker.longitude),
      )
      .map(marker => ({
        type: 'Feature',
        id: marker.occurrenceId ?? marker.questId,
        properties: {
          questId: marker.questId,
          occurrenceId: marker.occurrenceId,
          status: marker.status,
          isSelected: marker.isSelected,
          pointsReward: marker.pointsReward,
          title: marker.title,
          isFeatured: marker.isFeatured,
          glyph: STATUS_GLYPHS[marker.status],
        },
        geometry: {
          type: 'Point',
          coordinates: [marker.longitude, marker.latitude],
        },
      })),
  };
}

export function resolveQuestMarkerPress(
  feature: GeoJSON.Feature | null | undefined,
): QuestMarkerPressTarget | null {
  if (!feature?.properties) return null;

  if (typeof feature.properties.cluster_id === 'number') {
    return { kind: 'cluster', feature };
  }

  const questId = feature.properties.questId;
  if (typeof questId !== 'string' || questId.length === 0) return null;

  return {
    kind: 'marker',
    questId,
    occurrenceId:
      typeof feature.properties.occurrenceId === 'string'
        ? feature.properties.occurrenceId
        : null,
  };
}