import { FastifyInstance } from 'fastify';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { query } from '../db/connection.js';
import { authenticate } from '../middleware/auth.js';
import {
  LoginSchema,
  RegisterSuperAdminSchema,
  SystemRole,
  DEFAULT_ROLE_PERMISSIONS,
} from '@pos/shared';
import { registerOrVerifyDevice } from '../services/subscriptionService.js';
import { logAuditEvent } from '../services/auditService.js';

const JWT_SECRET = process.env.JWT_SECRET || 'pos-saas-secret-jwt-key-restaurant-production-secure-2026';
const SUPER_ADMIN_SETUP_KEY = process.env.SUPER_ADMIN_SETUP_KEY || 'admin-bootstrap-secret-change-in-production';

export async function authRoutes(fastify: FastifyInstance) {
  /**
   * Super Admin Login
   */
  fastify.post('/api/auth/platform/login', async (req, reply) => {
    const parsed = LoginSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.format() });
    }

    const { email, password } = parsed.data;
    const { rows } = await query(
      'SELECT id, email, password_hash, full_name, is_active FROM platform_admins WHERE email = $1',
      [email.toLowerCase().trim()],
      { isSuperAdmin: true }
    );

    if (rows.length === 0 || !rows[0].is_active) {
      return reply.status(401).send({ error: 'Invalid platform administrator credentials' });
    }

    const admin = rows[0];
    const isMatch = await bcrypt.compare(password, admin.password_hash);
    if (!isMatch) {
      return reply.status(401).send({ error: 'Invalid platform administrator credentials' });
    }

    // Update last login
    await query(
      'UPDATE platform_admins SET last_login_at = CURRENT_TIMESTAMP WHERE id = $1',
      [admin.id],
      { isSuperAdmin: true }
    );

    const token = jwt.sign(
      {
        userId: admin.id,
        tenantId: null,
        branchId: null,
        role: SystemRole.SUPER_ADMIN,
      },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    await logAuditEvent({
      actorId: admin.id,
      actorRole: SystemRole.SUPER_ADMIN,
      action: 'PLATFORM_ADMIN_LOGIN',
      resourceType: 'PLATFORM_ADMIN',
      resourceId: admin.id,
      ipAddress: req.ip,
    });

    return reply.send({
      token,
      user: {
        id: admin.id,
        email: admin.email,
        fullName: admin.full_name,
        role: SystemRole.SUPER_ADMIN,
        permissions: Object.values(DEFAULT_ROLE_PERMISSIONS[SystemRole.SUPER_ADMIN]),
      },
    });
  });

  /**
   * Bootstrap Platform Super Admin with Secret Key
   */
  fastify.post('/api/auth/platform/register', async (req, reply) => {
    const parsed = RegisterSuperAdminSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.format() });
    }

    const { email, password, fullName, adminSecretKey } = parsed.data;

    if (adminSecretKey !== SUPER_ADMIN_SETUP_KEY) {
      return reply.status(403).send({ error: 'Forbidden: Invalid admin setup secret key' });
    }

    const existing = await query(
      'SELECT id FROM platform_admins WHERE email = $1',
      [email.toLowerCase().trim()],
      { isSuperAdmin: true }
    );

    if (existing.rows.length > 0) {
      return reply.status(400).send({ error: 'Platform admin with this email already exists' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const { rows } = await query(
      `
      INSERT INTO platform_admins (email, password_hash, full_name, is_active)
      VALUES ($1, $2, $3, true)
      RETURNING id, email, full_name
      `,
      [email.toLowerCase().trim(), passwordHash, fullName],
      { isSuperAdmin: true }
    );

    return reply.status(201).send({
      message: 'Platform administrator registered successfully',
      admin: rows[0],
    });
  });

  /**
   * Restaurant User Login (Owners, Managers, Cashiers, Waiters, Kitchen)
   */
  fastify.post('/api/auth/login', async (req, reply) => {
    const parsed = LoginSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.format() });
    }

    const { email, password, deviceFingerprint, deviceName } = parsed.data;

    const { rows } = await query(
      `
      SELECT u.id, u.tenant_id, u.branch_id, u.email, u.password_hash, u.full_name,
             u.role, u.custom_permissions, u.is_active,
             t.name as restaurant_name, t.currency, t.is_active as tenant_active, t.is_onboarded,
             b.name as branch_name
      FROM users u
      JOIN tenants t ON t.id = u.tenant_id
      LEFT JOIN branches b ON b.id = u.branch_id
      WHERE u.email = $1
      `,
      [email.toLowerCase().trim()],
      { isSuperAdmin: true }
    );

    if (rows.length === 0 || !rows[0].is_active) {
      return reply.status(401).send({ error: 'Invalid email or password' });
    }

    const user = rows[0];

    if (!user.tenant_active) {
      return reply.status(403).send({
        error: 'Restaurant account is currently suspended. Please contact platform administration.',
        code: 'ACCOUNT_SUSPENDED',
      });
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return reply.status(401).send({ error: 'Invalid email or password' });
    }

    // Verify / register device if fingerprint supplied
    let deviceId: string | undefined;
    if (deviceFingerprint && user.branch_id) {
      const devRes = await registerOrVerifyDevice(
        user.tenant_id,
        user.branch_id,
        deviceFingerprint,
        deviceName || 'Web POS Terminal',
        'POS_TERMINAL',
        req.ip
      );

      if (!devRes.success) {
        return reply.status(403).send({ error: devRes.error, code: 'DEVICE_LIMIT_EXCEEDED' });
      }
      deviceId = devRes.deviceId;
    }

    const permissions = Array.isArray(user.custom_permissions) && user.custom_permissions.length > 0
      ? user.custom_permissions
      : DEFAULT_ROLE_PERMISSIONS[user.role as SystemRole] || [];

    const token = jwt.sign(
      {
        userId: user.id,
        tenantId: user.tenant_id,
        branchId: user.branch_id,
        role: user.role,
        deviceId,
      },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    await logAuditEvent({
      tenantId: user.tenant_id,
      branchId: user.branch_id,
      actorId: user.id,
      actorRole: user.role,
      action: 'USER_LOGIN',
      resourceType: 'USER',
      resourceId: user.id,
      ipAddress: req.ip,
    });

    return reply.send({
      token,
      user: {
        id: user.id,
        tenantId: user.tenant_id,
        branchId: user.branch_id,
        branchName: user.branch_name,
        restaurantName: user.restaurant_name,
        currency: user.currency,
        isOnboarded: user.is_onboarded,
        email: user.email,
        fullName: user.full_name,
        role: user.role,
        permissions,
      },
    });
  });

  /**
   * Get Current Authenticated Profile (/api/auth/me)
   */
  fastify.get('/api/auth/me', { preHandler: [authenticate] }, async (req, reply) => {
    if (!req.user) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    if (req.user.role === SystemRole.SUPER_ADMIN) {
      return reply.send({
        user: req.user,
        isSuperAdmin: true,
      });
    }

    // Fetch tenant, branch and subscription details
    const { rows: tenantRows } = await query(
      `
      SELECT t.id, t.name, t.legal_name, t.owner_name, t.email, t.phone, t.currency,
             t.time_zone, t.business_type, t.logo_url, t.is_onboarded,
             rs.currency_symbol, rs.tax_rate_percent, rs.is_tax_inclusive, rs.receipt_settings
      FROM tenants t
      LEFT JOIN restaurant_settings rs ON rs.tenant_id = t.id
      WHERE t.id = $1
      `,
      [req.user.tenantId],
      { isSuperAdmin: true }
    );

    const { rows: subRows } = await query(
      `
      SELECT ts.status, ts.trial_ends_at, ts.current_period_end, sp.name as plan_name, sp.code as plan_code, sp.entitlements
      FROM tenant_subscriptions ts
      JOIN subscription_plans sp ON sp.id = ts.plan_id
      WHERE ts.tenant_id = $1
      ORDER BY ts.created_at DESC
      LIMIT 1
      `,
      [req.user.tenantId],
      { isSuperAdmin: true }
    );

    const tenant = tenantRows[0] || null;
    const subscription = subRows[0] || null;

    return reply.send({
      user: req.user,
      tenant,
      subscription,
      isSuperAdmin: false,
    });
  });
}
