import pg from 'pg';
import { query } from '../db/connection.js';

export interface EmitSyncEventParams {
  tenantId: string;
  branchId?: string | null;
  eventType: string;
  entityId: string;
  payload?: any;
}

/**
 * Emit a synchronization event for all connected devices
 */
export async function emitSyncEvent(
  db: pg.PoolClient | typeof query,
  params: EmitSyncEventParams
) {
  const { tenantId, branchId = null, eventType, entityId, payload = {} } = params;

  const sql = `
    INSERT INTO sync_events (tenant_id, branch_id, event_type, entity_id, payload)
    VALUES ($1, $2, $3, $4, $5)
    RETURNING id, created_at;
  `;
  const values = [tenantId, branchId, eventType, entityId, JSON.stringify(payload)];

  if (typeof db === 'function') {
    return await db(sql, values, { tenantId });
  } else {
    return await db.query(sql, values);
  }
}

/**
 * Fetch synchronization events for devices
 */
export async function getSyncEvents(
  tenantId: string,
  branchId?: string | null,
  since?: string | null,
  limit: number = 50
) {
  let sql = `
    SELECT id, tenant_id, branch_id, event_type, entity_id, payload, created_at
    FROM sync_events
    WHERE tenant_id = $1
  `;
  const params: any[] = [tenantId];

  if (branchId) {
    params.push(branchId);
    sql += ` AND (branch_id IS NULL OR branch_id = $${params.length})`;
  }

  if (since) {
    params.push(since);
    sql += ` AND created_at > $${params.length}::timestamptz`;
  }

  params.push(limit);
  sql += ` ORDER BY created_at DESC LIMIT $${params.length}`;

  const { rows } = await query(sql, params, { tenantId });
  return rows;
}

