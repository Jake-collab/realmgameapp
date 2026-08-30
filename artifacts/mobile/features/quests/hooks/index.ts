/**
 * Quest Hooks — Barrel Export
 *
 * Re-exports all React Query hooks for the Quest domain.
 * Components import from '@/features/quests/hooks' — never from individual files.
 */

export { useDailyQuests } from './useDailyQuests';
export { useAssignedDailyQuest } from './useAssignedDailyQuest';
export { useMonthlyQuests } from './useMonthlyQuests';
export { useGeoQuests } from './useGeoQuests';
export { useQuestDetail } from './useQuestDetail';
export { useQuestAvailability } from './useQuestAvailability';
export { useActiveQuest } from './useActiveQuest';
export { useQuestParticipation } from './useQuestParticipation';
export { useQuestProgress } from './useQuestProgress';
export { useCompletedQuests } from './useCompletedQuests';
export { useStartQuest } from './useStartQuest';
export { useAbandonQuest } from './useAbandonQuest';
export { useSubmitQuestProof } from './useSubmitQuestProof';
export { useQuestPointGuideline } from './useQuestPointGuideline';
export { useHomeQuestSummary } from './useHomeQuestSummary';

// Quest Progress — Prompt 8
export { useProgressInAction } from './useProgressInAction';
export { useProgressCompleted } from './useProgressCompleted';
export { useProgressOtherActivity } from './useProgressOtherActivity';
export { useQuestLeaderboard } from './useQuestLeaderboard';
export { useMyQuestRank } from './useMyQuestRank';
export { useSubmissionHistory } from './useSubmissionHistory';
export { useQuestPointHistory } from './useQuestPointHistory';
export { useCompletionDetail } from './useCompletionDetail';
export { useQuestActivityTracking } from './useQuestActivityTracking';
