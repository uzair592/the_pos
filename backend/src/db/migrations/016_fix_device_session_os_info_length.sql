-- Fix active_device_sessions, registered_devices, and audit_logs column lengths
ALTER TABLE active_device_sessions ALTER COLUMN os_info TYPE TEXT;
ALTER TABLE active_device_sessions ALTER COLUMN ip_address TYPE VARCHAR(255);
ALTER TABLE active_device_sessions ALTER COLUMN device_name TYPE VARCHAR(255);
ALTER TABLE active_device_sessions ALTER COLUMN user_name TYPE VARCHAR(255);
ALTER TABLE active_device_sessions ALTER COLUMN device_fingerprint TYPE VARCHAR(255);
ALTER TABLE active_device_sessions ALTER COLUMN app_version TYPE TEXT;
ALTER TABLE active_device_sessions ALTER COLUMN device_type TYPE TEXT;
ALTER TABLE active_device_sessions ALTER COLUMN status TYPE TEXT;

ALTER TABLE registered_devices ALTER COLUMN ip_address TYPE VARCHAR(255);
ALTER TABLE registered_devices ALTER COLUMN device_name TYPE VARCHAR(255);
ALTER TABLE registered_devices ALTER COLUMN device_fingerprint TYPE VARCHAR(255);
ALTER TABLE registered_devices ALTER COLUMN device_type TYPE TEXT;
ALTER TABLE registered_devices ALTER COLUMN default_workspace TYPE TEXT;
ALTER TABLE registered_devices ALTER COLUMN last_user_name TYPE TEXT;
ALTER TABLE registered_devices ALTER COLUMN last_user_email TYPE TEXT;

-- Also ensure audit_logs can accept full user agents, action names, resource types
ALTER TABLE audit_logs ALTER COLUMN ip_address TYPE VARCHAR(255);
ALTER TABLE audit_logs ALTER COLUMN action TYPE TEXT;
ALTER TABLE audit_logs ALTER COLUMN resource_type TYPE TEXT;
ALTER TABLE audit_logs ALTER COLUMN actor_role TYPE TEXT;
