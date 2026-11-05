import crypto from 'crypto';
import * as XLSX from 'xlsx';
import { query, withTransaction } from '../db/connection.js';
import { logAuditEvent } from './auditService.js';

export interface BackupMetadata {
  version: string;
  tenantId?: string | null;
  tenantName?: string;
  backupType: 'TENANT' | 'PLATFORM';
  exportedAt: string;
  checksum: string;
  recordCounts?: Record<string, number>;
}

export interface BackupPackage {
  metadata: BackupMetadata;
  data: Record<string, any[]>;
}

export const TENANT_TABLES = [
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
  'stock_transfers',
  'bank_accounts',
  'cash_bank_transfers',
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
  'ingredient_cost_history',
  'registered_devices',
  'order_item_batch_consumptions',
];

/**
 * Generate a complete, full-fidelity structured tenant backup (JSON)
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

  const recordCounts: Record<string, number> = {
    tenant: 1,
  };

  // 2. Fetch all tenant-scoped tables
  for (const tableName of TENANT_TABLES) {
    try {
      const { rows } = await query(
        `SELECT * FROM "${tableName}" WHERE tenant_id = $1`,
        [tenantId],
        { tenantId }
      );
      data[tableName] = rows;
      recordCounts[tableName] = rows.length;
    } catch (err) {
      data[tableName] = [];
      recordCounts[tableName] = 0;
    }
  }

  // Also include users (sanitizing password_hash)
  try {
    const { rows: users } = await query(
      `SELECT id, tenant_id, branch_id, email, full_name, role, is_active, created_at FROM users WHERE tenant_id = $1`,
      [tenantId],
      { tenantId }
    );
    data['users'] = users;
    recordCounts['users'] = users.length;
  } catch (_) {
    data['users'] = [];
  }

  // 3. Prepare data string and calculate checksum
  const dataString = JSON.stringify(data);
  const checksum = crypto.createHash('sha256').update(dataString).digest('hex');
  const exportedAt = new Date().toISOString();

  const metadata: BackupMetadata = {
    version: '1.2.0',
    tenantId,
    tenantName: tenant.name,
    backupType: 'TENANT',
    exportedAt,
    checksum,
    recordCounts,
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
    ) VALUES ($1, 'TENANT', $2, $3, $4, '1.2.0', $5, $6)
    `,
    [tenantId, fileName, fileSize, checksum, userId, userName],
    { tenantId }
  );

  await logAuditEvent({
    tenantId,
    actorId: userId,
    actorRole: 'SUPER_ADMIN',
    action: 'BACKUP_CREATED',
    resourceType: 'BACKUP',
    metadata: { fileName, fileSize, checksum, recordCounts },
  });

  return { package: backupPackage, fileName };
}

/**
 * Generate human-readable multi-sheet Excel workbook backup (.xlsx)
 */
export async function generateTenantExcelBackup(
  tenantId: string,
  userId: string,
  userName: string
): Promise<{ buffer: Buffer; fileName: string }> {
  const { package: backupPkg } = await generateTenantBackup(tenantId, userId, userName);
  const { metadata, data } = backupPkg;

  const wb = XLSX.utils.book_new();

  // 1. Overview Worksheet
  const overviewRows = [
    { Parameter: 'Restaurant Name', Value: metadata.tenantName || 'N/A' },
    { Parameter: 'Restaurant ID', Value: metadata.tenantId || 'N/A' },
    { Parameter: 'Export Date', Value: metadata.exportedAt },
    { Parameter: 'Backup Version', Value: metadata.version },
    { Parameter: 'Checksum SHA-256', Value: metadata.checksum },
    { Parameter: 'Exported By', Value: userName },
    { Parameter: '--- Table Name ---', Value: '--- Record Count ---' },
    ...Object.entries(metadata.recordCounts || {}).map(([tbl, count]) => ({
      Parameter: tbl,
      Value: count,
    })),
  ];
  const overviewSheet = XLSX.utils.json_to_sheet(overviewRows);
  XLSX.utils.book_append_sheet(wb, overviewSheet, 'Summary Overview');

  // Sheet mapping for clean human-readable Excel tab names
  const SHEET_MAPPING: Record<string, string> = {
    tenant: 'Restaurant Profile',
    branches: 'Branches',
    users: 'Staff & Users',
    restaurant_settings: 'Settings',
    categories: 'Menu Categories',
    products: 'Menu Products',
    product_variants: 'Product Variants',
    modifier_groups: 'Modifiers',
    ingredients: 'Ingredients & UOM',
    recipes: 'Recipes',
    recipe_ingredients: 'Recipe Consumption',
    inventory_batches: 'FIFO Batches',
    branch_stocks: 'Branch Stock Levels',
    suppliers: 'Suppliers',
    purchase_invoices: 'Purchase Invoices',
    purchase_items: 'Purchase Items',
    orders: 'Orders Ledger',
    order_items: 'Order Items',
    order_payments: 'Order Payments',
    bank_accounts: 'Bank Accounts',
    cash_bank_transactions: 'Cash Bank Ledger',
    expenses: 'Expenses Ledger',
    customers: 'Customers',
    registered_devices: 'Devices & Terminals',
  };

  for (const [tableKey, sheetLabel] of Object.entries(SHEET_MAPPING)) {
    const records = data[tableKey];
    if (Array.isArray(records) && records.length > 0) {
      // Flatten any json objects for clean tabular reading
      const sanitizedRows = records.map((row) => {
        const flat: Record<string, any> = {};
        for (const [k, v] of Object.entries(row)) {
          if (v && typeof v === 'object' && !(v instanceof Date)) {
            flat[k] = JSON.stringify(v);
          } else {
            flat[k] = v;
          }
        }
        return flat;
      });
      const ws = XLSX.utils.json_to_sheet(sanitizedRows);
      XLSX.utils.book_append_sheet(wb, ws, sheetLabel.slice(0, 31));
    }
  }

  const cleanName = (metadata.tenantName || 'restaurant').toLowerCase().replace(/[^a-z0-9]/g, '_');
  const fileName = `pos_export_${cleanName}_${new Date().toISOString().replace(/[:.]/g, '-')}.xlsx`;
  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

  return { buffer, fileName };
}

/**
 * Pre-validation of a backup package before restore execution
 */
export function validateBackupPackage(
  backupPackage: any,
  targetTenantId: string
): {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  metadata: BackupMetadata | null;
  summary: Record<string, number>;
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!backupPackage || typeof backupPackage !== 'object') {
    return {
      isValid: false,
      errors: ['Invalid backup payload: file does not contain a JSON object'],
      warnings: [],
      metadata: null,
      summary: {},
    };
  }

  const { metadata, data } = backupPackage;
  if (!metadata || !data) {
    errors.push('Invalid backup structure: "metadata" or "data" object missing');
    return { isValid: false, errors, warnings, metadata: null, summary: {} };
  }

  // 1. Verify Checksum
  try {
    const computed = crypto.createHash('sha256').update(JSON.stringify(data)).digest('hex');
    if (computed !== metadata.checksum) {
      errors.push('Backup integrity check failed: Checksum does not match. File may be corrupted or modified.');
    }
  } catch (err: any) {
    errors.push(`Failed to verify checksum: ${err.message}`);
  }

  // 2. Tenant Identity Check
  if (metadata.tenantId && metadata.tenantId !== targetTenantId) {
    warnings.push(
      `Backup originated from restaurant ID (${metadata.tenantId} - ${metadata.tenantName || 'Unknown'}). It will be mapped safely to target restaurant (${targetTenantId}).`
    );
  }

  // 3. Schema Compatibility
  if (!metadata.version) {
    warnings.push('Backup metadata does not specify version. Assuming legacy 1.0.0.');
  }

  const summary: Record<string, number> = {};
  for (const tbl of TENANT_TABLES) {
    if (Array.isArray(data[tbl])) {
      summary[tbl] = data[tbl].length;
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    metadata,
    summary,
  };
}

/**
 * Execute transactional restore of tenant backup with safeguards, validation, and safety snapshot
 */
export async function restoreTenantBackup(
  tenantId: string,
  backupPackage: BackupPackage,
  userId: string,
  userName: string = 'Staff',
  options: {
    mode?: 'FULL' | 'SELECTIVE' | 'MERGE';
    selectedModules?: string[];
  } = {}
): Promise<{ success: boolean; message: string; recordsRestored: number }> {
  const mode = options.mode || 'FULL';
  const validation = validateBackupPackage(backupPackage, tenantId);

  if (!validation.isValid) {
    throw new Error(`Restoration rejected: ${validation.errors.join('; ')}`);
  }

  const { metadata, data } = backupPackage;

  // 1. Create automatic safety backup of existing state before any deletion or overwrite
  let safetyBackupFileName = '';
  try {
    const safety = await generateTenantBackup(tenantId, userId, `System Safety Backup (${userName})`);
    safetyBackupFileName = safety.fileName;
  } catch (safetyErr) {
    console.warn('Could not generate pre-restore safety backup:', safetyErr);
  }

  let totalRestored = 0;

  try {
    await withTransaction(async (client) => {
      // 2. If FULL restore, delete existing tenant data in reverse dependency order
      if (mode === 'FULL') {
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
          'stock_transfers',
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
          'cash_bank_transfers',
          'bank_accounts',
          'expenses',
          'expense_categories',
          'customers',
          'registered_devices',
          'active_device_sessions',
          'ingredient_cost_history',
        ];

        for (const tbl of tablesToDelete) {
          await client.query('SAVEPOINT clean_sp');
          try {
            await client.query(`DELETE FROM "${tbl}" WHERE tenant_id = $1`, [tenantId]);
            await client.query('RELEASE SAVEPOINT clean_sp');
          } catch (err: any) {
            await client.query('ROLLBACK TO SAVEPOINT clean_sp');
          }
        }
      }

      // Determine tables to insert
      const tablesToProcess =
        mode === 'SELECTIVE' && options.selectedModules?.length
          ? options.selectedModules
          : TENANT_TABLES;

      for (const tableName of tablesToProcess) {
        const records = data[tableName];
        if (!Array.isArray(records) || records.length === 0) continue;

        for (const row of records) {
          // Strict Tenant Identity Enforcement: Enforce target tenant ID
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

          await client.query('SAVEPOINT row_sp');
          try {
            await client.query(insertSql, values);
            await client.query('RELEASE SAVEPOINT row_sp');
            totalRestored++;
          } catch (insertErr: any) {
            await client.query('ROLLBACK TO SAVEPOINT row_sp');
            console.warn(`Restore record warning on ${tableName}:`, insertErr.message);
          }
        }
      }

      return { success: true };
    }, { tenantId });

    // 3. Log into restoration_history table
    await query(
      `
      INSERT INTO restoration_history (
        tenant_id, backup_file_name, restored_by_id, restored_by_name,
        mode, records_restored, status, details
      ) VALUES ($1, $2, $3, $4, $5, $6, 'SUCCESS', $7)
      `,
      [
        tenantId,
        metadata.backupType + ' (' + (metadata.exportedAt || 'backup') + ')',
        userId,
        userName,
        mode,
        totalRestored,
        JSON.stringify({
          checksum: metadata.checksum,
          safetyBackup: safetyBackupFileName,
          version: metadata.version,
        }),
      ],
      { tenantId }
    );

    await logAuditEvent({
      tenantId,
      actorId: userId,
      actorRole: 'SUPER_ADMIN',
      action: 'DATA_RESTORED',
      resourceType: 'BACKUP',
      metadata: {
        mode,
        recordsRestored: totalRestored,
        safetyBackup: safetyBackupFileName,
        checksum: metadata.checksum,
      },
    });

    return {
      success: true,
      message: `Restoration completed successfully. ${totalRestored} records restored.`,
      recordsRestored: totalRestored,
    };
  } catch (err: any) {
    // Log failed restoration
    try {
      await query(
        `
        INSERT INTO restoration_history (
          tenant_id, backup_file_name, restored_by_id, restored_by_name,
          mode, records_restored, status, error_message, details
        ) VALUES ($1, $2, $3, $4, $5, 0, 'FAILED', $6, $7)
        `,
        [
          tenantId,
          metadata.exportedAt || 'backup',
          userId,
          userName,
          mode,
          err.message,
          JSON.stringify({ safetyBackup: safetyBackupFileName }),
        ],
        { tenantId }
      );
    } catch (_) {}

    throw new Error(`Restoration failed and rolled back cleanly: ${err.message}`);
  }
}

/**
 * Fetch backup history for a tenant or platform
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

  sql += ` ORDER BY b.created_at DESC LIMIT 100`;

  const { rows } = await query(sql, params, { tenantId });
  return rows;
}

/**
 * Fetch restoration history for a tenant or platform
 */
export async function getRestorationHistory(tenantId?: string | null) {
  let sql = `
    SELECT rh.*, t.name as tenant_name
    FROM restoration_history rh
    LEFT JOIN tenants t ON t.id = rh.tenant_id
  `;
  const params: any[] = [];

  if (tenantId) {
    params.push(tenantId);
    sql += ` WHERE rh.tenant_id = $1`;
  }

  sql += ` ORDER BY rh.created_at DESC LIMIT 100`;

  const { rows } = await query(sql, params, { tenantId });
  return rows;
}
