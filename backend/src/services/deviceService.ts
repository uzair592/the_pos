import crypto from 'crypto';
import { query } from '../db/connection.js';
import { getTenantSubscriptionDetails } from './subscriptionService.js';
import { logAuditEvent } from './auditService.js';

export interface DeviceSession {
  id: string;
  tenantId: string;
  branchId: string;
  userId?: string | null;
  userName?: string | null;
  deviceFingerprint: string;
  deviceName: string;
  deviceType: string;
  ipAddress?: string | null;
  osInfo?: string | null;
  appVersion?: string;
  status: 'ONLINE' | 'IDLE' | 'OFFLINE' | 'REVOKED';
  sessionToken?: string;
  lastHeartbeatAt: string;
  createdAt: string;
}

export interface ConcurrentDeviceSummary {
  tenantId: string;
  restaurantName?: string;
  connectedCount: number;
  maxConcurrentLimit: number;
  availableSessions: number;
  isLimitReached: boolean;
  statusBadge: string; // e.g. "2 / 4 Devices Connected"
  activeSessions: DeviceSession[];
}

/**
 * Get tenant configured maximum concurrent device limit
 * Checks: 1) Tenant-specific override, 2) Plan entitlements, 3) Global default (4)
 */
export async function getTenantMaxConcurrentDevices(tenantId: string): Promise<number> {
  const { rows: tRows } = await query(
    'SELECT max_concurrent_devices FROM tenants WHERE id = $1',
    [tenantId],
    { tenantId }
  );

  if (tRows.length > 0 && tRows[0].max_concurrent_devices !== null && tRows[0].max_concurrent_devices !== undefined) {
    return Math.max(1, Number(tRows[0].max_concurrent_devices));
  }

  const sub = await getTenantSubscriptionDetails(tenantId);
  const planLimit = sub?.entitlements?.maxDevices || sub?.entitlements?.maxConcurrentDevices;
  if (planLimit !== undefined && planLimit !== null && planLimit > 0) {
    return Number(planLimit);
  }

  return 4; // Standard enterprise default
}

/**
 * Returns accurate live concurrent device session summary
 * Stale sessions (heartbeat older than 3 minutes) or revoked sessions are excluded from currently connected count.
 */
export async function getConcurrentDeviceSummary(tenantId: string): Promise<ConcurrentDeviceSummary> {
  const maxLimit = await getTenantMaxConcurrentDevices(tenantId);

  // 1. Mark stale sessions (> 5 mins) as OFFLINE
  await query(
    `
    UPDATE active_device_sessions
    SET status = 'OFFLINE'
    WHERE tenant_id = $1 AND status = 'ONLINE' AND last_heartbeat_at < NOW() - INTERVAL '5 minutes'
    `,
    [tenantId],
    { tenantId }
  );

  // 2. Fetch live connected sessions (last heartbeat within 3 minutes)
  const { rows: sessions } = await query(
    `
    SELECT ads.*, b.name as branch_name, u.email as user_email
    FROM active_device_sessions ads
    LEFT JOIN branches b ON b.id = ads.branch_id
    LEFT JOIN users u ON u.id = ads.user_id
    WHERE ads.tenant_id = $1 AND ads.status = 'ONLINE' AND ads.last_heartbeat_at >= NOW() - INTERVAL '3 minutes'
    ORDER BY ads.last_heartbeat_at DESC
    `,
    [tenantId],
    { tenantId }
  );

  const connectedCount = sessions.length;
  const availableSessions = Math.max(0, maxLimit - connectedCount);
  const isLimitReached = connectedCount >= maxLimit;

  return {
    tenantId,
    connectedCount,
    maxConcurrentLimit: maxLimit,
    availableSessions,
    isLimitReached,
    statusBadge: `${connectedCount} / ${maxLimit} Devices Connected`,
    activeSessions: sessions.map((s) => ({
      id: s.id,
      tenantId: s.tenant_id,
      branchId: s.branch_id,
      userId: s.user_id,
      userName: s.user_name || s.user_email || 'Staff',
      deviceFingerprint: s.device_fingerprint,
      deviceName: s.device_name || 'Terminal',
      deviceType: s.device_type || 'DESKTOP',
      ipAddress: s.ip_address,
      osInfo: s.os_info,
      appVersion: s.app_version,
      status: s.status,
      sessionToken: s.session_token,
      lastHeartbeatAt: s.last_heartbeat_at,
      createdAt: s.created_at,
    })),
  };
}

/**
 * Verifies concurrent limit when a device attempts to log in.
 * If 4 devices are already connected and a 5th tries to log in, returns detailed active session
 * information so cashier or admin can revoke a device rather than silently terminating.
 */
export async function verifyAndEnforceConcurrentLimit(
  tenantId: string,
  branchId: string,
  deviceFingerprint: string,
  deviceName: string,
  deviceType: string,
  userId?: string,
  userName?: string,
  ipAddress?: string,
  osInfo?: string,
  appVersion?: string
): Promise<{
  allowed: boolean;
  sessionId?: string;
  error?: string;
  connectedCount: number;
  maxLimit: number;
  activeSessions?: DeviceSession[];
}> {
  const summary = await getConcurrentDeviceSummary(tenantId);

  // If this device already has an active session, refresh heartbeat and allow
  const existingIndex = summary.activeSessions.findIndex(
    (s) => s.deviceFingerprint === deviceFingerprint
  );

  if (existingIndex !== -1) {
    const existing = summary.activeSessions[existingIndex];
    await query(
      `
      UPDATE active_device_sessions
      SET last_heartbeat_at = CURRENT_TIMESTAMP, status = 'ONLINE', ip_address = $1, user_id = $2, user_name = $3
      WHERE id = $4
      `,
      [ipAddress || null, userId || null, userName || null, existing.id],
      { tenantId }
    );
    return {
      allowed: true,
      sessionId: existing.id,
      connectedCount: summary.connectedCount,
      maxLimit: summary.maxConcurrentLimit,
    };
  }

  // If limit reached, reject fifth device with clear messaging and active session list
  if (summary.connectedCount >= summary.maxConcurrentLimit) {
    return {
      allowed: false,
      error: `${summary.connectedCount} devices are currently connected. Your maximum concurrent device limit has been reached (${summary.connectedCount}/${summary.maxConcurrentLimit}).`,
      connectedCount: summary.connectedCount,
      maxLimit: summary.maxConcurrentLimit,
      activeSessions: summary.activeSessions,
    };
  }

  // Create active session
  const sessionToken = crypto.randomBytes(24).toString('hex');
  const { rows: inserted } = await query(
    `
    INSERT INTO active_device_sessions (
      tenant_id, branch_id, user_id, user_name, device_fingerprint,
      device_name, device_type, ip_address, os_info, app_version,
      status, session_token, last_heartbeat_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'ONLINE', $11, CURRENT_TIMESTAMP)
    RETURNING id
    `,
    [
      tenantId,
      branchId,
      userId || null,
      userName || null,
      deviceFingerprint,
      deviceName || 'Terminal',
      deviceType || 'DESKTOP',
      ipAddress || null,
      osInfo || null,
      appVersion || '1.0.0',
      sessionToken,
    ],
    { tenantId }
  );

  // Also sync with registered_devices table for historical hardware inventory
  await query(
    `
    INSERT INTO registered_devices (
      tenant_id, branch_id, device_fingerprint, device_name, device_type, ip_address, is_active, last_active_at, last_user_name
    ) VALUES ($1, $2, $3, $4, $5, $6, true, CURRENT_TIMESTAMP, $7)
    ON CONFLICT (tenant_id, device_fingerprint) DO UPDATE SET
      last_active_at = CURRENT_TIMESTAMP,
      device_name = COALESCE(EXCLUDED.device_name, registered_devices.device_name),
      ip_address = EXCLUDED.ip_address,
      last_user_name = COALESCE(EXCLUDED.last_user_name, registered_devices.last_user_name),
      is_active = true
    `,
    [tenantId, branchId, deviceFingerprint, deviceName, deviceType, ipAddress || null, userName || null],
    { tenantId }
  );

  return {
    allowed: true,
    sessionId: inserted[0].id,
    connectedCount: summary.connectedCount + 1,
    maxLimit: summary.maxConcurrentLimit,
  };
}

/**
 * Revoke an active device session
 */
export async function revokeDeviceSession(
  sessionId: string,
  tenantId: string,
  revokedById?: string
): Promise<boolean> {
  const { rows } = await query(
    `
    UPDATE active_device_sessions
    SET status = 'REVOKED'
    WHERE id = $1 AND tenant_id = $2
    RETURNING *
    `,
    [sessionId, tenantId],
    { tenantId }
  );

  if (rows.length > 0) {
    await logAuditEvent({
      tenantId,
      actorId: revokedById || 'SYSTEM',
      actorRole: 'SUPER_ADMIN',
      action: 'DEVICE_SESSION_REVOKED',
      resourceType: 'DEVICE',
      resourceId: sessionId,
      metadata: { sessionId, deviceFingerprint: rows[0].device_fingerprint, deviceName: rows[0].device_name },
    });
    return true;
  }
  return false;
}
