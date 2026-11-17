import crypto from 'crypto';
import * as XLSX from 'xlsx';
import AdmZip from 'adm-zip';
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
  'stock_movements',
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
  'reservations',
  'waitlist',
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
          'waitlist',
          'reservations',
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
 * Generate standard, versioned ZIP backup package containing individual JSON files and manifest.json
 */
export async function generateTenantZipBackup(
  tenantId: string,
  userId: string,
  userName: string,
  backupType: 'FULL' | 'SAFETY_PRE_RESTORE' = 'FULL'
): Promise<{ buffer: Buffer; fileName: string; checksum: string; recordCounts: Record<string, number> }> {
  // 1. Fetch Tenant details
  const { rows: tRows } = await query('SELECT * FROM tenants WHERE id = $1', [tenantId], { tenantId });
  if (tRows.length === 0) throw new Error('Tenant not found');
  const tenant = tRows[0];

  const zip = new AdmZip();
  const recordCounts: Record<string, number> = {};

  // Fetch individual table datasets
  const fetchTable = async (sql: string, params: any[] = [tenantId]): Promise<any[]> => {
    try {
      const { rows } = await query(sql, params, { tenantId });
      return rows;
    } catch (e) {
      return [];
    }
  };

  // 1. restaurant.json
  const settings = await fetchTable('SELECT * FROM restaurant_settings WHERE tenant_id = $1');
  const restaurantData = {
    tenant: { id: tenant.id, name: tenant.name, created_at: tenant.created_at },
    settings: settings[0] || null,
  };
  zip.addFile('restaurant.json', Buffer.from(JSON.stringify(restaurantData, null, 2), 'utf-8'));
  recordCounts['restaurant'] = 1;

  // 2. branches.json
  const branches = await fetchTable('SELECT * FROM branches WHERE tenant_id = $1');
  zip.addFile('branches.json', Buffer.from(JSON.stringify(branches, null, 2), 'utf-8'));
  recordCounts['branches'] = branches.length;

  // 3. categories.json
  const categories = await fetchTable('SELECT * FROM categories WHERE tenant_id = $1 ORDER BY sort_order ASC, name ASC');
  zip.addFile('categories.json', Buffer.from(JSON.stringify(categories, null, 2), 'utf-8'));
  recordCounts['categories'] = categories.length;

  // 4. menu_items.json
  const products = await fetchTable('SELECT * FROM products WHERE tenant_id = $1');
  const productVariants = await fetchTable('SELECT * FROM product_variants WHERE tenant_id = $1');
  const menuData = { products, variants: productVariants };
  zip.addFile('menu_items.json', Buffer.from(JSON.stringify(menuData, null, 2), 'utf-8'));
  recordCounts['menu_items'] = products.length;

  // 5. inventory_items.json
  const ingredients = await fetchTable('SELECT * FROM ingredients WHERE tenant_id = $1');
  const branchStocks = await fetchTable('SELECT * FROM branch_stocks WHERE tenant_id = $1');
  const inventoryBatches = await fetchTable('SELECT * FROM inventory_batches WHERE tenant_id = $1');
  const inventoryData = { ingredients, branch_stocks: branchStocks, inventory_batches: inventoryBatches };
  zip.addFile('inventory_items.json', Buffer.from(JSON.stringify(inventoryData, null, 2), 'utf-8'));
  recordCounts['inventory_items'] = ingredients.length;

  // 6. suppliers.json
  const suppliers = await fetchTable('SELECT * FROM suppliers WHERE tenant_id = $1');
  zip.addFile('suppliers.json', Buffer.from(JSON.stringify(suppliers, null, 2), 'utf-8'));
  recordCounts['suppliers'] = suppliers.length;

  // 7. purchases.json & 8. purchase_items.json
  const purchases = await fetchTable('SELECT * FROM purchase_invoices WHERE tenant_id = $1');
  const purchaseItems = await fetchTable('SELECT * FROM purchase_items WHERE tenant_id = $1');
  zip.addFile('purchases.json', Buffer.from(JSON.stringify(purchases, null, 2), 'utf-8'));
  zip.addFile('purchase_items.json', Buffer.from(JSON.stringify(purchaseItems, null, 2), 'utf-8'));
  recordCounts['purchases'] = purchases.length;
  recordCounts['purchase_items'] = purchaseItems.length;

  // 9. recipes.json & 10. recipe_ingredients.json
  const recipes = await fetchTable('SELECT * FROM recipes WHERE tenant_id = $1');
  const recipeIngredients = await fetchTable('SELECT * FROM recipe_ingredients WHERE tenant_id = $1');
  zip.addFile('recipes.json', Buffer.from(JSON.stringify(recipes, null, 2), 'utf-8'));
  zip.addFile('recipe_ingredients.json', Buffer.from(JSON.stringify(recipeIngredients, null, 2), 'utf-8'));
  recordCounts['recipes'] = recipes.length;
  recordCounts['recipe_ingredients'] = recipeIngredients.length;

  // 11. stock_movements.json & 12. wastage_records.json
  const stockMovements = await fetchTable('SELECT * FROM stock_movements WHERE tenant_id = $1 ORDER BY created_at DESC');
  const wastageRecords = stockMovements.filter((m: any) => m.movement_type === 'WASTAGE');
  zip.addFile('stock_movements.json', Buffer.from(JSON.stringify(stockMovements, null, 2), 'utf-8'));
  zip.addFile('wastage_records.json', Buffer.from(JSON.stringify(wastageRecords, null, 2), 'utf-8'));
  recordCounts['stock_movements'] = stockMovements.length;
  recordCounts['wastage_records'] = wastageRecords.length;

  // 13. customers.json
  const customers = await fetchTable('SELECT * FROM customers WHERE tenant_id = $1');
  zip.addFile('customers.json', Buffer.from(JSON.stringify(customers, null, 2), 'utf-8'));
  recordCounts['customers'] = customers.length;

  // 14. orders.json & 15. order_items.json
  const orders = await fetchTable('SELECT * FROM orders WHERE tenant_id = $1');
  const orderItems = await fetchTable('SELECT * FROM order_items WHERE tenant_id = $1');
  zip.addFile('orders.json', Buffer.from(JSON.stringify(orders, null, 2), 'utf-8'));
  zip.addFile('order_items.json', Buffer.from(JSON.stringify(orderItems, null, 2), 'utf-8'));
  recordCounts['orders'] = orders.length;
  recordCounts['order_items'] = orderItems.length;

  // 16. expenses.json
  const expenses = await fetchTable('SELECT * FROM expenses WHERE tenant_id = $1');
  const expenseCategories = await fetchTable('SELECT * FROM expense_categories WHERE tenant_id = $1');
  zip.addFile('expenses.json', Buffer.from(JSON.stringify({ expenses, categories: expenseCategories }, null, 2), 'utf-8'));
  recordCounts['expenses'] = expenses.length;

  // 17. payments.json
  const payments = await fetchTable('SELECT * FROM order_payments WHERE tenant_id = $1');
  zip.addFile('payments.json', Buffer.from(JSON.stringify(payments, null, 2), 'utf-8'));
  recordCounts['payments'] = payments.length;

  // 18. bank_accounts.json
  const bankAccounts = await fetchTable('SELECT * FROM bank_accounts WHERE tenant_id = $1');
  zip.addFile('bank_accounts.json', Buffer.from(JSON.stringify(bankAccounts, null, 2), 'utf-8'));
  recordCounts['bank_accounts'] = bankAccounts.length;

  // 19. README.txt
  const readmeText = `======================================================================
RESTAURANT POS SAAS - SYSTEM BACKUP PACKAGE
======================================================================
Restaurant:    ${tenant.name}
Tenant ID:     ${tenant.id}
Generated:     ${new Date().toISOString()}
Exported By:   ${userName} (${userId})
Backup Type:   ${backupType}
Format:        restaurant-pos-backup (v1.0)
======================================================================

PACKAGE CONTENTS:
- manifest.json: Metadata, version info, file checksums, and record tallies.
- restaurant.json: Restaurant identity, currency, tax rates, and settings.
- branches.json: Physical branch locations and active status.
- categories.json: Menu hierarchy and display ordering.
- menu_items.json: Complete menu catalog, descriptions, and variants.
- inventory_items.json: Ingredients, unit of measure, stock levels, and FIFO batches.
- suppliers.json: Approved vendor and supplier directory.
- purchases.json: Historical purchase invoices and billing details.
- purchase_items.json: Itemized invoice lines with quantities and rates.
- recipes.json & recipe_ingredients.json: Bill of Materials & ingredient mapping.
- stock_movements.json: Audit trail of stock additions, deductions, and adjustments.
- wastage_records.json: Recorded kitchen and storage wastage incidents.
- customers.json: Customer directory, contact details, and loyalty balances.
- orders.json & order_items.json: Complete sales and billing ledger.
- expenses.json: Restaurant operational expense logs and categories.
- payments.json: Payment transactions and tenders.
- bank_accounts.json: Configured settlement bank accounts.

RESTORATION INSTRUCTIONS:
1. Open Restaurant POS SaaS -> Settings -> Backup & Restore.
2. Under "Restore Backup", select this .zip file.
3. Review the pre-restore summary and confirm restoration.
4. The system will automatically create a pre-restore safety snapshot before restoring.
======================================================================
`;
  zip.addFile('README.txt', Buffer.from(readmeText, 'utf-8'));

  // 20. manifest.json
  const dataFiles = [
    'restaurant.json',
    'branches.json',
    'categories.json',
    'menu_items.json',
    'inventory_items.json',
    'suppliers.json',
    'purchases.json',
    'purchase_items.json',
    'recipes.json',
    'recipe_ingredients.json',
    'stock_movements.json',
    'wastage_records.json',
    'customers.json',
    'orders.json',
    'order_items.json',
    'expenses.json',
    'payments.json',
    'bank_accounts.json',
  ];

  const manifestData = {
    backup_format: 'restaurant-pos-backup',
    format_version: '1.0',
    software: 'Restaurant POS',
    backup_type: backupType.toLowerCase(),
    created_at: new Date().toISOString(),
    currency: (settings[0] as any)?.currency || 'PKR',
    tenant_id: tenant.id,
    restaurant_name: tenant.name,
    data_files: dataFiles,
    record_counts: recordCounts,
  };

  const manifestString = JSON.stringify(manifestData, null, 2);
  const checksum = crypto.createHash('sha256').update(manifestString).digest('hex');
  const manifestWithChecksum = { ...manifestData, checksum };
  zip.addFile('manifest.json', Buffer.from(JSON.stringify(manifestWithChecksum, null, 2), 'utf-8'));

  const buffer = zip.toBuffer();
  const cleanName = tenant.name.toLowerCase().replace(/[^a-z0-9]/g, '_');
  const dateStr = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const fileName = `restaurant_backup_${cleanName}_${dateStr}.zip`;
  const fileSize = buffer.length;

  // Insert into backups table
  try {
    await query(
      `
      INSERT INTO backups (
        tenant_id, backup_name, file_name, file_size, checksum, version,
        backup_type, status, metadata, created_by_user_id
      ) VALUES ($1, $2, $3, $4, $5, '1.0', $6, 'COMPLETED', $7, $8)
      `,
      [
        tenantId,
        `${tenant.name} (${backupType})`,
        fileName,
        fileSize,
        checksum,
        backupType,
        JSON.stringify({ recordCounts, dataFiles, manifest: manifestWithChecksum }),
        userId,
      ],
      { tenantId }
    );
  } catch (err: any) {
    console.warn('Failed to insert into backups table:', err.message);
  }

  // Also log into legacy backup_history table
  try {
    await query(
      `
      INSERT INTO backup_history (
        tenant_id, backup_type, file_name, file_size, checksum, version,
        triggered_by_user_id, triggered_by_name
      ) VALUES ($1, 'TENANT', $2, $3, $4, '1.0', $5, $6)
      `,
      [tenantId, fileName, fileSize, checksum, userId, userName],
      { tenantId }
    );
  } catch (_) {}

  await logAuditEvent({
    tenantId,
    actorId: userId,
    actorRole: 'SUPER_ADMIN',
    action: 'BACKUP_CREATED',
    resourceType: 'BACKUP',
    metadata: { fileName, fileSize, checksum, recordCounts, format: 'ZIP_V1' },
  });

  return { buffer, fileName, checksum, recordCounts };
}

/**
 * Generate a complete, downloadable sample backup ZIP package with realistic demo data
 */
export function generateSampleZipBackup(): { buffer: Buffer; fileName: string } {
  const zip = new AdmZip();

  const manifest = {
    backup_format: 'restaurant-pos-backup',
    format_version: '1.0',
    software: 'Restaurant POS',
    backup_type: 'full',
    created_at: '2026-11-10T10:30:00Z',
    currency: 'PKR',
    restaurant_name: 'Delight Pizza & Bistro (Sample)',
    data_files: [
      'restaurant.json',
      'branches.json',
      'categories.json',
      'menu_items.json',
      'inventory_items.json',
      'suppliers.json',
      'purchases.json',
      'purchase_items.json',
      'recipes.json',
      'recipe_ingredients.json',
      'stock_movements.json',
      'wastage_records.json',
      'customers.json',
      'orders.json',
      'order_items.json',
      'expenses.json',
      'payments.json',
    ],
    record_counts: {
      categories: 4,
      menu_items: 4,
      inventory_items: 6,
      suppliers: 2,
      purchases: 2,
      recipes: 2,
      customers: 2,
      orders: 2,
    },
    checksum: 'sample-sha256-precomputed-manifest-hash',
  };

  const restaurant = {
    tenant: {
      name: 'Delight Pizza & Bistro',
      slug: 'delight-pizza-sample',
      currency: 'PKR',
      tax_rate: 16.0,
      contact_number: '03342823000',
      address: 'Sector P1, Phase 4, Hayatabad, Peshawar',
    },
    settings: {
      currency: 'PKR',
      tax_rate: 16.0,
      print_business_name: true,
      print_slogan: true,
      slogan: 'Fresh, Oven-Baked Perfection',
    },
  };

  const branches = [
    {
      id: 'br-001',
      name: 'Main Branch - Hayatabad',
      address: 'Sector P1, Phase 4, Hayatabad, Peshawar',
      phone: '0915828000',
      is_active: true,
    },
  ];

  const categories = [
    { id: 'cat-01', name: 'Pizzas', sort_order: 1 },
    { id: 'cat-02', name: 'Starters & Sides', sort_order: 2 },
    { id: 'cat-03', name: 'Burgers & Sandwiches', sort_order: 3 },
    { id: 'cat-04', name: 'Beverages', sort_order: 4 },
  ];

  const menu_items = {
    products: [
      {
        id: 'prd-01',
        category_name: 'Pizzas',
        name: 'Margherita Pizza Large',
        sku: 'PIZ-MARG-L',
        price: 1299,
        description: 'Classic tomato passata, mozzarella, fresh basil leaves, and extra virgin olive oil',
      },
      {
        id: 'prd-02',
        category_name: 'Pizzas',
        name: 'Chicken Tikka Pizza Large',
        sku: 'PIZ-TIKKA-L',
        price: 1599,
        description: 'Tender tandoori-spiced chicken, red onions, bell peppers, mozzarella, and drizzle sauce',
      },
      {
        id: 'prd-03',
        category_name: 'Starters & Sides',
        name: 'Garlic Parmesan Breadsticks',
        sku: 'STA-GARLIC-01',
        price: 450,
        description: 'Freshly baked breadsticks brushed with garlic butter and dusted with grated parmesan',
      },
      {
        id: 'prd-04',
        category_name: 'Beverages',
        name: 'Mint Lemonade Chiller',
        sku: 'BEV-MINT-01',
        price: 299,
        description: 'Blended mint leaves, freshly squeezed lemon juice, sparkling water, and crushed ice',
      },
    ],
  };

  const inventory_items = {
    ingredients: [
      {
        id: 'ing-01',
        name: 'Pizza Flour Type 00',
        category: 'Dry Goods',
        unit: 'kg',
        purchase_price: 180,
        current_stock: 75,
        min_stock_alert: 20,
        sku: 'ING-FLOUR-01',
      },
      {
        id: 'ing-02',
        name: 'Mozzarella Block Cheese',
        category: 'Dairy',
        unit: 'kg',
        purchase_price: 1400,
        current_stock: 28,
        min_stock_alert: 10,
        sku: 'ING-MOZZ-01',
      },
      {
        id: 'ing-03',
        name: 'San Marzano Pizza Sauce',
        category: 'Sauces',
        unit: 'kg',
        purchase_price: 450,
        current_stock: 22,
        min_stock_alert: 5,
        sku: 'ING-SAUCE-01',
      },
      {
        id: 'ing-04',
        name: 'Fresh Boneless Chicken Breast',
        category: 'Meat & Poultry',
        unit: 'kg',
        purchase_price: 850,
        current_stock: 35,
        min_stock_alert: 10,
        sku: 'ING-CHIK-01',
      },
      {
        id: 'ing-05',
        name: 'Corrugated Pizza Box 12-inch',
        category: 'Packaging',
        unit: 'pieces',
        purchase_price: 35,
        current_stock: 350,
        min_stock_alert: 50,
        sku: 'PKG-BOX12-01',
      },
      {
        id: 'ing-06',
        name: 'Fresh Mint Leaves',
        category: 'Produce',
        unit: 'kg',
        purchase_price: 120,
        current_stock: 5,
        min_stock_alert: 1,
        sku: 'ING-MINT-01',
      },
    ],
  };

  const suppliers = [
    {
      id: 'sup-01',
      name: 'National Flour Mills Ltd',
      contact_person: 'Tariq Mahmood',
      phone: '03001234567',
      email: 'orders@nationalflour.pk',
      address: 'Industrial Estate, Peshawar',
    },
    {
      id: 'sup-02',
      name: 'Fresh Valley Poultry & Dairy',
      contact_person: 'Aslam Khan',
      phone: '03339876543',
      email: 'sales@freshvalleypoultry.com',
      address: 'Ring Road Commercial Hub, Peshawar',
    },
  ];

  const purchases = [
    {
      invoice_number: 'INV-2026-001',
      supplier_name: 'National Flour Mills Ltd',
      invoice_date: '2026-11-01',
      subtotal: 9000,
      tax_amount: 0,
      total_amount: 9000,
      payment_status: 'PAID',
    },
    {
      invoice_number: 'INV-2026-002',
      supplier_name: 'Fresh Valley Poultry & Dairy',
      invoice_date: '2026-11-03',
      subtotal: 34000,
      tax_amount: 0,
      total_amount: 34000,
      payment_status: 'PAID',
    },
  ];

  const purchase_items = [
    {
      invoice_number: 'INV-2026-001',
      item_name: 'Pizza Flour Type 00',
      quantity: 50,
      unit: 'kg',
      unit_price: 180,
      total_price: 9000,
    },
    {
      invoice_number: 'INV-2026-002',
      item_name: 'Fresh Boneless Chicken Breast',
      quantity: 40,
      unit: 'kg',
      unit_price: 850,
      total_price: 34000,
    },
  ];

  const recipes = [
    {
      menu_item: 'Chicken Tikka Pizza Large',
      yield: 1,
      instructions: 'Stretch 280g dough, spread 120g sauce, 180g mozzarella, 150g marinated tikka, bake at 320C for 6 mins.',
    },
    {
      menu_item: 'Margherita Pizza Large',
      yield: 1,
      instructions: 'Stretch 280g dough, spread 120g sauce, 200g mozzarella, fresh basil, bake at 320C for 6 mins.',
    },
  ];

  const recipe_ingredients = [
    { menu_item: 'Chicken Tikka Pizza Large', ingredient: 'Pizza Flour Type 00', quantity: 0.28, unit: 'kg' },
    { menu_item: 'Chicken Tikka Pizza Large', ingredient: 'San Marzano Pizza Sauce', quantity: 0.12, unit: 'kg' },
    { menu_item: 'Chicken Tikka Pizza Large', ingredient: 'Mozzarella Block Cheese', quantity: 0.18, unit: 'kg' },
    { menu_item: 'Chicken Tikka Pizza Large', ingredient: 'Fresh Boneless Chicken Breast', quantity: 0.15, unit: 'kg' },
    { menu_item: 'Chicken Tikka Pizza Large', ingredient: 'Corrugated Pizza Box 12-inch', quantity: 1, unit: 'pieces' },
  ];

  const stock_movements = [
    {
      item_name: 'Pizza Flour Type 00',
      movement_type: 'PURCHASE',
      quantity: 50,
      unit: 'kg',
      created_at: '2026-11-01T10:00:00Z',
      reference: 'INV-2026-001',
    },
    {
      item_name: 'Fresh Boneless Chicken Breast',
      movement_type: 'PURCHASE',
      quantity: 40,
      unit: 'kg',
      created_at: '2026-11-03T11:00:00Z',
      reference: 'INV-2026-002',
    },
  ];

  const wastage_records = [
    {
      item_name: 'Mozzarella Block Cheese',
      quantity: 0.5,
      unit: 'kg',
      reason: 'Quality inspection / test bake discard',
      created_at: '2026-11-04T15:30:00Z',
    },
  ];

  const customers = [
    {
      name: 'Hamza Tariq',
      phone: '03331122334',
      email: 'hamza.tariq@gmail.com',
      address: 'House 45, Street 12, Phase 5, Hayatabad, Peshawar',
      loyalty_points: 150,
    },
    {
      name: 'Ayesha Bilal',
      phone: '03009988776',
      email: 'ayesha.b@outlook.com',
      address: 'Apartment 3B, University Town, Peshawar',
      loyalty_points: 80,
    },
  ];

  const orders = [
    {
      order_number: 'ORD-1001',
      order_type: 'DINE_IN',
      customer_name: 'Hamza Tariq',
      status: 'COMPLETED',
      payment_status: 'PAID',
      subtotal: 1599,
      tax_amount: 255.84,
      grand_total: 1854.84,
      created_at: '2026-11-05T19:30:00Z',
    },
  ];

  const order_items = [
    {
      order_number: 'ORD-1001',
      item_name: 'Chicken Tikka Pizza Large',
      quantity: 1,
      unit_price: 1599,
      total_price: 1599,
    },
  ];

  const expenses = {
    categories: [{ name: 'Utilities' }, { name: 'Rent' }, { name: 'Staff Welfare' }],
    expenses: [
      {
        category: 'Utilities',
        amount: 25000,
        description: 'Monthly commercial electricity bill',
        payment_method: 'BANK_TRANSFER',
        expense_date: '2026-11-02',
      },
    ],
  };

  const payments = [
    {
      order_number: 'ORD-1001',
      payment_method: 'CASH',
      amount: 1854.84,
      status: 'COMPLETED',
      created_at: '2026-11-05T19:45:00Z',
    },
  ];

  zip.addFile('manifest.json', Buffer.from(JSON.stringify(manifest, null, 2), 'utf-8'));
  zip.addFile('restaurant.json', Buffer.from(JSON.stringify(restaurant, null, 2), 'utf-8'));
  zip.addFile('branches.json', Buffer.from(JSON.stringify(branches, null, 2), 'utf-8'));
  zip.addFile('categories.json', Buffer.from(JSON.stringify(categories, null, 2), 'utf-8'));
  zip.addFile('menu_items.json', Buffer.from(JSON.stringify(menu_items, null, 2), 'utf-8'));
  zip.addFile('inventory_items.json', Buffer.from(JSON.stringify(inventory_items, null, 2), 'utf-8'));
  zip.addFile('suppliers.json', Buffer.from(JSON.stringify(suppliers, null, 2), 'utf-8'));
  zip.addFile('purchases.json', Buffer.from(JSON.stringify(purchases, null, 2), 'utf-8'));
  zip.addFile('purchase_items.json', Buffer.from(JSON.stringify(purchase_items, null, 2), 'utf-8'));
  zip.addFile('recipes.json', Buffer.from(JSON.stringify(recipes, null, 2), 'utf-8'));
  zip.addFile('recipe_ingredients.json', Buffer.from(JSON.stringify(recipe_ingredients, null, 2), 'utf-8'));
  zip.addFile('stock_movements.json', Buffer.from(JSON.stringify(stock_movements, null, 2), 'utf-8'));
  zip.addFile('wastage_records.json', Buffer.from(JSON.stringify(wastage_records, null, 2), 'utf-8'));
  zip.addFile('customers.json', Buffer.from(JSON.stringify(customers, null, 2), 'utf-8'));
  zip.addFile('orders.json', Buffer.from(JSON.stringify(orders, null, 2), 'utf-8'));
  zip.addFile('order_items.json', Buffer.from(JSON.stringify(order_items, null, 2), 'utf-8'));
  zip.addFile('expenses.json', Buffer.from(JSON.stringify(expenses, null, 2), 'utf-8'));
  zip.addFile('payments.json', Buffer.from(JSON.stringify(payments, null, 2), 'utf-8'));

  const readme = `SAMPLE RESTAURANT BACKUP PACKAGE (v1.0)
This package illustrates the exact file schema used by Restaurant POS SaaS.
You can extract, examine, or upload this archive directly via Settings -> Backup & Restore.`;
  zip.addFile('README.txt', Buffer.from(readme, 'utf-8'));

  return { buffer: zip.toBuffer(), fileName: 'sample_restaurant_backup.zip' };
}

/**
 * Generate standard downloadable templates (.xlsx or .csv) for importing previous POS data
 */
export function generateTemplateFile(
  entityType: 'INVENTORY' | 'MENU' | 'SUPPLIERS' | 'PURCHASES' | 'CUSTOMERS',
  format: 'xlsx' | 'csv' = 'xlsx'
): { buffer: Buffer; fileName: string; mimeType: string } {
  let headers: string[] = [];
  let sampleRows: any[] = [];
  let guidelines: { Field: string; Requirement: string; Description: string }[] = [];
  const cleanType = entityType.toLowerCase();

  switch (entityType) {
    case 'INVENTORY':
      headers = ['Item Name', 'Category', 'SKU', 'Unit', 'Purchase Price', 'Opening Stock', 'Min Stock Alert', 'Notes'];
      sampleRows = [
        {
          'Item Name': 'Pizza Flour Type 00',
          Category: 'Dry Goods',
          SKU: 'ING-FLOUR-001',
          Unit: 'kg',
          'Purchase Price': 180,
          'Opening Stock': 50,
          'Min Stock Alert': 10,
          Notes: 'High protein unbleached flour',
        },
        {
          'Item Name': 'Mozzarella Block Cheese',
          Category: 'Dairy',
          SKU: 'ING-MOZZ-002',
          Unit: 'kg',
          'Purchase Price': 1400,
          'Opening Stock': 25,
          'Min Stock Alert': 5,
          Notes: 'Imported full-cream block',
        },
        {
          'Item Name': 'Chicken Tikka Chunks',
          Category: 'Meat',
          SKU: 'ING-CHIK-003',
          Unit: 'kg',
          'Purchase Price': 850,
          'Opening Stock': 30,
          'Min Stock Alert': 8,
          Notes: 'Pre-marinated chicken breast cubes',
        },
        {
          'Item Name': 'Corrugated Pizza Box 12in',
          Category: 'Packaging',
          SKU: 'PKG-BOX12-004',
          Unit: 'pieces',
          'Purchase Price': 35,
          'Opening Stock': 200,
          'Min Stock Alert': 50,
          Notes: 'Standard printed takeaway boxes',
        },
      ];
      guidelines = [
        { Field: 'Item Name', Requirement: 'Required', Description: 'Descriptive unique raw material / inventory item name.' },
        { Field: 'Category', Requirement: 'Optional', Description: 'Inventory category name (e.g., Dairy, Meat, Packaging, Dry Goods).' },
        { Field: 'SKU', Requirement: 'Optional', Description: 'Unique barcode or internal SKU. Auto-generated if left blank.' },
        { Field: 'Unit', Requirement: 'Required', Description: 'Accepted standard units: kg, grams, litres, ml, pieces, portions, cans, bottles, boxes.' },
        { Field: 'Purchase Price', Requirement: 'Required', Description: 'Standard purchase cost per unit (numbers only, e.g. 180).' },
        { Field: 'Opening Stock', Requirement: 'Optional (Default 0)', Description: 'Current available physical stock on hand. Automatically sets opening FIFO batch.' },
        { Field: 'Min Stock Alert', Requirement: 'Optional (Default 0)', Description: 'Low stock reorder threshold warning.' },
        { Field: 'Notes', Requirement: 'Optional', Description: 'Any internal storage or supplier notes.' },
      ];
      break;

    case 'MENU':
      headers = ['Item Name', 'Category', 'Base Price', 'Description', 'Tax Rate', 'SKU'];
      sampleRows = [
        {
          'Item Name': 'Margherita Pizza Large',
          Category: 'Pizzas',
          'Base Price': 1299,
          Description: 'Classic tomato sauce, fresh mozzarella, and aromatic basil leaves',
          'Tax Rate': 16,
          SKU: 'PIZ-MARG-L',
        },
        {
          'Item Name': 'Chicken Tikka Pizza Large',
          Category: 'Pizzas',
          'Base Price': 1599,
          Description: 'Spiced chicken tikka cubes, red onions, capsicum, and mozzarella',
          'Tax Rate': 16,
          SKU: 'PIZ-TIKKA-L',
        },
        {
          'Item Name': 'Crispy Golden French Fries',
          Category: 'Starters',
          'Base Price': 399,
          Description: 'Crispy skin-on french fries served with garlic mayo',
          'Tax Rate': 16,
          SKU: 'STA-FRIES-01',
        },
        {
          'Item Name': 'Fresh Mint Lemonade',
          Category: 'Beverages',
          'Base Price': 299,
          Description: 'Chilled freshly squeezed lemon and mint with crushed ice',
          'Tax Rate': 16,
          SKU: 'BEV-MINT-01',
        },
      ];
      guidelines = [
        { Field: 'Item Name', Requirement: 'Required', Description: 'Public menu item title displayed to cashiers and customers.' },
        { Field: 'Category', Requirement: 'Required', Description: 'Menu group (e.g. Pizzas, Beverages, Desserts). Created automatically if new.' },
        { Field: 'Base Price', Requirement: 'Required', Description: 'Retail selling price (tax-exclusive or inclusive as per your settings).' },
        { Field: 'Description', Requirement: 'Optional', Description: 'Short customer-facing item description.' },
        { Field: 'Tax Rate', Requirement: 'Optional', Description: 'Percentage sales tax rate (e.g. 16 for 16%). Uses restaurant default if empty.' },
        { Field: 'SKU', Requirement: 'Optional', Description: 'Menu barcode or item code. Auto-generated if left empty.' },
      ];
      break;

    case 'SUPPLIERS':
      headers = ['Supplier Name', 'Contact Person', 'Phone', 'Email', 'Address', 'Tax Number', 'Payment Terms'];
      sampleRows = [
        {
          'Supplier Name': 'Metro Cash & Carry',
          'Contact Person': 'Tariq Mahmood',
          Phone: '03001234567',
          Email: 'orders@metrocash.pk',
          Address: 'Ring Road Commercial Hub, Peshawar',
          'Tax Number': '1234567-8',
          'Payment Terms': 'Net 15 Days',
        },
        {
          'Supplier Name': 'Fresh Valley Poultry',
          'Contact Person': 'Aslam Khan',
          Phone: '03339876543',
          Email: 'sales@freshvalleypoultry.com',
          Address: 'Industrial Area Phase 2, Peshawar',
          'Tax Number': '9876543-2',
          'Payment Terms': 'Cash on Delivery',
        },
        {
          'Supplier Name': 'United Packaging Co',
          'Contact Person': 'Zahid Ali',
          Phone: '03215554321',
          Email: 'info@unitedpackaging.pk',
          Address: 'Hayatabad Industrial Estate, Peshawar',
          'Tax Number': '5554321-0',
          'Payment Terms': 'Net 30 Days',
        },
      ];
      guidelines = [
        { Field: 'Supplier Name', Requirement: 'Required', Description: 'Company or vendor trading name.' },
        { Field: 'Contact Person', Requirement: 'Optional', Description: 'Name of key sales rep or manager.' },
        { Field: 'Phone', Requirement: 'Optional', Description: 'Direct contact telephone or WhatsApp number.' },
        { Field: 'Email', Requirement: 'Optional', Description: 'Vendor invoicing or ordering email.' },
        { Field: 'Address', Requirement: 'Optional', Description: 'Physical warehouse or business address.' },
        { Field: 'Tax Number', Requirement: 'Optional', Description: 'NTN / STRN tax identification number.' },
        { Field: 'Payment Terms', Requirement: 'Optional', Description: 'Default payment terms (e.g., COD, Net 15, Net 30).' },
      ];
      break;

    case 'PURCHASES':
      headers = ['Supplier Name', 'Item Name', 'Quantity', 'Unit', 'Unit Price', 'Invoice Number', 'Purchase Date', 'Payment Status'];
      sampleRows = [
        {
          'Supplier Name': 'National Flour Mills Ltd',
          'Item Name': 'Pizza Flour Type 00',
          Quantity: 50,
          Unit: 'kg',
          'Unit Price': 180,
          'Invoice Number': 'INV-2026-001',
          'Purchase Date': '2026-11-01',
          'Payment Status': 'PAID',
        },
        {
          'Supplier Name': 'Fresh Valley Poultry',
          'Item Name': 'Fresh Boneless Chicken Breast',
          Quantity: 40,
          Unit: 'kg',
          'Unit Price': 850,
          'Invoice Number': 'INV-2026-002',
          'Purchase Date': '2026-11-02',
          'Payment Status': 'PAID',
        },
        {
          'Supplier Name': 'Metro Cash & Carry',
          'Item Name': 'Mozzarella Block Cheese',
          Quantity: 20,
          Unit: 'kg',
          'Unit Price': 1400,
          'Invoice Number': 'INV-2026-003',
          'Purchase Date': '2026-11-03',
          'Payment Status': 'PARTIAL',
        },
      ];
      guidelines = [
        { Field: 'Supplier Name', Requirement: 'Required', Description: 'Must match an existing vendor or will be registered automatically.' },
        { Field: 'Item Name', Requirement: 'Required', Description: 'Must match an inventory item name or will be added to catalog.' },
        { Field: 'Quantity', Requirement: 'Required', Description: 'Numeric quantity purchased.' },
        { Field: 'Unit', Requirement: 'Required', Description: 'Accepted standard units (kg, grams, litres, pieces, etc.).' },
        { Field: 'Unit Price', Requirement: 'Required', Description: 'Cost per unit.' },
        { Field: 'Invoice Number', Requirement: 'Optional', Description: 'Vendor invoice or receipt bill number.' },
        { Field: 'Purchase Date', Requirement: 'Optional', Description: 'Date of invoice (YYYY-MM-DD). Defaults to today.' },
        { Field: 'Payment Status', Requirement: 'Optional', Description: 'PAID, UNPAID, or PARTIAL.' },
      ];
      break;

    case 'CUSTOMERS':
      headers = ['Customer Name', 'Phone', 'Email', 'Address', 'Loyalty Points'];
      sampleRows = [
        {
          'Customer Name': 'Hamza Tariq',
          Phone: '03331122334',
          Email: 'hamza.tariq@gmail.com',
          Address: 'House 45, Street 12, Phase 5, Hayatabad, Peshawar',
          'Loyalty Points': 150,
        },
        {
          'Customer Name': 'Ayesha Bilal',
          Phone: '03009988776',
          Email: 'ayesha.b@outlook.com',
          Address: 'Apartment 3B, University Town, Peshawar',
          'Loyalty Points': 80,
        },
        {
          'Customer Name': 'Kamran Shah',
          Phone: '03454455667',
          Email: 'kamran.shah@yahoo.com',
          Address: 'Sector F4, Hayatabad, Peshawar',
          'Loyalty Points': 210,
        },
      ];
      guidelines = [
        { Field: 'Customer Name', Requirement: 'Required', Description: 'Full customer name.' },
        { Field: 'Phone', Requirement: 'Required / Recommended', Description: 'Customer mobile phone number for ordering and SMS.' },
        { Field: 'Email', Requirement: 'Optional', Description: 'Customer email address.' },
        { Field: 'Address', Requirement: 'Optional', Description: 'Delivery or billing address.' },
        { Field: 'Loyalty Points', Requirement: 'Optional (Default 0)', Description: 'Initial rewards or loyalty balance.' },
      ];
      break;
  }

  const wb = XLSX.utils.book_new();
  const wsData = XLSX.utils.json_to_sheet(sampleRows, { header: headers });
  XLSX.utils.book_append_sheet(wb, wsData, 'Template');

  if (format === 'xlsx') {
    const wsGuidelines = XLSX.utils.json_to_sheet(guidelines);
    XLSX.utils.book_append_sheet(wb, wsGuidelines, 'Guidelines');
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    return {
      buffer,
      fileName: `template_${cleanType}.xlsx`,
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    };
  } else {
    const csvContent = XLSX.utils.sheet_to_csv(wsData);
    return {
      buffer: Buffer.from(csvContent, 'utf-8'),
      fileName: `template_${cleanType}.csv`,
      mimeType: 'text/csv',
    };
  }
}

/**
 * Universal restore executor supporting both ZIP archives and JSON packages
 */
export async function restoreTenantBackupFromBuffer(
  tenantId: string,
  buffer: Buffer,
  userId: string,
  userName: string = 'Staff',
  options: {
    mode?: 'FULL' | 'SELECTIVE' | 'MERGE';
    selectedModules?: string[];
  } = {}
): Promise<{ success: boolean; message: string; recordsRestored: number }> {
  // Check if buffer is a ZIP archive (PK\x03\x04 signature)
  const isZip = buffer.length > 4 && buffer[0] === 0x50 && buffer[1] === 0x4b;

  let backupPackage: BackupPackage;

  if (isZip) {
    try {
      const zip = new AdmZip(buffer);
      const manifestEntry = zip.getEntry('manifest.json');
      if (!manifestEntry) {
        throw new Error('Invalid backup archive: missing manifest.json');
      }

      const manifestText = manifestEntry.getData().toString('utf-8');
      const manifest = JSON.parse(manifestText);

      // Verify format
      if (manifest.backup_format !== 'restaurant-pos-backup' && !manifest.version && !manifest.format_version) {
        throw new Error('Unsupported backup format. Expected "restaurant-pos-backup".');
      }

      // Reconstruct data map from individual files
      const data: Record<string, any[]> = {};
      const fileMapping: Record<string, string> = {
        'restaurant.json': 'restaurant_settings',
        'branches.json': 'branches',
        'categories.json': 'categories',
        'suppliers.json': 'suppliers',
        'purchases.json': 'purchase_invoices',
        'purchase_items.json': 'purchase_items',
        'recipes.json': 'recipes',
        'recipe_ingredients.json': 'recipe_ingredients',
        'stock_movements.json': 'stock_movements',
        'customers.json': 'customers',
        'orders.json': 'orders',
        'order_items.json': 'order_items',
        'payments.json': 'order_payments',
        'bank_accounts.json': 'bank_accounts',
      };

      for (const [fileName, tableName] of Object.entries(fileMapping)) {
        const entry = zip.getEntry(fileName);
        if (entry) {
          try {
            const parsed = JSON.parse(entry.getData().toString('utf-8'));
            if (Array.isArray(parsed)) {
              data[tableName] = parsed;
            } else if (parsed && typeof parsed === 'object') {
              if (fileName === 'restaurant.json' && parsed.settings) {
                data[tableName] = [parsed.settings];
              }
            }
          } catch (_) {}
        }
      }

      // Parse menu_items.json (products & variants)
      const menuEntry = zip.getEntry('menu_items.json');
      if (menuEntry) {
        try {
          const menuData = JSON.parse(menuEntry.getData().toString('utf-8'));
          if (Array.isArray(menuData.products)) data['products'] = menuData.products;
          if (Array.isArray(menuData.variants)) data['product_variants'] = menuData.variants;
        } catch (_) {}
      }

      // Parse inventory_items.json (ingredients & stocks)
      const invEntry = zip.getEntry('inventory_items.json');
      if (invEntry) {
        try {
          const invData = JSON.parse(invEntry.getData().toString('utf-8'));
          if (Array.isArray(invData.ingredients)) data['ingredients'] = invData.ingredients;
          if (Array.isArray(invData.branch_stocks)) data['branch_stocks'] = invData.branch_stocks;
          if (Array.isArray(invData.inventory_batches)) data['inventory_batches'] = invData.inventory_batches;
        } catch (_) {}
      }

      // Parse expenses.json (expenses & categories)
      const expEntry = zip.getEntry('expenses.json');
      if (expEntry) {
        try {
          const expData = JSON.parse(expEntry.getData().toString('utf-8'));
          if (Array.isArray(expData.expenses)) data['expenses'] = expData.expenses;
          if (Array.isArray(expData.categories)) data['expense_categories'] = expData.categories;
        } catch (_) {}
      }

      const computedChecksum = crypto.createHash('sha256').update(JSON.stringify(data)).digest('hex');

      backupPackage = {
        metadata: {
          version: manifest.format_version || manifest.version || '1.0',
          tenantId: manifest.tenant_id,
          tenantName: manifest.restaurant_name,
          backupType: 'TENANT',
          exportedAt: manifest.created_at || new Date().toISOString(),
          checksum: computedChecksum,
          recordCounts: manifest.record_counts || {},
        },
        data,
      };
    } catch (zipErr: any) {
      throw new Error(`Failed to extract and parse ZIP backup: ${zipErr.message}`);
    }
  } else {
    // Treat as JSON buffer
    try {
      const jsonText = buffer.toString('utf-8');
      const parsed = JSON.parse(jsonText);
      if (parsed.metadata && parsed.data) {
        backupPackage = parsed;
      } else {
        throw new Error('JSON backup must contain "metadata" and "data" keys');
      }
    } catch (jsonErr: any) {
      throw new Error(`Invalid JSON backup: ${jsonErr.message}`);
    }
  }

  return restoreTenantBackup(tenantId, backupPackage, userId, userName, options);
}

/**
 * Fetch backup history for a tenant or platform
 */
export async function getBackupHistory(tenantId?: string | null) {
  // Query new backups table first
  try {
    let sql = `
      SELECT b.id, b.tenant_id, b.backup_name, b.file_name, b.file_size, b.checksum, b.version,
             b.backup_type, b.status, b.metadata, b.created_at,
             u.full_name as triggered_by_name,
             t.name as tenant_name
      FROM backups b
      LEFT JOIN tenants t ON t.id = b.tenant_id
      LEFT JOIN users u ON u.id = b.created_by_user_id
    `;
    const params: any[] = [];
    if (tenantId) {
      params.push(tenantId);
      sql += ` WHERE b.tenant_id = $1`;
    }
    sql += ` ORDER BY b.created_at DESC LIMIT 100`;
    const { rows } = await query(sql, params, { tenantId });
    if (rows && rows.length > 0) {
      return rows;
    }
  } catch (_) {}

  // Fallback to legacy backup_history
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
