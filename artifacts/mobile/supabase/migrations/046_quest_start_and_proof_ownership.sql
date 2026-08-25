-- Close client-create boundaries without changing the supported owner-start
-- flow for manual Quest participation.

DROP POLICY IF EXISTS "qp_owner_insert" ON quest_participations;
CREATE POLICY "qp_owner_insert"
  ON quest_participations FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND status = 'started'
    AND awarded_points IS NULL
    AND EXISTS (
      SELECT 1
      FROM quests q
      WHERE q.id = quest_id
        AND q.status = 'published'
        AND q.available_from <= NOW()
        AND q.available_until > NOW()
        AND q.points_reward = reward_snapshot_points
    )
  );

DROP POLICY IF EXISTS "proof_owner_insert" ON proof_submissions;
CREATE POLICY "proof_owner_insert"
  ON proof_submissions FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND (
      (
        quest_participation_id IS NOT NULL
        AND EXISTS (
          SELECT 1
          FROM quest_participations qp
          WHERE qp.id = quest_participation_id
            AND qp.user_id = auth.uid()
        )
      )
      OR (
        hunt_stop_progress_id IS NOT NULL
        AND EXISTS (
          SELECT 1
          FROM hunt_stop_progress hsp
          JOIN hunt_participants hp ON hp.id = hsp.hunt_participant_id
          WHERE hsp.id = hunt_stop_progress_id
            AND hp.user_id = auth.uid()
        )
      )
    )
  );

COMMENT ON POLICY "qp_owner_insert" ON quest_participations IS
  'Owners can start only a currently published Quest with the server catalog reward snapshot.';
COMMENT ON POLICY "proof_owner_insert" ON proof_submissions IS
  'Proof creators may attach evidence only to a Quest participation or Hunt stop they own.';