/**
 * features/quest-map — Quest Geo Map Domain (Prompt 10)
 *
 * Public API for the Quest Geo Map feature.
 * Screen: app/(main)/quest/map.tsx
 */

// Types
export type {
  PublicGeoQuestMapItem,
  GeoValidationRequest,
  GeoValidationResponse,
  GeoQuestMapFilter,
  BottomSheetState,
  NearbySortOrder,
  MapUIState,
  PlaceSuggestion,
  QuestMarkerData,
  MapCameraState,
} from './types/questMap.types';

export {
  DEFAULT_GEO_QUEST_FILTER,
  countActiveFilters,
  validationResultUserMessage,
  isValidationSuccess,
} from './types/questMap.types';

// Query keys (for external cache invalidation if needed)
export { questMapKeys } from './queries/questMapKeys';

// Hooks
export { useGeoQuestViewport } from './hooks/useGeoQuestViewport';
export { useNearbyGeoQuests } from './hooks/useNearbyGeoQuests';
export { useGeoValidation } from './hooks/useGeoValidation';
export { useMapFilters } from './hooks/useMapFilters';
export { usePlaceSearch } from './hooks/usePlaceSearch';

// Components (consumed by the map screen)
export { QuestPreviewCard } from './components/QuestPreviewCard';
export { NearbyResultsSheet } from './components/NearbyResultsSheet';
export { MapFilterSheet } from './components/MapFilterSheet';
export { SearchThisAreaButton } from './components/SearchThisAreaButton';

// Dev fixtures (tree-shaken in production)
export {
  DEV_GEO_QUEST_FIXTURES,
  DEV_VALIDATION_RESPONSES,
  DEV_PLACE_SUGGESTIONS,
} from './fixtures/geoQuestFixtures';
