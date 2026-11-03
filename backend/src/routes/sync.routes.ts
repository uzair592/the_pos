import { FastifyInstance } from 'fastify';
import { query } from '../db/connection.js';
import { authenticate, requireTenant } from '../middleware/auth.js';
import { getSyncEvents } from '../services/syncService.js';

export async function syncRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', authenticate);
  fastify.addHook('preHandler', requireTenant);

  /**
   * Fetch sync events for multi-device live updates
   */
  fastify.get('/api/sync/events', async (req, reply) => {
    const tenantId = req.user!.tenantId!;
    const { branchId, since, limit } = req.query as {
      branchId?: string;
      since?: string;
      limit?: string;
    };

    const targetBranch = branchId || req.user!.branchId || null;
    const events = await getSyncEvents(
      tenantId,
      targetBranch,
      since || null,
      limit ? parseInt(limit, 10) : 50
    );

    return reply.send({
      events,
      serverTime: new Date().toISOString(),
    });
  });

  /**
   * List registered devices for multi-device monitoring
   */
  fastify.get('/api/sync/devices', async (req, reply) => {
    const tenantId = req.user!.tenantId!;
    const { branchId } = req.query as { branchId?: string };

    let sql = `
      SELECT d.*, b.name as branch_name
      FROM registered_devices d
      JOIN branches b ON b.id = d.branch_id
      WHERE d.tenant_id = $1
    `;
    const params: any[] = [tenantId];

    if (branchId) {
      params.push(branchId);
      sql += ` AND d.branch_id = $${params.length}`;
    }

    sql += ' ORDER BY d.last_active_at DESC';

    const { rows } = await query(sql, params, { tenantId });
    return reply.send({ devices: rows });
  });

  /**
   * Device heartbeat / ping
   */
  fastify.post('/api/sync/devices/ping', async (req, reply) => {
    const tenantId = req.user!.tenantId!;
    const { deviceFingerprint, deviceName, deviceType } = req.body as {
      deviceFingerprint: string;
      deviceName?: string;
      deviceType?: string;
    };

    if (!deviceFingerprint) {
      return reply.status(400).send({ error: 'Device fingerprint is required' });
    }

    const branchId = req.user!.branchId;
    if (branchId) {
      await query(
        `
        INSERT INTO registered_devices (
          tenant_id, branch_id, device_fingerprint, device_name, device_type, ip_address, is_active, last_active_at
        ) VALUES ($1, $2, $3, COALESCE($4, 'Terminal'), COALESCE($5, 'POS_TERMINAL'), $6, true, CURRENT_TIMESTAMP)
        ON CONFLICT (tenant_id, device_fingerprint) DO UPDATE SET
          last_active_at = CURRENT_TIMESTAMP,
          device_name = COALESCE(EXCLUDED.device_name, registered_devices.device_name),
          ip_address = EXCLUDED.ip_address,
          is_active = true
        `,
        [tenantId, branchId, deviceFingerprint, deviceName || null, deviceType || null, req.ip],
        { tenantId }
      );
    }

    return reply.send({ ok: true, serverTime: new Date().toISOString() });
  });
}

