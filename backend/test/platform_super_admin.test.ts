import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.js';
import { pool, query, withTransaction } from '../src/db/connection.js';
import { runMigrations } from '../src/db/migrator.js';
import { seedDatabase } from '../src/db/seed.js';
import { generateTenantBackup, generateTenantExcelBackup, validateBackupPackage, restoreTenantBackup } from '../src/services/backupService.js';
import { getConcurrentDeviceSummary, revokeDeviceSession } from '../src/services/deviceService.js';
import { PlatformRole, TicketCategory, TicketPriority } from '@pos/shared';

describe('Platform Super Admin Panel – Centralized Management, Multi-Device & Recovery Tests', () => {
  let app: FastifyInstance;
  let superAdminToken: string;
  let superAdminId: string;
  let testTenantId: string;
  let testPlanId: string;

  beforeAll(async () => {
    await runMigrations();
    await seedDatabase();
    app = buildApp();
    await app.ready();

    // 1. Authenticate as Super Admin
    const loginRes = await app.inject({
      method: 'POST',
      url: '/api/auth/platform/login',
      payload: {
        email: 'admin@posplatform.com',
        password: 'AdminPass123!',
      },
    });

    expect(loginRes.statusCode).toBe(200);
    const loginData = loginRes.json();
    superAdminToken = loginData.token;
    superAdminId = loginData.user.id;
    expect(superAdminToken).toBeDefined();

    // Fetch default plan
    const { rows: planRows } = await query(
      'SELECT id FROM subscription_plans ORDER BY monthly_price ASC LIMIT 1',
      [],
      { isSuperAdmin: true }
    );
    testPlanId = planRows[0].id;
  });

  afterAll(async () => {
    // Clean up test tenant if exists
    if (testTenantId) {
      await withTransaction(async (client) => {
        await client.query('DELETE FROM tenants WHERE id = $1', [testTenantId]);
      }, { isSuperAdmin: true }).catch(() => {});
    }
    await app.close();
  });

  it('1. Dashboard: returns live business KPIs, MRR, ARR, and health diagnostics', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/platform/dashboard',
      headers: {
        authorization: `Bearer ${superAdminToken}`,
      },
    });

    expect(res.statusCode).toBe(200);
    const data = res.json();
    expect(data.totalRestaurants).toBeGreaterThanOrEqual(0);
    expect(data.mrr).toBeGreaterThanOrEqual(0);
    expect(data.arr).toBeGreaterThanOrEqual(0);
    expect(data.revenueTrends).toBeDefined();
    expect(data.planDistribution).toBeDefined();
    expect(data.recentActivities).toBeDefined();
  });

  it('2. Tenant CRUD: registers new restaurant, checks multi-device limit, and updates details', async () => {
    const uniqueEmail = `test_owner_${Date.now()}@restaurant.com`;

    // A. Register Tenant
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/platform/tenants',
      headers: {
        authorization: `Bearer ${superAdminToken}`,
      },
      payload: {
        name: 'The Royal Biryani Bistro',
        legalName: 'Royal Biryani Bistro Pvt Ltd',
        ownerName: 'Rashid Minhas',
        email: uniqueEmail,
        phone: '+92 300 9876543',
        country: 'Pakistan',
        currency: 'PKR',
        timeZone: 'Asia/Karachi',
        businessType: 'FINE_DINE',
        planId: testPlanId,
        initialAdminPassword: 'Password123!',
        trialDays: 14,
      },
    });

    expect(createRes.statusCode).toBe(201);
    const created = createRes.json();
    testTenantId = created.tenant.id;
    expect(testTenantId).toBeDefined();

    // B. Query single tenant complete console details
    const detailsRes = await app.inject({
      method: 'GET',
      url: `/api/platform/tenants/${testTenantId}`,
      headers: {
        authorization: `Bearer ${superAdminToken}`,
      },
    });

    expect(detailsRes.statusCode).toBe(200);
    const details = detailsRes.json();
    expect(details.tenant.name).toBe('The Royal Biryani Bistro');
    expect(details.branches.length).toBeGreaterThanOrEqual(1);
    expect(details.users.length).toBeGreaterThanOrEqual(1);
    expect(details.concurrentDevices).toBeDefined();

    // C. Update details (including max concurrent devices)
    const updateRes = await app.inject({
      method: 'PUT',
      url: `/api/platform/tenants/${testTenantId}`,
      headers: {
        authorization: `Bearer ${superAdminToken}`,
      },
      payload: {
        name: 'The Royal Biryani Bistro & Lounge',
        legalName: 'Royal Biryani Bistro Pvt Ltd',
        ownerName: 'Rashid Minhas',
        email: uniqueEmail,
        phone: '+92 300 9876543',
        city: 'Lahore',
        currency: 'PKR',
        timeZone: 'Asia/Karachi',
        businessType: 'FINE_DINE',
        maxConcurrentDevices: 6,
      },
    });

    expect(updateRes.statusCode).toBe(200);
    const updated = updateRes.json();
    expect(updated.tenant.name).toBe('The Royal Biryani Bistro & Lounge');
    expect(Number(updated.tenant.max_concurrent_devices)).toBe(6);
  });

  it('3. Credentials & Passwords: updates restaurant user email and resets password securely', async () => {
    // List users for tenant
    const usersRes = await app.inject({
      method: 'GET',
      url: `/api/platform/tenants/${testTenantId}/users`,
      headers: {
        authorization: `Bearer ${superAdminToken}`,
      },
    });

    expect(usersRes.statusCode).toBe(200);
    const usersData = usersRes.json();
    expect(usersData.users.length).toBeGreaterThan(0);
    const targetUser = usersData.users[0];

    // Reset password & update email
    const newEmail = `updated_${Date.now()}@restaurant.com`;
    const patchRes = await app.inject({
      method: 'PATCH',
      url: `/api/platform/tenants/${testTenantId}/users/${targetUser.id}/credentials`,
      headers: {
        authorization: `Bearer ${superAdminToken}`,
      },
      payload: {
        email: newEmail,
        password: 'NewSecurePassword123!',
      },
    });

    expect(patchRes.statusCode).toBe(200);
    const patchData = patchRes.json();
    expect(patchData.passwordChanged).toBe(true);
    expect(patchData.user.email).toBe(newEmail);
  });

  it('4. Multi-Device & Dynamic Concurrency: establishes live session and revokes session', async () => {
    // Query branch id for test tenant
    const { rows: branchRows } = await query(
      'SELECT id FROM branches WHERE tenant_id = $1 LIMIT 1',
      [testTenantId],
      { isSuperAdmin: true }
    );
    const branchId = branchRows[0].id;

    // Seed an active session for the tenant
    const sessionRes = await query(
      `
      INSERT INTO active_device_sessions (
        tenant_id, branch_id, device_fingerprint, device_name, device_type, ip_address, status, last_heartbeat_at
      ) VALUES ($1, $2, $3, $4, $5, $6, 'ONLINE', NOW())
      RETURNING *
      `,
      [testTenantId, branchId, 'FP-TEST-TERMINAL-01', 'Counter 1 POS Terminal', 'DESKTOP', '192.168.1.100'],
      { isSuperAdmin: true }
    );

    const sessionId = sessionRes.rows[0].id;
    expect(sessionId).toBeDefined();

    // Check summary
    const summary = await getConcurrentDeviceSummary(testTenantId);
    expect(summary.connectedCount).toBeGreaterThanOrEqual(1);
    expect(summary.maxConcurrentLimit).toBe(6);

    // Revoke session via platform endpoint
    const revokeRes = await app.inject({
      method: 'POST',
      url: `/api/platform/devices/sessions/${sessionId}/revoke`,
      headers: {
        authorization: `Bearer ${superAdminToken}`,
      },
    });

    expect(revokeRes.statusCode).toBe(200);

    // Verify session status updated
    const { rows: verifyRows } = await query(
      'SELECT status FROM active_device_sessions WHERE id = $1',
      [sessionId],
      { isSuperAdmin: true }
    );
    expect(verifyRows[0].status).toBe('REVOKED');
  });

  it('5. Data Export & Restoration: downloads JSON and Excel, validates package, and executes transactional restore', async () => {
    // A. Generate JSON backup
    const jsonRes = await app.inject({
      method: 'GET',
      url: `/api/platform/tenants/${testTenantId}/backup/json`,
      headers: {
        authorization: `Bearer ${superAdminToken}`,
      },
    });

    expect(jsonRes.statusCode).toBe(200);
    expect(jsonRes.headers['content-type']).toContain('application/json');
    const backupPkg = jsonRes.json();
    expect(backupPkg.metadata).toBeDefined();
    expect(backupPkg.metadata.tenantId).toBe(testTenantId);
    expect(backupPkg.data).toBeDefined();

    // B. Generate Excel workbook
    const excelRes = await app.inject({
      method: 'GET',
      url: `/api/platform/tenants/${testTenantId}/backup/excel`,
      headers: {
        authorization: `Bearer ${superAdminToken}`,
      },
    });

    expect(excelRes.statusCode).toBe(200);
    expect(excelRes.headers['content-type']).toContain('spreadsheetml');
    expect(excelRes.rawPayload.length).toBeGreaterThan(100);

    // C. Validate Backup Package
    const validateRes = await app.inject({
      method: 'POST',
      url: '/api/platform/backups/validate',
      headers: {
        authorization: `Bearer ${superAdminToken}`,
      },
      payload: {
        backupPackage: backupPkg,
        targetTenantId: testTenantId,
      },
    });

    expect(validateRes.statusCode).toBe(200);
    const valData = validateRes.json();
    expect(valData.isValid).toBe(true);

    // D. Transactional Restore with pre-restore safety backup
    const restoreRes = await app.inject({
      method: 'POST',
      url: `/api/platform/tenants/${testTenantId}/restore`,
      headers: {
        authorization: `Bearer ${superAdminToken}`,
      },
      payload: {
        backupPackage: backupPkg,
        mode: 'MERGE',
      },
    });

    expect(restoreRes.statusCode).toBe(200);
    const restoreData = restoreRes.json();
    expect(restoreData.success).toBe(true);
    expect(restoreData.recordsRestored).toBeGreaterThanOrEqual(1);
  });

  it('6. Support & Helpdesk: creates ticket, posts messages, and updates status', async () => {
    // Create ticket
    const ticketRes = await app.inject({
      method: 'POST',
      url: '/api/platform/tickets',
      headers: {
        authorization: `Bearer ${superAdminToken}`,
      },
      payload: {
        tenantId: testTenantId,
        subject: 'Thermal Receipt Cut Alignment',
        category: TicketCategory.DEVICE,
        priority: TicketPriority.HIGH,
        message: 'Printer cuts receipt before footer prints.',
      },
    });

    expect(ticketRes.statusCode).toBe(201);
    const ticket = ticketRes.json().ticket;
    expect(ticket.ticket_number).toBeDefined();

    // Post reply message
    const msgRes = await app.inject({
      method: 'POST',
      url: `/api/platform/tickets/${ticket.id}/messages`,
      headers: {
        authorization: `Bearer ${superAdminToken}`,
      },
      payload: {
        message: 'Please adjust the paper feed margin in Restaurant Settings -> Receipt Config.',
        isInternal: false,
      },
    });

    expect(msgRes.statusCode).toBe(201);

    // Update status to RESOLVED
    const statusRes = await app.inject({
      method: 'PUT',
      url: `/api/platform/tickets/${ticket.id}/status`,
      headers: {
        authorization: `Bearer ${superAdminToken}`,
      },
      payload: {
        status: 'RESOLVED',
      },
    });

    expect(statusRes.statusCode).toBe(200);
  });

  it('7. System Health & Infrastructure Monitoring: queries live pool metrics and server health', async () => {
    const healthRes = await app.inject({
      method: 'GET',
      url: '/api/platform/system-health',
      headers: {
        authorization: `Bearer ${superAdminToken}`,
      },
    });

    expect(healthRes.statusCode).toBe(200);
    const health = healthRes.json();
    expect(health.apiStatus).toBe('HEALTHY');
    expect(health.database.status).toBe('HEALTHY');
    expect(health.database.latencyMs).toBeGreaterThanOrEqual(0);
    expect(health.system.memoryUsageMb).toBeGreaterThan(0);
    expect(health.system.cpuCount).toBeGreaterThan(0);
  });

  it('8. Platform Global Settings: reads and updates system maintenance mode and defaults', async () => {
    const getRes = await app.inject({
      method: 'GET',
      url: '/api/platform/settings',
      headers: {
        authorization: `Bearer ${superAdminToken}`,
      },
    });

    expect(getRes.statusCode).toBe(200);

    const updateRes = await app.inject({
      method: 'PUT',
      url: '/api/platform/settings',
      headers: {
        authorization: `Bearer ${superAdminToken}`,
      },
      payload: {
        platformName: 'CloudPOS Enterprise SaaS',
        supportEmail: 'support@cloudpos.pk',
        defaultMaxDevices: 5,
        maintenanceMode: false,
      },
    });

    expect(updateRes.statusCode).toBe(200);
    const updated = updateRes.json();
    expect(updated.settings.platform_name).toBe('CloudPOS Enterprise SaaS');
    expect(Number(updated.settings.default_max_devices)).toBe(5);
  });
});
