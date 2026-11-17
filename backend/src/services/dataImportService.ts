import crypto from 'crypto';
import * as XLSX from 'xlsx';
import { query, withTransaction } from '../db/connection.js';
import { logAuditEvent } from './auditService.js';
import { StockMovementType } from '@pos/shared';

export interface ColumnMapping {
  sourceColumn: string;
  targetField: string;
}

export interface ImportValidationIssue {
  row: number;
  field: string;
  message: string;
  value: any;
  severity: 'ERROR' | 'WARNING';
}

export interface ImportValidationResult {
  isValid: boolean;
  totalRecords: number;
  validRecords: number;
  errorRecords: number;
  duplicateRecords: number;
  issues: ImportValidationIssue[];
  previewRows: Record<string, any>[];
  detectedEntity: string;
  availableColumns: string[];
  suggestedMappings: Record<string, string>;
}

export interface ImportExecutionResult {
  importId: string;
  totalProcessed: number;
  successCount: number;
  updatedCount: number;
  skippedCount: number;
  failedCount: number;
  errors: { row: number; error: string }[];
  status: 'SUCCESS' | 'PARTIAL' | 'FAILED';
  summary: Record<string, any>;
}

// Common headers used by various POS software (Aldelo, Toast, Revel, Lightspeed, Clover, Focus, etc.)
const HEADER_SYNONYMS: Record<string, string[]> = {
  name: ['item name', 'item_name', 'product name', 'product_name', 'description', 'item description', 'title', 'ingredient', 'name', 'item'],
  category: ['category', 'category name', 'category_name', 'group', 'product group', 'product_group', 'item group', 'department', 'dept', 'classification'],
  sku: ['sku', 'code', 'item code', 'item_code', 'product code', 'product_code', 'barcode', 'upc', 'plu', 'item id', 'external id', 'external_id'],
  unit: ['unit', 'uom', 'unit of measure', 'unit_name', 'unit name', 'base unit', 'base_unit', 'measurement', 'measure'],
  purchasePrice: ['purchase price', 'purchase_price', 'cost', 'cost price', 'cost_price', 'unit cost', 'unit_cost', 'rate', 'purchase rate', 'purchase_rate', 'buy price', 'cost rate'],
  basePrice: ['selling price', 'selling_price', 'sale price', 'sale_price', 'retail price', 'retail_price', 'price', 'menu price', 'menu_price', 'rate', 'unit price'],
  openingStock: ['opening stock', 'opening_stock', 'stock', 'current stock', 'current_stock', 'quantity', 'qty', 'on hand', 'available stock', 'balance', 'in stock'],
  minStockAlert: ['min stock alert', 'min stock', 'min_stock', 'reorder level', 'reorder point', 'alert threshold', 'minimum', 'low stock alert', 'min alert'],
  contactPerson: ['contact person', 'contact_person', 'contact', 'person', 'rep', 'representative', 'agent'],
  phone: ['phone', 'phone number', 'phone_number', 'mobile', 'mobile number', 'cell', 'telephone', 'tel', 'contact number'],
  email: ['email', 'email address', 'email_address', 'mail'],
  address: ['address', 'location', 'street', 'city', 'vendor address', 'supplier address'],
  supplierName: ['supplier', 'supplier name', 'supplier_name', 'vendor', 'vendor name', 'vendor_name'],
  invoiceNumber: ['invoice number', 'invoice_number', 'bill no', 'bill_no', 'invoice', 'inv no', 'inv_no', 'reference', 'ref no'],
  purchaseDate: ['purchase date', 'purchase_date', 'date', 'invoice date', 'bill date', 'received date'],
  totalAmount: ['total', 'total amount', 'total_amount', 'grand total', 'net amount', 'invoice total', 'bill amount'],
  paidAmount: ['paid', 'paid amount', 'paid_amount', 'amount paid'],
  notes: ['notes', 'remarks', 'comments', 'memo', 'description'],
};

/**
 * Suggest optimal field mappings based on detected file header names
 */
export function suggestColumnMappings(headers: string[], entityType: string): Record<string, string> {
  const suggestions: Record<string, string> = {};
  const normalizedHeaders = headers.map((h) => ({
    original: h,
    cleaned: h.toLowerCase().trim().replace(/[^a-z0-9]/g, ' '),
  }));

  for (const [targetField, synonyms] of Object.entries(HEADER_SYNONYMS)) {
    for (const h of normalizedHeaders) {
      if (synonyms.some((s) => s === h.cleaned || h.cleaned.includes(s) || s.includes(h.cleaned))) {
        suggestions[h.original] = targetField;
        break;
      }
    }
  }

  return suggestions;
}

/**
 * Parse any supported buffer (XLSX, CSV, JSON) into raw tabular records
 */
export function parseRawFileBuffer(
  buffer: Buffer,
  fileName: string
): {
  format: 'XLSX' | 'CSV' | 'JSON' | 'ZIP';
  sheets: { name: string; headers: string[]; rows: Record<string, any>[] }[];
} {
  const lower = fileName.toLowerCase();

  if (lower.endsWith('.xlsx') || lower.endsWith('.xls')) {
    const wb = XLSX.read(buffer, { type: 'buffer' });
    const sheets = wb.SheetNames.map((sheetName) => {
      const ws = wb.Sheets[sheetName];
      const jsonRows: any[] = XLSX.utils.sheet_to_json(ws, { defval: '' });
      const headers = jsonRows.length > 0 ? Object.keys(jsonRows[0]) : [];
      return { name: sheetName, headers, rows: jsonRows };
    });
    return { format: 'XLSX', sheets };
  }

  if (lower.endsWith('.csv') || lower.endsWith('.tsv') || lower.endsWith('.txt')) {
    const text = buffer.toString('utf-8');
    const wb = XLSX.read(text, { type: 'string' });
    const sheetName = wb.SheetNames[0] || 'Sheet1';
    const ws = wb.Sheets[sheetName];
    const jsonRows: any[] = XLSX.utils.sheet_to_json(ws, { defval: '' });
    const headers = jsonRows.length > 0 ? Object.keys(jsonRows[0]) : [];
    return { format: 'CSV', sheets: [{ name: 'CSV Data', headers, rows: jsonRows }] };
  }

  if (lower.endsWith('.json')) {
    const parsed = JSON.parse(buffer.toString('utf-8'));
    let rows: any[] = [];
    if (Array.isArray(parsed)) {
      rows = parsed;
    } else if (parsed && typeof parsed === 'object') {
      // Find the first array property or wrap object
      const arrKey = Object.keys(parsed).find((k) => Array.isArray(parsed[k]));
      rows = arrKey ? parsed[arrKey] : [parsed];
    }
    const headers = rows.length > 0 ? Object.keys(rows[0]) : [];
    return { format: 'JSON', sheets: [{ name: 'JSON Records', headers, rows }] };
  }

  throw new Error(`Unsupported file format. Please upload .xlsx, .csv, .json, or .zip`);
}

/**
 * Step 1 & 2: Inspect uploaded file, detect schema and columns
 */
export async function inspectUploadedFile(
  buffer: Buffer,
  fileName: string,
  targetEntityHint?: string
): Promise<{
  fileName: string;
  format: string;
  sheets: { name: string; recordCount: number; headers: string[] }[];
  selectedSheet: string;
  headers: string[];
  sampleRows: Record<string, any>[];
  detectedEntity: string;
  suggestedMappings: Record<string, string>;
}> {
  const parsed = parseRawFileBuffer(buffer, fileName);
  const firstSheet = parsed.sheets[0] || { name: 'Data', headers: [], rows: [] };

  // Detect Entity Type
  let detectedEntity = targetEntityHint || 'INVENTORY';
  const headerStr = firstSheet.headers.join(' ').toLowerCase();

  if (headerStr.includes('selling') || headerStr.includes('menu') || headerStr.includes('dish') || headerStr.includes('retail price')) {
    detectedEntity = 'MENU';
  } else if (headerStr.includes('supplier') || headerStr.includes('vendor') || headerStr.includes('payable')) {
    detectedEntity = 'SUPPLIERS';
  } else if (headerStr.includes('customer') || headerStr.includes('loyalty') || headerStr.includes('guest')) {
    detectedEntity = 'CUSTOMERS';
  } else if (headerStr.includes('invoice') || headerStr.includes('bill no') || headerStr.includes('purchase')) {
    detectedEntity = 'PURCHASES';
  } else if (headerStr.includes('ingredient') || headerStr.includes('stock') || headerStr.includes('uom') || headerStr.includes('cost')) {
    detectedEntity = 'INVENTORY';
  }

  const suggestedMappings = suggestColumnMappings(firstSheet.headers, detectedEntity);

  return {
    fileName,
    format: parsed.format,
    sheets: parsed.sheets.map((s) => ({
      name: s.name,
      recordCount: s.rows.length,
      headers: s.headers,
    })),
    selectedSheet: firstSheet.name,
    headers: firstSheet.headers,
    sampleRows: firstSheet.rows.slice(0, 5),
    detectedEntity,
    suggestedMappings,
  };
}

/**
 * Map raw row using user-defined Column Mapping dictionary
 */
export function applyColumnMapping(
  rawRow: Record<string, any>,
  mapping: Record<string, string>
): Record<string, any> {
  const mapped: Record<string, any> = {};
  for (const [sourceCol, targetField] of Object.entries(mapping)) {
    if (!targetField || targetField === 'IGNORE') continue;
    mapped[targetField] = rawRow[sourceCol];
  }
  return mapped;
}

/**
 * Step 4: Validate Data against database rules and duplicate checks
 */
export async function validateImportRows(
  tenantId: string,
  entityType: 'INVENTORY' | 'MENU' | 'SUPPLIERS' | 'CUSTOMERS' | 'PURCHASES',
  rawRows: Record<string, any>[],
  columnMapping: Record<string, string>
): Promise<ImportValidationResult> {
  const issues: ImportValidationIssue[] = [];
  const previewRows: Record<string, any>[] = [];

  // Fetch existing items for duplicate detection
  const existingNamesSet = new Set<string>();
  const existingSkusSet = new Set<string>();

  if (entityType === 'INVENTORY') {
    const { rows } = await query(
      `SELECT LOWER(TRIM(name)) as name, LOWER(TRIM(sku)) as sku FROM ingredients WHERE tenant_id = $1`,
      [tenantId],
      { tenantId }
    );
    rows.forEach((r) => {
      if (r.name) existingNamesSet.add(r.name);
      if (r.sku) existingSkusSet.add(r.sku);
    });
  } else if (entityType === 'MENU') {
    const { rows } = await query(
      `SELECT LOWER(TRIM(name)) as name, LOWER(TRIM(sku)) as sku FROM products WHERE tenant_id = $1`,
      [tenantId],
      { tenantId }
    );
    rows.forEach((r) => {
      if (r.name) existingNamesSet.add(r.name);
      if (r.sku) existingSkusSet.add(r.sku);
    });
  } else if (entityType === 'SUPPLIERS') {
    const { rows } = await query(
      `SELECT LOWER(TRIM(name)) as name FROM suppliers WHERE tenant_id = $1`,
      [tenantId],
      { tenantId }
    );
    rows.forEach((r) => existingNamesSet.add(r.name));
  } else if (entityType === 'CUSTOMERS') {
    const { rows } = await query(
      `SELECT LOWER(TRIM(phone)) as phone FROM customers WHERE tenant_id = $1 AND phone IS NOT NULL`,
      [tenantId],
      { tenantId }
    );
    rows.forEach((r) => existingNamesSet.add(r.phone));
  }

  let errorCount = 0;
  let duplicateCount = 0;

  for (let idx = 0; idx < rawRows.length; idx++) {
    const rowNum = idx + 1;
    const mapped = applyColumnMapping(rawRows[idx], columnMapping);
    let rowHasError = false;

    // Field-specific validation
    if (entityType === 'INVENTORY' || entityType === 'MENU' || entityType === 'SUPPLIERS' || entityType === 'CUSTOMERS') {
      const name = String(mapped.name || '').trim();
      if (!name) {
        issues.push({
          row: rowNum,
          field: 'name',
          message: 'Item / Entity Name is required and cannot be blank',
          value: mapped.name,
          severity: 'ERROR',
        });
        rowHasError = true;
      } else {
        const lowerName = name.toLowerCase();
        const sku = String(mapped.sku || '').trim().toLowerCase();
        if (existingNamesSet.has(lowerName) || (sku && existingSkusSet.has(sku))) {
          duplicateCount++;
          issues.push({
            row: rowNum,
            field: 'name',
            message: `Record already exists in this restaurant (${name}${sku ? ' / ' + sku : ''})`,
            value: name,
            severity: 'WARNING',
          });
        }
      }
    }

    if (entityType === 'INVENTORY') {
      // Numerical checks
      if (mapped.purchasePrice !== undefined && mapped.purchasePrice !== '') {
        const num = Number(mapped.purchasePrice);
        if (isNaN(num) || num < 0) {
          issues.push({
            row: rowNum,
            field: 'purchasePrice',
            message: 'Purchase Price must be a valid non-negative number',
            value: mapped.purchasePrice,
            severity: 'ERROR',
          });
          rowHasError = true;
        }
      }
      if (mapped.openingStock !== undefined && mapped.openingStock !== '') {
        const num = Number(mapped.openingStock);
        if (isNaN(num) || num < 0) {
          issues.push({
            row: rowNum,
            field: 'openingStock',
            message: 'Opening Stock must be a valid non-negative number',
            value: mapped.openingStock,
            severity: 'ERROR',
          });
          rowHasError = true;
        }
      }
    }

    if (entityType === 'MENU') {
      const price = Number(mapped.basePrice);
      if (isNaN(price) || price < 0) {
        issues.push({
          row: rowNum,
          field: 'basePrice',
          message: 'Base Selling Price is required and must be a valid non-negative number',
          value: mapped.basePrice,
          severity: 'ERROR',
        });
        rowHasError = true;
      }
    }

    if (entityType === 'PURCHASES') {
      if (!mapped.supplierName && !mapped.supplier) {
        issues.push({
          row: rowNum,
          field: 'supplierName',
          message: 'Supplier Name is required for purchase records',
          value: mapped.supplierName,
          severity: 'ERROR',
        });
        rowHasError = true;
      }
      if (!mapped.name && !mapped.itemName) {
        issues.push({
          row: rowNum,
          field: 'name',
          message: 'Purchased Item Name is required',
          value: mapped.name,
          severity: 'ERROR',
        });
        rowHasError = true;
      }
    }

    if (rowHasError) {
      errorCount++;
    }

    if (previewRows.length < 10) {
      previewRows.push({ _row: rowNum, ...mapped });
    }
  }

  const totalRecords = rawRows.length;
  const validRecords = totalRecords - errorCount;

  return {
    isValid: errorCount === 0,
    totalRecords,
    validRecords,
    errorRecords: errorCount,
    duplicateRecords: duplicateCount,
    issues,
    previewRows,
    detectedEntity: entityType,
    availableColumns: Object.keys(rawRows[0] || {}),
    suggestedMappings: columnMapping,
  };
}

/**
 * Step 6: Atomic Transactional Execution of Data Migration
 */
export async function executeDataImport(
  tenantId: string,
  branchId: string,
  userId: string,
  options: {
    entityType: 'INVENTORY' | 'MENU' | 'SUPPLIERS' | 'CUSTOMERS' | 'PURCHASES';
    rawRows: Record<string, any>[];
    columnMapping: Record<string, string>;
    strategy: 'CREATE_NEW' | 'UPDATE_MATCHING' | 'SKIP_DUPLICATES';
    fileName: string;
    fileFormat: string;
  }
): Promise<ImportExecutionResult> {
  const { entityType, rawRows, columnMapping, strategy, fileName, fileFormat } = options;

  let successCount = 0;
  let updatedCount = 0;
  let skippedCount = 0;
  let failedCount = 0;
  const errors: { row: number; error: string }[] = [];

  const result = await withTransaction(async (client) => {
    // -------------------------------------------------------------
    // ENTITY: INVENTORY (Raw Materials, Ingredients, Opening Stock)
    // -------------------------------------------------------------
    if (entityType === 'INVENTORY') {
      // Map existing categories
      const { rows: existingCats } = await client.query(
        `SELECT id, name FROM categories WHERE tenant_id = $1`,
        [tenantId]
      );
      const catMap = new Map<string, string>();
      existingCats.forEach((c) => catMap.set(c.name.toLowerCase().trim(), c.id));

      for (let idx = 0; idx < rawRows.length; idx++) {
        const rowNum = idx + 1;
        const mapped = applyColumnMapping(rawRows[idx], columnMapping);
        const name = String(mapped.name || '').trim();
        if (!name) {
          failedCount++;
          errors.push({ row: rowNum, error: 'Empty item name' });
          continue;
        }

        const categoryName = String(mapped.category || 'General').trim();
        const rawUnit = String(mapped.unit || 'KG').toUpperCase().trim();
        const unit = ['KG', 'G', 'L', 'ML', 'PCS', 'PACKET', 'BOX', 'CAN', 'BOTTLE', 'DOZEN'].includes(rawUnit)
          ? rawUnit
          : 'KG';
        const cost = Math.max(0, parseFloat(mapped.purchasePrice) || 0);
        const openingStock = Math.max(0, parseFloat(mapped.openingStock) || 0);
        const minAlert = Math.max(0, parseFloat(mapped.minStockAlert) || 5);
        const manualSku = String(mapped.sku || '').trim();
        let sku = manualSku;
        if (strategy === 'CREATE_NEW' && manualSku) {
          const skuCheck = await client.query('SELECT 1 FROM ingredients WHERE tenant_id = $1 AND sku = $2', [tenantId, manualSku]);
          if (skuCheck.rows.length > 0) {
            sku = `${manualSku}-${Date.now().toString(36).slice(-4)}`;
          }
        } else if (!sku) {
          sku = `ING-${name.slice(0, 3).toUpperCase().replace(/[^A-Z]/g, 'X')}-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 5).toUpperCase()}`;
        }

        await client.query('SAVEPOINT row_sp');
        try {
          // Check if item exists by name or sku
          const checkRes = await client.query(
            `SELECT id FROM ingredients WHERE tenant_id = $1 AND (LOWER(TRIM(name)) = LOWER($2) OR (sku IS NOT NULL AND LOWER(TRIM(sku)) = LOWER($3)))`,
            [tenantId, name, manualSku || '']
          );

          if (checkRes.rows.length > 0) {
            const existingId = checkRes.rows[0].id;
            if (strategy === 'SKIP_DUPLICATES') {
              await client.query('RELEASE SAVEPOINT row_sp');
              skippedCount++;
              continue;
            } else if (strategy === 'UPDATE_MATCHING') {
              await client.query(
                `UPDATE ingredients SET cost_per_unit = $1, purchase_cost = $1, min_stock_alert = $2, category = $3 WHERE id = $4`,
                [cost, minAlert, categoryName, existingId]
              );
              await client.query('RELEASE SAVEPOINT row_sp');
              updatedCount++;
              continue;
            }
          }

          // Insert new ingredient
          const insertRes = await client.query(
            `
            INSERT INTO ingredients (
              tenant_id, name, category, sku, unit, base_unit, purchase_unit,
              conversion_factor, cost_per_unit, purchase_cost, min_stock_alert, is_active
            ) VALUES ($1, $2, $3, $4, $5, $5, $5, 1, $6, $6, $7, true)
            RETURNING id
            `,
            [tenantId, name, categoryName, sku, unit, cost, minAlert]
          );
          const ingredientId = insertRes.rows[0].id;

          // If opening stock provided, record opening balance, FIFO batch, and movement ledger
          if (openingStock > 0 && branchId) {
            await client.query(
              `
              INSERT INTO branch_stocks (tenant_id, branch_id, ingredient_id, current_stock, cost_per_unit)
              VALUES ($1, $2, $3, $4, $5)
              ON CONFLICT (branch_id, ingredient_id)
              DO UPDATE SET current_stock = branch_stocks.current_stock + EXCLUDED.current_stock
              `,
              [tenantId, branchId, ingredientId, openingStock, cost]
            );

            await client.query(
              `
              INSERT INTO inventory_batches (
                tenant_id, branch_id, ingredient_id, quantity_received, quantity_remaining, unit_cost, status
              ) VALUES ($1, $2, $3, $4, $4, $5, 'ACTIVE')
              `,
              [tenantId, branchId, ingredientId, openingStock, cost]
            );

            await client.query(
              `
              INSERT INTO stock_movements (
                tenant_id, branch_id, ingredient_id, movement_type, quantity,
                stock_before, stock_after, unit_cost, total_cost, reference_type, reason, recorded_by_user_id
              ) VALUES ($1, $2, $3, $4, $5, 0, $5, $6, $7, 'ADJUSTMENT', 'Migrated Opening Stock from Previous POS', $8)
              `,
              [
                tenantId,
                branchId,
                ingredientId,
                StockMovementType.OPENING_STOCK,
                openingStock,
                cost,
                openingStock * cost,
                userId,
              ]
            );
          }

          await client.query('RELEASE SAVEPOINT row_sp');
          successCount++;
        } catch (itemErr: any) {
          await client.query('ROLLBACK TO SAVEPOINT row_sp');
          failedCount++;
          errors.push({ row: rowNum, error: itemErr.message });
        }
      }
    }

    // -------------------------------------------------------------
    // ENTITY: MENU (Products & Menu Items)
    // -------------------------------------------------------------
    else if (entityType === 'MENU') {
      for (let idx = 0; idx < rawRows.length; idx++) {
        const rowNum = idx + 1;
        const mapped = applyColumnMapping(rawRows[idx], columnMapping);
        const name = String(mapped.name || '').trim();
        const basePrice = Math.max(0, parseFloat(mapped.basePrice) || 0);
        const costPrice = Math.max(0, parseFloat(mapped.costPrice) || 0);
        const categoryName = String(mapped.category || 'General').trim();
        const manualSku = String(mapped.sku || '').trim();
        let sku = manualSku;
        if (strategy === 'CREATE_NEW' && manualSku) {
          const skuCheck = await client.query('SELECT 1 FROM products WHERE tenant_id = $1 AND sku = $2', [tenantId, manualSku]);
          if (skuCheck.rows.length > 0) {
            sku = `${manualSku}-${Date.now().toString(36).slice(-4)}`;
          }
        } else if (!sku) {
          sku = `PRD-${name.slice(0, 3).toUpperCase().replace(/[^A-Z]/g, 'X')}-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 5).toUpperCase()}`;
        }

        if (!name) {
          failedCount++;
          errors.push({ row: rowNum, error: 'Empty product name' });
          continue;
        }

        await client.query('SAVEPOINT row_sp');
        try {
          // Resolve or create menu category
          let categoryId: string;
          const catRes = await client.query(
            `SELECT id FROM categories WHERE tenant_id = $1 AND LOWER(TRIM(name)) = LOWER($2)`,
            [tenantId, categoryName]
          );
          if (catRes.rows.length > 0) {
            categoryId = catRes.rows[0].id;
          } else {
            const newCatRes = await client.query(
              `INSERT INTO categories (tenant_id, name, is_active) VALUES ($1, $2, true) RETURNING id`,
              [tenantId, categoryName]
            );
            categoryId = newCatRes.rows[0].id;
          }

          const existingRes = await client.query(
            `SELECT id FROM products WHERE tenant_id = $1 AND (LOWER(TRIM(name)) = LOWER($2) OR (sku IS NOT NULL AND LOWER(TRIM(sku)) = LOWER($3)))`,
            [tenantId, name, manualSku || '']
          );

          if (existingRes.rows.length > 0) {
            if (strategy === 'SKIP_DUPLICATES') {
              await client.query('RELEASE SAVEPOINT row_sp');
              skippedCount++;
              continue;
            } else if (strategy === 'UPDATE_MATCHING') {
              await client.query(
                `UPDATE products SET base_price = $1, cost_price = $2, category_id = $3 WHERE id = $4`,
                [basePrice, costPrice, categoryId, existingRes.rows[0].id]
              );
              await client.query('RELEASE SAVEPOINT row_sp');
              updatedCount++;
              continue;
            }
          }

          await client.query(
            `
            INSERT INTO products (
              tenant_id, category_id, name, sku, base_price, cost_price, is_available, track_inventory
            ) VALUES ($1, $2, $3, $4, $5, $6, true, true)
            `,
            [tenantId, categoryId, name, sku, basePrice, costPrice]
          );

          await client.query('RELEASE SAVEPOINT row_sp');
          successCount++;
        } catch (prodErr: any) {
          await client.query('ROLLBACK TO SAVEPOINT row_sp');
          failedCount++;
          errors.push({ row: rowNum, error: prodErr.message });
        }
      }
    }

    // -------------------------------------------------------------
    // ENTITY: SUPPLIERS
    // -------------------------------------------------------------
    else if (entityType === 'SUPPLIERS') {
      for (let idx = 0; idx < rawRows.length; idx++) {
        const rowNum = idx + 1;
        const mapped = applyColumnMapping(rawRows[idx], columnMapping);
        const name = String(mapped.name || '').trim();
        const contactPerson = String(mapped.contactPerson || '').trim() || null;
        const phone = String(mapped.phone || '').trim() || null;
        const email = String(mapped.email || '').trim() || null;
        const address = String(mapped.address || '').trim() || null;
        const openingBalance = Math.max(0, parseFloat(mapped.openingBalance) || 0);

        if (!name) {
          failedCount++;
          errors.push({ row: rowNum, error: 'Empty supplier name' });
          continue;
        }

        try {
          const checkRes = await client.query(
            `SELECT id FROM suppliers WHERE tenant_id = $1 AND LOWER(TRIM(name)) = LOWER($2)`,
            [tenantId, name]
          );

          if (checkRes.rows.length > 0) {
            if (strategy === 'SKIP_DUPLICATES') {
              skippedCount++;
              continue;
            } else if (strategy === 'UPDATE_MATCHING') {
              await client.query(
                `UPDATE suppliers SET phone = COALESCE($1, phone), address = COALESCE($2, address) WHERE id = $3`,
                [phone, address, checkRes.rows[0].id]
              );
              updatedCount++;
              continue;
            }
          }

          await client.query(
            `
            INSERT INTO suppliers (
              tenant_id, name, contact_person, phone, email, address, balance_payable, is_active
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, true)
            `,
            [tenantId, name, contactPerson, phone, email, address, openingBalance]
          );
          successCount++;
        } catch (suppErr: any) {
          failedCount++;
          errors.push({ row: rowNum, error: suppErr.message });
        }
      }
    }

    // -------------------------------------------------------------
    // ENTITY: CUSTOMERS
    // -------------------------------------------------------------
    else if (entityType === 'CUSTOMERS') {
      for (let idx = 0; idx < rawRows.length; idx++) {
        const rowNum = idx + 1;
        const mapped = applyColumnMapping(rawRows[idx], columnMapping);
        const name = String(mapped.name || '').trim();
        const phone = String(mapped.phone || '').trim() || null;
        const email = String(mapped.email || '').trim() || null;
        const address = String(mapped.address || '').trim() || null;
        const notes = String(mapped.notes || '').trim() || null;

        if (!name) {
          failedCount++;
          errors.push({ row: rowNum, error: 'Empty customer name' });
          continue;
        }

        try {
          if (phone) {
            const checkRes = await client.query(
              `SELECT id FROM customers WHERE tenant_id = $1 AND phone = $2`,
              [tenantId, phone]
            );
            if (checkRes.rows.length > 0) {
              if (strategy === 'SKIP_DUPLICATES') {
                skippedCount++;
                continue;
              } else if (strategy === 'UPDATE_MATCHING') {
                await client.query(
                  `UPDATE customers SET name = $1, email = COALESCE($2, email), address = COALESCE($3, address) WHERE id = $4`,
                  [name, email, address, checkRes.rows[0].id]
                );
                updatedCount++;
                continue;
              }
            }
          }

          await client.query(
            `
            INSERT INTO customers (tenant_id, name, phone, email, address, notes)
            VALUES ($1, $2, $3, $4, $5, $6)
            `,
            [tenantId, name, phone, email, address, notes]
          );
          successCount++;
        } catch (custErr: any) {
          failedCount++;
          errors.push({ row: rowNum, error: custErr.message });
        }
      }
    }

    return { successCount, updatedCount, skippedCount, failedCount };
  }, { tenantId });

  const totalProcessed = rawRows.length;
  const overallStatus =
    failedCount === 0 ? 'SUCCESS' : successCount > 0 ? 'PARTIAL' : 'FAILED';

  // Record into import_history
  const { rows: historyRows } = await query(
    `
    INSERT INTO import_history (
      tenant_id, file_name, file_format, entity_type, strategy, total_records,
      success_count, failed_count, skipped_count, updated_count, status, errors_log,
      summary, imported_by_user_id
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
    RETURNING id
    `,
    [
      tenantId,
      fileName,
      fileFormat,
      entityType,
      strategy,
      totalProcessed,
      successCount,
      failedCount,
      skippedCount,
      updatedCount,
      overallStatus,
      JSON.stringify(errors.slice(0, 50)),
      JSON.stringify({
        completedAt: new Date().toISOString(),
        entityType,
      }),
      userId,
    ],
    { tenantId }
  );

  await logAuditEvent({
    tenantId,
    actorId: userId,
    actorRole: 'RESTAURANT_OWNER',
    action: 'PREVIOUS_SOFTWARE_DATA_IMPORTED',
    resourceType: 'IMPORT',
    metadata: {
      fileName,
      entityType,
      strategy,
      totalProcessed,
      successCount,
      updatedCount,
      failedCount,
    },
  });

  return {
    importId: historyRows[0]?.id || '',
    totalProcessed,
    successCount,
    updatedCount,
    skippedCount,
    failedCount,
    errors,
    status: overallStatus,
    summary: {
      entityType,
      strategy,
      fileName,
    },
  };
}

/**
 * Fetch past import history for a restaurant
 */
export async function getImportHistory(tenantId: string) {
  const { rows } = await query(
    `
    SELECT ih.*, u.full_name as imported_by_name, u.email as imported_by_email
    FROM import_history ih
    LEFT JOIN users u ON u.id = ih.imported_by_user_id
    WHERE ih.tenant_id = $1
    ORDER BY ih.created_at DESC
    LIMIT 100
    `,
    [tenantId],
    { tenantId }
  );
  return rows;
}
