-- Migration 020_backup_and_import_history.sql
-- Complete Backup, Restore & Data Import Tracking for Restaurant POS SaaS

CREATE TABLE IF NOT EXISTS backups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  branch_id UUID REFERENCES branches(id) ON DELETE SET NULL,
  backup_name TEXT NOT NULL DEFAULT 'Restaurant Backup',
  file_name TEXT NOT NULL DEFAULT 'restaurant_backup.zip',
  file_path TEXT,
  file_size BIGINT DEFAULT 0,
  checksum TEXT,
  version TEXT NOT NULL DEFAULT '1.0',
  backup_type TEXT NOT NULL DEFAULT 'FULL', -- 'FULL', 'SAFETY_PRE_RESTORE'
  status TEXT NOT NULL DEFAULT 'COMPLETED', -- 'COMPLETED', 'FAILED'
  metadata JSONB DEFAULT '{}'::jsonb,
  created_by_user_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Safely add missing columns if backups table existed from earlier migrations
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'backups' AND column_name = 'backup_name') THEN
    ALTER TABLE backups ADD COLUMN backup_name TEXT NOT NULL DEFAULT 'Restaurant Backup';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'backups' AND column_name = 'file_name') THEN
    ALTER TABLE backups ADD COLUMN file_name TEXT NOT NULL DEFAULT 'restaurant_backup.zip';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'backups' AND column_name = 'file_size') THEN
    ALTER TABLE backups ADD COLUMN file_size BIGINT DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'backups' AND column_name = 'backup_type') THEN
    ALTER TABLE backups ADD COLUMN backup_type TEXT NOT NULL DEFAULT 'FULL';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'backups' AND column_name = 'status') THEN
    ALTER TABLE backups ADD COLUMN status TEXT NOT NULL DEFAULT 'COMPLETED';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'backups' AND column_name = 'metadata') THEN
    ALTER TABLE backups ADD COLUMN metadata JSONB DEFAULT '{}'::jsonb;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'backups' AND column_name = 'created_by_user_id') THEN
    ALTER TABLE backups ADD COLUMN created_by_user_id UUID;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS import_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_format TEXT NOT NULL, -- 'JSON', 'ZIP', 'XLSX', 'CSV'
  entity_type TEXT NOT NULL, -- 'ALL', 'INVENTORY', 'MENU', 'SUPPLIERS', 'CUSTOMERS', 'PURCHASES', 'RECIPES'
  strategy TEXT NOT NULL DEFAULT 'CREATE_NEW', -- 'CREATE_NEW', 'UPDATE_MATCHING', 'SKIP_DUPLICATES'
  total_records INT DEFAULT 0,
  success_count INT DEFAULT 0,
  failed_count INT DEFAULT 0,
  skipped_count INT DEFAULT 0,
  updated_count INT DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'SUCCESS', -- 'SUCCESS', 'PARTIAL', 'FAILED'
  errors_log JSONB DEFAULT '[]'::jsonb,
  summary JSONB DEFAULT '{}'::jsonb,
  imported_by_user_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_backups_tenant_date ON backups (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_import_history_tenant_date ON import_history (tenant_id, created_at DESC);

-- Enable Row Level Security (RLS)
ALTER TABLE backups ENABLE ROW LEVEL SECURITY;
ALTER TABLE backups FORCE ROW LEVEL SECURITY;

ALTER TABLE import_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE import_history FORCE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'backups' AND policyname = 'backups_tenant_isolation') THEN
    CREATE POLICY backups_tenant_isolation ON backups
      FOR ALL
      USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'import_history' AND policyname = 'import_history_tenant_isolation') THEN
    CREATE POLICY import_history_tenant_isolation ON import_history
      FOR ALL
      USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);
  END IF;
END $$;

