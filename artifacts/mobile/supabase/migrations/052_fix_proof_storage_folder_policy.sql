-- Proof object paths are {user_id}/{proof_id-or-draft}/{filename}.
-- storage.foldername() returns only the two directory segments, not the file.

DROP POLICY IF EXISTS "worlds_proofs_insert_own" ON storage.objects;

CREATE POLICY "worlds_proofs_insert_own"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'proof-submissions'
  AND (storage.foldername(name))[1] = auth.uid()::TEXT
  AND array_length(storage.foldername(name), 1) >= 2
);