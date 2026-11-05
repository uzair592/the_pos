import { FastifyInstance } from 'fastify';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import os from 'os';
import { query, withTransaction, pool } from '../db/connection.js';
import { authenticate, requireSuperAdmin } from '../middleware/auth.js';
import {
  CreateTenantSchema,
  CreatePlanSchema,
  RecordSubscriptionPaymentSchema,
  SystemRole,
  SubscriptionStatus,
  SubscriptionPaymentMethod,
  SubscriptionPaymentStatus,
  PlatformRole,
  TicketCategory,
  TicketPriority,
  TicketStatus,
  AnnouncementType,
  FeatureKey,
} from '@pos/shared';
import {
  generateTenantBackup,
  generateTenantExcelBackup,
  validateBackupPackage,
  restoreTenantBackup,
  getBackupHistory,
  getRestorationHistory,
} from '../services/backupService.js';
import {
  getConcurrentDeviceSummary,
  revokeDeviceSession,
} from '../services/deviceService.js';
import { logAuditEvent } from '../services/auditService.js';

export async function platformRoutes(fastify: FastifyInstance) {
  // All platform routes require Super Admin authentication
  fastify.addHook('preHandler', authenticate);
  fastify.addHook('preHandler', requireSuperAdmin);

  // =========================================================================
  // 1. SUPER ADMIN DASHBOARD & ANALYTICS
  // =========================================================================

  /**
   * Complete Platform Dashboard KPIs, Trends, and Recent Activities
   */
  fastify.get('/api/platform/dashboard', async (req, reply) => {
    // 1. Restaurant and Subscription Metrics
    const statsQuery = `
      SELECT
        COUNT(t.id)::int as total_restaurants,
        COUNT(CASE WHEN t.is_active = true AND (ts.status = 'ACTIVE' OR ts.status IS NULL) THEN 1 END)::int as active_restaurants,
        COUNT(CASE WHEN ts.status = 'TRIAL' THEN 1 END)::int as trial_restaurants,
        COUNT(CASE WHEN ts.status = 'EXPIRED' OR ts.status = 'PAST_DUE' THEN 1 END)::int as expired_restaurants,
        COUNT(CASE WHEN t.is_active = false OR ts.status = 'SUSPENDED' THEN 1 END)::int as suspended_restaurants,
        COALESCE(SUM(CASE WHEN ts.status = 'ACTIVE' THEN sp.monthly_price ELSE 0 END), 0)::numeric as mrr,
        COUNT(CASE WHEN t.created_at >= date_trunc('month', CURRENT_DATE) THEN 1 END)::int as new_registrations_month
      FROM tenants t
      LEFT JOIN LATERAL (
        SELECT plan_id, status FROM tenant_subscriptions
        WHERE tenant_id = t.id ORDER BY created_at DESC LIMIT 1
      ) ts ON true
      LEFT JOIN subscription_plans sp ON sp.id = ts.plan_id
      WHERE t.deleted_at IS NULL
    `;
    const { rows: statsRows } = await query(statsQuery, [], { isSuperAdmin: true });
    const s = statsRows[0] || {};

    // 2. Global Branches, Users, and Devices
    const { rows: countRows } = await query(
      `
      SELECT
        (SELECT COUNT(*)::int FROM branches WHERE is_active = true) as total_branches,
        (SELECT COUNT(*)::int FROM users WHERE is_active = true) as total_users,
        (SELECT COUNT(*)::int FROM registered_devices WHERE is_active = true) as total_registered_devices,
        (SELECT COUNT(*)::int FROM active_device_sessions WHERE status = 'ONLINE' AND last_heartbeat_at >= NOW() - INTERVAL '3 minutes') as currently_connected_devices
      `,
      [],
      { isSuperAdmin: true }
    );
    const c = countRows[0] || {};

    // 3. Billing & Payment KPIs
    const { rows: billingRows } = await query(
      `
      SELECT
        COALESCE(SUM(CASE WHEN status = 'COMPLETED' THEN amount ELSE 0 END), 0)::numeric as total_revenue,
        COUNT(CASE WHEN status = 'PENDING' THEN 1 END)::int as pending_payments,
        COUNT(CASE WHEN status = 'FAILED' THEN 1 END)::int as failed_payments
      FROM subscription_payments
      `,
      [],
      { isSuperAdmin: true }
    );
    const b = billingRows[0] || {};

    // 4. Subscriptions Expiring in next 7 days
    const { rows: renewalsRows } = await query(
      `
      SELECT COUNT(*)::int as renewals_due
      FROM tenant_subscriptions
      WHERE current_period_end BETWEEN NOW() AND NOW() + INTERVAL '7 days'
        AND status IN ('ACTIVE', 'TRIAL')
      `,
      [],
      { isSuperAdmin: true }
    );
    const renewalsDue = Number(renewalsRows[0]?.renewals_due || 0);

    // 5. Monthly Revenue Trends (Past 12 Months)
    const { rows: revenueTrends } = await query(
      `
      SELECT
        to_char(date_trunc('month', payment_date), 'Mon YYYY') as month,
        date_trunc('month', payment_date) as sort_date,
        COALESCE(SUM(amount), 0)::numeric as revenue
      FROM subscription_payments
      WHERE status = 'COMPLETED' AND payment_date >= NOW() - INTERVAL '12 months'
      GROUP BY date_trunc('month', payment_date)
      ORDER BY sort_date ASC
      `,
      [],
      { isSuperAdmin: true }
    );

    // 6. Restaurant Registration Trends (Past 6 Months)
    const { rows: registrationTrends } = await query(
      `
      SELECT
        to_char(date_trunc('month', created_at), 'Mon YYYY') as month,
        date_trunc('month', created_at) as sort_date,
        COUNT(*)::int as count
      FROM tenants
      WHERE created_at >= NOW() - INTERVAL '6 months' AND deleted_at IS NULL
      GROUP BY date_trunc('month', created_at)
      ORDER BY sort_date ASC
      `,
      [],
      { isSuperAdmin: true }
    );

    // 7. Subscription Plan Distribution
    const { rows: planDistribution } = await query(
      `
      SELECT
        sp.name as plan_name,
        sp.code as plan_code,
        COUNT(ts.tenant_id)::int as tenant_count
      FROM subscription_plans sp
      LEFT JOIN tenant_subscriptions ts ON ts.plan_id = sp.id AND ts.status IN ('ACTIVE', 'TRIAL')
      GROUP BY sp.id, sp.name, sp.code
      ORDER BY tenant_count DESC
      `,
      [],
      { isSuperAdmin: true }
    );

    // 8. Recent Activities
    const { rows: recentActivities } = await query(
      `
      SELECT al.*, t.name as tenant_name
      FROM audit_logs al
      LEFT JOIN tenants t ON t.id = al.tenant_id
      ORDER BY al.created_at DESC
      LIMIT 15
      `,
      [],
      { isSuperAdmin: true }
    );

    const mrr = Number(s.mrr || 0);
    const arr = mrr * 12;

    return reply.send({
      totalRestaurants: Number(s.total_restaurants || 0),
      activeRestaurants: Number(s.active_restaurants || 0),
      trialRestaurants: Number(s.trial_restaurants || 0),
      expiredRestaurants: Number(s.expired_restaurants || 0),
      suspendedRestaurants: Number(s.suspended_restaurants || 0),
      newRegistrationsMonth: Number(s.new_registrations_month || 0),
      mrr,
      arr,
      totalSubscriptionRevenue: Number(b.total_revenue || 0),
      pendingPayments: Number(b.pending_payments || 0),
      failedPayments: Number(b.failed_payments || 0),
      renewalsDue,
      totalBranches: Number(c.total_branches || 0),
      totalUsers: Number(c.total_users || 0),
      totalRegisteredDevices: Number(c.total_registered_devices || 0),
      currentlyConnectedDevices: Number(c.currently_connected_devices || 0),
      revenueTrends,
      registrationTrends,
      planDistribution,
      recentActivities,
    });
  });

  // =========================================================================
  // 2. RESTAURANT / TENANT MANAGEMENT (FULL CRUD & THREE-DOT ACTIONS)
  // =========================================================================

  /**
   * List all restaurants with search, filters, and connected device counts
   */
  fastify.get('/api/platform/tenants', async (req, reply) => {
    const { search, status, planId } = req.query as {
      search?: string;
      status?: string;
      planId?: string;
    };

    let sql = `
      SELECT
        t.id, t.name, t.legal_name, t.owner_name, t.email, t.phone, t.city, t.country,
        t.currency, t.time_zone, t.is_active, t.is_onboarded, t.created_at,
        t.max_concurrent_devices,
        ts.status as subscription_status, ts.current_period_end, ts.trial_ends_at,
        sp.id as plan_id, sp.name as plan_name, sp.code as plan_code,
        (SELECT COUNT(*)::int FROM branches WHERE tenant_id = t.id AND is_active = true) as branch_count,
        (SELECT COUNT(*)::int FROM users WHERE tenant_id = t.id AND is_active = true) as user_count,
        (SELECT COUNT(*)::int FROM registered_devices WHERE tenant_id = t.id AND is_active = true) as registered_device_count,
        (SELECT COUNT(*)::int FROM active_device_sessions WHERE tenant_id = t.id AND status = 'ONLINE' AND last_heartbeat_at >= NOW() - INTERVAL '3 minutes') as connected_device_count
      FROM tenants t
      LEFT JOIN LATERAL (
        SELECT id, plan_id, status, current_period_end, trial_ends_at
        FROM tenant_subscriptions
        WHERE tenant_id = t.id ORDER BY created_at DESC LIMIT 1
      ) ts ON true
      LEFT JOIN subscription_plans sp ON sp.id = ts.plan_id
      WHERE t.deleted_at IS NULL
    `;
    const params: any[] = [];

    if (search) {
      params.push(`%${search}%`);
      sql += ` AND (t.name ILIKE $${params.length} OR t.owner_name ILIKE $${params.length} OR t.email ILIKE $${params.length} OR t.phone ILIKE $${params.length})`;
    }

    if (status) {
      if (status === 'SUSPENDED') {
        sql += ` AND (t.is_active = false OR ts.status = 'SUSPENDED')`;
      } else {
        params.push(status);
        sql += ` AND ts.status = $${params.length} AND t.is_active = true`;
      }
    }

    if (planId) {
      params.push(planId);
      sql += ` AND sp.id = $${params.length}`;
    }

    sql += ` ORDER BY t.created_at DESC`;

    const { rows } = await query(sql, params, { isSuperAdmin: true });
    return reply.send({ tenants: rows });
  });

  /**
   * Create a Restaurant
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

    const maxConcurrentDevices = (req.body as any)?.maxConcurrentDevices
      ? Number((req.body as any).maxConcurrentDevices)
      : null;

    // Check if email already used
    const existing = await query('SELECT id FROM tenants WHERE email = $1 AND deleted_at IS NULL', [email.toLowerCase().trim()], { isSuperAdmin: true });
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
          time_zone, business_type, max_concurrent_devices, is_active, is_onboarded
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, true, true)
        RETURNING *
        `,
        [name, legalName || null, ownerName, email.toLowerCase().trim(), phone, country, currency, timeZone, businessType, maxConcurrentDevices]
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

      await logAuditEvent({
        actorId: req.user!.id,
        actorRole: 'SUPER_ADMIN',
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
   * Get single restaurant complete details
   */
  fastify.get('/api/platform/tenants/:id', async (req, reply) => {
    const { id } = req.params as { id: string };

    const { rows: tRows } = await query(
      `
      SELECT t.*, rs.tax_rate_percent, rs.is_tax_inclusive, rs.receipt_settings, rs.currency_symbol
      FROM tenants t
      LEFT JOIN restaurant_settings rs ON rs.tenant_id = t.id
      WHERE t.id = $1 AND t.deleted_at IS NULL
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

    const deviceSummary = await getConcurrentDeviceSummary(id);
    const backupHistory = await getBackupHistory(id);
    const restorationHistory = await getRestorationHistory(id);

    return reply.send({
      tenant: tRows[0],
      branches,
      users,
      subscriptions: subs,
      payments,
      devices,
      concurrentDevices: deviceSummary,
      backups: backupHistory,
      restorations: restorationHistory,
    });
  });

  /**
   * Edit Restaurant Details
   */
  fastify.put('/api/platform/tenants/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const {
      name,
      legalName,
      ownerName,
      email,
      phone,
      city,
      country,
      currency,
      timeZone,
      businessType,
      maxConcurrentDevices,
    } = req.body as any;

    if (!name || !email) {
      return reply.status(400).send({ error: 'Restaurant name and email are required' });
    }

    const { rows: updated } = await query(
      `
      UPDATE tenants
      SET name = $1, legal_name = $2, owner_name = $3, email = $4, phone = $5,
          city = $6, country = $7, currency = $8, time_zone = $9, business_type = $10,
          max_concurrent_devices = $11, updated_at = CURRENT_TIMESTAMP
      WHERE id = $12 AND deleted_at IS NULL
      RETURNING *
      `,
      [
        name,
        legalName || null,
        ownerName,
        email.toLowerCase().trim(),
        phone,
        city || null,
        country || 'Pakistan',
        currency || 'PKR',
        timeZone || 'Asia/Karachi',
        businessType || 'RESTAURANT',
        maxConcurrentDevices !== undefined && maxConcurrentDevices !== null ? Number(maxConcurrentDevices) : null,
        id,
      ],
      { isSuperAdmin: true }
    );

    if (updated.length === 0) {
      return reply.status(404).send({ error: 'Restaurant not found' });
    }

    await logAuditEvent({
      actorId: req.user!.id,
      actorRole: 'SUPER_ADMIN',
      action: 'PLATFORM_EDIT_TENANT',
      resourceType: 'TENANT',
      resourceId: id,
      metadata: { name, email, maxConcurrentDevices },
    });

    return reply.send({ message: 'Restaurant updated successfully', tenant: updated[0] });
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
      actorRole: 'SUPER_ADMIN',
      action: isActive ? 'TENANT_REACTIVATED' : 'TENANT_SUSPENDED',
      resourceType: 'TENANT',
      resourceId: id,
      metadata: { isActive, reason },
    });

    return reply.send({ message: `Restaurant ${isActive ? 'reactivated' : 'suspended'} successfully` });
  });

  /**
   * Delete or Archive Restaurant with Safeguards
   */
  fastify.delete('/api/platform/tenants/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const { reason, permanent } = req.body as { reason?: string; permanent?: boolean };

    if (permanent) {
      // Hard delete with cascade
      await withTransaction(async (client) => {
        await client.query('DELETE FROM tenants WHERE id = $1', [id]);
      }, { isSuperAdmin: true });

      await logAuditEvent({
        actorId: req.user!.id,
        actorRole: 'SUPER_ADMIN',
        action: 'TENANT_PERMANENTLY_DELETED',
        resourceType: 'TENANT',
        resourceId: id,
        metadata: { reason },
      });

      return reply.send({ message: 'Restaurant permanently removed from platform' });
    }

    // Soft delete / archive
    await query(
      'UPDATE tenants SET is_active = false, deleted_at = CURRENT_TIMESTAMP, deletion_reason = $1 WHERE id = $2',
      [reason || 'Archived by platform administrator', id],
      { isSuperAdmin: true }
    );

    await logAuditEvent({
      actorId: req.user!.id,
      actorRole: 'SUPER_ADMIN',
      action: 'TENANT_ARCHIVED',
      resourceType: 'TENANT',
      resourceId: id,
      metadata: { reason },
    });

    return reply.send({ message: 'Restaurant archived successfully' });
  });

  /**
   * Change or Extend Subscription Plan
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
      actorRole: 'SUPER_ADMIN',
      action: 'TENANT_PLAN_CHANGED',
      resourceType: 'TENANT',
      resourceId: id,
      metadata: { planId, planName: plan.name, status, periodEnd },
    });

    return reply.send({ message: 'Plan updated successfully', subscription: rows[0] });
  });

  /**
   * List Restaurant Users for Credential Management
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
   * Update Restaurant User Credentials & Invalidate Stale Tokens
   */
  fastify.patch('/api/platform/tenants/:tenantId/users/:userId/credentials', async (req, reply) => {
    const { tenantId, userId } = req.params as { tenantId: string; userId: string };
    const { email, password, fullName, isActive } = req.body as {
      email?: string;
      password?: string;
      fullName?: string;
      isActive?: boolean;
    };

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
      actorRole: 'SUPER_ADMIN',
      action: 'UPDATE_TENANT_USER_CREDENTIALS',
      resourceType: 'USER',
      resourceId: userId,
      metadata: { tenantId, updatedEmail: email || null, passwordChanged, isActive },
    });

    return reply.send({
      message: 'User credentials updated successfully',
      user: updatedRows[0],
      passwordChanged,
    });
  });

  // =========================================================================
  // 3. RESTAURANT DATA BACKUP, EXPORT & RECOVERY
  // =========================================================================

  /**
   * Download Full JSON Restaurant Backup
   */
  fastify.get('/api/platform/tenants/:id/backup/json', async (req, reply) => {
    const { id } = req.params as { id: string };
    try {
      const { package: backupPkg, fileName } = await generateTenantBackup(id, req.user!.id, req.user!.fullName);
      reply.header('Content-Type', 'application/json');
      reply.header('Content-Disposition', `attachment; filename="${fileName}"`);
      return reply.send(backupPkg);
    } catch (err: any) {
      return reply.status(500).send({ error: err.message || 'Failed to generate JSON backup' });
    }
  });

  /**
   * Download Multi-Sheet Excel Restaurant Backup (.xlsx)
   */
  fastify.get('/api/platform/tenants/:id/backup/excel', async (req, reply) => {
    const { id } = req.params as { id: string };
    try {
      const { buffer, fileName } = await generateTenantExcelBackup(id, req.user!.id, req.user!.fullName);
      reply.header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      reply.header('Content-Disposition', `attachment; filename="${fileName}"`);
      return reply.send(buffer);
    } catch (err: any) {
      return reply.status(500).send({ error: err.message || 'Failed to generate Excel export' });
    }
  });

  /**
   * Validate a Backup File prior to restoration
   */
  fastify.post('/api/platform/backups/validate', async (req, reply) => {
    const { backupPackage, targetTenantId } = req.body as { backupPackage: any; targetTenantId: string };
    const validation = validateBackupPackage(backupPackage, targetTenantId);
    return reply.send(validation);
  });

  /**
   * Execute Transactional Restore with Pre-validation and Safety Backup
   */
  fastify.post('/api/platform/tenants/:id/restore', async (req, reply) => {
    const { id } = req.params as { id: string };
    const { backupPackage, mode = 'FULL', selectedModules } = req.body as {
      backupPackage: any;
      mode?: 'FULL' | 'SELECTIVE' | 'MERGE';
      selectedModules?: string[];
    };

    try {
      const res = await restoreTenantBackup(
        id,
        backupPackage,
        req.user!.id,
        req.user!.fullName,
        { mode, selectedModules }
      );
      return reply.send(res);
    } catch (err: any) {
      return reply.status(500).send({ error: err.message || 'Restoration failed' });
    }
  });

  /**
   * View Platform Backup History
   */
  fastify.get('/api/platform/backups', async (req, reply) => {
    const { tenantId } = req.query as { tenantId?: string };
    const history = await getBackupHistory(tenantId || null);
    return reply.send({ backups: history });
  });

  /**
   * View Data Restoration History
   */
  fastify.get('/api/platform/backups/restorations', async (req, reply) => {
    const { tenantId } = req.query as { tenantId?: string };
    const restorations = await getRestorationHistory(tenantId || null);
    return reply.send({ restorations });
  });

  // =========================================================================
  // 4. SUBSCRIPTION PLANS & BILLING
  // =========================================================================

  /**
   * List all plans with subscriber counts
   */
  fastify.get('/api/platform/plans', async (req, reply) => {
    const { rows } = await query(
      `
      SELECT sp.*,
             COUNT(CASE WHEN ts.status IN ('ACTIVE', 'TRIAL') THEN 1 END)::int as active_subscribers_count
      FROM subscription_plans sp
      LEFT JOIN tenant_subscriptions ts ON ts.plan_id = sp.id
      GROUP BY sp.id
      ORDER BY sp.monthly_price ASC
      `,
      [],
      { isSuperAdmin: true }
    );
    return reply.send({ plans: rows });
  });

  /**
   * Create Subscription Plan
   */
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
      [name, code.toUpperCase().trim(), description, monthlyPrice, annualPrice, currency, trialDays, gracePeriodDays, JSON.stringify(entitlements)],
      { isSuperAdmin: true }
    );

    await logAuditEvent({
      actorId: req.user!.id,
      actorRole: 'SUPER_ADMIN',
      action: 'PLATFORM_PLAN_CREATED',
      resourceType: 'SUBSCRIPTION_PLAN',
      resourceId: rows[0].id,
      metadata: { name, code },
    });

    return reply.status(201).send({ plan: rows[0] });
  });

  /**
   * Edit Subscription Plan
   */
  fastify.put('/api/platform/plans/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const { name, description, monthlyPrice, annualPrice, trialDays, gracePeriodDays, entitlements, isActive } = req.body as any;

    const { rows } = await query(
      `
      UPDATE subscription_plans
      SET name = COALESCE($1, name),
          description = COALESCE($2, description),
          monthly_price = COALESCE($3, monthly_price),
          annual_price = COALESCE($4, annual_price),
          trial_days = COALESCE($5, trial_days),
          grace_period_days = COALESCE($6, grace_period_days),
          entitlements = COALESCE($7, entitlements),
          is_active = COALESCE($8, is_active),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $9
      RETURNING *
      `,
      [
        name,
        description,
        monthlyPrice,
        annualPrice,
        trialDays,
        gracePeriodDays,
        entitlements ? JSON.stringify(entitlements) : null,
        isActive,
        id,
      ],
      { isSuperAdmin: true }
    );

    if (rows.length === 0) {
      return reply.status(404).send({ error: 'Subscription plan not found' });
    }

    return reply.send({ message: 'Plan updated successfully', plan: rows[0] });
  });

  /**
   * Delete Subscription Plan with Safeguard
   */
  fastify.delete('/api/platform/plans/:id', async (req, reply) => {
    const { id } = req.params as { id: string };

    const { rows: activeSubs } = await query(
      'SELECT id FROM tenant_subscriptions WHERE plan_id = $1 AND status IN (\'ACTIVE\', \'TRIAL\')',
      [id],
      { isSuperAdmin: true }
    );

    if (activeSubs.length > 0) {
      return reply.status(400).send({
        error: `Cannot delete plan: ${activeSubs.length} restaurants are currently subscribed. Reassign them before deletion.`,
      });
    }

    await query('DELETE FROM subscription_plans WHERE id = $1', [id], { isSuperAdmin: true });
    return reply.send({ message: 'Subscription plan deleted successfully' });
  });

  // =========================================================================
  // 5. BILLING & PAYMENTS
  // =========================================================================

  /**
   * List Payments with Filters
   */
  fastify.get('/api/platform/payments', async (req, reply) => {
    const { status, search } = req.query as { status?: string; search?: string };

    let sql = `
      SELECT sp.*, t.name as tenant_name, t.owner_name, pa.full_name as recorded_by_name
      FROM subscription_payments sp
      JOIN tenants t ON t.id = sp.tenant_id
      LEFT JOIN platform_admins pa ON pa.id = sp.recorded_by_admin_id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (status) {
      params.push(status);
      sql += ` AND sp.status = $${params.length}`;
    }

    if (search) {
      params.push(`%${search}%`);
      sql += ` AND (t.name ILIKE $${params.length} OR sp.invoice_number ILIKE $${params.length} OR sp.transaction_reference ILIKE $${params.length})`;
    }

    sql += ` ORDER BY sp.payment_date DESC LIMIT 100`;

    const { rows } = await query(sql, params, { isSuperAdmin: true });
    return reply.send({ payments: rows });
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
   * Verify or Reject Pending Payment
   */
  fastify.put('/api/platform/payments/:id/verify', async (req, reply) => {
    const { id } = req.params as { id: string };
    const { status, rejectionReason } = req.body as { status: 'COMPLETED' | 'REJECTED'; rejectionReason?: string };

    const { rows: updated } = await query(
      `
      UPDATE subscription_payments
      SET status = $1, rejection_reason = $2, verified_at = CURRENT_TIMESTAMP, verified_by_admin_id = $3
      WHERE id = $4
      RETURNING *
      `,
      [status, rejectionReason || null, req.user!.id, id],
      { isSuperAdmin: true }
    );

    if (updated.length === 0) {
      return reply.status(404).send({ error: 'Payment record not found' });
    }

    return reply.send({ message: `Payment marked as ${status}`, payment: updated[0] });
  });

  // =========================================================================
  // 6. BRANCH MANAGEMENT
  // =========================================================================

  /**
   * List all branches across all restaurants
   */
  fastify.get('/api/platform/branches', async (req, reply) => {
    const { search, tenantId } = req.query as { search?: string; tenantId?: string };

    let sql = `
      SELECT b.*, t.name as tenant_name, t.city as tenant_city,
             (SELECT COUNT(*)::int FROM users WHERE branch_id = b.id AND is_active = true) as user_count,
             (SELECT COUNT(*)::int FROM registered_devices WHERE branch_id = b.id AND is_active = true) as device_count
      FROM branches b
      JOIN tenants t ON t.id = b.tenant_id
      WHERE t.deleted_at IS NULL
    `;
    const params: any[] = [];

    if (tenantId) {
      params.push(tenantId);
      sql += ` AND b.tenant_id = $${params.length}`;
    }

    if (search) {
      params.push(`%${search}%`);
      sql += ` AND (b.name ILIKE $${params.length} OR t.name ILIKE $${params.length} OR b.city ILIKE $${params.length})`;
    }

    sql += ` ORDER BY t.name ASC, b.name ASC`;

    const { rows } = await query(sql, params, { isSuperAdmin: true });
    return reply.send({ branches: rows });
  });

  /**
   * Toggle Branch Active Status
   */
  fastify.put('/api/platform/branches/:id/status', async (req, reply) => {
    const { id } = req.params as { id: string };
    const { isActive } = req.body as { isActive: boolean };

    await query(
      'UPDATE branches SET is_active = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [isActive, id],
      { isSuperAdmin: true }
    );

    return reply.send({ message: `Branch ${isActive ? 'activated' : 'deactivated'} successfully` });
  });

  // =========================================================================
  // 7. DEVICE & CONCURRENT SESSION MANAGEMENT
  // =========================================================================

  /**
   * List all registered devices and live sessions across the platform
   */
  fastify.get('/api/platform/devices', async (req, reply) => {
    const { search, tenantId } = req.query as { search?: string; tenantId?: string };

    let sql = `
      SELECT rd.*, t.name as tenant_name, b.name as branch_name,
             ads.id as session_id, ads.status as session_status, ads.last_heartbeat_at,
             ads.os_info, ads.app_version, ads.user_name as active_user_name,
             CASE
               WHEN ads.status = 'ONLINE' AND ads.last_heartbeat_at >= NOW() - INTERVAL '3 minutes' THEN 'ONLINE'
               WHEN ads.last_heartbeat_at >= NOW() - INTERVAL '15 minutes' THEN 'IDLE'
               ELSE 'OFFLINE'
             END as live_connection_status
      FROM registered_devices rd
      JOIN tenants t ON t.id = rd.tenant_id
      JOIN branches b ON b.id = rd.branch_id
      LEFT JOIN active_device_sessions ads ON ads.tenant_id = rd.tenant_id AND ads.device_fingerprint = rd.device_fingerprint
      WHERE t.deleted_at IS NULL
    `;
    const params: any[] = [];

    if (tenantId) {
      params.push(tenantId);
      sql += ` AND rd.tenant_id = $${params.length}`;
    }

    if (search) {
      params.push(`%${search}%`);
      sql += ` AND (rd.device_name ILIKE $${params.length} OR t.name ILIKE $${params.length} OR rd.device_fingerprint ILIKE $${params.length})`;
    }

    sql += ` ORDER BY rd.last_active_at DESC LIMIT 150`;

    const { rows } = await query(sql, params, { isSuperAdmin: true });
    return reply.send({ devices: rows });
  });

  /**
   * Revoke an active device session (Force Logout)
   */
  fastify.post('/api/platform/devices/sessions/:sessionId/revoke', async (req, reply) => {
    const { sessionId } = req.params as { sessionId: string };

    const { rows: session } = await query(
      'SELECT * FROM active_device_sessions WHERE id = $1',
      [sessionId],
      { isSuperAdmin: true }
    );

    if (session.length === 0) {
      return reply.status(404).send({ error: 'Session not found' });
    }

    await revokeDeviceSession(sessionId, session[0].tenant_id, req.user!.id);
    return reply.send({ message: 'Device session revoked. The terminal will be signed out.' });
  });

  /**
   * Get Restaurant Concurrent Devices Summary
   */
  fastify.get('/api/platform/tenants/:id/concurrent-summary', async (req, reply) => {
    const { id } = req.params as { id: string };
    const summary = await getConcurrentDeviceSummary(id);
    return reply.send(summary);
  });

  // =========================================================================
  // 8. PLATFORM USERS & ROLES
  // =========================================================================

  /**
   * List platform administrators
   */
  fastify.get('/api/platform/users', async (req, reply) => {
    const { rows } = await query(
      'SELECT id, email, full_name, role, phone, is_active, last_login_at, created_at FROM platform_admins ORDER BY created_at ASC',
      [],
      { isSuperAdmin: true }
    );
    return reply.send({ users: rows });
  });

  /**
   * Create Platform Administrator
   */
  fastify.post('/api/platform/users', async (req, reply) => {
    const { email, password, fullName, role = PlatformRole.PLATFORM_ADMIN, phone } = req.body as any;

    if (!email || !password || !fullName) {
      return reply.status(400).send({ error: 'Email, password, and full name are required' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const { rows } = await query(
      `
      INSERT INTO platform_admins (email, password_hash, full_name, role, phone, is_active)
      VALUES ($1, $2, $3, $4, $5, true)
      RETURNING id, email, full_name, role, phone, is_active, created_at
      `,
      [email.toLowerCase().trim(), passwordHash, fullName.trim(), role, phone || null],
      { isSuperAdmin: true }
    );

    return reply.status(201).send({ user: rows[0] });
  });

  /**
   * Edit Platform Administrator
   */
  fastify.put('/api/platform/users/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const { email, fullName, role, phone, isActive } = req.body as any;

    const { rows } = await query(
      `
      UPDATE platform_admins
      SET email = COALESCE($1, email),
          full_name = COALESCE($2, full_name),
          role = COALESCE($3, role),
          phone = COALESCE($4, phone),
          is_active = COALESCE($5, is_active),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $6
      RETURNING id, email, full_name, role, phone, is_active, updated_at
      `,
      [email ? email.toLowerCase().trim() : null, fullName ? fullName.trim() : null, role, phone, isActive, id],
      { isSuperAdmin: true }
    );

    if (rows.length === 0) {
      return reply.status(404).send({ error: 'Platform administrator not found' });
    }

    return reply.send({ user: rows[0] });
  });

  /**
   * Reset Platform Administrator Password
   */
  fastify.put('/api/platform/users/:id/password', async (req, reply) => {
    const { id } = req.params as { id: string };
    const { password } = req.body as { password: string };

    if (!password || password.length < 8) {
      return reply.status(400).send({ error: 'Password must be at least 8 characters long' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    await query(
      'UPDATE platform_admins SET password_hash = $1, token_version = token_version + 1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [passwordHash, id],
      { isSuperAdmin: true }
    );

    return reply.send({ message: 'Administrator password reset successfully' });
  });

  /**
   * Delete or Deactivate Platform Administrator
   */
  fastify.delete('/api/platform/users/:id', async (req, reply) => {
    const { id } = req.params as { id: string };

    if (req.user!.id === id) {
      return reply.status(400).send({ error: 'You cannot delete or deactivate your own account' });
    }

    await query('DELETE FROM platform_admins WHERE id = $1', [id], { isSuperAdmin: true });
    return reply.send({ message: 'Platform administrator deleted successfully' });
  });

  // =========================================================================
  // 9. SUPPORT TICKETS MANAGEMENT
  // =========================================================================

  /**
   * List Support Tickets
   */
  fastify.get('/api/platform/tickets', async (req, reply) => {
    const { status, category, priority, tenantId } = req.query as any;

    let sql = `
      SELECT pt.*, t.name as tenant_name, pa.full_name as assigned_admin_name
      FROM platform_tickets pt
      LEFT JOIN tenants t ON t.id = pt.tenant_id
      LEFT JOIN platform_admins pa ON pa.id = pt.assigned_admin_id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (status) {
      params.push(status);
      sql += ` AND pt.status = $${params.length}`;
    }

    if (category) {
      params.push(category);
      sql += ` AND pt.category = $${params.length}`;
    }

    if (priority) {
      params.push(priority);
      sql += ` AND pt.priority = $${params.length}`;
    }

    if (tenantId) {
      params.push(tenantId);
      sql += ` AND pt.tenant_id = $${params.length}`;
    }

    sql += ` ORDER BY pt.created_at DESC LIMIT 100`;

    const { rows } = await query(sql, params, { isSuperAdmin: true });
    return reply.send({ tickets: rows });
  });

  /**
   * Create Support Ticket
   */
  fastify.post('/api/platform/tickets', async (req, reply) => {
    const { tenantId, subject, category, priority = 'MEDIUM', message, internalNotes } = req.body as any;

    if (!subject || !category || !message) {
      return reply.status(400).send({ error: 'Subject, category, and message are required' });
    }

    const countRes = await query('SELECT COUNT(*)::int as count FROM platform_tickets', [], { isSuperAdmin: true });
    const ticketNumber = `TCK-${(Number(countRes.rows[0]?.count || 0) + 1).toString().padStart(5, '0')}`;

    const { rows } = await query(
      `
      INSERT INTO platform_tickets (
        ticket_number, tenant_id, subject, category, priority, status,
        assigned_admin_id, created_by_user_id, created_by_name, internal_notes
      ) VALUES ($1, $2, $3, $4, $5, 'OPEN', $6, $7, $8, $9)
      RETURNING *
      `,
      [
        ticketNumber,
        tenantId || null,
        subject,
        category,
        priority,
        req.user!.id,
        req.user!.id,
        req.user!.fullName,
        internalNotes || null,
      ],
      { isSuperAdmin: true }
    );

    // Initial message
    await query(
      `
      INSERT INTO platform_ticket_messages (ticket_id, sender_type, sender_name, message, is_internal)
      VALUES ($1, 'ADMIN', $2, $3, false)
      `,
      [rows[0].id, req.user!.fullName, message],
      { isSuperAdmin: true }
    );

    return reply.status(201).send({ ticket: rows[0] });
  });

  /**
   * Get Ticket Details & Messages
   */
  fastify.get('/api/platform/tickets/:id', async (req, reply) => {
    const { id } = req.params as { id: string };

    const { rows: ticketRows } = await query(
      `
      SELECT pt.*, t.name as tenant_name, pa.full_name as assigned_admin_name
      FROM platform_tickets pt
      LEFT JOIN tenants t ON t.id = pt.tenant_id
      LEFT JOIN platform_admins pa ON pa.id = pt.assigned_admin_id
      WHERE pt.id = $1
      `,
      [id],
      { isSuperAdmin: true }
    );

    if (ticketRows.length === 0) {
      return reply.status(404).send({ error: 'Ticket not found' });
    }

    const { rows: messages } = await query(
      'SELECT * FROM platform_ticket_messages WHERE ticket_id = $1 ORDER BY created_at ASC',
      [id],
      { isSuperAdmin: true }
    );

    return reply.send({ ticket: ticketRows[0], messages });
  });

  /**
   * Reply to Support Ticket
   */
  fastify.post('/api/platform/tickets/:id/messages', async (req, reply) => {
    const { id } = req.params as { id: string };
    const { message, isInternal = false, status } = req.body as any;

    if (!message) {
      return reply.status(400).send({ error: 'Message cannot be empty' });
    }

    await query(
      `
      INSERT INTO platform_ticket_messages (ticket_id, sender_type, sender_name, message, is_internal)
      VALUES ($1, 'ADMIN', $2, $3, $4)
      `,
      [id, req.user!.fullName, message, isInternal],
      { isSuperAdmin: true }
    );

    if (status) {
      await query(
        'UPDATE platform_tickets SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
        [status, id],
        { isSuperAdmin: true }
      );
    }

    return reply.status(201).send({ message: 'Reply sent successfully' });
  });

  /**
   * Update Ticket Status / Assignment
   */
  fastify.put('/api/platform/tickets/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const { status, priority, assignedAdminId, internalNotes, resolutionSummary } = req.body as any;

    const resolvedAt = status === 'RESOLVED' || status === 'CLOSED' ? new Date() : null;

    const { rows } = await query(
      `
      UPDATE platform_tickets
      SET status = COALESCE($1, status),
          priority = COALESCE($2, priority),
          assigned_admin_id = COALESCE($3, assigned_admin_id),
          internal_notes = COALESCE($4, internal_notes),
          resolution_summary = COALESCE($5, resolution_summary),
          resolved_at = COALESCE($6, resolved_at),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $7
      RETURNING *
      `,
      [status, priority, assignedAdminId, internalNotes, resolutionSummary, resolvedAt, id],
      { isSuperAdmin: true }
    );

    return reply.send({ ticket: rows[0] });
  });

  fastify.put('/api/platform/tickets/:id/status', async (req, reply) => {
    const { id } = req.params as { id: string };
    const { status } = req.body as { status: string };

    const resolvedAt = status === 'RESOLVED' || status === 'CLOSED' ? new Date() : null;
    const { rows } = await query(
      `
      UPDATE platform_tickets
      SET status = $1, resolved_at = COALESCE($2, resolved_at), updated_at = CURRENT_TIMESTAMP
      WHERE id = $3
      RETURNING *
      `,
      [status, resolvedAt, id],
      { isSuperAdmin: true }
    );

    return reply.send({ ticket: rows[0] });
  });

  // =========================================================================
  // 10. ANNOUNCEMENTS & NOTIFICATIONS
  // =========================================================================

  fastify.get('/api/platform/announcements', async (req, reply) => {
    const { rows } = await query(
      `
      SELECT pa.*, a.full_name as author_name
      FROM platform_announcements pa
      LEFT JOIN platform_admins a ON a.id = pa.created_by_admin_id
      ORDER BY pa.created_at DESC
      `,
      [],
      { isSuperAdmin: true }
    );
    return reply.send({ announcements: rows });
  });

  fastify.post('/api/platform/announcements', async (req, reply) => {
    const { title, message, type = 'INFO', targetAudience = 'ALL', expiresAt } = req.body as any;

    if (!title || !message) {
      return reply.status(400).send({ error: 'Title and message are required' });
    }

    const { rows } = await query(
      `
      INSERT INTO platform_announcements (
        title, message, type, target_audience, expires_at, created_by_admin_id
      ) VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
      `,
      [title, message, type, targetAudience, expiresAt || null, req.user!.id],
      { isSuperAdmin: true }
    );

    return reply.status(201).send({ announcement: rows[0] });
  });

  fastify.delete('/api/platform/announcements/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    await query('DELETE FROM platform_announcements WHERE id = $1', [id], { isSuperAdmin: true });
    return reply.send({ message: 'Announcement removed' });
  });

  // =========================================================================
  // 11. SYSTEM HEALTH & MONITORING
  // =========================================================================

  fastify.get('/api/platform/system-health', async (req, reply) => {
    // Database connection pool check
    let dbStatus = 'HEALTHY';
    let dbLatencyMs = 0;
    try {
      const t0 = Date.now();
      await query('SELECT 1', [], { isSuperAdmin: true });
      dbLatencyMs = Date.now() - t0;
    } catch {
      dbStatus = 'DEGRADED';
    }

    const uptimeSeconds = Math.floor(process.uptime());
    const memUsage = process.memoryUsage();
    const osFreeMem = os.freemem();
    const osTotalMem = os.totalmem();
    const cpus = os.cpus().length;

    const { rows: failedLogCount } = await query(
      `
      SELECT COUNT(*)::int as error_count
      FROM audit_logs
      WHERE action ILIKE '%FAILED%' OR action ILIKE '%ERROR%'
        AND created_at >= NOW() - INTERVAL '24 hours'
      `,
      [],
      { isSuperAdmin: true }
    );

    return reply.send({
      serverTime: new Date().toISOString(),
      uptimeSeconds,
      apiStatus: 'HEALTHY',
      database: {
        status: dbStatus,
        latencyMs: dbLatencyMs,
        activePoolClients: pool.totalCount,
        idlePoolClients: pool.idleCount,
        waitingClients: pool.waitingCount,
      },
      system: {
        nodeVersion: process.version,
        platform: process.platform,
        cpuCount: cpus,
        memoryUsageMb: Math.round(memUsage.rss / 1024 / 1024),
        heapUsedMb: Math.round(memUsage.heapUsed / 1024 / 1024),
        systemFreeMemMb: Math.round(osFreeMem / 1024 / 1024),
        systemTotalMemMb: Math.round(osTotalMem / 1024 / 1024),
      },
      incidents24h: Number(failedLogCount[0]?.error_count || 0),
    });
  });

  // =========================================================================
  // 12. SECURITY & AUDIT LOGS
  // =========================================================================

  fastify.get('/api/platform/audit-logs', async (req, reply) => {
    const { action, tenantId, limit = 100 } = req.query as any;

    let sql = `
      SELECT al.*, t.name as tenant_name
      FROM audit_logs al
      LEFT JOIN tenants t ON t.id = al.tenant_id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (action) {
      params.push(`%${action}%`);
      sql += ` AND al.action ILIKE $${params.length}`;
    }

    if (tenantId) {
      params.push(tenantId);
      sql += ` AND al.tenant_id = $${params.length}`;
    }

    sql += ` ORDER BY al.created_at DESC LIMIT $${params.length + 1}`;
    params.push(Math.min(250, Number(limit) || 100));

    const { rows } = await query(sql, params, { isSuperAdmin: true });
    return reply.send({ logs: rows });
  });

  // =========================================================================
  // 13. API & INTEGRATION KEYS
  // =========================================================================

  fastify.get('/api/platform/api-keys', async (req, reply) => {
    const { rows } = await query(
      `
      SELECT pak.id, pak.name, pak.key_prefix, pak.permissions, pak.rate_limit_per_minute,
             pak.is_active, pak.last_used_at, pak.expires_at, pak.created_at,
             t.name as tenant_name
      FROM platform_api_keys pak
      LEFT JOIN tenants t ON t.id = pak.tenant_id
      ORDER BY pak.created_at DESC
      `,
      [],
      { isSuperAdmin: true }
    );
    return reply.send({ apiKeys: rows });
  });

  fastify.post('/api/platform/api-keys', async (req, reply) => {
    const { name, tenantId, permissions = ['*'], rateLimitPerMinute = 120 } = req.body as any;

    if (!name) {
      return reply.status(400).send({ error: 'API Key name is required' });
    }

    const secret = crypto.randomBytes(32).toString('hex');
    const keyPrefix = `pk_live_${secret.slice(0, 6)}`;
    const fullKey = `${keyPrefix}_${secret.slice(6)}`;
    const keyHash = crypto.createHash('sha256').update(fullKey).digest('hex');

    const { rows } = await query(
      `
      INSERT INTO platform_api_keys (name, key_prefix, key_hash, tenant_id, permissions, rate_limit_per_minute)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id, name, key_prefix, permissions, rate_limit_per_minute, is_active, created_at
      `,
      [name, keyPrefix, keyHash, tenantId || null, JSON.stringify(permissions), rateLimitPerMinute],
      { isSuperAdmin: true }
    );

    return reply.status(201).send({
      message: 'API Key created. Copy the key now as it will never be displayed again.',
      apiKey: rows[0],
      secretKey: fullKey,
    });
  });

  fastify.delete('/api/platform/api-keys/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    await query('DELETE FROM platform_api_keys WHERE id = $1', [id], { isSuperAdmin: true });
    return reply.send({ message: 'API Key revoked successfully' });
  });

  // =========================================================================
  // 14. PLATFORM SETTINGS & APP UPDATES
  // =========================================================================

  fastify.get('/api/platform/settings', async (req, reply) => {
    const { rows } = await query('SELECT * FROM platform_settings WHERE id = 1', [], { isSuperAdmin: true });
    return reply.send({ settings: rows[0] || {} });
  });

  fastify.put('/api/platform/settings', async (req, reply) => {
    const {
      platformName,
      supportEmail,
      supportPhone,
      defaultCurrency,
      defaultTimezone,
      trialDays,
      gracePeriodDays,
      defaultMaxDevices,
      maintenanceMode,
      minSupportedAppVersion,
      currentPlatformVersion,
      announcementBanner,
    } = req.body as any;

    const { rows } = await query(
      `
      UPDATE platform_settings
      SET platform_name = COALESCE($1, platform_name),
          support_email = COALESCE($2, support_email),
          support_phone = COALESCE($3, support_phone),
          default_currency = COALESCE($4, default_currency),
          default_timezone = COALESCE($5, default_timezone),
          trial_days = COALESCE($6, trial_days),
          grace_period_days = COALESCE($7, grace_period_days),
          default_max_devices = COALESCE($8, default_max_devices),
          maintenance_mode = COALESCE($9, maintenance_mode),
          min_supported_app_version = COALESCE($10, min_supported_app_version),
          current_platform_version = COALESCE($11, current_platform_version),
          announcement_banner = $12,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = 1
      RETURNING *
      `,
      [
        platformName,
        supportEmail,
        supportPhone,
        defaultCurrency,
        defaultTimezone,
        trialDays,
        gracePeriodDays,
        defaultMaxDevices,
        maintenanceMode,
        minSupportedAppVersion,
        currentPlatformVersion,
        announcementBanner || null,
      ],
      { isSuperAdmin: true }
    );

    return reply.send({ message: 'Platform settings saved', settings: rows[0] });
  });
}
