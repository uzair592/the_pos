-- Migration: 012_platform_super_admin_enhancements.sql
-- Description: Complete Super Admin schema supporting multi-device sessions, backups, restoration history,
-- support tickets, announcements, platform users, API keys, and platform global settings.

-- 1. Enhance platform_admins
ALTER TABLE platform_admins
  ADD COLUMN IF NOT EXISTS role VARCHAR(50) DEFAULT 'SUPER_ADMIN',
  ADD COLUMN IF NOT EXISTS permissions JSONB DEFAULT '["*"]'::jsonb,
  ADD COLUMN IF NOT EXISTS phone VARCHAR(50),
  ADD COLUMN IF NOT EXISTS token_version INT DEFAULT 1;

-- 2. Enhance tenants
ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS max_concurrent_devices INT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS custom_features JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS deletion_reason TEXT;

-- 3. Active Device Sessions (Multi-device concurrent session tracking)
CREATE TABLE IF NOT EXISTS active_device_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  user_name VARCHAR(255),
  device_fingerprint VARCHAR(255) NOT NULL,
  device_name VARCHAR(255) NOT NULL,
  device_type VARCHAR(50) DEFAULT 'DESKTOP',
  ip_address VARCHAR(100),
  os_info VARCHAR(100),
  app_version VARCHAR(50) DEFAULT '1.0.0',
  status VARCHAR(50) DEFAULT 'ONLINE',
  session_token VARCHAR(255) UNIQUE,
  last_heartbeat_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_active_device_session UNIQUE (tenant_id, device_fingerprint)
);

CREATE INDEX IF NOT EXISTS idx_active_sessions_tenant ON active_device_sessions(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_active_sessions_heartbeat ON active_device_sessions(last_heartbeat_at);

-- 4. Data Restoration History
CREATE TABLE IF NOT EXISTS restoration_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  backup_file_name VARCHAR(255),
  restored_by_id UUID,
  restored_by_name VARCHAR(255),
  mode VARCHAR(50) DEFAULT 'FULL',
  records_restored INT DEFAULT 0,
  status VARCHAR(50) DEFAULT 'SUCCESS',
  details JSONB DEFAULT '{}'::jsonb,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_restoration_history_tenant ON restoration_history(tenant_id);

-- 5. Platform Support Tickets
CREATE TABLE IF NOT EXISTS platform_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_number VARCHAR(50) UNIQUE NOT NULL,
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  subject VARCHAR(255) NOT NULL,
  category VARCHAR(50) NOT NULL,
  priority VARCHAR(20) DEFAULT 'MEDIUM',
  status VARCHAR(30) DEFAULT 'OPEN',
  assigned_admin_id UUID REFERENCES platform_admins(id) ON DELETE SET NULL,
  created_by_user_id UUID,
  created_by_name VARCHAR(255),
  created_by_email VARCHAR(255),
  internal_notes TEXT,
  resolution_summary TEXT,
  resolved_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_platform_tickets_tenant ON platform_tickets(tenant_id);
CREATE INDEX IF NOT EXISTS idx_platform_tickets_status ON platform_tickets(status);

-- 6. Ticket Messages
CREATE TABLE IF NOT EXISTS platform_ticket_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES platform_tickets(id) ON DELETE CASCADE,
  sender_type VARCHAR(20) NOT NULL,
  sender_name VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  is_internal BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ticket_messages ON platform_ticket_messages(ticket_id);

-- 7. Platform Announcements
CREATE TABLE IF NOT EXISTS platform_announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  type VARCHAR(50) DEFAULT 'INFO',
  target_audience VARCHAR(50) DEFAULT 'ALL',
  is_active BOOLEAN DEFAULT TRUE,
  starts_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP WITH TIME ZONE,
  created_by_admin_id UUID REFERENCES platform_admins(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 8. Platform API Keys
CREATE TABLE IF NOT EXISTS platform_api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  key_prefix VARCHAR(20) NOT NULL,
  key_hash VARCHAR(255) NOT NULL,
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  permissions JSONB DEFAULT '["*"]'::jsonb,
  rate_limit_per_minute INT DEFAULT 120,
  is_active BOOLEAN DEFAULT TRUE,
  last_used_at TIMESTAMP WITH TIME ZONE,
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 9. Platform Global Settings
CREATE TABLE IF NOT EXISTS platform_settings (
  id INT PRIMARY KEY DEFAULT 1,
  platform_name VARCHAR(100) DEFAULT 'CloudPOS Platform',
  support_email VARCHAR(255) DEFAULT 'support@cloudpos.pk',
  support_phone VARCHAR(50) DEFAULT '+92 300 1234567',
  default_currency VARCHAR(10) DEFAULT 'PKR',
  default_timezone VARCHAR(100) DEFAULT 'Asia/Karachi',
  trial_days INT DEFAULT 14,
  grace_period_days INT DEFAULT 3,
  default_max_devices INT DEFAULT 4,
  maintenance_mode BOOLEAN DEFAULT FALSE,
  min_supported_app_version VARCHAR(20) DEFAULT '1.0.0',
  current_platform_version VARCHAR(20) DEFAULT '2.4.0',
  announcement_banner TEXT,
  config JSONB DEFAULT '{}'::jsonb,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Ensure default row exists
INSERT INTO platform_settings (id, platform_name)
VALUES (1, 'CloudPOS Platform')
ON CONFLICT (id) DO NOTHING;

-- 10. Enhance subscription_payments
ALTER TABLE subscription_payments
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT,
  ADD COLUMN IF NOT EXISTS verified_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS verified_by_admin_id UUID REFERENCES platform_admins(id),
  ADD COLUMN IF NOT EXISTS invoice_pdf_url TEXT;

-- RLS Grants for newly created tables
GRANT ALL ON active_device_sessions TO CURRENT_USER;
GRANT ALL ON restoration_history TO CURRENT_USER;
GRANT ALL ON platform_tickets TO CURRENT_USER;
GRANT ALL ON platform_ticket_messages TO CURRENT_USER;
GRANT ALL ON platform_announcements TO CURRENT_USER;
GRANT ALL ON platform_api_keys TO CURRENT_USER;
GRANT ALL ON platform_settings TO CURRENT_USER;
