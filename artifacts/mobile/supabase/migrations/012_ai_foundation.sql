-- ============================================================
-- Migration 012 — AI Generation Foundation
-- Worlds — Build 1, Prompt 3
-- ============================================================
-- Tables prepared but NOT activated. No AI API calls in this prompt.
-- AI-generated quests must never be auto-published.
--
-- ai_prompt_templates   : versioned prompt instructions
-- ai_prompt_versions    : history of template versions
-- ai_generation_requests : per-generation job records
-- ai_generated_content  : drafts produced by AI
-- ============================================================

-- ──────────────────────────────────────────────────────────────
-- ai_prompt_templates
-- ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS ai_prompt_templates (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug              TEXT NOT NULL UNIQUE,
  name              TEXT NOT NULL,
  prompt_type       TEXT NOT NULL,
    -- quest_generation | hunt_generation | clue_generation | content_review
  description       TEXT,
  system_instructions TEXT NOT NULL,
  user_template     TEXT NOT NULL,
    -- Template with placeholders, e.g. {{city}}, {{difficulty}}, {{category}}
  is_active         BOOLEAN NOT NULL DEFAULT FALSE,
    -- Inactive by default — must be explicitly activated by admin
  created_by        UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE ai_prompt_templates IS
  'Versioned AI prompt templates. is_active=false by default — explicit admin activation required. '
  'No AI API calls are made in this prompt.';

CREATE TRIGGER trg_ai_templates_updated_at
  BEFORE UPDATE ON ai_prompt_templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ──────────────────────────────────────────────────────────────
-- ai_prompt_versions  (version history)
-- ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS ai_prompt_versions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES ai_prompt_templates(id) ON DELETE CASCADE,
  version     INTEGER NOT NULL,
  system_instructions TEXT NOT NULL,
  user_template       TEXT NOT NULL,
  change_notes        TEXT,
  created_by  UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (template_id, version)
);

COMMENT ON TABLE ai_prompt_versions IS 'Immutable version history for each prompt template.';

-- ──────────────────────────────────────────────────────────────
-- ai_generation_requests
-- ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS ai_generation_requests (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id     UUID REFERENCES ai_prompt_templates(id) ON DELETE SET NULL,
  template_version INTEGER,
  prompt_type     TEXT NOT NULL,
  status          ai_generation_status NOT NULL DEFAULT 'pending',
  provider        TEXT,                -- anthropic | openai | gemini (populated at runtime)
  model           TEXT,                -- e.g. claude-opus-4-5 (populated at runtime)
  input_parameters JSONB NOT NULL DEFAULT '{}',
    -- e.g. {"city": "Auckland", "category": "nature", "difficulty": "medium"}
  raw_prompt      TEXT,                -- resolved prompt sent to AI (populated at runtime)
  raw_response    TEXT,                -- raw API response text
  input_tokens    INTEGER,
  output_tokens   INTEGER,
  cost_usd        NUMERIC(10, 6),
  error_details   JSONB,
  requested_by    UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE ai_generation_requests IS
  'One row per AI generation job. No API calls are made in this prompt. '
  'Populated when AI integration is activated (future prompt).';

CREATE TRIGGER trg_ai_requests_updated_at
  BEFORE UPDATE ON ai_generation_requests
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ──────────────────────────────────────────────────────────────
-- ai_generated_content  (drafts)
-- ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS ai_generated_content (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  generation_request_id UUID REFERENCES ai_generation_requests(id) ON DELETE SET NULL,
  content_type        TEXT NOT NULL,   -- quest | hunt | clue | category_tag
  output_draft        JSONB NOT NULL,  -- parsed structured output from AI
  suggested_points    INTEGER CHECK (suggested_points IS NULL OR suggested_points > 0),
  quality_score       NUMERIC(5,4),    -- 0.0000 – 1.0000 (AI self-assessed or future review model)
  safety_score        NUMERIC(5,4),    -- 0.0000 – 1.0000 (higher = safer)
  approval_status     ai_approval_status NOT NULL DEFAULT 'pending_review',
  reviewer_id         UUID REFERENCES profiles(id) ON DELETE SET NULL,
  reviewer_notes      TEXT,
  reviewed_at         TIMESTAMPTZ,
  -- Link to published entity (once approved and promoted)
  published_quest_id  UUID REFERENCES quests(id) ON DELETE SET NULL,
  published_hunt_id   UUID REFERENCES hunts(id) ON DELETE SET NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE ai_generated_content IS
  'AI-drafted content awaiting human review. '
  'approval_status=approved does NOT automatically publish — '
  'an admin must explicitly create the quest/hunt from this draft. '
  'AI-generated content is never auto-published.';

COMMENT ON COLUMN ai_generated_content.output_draft IS
  'Parsed AI output. Treat as untrusted input until human-reviewed. '
  'Never insert output_draft values directly into quests without validation.';

CREATE TRIGGER trg_ai_content_updated_at
  BEFORE UPDATE ON ai_generated_content
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ──────────────────────────────────────────────────────────────
-- Backfill: add FK from quests → ai_generated_content
-- (ai_generated_content didn't exist when 005 ran)
-- ──────────────────────────────────────────────────────────────

ALTER TABLE quests
  ADD CONSTRAINT fk_quest_ai_generation
  FOREIGN KEY (ai_generation_id)
  REFERENCES ai_generated_content(id)
  ON DELETE SET NULL
  DEFERRABLE INITIALLY DEFERRED;
