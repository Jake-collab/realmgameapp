-- ============================================================
-- Migration 044 — Prompt 20 reward safety gate
-- Worlds — Build 1
-- ============================================================
-- Reward RPCs already validate ownership, state, and idempotency. This
-- independent trigger prevents a future reward path from bypassing safety.

CREATE OR REPLACE FUNCTION assert_reward_proof_safe()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_unapproved_count INTEGER;
BEGIN
  IF NEW.transaction_type NOT IN ('quest_reward', 'hunt_reward') THEN
    RETURN NEW;
  END IF;

  IF NEW.quest_participation_id IS NOT NULL THEN
    SELECT COUNT(*) INTO v_unapproved_count
    FROM proof_submissions ps
    WHERE ps.quest_participation_id = NEW.quest_participation_id
      AND (
        ps.status <> 'approved'
        OR ps.moderation_status <> 'approved'
        OR ps.moderation_review_required = TRUE
      );
  ELSIF NEW.hunt_participant_id IS NOT NULL THEN
    SELECT COUNT(*) INTO v_unapproved_count
    FROM proof_submissions ps
    JOIN hunt_stop_progress hsp ON hsp.id = ps.hunt_stop_progress_id
    WHERE hsp.hunt_participant_id = NEW.hunt_participant_id
      AND (
        ps.status <> 'approved'
        OR ps.moderation_status <> 'approved'
        OR ps.moderation_review_required = TRUE
      );
  END IF;

  IF COALESCE(v_unapproved_count, 0) > 0 THEN
    RAISE EXCEPTION 'Reward is blocked until required proof passes safety review';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_reward_proof_safety_gate ON points_ledger;
CREATE TRIGGER trg_reward_proof_safety_gate
  BEFORE INSERT ON points_ledger
  FOR EACH ROW EXECUTE FUNCTION assert_reward_proof_safe();

-- All leaderboard views are derived from the ledger, so exclude only
-- currently quarantined originals. Released rewards remain visible; reversed
-- rewards are represented by the append-only reversal transaction.
CREATE OR REPLACE VIEW user_point_totals AS
SELECT
  pl.user_id,
  COALESCE(SUM(pl.amount), 0)::INTEGER AS total_points,
  COUNT(*) AS transaction_count,
  MAX(pl.created_at) AS last_transaction_at
FROM points_ledger pl
WHERE NOT EXISTS (
  SELECT 1 FROM point_quarantines pq
  WHERE pq.ledger_id = pl.id AND pq.status = 'quarantined'
)
GROUP BY pl.user_id;

COMMENT ON VIEW user_point_totals IS
  'Computed points excluding currently quarantined reward ledger rows. '
  'Ledger rows remain append-only; release and reversal are explicit trusted actions.';