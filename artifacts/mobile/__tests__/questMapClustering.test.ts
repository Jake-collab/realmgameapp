import {
  buildQuestMarkerFeatureCollection,
  QUEST_CLUSTER_MAX_ZOOM,
  QUEST_CLUSTER_RADIUS,
  resolveQuestMarkerPress,
} from '../features/quest-map/utils/questMarkerClustering';
import type { QuestMarkerData } from '../features/quest-map/types/questMap.types';

const marker = (
  overrides: Partial<QuestMarkerData> = {},
): QuestMarkerData => ({
  questId: 'quest-1',
  occurrenceId: 'occurrence-1',
  latitude: 40.7,
  longitude: -74,
  status: 'available',
  isSelected: false,
  pointsReward: 100,
  title: 'Public Quest',
  isFeatured: false,
  ...overrides,
});

describe('Quest marker clustering', () => {
  test('creates a public point collection for native clustering', () => {
    const collection = buildQuestMarkerFeatureCollection([
      marker(),
      marker({
        questId: 'quest-2',
        occurrenceId: null,
        latitude: 40.71,
        longitude: -73.99,
        status: 'active',
      }),
    ]);

    expect(collection.type).toBe('FeatureCollection');
    expect(collection.features).toHaveLength(2);
    expect(collection.features[0].geometry.coordinates).toEqual([ -74, 40.7 ]);
    expect(collection.features[1].properties?.status).toBe('active');
    expect(collection.features[1].properties?.glyph).toBe('→');
    expect(QUEST_CLUSTER_RADIUS).toBeGreaterThan(0);
    expect(QUEST_CLUSTER_MAX_ZOOM).toBeLessThan(18);
  });

  test('ignores malformed coordinates without creating a map feature', () => {
    const collection = buildQuestMarkerFeatureCollection([
      marker({ latitude: Number.NaN }),
      marker({ questId: 'quest-2', longitude: Number.POSITIVE_INFINITY }),
    ]);

    expect(collection.features).toHaveLength(0);
  });

  test('resolves a native cluster press for expansion', () => {
    const feature = {
      type: 'Feature',
      properties: { cluster_id: 42, point_count: 3 },
      geometry: { type: 'Point', coordinates: [-74, 40.7] },
    } as GeoJSON.Feature;

    expect(resolveQuestMarkerPress(feature)).toEqual({
      kind: 'cluster',
      feature,
    });
  });

  test('resolves an individual feature for selection after expansion', () => {
    const collection = buildQuestMarkerFeatureCollection([
      marker({ status: 'completed', isSelected: true }),
    ]);
    const feature = collection.features[0];

    expect(resolveQuestMarkerPress(feature)).toEqual({
      kind: 'marker',
      questId: 'quest-1',
      occurrenceId: 'occurrence-1',
    });
    expect(feature.properties?.status).toBe('completed');
    expect(feature.properties?.isSelected).toBe(true);
  });

  test('filters are applied before clustering', () => {
    const markers = [
      marker({ status: 'available' }),
      marker({ questId: 'quest-2', status: 'completed' }),
      marker({ questId: 'quest-3', status: 'active' }),
    ];
    const activeMarkers = markers.filter(item => item.status === 'active');

    expect(buildQuestMarkerFeatureCollection(activeMarkers).features).toHaveLength(1);
    expect(
      buildQuestMarkerFeatureCollection(activeMarkers).features[0].properties?.status,
    ).toBe('active');
  });
});