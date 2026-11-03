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

export async function logAuditEvent(entry: AuditLogEntry): Promise<void> {
  try {
    await query(
      `
      INSERT INTO audit_logs (tenant_id, branch_id, actor_id, actor_role, action, resource_type, resource_id, metadata, ip_address)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      `,
      [
        entry.tenantId || null,
        entry.branchId || null,
        entry.actorId,
        entry.actorRole,
        entry.action,
        entry.resourceType,
        entry.resourceId || null,
        JSON.stringify(entry.metadata || {}),
        entry.ipAddress || null,
      ],
      { isSuperAdmin: true }
    );
  } catch (err) {
    console.error('Failed to write audit log:', err);
  }
}
