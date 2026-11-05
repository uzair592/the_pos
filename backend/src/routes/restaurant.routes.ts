import { FastifyInstance } from 'fastify';
import bcrypt from 'bcryptjs';
import { query, withTransaction } from '../db/connection.js';
import { authenticate, requireTenant, requirePermission } from '../middleware/auth.js';
import {
  OnboardingSchema,
  CreateBranchSchema,
  CreateUserSchema,
  UpdateUserSchema,
  CreateFloorSchema,
  CreateTableSchema,
  Permission,
  SystemRole,
  DEFAULT_ROLE_PERMISSIONS,
} from '@pos/shared';
import { checkBranchLimit, checkStaffLimit } from '../services/subscriptionService.js';
import { generateTenantBackup, restoreTenantBackup, getBackupHistory } from '../services/backupService.js';
import { logAuditEvent } from '../services/auditService.js';

export async function restaurantRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', authenticate);
  fastify.addHook('preHandler', requireTenant);

  /**
   * Complete Onboarding Wizard
   */
  fastify.post('/api/restaurant/onboarding', async (req, reply) => {
    const parsed = OnboardingSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.format() });
    }

    const tenantId = req.user!.tenantId!;
    const {
      legalName,
      phone,
      address,
      city,
      currency,
      currencySymbol,
      timeZone,
      taxRatePercent,
      taxRegistrationNumber,
      isTaxInclusive,
      serviceChargePercent,
      initialBranchName,
      receiptSettings,
    } = parsed.data;

    await withTransaction(async (client) => {
      // 1. Update Tenant Info
      await client.query(
        `
        UPDATE tenants
        SET legal_name = COALESCE($1, legal_name),
            phone = $2, address = $3, city = $4,
            currency = $5, time_zone = $6, is_onboarded = true,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $7
        `,
        [legalName || null, phone, address, city, currency, timeZone, tenantId]
      );

      // 2. Update Settings
      await client.query(
        `
        INSERT INTO restaurant_settings (
          tenant_id, currency, currency_symbol, time_zone, tax_rate_percent,
          tax_registration_number, is_tax_inclusive, service_charge_percent, receipt_settings
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        ON CONFLICT (tenant_id) DO UPDATE SET
          currency = EXCLUDED.currency,
          currency_symbol = EXCLUDED.currency_symbol,
          time_zone = EXCLUDED.time_zone,
          tax_rate_percent = EXCLUDED.tax_rate_percent,
          tax_registration_number = EXCLUDED.tax_registration_number,
          is_tax_inclusive = EXCLUDED.is_tax_inclusive,
          service_charge_percent = EXCLUDED.service_charge_percent,
          receipt_settings = EXCLUDED.receipt_settings,
          updated_at = CURRENT_TIMESTAMP
        `,
        [
          tenantId, currency, currencySymbol, timeZone, taxRatePercent,
          taxRegistrationNumber || null, isTaxInclusive, serviceChargePercent,
          JSON.stringify(receiptSettings || {}),
        ]
      );

      // 3. Update or ensure branch
      const branchRes = await client.query('SELECT id FROM branches WHERE tenant_id = $1 LIMIT 1', [tenantId]);
      if (branchRes.rows.length === 0) {
        await client.query(
          `
          INSERT INTO branches (tenant_id, name, code, phone, address, city, is_main_branch, is_active)
          VALUES ($1, $2, 'MAIN', $3, $4, $5, true, true)
          `,
          [tenantId, initialBranchName, phone, address, city]
        );
      } else {
        await client.query(
          'UPDATE branches SET name = $1, phone = $2, address = $3, city = $4 WHERE id = $5 AND tenant_id = $6',
          [initialBranchName, phone, address, city, branchRes.rows[0].id, tenantId]
        );
      }
    }, { tenantId });

    return reply.send({ message: 'Onboarding completed successfully' });
  });

  /**
   * Restaurant Profile & Settings
   */
  fastify.get('/api/restaurant/settings', async (req, reply) => {
    const tenantId = req.user!.tenantId!;
    const { rows } = await query(
      `
      SELECT t.id, t.name, t.legal_name, t.owner_name, t.email, t.phone, t.address, t.city,
             t.country, t.currency, t.time_zone, t.business_type, t.logo_url, t.is_onboarded,
             rs.currency_symbol, rs.tax_rate_percent, rs.tax_registration_number,
             rs.is_tax_inclusive, rs.service_charge_percent, rs.stock_deduction_trigger,
             rs.allow_negative_inventory, rs.order_number_prefix, rs.kot_number_prefix,
             rs.receipt_settings
      FROM tenants t
      LEFT JOIN restaurant_settings rs ON rs.tenant_id = t.id
      WHERE t.id = $1
      `,
      [tenantId],
      { tenantId }
    );

    return reply.send({ settings: rows[0] });
  });

  fastify.put('/api/restaurant/settings', {
    preHandler: [requirePermission(Permission.SETTINGS_MANAGE)],
  }, async (req, reply) => {
    const tenantId = req.user!.tenantId!;
    const body = req.body as any;

    await withTransaction(async (client) => {
      if (body.name || body.logoUrl || body.phone) {
        await client.query(
          `
          UPDATE tenants
          SET name = COALESCE($1, name),
              legal_name = COALESCE($2, legal_name),
              phone = COALESCE($3, phone),
              logo_url = COALESCE($4, logo_url),
              updated_at = CURRENT_TIMESTAMP
          WHERE id = $5
          `,
          [body.name, body.legalName, body.phone, body.logoUrl, tenantId]
        );
      }

      await client.query(
        `
        UPDATE restaurant_settings
        SET currency = COALESCE($1, currency),
            currency_symbol = COALESCE($2, currency_symbol),
            time_zone = COALESCE($3, time_zone),
            tax_rate_percent = COALESCE($4, tax_rate_percent),
            tax_registration_number = COALESCE($5, tax_registration_number),
            is_tax_inclusive = COALESCE($6, is_tax_inclusive),
            service_charge_percent = COALESCE($7, service_charge_percent),
            receipt_settings = COALESCE($8, receipt_settings),
            updated_at = CURRENT_TIMESTAMP
        WHERE tenant_id = $9
        `,
        [
          body.currency,
          body.currencySymbol,
          body.timeZone,
          body.taxRatePercent,
          body.taxRegistrationNumber,
          body.isTaxInclusive,
          body.serviceChargePercent,
          body.receiptSettings ? JSON.stringify(body.receiptSettings) : null,
          tenantId,
        ]
      );
    }, { tenantId });

    return reply.send({ message: 'Settings updated successfully' });
  });

  /**
   * Branches Management
   */
  fastify.get('/api/restaurant/branches', async (req, reply) => {
    const tenantId = req.user!.tenantId!;
    const { rows } = await query(
      'SELECT * FROM branches WHERE tenant_id = $1 ORDER BY is_main_branch DESC, name ASC',
      [tenantId],
      { tenantId }
    );
    return reply.send({ branches: rows });
  });

  fastify.post('/api/restaurant/branches', {
    preHandler: [requirePermission(Permission.BRANCHES_MANAGE)],
  }, async (req, reply) => {
    const parsed = CreateBranchSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.format() });
    }

    const tenantId = req.user!.tenantId!;

    // Enforce Plan Branch Limit!
    const limitCheck = await checkBranchLimit(tenantId);
    if (!limitCheck.allowed) {
      return reply.status(403).send({ error: limitCheck.message, code: 'BRANCH_LIMIT_REACHED' });
    }

    const { name, code, phone, email, address, city, state, isMainBranch } = parsed.data;

    const { rows } = await query(
      `
      INSERT INTO branches (tenant_id, name, code, phone, email, address, city, state, is_main_branch, is_active)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, true)
      RETURNING *
      `,
      [tenantId, name, code.toUpperCase(), phone, email || null, address, city, state || null, isMainBranch],
      { tenantId }
    );

    return reply.status(201).send({ branch: rows[0] });
  });

  fastify.put('/api/restaurant/branches/:id', {
    preHandler: [requirePermission(Permission.BRANCHES_MANAGE)],
  }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const tenantId = req.user!.tenantId!;
    const body = req.body as any;

    if (body.isMainBranch === true) {
      await query('UPDATE branches SET is_main_branch = false WHERE tenant_id = $1', [tenantId], { tenantId });
    }

    const { rows } = await query(
      `
      UPDATE branches
      SET name = COALESCE($1, name),
          code = COALESCE($2, code),
          phone = COALESCE($3, phone),
          email = COALESCE($4, email),
          address = COALESCE($5, address),
          city = COALESCE($6, city),
          is_main_branch = COALESCE($7, is_main_branch),
          is_active = COALESCE($8, is_active),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $9 AND tenant_id = $10
      RETURNING *
      `,
      [
        body.name,
        body.code ? body.code.toUpperCase() : null,
        body.phone,
        body.email,
        body.address,
        body.city,
        body.isMainBranch !== undefined ? body.isMainBranch : null,
        body.isActive !== undefined ? body.isActive : null,
        id,
        tenantId,
      ],
      { tenantId }
    );

    if (rows.length === 0) return reply.status(404).send({ error: 'Branch not found' });
    return reply.send({ branch: rows[0] });
  });

  fastify.delete('/api/restaurant/branches/:id', {
    preHandler: [requirePermission(Permission.BRANCHES_MANAGE)],
  }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const tenantId = req.user!.tenantId!;

    const { rows } = await query('SELECT is_main_branch FROM branches WHERE id = $1 AND tenant_id = $2', [id, tenantId], { tenantId });
    if (rows.length === 0) return reply.status(404).send({ error: 'Branch not found' });
    if (rows[0].is_main_branch) {
      return reply.status(400).send({ error: 'Cannot delete the primary flagship branch. Please designate another branch as primary first.' });
    }

    try {
      await query('DELETE FROM branches WHERE id = $1 AND tenant_id = $2', [id, tenantId], { tenantId });
      return reply.send({ message: 'Branch deleted successfully' });
    } catch (err: any) {
      // Historical references exist - soft deactivate
      await query('UPDATE branches SET is_active = false WHERE id = $1 AND tenant_id = $2', [id, tenantId], { tenantId });
      return reply.send({ message: 'Branch deactivated due to existing historical transaction records' });
    }
  });

  /**
   * Staff / Users Management
   */
  fastify.get('/api/restaurant/users', {
    preHandler: [requirePermission(Permission.STAFF_MANAGE)],
  }, async (req, reply) => {
    const tenantId = req.user!.tenantId!;
    const { rows } = await query(
      `
      SELECT u.id, u.email, u.full_name, u.role, u.branch_id, u.is_active, u.custom_permissions, u.created_at,
             b.name as branch_name
      FROM users u
      LEFT JOIN branches b ON b.id = u.branch_id
      WHERE u.tenant_id = $1
      ORDER BY u.created_at ASC
      `,
      [tenantId],
      { tenantId }
    );
    return reply.send({ users: rows });
  });

  fastify.post('/api/restaurant/users', {
    preHandler: [requirePermission(Permission.STAFF_MANAGE)],
  }, async (req, reply) => {
    const parsed = CreateUserSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.format() });
    }

    const tenantId = req.user!.tenantId!;

    // Enforce Plan Staff Limit!
    const limitCheck = await checkStaffLimit(tenantId);
    if (!limitCheck.allowed) {
      return reply.status(403).send({ error: limitCheck.message, code: 'STAFF_LIMIT_REACHED' });
    }

    const { email, password, fullName, role, branchId, customPermissions } = parsed.data;

    // Check existing email in tenant
    const existing = await query('SELECT id FROM users WHERE tenant_id = $1 AND email = $2', [tenantId, email.toLowerCase().trim()], { tenantId });
    if (existing.rows.length > 0) {
      return reply.status(400).send({ error: 'A user with this email already exists in this restaurant' });
    }

    const perms = customPermissions || DEFAULT_ROLE_PERMISSIONS[role] || [];
    const passwordHash = await bcrypt.hash(password, 10);

    const { rows } = await query(
      `
      INSERT INTO users (tenant_id, branch_id, email, password_hash, full_name, role, custom_permissions, is_active)
      VALUES ($1, $2, $3, $4, $5, $6, $7, true)
      RETURNING id, email, full_name, role, branch_id, custom_permissions, is_active, created_at
      `,
      [tenantId, branchId || null, email.toLowerCase().trim(), passwordHash, fullName, role, JSON.stringify(perms)],
      { tenantId }
    );

    return reply.status(201).send({ user: rows[0] });
  });

  fastify.put('/api/restaurant/users/:id', {
    preHandler: [requirePermission(Permission.STAFF_MANAGE)],
  }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const tenantId = req.user!.tenantId!;
    const parsed = UpdateUserSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.format() });
    }

    const { fullName, email, password, role, branchId, isActive, customPermissions } = parsed.data;

    let updateSql = 'UPDATE users SET updated_at = CURRENT_TIMESTAMP';
    const params: any[] = [];

    if (fullName !== undefined) {
      params.push(fullName);
      updateSql += `, full_name = $${params.length}`;
    }
    if (email !== undefined) {
      const cleanEmail = email.toLowerCase().trim();
      const existing = await query(
        'SELECT id FROM users WHERE tenant_id = $1 AND email = $2 AND id != $3',
        [tenantId, cleanEmail, id],
        { tenantId }
      );
      if (existing.rows.length > 0) {
        return reply.status(400).send({ error: 'A user with this email/username already exists in this restaurant' });
      }
      params.push(cleanEmail);
      updateSql += `, email = $${params.length}`;
    }
    if (password !== undefined && password.trim().length > 0) {
      const hash = await bcrypt.hash(password, 10);
      params.push(hash);
      updateSql += `, password_hash = $${params.length}`;
    }
    if (role !== undefined) {
      params.push(role);
      updateSql += `, role = $${params.length}`;
    }
    if (branchId !== undefined) {
      params.push(branchId);
      updateSql += `, branch_id = $${params.length}`;
    }
    if (isActive !== undefined) {
      if (id === req.user!.id && isActive === false) {
        return reply.status(400).send({ error: 'You cannot deactivate your own active session account' });
      }
      params.push(isActive);
      updateSql += `, is_active = $${params.length}`;
    }
    if (customPermissions !== undefined) {
      params.push(JSON.stringify(customPermissions));
      updateSql += `, custom_permissions = $${params.length}`;
    }

    params.push(id, tenantId);
    updateSql += ` WHERE id = $${params.length - 1} AND tenant_id = $${params.length} RETURNING id, email, full_name, role, branch_id, is_active`;

    const { rows } = await query(updateSql, params, { tenantId });
    if (rows.length === 0) return reply.status(404).send({ error: 'User not found' });
    return reply.send({ user: rows[0] });
  });

  fastify.delete('/api/restaurant/users/:id', {
    preHandler: [requirePermission(Permission.STAFF_MANAGE)],
  }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const tenantId = req.user!.tenantId!;

    if (id === req.user!.id) {
      return reply.status(400).send({ error: 'You cannot deactivate your own active session account' });
    }

    const existing = await query('SELECT id, role FROM users WHERE id = $1 AND tenant_id = $2', [id, tenantId], { tenantId });
    if (existing.rows.length === 0) return reply.status(404).send({ error: 'User not found' });

    if (existing.rows[0].role === SystemRole.RESTAURANT_OWNER) {
      return reply.status(403).send({ error: 'Restaurant Owner account cannot be removed' });
    }

    await query('UPDATE users SET is_active = false, updated_at = CURRENT_TIMESTAMP WHERE id = $1 AND tenant_id = $2', [id, tenantId], { tenantId });
    return reply.send({ success: true, message: 'Employee deactivated successfully' });
  });

  /**
   * Floors & Tables Management
   */
  fastify.get('/api/restaurant/floors', async (req, reply) => {
    const tenantId = req.user!.tenantId!;
    const { branchId } = req.query as { branchId?: string };

    let sql = 'SELECT * FROM floors WHERE tenant_id = $1';
    const params: any[] = [tenantId];
    if (branchId) {
      params.push(branchId);
      sql += ` AND branch_id = $2`;
    }
    sql += ' ORDER BY sort_order ASC, name ASC';

    const { rows } = await query(sql, params, { tenantId });
    return reply.send({ floors: rows });
  });

  fastify.post('/api/restaurant/floors', {
    preHandler: [requirePermission(Permission.TABLES_MANAGE)],
  }, async (req, reply) => {
    const parsed = CreateFloorSchema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.format() });

    const tenantId = req.user!.tenantId!;
    const { branchId, name, sortOrder } = parsed.data;

    const { rows } = await query(
      'INSERT INTO floors (tenant_id, branch_id, name, sort_order) VALUES ($1, $2, $3, $4) RETURNING *',
      [tenantId, branchId, name, sortOrder],
      { tenantId }
    );
    return reply.status(201).send({ floor: rows[0] });
  });

  fastify.get('/api/restaurant/tables', async (req, reply) => {
    const tenantId = req.user!.tenantId!;
    const { branchId, floorId } = req.query as { branchId?: string; floorId?: string };

    let sql = `
      SELECT t.*, f.name as floor_name
      FROM restaurant_tables t
      JOIN floors f ON f.id = t.floor_id
      WHERE t.tenant_id = $1 AND t.is_active = true
    `;
    const params: any[] = [tenantId];

    if (branchId) {
      params.push(branchId);
      sql += ` AND t.branch_id = $${params.length}`;
    }
    if (floorId) {
      params.push(floorId);
      sql += ` AND t.floor_id = $${params.length}`;
    }

    sql += ' ORDER BY t.table_number ASC';

    const { rows } = await query(sql, params, { tenantId });
    return reply.send({ tables: rows });
  });

  fastify.post('/api/restaurant/tables', {
    preHandler: [requirePermission(Permission.TABLES_MANAGE)],
  }, async (req, reply) => {
    const parsed = CreateTableSchema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.format() });

    const tenantId = req.user!.tenantId!;
    const { branchId, floorId, tableNumber, capacity } = parsed.data;

    const { rows } = await query(
      `
      INSERT INTO restaurant_tables (tenant_id, branch_id, floor_id, table_number, capacity, status, is_active)
      VALUES ($1, $2, $3, $4, $5, 'AVAILABLE', true)
      RETURNING *
      `,
      [tenantId, branchId, floorId, tableNumber, capacity],
      { tenantId }
    );
    return reply.status(201).send({ table: rows[0] });
  });

  fastify.put('/api/restaurant/tables/:id', {
    preHandler: [requirePermission(Permission.TABLES_MANAGE)],
  }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const tenantId = req.user!.tenantId!;
    const { status, tableNumber, capacity, currentOrderId } = req.body as any;

    const { rows } = await query(
      `
      UPDATE restaurant_tables
      SET status = COALESCE($1, status),
          table_number = COALESCE($2, table_number),
          capacity = COALESCE($3, capacity),
          current_order_id = COALESCE($4, current_order_id)
      WHERE id = $5 AND tenant_id = $6
      RETURNING *
      `,
      [status, tableNumber, capacity, currentOrderId, id, tenantId],
      { tenantId }
    );

    if (rows.length === 0) return reply.status(404).send({ error: 'Table not found' });
    return reply.send({ table: rows[0] });
  });

  /**
   * Device Management
   */
  fastify.get('/api/restaurant/devices', async (req, reply) => {
    const tenantId = req.user!.tenantId!;
    const { rows } = await query(
      `
      SELECT d.*, b.name as branch_name
      FROM registered_devices d
      JOIN branches b ON b.id = d.branch_id
      WHERE d.tenant_id = $1
      ORDER BY d.last_active_at DESC
      `,
      [tenantId],
      { tenantId }
    );
    return reply.send({ devices: rows });
  });

  fastify.put('/api/restaurant/devices/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const tenantId = req.user!.tenantId!;
    const { isActive, defaultWorkspace, deviceName } = req.body as any;

    const { rows } = await query(
      `
      UPDATE registered_devices
      SET is_active = COALESCE($1, is_active),
          default_workspace = COALESCE($2, default_workspace),
          device_name = COALESCE($3, device_name),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $4 AND tenant_id = $5
      RETURNING *
      `,
      [isActive !== undefined ? isActive : null, defaultWorkspace || null, deviceName || null, id, tenantId],
      { tenantId }
    );

    if (rows.length === 0) return reply.status(404).send({ error: 'Device not found' });
    return reply.send({ device: rows[0], message: 'Device status updated' });
  });

  fastify.delete('/api/restaurant/devices/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const tenantId = req.user!.tenantId!;

    await query('DELETE FROM registered_devices WHERE id = $1 AND tenant_id = $2', [id, tenantId], { tenantId });
    return reply.send({ message: 'Device removed successfully' });
  });

  /**
   * Backup & Restore Endpoints for Tenant
   */
  fastify.post('/api/restaurant/backups/generate', async (req, reply) => {
    const tenantId = req.user!.tenantId!;
    try {
      const result = await generateTenantBackup(tenantId, req.user!.id, req.user!.fullName);
      return reply.send(result);
    } catch (err: any) {
      return reply.status(500).send({ error: err.message || 'Failed to generate backup' });
    }
  });

  fastify.post('/api/restaurant/backups/restore', async (req, reply) => {
    const tenantId = req.user!.tenantId!;
    const backupPackage = req.body as any;

    if (!backupPackage || !backupPackage.metadata || !backupPackage.data) {
      return reply.status(400).send({ error: 'Invalid backup package payload' });
    }

    try {
      const result = await restoreTenantBackup(
        tenantId,
        backupPackage,
        req.user!.id,
        (req.user as any)?.fullName || 'Restaurant Staff'
      );
      return reply.send(result);
    } catch (err: any) {
      return reply.status(400).send({ error: err.message || 'Failed to restore backup' });
    }
  });

  fastify.get('/api/restaurant/backups', async (req, reply) => {
    const tenantId = req.user!.tenantId!;
    const history = await getBackupHistory(tenantId);
    return reply.send({ backups: history });
  });
}
