-- Allow the server-side admin session resolver to recognize the full
-- approved staff hierarchy. Existing accounts remain unchanged.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum
    WHERE enumtypid = 'user_role'::regtype
      AND enumlabel = 'super_admin'
  ) THEN
    ALTER TYPE user_role ADD VALUE 'super_admin';
  END IF;
END
$$;