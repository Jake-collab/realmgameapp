import fs from 'node:fs';
import path from 'node:path';
import { DROP_CREDIT_PACKS, MEMBERSHIP_PLANS } from '../features/revenue/types/revenue.types';

describe('Stage 2 revenue contracts', () => {
  const migration = fs.readFileSync(
    path.resolve(__dirname, '../supabase/migrations/071_membership_allowances_and_collectibles.sql'),
    'utf8',
  );

  test('keeps the exact provider-neutral catalog prices', () => {
    expect(MEMBERSHIP_PLANS.map((plan) => plan.price)).toEqual(['$0', '$4.99/month', '$44.99/year']);
    expect(DROP_CREDIT_PACKS.map((pack) => [pack.price, pack.credits])).toEqual([
      ['$1.99', 5], ['$4.99', 15], ['$9.99', 35],
    ]);
    expect(migration).toContain("('worlds_monthly', 'Worlds Membership', 'monthly', 499, 'USD')");
    expect(migration).toContain("('worlds_yearly', 'Worlds Membership', 'yearly', 4499, 'USD')");
  });

  test('resolves UTC periods and consumes included Drops before credits', () => {
    expect(migration).toContain("date_trunc('week', NOW() AT TIME ZONE 'UTC')");
    expect(migration).toContain("date_trunc('month', NOW() AT TIME ZONE 'UTC')");
    const consumeFunction = migration.slice(
      migration.indexOf('CREATE OR REPLACE FUNCTION consume_drop_creation_allowance'),
      migration.indexOf('CREATE OR REPLACE FUNCTION grant_extra_drop_credits'),
    );
    expect(consumeFunction.indexOf("'included_weekly'")).toBeLessThan(consumeFunction.indexOf('SUM(quantity_delta)'));
    expect(migration).toContain('pg_advisory_xact_lock');
  });

  test('keeps verified finds, badges, collectibles, and points separate', () => {
    expect(migration).toContain('AFTER INSERT ON hunt_drop_collections');
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS find_badges');
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS collectible_ownership');
    expect(migration).not.toContain('CREATE TABLE IF NOT EXISTS hunt_drops');
    expect(migration).not.toContain('UPDATE hunt_point_ledger');
  });

  test('protects financial and entitlement state from direct client mutation', () => {
    expect(migration).toContain('trusted_revenue_actor_required');
    expect(migration).toContain('immutable_revenue_history');
    expect(migration).toContain('FORCE ROW LEVEL SECURITY');
    expect(migration).toContain('REVOKE ALL ON FUNCTION grant_extra_drop_credits');
    expect(migration).toContain('REVOKE ALL ON FUNCTION finalize_collectible_purchase');
  });
});