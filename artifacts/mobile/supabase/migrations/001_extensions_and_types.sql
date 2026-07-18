-- ============================================================
-- Migration 001 — Extensions and Enumerated Types
-- Worlds — Build 1, Prompt 3
-- ============================================================
-- Run this against a fresh Supabase project BEFORE all other migrations.
-- Extensions: pgcrypto (UUID generation), PostGIS (geospatial queries)
-- PostGIS is justified: Geo-Quest radius checks and Hunt stop validation
-- require geospatial operations that plain lat/lon math cannot safely
-- and efficiently serve at scale.
-- ============================================================

-- ──────────────────────────────────────────────────────────────
-- Extensions
-- ──────────────────────────────────────────────────────────────

CREATE EXTENSION IF NOT EXISTS pgcrypto;      -- gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS postgis;       -- geometry, ST_DWithin, ST_Contains

-- ──────────────────────────────────────────────────────────────
-- Reusable timestamp trigger function
-- ──────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- ──────────────────────────────────────────────────────────────
-- Enumerated Types
-- Use DO blocks so reruns don't error on existing types.
-- ──────────────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('user', 'creator', 'moderator', 'admin');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE account_status AS ENUM ('active', 'restricted', 'suspended', 'deactivated');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE onboarding_status AS ENUM (
    'not_started', 'in_progress', 'completed'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE game_mode AS ENUM ('quest', 'hunt');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── Media ─────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE media_type AS ENUM ('image', 'video', 'document', 'audio');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE media_visibility AS ENUM ('private', 'restricted', 'public');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE moderation_status AS ENUM (
    'pending', 'scanning', 'approved', 'rejected', 'manual_review'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── Quest ─────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE quest_type AS ENUM ('daily', 'monthly', 'geo');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE quest_status AS ENUM (
    'draft', 'pending_review', 'approved', 'scheduled', 'published',
    'paused', 'expired', 'archived', 'rejected'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE quest_source_type AS ENUM ('admin', 'ai', 'system');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE difficulty AS ENUM ('very_easy', 'easy', 'medium', 'hard', 'epic');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE proof_type AS ENUM ('photo', 'video', 'text', 'location', 'qr_code', 'none');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE location_requirement_type AS ENUM ('none', 'approximate', 'precise');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE indoor_outdoor AS ENUM ('indoor', 'outdoor', 'both');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE participation_status AS ENUM (
    'started', 'in_progress', 'awaiting_proof', 'under_review',
    'needs_resubmission', 'completed', 'rejected', 'abandoned', 'expired'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE step_status AS ENUM (
    'not_started', 'in_progress', 'completed', 'skipped'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE proof_submission_status AS ENUM (
    'draft', 'uploading', 'submitted', 'under_review',
    'approved', 'rejected', 'needs_resubmission'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── Hunt ──────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE hunt_type AS ENUM ('official', 'custom', 'community');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE hunt_status AS ENUM (
    'draft', 'pending_review', 'ready', 'scheduled', 'active',
    'paused', 'completed', 'cancelled', 'expired', 'archived', 'rejected'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE hunt_privacy AS ENUM ('public', 'unlisted', 'invite_only', 'private');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE hunt_join_policy AS ENUM ('open', 'approval_required', 'invite_only');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE participant_role AS ENUM ('creator', 'player', 'co_host');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE participant_status AS ENUM (
    'invited', 'accepted', 'ready', 'active', 'paused',
    'completed', 'declined', 'removed', 'left', 'expired'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE invitation_status AS ENUM (
    'pending', 'accepted', 'declined', 'revoked', 'expired'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── Points ────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE point_transaction_type AS ENUM (
    'quest_reward', 'hunt_reward', 'achievement_reward',
    'admin_adjustment', 'reversal'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── Achievements ─────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE achievement_category AS ENUM (
    'quest', 'hunt', 'exploration', 'milestone', 'community', 'event'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── Notifications ─────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE notification_type AS ENUM (
    'quest_available', 'monthly_drop', 'hunt_invitation', 'hunt_accepted',
    'hunt_starting', 'proof_approved', 'proof_rejected', 'needs_resubmission',
    'achievement_earned', 'admin_message', 'safety_action'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── Safety ────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE report_status AS ENUM (
    'submitted', 'triaged', 'under_review', 'action_taken',
    'dismissed', 'appealed', 'closed'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE report_priority AS ENUM ('low', 'medium', 'high', 'critical');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE reportable_entity AS ENUM (
    'user_profile', 'quest', 'hunt', 'hunt_stop', 'custom_game',
    'media_asset', 'proof_submission', 'other'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE moderation_case_status AS ENUM (
    'open', 'under_review', 'action_taken', 'dismissed', 'appealed', 'closed'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── AI ────────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE ai_generation_status AS ENUM (
    'pending', 'processing', 'completed', 'failed', 'cancelled'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE ai_approval_status AS ENUM (
    'pending_review', 'approved', 'rejected', 'needs_revision'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
