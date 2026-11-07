-- Ensure unique constraint on (tenant_id, device_fingerprint) for active device sessions
DELETE FROM active_device_sessions a USING active_device_sessions b
WHERE a.id < b.id AND a.tenant_id = b.tenant_id AND a.device_fingerprint = b.device_fingerprint;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'uq_active_device_session'
  ) THEN
    ALTER TABLE active_device_sessions
      ADD CONSTRAINT uq_active_device_session UNIQUE (tenant_id, device_fingerprint);
  END IF;
END $$;

