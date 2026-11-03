import { FastifyInstance } from 'fastify';
import bcrypt from 'bcryptjs';
import { query, withTransaction } from '../db/connection.js';
import { authenticate, requireSuperAdmin } from '../middleware/auth.js';
import {
  CreateTenantSchema,
  CreatePlanSchema,
  RecordSubscriptionPaymentSchema,
  SystemRole,
  SubscriptionStatus,
  SubscriptionPaymentMethod,
  SubscriptionPaymentStatus,
} from '@pos/shared';
import { generateTenantBackup, restoreTenantBackup, getBackupHistory } from '../services/backupService.js';
import { logAuditEvent } from '../services/auditService.js';

export async function platformRoutes(fastify: FastifyInstance) {
  // All platform routes require Super Admin authentication
  fastify.addHook('preHandler', authenticate);
  fastify.addHook('preHandler', requireSuperAdmin);

  /**
   * Super Admin Dashboard Stats
   */
  fastify.get('/api/platform/dashboard', async (req, reply) => {
    // 1. Restaurant and Subscription metrics
    const statsQuery = `
      SELECT
        COUNT(t.id)::int as total_restaurants,
        COUNT(CASE WHEN ts.status = 'ACTIVE' THEN 1 END)::int as active_subscriptions,
        COUNT(CASE WHEN ts.status = 'TRIAL' THEN 1 END)::int as trial_restaurants,
        COUNT(CASE WHEN ts.status = 'EXPIRED' OR ts.status = 'PAST_DUE' THEN 1 END)::int as expired_subscriptions,
        COUNT(CASE WHEN t.is_active = false OR ts.status = 'SUSPENDED' THEN 1 END)::int as suspended_restaurants,
        COALESCE(SUM(CASE WHEN ts.status = 'ACTIVE' THEN sp.monthly_price ELSE 0 END), 0)::numeric as mrr
      FROM tenants t
      LEFT JOIN LATERAL (
        SELECT plan_id, status FROM tenant_subscriptions
        WHERE tenant_id = t.id ORDER BY created_at DESC LIMIT 1
      ) ts ON true
      LEFT JOIN subscription_plans sp ON sp.id = ts.plan_id
    `;
    const { rows: statsRows } = await query(statsQuery, [], { isSuperAdmin: true });
    const s = statsRows[0] || {};

    // 2. Global branches, users, and devices
    const { rows: countRows } = await query(
      `
      SELECT
        (SELECT COUNT(*)::int FROM branches) as total_branches,
        (SELECT COUNT(*)::int FROM users) as total_users,
        (SELECT COUNT(*)::int FROM registered_devices WHERE is_active = true) as active_devices
      `,
      [],
      { isSuperAdmin: true }
    );
    const c = countRows[0] || {};

    // 3. Recent Platform Activity
    const { rows: recentActivity } = await query(
      `
      SELECT al.*, t.name as tenant_name
      FROM audit_logs al
      LEFT JOIN tenants t ON t.id = al.tenant_id
      ORDER BY al.created_at DESC
      LIMIT 10
      `,
      [],
      { isSuperAdmin: true }
    );

    return reply.send({
      totalRestaurants: Number(s.total_restaurants || 0),
      activeSubscriptions: Number(s.active_subscriptions || 0),
      trialRestaurants: Number(s.trial_restaurants || 0),
      expiredSubscriptions: Number(s.expired_subscriptions || 0),
      suspendedRestaurants: Number(s.suspended_restaurants || 0),
      mrr: Number(s.mrr || 0),
      totalBranches: Number(c.total_branches || 0),
      totalUsers: Number(c.total_users || 0),
      activeDevices: Number(c.active_devices || 0),
      recentActivity,
    });
  });

  /**
   * List all restaurants with subscription info
   */
  fastify.get('/api/platform/tenants', async (req, reply) => {
    const { search, status } = req.query as { search?: string; status?: string };

    let sql = `
      SELECT
        t.id, t.name, t.legal_name, t.owner_name, t.email, t.phone, t.city, t.country,
        t.currency, t.is_active, t.is_onboarded, t.created_at,
        ts.status as subscription_status, ts.current_period_end, ts.trial_ends_at,
        sp.name as plan_name, sp.code as plan_code,
        (SELECT COUNT(*)::int FROM branches WHERE tenant_id = t.id) as branch_count,
        (SELECT COUNT(*)::int FROM users WHERE tenant_id = t.id) as user_count
      FROM tenants t
      LEFT JOIN LATERAL (
        SELECT id, plan_id, status, current_period_end, trial_ends_at
        FROM tenant_subscriptions
        WHERE tenant_id = t.id ORDER BY created_at DESC LIMIT 1
      ) ts ON true
      LEFT JOIN subscription_plans sp ON sp.id = ts.plan_id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (search) {
      params.push(`%${search}%`);
      sql += ` AND (t.name ILIKE $${params.length} OR t.owner_name ILIKE $${params.length} OR t.email ILIKE $${params.length})`;
    }

    if (status) {
      params.push(status);
      sql += ` AND ts.status = $${params.length}`;
    }

    sql += ` ORDER BY t.created_at DESC`;

    const { rows } = await query(sql, params, { isSuperAdmin: true });
    return reply.send({ tenants: rows });
  });

  /**
   * Create a Restaurant (Register on behalf of client)
   */
  fastify.post('/api/platform/tenants', async (req, reply) => {
    const parsed = CreateTenantSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.format() });
    }

    const {
      name,
      legalName,
      ownerName,
      email,
      phone,
      country,
      currency,
      timeZone,
      businessType,
      planId,
      initialAdminPassword,
      trialDays,
    } = parsed.data;

    // Check if email already used
    const existing = await query('SELECT id FROM tenants WHERE email = $1', [email.toLowerCase().trim()], { isSuperAdmin: true });
    if (existing.rows.length > 0) {
      return reply.status(400).send({ error: 'A restaurant with this owner email already exists' });
    }

    // Verify Plan exists
    const planRes = await query('SELECT * FROM subscription_plans WHERE id = $1', [planId], { isSuperAdmin: true });
    if (planRes.rows.length === 0) {
      return reply.status(400).send({ error: 'Subscription plan not found' });
    }
    const plan = planRes.rows[0];

    const result = await withTransaction(async (client) => {
      // 1. Create Tenant
      const tenantRes = await client.query(
        `
        INSERT INTO tenants (
          name, legal_name, owner_name, email, phone, country, currency,
          time_zone, business_type, is_active, is_onboarded
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, true, true)
        RETURNING *
        `,
        [name, legalName || null, ownerName, email.toLowerCase().trim(), phone, country, currency, timeZone, businessType]
      );
      const tenant = tenantRes.rows[0];

      // 2. Create Default Main Branch
      const branchRes = await client.query(
        `
        INSERT INTO branches (tenant_id, name, code, phone, address, city, is_main_branch, is_active)
        VALUES ($1, $2, 'MAIN', $3, 'Main Location', $4, true, true)
        RETURNING id
        `,
        [tenant.id, `${name} - Main Branch`, phone, country === 'Pakistan' ? 'Karachi' : 'Capital']
      );
      const branchId = branchRes.rows[0].id;

      // 3. Create Restaurant Settings
      await client.query(
        `
        INSERT INTO restaurant_settings (tenant_id, currency, currency_symbol, time_zone, tax_rate_percent, is_tax_inclusive)
        VALUES ($1, $2, $3, $4, 16.00, false)
        `,
        [tenant.id, currency, currency === 'PKR' ? 'Rs.' : '$', timeZone]
      );

      // 4. Create Owner User
      const passwordHash = await bcrypt.hash(initialAdminPassword, 10);
      const userRes = await client.query(
        `
        INSERT INTO users (tenant_id, branch_id, email, password_hash, full_name, role, is_active)
        VALUES ($1, $2, $3, $4, $5, $6, true)
        RETURNING id, email, full_name, role
        `,
        [tenant.id, branchId, email.toLowerCase().trim(), passwordHash, ownerName, SystemRole.RESTAURANT_OWNER]
      );
      const ownerUser = userRes.rows[0];

      // 5. Create Subscription
      const now = new Date();
      const trialEnds = new Date(now.getTime() + trialDays * 24 * 60 * 60 * 1000);
      const periodEnd = trialDays > 0 ? trialEnds : new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
      const gracePeriodDays = Number(plan.grace_period_days) || 3;
      const gracePeriodEnds = new Date(periodEnd.getTime() + gracePeriodDays * 24 * 60 * 60 * 1000);

      await client.query(
        `
        INSERT INTO tenant_subscriptions (
          tenant_id, plan_id, status, trial_ends_at, current_period_start,
          current_period_end, grace_period_ends_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        `,
        [
          tenant.id,
          plan.id,
          trialDays > 0 ? SubscriptionStatus.TRIAL : SubscriptionStatus.ACTIVE,
          trialDays > 0 ? trialEnds : null,
          now,
          periodEnd,
          gracePeriodEnds,
        ]
      );

      // 6. Log Audit Event
      await logAuditEvent({
        actorId: req.user!.id,
        actorRole: SystemRole.SUPER_ADMIN,
        action: 'PLATFORM_CREATE_TENANT',
        resourceType: 'TENANT',
        resourceId: tenant.id,
        metadata: { restaurantName: name, email, planCode: plan.code },
      });

      return { tenant, branchId, ownerUser };
    }, { isSuperAdmin: true });

    return reply.status(201).send({
      message: 'Restaurant created successfully',
      ...result,
    });
  });

  /**
   * Get single restaurant details
   */
  fastify.get('/api/platform/tenants/:id', async (req, reply) => {
    const { id } = req.params as { id: string };

    const { rows: tRows } = await query(
      `
      SELECT t.*, rs.tax_rate_percent, rs.is_tax_inclusive, rs.receipt_settings
      FROM tenants t
      LEFT JOIN restaurant_settings rs ON rs.tenant_id = t.id
      WHERE t.id = $1
      `,
      [id],
      { isSuperAdmin: true }
    );

    if (tRows.length === 0) {
      return reply.status(404).send({ error: 'Restaurant not found' });
    }

    const { rows: branches } = await query(
      'SELECT * FROM branches WHERE tenant_id = $1 ORDER BY is_main_branch DESC, name ASC',
      [id],
      { isSuperAdmin: true }
    );

    const { rows: users } = await query(
      'SELECT id, email, full_name, role, branch_id, is_active, created_at FROM users WHERE tenant_id = $1 ORDER BY created_at ASC',
      [id],
      { isSuperAdmin: true }
    );

    const { rows: subs } = await query(
      `
      SELECT ts.*, sp.name as plan_name, sp.code as plan_code, sp.entitlements, sp.monthly_price
      FROM tenant_subscriptions ts
      JOIN subscription_plans sp ON sp.id = ts.plan_id
      WHERE ts.tenant_id = $1 ORDER BY ts.created_at DESC
      `,
      [id],
      { isSuperAdmin: true }
    );

    const { rows: payments } = await query(
      'SELECT * FROM subscription_payments WHERE tenant_id = $1 ORDER BY payment_date DESC',
      [id],
      { isSuperAdmin: true }
    );

    const { rows: devices } = await query(
      'SELECT * FROM registered_devices WHERE tenant_id = $1 ORDER BY last_active_at DESC',
      [id],
      { isSuperAdmin: true }
    );

    return reply.send({
      tenant: tRows[0],
      branches,
      users,
      subscriptions: subs,
      payments,
      devices,
    });
  });

  /**
   * Suspend or Reactivate Restaurant
   */
  fastify.put('/api/platform/tenants/:id/status', async (req, reply) => {
    const { id } = req.params as { id: string };
    const { isActive, reason } = req.body as { isActive: boolean; reason?: string };

    await query(
      'UPDATE tenants SET is_active = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [isActive, id],
      { isSuperAdmin: true }
    );

    if (!isActive) {
      await query(
        `
        UPDATE tenant_subscriptions
        SET status = 'SUSPENDED', suspended_at = CURRENT_TIMESTAMP, suspension_reason = $1, updated_at = CURRENT_TIMESTAMP
        WHERE tenant_id = $2 AND status != 'SUSPENDED'
        `,
        [reason || 'Suspended by platform administrator', id],
        { isSuperAdmin: true }
      );
    } else {
      await query(
        `
        UPDATE tenant_subscriptions
        SET status = 'ACTIVE', suspended_at = NULL, suspension_reason = NULL, updated_at = CURRENT_TIMESTAMP
        WHERE tenant_id = $1 AND status = 'SUSPENDED'
        `,
        [id],
        { isSuperAdmin: true }
      );
    }

    await logAuditEvent({
      actorId: req.user!.id,
      actorRole: SystemRole.SUPER_ADMIN,
      action: isActive ? 'TENANT_REACTIVATED' : 'TENANT_SUSPENDED',
      resourceType: 'TENANT',
      resourceId: id,
      metadata: { isActive, reason },
    });

    return reply.send({ message: `Restaurant ${isActive ? 'reactivated' : 'suspended'} successfully` });
  });

  /**
   * Super Admin: List Restaurant Users for Credential Management
   */
  fastify.get('/api/platform/tenants/:tenantId/users', async (req, reply) => {
    const { tenantId } = req.params as { tenantId: string };

    const { rows } = await query(
      `
      SELECT u.id, u.tenant_id, u.branch_id, u.email, u.full_name, u.role, u.is_active,
             u.token_version, u.created_at, u.updated_at, b.name as branch_name
      FROM users u
      LEFT JOIN branches b ON b.id = u.branch_id
      WHERE u.tenant_id = $1
      ORDER BY u.created_at ASC
      `,
      [tenantId],
      { isSuperAdmin: true }
    );

    return reply.send({ users: rows });
  });

  /**
   * Super Admin: Update Restaurant User Credentials (Email / Password)
   */
  fastify.patch('/api/platform/tenants/:tenantId/users/:userId/credentials', async (req, reply) => {
    const { tenantId, userId } = req.params as { tenantId: string; userId: string };
    const { email, password, fullName, isActive } = req.body as {
      email?: string;
      password?: string;
      fullName?: string;
      isActive?: boolean;
    };

    // 1. Verify user belongs to tenant
    const { rows: existingRows } = await query(
      'SELECT id, email, token_version FROM users WHERE id = $1 AND tenant_id = $2',
      [userId, tenantId],
      { isSuperAdmin: true }
    );

    if (existingRows.length === 0) {
      return reply.status(404).send({ error: 'Restaurant user not found' });
    }

    const updates: string[] = [];
    const values: any[] = [];
    let pIdx = 1;

    // Check email uniqueness if changing email
    if (email) {
      const cleanEmail = email.toLowerCase().trim();
      const { rows: emailCheck } = await query(
        'SELECT id FROM users WHERE tenant_id = $1 AND email = $2 AND id != $3',
        [tenantId, cleanEmail, userId],
        { isSuperAdmin: true }
      );
      if (emailCheck.length > 0) {
        return reply.status(400).send({ error: 'A user with this email address already exists for this restaurant' });
      }
      updates.push(`email = $${pIdx++}`);
      values.push(cleanEmail);
    }

    if (fullName) {
      updates.push(`full_name = $${pIdx++}`);
      values.push(fullName.trim());
    }

    if (isActive !== undefined) {
      updates.push(`is_active = $${pIdx++}`);
      values.push(isActive);
    }

    let passwordChanged = false;
    if (password) {
      if (password.length < 8) {
        return reply.status(400).send({ error: 'Password must be at least 8 characters long' });
      }
      const passwordHash = await bcrypt.hash(password, 10);
      updates.push(`password_hash = $${pIdx++}`);
      values.push(passwordHash);

      // Invalidate existing sessions by incrementing token_version
      updates.push(`token_version = COALESCE(token_version, 1) + 1`);
      passwordChanged = true;
    }

    if (updates.length === 0) {
      return reply.status(400).send({ error: 'No fields provided to update' });
    }

    updates.push(`updated_at = CURRENT_TIMESTAMP`);

    values.push(userId, tenantId);
    const sql = `
      UPDATE users
      SET ${updates.join(', ')}
      WHERE id = $${pIdx++} AND tenant_id = $${pIdx++}
      RETURNING id, tenant_id, branch_id, email, full_name, role, is_active, token_version, updated_at
    `;

    const { rows: updatedRows } = await query(sql, values, { isSuperAdmin: true });

    await logAuditEvent({
      actorId: req.user!.id,
      actorRole: SystemRole.SUPER_ADMIN,
      action: 'UPDATE_TENANT_USER_CREDENTIALS',
      resourceType: 'USER',
      resourceId: userId,
      metadata: {
        tenantId,
        updatedEmail: email || null,
        passwordChanged,
        isActive,
      },
    });

    return reply.send({
      message: 'User credentials updated successfully',
      user: updatedRows[0],
      passwordChanged,
    });
  });

  /**
   * Change Subscription Plan
   */
  fastify.put('/api/platform/tenants/:id/plan', async (req, reply) => {
    const { id } = req.params as { id: string };
    const { planId, status = SubscriptionStatus.ACTIVE, extendDays = 30 } = req.body as {
      planId: string;
      status?: SubscriptionStatus;
      extendDays?: number;
    };

    const planRes = await query('SELECT * FROM subscription_plans WHERE id = $1', [planId], { isSuperAdmin: true });
    if (planRes.rows.length === 0) {
      return reply.status(404).send({ error: 'Subscription plan not found' });
    }
    const plan = planRes.rows[0];

    const now = new Date();
    const periodEnd = new Date(now.getTime() + extendDays * 24 * 60 * 60 * 1000);
    const gracePeriodEnds = new Date(periodEnd.getTime() + (Number(plan.grace_period_days) || 3) * 24 * 60 * 60 * 1000);

    const { rows } = await query(
      `
      INSERT INTO tenant_subscriptions (
        tenant_id, plan_id, status, current_period_start, current_period_end, grace_period_ends_at
      ) VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
      `,
      [id, planId, status, now, periodEnd, gracePeriodEnds],
      { isSuperAdmin: true }
    );

    await logAuditEvent({
      actorId: req.user!.id,
      actorRole: SystemRole.SUPER_ADMIN,
      action: 'TENANT_PLAN_CHANGED',
      resourceType: 'TENANT',
      resourceId: id,
      metadata: { planId, planName: plan.name, status, periodEnd },
    });

    return reply.send({ message: 'Plan updated successfully', subscription: rows[0] });
  });

  /**
   * Subscription Plans CRUD
   */
  fastify.get('/api/platform/plans', async (req, reply) => {
    const { rows } = await query('SELECT * FROM subscription_plans ORDER BY monthly_price ASC', [], { isSuperAdmin: true });
    return reply.send({ plans: rows });
  });

  fastify.post('/api/platform/plans', async (req, reply) => {
    const parsed = CreatePlanSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.format() });
    }

    const { name, code, description, monthlyPrice, annualPrice, currency, trialDays, gracePeriodDays, entitlements } = parsed.data;

    const { rows } = await query(
      `
      INSERT INTO subscription_plans (
        name, code, description, monthly_price, annual_price, currency, trial_days, grace_period_days, entitlements, is_active
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, true)
      RETURNING *
      `,
      [name, code, description, monthlyPrice, annualPrice, currency, trialDays, gracePeriodDays, JSON.stringify(entitlements)],
      { isSuperAdmin: true }
    );

    return reply.status(201).send({ plan: rows[0] });
  });

  /**
   * Record Manual Subscription Payment
   */
  fastify.post('/api/platform/payments', async (req, reply) => {
    const parsed = RecordSubscriptionPaymentSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.format() });
    }

    const { tenantId, amount, currency, paymentMethod, transactionReference, paymentDate, periodStart, periodEnd, notes } = parsed.data;

    // Get current subscription
    const subRes = await query(
      'SELECT id, plan_id FROM tenant_subscriptions WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT 1',
      [tenantId],
      { isSuperAdmin: true }
    );

    if (subRes.rows.length === 0) {
      return reply.status(400).send({ error: 'Tenant has no subscription' });
    }
    const sub = subRes.rows[0];

    const countRes = await query('SELECT COUNT(*)::int as count FROM subscription_payments', [], { isSuperAdmin: true });
    const pIndex = (countRes.rows[0]?.count || 0) + 1;
    const invoiceNumber = `INV-${new Date().getFullYear()}-${pIndex.toString().padStart(5, '0')}`;

    const paymentResult = await withTransaction(async (client) => {
      // 1. Insert Payment Record
      const insertPay = await client.query(
        `
        INSERT INTO subscription_payments (
          tenant_id, subscription_id, invoice_number, amount, currency,
          payment_method, transaction_reference, payment_date, period_start, period_end,
          status, notes, recorded_by_admin_id
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'COMPLETED', $11, $12)
        RETURNING *
        `,
        [
          tenantId, sub.id, invoiceNumber, amount, currency,
          paymentMethod, transactionReference, paymentDate, periodStart, periodEnd,
          notes || null, req.user!.id,
        ]
      );

      // 2. Extend/Activate Subscription
      const endDate = new Date(periodEnd);
      const graceEnd = new Date(endDate.getTime() + 5 * 24 * 60 * 60 * 1000);

      await client.query(
        `
        UPDATE tenant_subscriptions
        SET status = 'ACTIVE', current_period_start = $1, current_period_end = $2, grace_period_ends_at = $3, updated_at = CURRENT_TIMESTAMP
        WHERE id = $4
        `,
        [periodStart, periodEnd, graceEnd, sub.id]
      );

      return insertPay.rows[0];
    }, { isSuperAdmin: true });

    return reply.status(201).send({
      message: 'Subscription payment recorded successfully',
      payment: paymentResult,
    });
  });

  /**
   * List Subscription Payments
   */
  fastify.get('/api/platform/payments', async (req, reply) => {
    const { rows } = await query(
      `
      SELECT sp.*, t.name as tenant_name, pa.full_name as recorded_by_name
      FROM subscription_payments sp
      JOIN tenants t ON t.id = sp.tenant_id
      LEFT JOIN platform_admins pa ON pa.id = sp.recorded_by_admin_id
      ORDER BY sp.payment_date DESC
      LIMIT 100
      `,
      [],
      { isSuperAdmin: true }
    );
    return reply.send({ payments: rows });
  });

  /**
   * Super Admin: Generate Backup for any Restaurant
   */
  fastify.post('/api/platform/backups/generate/:tenantId', async (req, reply) => {
    const { tenantId } = req.params as { tenantId: string };
    try {
      const result = await generateTenantBackup(tenantId, req.user!.id, req.user!.fullName);
      return reply.send(result);
    } catch (err: any) {
      return reply.status(500).send({ error: err.message || 'Failed to generate backup' });
    }
  });

  /**
   * Super Admin: View Platform Backup History
   */
  fastify.get('/api/platform/backups', async (req, reply) => {
    const { tenantId } = req.query as { tenantId?: string };
    const history = await getBackupHistory(tenantId || null);
    return reply.send({ backups: history });
  });
}
