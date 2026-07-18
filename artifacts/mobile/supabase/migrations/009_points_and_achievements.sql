-- ============================================================
-- Migration 009 — Points Ledger and Achievements
-- Worlds — Build 1, Prompt 3
-- ============================================================
-- points_ledger     : append-only financial-grade points record
-- user_point_totals : view (not a mutable column)
-- achievements      : admin-managed achievement definitions
-- user_achievements : earned achievement records
-- ============================================================

-- ──────────────────────────────────────────────────────────────
-- points_ledger  (append-only)
-- ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS points_ledger (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                 UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  amount                  INTEGER NOT NULL,
    -- Positive = credit, negative = debit (reversals use positive + reversal type)
  transaction_type        point_transaction_type NOT NULL,
  source_type             TEXT NOT NULL,     -- quest | hunt | achievement | admin | system
  source_id               UUID,              -- id of the quest/hunt/achievement/etc.
  quest_participation_id  UUID REFERENCES quest_participations(id) ON DELETE RESTRICT,
  hunt_participant_id     UUID REFERENCES hunt_participants(id) ON DELETE RESTRICT,
  achievement_id          UUID,              -- FK to achievements.id (added after table creation)
  reason                  TEXT,              -- human-readable audit note
  idempotency_key         TEXT NOT NULL UNIQUE,
    -- Format: {transaction_type}:{source_id}:{user_id}
    -- Prevents duplicate reward inserts
  created_by              UUID REFERENCES profiles(id) ON DELETE SET NULL,
    -- NULL = system/server; non-NULL = admin who performed adjustment
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reversed_transaction_id UUID REFERENCES points_ledger(id) ON DELETE RESTRICT,
    -- For reversals: references the original transaction

  -- amount must be non-zero
  CONSTRAINT non_zero_amount CHECK (amount <> 0),

  -- reversals must reference an original transaction
  CONSTRAINT reversal_requires_ref CHECK (
    transaction_type <> 'reversal' OR reversed_transaction_id IS NOT NULL
  )
);

COMMENT ON TABLE points_ledger IS
  'Append-only points record. Do NOT delete rows to correct mistakes — insert a reversal. '
  'idempotency_key prevents duplicate rewards from retry logic. '
  'Users may only read their own rows; inserts require service_role or admin RPC.';

COMMENT ON COLUMN points_ledger.amount IS
  'Signed integer. Positive = points awarded. Negative not used directly; '
  'use transaction_type=reversal with a positive amount against reversed_transaction_id.';

COMMENT ON COLUMN points_ledger.idempotency_key IS
  'Unique key that prevents double-awarding. Format: {type}:{source_id}:{user_id}. '
  'Generate server-side before insert.';

-- Prevent clients from updating or deleting ledger rows
CREATE OR REPLACE FUNCTION prevent_ledger_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'points_ledger rows are immutable. Insert a reversal transaction instead.';
END;
$$;

CREATE TRIGGER trg_no_ledger_update
  BEFORE UPDATE ON points_ledger
  FOR EACH ROW EXECUTE FUNCTION prevent_ledger_mutation();

CREATE TRIGGER trg_no_ledger_delete
  BEFORE DELETE ON points_ledger
  FOR EACH ROW EXECUTE FUNCTION prevent_ledger_mutation();

-- ──────────────────────────────────────────────────────────────
-- user_point_totals  (view — single source of truth)
-- ──────────────────────────────────────────────────────────────
-- Do NOT store a mutable points_total column anywhere.
-- Query this view or use the calculate_user_points() function.

CREATE OR REPLACE VIEW user_point_totals AS
SELECT
  user_id,
  COALESCE(SUM(amount), 0)::INTEGER AS total_points,
  COUNT(*)                          AS transaction_count,
  MAX(created_at)                   AS last_transaction_at
FROM points_ledger
GROUP BY user_id;

COMMENT ON VIEW user_point_totals IS
  'Computed point totals from the ledger. The authoritative source for a user''s balance. '
  'For leaderboard use, join with public_profiles respecting leaderboard_visibility.';

-- Function for current-user rank retrieval
CREATE OR REPLACE FUNCTION get_user_rank(p_user_id UUID)
RETURNS INTEGER
LANGUAGE sql
STABLE
AS $$
  SELECT COUNT(*)::INTEGER + 1
  FROM user_point_totals
  WHERE total_points > (
    SELECT COALESCE(SUM(amount), 0) FROM points_ledger WHERE user_id = p_user_id
  );
$$;

COMMENT ON FUNCTION get_user_rank IS
  'Returns the 1-based rank of p_user_id by total points. '
  'Does not filter by leaderboard_visibility — apply that in the calling query.';

-- ──────────────────────────────────────────────────────────────
-- achievements
-- ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS achievements (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug              TEXT NOT NULL UNIQUE,
  name              TEXT NOT NULL,
  description       TEXT NOT NULL,
  category          achievement_category NOT NULL,
  icon_key          TEXT,
  point_reward      INTEGER NOT NULL DEFAULT 0 CHECK (point_reward >= 0),
  criteria          JSONB NOT NULL DEFAULT '{}',
    -- Flexible criteria config. Example:
    -- {"type": "quest_count", "target": 10, "quest_type": "daily"}
    -- Full rules engine is deferred — criteria is advisory for Build 1.
  is_active         BOOLEAN NOT NULL DEFAULT TRUE,
  is_hidden         BOOLEAN NOT NULL DEFAULT FALSE,
    -- hidden achievements are not shown in the achievement list until earned
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT slug_format CHECK (slug ~ '^[a-z0-9_-]+$'),
  CONSTRAINT name_length CHECK (char_length(name) BETWEEN 2 AND 80)
);

COMMENT ON TABLE achievements IS
  'Admin-managed achievement definitions. criteria is a JSONB advisory config; '
  'the evaluation engine is implemented in a later prompt. '
  'is_hidden achievements are invisible until earned.';

CREATE TRIGGER trg_achievements_updated_at
  BEFORE UPDATE ON achievements
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ──────────────────────────────────────────────────────────────
-- user_achievements  (earned records)
-- ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS user_achievements (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  achievement_id  UUID NOT NULL REFERENCES achievements(id) ON DELETE RESTRICT,
  earned_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  source_type     TEXT,      -- quest | hunt | admin | system
  source_id       UUID,      -- id of the quest/hunt that triggered it

  UNIQUE (user_id, achievement_id)  -- prevents duplicate awards
);

COMMENT ON TABLE user_achievements IS
  'Records of earned achievements. UNIQUE prevents double-awarding. '
  'Inserts performed by server-side logic only.';

-- Backfill FK on points_ledger → achievements
ALTER TABLE points_ledger
  ADD CONSTRAINT fk_ledger_achievement
  FOREIGN KEY (achievement_id)
  REFERENCES achievements(id)
  ON DELETE RESTRICT
  DEFERRABLE INITIALLY DEFERRED;
