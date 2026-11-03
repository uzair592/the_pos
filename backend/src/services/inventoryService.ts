import pg from 'pg';
import { query } from '../db/connection.js';
import { StockMovementType, StockUnit } from '@pos/shared';

/**
 * Deduct inventory for an order based on recipes
 */
export async function deductInventoryForOrder(
  client: pg.PoolClient,
  tenantId: string,
  branchId: string,
  orderId: string,
  userId: string
): Promise<{ success: boolean; deductedCount: number; message?: string }> {
  // 1. Idempotency check: Have we already deducted stock for this order?
  const existingMovements = await client.query(
    `
    SELECT id FROM stock_movements
    WHERE tenant_id = $1 AND reference_type = 'ORDER' AND reference_id = $2
    LIMIT 1
    `,
    [tenantId, orderId]
  );

  if (existingMovements.rows.length > 0) {
    return { success: true, deductedCount: 0, message: 'Stock already deducted for this order' };
  }

  // 2. Fetch order items with track_inventory = true
  const orderItemsResult = await client.query(
    `
    SELECT oi.id, oi.product_id, oi.variant_id, oi.quantity, p.track_inventory
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

    for (const ing of ingredientsResult.rows) {
      const deductionQty = Number(ing.quantity) * itemMultiplier;

      // 5. Fetch current branch stock
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
        // Initialize branch stock row if missing
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
      const totalCost = deductionQty * costPerUnit;

      // Update branch stock
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
          costPerUnit,
          totalCost,
          'ORDER',
          orderId,
          `Sale deduction for order item`,
          userId,
        ]
      );

      // Check low stock alert
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
  }

  return { success: true, deductedCount: totalDeductions };
}

/**
 * Restock inventory for refunded items
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

    const recipeResult = await client.query(
      `
      SELECT r.id, r.yield_count
      FROM recipes r
      WHERE r.tenant_id = $1 AND r.product_id = $2
        AND (r.variant_id = $3 OR (r.variant_id IS NULL AND $3 IS NULL) OR r.variant_id IS NULL)
      LIMIT 1
      `,
      [tenantId, item.product_id, item.variant_id || null]
    );

    if (recipeResult.rows.length === 0) continue;

    const recipe = recipeResult.rows[0];
    const itemMultiplier = item.quantity / (Number(recipe.yield_count) || 1);

    const ingResult = await client.query(
      `SELECT ingredient_id, quantity FROM recipe_ingredients WHERE recipe_id = $1 AND tenant_id = $2`,
      [recipe.id, tenantId]
    );

    for (const ing of ingResult.rows) {
      const restockQty = Number(ing.quantity) * itemMultiplier;

      const stockRes = await client.query(
        `SELECT current_stock, cost_per_unit FROM branch_stocks WHERE tenant_id = $1 AND branch_id = $2 AND ingredient_id = $3 FOR UPDATE`,
        [tenantId, branchId, ing.ingredient_id]
      );

      if (stockRes.rows.length > 0) {
        const currentStock = Number(stockRes.rows[0].current_stock);
        const costPerUnit = Number(stockRes.rows[0].cost_per_unit);
        const newStock = currentStock + restockQty;

        await client.query(
          `UPDATE branch_stocks SET current_stock = $1, last_updated = CURRENT_TIMESTAMP WHERE tenant_id = $2 AND branch_id = $3 AND ingredient_id = $4`,
          [newStock, tenantId, branchId, ing.ingredient_id]
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
            ing.ingredient_id,
            StockMovementType.REFUND_RESTOCK,
            restockQty,
            currentStock,
            newStock,
            costPerUnit,
            restockQty * costPerUnit,
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

/**
 * Receive a purchase invoice and update inventory using weighted average cost
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

  for (const item of itemsRes.rows) {
    const qty = Number(item.quantity);
    const unitPrice = Number(item.unit_price);

    // Get current stock
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

    const newStock = currentStock + qty;
    // Weighted Average Cost formula: (oldStock * oldCost + newQty * newPrice) / (oldStock + newQty)
    const newCost = newStock > 0 ? (currentStock * oldCost + qty * unitPrice) / newStock : unitPrice;

    // Upsert branch stock
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

    // Update master ingredient cost per unit
    await client.query(
      `UPDATE ingredients SET cost_per_unit = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 AND tenant_id = $3`,
      [newCost, item.ingredient_id, tenantId]
    );

    // Record stock movement
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
        qty,
        currentStock,
        newStock,
        unitPrice,
        qty * unitPrice,
        'PURCHASE',
        purchaseId,
        `Received purchase invoice #${invoice.invoice_number}`,
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
