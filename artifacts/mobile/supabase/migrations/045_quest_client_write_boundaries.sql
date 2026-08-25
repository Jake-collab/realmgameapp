-- Quest lifecycle and proof write boundaries.
-- Clients may progress, abandon, expire, and submit their own work, but
-- completion rewards and review fields remain trusted-server responsibilities.

DROP POLICY IF EXISTS "qp_owner_update_progress" ON quest_participations;
CREATE POLICY "qp_owner_update_lifecycle"
  ON quest_participations FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    AND status NOT IN ('completed', 'rejected')
  );

-- Column privileges make the lifecycle rule enforceable. RLS alone cannot
-- prevent an owner from changing awarded_points in an otherwise valid update.
REVOKE UPDATE ON quest_participations FROM anon, authenticated;
GRANT UPDATE (
  status,
  last_progress_at,
  submitted_at,
  abandoned_at,
  expires_at
) ON quest_participations TO authenticated;

DROP POLICY IF EXISTS "proof_owner_update_draft" ON proof_submissions;
CREATE POLICY "proof_owner_update_draft"
  ON proof_submissions FOR UPDATE
  USING (
    auth.uid() = user_id
    AND status IN ('draft', 'uploading')
  )
  WITH CHECK (
    auth.uid() = user_id
    AND status IN ('draft', 'uploading', 'submitted')
  );

-- A user can edit evidence while drafting and submit it once, but cannot
-- alter reviewer, moderation, ownership, or post-submission fields.
REVOKE UPDATE ON proof_submissions FROM anon, authenticated;
GRANT UPDATE (
  text_response,
  location_lat,
  location_lng,
  location_accuracy_meters,
  status,
  submitted_at
) ON proof_submissions TO authenticated;

COMMENT ON POLICY "qp_owner_update_lifecycle" ON quest_participations IS
  'Owners may update only non-terminal lifecycle fields. Completion and rewards require trusted RPCs.';
COMMENT ON POLICY "proof_owner_update_draft" ON proof_submissions IS
  'Evidence can move from draft/uploading to submitted once; submitted proof is immutable to its owner.';