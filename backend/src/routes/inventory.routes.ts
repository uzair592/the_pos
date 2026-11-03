import { FastifyInstance } from 'fastify';
import { query, withTransaction } from '../db/connection.js';
import { authenticate, requireTenant, requirePermission, requireEntitlement } from '../middleware/auth.js';
import {
  CreateIngredientSchema,
  CreateRecipeSchema,
  StockAdjustmentSchema,
  CreateSupplierSchema,
  CreatePurchaseInvoiceSchema,
  Permission,
  FeatureKey,
  StockMovementType,
} from '@pos/shared';
import { receivePurchaseInvoice } from '../services/inventoryService.js';
import { logAuditEvent } from '../services/auditService.js';

export async function inventoryRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', authenticate);
  fastify.addHook('preHandler', requireTenant);
  fastify.addHook('preHandler', requireEntitlement(FeatureKey.INVENTORY));

  /**
   * List Ingredients & Branch Stock
   */
  fastify.get('/api/inventory/ingredients', async (req, reply) => {
    const tenantId = req.user!.tenantId!;
    const { branchId, search, lowStockOnly } = req.query as {
      branchId?: string;
      search?: string;
      lowStockOnly?: string;
    };

    let sql = `
      SELECT i.*,
             COALESCE(bs.current_stock, 0)::numeric as current_stock,
             COALESCE(bs.cost_per_unit, i.cost_per_unit)::numeric as branch_cost_per_unit
      FROM ingredients i
      LEFT JOIN branch_stocks bs ON bs.ingredient_id = i.id ${branchId ? 'AND bs.branch_id = $2' : ''}
      WHERE i.tenant_id = $1 AND i.is_active = true
    `;
    const params: any[] = [tenantId];
    if (branchId) params.push(branchId);

    if (search) {
      params.push(`%${search}%`);
      sql += ` AND (i.name ILIKE $${params.length} OR i.sku ILIKE $${params.length})`;
    }

    if (lowStockOnly === 'true') {
      sql += ` AND COALESCE(bs.current_stock, 0) <= i.min_stock_alert`;
    }

    sql += ' ORDER BY i.name ASC';

    const { rows } = await query(sql, params, { tenantId });
    return reply.send({ ingredients: rows });
  });

  /**
   * List FIFO Batches per Ingredient / Branch
   */
  fastify.get('/api/inventory/batches', async (req, reply) => {
    const tenantId = req.user!.tenantId!;
    const { ingredientId, branchId, status } = req.query as {
      ingredientId?: string;
      branchId?: string;
      status?: string;
    };

    let sql = `
      SELECT b.*, i.name as ingredient_name, i.unit as ingredient_unit, br.name as branch_name
      FROM inventory_batches b
      JOIN ingredients i ON i.id = b.ingredient_id
      JOIN branches br ON br.id = b.branch_id
      WHERE b.tenant_id = $1
    `;
    const params: any[] = [tenantId];

    if (ingredientId) {
      params.push(ingredientId);
      sql += ` AND b.ingredient_id = $${params.length}`;
    }
    if (branchId) {
      params.push(branchId);
      sql += ` AND b.branch_id = $${params.length}`;
    }
    if (status) {
      params.push(status);
      sql += ` AND b.status = $${params.length}`;
    }

    sql += ' ORDER BY b.received_at DESC, b.created_at DESC';

    const { rows } = await query(sql, params, { tenantId });
    return reply.send({ batches: rows });
  });

  /**
   * Create Ingredient
   */
  fastify.post('/api/inventory/ingredients', {
    preHandler: [requirePermission(Permission.INVENTORY_MANAGE)],
  }, async (req, reply) => {
    const parsed = CreateIngredientSchema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.format() });

    const tenantId = req.user!.tenantId!;
    const { name, nameUrdu, sku, unit, costPerUnit, minStockAlert, initialBranchStock } = parsed.data;

    const existing = await query('SELECT id FROM ingredients WHERE tenant_id = $1 AND sku = $2', [tenantId, sku], { tenantId });
    if (existing.rows.length > 0) return reply.status(400).send({ error: 'Ingredient SKU already exists' });

    const result = await withTransaction(async (client) => {
      const ingRes = await client.query(
        `
        INSERT INTO ingredients (tenant_id, name, name_urdu, sku, unit, cost_per_unit, min_stock_alert, is_active)
        VALUES ($1, $2, $3, $4, $5, $6, $7, true)
        RETURNING *
        `,
        [tenantId, name, nameUrdu || null, sku, unit, costPerUnit, minStockAlert]
      );
      const ingredient = ingRes.rows[0];

      if (initialBranchStock) {
        for (const [branchId, qty] of Object.entries(initialBranchStock)) {
          await client.query(
            `
            INSERT INTO branch_stocks (tenant_id, branch_id, ingredient_id, current_stock, cost_per_unit)
            VALUES ($1, $2, $3, $4, $5)
            ON CONFLICT (branch_id, ingredient_id) DO UPDATE SET current_stock = $4, cost_per_unit = $5
            `,
            [tenantId, branchId, ingredient.id, qty, costPerUnit]
          );

          if (qty > 0) {
            await client.query(
              `
              INSERT INTO inventory_batches (
                tenant_id, branch_id, ingredient_id, quantity_received, quantity_remaining, unit_cost, received_at, status
              ) VALUES ($1, $2, $3, $4, $4, $5, CURRENT_TIMESTAMP, 'ACTIVE')
              `,
              [tenantId, branchId, ingredient.id, qty, costPerUnit]
            );

            await client.query(
              `
              INSERT INTO stock_movements (
                tenant_id, branch_id, ingredient_id, movement_type, quantity,
                stock_before, stock_after, unit_cost, total_cost, reference_type, reason, recorded_by_user_id
              ) VALUES ($1, $2, $3, 'PURCHASE_RECEIVE', $4, 0, $4, $5, $6, 'ADJUSTMENT', 'Opening Stock', $7)
              `,
              [tenantId, branchId, ingredient.id, qty, costPerUnit, qty * costPerUnit, req.user!.id]
            );
          }
        }
      }

      return ingredient;
    }, { tenantId });

    return reply.status(201).send({ ingredient: result });
  });

  /**
   * Recipes Management
   */
  fastify.get('/api/inventory/recipes', async (req, reply) => {
    const tenantId = req.user!.tenantId!;
    const { productId } = req.query as { productId?: string };

    let sql = `
      SELECT r.*, p.name as product_name, pv.name as variant_name
      FROM recipes r
      JOIN products p ON p.id = r.product_id
      LEFT JOIN product_variants pv ON pv.id = r.variant_id
      WHERE r.tenant_id = $1
    `;
    const params: any[] = [tenantId];
    if (productId) {
      params.push(productId);
      sql += ` AND r.product_id = $${params.length}`;
    }

    const { rows: recipes } = await query(sql, params, { tenantId });

    for (const r of recipes) {
      const { rows: ings } = await query(
        `
        SELECT ri.*, i.name as ingredient_name, i.cost_per_unit,
               (ri.quantity * i.cost_per_unit)::numeric as total_cost
        FROM recipe_ingredients ri
        JOIN ingredients i ON i.id = ri.ingredient_id
        WHERE ri.recipe_id = $1 AND ri.tenant_id = $2
        `,
        [r.id, tenantId],
        { tenantId }
      );
      r.ingredients = ings;
    }

    return reply.send({ recipes });
  });

  fastify.post('/api/inventory/recipes', {
    preHandler: [requirePermission(Permission.INVENTORY_MANAGE)],
  }, async (req, reply) => {
    const parsed = CreateRecipeSchema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.format() });

    const tenantId = req.user!.tenantId!;
    const { productId, variantId, yieldCount, ingredients } = parsed.data;

    const result = await withTransaction(async (client) => {
      // Calculate total recipe cost
      let totalCost = 0;
      for (const ing of ingredients) {
        const ingRes = await client.query('SELECT cost_per_unit FROM ingredients WHERE id = $1 AND tenant_id = $2', [ing.ingredientId, tenantId]);
        const cost = ingRes.rows[0]?.cost_per_unit || 0;
        totalCost += ing.quantity * Number(cost);
      }

      // Upsert recipe
      const existing = await client.query(
        'SELECT id FROM recipes WHERE product_id = $1 AND (variant_id = $2 OR (variant_id IS NULL AND $2 IS NULL)) AND tenant_id = $3',
        [productId, variantId || null, tenantId]
      );

      let recipeId: string;
      if (existing.rows.length > 0) {
        recipeId = existing.rows[0].id;
        await client.query(
          'UPDATE recipes SET yield_count = $1, total_cost = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3',
          [yieldCount, totalCost, recipeId]
        );
        await client.query('DELETE FROM recipe_ingredients WHERE recipe_id = $1 AND tenant_id = $2', [recipeId, tenantId]);
      } else {
        const insertRes = await client.query(
          `
          INSERT INTO recipes (tenant_id, product_id, variant_id, yield_count, total_cost)
          VALUES ($1, $2, $3, $4, $5)
          RETURNING id
          `,
          [tenantId, productId, variantId || null, yieldCount, totalCost]
        );
        recipeId = insertRes.rows[0].id;
      }

      for (const ing of ingredients) {
        await client.query(
          `
          INSERT INTO recipe_ingredients (tenant_id, recipe_id, ingredient_id, quantity, unit)
          VALUES ($1, $2, $3, $4, $5)
          `,
          [tenantId, recipeId, ing.ingredientId, ing.quantity, ing.unit]
        );
      }

      // Also update cost_price on product or variant
      if (variantId) {
        await client.query('UPDATE product_variants SET cost_price = $1 WHERE id = $2 AND tenant_id = $3', [totalCost / yieldCount, variantId, tenantId]);
      } else {
        await client.query('UPDATE products SET cost_price = $1 WHERE id = $2 AND tenant_id = $3', [totalCost / yieldCount, productId, tenantId]);
      }

      return { recipeId, totalCost, costPerServing: totalCost / yieldCount };
    }, { tenantId });

    return reply.status(201).send({ message: 'Recipe saved successfully', recipe: result });
  });

  /**
   * Stock Adjustments & Wastage
   */
  fastify.post('/api/inventory/adjustments', {
    preHandler: [requirePermission(Permission.INVENTORY_MANAGE)],
  }, async (req, reply) => {
    const parsed = StockAdjustmentSchema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.format() });

    const tenantId = req.user!.tenantId!;
    const { branchId, ingredientId, movementType, quantity, reason } = parsed.data;

    const result = await withTransaction(async (client) => {
      const stockRes = await client.query(
        'SELECT current_stock, cost_per_unit FROM branch_stocks WHERE branch_id = $1 AND ingredient_id = $2 AND tenant_id = $3 FOR UPDATE',
        [branchId, ingredientId, tenantId]
      );

      let currentStock = 0;
      let costPerUnit = 0;
      if (stockRes.rows.length > 0) {
        currentStock = Number(stockRes.rows[0].current_stock);
        costPerUnit = Number(stockRes.rows[0].cost_per_unit);
      }

      let newStock = currentStock;
      let qtyDelta = 0;

      if (movementType === StockMovementType.ADJUSTMENT_ADD) {
        qtyDelta = quantity;
        newStock += quantity;

        // Add FIFO batch for positive stock addition
        await client.query(
          `
          INSERT INTO inventory_batches (
            tenant_id, branch_id, ingredient_id, quantity_received, quantity_remaining, unit_cost, received_at, status
          ) VALUES ($1, $2, $3, $4, $4, $5, CURRENT_TIMESTAMP, 'ACTIVE')
          `,
          [tenantId, branchId, ingredientId, quantity, costPerUnit]
        );
      } else {
        qtyDelta = -quantity;
        newStock -= quantity;

        // Deduct from oldest active batches
        let remainingToDeduct = quantity;
        const bRes = await client.query(
          `
          SELECT id, quantity_remaining
          FROM inventory_batches
          WHERE tenant_id = $1 AND branch_id = $2 AND ingredient_id = $3
            AND status = 'ACTIVE' AND quantity_remaining > 0
          ORDER BY received_at ASC, created_at ASC
          FOR UPDATE
          `,
          [tenantId, branchId, ingredientId]
        );

        for (const b of bRes.rows) {
          if (remainingToDeduct <= 0) break;
          const avail = Number(b.quantity_remaining);
          const take = Math.min(avail, remainingToDeduct);
          const newRem = avail - take;
          remainingToDeduct -= take;

          await client.query(
            `UPDATE inventory_batches SET quantity_remaining = $1, status = $2 WHERE id = $3`,
            [newRem, newRem <= 0 ? 'EXHAUSTED' : 'ACTIVE', b.id]
          );
        }
      }

      await client.query(
        `
        INSERT INTO branch_stocks (tenant_id, branch_id, ingredient_id, current_stock, cost_per_unit, last_updated)
        VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
        ON CONFLICT (branch_id, ingredient_id) DO UPDATE SET current_stock = $4, last_updated = CURRENT_TIMESTAMP
        `,
        [tenantId, branchId, ingredientId, newStock, costPerUnit]
      );

      await client.query(
        `
        INSERT INTO stock_movements (
          tenant_id, branch_id, ingredient_id, movement_type,
          quantity, stock_before, stock_after, unit_cost, total_cost,
          reference_type, reason, recorded_by_user_id
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'ADJUSTMENT', $10, $11)
        `,
        [
          tenantId, branchId, ingredientId, movementType,
          qtyDelta, currentStock, newStock, costPerUnit, Math.abs(qtyDelta) * costPerUnit,
          reason, req.user!.id,
        ]
      );

      return { currentStock, newStock, movementType, reason };
    }, { tenantId });

    return reply.status(201).send({ message: 'Stock adjustment recorded', ...result });
  });

  /**
   * Stock Movement Ledger
   */
  fastify.get('/api/inventory/movements', async (req, reply) => {
    const tenantId = req.user!.tenantId!;
    const { branchId, ingredientId, limit = 50 } = req.query as {
      branchId?: string;
      ingredientId?: string;
      limit?: number;
    };

    let sql = `
      SELECT sm.*, i.name as ingredient_name, i.unit, u.full_name as recorded_by_name
      FROM stock_movements sm
      JOIN ingredients i ON i.id = sm.ingredient_id
      LEFT JOIN users u ON u.id = sm.recorded_by_user_id
      WHERE sm.tenant_id = $1
    `;
    const params: any[] = [tenantId];

    if (branchId) {
      params.push(branchId);
      sql += ` AND sm.branch_id = $${params.length}`;
    }
    if (ingredientId) {
      params.push(ingredientId);
      sql += ` AND sm.ingredient_id = $${params.length}`;
    }

    sql += ` ORDER BY sm.created_at DESC LIMIT $${params.length + 1}`;
    params.push(limit);

    const { rows } = await query(sql, params, { tenantId });
    return reply.send({ movements: rows });
  });

  /**
   * Suppliers Management
   */
  fastify.get('/api/inventory/suppliers', async (req, reply) => {
    const tenantId = req.user!.tenantId!;
    const { rows } = await query('SELECT * FROM suppliers WHERE tenant_id = $1 ORDER BY name ASC', [tenantId], { tenantId });
    return reply.send({ suppliers: rows });
  });

  fastify.post('/api/inventory/suppliers', {
    preHandler: [requirePermission(Permission.PURCHASES_MANAGE)],
  }, async (req, reply) => {
    const parsed = CreateSupplierSchema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.format() });

    const tenantId = req.user!.tenantId!;
    const { name, contactPerson, phone, email, address, taxNumber } = parsed.data;

    const { rows } = await query(
      `
      INSERT INTO suppliers (tenant_id, name, contact_person, phone, email, address, tax_number, balance_payable, is_active)
      VALUES ($1, $2, $3, $4, $5, $6, $7, 0, true)
      RETURNING *
      `,
      [tenantId, name, contactPerson || null, phone, email || null, address || null, taxNumber || null],
      { tenantId }
    );

    return reply.status(201).send({ supplier: rows[0] });
  });

  /**
   * Purchase Invoices & Receiving
   */
  fastify.get('/api/inventory/purchases', async (req, reply) => {
    const tenantId = req.user!.tenantId!;
    const { branchId, status } = req.query as { branchId?: string; status?: string };

    let sql = `
      SELECT pi.*, s.name as supplier_name, b.name as branch_name, u.full_name as recorded_by_name
      FROM purchase_invoices pi
      JOIN suppliers s ON s.id = pi.supplier_id
      JOIN branches b ON b.id = pi.branch_id
      LEFT JOIN users u ON u.id = pi.recorded_by_user_id
      WHERE pi.tenant_id = $1
    `;
    const params: any[] = [tenantId];
    if (branchId) {
      params.push(branchId);
      sql += ` AND pi.branch_id = $${params.length}`;
    }
    if (status) {
      params.push(status);
      sql += ` AND pi.status = $${params.length}`;
    }
    sql += ' ORDER BY pi.created_at DESC';

    const { rows } = await query(sql, params, { tenantId });
    return reply.send({ purchases: rows });
  });

  fastify.post('/api/inventory/purchases', {
    preHandler: [requirePermission(Permission.PURCHASES_MANAGE)],
  }, async (req, reply) => {
    const parsed = CreatePurchaseInvoiceSchema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.format() });

    const tenantId = req.user!.tenantId!;
    const { branchId, supplierId, invoiceNumber, taxAmount, paidAmount, notes, items } = parsed.data;

    const subtotal = items.reduce((acc, it) => acc + (it.quantity * it.unitPrice), 0);
    const totalAmount = subtotal + taxAmount;
    const balancePayable = Math.max(0, totalAmount - paidAmount);

    const purchase = await withTransaction(async (client) => {
      const pRes = await client.query(
        `
        INSERT INTO purchase_invoices (
          tenant_id, branch_id, supplier_id, invoice_number, status,
          subtotal, tax_amount, total_amount, paid_amount, balance_payable,
          recorded_by_user_id, notes
        ) VALUES ($1, $2, $3, $4, 'DRAFT', $5, $6, $7, $8, $9, $10, $11)
        RETURNING *
        `,
        [tenantId, branchId, supplierId, invoiceNumber, subtotal, taxAmount, totalAmount, paidAmount, balancePayable, req.user!.id, notes || null]
      );
      const newPurchase = pRes.rows[0];

      for (const it of items) {
        await client.query(
          `
          INSERT INTO purchase_items (tenant_id, purchase_id, ingredient_id, unit, quantity, unit_price, total_price)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
          `,
          [tenantId, newPurchase.id, it.ingredientId, it.unit, it.quantity, it.unitPrice, it.quantity * it.unitPrice]
        );
      }

      return newPurchase;
    }, { tenantId });

    return reply.status(201).send({ purchase });
  });

  fastify.post('/api/inventory/purchases/:id/receive', {
    preHandler: [requirePermission(Permission.PURCHASES_MANAGE)],
  }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const tenantId = req.user!.tenantId!;

    try {
      await withTransaction(async (client) => {
        await receivePurchaseInvoice(client, tenantId, id, req.user!.id);
      }, { tenantId });

      return reply.send({ message: 'Purchase received, inventory updated with weighted average cost' });
    } catch (err: any) {
      return reply.status(400).send({ error: err.message });
    }
  });
}
