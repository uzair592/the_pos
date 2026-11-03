import { query, withTransaction } from '../db/connection.js';
import { SubscriptionStatus } from '@pos/shared';

export interface PlanLimitCheckResult {
  allowed: boolean;
  currentCount: number;
  maxLimit: number; // -1 for unlimited
  message?: string;
}

export async function getTenantSubscriptionDetails(tenantId: string) {
  const { rows } = await query(
    `
    SELECT ts.*, sp.name as plan_name, sp.code as plan_code, sp.entitlements, sp.monthly_price, sp.annual_price
    FROM tenant_subscriptions ts
    JOIN subscription_plans sp ON sp.id = ts.plan_id
    WHERE ts.tenant_id = $1
    ORDER BY ts.created_at DESC
    LIMIT 1
    `,
    [tenantId],
    { isSuperAdmin: true }
  );

  if (rows.length === 0) return null;
  return rows[0];
}

/**
 * Check if the tenant is allowed to create another branch
 */
export async function checkBranchLimit(tenantId: string): Promise<PlanLimitCheckResult> {
  const sub = await getTenantSubscriptionDetails(tenantId);
  const maxBranches = sub?.entitlements?.maxBranches ?? 1;

  if (maxBranches === -1) {
    return { allowed: true, currentCount: 0, maxLimit: -1 };
  }

  const { rows } = await query(
    'SELECT COUNT(*)::int as count FROM branches WHERE tenant_id = $1',
    [tenantId],
    { tenantId }
  );

  const currentCount = rows[0]?.count || 0;
  if (currentCount >= maxBranches) {
    return {
      allowed: false,
      currentCount,
      maxLimit: maxBranches,
      message: `Branch limit reached (${currentCount}/${maxBranches}). Upgrade your plan to add more branches.`,
    };
  }

  return { allowed: true, currentCount, maxLimit: maxBranches };
}

/**
 * Check if the tenant is allowed to add another staff member
 */
export async function checkStaffLimit(tenantId: string): Promise<PlanLimitCheckResult> {
  const sub = await getTenantSubscriptionDetails(tenantId);
  const maxStaff = sub?.entitlements?.maxStaff ?? 5;

  if (maxStaff === -1) {
    return { allowed: true, currentCount: 0, maxLimit: -1 };
  }

  const { rows } = await query(
    'SELECT COUNT(*)::int as count FROM users WHERE tenant_id = $1',
    [tenantId],
    { tenantId }
  );

  const currentCount = rows[0]?.count || 0;
  if (currentCount >= maxStaff) {
    return {
      allowed: false,
      currentCount,
      maxLimit: maxStaff,
      message: `Staff account limit reached (${currentCount}/${maxStaff}). Upgrade your plan to add more employees.`,
    };
  }

  return { allowed: true, currentCount, maxLimit: maxStaff };
}

/**
 * Check device limits and register/refresh a device
 */
export async function registerOrVerifyDevice(
  tenantId: string,
  branchId: string,
  deviceFingerprint: string,
  deviceName: string,
  deviceType: 'DESKTOP' | 'TABLET' | 'MOBILE' | 'POS_TERMINAL',
  ipAddress?: string
) {
  const sub = await getTenantSubscriptionDetails(tenantId);
  const maxDevices = sub?.entitlements?.maxDevices ?? 2;

  // Check if device already registered
  const { rows: existing } = await query(
    'SELECT id, is_active FROM registered_devices WHERE tenant_id = $1 AND device_fingerprint = $2',
    [tenantId, deviceFingerprint],
    { tenantId }
  );

  if (existing.length > 0) {
    // Refresh active status
    await query(
      'UPDATE registered_devices SET last_active_at = CURRENT_TIMESTAMP, is_active = true WHERE id = $1',
      [existing[0].id],
      { tenantId }
    );
    return { success: true, deviceId: existing[0].id };
  }

  // If new device, verify limit
  if (maxDevices !== -1) {
    const { rows: countRows } = await query(
      'SELECT COUNT(*)::int as count FROM registered_devices WHERE tenant_id = $1 AND is_active = true',
      [tenantId],
      { tenantId }
    );

    const activeCount = countRows[0]?.count || 0;
    if (activeCount >= maxDevices) {
      return {
        success: false,
        error: `Registered device limit reached (${activeCount}/${maxDevices}). Please deactivate an unused terminal or upgrade your plan.`,
      };
    }
  }

  const { rows: inserted } = await query(
    `
    INSERT INTO registered_devices (tenant_id, branch_id, device_fingerprint, device_name, device_type, ip_address, is_active)
    VALUES ($1, $2, $3, $4, $5, $6, true)
    RETURNING id
    `,
    [tenantId, branchId, deviceFingerprint, deviceName, deviceType, ipAddress || null],
    { tenantId }
  );

  return { success: true, deviceId: inserted[0].id };
}
