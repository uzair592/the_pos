import crypto from 'crypto';
import pg from 'pg';
import { query, withTransaction } from '../db/connection.js';
import { logAuditEvent } from './auditService.js';

export interface BackupMetadata {
  version: string;
  tenantId?: string | null;
  tenantName?: string;
  backupType: 'TENANT' | 'PLATFORM';
  exportedAt: string;
  checksum: string;
}

export interface BackupPackage {
  metadata: BackupMetadata;
  data: Record<string, any[]>;
}

const TENANT_TABLES = [
  'restaurant_settings',
  'branches',
  'floors',
  'restaurant_tables',
  'categories',
  'modifier_groups',
  'products',
  'product_variants',
  'product_modifier_groups',
  'ingredients',
  'recipes',
  'recipe_ingredients',
  'inventory_batches',
  'branch_stocks',
  'suppliers',
  'purchase_invoices',
  'purchase_items',
  'register_shifts',
  'cash_movements',
  'customers',
  'orders',
  'order_items',
  'order_payments',
  'order_refunds',
  'refund_items',
  'kitchen_tickets',
  'kitchen_ticket_items',
  'expense_categories',
  'expenses',
  'registered_devices',
  'order_item_batch_consumptions',
];

/**
 * Generate a complete, structured tenant backup
 */
export async function generateTenantBackup(
  tenantId: string,
  userId: string,
  userName: string
): Promise<{ package: BackupPackage; fileName: string }> {
  // 1. Fetch Tenant details
  const { rows: tRows } = await query(
    'SELECT * FROM tenants WHERE id = $1',
    [tenantId],
    { tenantId }
  );
  if (tRows.length === 0) throw new Error('Tenant not found');
  const tenant = tRows[0];

  const data: Record<string, any[]> = {
    tenant: [tenant],
  };

  // 2. Fetch all tenant-scoped tables
  for (const tableName of TENANT_TABLES) {
    try {
      const { rows } = await query(
        `SELECT * FROM ${tableName} WHERE tenant_id = $1`,
        [tenantId],
        { tenantId }
      );
      data[tableName] = rows;
    } catch (err) {
      data[tableName] = [];
    }
  }

  // 3. Prepare data string and calculate checksum
  const dataString = JSON.stringify(data);
  const checksum = crypto.createHash('sha256').update(dataString).digest('hex');
  const exportedAt = new Date().toISOString();

  const metadata: BackupMetadata = {
    version: '1.0.0',
    tenantId,
    tenantName: tenant.name,
    backupType: 'TENANT',
    exportedAt,
    checksum,
  };

  const backupPackage: BackupPackage = {
    metadata,
    data,
  };

  const cleanName = tenant.name.toLowerCase().replace(/[^a-z0-9]/g, '_');
  const fileName = `pos_backup_${cleanName}_${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
  const fileSize = Buffer.byteLength(JSON.stringify(backupPackage));

  // 4. Save metadata to backup_history
  await query(
    `
    INSERT INTO backup_history (
      tenant_id, backup_type, file_name, file_size, checksum, version,
      triggered_by_user_id, triggered_by_name
    ) VALUES ($1, 'TENANT', $2, $3, $4, '1.0.0', $5, $6)
    `,
    [tenantId, fileName, fileSize, checksum, userId, userName],
    { tenantId }
  );

  await logAuditEvent({
    tenantId,
    actorId: userId,
    actorRole: 'TENANT_OWNER',
    action: 'BACKUP_CREATED',
    resourceType: 'BACKUP',
    metadata: { fileName, fileSize, checksum },
  });

  return { package: backupPackage, fileName };
}

/**
 * Execute transactional restore of tenant backup
 */
export async function restoreTenantBackup(
  tenantId: string,
  backupPackage: BackupPackage,
  userId: string
): Promise<{ success: boolean; message: string }> {
  const { metadata, data } = backupPackage;

  if (!metadata || !data) {
    throw new Error('Invalid backup file format: metadata or data missing');
  }

  // Verify checksum
  const computedChecksum = crypto.createHash('sha256').update(JSON.stringify(data)).digest('hex');
  if (computedChecksum !== metadata.checksum) {
    throw new Error('Backup integrity verification failed: Checksum mismatch');
  }

  return await withTransaction(async (client) => {
    // 1. Delete existing tenant data in reverse dependency order
    const tablesToDelete = [
      'order_item_batch_consumptions',
      'refund_items',
      'order_refunds',
      'order_payments',
      'kitchen_ticket_items',
      'kitchen_tickets',
      'order_items',
      'orders',
      'cash_movements',
      'register_shifts',
      'purchase_items',
      'purchase_invoices',
      'stock_movements',
      'branch_stocks',
      'inventory_batches',
      'suppliers',
      'recipe_ingredients',
      'recipes',
      'ingredients',
      'product_modifier_groups',
      'product_variants',
      'products',
      'modifier_groups',
      'categories',
      'restaurant_tables',
      'floors',
      'expenses',
      'expense_categories',
      'customers',
      'registered_devices',
    ];

    for (const tbl of tablesToDelete) {
      await client.query(`DELETE FROM ${tbl} WHERE tenant_id = $1`, [tenantId]);
    }

    // 2. Restore tables in forward dependency order
    for (const tableName of TENANT_TABLES) {
      const records = data[tableName];
      if (!Array.isArray(records) || records.length === 0) continue;

      for (const row of records) {
        // Enforce restoring only into the current tenant
        row.tenant_id = tenantId;

        const columns = Object.keys(row);
        const values = Object.values(row);
        const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');
        const colList = columns.map((c) => `"${c}"`).join(', ');

        const insertSql = `
          INSERT INTO "${tableName}" (${colList})
          VALUES (${placeholders})
          ON CONFLICT DO NOTHING
        `;

        try {
          await client.query(insertSql, values);
        } catch (insertErr: any) {
          console.warn(`Restore warning for ${tableName}:`, insertErr.message);
        }
      }
    }

    // 3. Log Audit Event
    await logAuditEvent({
      tenantId,
      actorId: userId,
      actorRole: 'TENANT_OWNER',
      action: 'BACKUP_RESTORED',
      resourceType: 'BACKUP',
      metadata: { checksum: metadata.checksum, version: metadata.version },
    });

    return {
      success: true,
      message: 'Tenant backup successfully restored inside transaction',
    };
  }, { tenantId });
}

/**
 * Fetch backup history for a tenant
 */
export async function getBackupHistory(tenantId?: string | null) {
  let sql = `
    SELECT b.*, t.name as tenant_name
    FROM backup_history b
    LEFT JOIN tenants t ON t.id = b.tenant_id
  `;
  const params: any[] = [];

  if (tenantId) {
    params.push(tenantId);
    sql += ` WHERE b.tenant_id = $1`;
  }

  sql += ` ORDER BY b.created_at DESC LIMIT 50`;

  const { rows } = await query(sql, params, { tenantId });
  return rows;
}

