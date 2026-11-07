import { FastifyInstance } from 'fastify';
import { query, withTransaction } from '../db/connection.js';
import { authenticate, requireTenant, requirePermission } from '../middleware/auth.js';
import {
  CreateReservationSchema,
  UpdateReservationSchema,
  CreateWaitlistSchema,
  UpdateWaitlistSchema,
  Permission,
  ReservationStatus,
  WaitlistStatus,
  TableStatus,
} from '@pos/shared';
import { emitSyncEvent } from '../services/syncService.js';

export async function reservationRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', authenticate);
  fastify.addHook('preHandler', requireTenant);

  /**
   * ==========================================
   * RESERVATIONS
   * ==========================================
   */

  // 1. List Reservations
  fastify.get('/api/reservations', {
    preHandler: [requirePermission(Permission.RESERVATIONS_VIEW)],
  }, async (req, reply) => {
    const tenantId = req.user!.tenantId!;
    const { branchId, date, status, search } = req.query as {
      branchId?: string;
      date?: string;
      status?: string;
      search?: string;
    };

    let sql = `
      SELECT r.*,
             t.table_number,
             f.name as floor_name,
             b.name as branch_name,
             u.full_name as created_by_name
      FROM reservations r
      LEFT JOIN restaurant_tables t ON t.id = r.table_id
      LEFT JOIN floors f ON f.id = t.floor_id
      LEFT JOIN branches b ON b.id = r.branch_id
      LEFT JOIN users u ON u.id = r.created_by_user_id
      WHERE r.tenant_id = $1
    `;
    const params: any[] = [tenantId];

    if (branchId) {
      params.push(branchId);
      sql += ` AND r.branch_id = $${params.length}`;
    }
    if (date) {
      params.push(date);
      sql += ` AND r.reservation_date = $${params.length}`;
    }
    if (status && status !== 'ALL') {
      params.push(status);
      sql += ` AND r.status = $${params.length}`;
    }
    if (search) {
      params.push(`%${search}%`);
      sql += ` AND (r.customer_name ILIKE $${params.length} OR r.customer_phone ILIKE $${params.length} OR t.table_number ILIKE $${params.length})`;
    }

    sql += ' ORDER BY r.reservation_date DESC, r.reservation_time ASC';

    const { rows } = await query(sql, params, { tenantId });
    return reply.send({ reservations: rows });
  });

  // 2. Create Reservation
  fastify.post('/api/reservations', {
    preHandler: [requirePermission(Permission.RESERVATIONS_MANAGE)],
  }, async (req, reply) => {
    const parsed = CreateReservationSchema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.format() });

    const tenantId = req.user!.tenantId!;
    const {
      branchId,
      customerName,
      customerPhone,
      customerEmail,
      guestCount,
      tableId,
      reservationDate,
      reservationTime,
      durationMinutes,
      specialRequests,
    } = parsed.data;

    // Check conflict / double booking if table is specified
    if (tableId) {
      const conflictRes = await query(
        `SELECT id, customer_name, reservation_time
         FROM reservations
         WHERE tenant_id = $1
           AND branch_id = $2
           AND table_id = $3
           AND reservation_date = $4
           AND (
             reservation_time = $5
             OR (
               reservation_time::time,
               reservation_time::time + (COALESCE(duration_minutes, 90) || ' minutes')::interval
             ) OVERLAPS (
               $5::time,
               $5::time + (COALESCE($6, 90) || ' minutes')::interval
             )
           )
           AND status IN ('CONFIRMED', 'PENDING', 'SEATED')`,
        [tenantId, branchId, tableId, reservationDate, reservationTime, durationMinutes],
        { tenantId }
      );
      if (conflictRes.rows.length > 0) {
        return reply.status(409).send({
          error: `Table is already reserved at ${reservationTime} for ${conflictRes.rows[0].customer_name}. Please choose another table or time.`,
        });
      }
    }

    const { rows } = await query(
      `INSERT INTO reservations (
        tenant_id, branch_id, customer_name, customer_phone, customer_email,
        guest_count, table_id, reservation_date, reservation_time, duration_minutes,
        status, special_requests, created_by_user_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'CONFIRMED', $11, $12)
      RETURNING *`,
      [
        tenantId,
        branchId,
        customerName,
        customerPhone,
        customerEmail || null,
        guestCount,
        tableId || null,
        reservationDate,
        reservationTime,
        durationMinutes,
        specialRequests || null,
        req.user!.id,
      ],
      { tenantId }
    );

    // If reservation is for today, mark table status as RESERVED
    const todayYMD = new Date().toISOString().split('T')[0];
    if (tableId && reservationDate === todayYMD) {
      await query(
        "UPDATE restaurant_tables SET status = 'RESERVED' WHERE id = $1 AND tenant_id = $2 AND status = 'AVAILABLE'",
        [tableId, tenantId],
        { tenantId }
      );
    }

    await emitSyncEvent(query, {
      tenantId,
      branchId,
      eventType: 'RESERVATION_CREATED',
      entityId: rows[0].id,
      payload: { reservation: rows[0] },
    });

    return reply.status(201).send({ reservation: rows[0] });
  });

  // 3. Update Reservation
  fastify.put('/api/reservations/:id', {
    preHandler: [requirePermission(Permission.RESERVATIONS_MANAGE)],
  }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const tenantId = req.user!.tenantId!;

    const parsed = UpdateReservationSchema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.format() });

    const existing = await query(
      'SELECT * FROM reservations WHERE id = $1 AND tenant_id = $2',
      [id, tenantId],
      { tenantId }
    );
    if (existing.rows.length === 0) return reply.status(404).send({ error: 'Reservation not found' });
    const current = existing.rows[0];

    const data = parsed.data;

    const { rows } = await query(
      `UPDATE reservations
       SET table_id = COALESCE($1, table_id),
           customer_name = COALESCE($2, customer_name),
           customer_phone = COALESCE($3, customer_phone),
           customer_email = COALESCE($4, customer_email),
           guest_count = COALESCE($5, guest_count),
           reservation_date = COALESCE($6, reservation_date),
           reservation_time = COALESCE($7, reservation_time),
           duration_minutes = COALESCE($8, duration_minutes),
           status = COALESCE($9, status),
           special_requests = COALESCE($10, special_requests),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $11 AND tenant_id = $12
       RETURNING *`,
      [
        data.tableId !== undefined ? data.tableId : current.table_id,
        data.customerName || null,
        data.customerPhone || null,
        data.customerEmail || null,
        data.guestCount || null,
        data.reservationDate || null,
        data.reservationTime || null,
        data.durationMinutes || null,
        data.status || null,
        data.specialRequests !== undefined ? data.specialRequests : null,
        id,
        tenantId,
      ],
      { tenantId }
    );

    return reply.send({ reservation: rows[0] });
  });

  // 4. Cancel Reservation
  fastify.post('/api/reservations/:id/cancel', {
    preHandler: [requirePermission(Permission.RESERVATIONS_MANAGE)],
  }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const tenantId = req.user!.tenantId!;

    const { rows } = await query(
      `UPDATE reservations
       SET status = 'CANCELLED', updated_at = CURRENT_TIMESTAMP
       WHERE id = $1 AND tenant_id = $2
       RETURNING *`,
      [id, tenantId],
      { tenantId }
    );
    if (rows.length === 0) return reply.status(404).send({ error: 'Reservation not found' });

    // Free table if was reserved
    if (rows[0].table_id) {
      await query(
        "UPDATE restaurant_tables SET status = 'AVAILABLE' WHERE id = $1 AND tenant_id = $2 AND status = 'RESERVED'",
        [rows[0].table_id, tenantId],
        { tenantId }
      );
    }

    return reply.send({ reservation: rows[0], message: 'Reservation cancelled successfully' });
  });

  // 5. Seat Customer (Convert Reservation to Seated)
  fastify.post('/api/reservations/:id/seat', {
    preHandler: [requirePermission(Permission.RESERVATIONS_MANAGE)],
  }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const tenantId = req.user!.tenantId!;
    const { tableId } = (req.body as { tableId?: string }) || {};

    const existing = await query(
      'SELECT * FROM reservations WHERE id = $1 AND tenant_id = $2',
      [id, tenantId],
      { tenantId }
    );
    if (existing.rows.length === 0) return reply.status(404).send({ error: 'Reservation not found' });
    const resRow = existing.rows[0];

    const targetTableId = tableId || resRow.table_id;
    if (!targetTableId) {
      return reply.status(400).send({ error: 'Please select a dining table to seat the customer.' });
    }

    const { rows } = await query(
      `UPDATE reservations
       SET status = 'SEATED', table_id = $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2 AND tenant_id = $3
       RETURNING *`,
      [targetTableId, id, tenantId],
      { tenantId }
    );

    // Update Table to OCCUPIED
    await query(
      "UPDATE restaurant_tables SET status = 'OCCUPIED' WHERE id = $1 AND tenant_id = $2",
      [targetTableId, tenantId],
      { tenantId }
    );

    await emitSyncEvent(query, {
      tenantId,
      branchId: resRow.branch_id,
      eventType: 'RESERVATION_SEATED',
      entityId: id,
      payload: { reservationId: id, tableId: targetTableId },
    });

    return reply.send({ reservation: rows[0], message: 'Customer seated at table' });
  });

  /**
   * ==========================================
   * WAITLIST MANAGEMENT
   * ==========================================
   */

  // 6. List Waitlist
  fastify.get('/api/waitlist', {
    preHandler: [requirePermission(Permission.WAITLIST_MANAGE)],
  }, async (req, reply) => {
    const tenantId = req.user!.tenantId!;
    const { branchId, status } = req.query as { branchId?: string; status?: string };

    let sql = `
      SELECT w.*,
             t.table_number as assigned_table_number,
             f.name as floor_name,
             b.name as branch_name,
             EXTRACT(EPOCH FROM (NOW() - w.created_at)) / 60 as waiting_minutes
      FROM waitlist w
      LEFT JOIN restaurant_tables t ON t.id = w.assigned_table_id
      LEFT JOIN floors f ON f.id = t.floor_id
      LEFT JOIN branches b ON b.id = w.branch_id
      WHERE w.tenant_id = $1
    `;
    const params: any[] = [tenantId];

    if (branchId) {
      params.push(branchId);
      sql += ` AND w.branch_id = $${params.length}`;
    }
    if (status && status !== 'ALL') {
      params.push(status);
      sql += ` AND w.status = $${params.length}`;
    } else if (!status) {
      // By default show active waiting and notified customers
      sql += " AND w.status IN ('WAITING', 'NOTIFIED')";
    }

    sql += ' ORDER BY w.queue_number ASC, w.created_at ASC';

    const { rows } = await query(sql, params, { tenantId });
    return reply.send({ waitlist: rows });
  });

  // 7. Add Customer to Waitlist
  fastify.post('/api/waitlist', {
    preHandler: [requirePermission(Permission.WAITLIST_MANAGE)],
  }, async (req, reply) => {
    const parsed = CreateWaitlistSchema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.format() });

    const tenantId = req.user!.tenantId!;
    const { branchId, customerName, customerPhone, guestCount, estimatedWaitMinutes, notes, assignedTableId } = parsed.data;

    // Calculate next queue number for today
    const qRes = await query(
      `SELECT COALESCE(MAX(queue_number), 0) + 1 as next_queue
       FROM waitlist
       WHERE tenant_id = $1 AND branch_id = $2 AND created_at >= CURRENT_DATE`,
      [tenantId, branchId],
      { tenantId }
    );
    const queueNumber = qRes.rows[0].next_queue;

    const { rows } = await query(
      `INSERT INTO waitlist (
        tenant_id, branch_id, customer_name, customer_phone, guest_count,
        queue_number, estimated_wait_minutes, status, assigned_table_id, notes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'WAITING', $8, $9)
      RETURNING *`,
      [
        tenantId,
        branchId,
        customerName,
        customerPhone,
        guestCount,
        queueNumber,
        estimatedWaitMinutes,
        assignedTableId || null,
        notes || null,
      ],
      { tenantId }
    );

    await emitSyncEvent(query, {
      tenantId,
      branchId,
      eventType: 'WAITLIST_ADDED',
      entityId: rows[0].id,
      payload: { waitlistEntry: rows[0] },
    });

    return reply.status(201).send({ entry: rows[0] });
  });

  // 8. Update Waitlist Entry
  fastify.put('/api/waitlist/:id', {
    preHandler: [requirePermission(Permission.WAITLIST_MANAGE)],
  }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const tenantId = req.user!.tenantId!;

    const parsed = UpdateWaitlistSchema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.format() });

    const data = parsed.data;

    const { rows } = await query(
      `UPDATE waitlist
       SET status = COALESCE($1, status),
           assigned_table_id = COALESCE($2, assigned_table_id),
           notes = COALESCE($3, notes),
           estimated_wait_minutes = COALESCE($4, estimated_wait_minutes),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $5 AND tenant_id = $6
       RETURNING *`,
      [data.status || null, data.assignedTableId || null, data.notes || null, data.estimatedWaitMinutes || null, id, tenantId],
      { tenantId }
    );
    if (rows.length === 0) return reply.status(404).send({ error: 'Waitlist entry not found' });

    return reply.send({ entry: rows[0] });
  });

  // 9. Notify Customer (SMS/Alert Ready)
  fastify.post('/api/waitlist/:id/notify', {
    preHandler: [requirePermission(Permission.WAITLIST_MANAGE)],
  }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const tenantId = req.user!.tenantId!;

    const { rows } = await query(
      `UPDATE waitlist
       SET status = 'NOTIFIED', notified_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
       WHERE id = $1 AND tenant_id = $2
       RETURNING *`,
      [id, tenantId],
      { tenantId }
    );
    if (rows.length === 0) return reply.status(404).send({ error: 'Waitlist entry not found' });

    return reply.send({ entry: rows[0], message: `Customer ${rows[0].customer_name} notified that table is ready` });
  });

  // 10. Mark Seated from Waitlist
  fastify.post('/api/waitlist/:id/seat', {
    preHandler: [requirePermission(Permission.WAITLIST_MANAGE)],
  }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const tenantId = req.user!.tenantId!;
    const { tableId } = (req.body as { tableId?: string }) || {};

    const existing = await query(
      'SELECT * FROM waitlist WHERE id = $1 AND tenant_id = $2',
      [id, tenantId],
      { tenantId }
    );
    if (existing.rows.length === 0) return reply.status(404).send({ error: 'Waitlist entry not found' });
    const current = existing.rows[0];

    const targetTableId = tableId || current.assigned_table_id;
    if (!targetTableId) {
      return reply.status(400).send({ error: 'Please assign a table before seating the customer' });
    }

    const { rows } = await query(
      `UPDATE waitlist
       SET status = 'SEATED', assigned_table_id = $1, seated_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2 AND tenant_id = $3
       RETURNING *`,
      [targetTableId, id, tenantId],
      { tenantId }
    );

    // Update Table status to OCCUPIED
    await query(
      "UPDATE restaurant_tables SET status = 'OCCUPIED' WHERE id = $1 AND tenant_id = $2",
      [targetTableId, tenantId],
      { tenantId }
    );

    await emitSyncEvent(query, {
      tenantId,
      branchId: current.branch_id,
      eventType: 'WAITLIST_SEATED',
      entityId: id,
      payload: { waitlistId: id, tableId: targetTableId },
    });

    return reply.send({ entry: rows[0], message: 'Customer seated at table' });
  });

  // 11. Delete / Remove from Waitlist
  fastify.delete('/api/waitlist/:id', {
    preHandler: [requirePermission(Permission.WAITLIST_MANAGE)],
  }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const tenantId = req.user!.tenantId!;

    await query(
      `UPDATE waitlist SET status = 'CANCELLED', updated_at = CURRENT_TIMESTAMP WHERE id = $1 AND tenant_id = $2`,
      [id, tenantId],
      { tenantId }
    );

    return reply.send({ message: 'Removed from waitlist' });
  });
}
