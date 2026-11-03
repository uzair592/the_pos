-- create_roles.sql
-- Run this script (once) to create the two database roles needed for the application.
-- It assumes you are connected as a PostgreSQL superuser (e.g., the default 'postgres' user).
-- Do NOT commit any real passwords; replace <PASSWORD> with secure values in your environment.

-- 1. Application runtime role – limited privileges, no superuser, no BYPASSRLS.
CREATE ROLE app_user LOGIN PASSWORD '<APP_USER_PASSWORD>' NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT;

-- Grant usage on the public schema and CONNECT on the database (replace <DB_NAME>).
GRANT CONNECT ON DATABASE restaurant_pos_db TO app_user;
GRANT USAGE ON SCHEMA public TO app_user;

-- Grant SELECT, INSERT, UPDATE, DELETE on all tenant tables.
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_user;
-- Future tables automatically get these privileges.
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_user;

-- Ensure the role cannot bypass Row Level Security.
REVOKE BYPASSRLS ON DATABASE restaurant_pos_db FROM app_user;

-- 2. Migration role – full DDL privileges on the schema.
CREATE ROLE migration_user LOGIN PASSWORD '<MIGRATION_PASSWORD>' NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT;

-- Grant the migration role ownership of the schema so it can create/alter tables.
ALTER SCHEMA public OWNER TO migration_user;

-- Grant all DDL privileges needed for migrations.
GRANT ALL ON SCHEMA public TO migration_user;
GRANT ALL ON ALL TABLES IN SCHEMA public TO migration_user;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO migration_user;
-- Future objects created by migration_user will be owned by it.
ALTER DEFAULT PRIVILEGES FOR ROLE migration_user IN SCHEMA public GRANT ALL ON TABLES TO migration_user;
ALTER DEFAULT PRIVILEGES FOR ROLE migration_user IN SCHEMA public GRANT ALL ON SEQUENCES TO migration_user;

-- Note: In production you should store the passwords securely (e.g., in .env files) and never check them into version control.
