import pg from 'pg';
import { query } from '../db/connection.js';
import { StockMovementType, StockUnit } from '@pos/shared';

export interface CreateBatchParams {
  tenantId: string;
  branchId: string;
  ingredientId: string;
  purchaseItemId?: string | null;
  quantityReceived: number;
  unitCost: number;
  receivedAt?: Date | string;
}

/**
 * Create a new inventory batch / stock lot
 */
export async function createInventoryBatch(
  client: pg.PoolClient,
  params: CreateBatchParams
) {
  const {
    tenantId,
    branchId,
    ingredientId,
    purchaseItemId = null,
    quantityReceived,
    unitCost,
    receivedAt = new Date(),
  } = params;

  const res = await client.query(
    `
    INSERT INTO inventory_batches (
      tenant_id, branch_id, ingredient_id, purchase_item_id,
      quantity_received, quantity_remaining, unit_cost, received_at, status
    ) VALUES ($1, $2, $3, $4, $5, $5, $6, $7, 'ACTIVE')
    RETURNING *;
    `,
    [tenantId, branchId, ingredientId, purchaseItemId, quantityReceived, unitCost, receivedAt]
  );

  return res.rows[0];
}

/**
 * Strict FIFO Consumption for a specific ingredient
 */
export async function consumeIngredientFIFO(
  client: pg.PoolClient,
  params: {
    tenantId: string;
    branchId: string;
    ingredientId: string;
    qtyNeeded: number;
    orderId: string;
    orderItemId: string;
  }
): Promise<{ totalCost: number; consumptions: Array<{ batchId: string; quantity: number; unitCost: number; totalCost: number }> }> {
  const { tenantId, branchId, ingredientId, qtyNeeded, orderId, orderItemId } = params;

  // 1. Fetch active batches ordered oldest first (FIFO) with row lock
  const batchesRes = await client.query(
    `
    SELECT id, quantity_remaining, unit_cost, received_at
    FROM inventory_batches
    WHERE tenant_id = $1 AND branch_id = $2 AND ingredient_id = $3
      AND status = 'ACTIVE' AND quantity_remaining > 0
    ORDER BY received_at ASC, created_at ASC
    FOR UPDATE
    `,
    [tenantId, branchId, ingredientId]
  );

  let remaining = qtyNeeded;
  let totalCost = 0;
  const consumptions: Array<{ batchId: string; quantity: number; unitCost: number; totalCost: number }> = [];

  for (const batch of batchesRes.rows) {
    if (remaining <= 0) break;

    const available = Number(batch.quantity_remaining);
    const take = Math.min(available, remaining);
    const unitCost = Number(batch.unit_cost);
    const cost = take * unitCost;

    totalCost += cost;
    remaining -= take;

    const newRemaining = available - take;
    const newStatus = newRemaining <= 0 ? 'EXHAUSTED' : 'ACTIVE';

    // Update batch quantity and status
    await client.query(
      `
      UPDATE inventory_batches
      SET quantity_remaining = $1, status = $2
      WHERE id = $3
      `,
      [newRemaining, newStatus, batch.id]
    );

    // Record consumption link
    await client.query(
      `
      INSERT INTO order_item_batch_consumptions (
        tenant_id, branch_id, order_id, order_item_id, batch_id,
        ingredient_id, quantity, unit_cost, total_cost, reference_type, reference_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'ORDER', $10)
      `,
      [tenantId, branchId, orderId, orderItemId, batch.id, ingredientId, take, unitCost, cost, orderId]
    );

    consumptions.push({
      batchId: batch.id,
      quantity: take,
      unitCost,
      totalCost: cost,
    });
  }

  // If there wasn't enough batch stock, handle fallback at ingredient baseline cost
  if (remaining > 0) {
    const ingRes = await client.query(
      'SELECT cost_per_unit, name FROM ingredients WHERE id = $1 AND tenant_id = $2',
      [ingredientId, tenantId]
    );
    const baseCost = ingRes.rows.length > 0 ? Number(ingRes.rows[0].cost_per_unit) : 0;
    const fallbackCost = remaining * baseCost;
    totalCost += fallbackCost;

    // Create a shortfall or negative batch entry so FIFO records remain intact
    const autoBatchRes = await client.query(
      `
      INSERT INTO inventory_batches (
        tenant_id, branch_id, ingredient_id, purchase_item_id,
        quantity_received, quantity_remaining, unit_cost, received_at, status
      ) VALUES ($1, $2, $3, NULL, $4, 0, $5, CURRENT_TIMESTAMP, 'EXHAUSTED')
      RETURNING id
      `,
      [tenantId, branchId, ingredientId, remaining, baseCost]
    );

    const autoBatchId = autoBatchRes.rows[0].id;
    await client.query(
      `
      INSERT INTO order_item_batch_consumptions (
        tenant_id, branch_id, order_id, order_item_id, batch_id,
        ingredient_id, quantity, unit_cost, total_cost, reference_type, reference_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'ORDER', $10)
      `,
      [tenantId, branchId, orderId, orderItemId, autoBatchId, ingredientId, remaining, baseCost, fallbackCost, orderId]
    );

    consumptions.push({
      batchId: autoBatchId,
      quantity: remaining,
      unitCost: baseCost,
      totalCost: fallbackCost,
    });
  }

  return { totalCost, consumptions };
}

/**
 * Deduct inventory for an order based on recipes using strict FIFO
 */
export async function deductInventoryForOrder(
  client: pg.PoolClient,
  tenantId: string,
  branchId: string,
  orderId: string,
  userId: string
): Promise<{ success: boolean; deductedCount: number; message?: string }> {
  // 1. Idempotency check: Have we already deducted FIFO stock for this order?
  const existingMovements = await client.query(
    `
    SELECT id FROM order_item_batch_consumptions
    WHERE tenant_id = $1 AND reference_type = 'ORDER' AND reference_id = $2
    LIMIT 1
    `,
    [tenantId, orderId]
  );

  if (existingMovements.rows.length > 0) {
    return { success: true, deductedCount: 0, message: 'Stock already deducted for this order' };
  }

  // Fetch order number for clear traceable audit trail
  const orderRes = await client.query(
    'SELECT order_number FROM orders WHERE id = $1 AND tenant_id = $2',
    [orderId, tenantId]
  );
  const orderNumber = orderRes.rows[0]?.order_number || '';

  // 2. Fetch order items with track_inventory = true
  const orderItemsResult = await client.query(
    `
    SELECT oi.id, oi.product_id, oi.variant_id, oi.quantity, oi.product_name, p.track_inventory
    FROM order_items oi
    JOIN products p ON p.id = oi.product_id
    WHERE oi.order_id = $1 AND oi.tenant_id = $2
    `,
    [orderId, tenantId]
  );

  let totalDeductions = 0;

  for (const item of orderItemsResult.rows) {
    if (!item.track_inventory) continue;

    // 3. Find recipe (variant specific or product general)
    const recipeResult = await client.query(
      `
      SELECT r.id, r.yield_count
      FROM recipes r
      WHERE r.tenant_id = $1 AND r.product_id = $2
        AND (r.variant_id = $3 OR (r.variant_id IS NULL AND $3 IS NULL) OR r.variant_id IS NULL)
      ORDER BY r.variant_id NULLS LAST
      LIMIT 1
      `,
      [tenantId, item.product_id, item.variant_id || null]
    );

    if (recipeResult.rows.length === 0) {
      continue; // No recipe defined for this product, skip deduction
    }

    const recipe = recipeResult.rows[0];
    const yieldCount = Number(recipe.yield_count) || 1;
    const itemMultiplier = item.quantity / yieldCount;

    // 4. Fetch ingredients for this recipe
    const ingredientsResult = await client.query(
      `
      SELECT ri.ingredient_id, ri.quantity, ri.unit, i.name as ingredient_name, i.min_stock_alert
      FROM recipe_ingredients ri
      JOIN ingredients i ON i.id = ri.ingredient_id
      WHERE ri.recipe_id = $1 AND ri.tenant_id = $2
      `,
      [recipe.id, tenantId]
    );

    let itemTotalCOGS = 0;

    for (const ing of ingredientsResult.rows) {
      const deductionQty = Number(ing.quantity) * itemMultiplier;

      // 5. Consume from FIFO batches
      const { totalCost: ingredientCOGS } = await consumeIngredientFIFO(client, {
        tenantId,
        branchId,
        ingredientId: ing.ingredient_id,
        qtyNeeded: deductionQty,
        orderId,
        orderItemId: item.id,
      });

      itemTotalCOGS += ingredientCOGS;

      // 6. Update current stock in branch_stocks
      const stockResult = await client.query(
        `
        SELECT current_stock, cost_per_unit
        FROM branch_stocks
        WHERE tenant_id = $1 AND branch_id = $2 AND ingredient_id = $3
        FOR UPDATE
        `,
        [tenantId, branchId, ing.ingredient_id]
      );

      let currentStock = 0;
      let costPerUnit = 0;

      if (stockResult.rows.length === 0) {
        await client.query(
          `
          INSERT INTO branch_stocks (tenant_id, branch_id, ingredient_id, current_stock, cost_per_unit)
          VALUES ($1, $2, $3, 0, 0)
          ON CONFLICT (branch_id, ingredient_id) DO NOTHING
          `,
          [tenantId, branchId, ing.ingredient_id]
        );
      } else {
        currentStock = Number(stockResult.rows[0].current_stock);
        costPerUnit = Number(stockResult.rows[0].cost_per_unit);
      }

      const newStock = currentStock - deductionQty;
      const unitCost = deductionQty > 0 ? ingredientCOGS / deductionQty : costPerUnit;

      await client.query(
        `
        UPDATE branch_stocks
        SET current_stock = $1, last_updated = CURRENT_TIMESTAMP
        WHERE tenant_id = $2 AND branch_id = $3 AND ingredient_id = $4
        `,
        [newStock, tenantId, branchId, ing.ingredient_id]
      );

      // Record stock movement audit
      await client.query(
        `
        INSERT INTO stock_movements (
          tenant_id, branch_id, ingredient_id, movement_type,
          quantity, stock_before, stock_after, unit_cost, total_cost,
          reference_type, reference_id, reason, recorded_by_user_id
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        `,
        [
          tenantId,
          branchId,
          ing.ingredient_id,
          StockMovementType.SALE_CONSUMPTION,
          -deductionQty,
          currentStock,
          newStock,
          unitCost,
          ingredientCOGS,
          'ORDER',
          orderId,
          orderNumber ? `Order #${orderNumber}: ${item.product_name} x ${item.quantity} (${ing.ingredient_name})` : `FIFO sale deduction for order item`,
          userId,
        ]
      );

      // Low stock notification
      if (newStock <= Number(ing.min_stock_alert)) {
        await client.query(
          `
          INSERT INTO notifications (tenant_id, user_id, title, message, type)
          VALUES ($1, $2, $3, $4, 'LOW_STOCK')
          `,
          [
            tenantId,
            userId,
            `Low Stock Alert: ${ing.ingredient_name}`,
            `Current stock is ${newStock} ${ing.unit}. Minimum alert threshold is ${ing.min_stock_alert} ${ing.unit}.`,
          ]
        );
      }

      totalDeductions++;
    }

    // 7. Save exact item COGS to order_items
    await client.query(
      `
      UPDATE order_items
      SET cogs = $1, cost_price = $1
      WHERE id = $2
      `,
      [itemTotalCOGS, item.id]
    );
  }

  return { success: true, deductedCount: totalDeductions };
}

/**
 * Restock inventory for refunded items by restoring FIFO batches or creating restock lots
 */
export async function restockInventoryForRefund(
  client: pg.PoolClient,
  tenantId: string,
  branchId: string,
  orderId: string,
  refundId: string,
  userId: string,
  specificItemIds?: string[]
) {
  // Find order items to restock
  let itemQuery = `
    SELECT oi.id, oi.product_id, oi.variant_id, oi.quantity, p.track_inventory
    FROM order_items oi
    JOIN products p ON p.id = oi.product_id
    WHERE oi.order_id = $1 AND oi.tenant_id = $2
  `;
  const params: any[] = [orderId, tenantId];

  if (specificItemIds && specificItemIds.length > 0) {
    itemQuery += ` AND oi.id = ANY($3)`;
    params.push(specificItemIds);
  }

  const itemsResult = await client.query(itemQuery, params);

  for (const item of itemsResult.rows) {
    if (!item.track_inventory) continue;

    // Look for previous consumptions
    const consumptionsRes = await client.query(
      `
      SELECT c.id, c.batch_id, c.ingredient_id, c.quantity, c.unit_cost, c.total_cost
      FROM order_item_batch_consumptions c
      WHERE c.order_item_id = $1 AND c.tenant_id = $2
      `,
      [item.id, tenantId]
    );

    if (consumptionsRes.rows.length > 0) {
      for (const cons of consumptionsRes.rows) {
        const qtyToReturn = Number(cons.quantity);
        const unitCost = Number(cons.unit_cost);

        // Try restoring to original batch first
        const batchRes = await client.query(
          `
          SELECT id, quantity_remaining, quantity_received
          FROM inventory_batches
          WHERE id = $1 AND tenant_id = $2
          FOR UPDATE
          `,
          [cons.batch_id, tenantId]
        );

        if (batchRes.rows.length > 0) {
          const b = batchRes.rows[0];
          const newRemaining = Number(b.quantity_remaining) + qtyToReturn;
          await client.query(
            `
            UPDATE inventory_batches
            SET quantity_remaining = $1, status = 'ACTIVE'
            WHERE id = $2
            `,
            [newRemaining, b.id]
          );
        } else {
          // Create restock batch if original was deleted
          await client.query(
            `
            INSERT INTO inventory_batches (
              tenant_id, branch_id, ingredient_id, purchase_item_id,
              quantity_received, quantity_remaining, unit_cost, received_at, status
            ) VALUES ($1, $2, $3, NULL, $4, $4, $5, CURRENT_TIMESTAMP, 'ACTIVE')
            `,
            [tenantId, branchId, cons.ingredient_id, qtyToReturn, unitCost]
          );
        }

        // Restore branch stock
        const stockRes = await client.query(
          `SELECT current_stock, cost_per_unit FROM branch_stocks WHERE tenant_id = $1 AND branch_id = $2 AND ingredient_id = $3 FOR UPDATE`,
          [tenantId, branchId, cons.ingredient_id]
        );

        if (stockRes.rows.length > 0) {
          const currentStock = Number(stockRes.rows[0].current_stock);
          const newStock = currentStock + qtyToReturn;

          await client.query(
            `UPDATE branch_stocks SET current_stock = $1, last_updated = CURRENT_TIMESTAMP WHERE tenant_id = $2 AND branch_id = $3 AND ingredient_id = $4`,
            [newStock, tenantId, branchId, cons.ingredient_id]
          );

          await client.query(
            `
            INSERT INTO stock_movements (
              tenant_id, branch_id, ingredient_id, movement_type,
              quantity, stock_before, stock_after, unit_cost, total_cost,
              reference_type, reference_id, reason, recorded_by_user_id
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
            `,
            [
              tenantId,
              branchId,
              cons.ingredient_id,
              StockMovementType.REFUND_RESTOCK,
              qtyToReturn,
              currentStock,
              newStock,
              unitCost,
              qtyToReturn * unitCost,
              'ORDER',
              refundId,
              `Restock from refund ${refundId}`,
              userId,
            ]
          );
        }
      }
    }
  }
}

/**
 * Receive a purchase invoice and create FIFO inventory batches
 */
export async function receivePurchaseInvoice(
  client: pg.PoolClient,
  tenantId: string,
  purchaseId: string,
  userId: string
) {
  // Fetch invoice details
  const invoiceRes = await client.query(
    `SELECT * FROM purchase_invoices WHERE id = $1 AND tenant_id = $2 FOR UPDATE`,
    [purchaseId, tenantId]
  );

  if (invoiceRes.rows.length === 0) {
    throw new Error('Purchase invoice not found');
  }

  const invoice = invoiceRes.rows[0];
  if (invoice.status === 'RECEIVED') {
    throw new Error('Purchase invoice has already been received');
  }

  // Fetch items
  const itemsRes = await client.query(
    `SELECT * FROM purchase_items WHERE purchase_id = $1 AND tenant_id = $2`,
    [purchaseId, tenantId]
  );

  // Fetch supplier name for batch reference
  const supRes = await client.query('SELECT name FROM suppliers WHERE id = $1', [invoice.supplier_id]);
  const supplierName = supRes.rows[0]?.name || 'Supplier';

  for (const item of itemsRes.rows) {
    // Preserve exact entered purchase quantity & price without automatic multiplier conversion
    const baseQty = Number(item.quantity);
    const baseUnitCost = Number(item.unit_price);

    const purchasePrice = Number(item.unit_price);
    const lineTotal = Number(item.total_price) || Number(item.quantity) * purchasePrice;
    const itemUnit = item.unit || 'UNIT';

    // 1. Create a distinct FIFO batch
    await client.query(
      `
      INSERT INTO inventory_batches (
        tenant_id, branch_id, ingredient_id, purchase_id, purchase_item_id,
        quantity_received, quantity_remaining, unit_cost, unit, supplier_name, received_at, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $6, $7, $8, $9, COALESCE($10, CURRENT_TIMESTAMP), 'ACTIVE')
      `,
      [tenantId, invoice.branch_id, item.ingredient_id, invoice.id, item.id, baseQty, baseUnitCost, itemUnit, supplierName, invoice.created_at || new Date()]
    );

    // 2. Get current stock
    const stockRes = await client.query(
      `SELECT current_stock, cost_per_unit FROM branch_stocks WHERE tenant_id = $1 AND branch_id = $2 AND ingredient_id = $3 FOR UPDATE`,
      [tenantId, invoice.branch_id, item.ingredient_id]
    );

    let currentStock = 0;
    let oldCost = 0;

    if (stockRes.rows.length > 0) {
      currentStock = Number(stockRes.rows[0].current_stock);
      oldCost = Number(stockRes.rows[0].cost_per_unit);
    }

    const newStock = currentStock + baseQty;
    const newCost = newStock > 0 ? (currentStock * oldCost + baseQty * baseUnitCost) / newStock : baseUnitCost;

    // 3. Upsert branch stock
    await client.query(
      `
      INSERT INTO branch_stocks (tenant_id, branch_id, ingredient_id, current_stock, cost_per_unit, last_updated)
      VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
      ON CONFLICT (branch_id, ingredient_id) DO UPDATE SET
        current_stock = $4,
        cost_per_unit = $5,
        last_updated = CURRENT_TIMESTAMP
      `,
      [tenantId, invoice.branch_id, item.ingredient_id, newStock, newCost]
    );

    // 4. Update master ingredient: latest purchase cost
    await client.query(
      `UPDATE ingredients
       SET cost_per_unit = $1,
           purchase_cost = $2,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $3 AND tenant_id = $4`,
      [baseUnitCost, purchasePrice, item.ingredient_id, tenantId]
    );

    // 5. Record stock movement
    await client.query(
      `
      INSERT INTO stock_movements (
        tenant_id, branch_id, ingredient_id, movement_type,
        quantity, stock_before, stock_after, unit_cost, total_cost,
        reference_type, reference_id, reason, recorded_by_user_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      `,
      [
        tenantId,
        invoice.branch_id,
        item.ingredient_id,
        StockMovementType.PURCHASE_RECEIVE,
        baseQty,
        currentStock,
        newStock,
        baseUnitCost,
        lineTotal,
        'PURCHASE',
        purchaseId,
        `Inward Purchase #${invoice.invoice_number} received (${baseQty} ${itemUnit})`,
        userId,
      ]
    );
  }

  // Update invoice status
  await client.query(
    `UPDATE purchase_invoices SET status = 'RECEIVED', received_at = CURRENT_TIMESTAMP WHERE id = $1 AND tenant_id = $2`,
    [purchaseId, tenantId]
  );

  // Update supplier balance payable
  const balanceToAdd = Number(invoice.total_amount) - Number(invoice.paid_amount);
  if (balanceToAdd > 0) {
    await client.query(
      `UPDATE suppliers SET balance_payable = balance_payable + $1 WHERE id = $2 AND tenant_id = $3`,
      [balanceToAdd, invoice.supplier_id, tenantId]
    );
  }
}
