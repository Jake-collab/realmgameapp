-- Creator proof methods use the active-Hunt vocabulary. Extend the shared
-- proof enum so submitted image proofs exactly match persisted stop methods.
ALTER TYPE proof_type ADD VALUE IF NOT EXISTS 'image';
ALTER TYPE proof_type ADD VALUE IF NOT EXISTS 'image_and_location';