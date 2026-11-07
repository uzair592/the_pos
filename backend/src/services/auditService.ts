import { query } from '../db/connection.js';

export interface AuditLogEntry {
  tenantId?: string | null;
  branchId?: string | null;
  actorId: string;
  actorRole: string;
  action: string;
  resourceType: string;
  resourceId?: string | null;
  metadata?: Record<string, any>;
  ipAddress?: string;
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function logAuditEvent(entry: AuditLogEntry): Promise<void> {
  try {
    const safeActorId = (entry.actorId && UUID_REGEX.test(entry.actorId))
      ? entry.actorId
      : '00000000-0000-0000-0000-000000000000';
    const safeResourceId = (entry.resourceId && UUID_REGEX.test(entry.resourceId))
      ? entry.resourceId
      : null;

    await query(
      `
      INSERT INTO audit_logs (tenant_id, branch_id, actor_id, actor_role, action, resource_type, resource_id, metadata, ip_address)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      `,
      [
        entry.tenantId || null,
        entry.branchId || null,
        safeActorId,
        entry.actorRole,
        entry.action,
        entry.resourceType,
        safeResourceId,
        JSON.stringify(entry.metadata || {}),
        entry.ipAddress ? entry.ipAddress.slice(0, 255) : null,
      ],
      { isSuperAdmin: true }
    );
  } catch (err) {
    console.error('Failed to write audit log:', err);
  }
}
