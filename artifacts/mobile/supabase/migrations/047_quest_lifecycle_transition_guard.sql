-- Direct client writes may advance only through the non-trusted portion of
-- the participation state machine. Trusted SECURITY DEFINER RPCs retain their
-- authority for completion and review decisions.

CREATE OR REPLACE FUNCTION enforce_authenticated_quest_transition()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  -- Supabase executes direct PostgREST writes as the `authenticated` role.
  -- A SECURITY DEFINER completion/review RPC executes its update as its owner.
  IF current_user <> 'authenticated' OR NEW.status = OLD.status THEN
    RETURN NEW;
  END IF;

  IF NOT (
    (OLD.status = 'started' AND NEW.status IN ('in_progress', 'awaiting_proof', 'abandoned', 'expired'))
    OR (OLD.status = 'in_progress' AND NEW.status IN ('awaiting_proof', 'abandoned', 'expired'))
    OR (OLD.status = 'awaiting_proof' AND NEW.status IN ('under_review', 'abandoned', 'expired'))
    OR (OLD.status = 'needs_resubmission' AND NEW.status IN ('under_review', 'abandoned'))
  ) THEN
    RAISE EXCEPTION 'Invalid client participation transition from % to %', OLD.status, NEW.status;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_authenticated_quest_transition
  ON quest_participations;
CREATE TRIGGER trg_enforce_authenticated_quest_transition
  BEFORE UPDATE OF status ON quest_participations
  FOR EACH ROW EXECUTE FUNCTION enforce_authenticated_quest_transition();

COMMENT ON FUNCTION enforce_authenticated_quest_transition() IS
  'Prevents authenticated clients from reviving terminal Quest participations or bypassing lifecycle transitions.';