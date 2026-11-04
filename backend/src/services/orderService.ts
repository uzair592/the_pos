import pg from 'pg';
import { query, withTransaction } from '../db/connection.js';
import {
  OrderType,
  OrderStatus,
  PaymentStatus,
  PaymentMethod,
  PrepStation,
  PrepStatus,
  TableStatus,
} from '@pos/shared';
import { deductInventoryForOrder, restockInventoryForRefund } from './inventoryService.js';
import { logAuditEvent } from './auditService.js';

export interface CreateOrderParams {
  tenantId: string;
  branchId: string;
  cashierId: string;
  cashierName: string;
  orderType: OrderType;
  tableId?: string | null;
  coverCount?: number;
  customerId?: string | null;
  customerName?: string;
  customerPhone?: string;
  deliveryAddress?: string;
  deliveryFee?: number;
  riderName?: string;
  riderPhone?: string;
  billDiscountPercent?: number;
  billDiscountAmount?: number;
  waiterId?: string | null;
  shiftId?: string | null;
  orderNotes?: string;
  idempotencyKey?: string | null;
  items: Array<{
    productId: string;
    variantId?: string | null;
    quantity: number;
    unitPrice: number;
    notes?: string;
    itemDiscount?: number;
    modifiers?: Array<{
      groupId?: string;
      groupName?: string;
      optionId?: string;
      optionName?: string;
      name?: string;
      unitPrice: number;
    }>;
  }>;
}

export async function createOrder(params: CreateOrderParams) {
  return await withTransaction(async (client) => {
    const {
      tenantId,
      branchId,
      cashierId,
      cashierName,
      orderType,
      tableId,
      coverCount = 1,
      customerId,
      customerName,
      customerPhone,
      deliveryAddress,
      deliveryFee = 0,
      riderName,
      riderPhone,
      billDiscountPercent = 0,
      billDiscountAmount = 0,
      waiterId,
      shiftId,
      orderNotes,
      idempotencyKey,
      items,
    } = params;

    // 1. Idempotency Check
    if (idempotencyKey) {
      const existing = await client.query(
        'SELECT * FROM orders WHERE tenant_id = $1 AND idempotency_key = $2',
        [tenantId, idempotencyKey]
      );
      if (existing.rows.length > 0) {
        return { order: existing.rows[0], duplicate: true };
      }
    }

    // 2. Fetch Restaurant Settings for Taxes & Prefixes
    const settingsRes = await client.query(
      'SELECT tax_rate_percent, service_charge_percent, is_tax_inclusive, order_number_prefix, kot_number_prefix FROM restaurant_settings WHERE tenant_id = $1',
      [tenantId]
    );
    const settings = settingsRes.rows[0] || {
      tax_rate_percent: 16.0,
      service_charge_percent: 0.0,
      is_tax_inclusive: false,
      order_number_prefix: 'ORD-',
      kot_number_prefix: 'KOT-',
    };

    const taxPercent = Number(settings.tax_rate_percent) || 0;
    const servicePercent = Number(settings.service_charge_percent) || 0;

    // 3. Generate Order Number
    const countRes = await client.query(
      'SELECT COUNT(*)::int as count FROM orders WHERE tenant_id = $1',
      [tenantId]
    );
    const orderIndex = (countRes.rows[0]?.count || 0) + 1;
    const orderNumber = `${settings.order_number_prefix}${new Date().getFullYear()}-${orderIndex.toString().padStart(5, '0')}`;

    // 4. Resolve Table details
    let tableNumber: string | null = null;
    let floorName: string | null = null;
    if (tableId) {
      const tableRes = await client.query(
        `
        SELECT t.table_number, f.name as floor_name
        FROM restaurant_tables t
        JOIN floors f ON f.id = t.floor_id
        WHERE t.id = $1 AND t.tenant_id = $2
        `,
        [tableId, tenantId]
      );
      if (tableRes.rows.length > 0) {
        tableNumber = tableRes.rows[0].table_number;
        floorName = tableRes.rows[0].floor_name;
      }
    }

    // 5. Calculate Items
    let subtotal = 0;
    let itemDiscountsTotal = 0;
    const computedItems: any[] = [];

    for (const item of items) {
      // Get product info
      const prodRes = await client.query(
        'SELECT name, station, cost_price FROM products WHERE id = $1 AND tenant_id = $2',
        [item.productId, tenantId]
      );
      if (prodRes.rows.length === 0) {
        throw new Error(`Product not found: ${item.productId}`);
      }
      const prod = prodRes.rows[0];

      let variantName: string | null = null;
      let costPrice = Number(prod.cost_price) || 0;

      if (item.variantId) {
        const varRes = await client.query(
          'SELECT name, cost_price FROM product_variants WHERE id = $1 AND product_id = $2 AND tenant_id = $3',
          [item.variantId, item.productId, tenantId]
        );
        if (varRes.rows.length > 0) {
          variantName = varRes.rows[0].name;
          if (varRes.rows[0].cost_price > 0) {
            costPrice = Number(varRes.rows[0].cost_price);
          }
        }
      }

      // Sum modifiers price
      const modifiers = item.modifiers || [];
      const modifiersTotal = modifiers.reduce((acc, m) => acc + Number(m.unitPrice || 0), 0);
      const effectiveUnitPrice = Number(item.unitPrice) + modifiersTotal;
      const itemSubtotal = effectiveUnitPrice * item.quantity;
      const discount = Number(item.itemDiscount) || 0;
      const itemTotal = Math.max(0, itemSubtotal - discount);

      subtotal += itemSubtotal;
      itemDiscountsTotal += discount;

      computedItems.push({
        productId: item.productId,
        productName: prod.name,
        variantId: item.variantId || null,
        variantName,
        station: prod.station || PrepStation.KITCHEN,
        quantity: item.quantity,
        unitPrice: effectiveUnitPrice,
        costPrice,
        modifiers: JSON.stringify(modifiers),
        notes: item.notes || null,
        itemDiscount: discount,
        taxAmount: 0, // calculated proportionately if needed
        totalPrice: itemTotal,
      });
    }

    // 6. Calculate Totals
    const effectiveBillDiscount = billDiscountAmount > 0
      ? billDiscountAmount
      : (subtotal - itemDiscountsTotal) * (billDiscountPercent / 100);
    const totalDiscount = itemDiscountsTotal + effectiveBillDiscount;
    const discountedSubtotal = Math.max(0, subtotal - totalDiscount);

    let taxAmount = 0;
    if (taxPercent > 0) {
      if (settings.is_tax_inclusive) {
        // Price includes tax: tax = total - (total / (1 + rate))
        taxAmount = discountedSubtotal - (discountedSubtotal / (1 + taxPercent / 100));
      } else {
        taxAmount = discountedSubtotal * (taxPercent / 100);
      }
    }

    const serviceChargeAmount = discountedSubtotal * (servicePercent / 100);
    const grandTotal = Math.round((discountedSubtotal + (settings.is_tax_inclusive ? 0 : taxAmount) + serviceChargeAmount + deliveryFee) * 100) / 100;

    // 7. Insert Order
    const insertOrderRes = await client.query(
      `
      INSERT INTO orders (
        tenant_id, branch_id, order_number, order_type, status, payment_status,
        table_id, table_number, floor_name, cover_count,
        customer_id, customer_name, customer_phone, delivery_address, delivery_fee, rider_name, rider_phone,
        subtotal, item_discounts_total, bill_discount_percent, bill_discount_amount, total_discount,
        tax_percent, tax_amount, service_charge_percent, service_charge_amount,
        grand_total, paid_amount, balance_due,
        cashier_id, cashier_name, waiter_id, shift_id, order_notes, idempotency_key
      ) VALUES (
        $1, $2, $3, $4, $5, $6,
        $7, $8, $9, $10,
        $11, $12, $13, $14, $15, $16, $17,
        $18, $19, $20, $21, $22,
        $23, $24, $25, $26,
        $27, $28, $29,
        $30, $31, $32, $33, $34, $35
      ) RETURNING *
      `,
      [
        tenantId, branchId, orderNumber, orderType, OrderStatus.CONFIRMED, PaymentStatus.PENDING,
        tableId || null, tableNumber, floorName, coverCount,
        customerId || null, customerName || null, customerPhone || null, deliveryAddress || null, deliveryFee, riderName || null, riderPhone || null,
        subtotal, itemDiscountsTotal, billDiscountPercent, billDiscountAmount, totalDiscount,
        taxPercent, taxAmount, servicePercent, serviceChargeAmount,
        grandTotal, 0, grandTotal,
        cashierId, cashierName, waiterId || null, shiftId || null, orderNotes || null, idempotencyKey || null,
      ]
    );

    const createdOrder = insertOrderRes.rows[0];

    // 8. Insert Order Items & Group for KOTs
    const kotStationItems: Record<string, any[]> = {};

    for (const item of computedItems) {
      const itemInsert = await client.query(
        `
        INSERT INTO order_items (
          tenant_id, order_id, product_id, product_name, variant_id, variant_name,
          station, quantity, unit_price, cost_price, modifiers, notes, item_discount, tax_amount, total_price
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
        RETURNING id
        `,
        [
          tenantId, createdOrder.id, item.productId, item.productName, item.variantId, item.variantName,
          item.station, item.quantity, item.unitPrice, item.costPrice, item.modifiers, item.notes,
          item.itemDiscount, item.taxAmount, item.totalPrice,
        ]
      );

      const orderItemId = itemInsert.rows[0].id;
      const station = item.station;
      if (!kotStationItems[station]) {
        kotStationItems[station] = [];
      }
      kotStationItems[station].push({
        ...item,
        orderItemId,
      });
    }

    // 9. Generate KOT (Kitchen Order Tickets) for Stations
    let kotCounter = 1;
    for (const [station, sItems] of Object.entries(kotStationItems)) {
      const kotNumber = `${settings.kot_number_prefix}${orderNumber}-${station}-${kotCounter++}`;
      const kotRes = await client.query(
        `
        INSERT INTO kitchen_tickets (
          tenant_id, branch_id, kot_number, order_id, order_number, order_type,
          table_number, server_name, station, status, notes
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING id
        `,
        [
          tenantId, branchId, kotNumber, createdOrder.id, orderNumber, orderType,
          tableNumber, cashierName, station, PrepStatus.PENDING, orderNotes || null,
        ]
      );

      const kotId = kotRes.rows[0].id;
      for (const sItem of sItems) {
        let modSummary = '';
        try {
          const parsedMods = JSON.parse(sItem.modifiers);
          if (Array.isArray(parsedMods) && parsedMods.length > 0) {
            modSummary = parsedMods.map((m: any) => m.name || m.optionName).filter(Boolean).join(', ');
          }
        } catch (_) {}

        await client.query(
          `
          INSERT INTO kitchen_ticket_items (
            tenant_id, kot_id, order_item_id, product_id, product_name, variant_name,
            quantity, modifiers_summary, notes, station, status
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
          `,
          [
            tenantId, kotId, sItem.orderItemId, sItem.productId, sItem.productName, sItem.variantName || null,
            sItem.quantity, modSummary || null, sItem.notes || null, station, PrepStatus.PENDING,
          ]
        );
      }
    }

    // 10. Update Table Status to OCCUPIED if Dine-in
    if (tableId) {
      await client.query(
        'UPDATE restaurant_tables SET status = $1, current_order_id = $2 WHERE id = $3 AND tenant_id = $4',
        [TableStatus.OCCUPIED, createdOrder.id, tableId, tenantId]
      );
    }

    return { order: createdOrder, duplicate: false };
  }, { tenantId: params.tenantId });
}

export interface CompleteCheckoutParams {
  tenantId: string;
  orderId: string;
  userId: string;
  payments: Array<{
    amount: number;
    method: PaymentMethod;
    reference?: string;
  }>;
  changeGiven?: number;
  idempotencyKey?: string;
}

export async function completeOrderCheckout(params: CompleteCheckoutParams) {
  return await withTransaction(async (client) => {
    const { tenantId, orderId, userId, payments, changeGiven = 0 } = params;

    // 1. Fetch Order with Lock
    const orderRes = await client.query(
      'SELECT * FROM orders WHERE id = $1 AND tenant_id = $2 FOR UPDATE',
      [orderId, tenantId]
    );

    if (orderRes.rows.length === 0) {
      throw new Error('Order not found');
    }

    const order = orderRes.rows[0];
    if (order.status === OrderStatus.COMPLETED) {
      return { order, message: 'Order is already completed' };
    }

    const grandTotal = Number(order.grand_total);
    const existingPaid = Number(order.paid_amount);
    const newlyPaid = payments.reduce((acc, p) => acc + Number(p.amount), 0);
    const totalPaid = existingPaid + newlyPaid;

    if (totalPaid < grandTotal) {
      throw new Error(`Insufficient payment. Grand Total: ${grandTotal}, Provided: ${totalPaid}`);
    }

    // 2. Record Payments
    for (const pay of payments) {
      let bankAccountId: string | null = (pay as any).bankAccountId || null;
      if (!bankAccountId && [PaymentMethod.BANK_TRANSFER, PaymentMethod.CARD, PaymentMethod.DIGITAL_WALLET].includes(pay.method)) {
        const defBank = await client.query(
          `SELECT id FROM bank_accounts WHERE tenant_id = $1 AND is_active = true ORDER BY is_default DESC, created_at ASC LIMIT 1`,
          [tenantId]
        );
        if (defBank.rows.length > 0) {
          bankAccountId = defBank.rows[0].id;
        }
      }

      await client.query(
        `
        INSERT INTO order_payments (tenant_id, order_id, amount, method, reference, change_amount, bank_account_id, recorded_by_user_id)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        `,
        [tenantId, orderId, pay.amount, pay.method, pay.reference || null, changeGiven, bankAccountId, userId]
      );

      // If deposited to bank account, increment bank account current balance
      if (bankAccountId) {
        await client.query(
          `
          UPDATE bank_accounts
          SET current_balance = current_balance + $1,
              updated_at = CURRENT_TIMESTAMP
          WHERE id = $2 AND tenant_id = $3
          `,
          [pay.amount, bankAccountId, tenantId]
        );
      }

      // If attached to a shift, update shift cash sales
      if (order.shift_id && pay.method === PaymentMethod.CASH) {
        const netCash = Number(pay.amount) - changeGiven;
        await client.query(
          `
          UPDATE register_shifts
          SET total_cash_sales = total_cash_sales + $1,
              expected_cash = expected_cash + $1
          WHERE id = $2 AND tenant_id = $3
          `,
          [netCash, order.shift_id, tenantId]
        );
      }

      // If customer credit, update customer outstanding balance
      if (pay.method === PaymentMethod.CUSTOMER_CREDIT && order.customer_id) {
        await client.query(
          `
          UPDATE customers
          SET outstanding_balance = outstanding_balance + $1,
              total_spent = total_spent + $1,
              total_orders = total_orders + 1
          WHERE id = $2 AND tenant_id = $3
          `,
          [pay.amount, order.customer_id, tenantId]
        );
      }
    }

    // 3. Update Order Status
    const updateRes = await client.query(
      `
      UPDATE orders
      SET status = $1, payment_status = $2, paid_amount = $3, change_given = $4, balance_due = 0, completed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
      WHERE id = $5 AND tenant_id = $6
      RETURNING *
      `,
      [OrderStatus.COMPLETED, PaymentStatus.PAID, totalPaid, changeGiven, orderId, tenantId]
    );

    const completedOrder = updateRes.rows[0];

    // 4. Free Table if assigned
    if (order.table_id) {
      await client.query(
        'UPDATE restaurant_tables SET status = $1, current_order_id = NULL WHERE id = $2 AND tenant_id = $3',
        [TableStatus.AVAILABLE, order.table_id, tenantId]
      );
    }

    // 5. Automatic Recipe Inventory Deduction
    await deductInventoryForOrder(client, tenantId, order.branch_id, orderId, userId);

    // 6. Log Audit Event
    await logAuditEvent({
      tenantId,
      branchId: order.branch_id,
      actorId: userId,
      actorRole: 'STAFF',
      action: 'ORDER_CHECKOUT_COMPLETED',
      resourceType: 'ORDER',
      resourceId: orderId,
      metadata: { orderNumber: order.order_number, grandTotal, totalPaid, payments },
    });

    return { order: completedOrder, success: true };
  }, { tenantId: params.tenantId });
}

export interface ProcessRefundParams {
  tenantId: string;
  orderId: string;
  userId: string;
  userName: string;
  paymentMethod: PaymentMethod;
  reason: string;
  restockStock: boolean;
  itemIds?: string[];
}

export async function processOrderRefund(params: ProcessRefundParams) {
  return await withTransaction(async (client) => {
    const { tenantId, orderId, userId, paymentMethod, reason, restockStock, itemIds } = params;

    // 1. Fetch Order
    const orderRes = await client.query(
      'SELECT * FROM orders WHERE id = $1 AND tenant_id = $2 FOR UPDATE',
      [orderId, tenantId]
    );
    if (orderRes.rows.length === 0) throw new Error('Order not found');
    const order = orderRes.rows[0];

    // 2. Determine Items and Refund Amount
    let itemQuery = 'SELECT * FROM order_items WHERE order_id = $1 AND tenant_id = $2';
    const queryParams: any[] = [orderId, tenantId];
    if (itemIds && itemIds.length > 0) {
      itemQuery += ' AND id = ANY($3)';
      queryParams.push(itemIds);
    }

    const itemsRes = await client.query(itemQuery, queryParams);
    if (itemsRes.rows.length === 0) throw new Error('No items to refund');

    const refundAmount = itemsRes.rows.reduce((acc, it) => acc + Number(it.total_price), 0);

    // 3. Generate Refund Number
    const countRes = await client.query('SELECT COUNT(*)::int as count FROM order_refunds WHERE tenant_id = $1', [tenantId]);
    const refCount = (countRes.rows[0]?.count || 0) + 1;
    const refundNumber = `REF-${new Date().getFullYear()}-${refCount.toString().padStart(5, '0')}`;

    // 4. Create Refund Record
    const refundRes = await client.query(
      `
      INSERT INTO order_refunds (
        tenant_id, branch_id, order_id, order_number, refund_number,
        total_refund_amount, payment_method, reason, authorized_by_user_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING id, refund_number
      `,
      [
        tenantId, order.branch_id, orderId, order.order_number, refundNumber,
        refundAmount, paymentMethod, reason, userId,
      ]
    );
    const refund = refundRes.rows[0];

    // 5. Insert Refund Items
    for (const it of itemsRes.rows) {
      await client.query(
        `
        INSERT INTO refund_items (
          tenant_id, refund_id, order_item_id, product_name,
          quantity, unit_price, refund_amount, restock_stock
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        `,
        [tenantId, refund.id, it.id, it.product_name, it.quantity, it.unit_price, it.total_price, restockStock]
      );
    }

    // 6. Update Shift Cash if cash refund
    if (order.shift_id && paymentMethod === PaymentMethod.CASH) {
      await client.query(
        `
        UPDATE register_shifts
        SET total_cash_refunds = total_cash_refunds + $1,
            expected_cash = expected_cash - $1
        WHERE id = $2 AND tenant_id = $3
        `,
        [refundAmount, order.shift_id, tenantId]
      );
    }

    // 7. Update Order status
    await client.query(
      `
      UPDATE orders
      SET status = $1, payment_status = $2, updated_at = CURRENT_TIMESTAMP
      WHERE id = $3 AND tenant_id = $4
      `,
      [OrderStatus.REFUNDED, PaymentStatus.REFUNDED, orderId, tenantId]
    );

    // 8. Restock stock if requested
    if (restockStock) {
      await restockInventoryForRefund(client, tenantId, order.branch_id, orderId, refund.id, userId, itemIds);
    }

    // 9. Log Audit Event
    await logAuditEvent({
      tenantId,
      branchId: order.branch_id,
      actorId: userId,
      actorRole: 'STAFF',
      action: 'ORDER_REFUNDED',
      resourceType: 'REFUND',
      resourceId: refund.id,
      metadata: { orderNumber: order.order_number, refundNumber, refundAmount, reason },
    });

    return { success: true, refund };
  }, { tenantId: params.tenantId });
}
