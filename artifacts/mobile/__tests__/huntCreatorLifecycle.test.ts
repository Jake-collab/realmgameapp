import fs from 'node:fs';
import path from 'node:path';

declare const describe: (name: string, run: () => void) => void;
declare const it: (name: string, run: () => void) => void;
declare const expect: any;

const migration = fs.readFileSync(
  path.join(process.cwd(), 'supabase/migrations/027_hunt_creator.sql'),
  'utf8',
);
const proofEnforcement = fs.readFileSync(
  path.join(process.cwd(), 'supabase/migrations/029_hunt_creator_proof_enforcement.sql'),
  'utf8',
);
const proofVocabulary = fs.readFileSync(
  path.join(process.cwd(), 'supabase/migrations/030_hunt_creator_proof_vocabulary.sql'),
  'utf8',
);
const creatorWriteBoundary = fs.readFileSync(
  path.join(process.cwd(), 'supabase/migrations/031_hunt_creator_write_boundary.sql'),
  'utf8',
);

describe('Hunt creator lifecycle migration contract', () => {
  const submitFunction = migration.match(
    /CREATE OR REPLACE FUNCTION publish_hunt[\s\S]*?\n\$\$;/,
  )?.[0] ?? '';

  it('submits a creator Hunt for moderation instead of activating it', () => {
    expect(submitFunction).toContain("status = 'pending_review'");
    expect(submitFunction).not.toContain("'active'::hunt_status");
    expect(submitFunction).not.toContain('INSERT INTO hunt_occurrences');
  });

  it('keeps the active transition inside the moderator-only approval function', () => {
    const approvalFunction = migration.match(
      /CREATE OR REPLACE FUNCTION approve_creator_hunt[\s\S]*?\n\$\$;/,
    )?.[0] ?? '';
    expect(approvalFunction).toContain("role IN ('moderator', 'admin')");
    expect(approvalFunction).toContain('INSERT INTO hunt_occurrences');
    expect(approvalFunction).not.toContain("moderation_status = 'approved'");
  });

  it('captures immutable submitted content and starts a new revision after rejection', () => {
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS hunt_submitted_versions');
    expect(migration).toContain('trg_hunt_submitted_versions_immutable');
    expect(submitFunction).toContain('INSERT INTO hunt_submitted_versions');
    expect(migration).toContain('CREATE OR REPLACE FUNCTION begin_hunt_revision');
    expect(migration).toContain("UPDATE hunts SET status = 'draft', version = version + 1");
  });

  it('only makes invitations available for an active or scheduled occurrence', () => {
    const eligibility = migration.match(
      /CREATE OR REPLACE FUNCTION get_hunt_invitation_eligibility[\s\S]*?\n\$\$;/,
    )?.[0] ?? '';
    expect(eligibility).toContain("h.status IN ('scheduled', 'active')");
    expect(eligibility).toContain("o.status IN ('scheduled', 'active')");
    expect(migration).toContain("UPDATE hunt_invitations SET status = 'expired'");
  });

  it('enforces creator limits, validation, and deterministic stop roles server-side', () => {
    expect(migration).toContain('CREATE OR REPLACE FUNCTION assert_hunt_creator_eligible');
    expect(migration).toContain('draft_limit_reached');
    expect(migration).toContain('creation_rate_limited');
    expect(migration).toContain('CREATE OR REPLACE FUNCTION validate_creator_hunt_payload');
    expect(migration).toContain('location_required_for_stop');
    expect(migration).toContain('WITH ORDINALITY');
    expect(migration).toContain("WHEN v_position = jsonb_array_length");
  });

  it('does not offer unsupported QR proof persistence', () => {
    expect(migration).not.toContain("WHEN 'qr_code' THEN");
  });

  it('requires matching approved proof or trusted location validation before completion', () => {
    expect(proofEnforcement).toContain("p_validation_method <> v_stop.completion_method");
    expect(proofEnforcement).toContain("v_proof.status <> 'approved'");
    expect(proofEnforcement).toContain("v_proof.submission_type::TEXT <> v_stop.completion_method");
    expect(proofEnforcement).toContain('server_location_validated_at IS NULL');
    expect(proofEnforcement).toContain('ST_DWithin(');
    expect(proofEnforcement).toContain('CREATE OR REPLACE FUNCTION approve_hunt_stop_proof');
    expect(proofEnforcement).toContain('v_result := complete_hunt_stop(');
    expect(proofVocabulary).toContain("ADD VALUE IF NOT EXISTS 'image'");
    expect(proofVocabulary).toContain("ADD VALUE IF NOT EXISTS 'image_and_location'");
    expect(creatorWriteBoundary).toContain('DROP POLICY IF EXISTS "hunts_creator_manage" ON hunts');
    expect(creatorWriteBoundary).toContain('DROP POLICY IF EXISTS "hunts_creator_insert" ON hunts');
  });
});