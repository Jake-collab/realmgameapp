import { rankDailyQuestCandidates } from '@/features/quests/services/questSelection.service';
import type { QuestRowExtended } from '@/features/quests/repositories/quest.repository';

function quest(id: string, tags: string[] = [], extra: Partial<QuestRowExtended> = {}): QuestRowExtended {
  return {
    id, slug: id, title: id, summary: null, description: null, quest_type: 'daily',
    status: 'published', difficulty: 'easy', estimated_duration_minutes: 10,
    points_reward: 100, indoor_outdoor: 'indoor', accessibility_notes: null,
    safety_notes: null, proof_type: 'none', location_requirement_type: 'none',
    available_from: null, available_until: null, published_at: null, created_by: null,
    approved_by: null, source_type: 'admin', ai_generation_id: null, is_repeatable: false,
    repeat_cooldown_hours: null, created_at: '', updated_at: '', archived_at: null,
    completion_mode: 'auto', expiration_behavior: 'hard', home_priority: 0,
    interest_bubble_ids: tags, ...extra,
  } as QuestRowExtended;
}

describe('canonical Daily Quest targeting', () => {
  it('prefers a matching Interest Bubble over an untargeted quest', () => {
    const ranked = rankDailyQuestCandidates([quest('generic'), quest('art', ['art'])], ['art']);
    expect(ranked[0].id).toBe('art');
  });

  it('requires every Interest Bubble for REQUIRE_COMBINATION', () => {
    const ranked = rankDailyQuestCandidates([
      quest('partial', ['art', 'music'], { interest_targeting_mode: 'REQUIRE_COMBINATION' }),
      quest('fallback'),
    ], ['art']);
    expect(ranked.map((item) => item.id)).toEqual(['fallback']);
  });

  it('is deterministic for the same candidates and interests', () => {
    const candidates = [quest('a', ['art']), quest('b', ['music'])];
    expect(rankDailyQuestCandidates(candidates, ['music']).map((item) => item.id))
      .toEqual(rankDailyQuestCandidates(candidates, ['music']).map((item) => item.id));
  });

  it('uses an untargeted Quest before an unrelated tagged Quest as fallback', () => {
    const ranked = rankDailyQuestCandidates([
      quest('unrelated', ['music'], { home_priority: 100 }),
      quest('fallback', [], { home_priority: 1 }),
    ], ['art']);
    expect(ranked[0].id).toBe('fallback');
  });
});