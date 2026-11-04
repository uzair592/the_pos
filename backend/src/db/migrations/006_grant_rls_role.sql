-- 006_grant_rls_role.sql
-- Ensure pos_rls_role exists and has schema privileges for RLS non-superuser execution
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'pos_rls_role') THEN
    CREATE ROLE pos_rls_role WITH NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE;
  END IF;
  GRANT USAGE ON SCHEMA public TO pos_rls_role;
  GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO pos_rls_role;
  GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO pos_rls_role;
  ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO pos_rls_role;
  ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO pos_rls_role;
END $$;

