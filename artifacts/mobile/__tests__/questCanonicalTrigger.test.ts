// @ts-nocheck
// Database trigger contract: keep the migration-level guard observable in the
// normal mobile test suite even when a live Supabase project is unavailable.
const fs = require('node:fs');
const path = require('node:path');

describe('Quest canonical trigger migration', () => {
  const migration = fs.readFileSync(
    path.resolve(
      __dirname,
      '../supabase/migrations/049_quest_canonical_trigger_quest_type_guard.sql',
    ),
    'utf8',
  );

  test('revalidates canonical rewards when quest_type changes', () => {
    expect(migration).toMatch(
      /UPDATE OF quest_type,\s*status,\s*difficulty,\s*points_reward ON quests/i,
    );
    expect(migration).toMatch(/IF NEW\.quest_type IN \('daily', 'monthly', 'geo'\)/);
    expect(migration).toMatch(/RAISE EXCEPTION 'Quest must use canonical difficulty and base points'/);
  });

  test('upgrades very_easy only within the Quest boundary', () => {
    expect(migration).toMatch(
      /IF NEW\.quest_type IN \('daily', 'monthly', 'geo'\)\s+AND NEW\.difficulty::text = 'very_easy'/,
    );
  });
});