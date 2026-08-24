-- Prompt 25: server-enforced one-time verification sessions for Quest proof.

CREATE TABLE IF NOT EXISTS quest_proof_verification_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  participation_id UUID NOT NULL REFERENCES quest_participations(id) ON DELETE CASCADE,
  evidence_kind proof_type NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '15 minutes'),
  consumed_at TIMESTAMPTZ
);

ALTER TABLE quest_proof_verification_sessions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "owners read own verification sessions" ON quest_proof_verification_sessions;
CREATE POLICY "owners read own verification sessions"
  ON quest_proof_verification_sessions FOR SELECT USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION issue_quest_proof_verification_session(
  p_participation_id UUID,
  p_user_id UUID,
  p_evidence_kind proof_type
) RETURNS UUID
LANGUAGE plpgsql SECURITY INVOKER AS $$
DECLARE session_id UUID;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_user_id THEN RAISE EXCEPTION 'not authorized'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM quest_participations
    WHERE id = p_participation_id AND user_id = p_user_id
      AND status IN ('started', 'in_progress', 'needs_resubmission')
  ) THEN RAISE EXCEPTION 'participation is not eligible'; END IF;
  INSERT INTO quest_proof_verification_sessions (user_id, participation_id, evidence_kind)
  VALUES (p_user_id, p_participation_id, p_evidence_kind)
  RETURNING id INTO session_id;
  RETURN session_id;
END;
$$;

REVOKE ALL ON FUNCTION issue_quest_proof_verification_session(UUID, UUID, proof_type) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION issue_quest_proof_verification_session(UUID, UUID, proof_type) TO authenticated;

ALTER TABLE proof_submissions
  ADD COLUMN IF NOT EXISTS verification_session_id UUID REFERENCES quest_proof_verification_sessions(id) ON DELETE RESTRICT;

CREATE OR REPLACE FUNCTION enforce_quest_proof_verification()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE session quest_proof_verification_sessions%ROWTYPE;
BEGIN
  IF NEW.quest_participation_id IS NOT NULL
     AND NEW.submission_type IN ('photo', 'video', 'location') THEN
    IF NEW.verification_session_id IS NULL THEN
      RAISE EXCEPTION 'Quest visual/location proof requires a verification session';
    END IF;
    SELECT * INTO session FROM quest_proof_verification_sessions
    WHERE id = NEW.verification_session_id
      AND participation_id = NEW.quest_participation_id
      AND user_id = NEW.user_id
      AND evidence_kind = NEW.submission_type
      AND consumed_at IS NULL
      AND expires_at > NOW();
    IF NOT FOUND THEN RAISE EXCEPTION 'verification session is invalid, expired, or already consumed'; END IF;
  END IF;
  IF TG_OP = 'UPDATE' AND NEW.quest_participation_id IS NOT NULL
     AND OLD.status = 'draft' AND NEW.status = 'submitted'
     AND NEW.verification_session_id IS NOT NULL THEN
    UPDATE quest_proof_verification_sessions
    SET consumed_at = NOW()
    WHERE id = NEW.verification_session_id AND consumed_at IS NULL;
    IF NOT FOUND THEN RAISE EXCEPTION 'verification session has already been consumed'; END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_quest_proof_verification ON proof_submissions;
CREATE TRIGGER trg_quest_proof_verification
  BEFORE INSERT OR UPDATE OF status ON proof_submissions
  FOR EACH ROW EXECUTE FUNCTION enforce_quest_proof_verification();