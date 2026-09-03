-- Repair the proof-session issuer so authenticated players can create the
-- server-controlled session required by the RLS-protected proof trigger.

CREATE OR REPLACE FUNCTION issue_quest_proof_verification_session(
  p_participation_id UUID,
  p_user_id UUID,
  p_evidence_kind proof_type
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  session_id UUID;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM quest_participations
    WHERE id = p_participation_id
      AND user_id = p_user_id
      AND status IN ('started', 'in_progress', 'needs_resubmission')
  ) THEN
    RAISE EXCEPTION 'participation is not eligible';
  END IF;

  INSERT INTO quest_proof_verification_sessions (
    user_id,
    participation_id,
    evidence_kind
  )
  VALUES (
    p_user_id,
    p_participation_id,
    p_evidence_kind
  )
  RETURNING id INTO session_id;

  RETURN session_id;
END;
$$;

REVOKE ALL ON FUNCTION issue_quest_proof_verification_session(
  UUID,
  UUID,
  proof_type
) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION issue_quest_proof_verification_session(
  UUID,
  UUID,
  proof_type
) TO authenticated;