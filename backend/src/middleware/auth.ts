import { FastifyRequest, FastifyReply } from 'fastify';
import jwt from 'jsonwebtoken';
import { AuthUser, SystemRole, Permission, DEFAULT_ROLE_PERMISSIONS } from '@pos/shared';
import { FeatureKey } from '@pos/shared';
import { query } from '../db/connection.js';

const JWT_SECRET = process.env.JWT_SECRET || 'pos-saas-secret-jwt-key-restaurant-production-secure-2026';

declare module 'fastify' {
  interface FastifyRequest {
    user?: AuthUser;
    tenantId?: string;
  }
}

/**
 * Verifies JWT token and attaches user to request
 */
export async function authenticate(req: FastifyRequest, reply: FastifyReply) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return reply.status(401).send({ error: 'Unauthorized: Missing or invalid token' });
  }

  const token = authHeader.substring(7);
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;

    if (decoded.role === SystemRole.SUPER_ADMIN) {
      // Super admin
      const adminId = decoded.userId || decoded.id;
      const { rows } = await query(
        'SELECT id, email, full_name, is_active FROM platform_admins WHERE id = $1',
        [adminId],
        { isSuperAdmin: true }
      );

      if (rows.length === 0 || !rows[0].is_active) {
        return reply.status(401).send({ error: 'Unauthorized: Super admin account inactive or deleted' });
      }

      req.user = {
        id: rows[0].id,
        tenantId: null,
        branchId: null,
        email: rows[0].email,
        fullName: rows[0].full_name,
        role: SystemRole.SUPER_ADMIN,
        permissions: Object.values(Permission),
        isActive: rows[0].is_active,
      };
      return;
    }

    // Restaurant user
    const { rows } = await query(
      `
      SELECT u.id, u.tenant_id, u.branch_id, u.email, u.full_name, u.role, u.custom_permissions, u.is_active, u.token_version,
             t.is_active as tenant_active, t.is_onboarded
      FROM users u
      JOIN tenants t ON t.id = u.tenant_id
      WHERE u.id = $1 AND u.tenant_id = $2
      `,
      [decoded.userId, decoded.tenantId],
      { isSuperAdmin: true }
    );

    if (rows.length === 0 || !rows[0].is_active) {
      return reply.status(401).send({ error: 'Unauthorized: User account inactive or not found' });
    }

    if (decoded.tokenVersion && decoded.tokenVersion < (rows[0].token_version || 1)) {
      return reply.status(401).send({ error: 'Unauthorized: Session revoked due to credential change' });
    }

    if (!rows[0].tenant_active) {
      return reply.status(403).send({
        error: 'Tenant account has been suspended by platform administrator',
        code: 'ACCOUNT_SUSPENDED',
      });
    }

    const roleStr = String(rows[0].role).toUpperCase();
    let normalizedRole = rows[0].role as SystemRole;
    if (roleStr === 'OWNER') normalizedRole = SystemRole.RESTAURANT_OWNER;
    else if (roleStr === 'MANAGER') normalizedRole = SystemRole.BRANCH_MANAGER;
    else if (roleStr === 'ADMIN') normalizedRole = SystemRole.RESTAURANT_ADMIN;

    const rolePerms = DEFAULT_ROLE_PERMISSIONS[normalizedRole] || [];
    const customPerms: Permission[] = Array.isArray(rows[0].custom_permissions) && rows[0].custom_permissions.length > 0
      ? rows[0].custom_permissions
      : [];
    const effectivePermissions = Array.from(new Set([...rolePerms, ...customPerms]));

    req.user = {
      id: rows[0].id,
      tenantId: rows[0].tenant_id,
      branchId: rows[0].branch_id,
      email: rows[0].email,
      fullName: rows[0].full_name,
      role: normalizedRole,
      permissions: effectivePermissions,
      isActive: rows[0].is_active,
      deviceId: decoded.deviceId,
    };
    req.tenantId = rows[0].tenant_id;
  } catch (err) {
    return reply.status(401).send({ error: 'Unauthorized: Invalid or expired token' });
  }
}

/**
 * Super Admin check
 */
export async function requireSuperAdmin(req: FastifyRequest, reply: FastifyReply) {
  if (!req.user || req.user.role !== SystemRole.SUPER_ADMIN) {
    return reply.status(403).send({ error: 'Forbidden: Super Admin access required' });
  }
}

/**
 * Tenant requirement and subscription enforcement
 */
export async function requireTenant(req: FastifyRequest, reply: FastifyReply) {
  if (!req.user || !req.user.tenantId) {
    return reply.status(400).send({ error: 'Tenant context required' });
  }

  // Check subscription status
  const { rows: subRows } = await query(
    `
    SELECT ts.status, ts.current_period_end, ts.trial_ends_at, ts.grace_period_ends_at,
           sp.entitlements
    FROM tenant_subscriptions ts
    JOIN subscription_plans sp ON sp.id = ts.plan_id
    WHERE ts.tenant_id = $1
    ORDER BY ts.created_at DESC
    LIMIT 1
    `,
    [req.user.tenantId],
    { isSuperAdmin: true }
  );

  if (subRows.length > 0) {
    const sub = subRows[0];
    const now = new Date();

    // Check if suspended
    if (sub.status === 'SUSPENDED') {
      return reply.status(403).send({
        error: 'Subscription suspended. Please contact platform administrator.',
        code: 'SUBSCRIPTION_SUSPENDED',
      });
    }

    // Check if expired past grace period
    const graceEnd = sub.grace_period_ends_at ? new Date(sub.grace_period_ends_at) : new Date(sub.current_period_end);
    if (now > graceEnd && sub.status !== 'ACTIVE' && sub.status !== 'TRIAL') {
      // Allow GET operations (read historical data) but block state modifications
      if (req.method !== 'GET') {
        return reply.status(403).send({
          error: 'Subscription has expired. Write operations are restricted until renewed.',
          code: 'SUBSCRIPTION_EXPIRED',
        });
      }
    }
  }
}

/**
 * Role-Based Access Control (RBAC) Permission check
 */
export function requirePermission(permission: Permission) {
  return async (req: FastifyRequest, reply: FastifyReply) => {
    if (!req.user) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    // Super Admin and Restaurant Owner have full permissions
    if (
      req.user.role === SystemRole.SUPER_ADMIN ||
      req.user.role === SystemRole.RESTAURANT_OWNER ||
      (req.user.role as string) === 'OWNER'
    ) {
      return;
    }

    // Check if permission is in user's permissions
    if (req.user.permissions && req.user.permissions.includes(permission)) {
      return;
    }

    return reply.status(403).send({
      error: `Forbidden: Missing required permission [${permission}]`,
    });
  };
}

/**
 * Role-Based Access Control (RBAC) Check where ANY of the listed permissions is sufficient
 */
export function requireAnyPermission(...permissions: Permission[]) {
  return async (req: FastifyRequest, reply: FastifyReply) => {
    if (!req.user) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    if (
      req.user.role === SystemRole.SUPER_ADMIN ||
      req.user.role === SystemRole.RESTAURANT_OWNER ||
      (req.user.role as string) === 'OWNER'
    ) {
      return;
    }

    if (req.user.permissions && permissions.some((p) => req.user!.permissions.includes(p))) {
      return;
    }

    return reply.status(403).send({
      error: `Forbidden: Missing required permission [${permissions.join(' or ')}]`,
    });
  };
}

/**
 * Plan Feature Entitlement Check
 */
export function requireEntitlement(feature: FeatureKey) {
  return async (req: FastifyRequest, reply: FastifyReply) => {
    if (!req.user || !req.user.tenantId) {
      return reply.status(400).send({ error: 'Tenant context required' });
    }

    const { rows } = await query(
      `
      SELECT sp.entitlements
      FROM tenant_subscriptions ts
      JOIN subscription_plans sp ON sp.id = ts.plan_id
      WHERE ts.tenant_id = $1
      ORDER BY ts.created_at DESC
      LIMIT 1
      `,
      [req.user.tenantId],
      { isSuperAdmin: true }
    );

    if (rows.length === 0) {
      return reply.status(403).send({ error: 'No active subscription plan found' });
    }

    const entitlements = rows[0].entitlements;
    const hasFeature = entitlements?.features?.[feature];

    if (!hasFeature) {
      return reply.status(403).send({
        error: `Feature [${feature}] is not included in your current subscription plan. Upgrade your plan to access this feature.`,
        code: 'FEATURE_NOT_ENTITLED',
        feature,
      });
    }
  };
}
