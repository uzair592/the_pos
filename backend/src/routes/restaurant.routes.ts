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
  UpdateFloorSchema,
  CreateTableSchema,
  UpdateTableSchema,
  UpdateTableLayoutSchema,
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
    let { branchId, name, sortOrder } = parsed.data;

    if (!branchId) {
      if (req.user?.branchId) {
        branchId = req.user.branchId;
      } else {
        const bRes = await query(
          'SELECT id FROM branches WHERE tenant_id = $1 ORDER BY is_main_branch DESC, created_at ASC LIMIT 1',
          [tenantId],
          { tenantId }
        );
        if (bRes.rows.length > 0) {
          branchId = bRes.rows[0].id;
        } else {
          const newB = await query(
            `INSERT INTO branches (tenant_id, name, code, phone, address, city, is_main_branch, is_active)
             VALUES ($1, 'Main Branch', 'MAIN', '0000000000', 'Main Location', 'Karachi', true, true)
             RETURNING id`,
            [tenantId],
            { tenantId }
          );
          branchId = newB.rows[0].id;
        }
      }
    }

    const { rows } = await query(
      'INSERT INTO floors (tenant_id, branch_id, name, sort_order) VALUES ($1, $2, $3, $4) RETURNING *',
      [tenantId, branchId, name, sortOrder],
      { tenantId }
    );
    return reply.status(201).send({ floor: rows[0] });
  });

  fastify.put('/api/restaurant/floors/:id', {
    preHandler: [requirePermission(Permission.TABLES_MANAGE)],
  }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const tenantId = req.user!.tenantId!;
    const parsed = UpdateFloorSchema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.format() });

    const { name, sortOrder, isActive } = parsed.data;
    const { rows } = await query(
      `UPDATE floors
       SET name = COALESCE($1, name),
           sort_order = COALESCE($2, sort_order),
           is_active = COALESCE($3, is_active),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $4 AND tenant_id = $5
       RETURNING *`,
      [name || null, sortOrder !== undefined ? sortOrder : null, isActive !== undefined ? isActive : null, id, tenantId],
      { tenantId }
    );
    if (rows.length === 0) return reply.status(404).send({ error: 'Floor not found' });
    return reply.send({ floor: rows[0] });
  });

  fastify.delete('/api/restaurant/floors/:id', {
    preHandler: [requirePermission(Permission.TABLES_MANAGE)],
  }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const tenantId = req.user!.tenantId!;

    const tableCheck = await query(
      'SELECT COUNT(*)::int as count FROM restaurant_tables WHERE floor_id = $1 AND tenant_id = $2 AND is_active = true',
      [id, tenantId],
      { tenantId }
    );
    if ((tableCheck.rows[0]?.count || 0) > 0) {
      return reply.status(400).send({ error: 'Cannot delete floor that contains active tables. Move or delete tables first.' });
    }

    await query('DELETE FROM floors WHERE id = $1 AND tenant_id = $2', [id, tenantId], { tenantId });
    return reply.send({ success: true, message: 'Floor deleted successfully' });
  });

  fastify.get('/api/restaurant/tables', async (req, reply) => {
    const tenantId = req.user!.tenantId!;
    const { branchId, floorId } = req.query as { branchId?: string; floorId?: string };

    let sql = `
      SELECT t.*,
             f.name as floor_name,
             o.order_number as current_order_number,
             o.grand_total as current_order_amount,
             o.created_at as current_order_time,
             (SELECT COUNT(*)::int FROM reservations r WHERE r.table_id = t.id AND r.status IN ('CONFIRMED', 'PENDING') AND r.reservation_date = CURRENT_DATE) as today_reservations_count
      FROM restaurant_tables t
      LEFT JOIN floors f ON f.id = t.floor_id
      LEFT JOIN orders o ON o.id = t.current_order_id
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
    let { branchId, floorId, floorName, tableNumber, capacity, shape, posX, posY, assignedWaiterId, assignedWaiterName } = parsed.data;

    if (!branchId) {
      if (req.user?.branchId) {
        branchId = req.user.branchId;
      } else {
        const bRes = await query(
          'SELECT id FROM branches WHERE tenant_id = $1 ORDER BY is_main_branch DESC, created_at ASC LIMIT 1',
          [tenantId],
          { tenantId }
        );
        if (bRes.rows.length > 0) {
          branchId = bRes.rows[0].id;
        } else {
          const newB = await query(
            `INSERT INTO branches (tenant_id, name, code, phone, address, city, is_main_branch, is_active)
             VALUES ($1, 'Main Branch', 'MAIN', '0000000000', 'Main Location', 'Karachi', true, true)
             RETURNING id`,
            [tenantId],
            { tenantId }
          );
          branchId = newB.rows[0].id;
        }
      }
    }

    let resolvedFloorId = floorId;
    if (floorName && floorName.trim()) {
      // Find or create floor with this name for this branch
      const floorCheck = await query(
        'SELECT id FROM floors WHERE tenant_id = $1 AND branch_id = $2 AND LOWER(name) = LOWER($3)',
        [tenantId, branchId, floorName.trim()],
        { tenantId }
      );
      if (floorCheck.rows.length > 0) {
        resolvedFloorId = floorCheck.rows[0].id;
      } else {
        const newFloor = await query(
          'INSERT INTO floors (tenant_id, branch_id, name, sort_order) VALUES ($1, $2, $3, 0) RETURNING id',
          [tenantId, branchId, floorName.trim()],
          { tenantId }
        );
        resolvedFloorId = newFloor.rows[0].id;
      }
    } else if (!resolvedFloorId) {
      // If neither floorId nor floorName is provided, default to first existing floor or auto-create default
      const anyFloor = await query(
        'SELECT id FROM floors WHERE tenant_id = $1 AND branch_id = $2 ORDER BY sort_order ASC, name ASC LIMIT 1',
        [tenantId, branchId],
        { tenantId }
      );
      if (anyFloor.rows.length > 0) {
        resolvedFloorId = anyFloor.rows[0].id;
      } else {
        const defaultFloor = await query(
          'INSERT INTO floors (tenant_id, branch_id, name, sort_order) VALUES ($1, $2, $3, 0) RETURNING id',
          [tenantId, branchId, 'Main Dining Area'],
          { tenantId }
        );
        resolvedFloorId = defaultFloor.rows[0].id;
      }
    }

    const { rows } = await query(
      `
      INSERT INTO restaurant_tables (
        tenant_id, branch_id, floor_id, table_number, capacity,
        shape, pos_x, pos_y, assigned_waiter_id, assigned_waiter_name,
        status, is_active
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'AVAILABLE', true)
      RETURNING *
      `,
      [
        tenantId,
        branchId,
        resolvedFloorId,
        tableNumber,
        capacity,
        shape || 'RECTANGLE',
        posX || 0,
        posY || 0,
        assignedWaiterId || null,
        assignedWaiterName || null,
      ],
      { tenantId }
    );
    return reply.status(201).send({ table: rows[0] });
  });

  fastify.put('/api/restaurant/tables/:id', {
    preHandler: [requirePermission(Permission.TABLES_MANAGE)],
  }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const tenantId = req.user!.tenantId!;

    const parsed = UpdateTableSchema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.format() });

    const {
      floorId,
      tableNumber,
      capacity,
      status,
      shape,
      posX,
      posY,
      assignedWaiterId,
      assignedWaiterName,
      currentOrderId,
      isActive,
    } = parsed.data;

    const { rows } = await query(
      `
      UPDATE restaurant_tables
      SET floor_id = COALESCE($1, floor_id),
          table_number = COALESCE($2, table_number),
          capacity = COALESCE($3, capacity),
          status = COALESCE($4, status),
          shape = COALESCE($5, shape),
          pos_x = COALESCE($6, pos_x),
          pos_y = COALESCE($7, pos_y),
          assigned_waiter_id = COALESCE($8, assigned_waiter_id),
          assigned_waiter_name = COALESCE($9, assigned_waiter_name),
          current_order_id = COALESCE($10, current_order_id),
          is_active = COALESCE($11, is_active),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $12 AND tenant_id = $13
      RETURNING *
      `,
      [
        floorId || null,
        tableNumber || null,
        capacity || null,
        status || null,
        shape || null,
        posX !== undefined ? posX : null,
        posY !== undefined ? posY : null,
        assignedWaiterId !== undefined ? assignedWaiterId : null,
        assignedWaiterName !== undefined ? assignedWaiterName : null,
        currentOrderId !== undefined ? currentOrderId : null,
        isActive !== undefined ? isActive : null,
        id,
        tenantId,
      ],
      { tenantId }
    );

    if (rows.length === 0) return reply.status(404).send({ error: 'Table not found' });
    return reply.send({ table: rows[0] });
  });

  fastify.delete('/api/restaurant/tables/:id', {
    preHandler: [requirePermission(Permission.TABLES_MANAGE)],
  }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const tenantId = req.user!.tenantId!;

    const existing = await query(
      'SELECT status, current_order_id FROM restaurant_tables WHERE id = $1 AND tenant_id = $2',
      [id, tenantId],
      { tenantId }
    );
    if (existing.rows.length === 0) return reply.status(404).send({ error: 'Table not found' });
    if (existing.rows[0].status === 'OCCUPIED' || existing.rows[0].current_order_id) {
      return reply.status(400).send({ error: 'Cannot delete an occupied table with active order. Settle or cancel order first.' });
    }

    await query(
      'UPDATE restaurant_tables SET is_active = false, updated_at = CURRENT_TIMESTAMP WHERE id = $1 AND tenant_id = $2',
      [id, tenantId],
      { tenantId }
    );

    return reply.send({ success: true, message: 'Table removed successfully' });
  });

  fastify.put('/api/restaurant/tables/layout', {
    preHandler: [requirePermission(Permission.TABLES_MANAGE)],
  }, async (req, reply) => {
    const parsed = UpdateTableLayoutSchema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.format() });

    const tenantId = req.user!.tenantId!;
    const { tables } = parsed.data;

    await withTransaction(async (client) => {
      for (const t of tables) {
        await client.query(
          `UPDATE restaurant_tables
           SET pos_x = $1, pos_y = $2, shape = COALESCE($3, shape), updated_at = CURRENT_TIMESTAMP
           WHERE id = $4 AND tenant_id = $5`,
          [t.posX, t.posY, t.shape || null, t.id, tenantId]
        );
      }
    }, { tenantId });

    return reply.send({ success: true, message: 'Table layout coordinates saved successfully' });
  });

  /**
   * Real-Time Sidebar Badges Endpoint
   */
  fastify.get('/api/restaurant/sidebar-badges', async (req, reply) => {
    const tenantId = req.user!.tenantId!;
    const { branchId } = req.query as { branchId?: string };

    const branchParam = branchId ? 'AND branch_id = $2' : '';
    const params: any[] = [tenantId];
    if (branchId) params.push(branchId);

    // 1. Active Orders Count
    const activeOrdersRes = await query(
      `SELECT COUNT(*)::int as count FROM orders WHERE tenant_id = $1 ${branchParam} AND status IN ('NEW', 'PENDING', 'QUEUED', 'CONFIRMED', 'ACCEPTED', 'PREPARING', 'READY', 'SERVED', 'OUT_FOR_DELIVERY', 'ON_HOLD')`,
      params,
      { tenantId }
    );

    // 2. Pending Kitchen Tickets Count
    const pendingKtsRes = await query(
      `SELECT COUNT(*)::int as count FROM kitchen_tickets WHERE tenant_id = $1 ${branchParam} AND status IN ('PENDING', 'ACCEPTED', 'PREPARING')`,
      params,
      { tenantId }
    );

    // 3. Low Stock Ingredients Count
    const lowStockRes = await query(
      `SELECT COUNT(DISTINCT i.id)::int as count
       FROM ingredients i
       JOIN branch_stocks bs ON bs.ingredient_id = i.id ${branchId ? 'AND bs.branch_id = $2' : ''}
       WHERE i.tenant_id = $1 AND i.is_active = true AND bs.current_stock <= i.min_stock_alert`,
      params,
      { tenantId }
    );

    // 4. Pending / Today Reservations Count
    const reservationsRes = await query(
      `SELECT COUNT(*)::int as count FROM reservations WHERE tenant_id = $1 ${branchParam} AND status IN ('CONFIRMED', 'PENDING') AND reservation_date = CURRENT_DATE`,
      params,
      { tenantId }
    );

    // 5. Active Waitlist Count
    const waitlistRes = await query(
      `SELECT COUNT(*)::int as count FROM waitlist WHERE tenant_id = $1 ${branchParam} AND status IN ('WAITING', 'NOTIFIED')`,
      params,
      { tenantId }
    );

    return reply.send({
      badges: {
        activeOrders: activeOrdersRes.rows[0]?.count || 0,
        pendingKitchen: pendingKtsRes.rows[0]?.count || 0,
        lowStock: lowStockRes.rows[0]?.count || 0,
        pendingReservations: reservationsRes.rows[0]?.count || 0,
        waitlistCount: waitlistRes.rows[0]?.count || 0,
      },
    });
  });

  /**
   * Unified Global Search (Ctrl + K)
   * Searches orders, menu products, ingredients, customers, and suppliers in real-time
   */
  fastify.get('/api/restaurant/global-search', async (req, reply) => {
    const tenantId = req.user!.tenantId!;
    const { q, branchId } = req.query as { q?: string; branchId?: string };

    if (!q || q.trim().length < 2) {
      return reply.send({ results: { orders: [], products: [], ingredients: [], customers: [], suppliers: [] } });
    }

    const searchTerm = `%${q.trim()}%`;

    const [ordersRes, prodsRes, ingsRes, custsRes, suppsRes] = await Promise.all([
      // 1. Orders
      query(
        `SELECT id, order_number, customer_name, customer_phone, grand_total, status, order_type, created_at
         FROM orders
         WHERE tenant_id = $1 AND (order_number ILIKE $2 OR customer_name ILIKE $2 OR customer_phone ILIKE $2)
         ORDER BY created_at DESC LIMIT 5`,
        [tenantId, searchTerm],
        { tenantId }
      ),
      // 2. Menu Products
      query(
        `SELECT p.id, p.name, p.sku, p.base_price, c.name as category_name
         FROM products p
         LEFT JOIN categories c ON c.id = p.category_id
         WHERE p.tenant_id = $1 AND p.is_active = true AND (p.name ILIKE $2 OR p.sku ILIKE $2)
         ORDER BY p.name ASC LIMIT 5`,
        [tenantId, searchTerm],
        { tenantId }
      ),
      // 3. Ingredients & Stock
      query(
        `SELECT i.id, i.name, i.sku, i.base_unit, i.purchase_unit, i.purchase_cost,
                COALESCE(bs.current_stock, 0) as current_stock
         FROM ingredients i
         LEFT JOIN branch_stocks bs ON bs.ingredient_id = i.id ${branchId ? 'AND bs.branch_id = $3' : ''}
         WHERE i.tenant_id = $1 AND i.is_active = true AND (i.name ILIKE $2 OR i.sku ILIKE $2)
         ORDER BY i.name ASC LIMIT 5`,
        branchId ? [tenantId, searchTerm, branchId] : [tenantId, searchTerm],
        { tenantId }
      ),
      // 4. Customers
      query(
        `SELECT id, name, phone, email, outstanding_balance, total_orders
         FROM customers
         WHERE tenant_id = $1 AND is_active = true AND (name ILIKE $2 OR phone ILIKE $2 OR email ILIKE $2)
         ORDER BY total_spent DESC, name ASC LIMIT 5`,
        [tenantId, searchTerm],
        { tenantId }
      ),
      // 5. Suppliers
      query(
        `SELECT id, name, contact_person, phone, balance_payable
         FROM suppliers
         WHERE tenant_id = $1 AND is_active = true AND (name ILIKE $2 OR contact_person ILIKE $2 OR phone ILIKE $2)
         ORDER BY name ASC LIMIT 5`,
        [tenantId, searchTerm],
        { tenantId }
      ),
    ]);

    return reply.send({
      results: {
        orders: ordersRes.rows,
        products: prodsRes.rows,
        ingredients: ingsRes.rows,
        customers: custsRes.rows,
        suppliers: suppsRes.rows,
      },
    });
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
