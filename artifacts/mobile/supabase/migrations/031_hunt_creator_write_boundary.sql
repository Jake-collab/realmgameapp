-- Creator changes must pass through the SECURITY DEFINER lifecycle RPCs.
-- The old policy permitted direct client updates, including status escalation.
DROP POLICY IF EXISTS "hunts_creator_manage" ON hunts;
DROP POLICY IF EXISTS "hunts_creator_insert" ON hunts;