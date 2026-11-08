import { FastifyInstance } from 'fastify';
import { query, withTransaction } from '../db/connection.js';
import { authenticate, requireTenant, requirePermission, requireEntitlement } from '../middleware/auth.js';
import {
  CreateIngredientSchema,
  CreateRecipeSchema,
  StockAdjustmentSchema,
  CreateSupplierSchema,
  CreatePurchaseInvoiceSchema,
  CreateIngredientCategorySchema,
  UpdateIngredientCategorySchema,
  Permission,
  FeatureKey,
  StockMovementType,
  INGREDIENT_CATEGORIES,
  convertRecipeQtyToBase,
  convertPurchaseQtyToBase,
  calculateBaseUnitCost,
  formatDisplayStock,
} from '@pos/shared';
import { receivePurchaseInvoice } from '../services/inventoryService.js';
import { logAuditEvent } from '../services/auditService.js';

export async function inventoryRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', authenticate);
  fastify.addHook('preHandler', requireTenant);
  fastify.addHook('preHandler', requireEntitlement(FeatureKey.INVENTORY));

  // =========================================================================
  // INVENTORY CATEGORIES CRUD
  // =========================================================================

  /**
   * List Inventory Categories
   * Returns default standard categories + any tenant-created custom categories with item counts
   */
  fastify.get('/api/inventory/categories', async (req, reply) => {
    const tenantId = req.user!.tenantId!;

    // Fetch tenant-specific categories
    const { rows: customCats } = await query(
      `SELECT c.id, c.name, c.description, c.is_active, c.created_at, c.updated_at,
              COUNT(i.id)::int as item_count
       FROM inventory_categories c
       LEFT JOIN ingredients i ON i.tenant_id = c.tenant_id AND i.category = c.name
       WHERE c.tenant_id = $1
       GROUP BY c.id, c.name, c.description, c.is_active, c.created_at, c.updated_at
       ORDER BY c.name ASC`,
      [tenantId],
      { tenantId }
    );

    // Get item counts for standard default categories
    const { rows: standardCounts } = await query(
      `SELECT category, COUNT(id)::int as count
       FROM ingredients
       WHERE tenant_id = $1
       GROUP BY category`,
      [tenantId],
      { tenantId }
    );

    const countMap: Record<string, number> = {};
    standardCounts.forEach((r: any) => {
      countMap[r.category] = Number(r.count || 0);
    });

    const customNameSet = new Set(customCats.map((c: any) => c.name.toLowerCase()));

    // Construct full category list combining standards and custom
    const standardList = INGREDIENT_CATEGORIES
      .filter((name) => !customNameSet.has(name.toLowerCase()))
      .map((name) => ({
        id: `standard-${name.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
        name,
        description: 'Standard inventory category',
        isActive: true,
        isStandard: true,
        itemCount: countMap[name] || 0,
      }));

    const customList = customCats.map((c: any) => ({
      id: c.id,
      name: c.name,
      description: c.description,
      isActive: c.is_active,
      isStandard: false,
      itemCount: Number(c.item_count || countMap[c.name] || 0),
      createdAt: c.created_at,
      updatedAt: c.updated_at,
    }));

    return reply.send({
      categories: [...customList, ...standardList],
    });
  });

  /**
   * Create Custom Inventory Category
   */
  fastify.post('/api/inventory/categories', async (req, reply) => {
    const tenantId = req.user!.tenantId!;
    const parsed = CreateIngredientCategorySchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.format() });
    }

    const { name, description } = parsed.data;
    const trimmedName = name.trim();

    // Check if duplicate standard category
    const isStandard = INGREDIENT_CATEGORIES.some(
      (sc) => sc.toLowerCase() === trimmedName.toLowerCase()
    );

    // Check if exists in db
    const { rows: existing } = await query(
      `SELECT id FROM inventory_categories WHERE tenant_id = $1 AND LOWER(name) = LOWER($2)`,
      [tenantId, trimmedName],
      { tenantId }
    );

    if (existing.length > 0 || isStandard) {
      return reply.status(409).send({ error: `Category "${trimmedName}" already exists` });
    }

    const { rows } = await query(
      `INSERT INTO inventory_categories (tenant_id, name, description, is_active)
       VALUES ($1, $2, $3, true)
       RETURNING *`,
      [tenantId, trimmedName, description || null],
      { tenantId }
    );

    await logAuditEvent({
      tenantId,
      actorId: req.user!.id,
      actorRole: req.user!.role,
      action: 'CREATE_INVENTORY_CATEGORY',
      resourceType: 'INVENTORY_CATEGORY',
      resourceId: rows[0].id,
      details: { name: trimmedName },
      ipAddress: req.ip,
    });

    return reply.status(201).send({ category: rows[0] });
  });

  /**
   * Update Custom Inventory Category
   */
  fastify.put('/api/inventory/categories/:id', async (req, reply) => {
    const tenantId = req.user!.tenantId!;
    const { id } = req.params as { id: string };

    const parsed = UpdateIngredientCategorySchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.format() });
    }

    const { rows: existing } = await query(
      `SELECT * FROM inventory_categories WHERE id = $1 AND tenant_id = $2`,
      [id, tenantId],
      { tenantId }
    );

    if (existing.length === 0) {
      return reply.status(404).send({ error: 'Category not found' });
    }

    const currentCat = existing[0];
    const newName = parsed.data.name?.trim() || currentCat.name;
    const newDesc = parsed.data.description !== undefined ? parsed.data.description : currentCat.description;
    const newActive = parsed.data.isActive !== undefined ? parsed.data.isActive : currentCat.is_active;

    // If name changed, rename in ingredients table as well to maintain association
    const { rows } = await withTransaction(async (client) => {
      const updateRes = await client.query(
        `UPDATE inventory_categories
         SET name = $1, description = $2, is_active = $3, updated_at = CURRENT_TIMESTAMP
         WHERE id = $4 AND tenant_id = $5
         RETURNING *`,
        [newName, newDesc, newActive, id, tenantId]
      );

      if (newName !== currentCat.name) {
        await client.query(
          `UPDATE ingredients SET category = $1 WHERE tenant_id = $2 AND category = $3`,
          [newName, tenantId, currentCat.name]
        );
      }

      return updateRes;
    }, { tenantId });

    return reply.send({ category: rows[0] });
  });

  /**
   * Delete Custom Inventory Category
   */
  fastify.delete('/api/inventory/categories/:id', async (req, reply) => {
    const tenantId = req.user!.tenantId!;
    const { id } = req.params as { id: string };

    const { rows: existing } = await query(
      `SELECT * FROM inventory_categories WHERE id = $1 AND tenant_id = $2`,
      [id, tenantId],
      { tenantId }
    );

    if (existing.length === 0) {
      return reply.status(404).send({ error: 'Category not found or is a standard system category' });
    }

    const catName = existing[0].name;

    // Fall back any ingredients in this category to 'General'
    await withTransaction(async (client) => {
      await client.query(
        `UPDATE ingredients SET category = 'General' WHERE tenant_id = $1 AND category = $2`,
        [tenantId, catName]
      );

      await client.query(
        `DELETE FROM inventory_categories WHERE id = $1 AND tenant_id = $2`,
        [id, tenantId]
      );
    }, { tenantId });

    return reply.send({ message: `Category "${catName}" deleted successfully. Associated ingredients moved to General.` });
  });

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
             COALESCE(i.base_unit, i.unit, 'UNIT') as base_unit,
             COALESCE(i.purchase_unit, i.unit, 'UNIT') as purchase_unit,
             COALESCE(i.conversion_factor, 1.0000)::numeric as conversion_factor,
             COALESCE(i.purchase_cost, i.cost_per_unit)::numeric as purchase_cost,
             COALESCE(i.category, 'General') as category,
             COALESCE(bs_agg.current_stock, 0)::numeric as current_stock,
             COALESCE(bs_agg.cost_per_unit, i.cost_per_unit)::numeric as branch_cost_per_unit,
             COALESCE(latest_b.unit_cost, i.purchase_cost, i.cost_per_unit, 0)::numeric as latest_purchase_price,
             COALESCE(fifo_agg.total_value, (COALESCE(bs_agg.current_stock, 0) * COALESCE(latest_b.unit_cost, i.cost_per_unit, 0)))::numeric as total_stock_value,
             COALESCE(fifo_agg.active_batches_count, 0)::int as active_batches_count,
             COALESCE(fifo_agg.active_batches, '[]'::json) as active_batches
      FROM ingredients i
      LEFT JOIN LATERAL (
        SELECT COALESCE(SUM(bs.current_stock), 0) as current_stock,
               COALESCE(AVG(bs.cost_per_unit), 0) as cost_per_unit
        FROM branch_stocks bs
        WHERE bs.ingredient_id = i.id
          ${branchId ? 'AND bs.branch_id = $2' : ''}
      ) bs_agg ON true
      LEFT JOIN LATERAL (
        SELECT ib.unit_cost
        FROM inventory_batches ib
        WHERE ib.ingredient_id = i.id AND ib.tenant_id = i.tenant_id
          ${branchId ? 'AND ib.branch_id = $2' : ''}
        ORDER BY ib.received_at DESC, ib.created_at DESC
        LIMIT 1
      ) latest_b ON true
      LEFT JOIN LATERAL (
        SELECT
          COUNT(ib.id)::int as active_batches_count,
          SUM(ib.quantity_remaining * ib.unit_cost) as total_value,
          json_agg(
            json_build_object(
              'id', ib.id,
              'purchase_id', ib.purchase_id,
              'quantity_received', ib.quantity_received::numeric,
              'quantity_remaining', ib.quantity_remaining::numeric,
              'unit_cost', ib.unit_cost::numeric,
              'unit', COALESCE(ib.unit, i.base_unit, i.unit, 'UNIT'),
              'received_at', ib.received_at,
              'supplier_name', ib.supplier_name,
              'status', ib.status
            ) ORDER BY ib.received_at ASC, ib.created_at ASC
          ) as active_batches
        FROM inventory_batches ib
        WHERE ib.ingredient_id = i.id AND ib.tenant_id = i.tenant_id
          AND ib.status = 'ACTIVE' AND ib.quantity_remaining > 0
          ${branchId ? 'AND ib.branch_id = $2' : ''}
      ) fifo_agg ON true
      WHERE i.tenant_id = $1 AND i.is_active = true
    `;
    const params: any[] = [tenantId];
    if (branchId) params.push(branchId);

    if (search) {
      params.push(`%${search}%`);
      sql += ` AND (i.name ILIKE $${params.length} OR i.sku ILIKE $${params.length} OR i.category ILIKE $${params.length})`;
    }

    if (lowStockOnly === 'true') {
      sql += ` AND COALESCE(bs_agg.current_stock, 0) <= i.min_stock_alert`;
    }

    sql += ' ORDER BY i.name ASC';

    const { rows } = await query(sql, params, { tenantId });
    const formatted = rows.map((ing) => ({
      ...ing,
      display_stock: formatDisplayStock(
        Number(ing.current_stock || 0),
        ing.base_unit || ing.unit || 'G',
        ing.purchase_unit,
        Number(ing.conversion_factor || 1)
      ),
    }));

    return reply.send({ ingredients: formatted });
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
      SELECT b.*, i.name as ingredient_name, COALESCE(i.base_unit, i.unit) as ingredient_unit, br.name as branch_name
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
   * FIFO Inventory Valuation Report
   */
  fastify.get('/api/inventory/valuation', {
    preHandler: [requirePermission(Permission.INVENTORY_VIEW)],
  }, async (req, reply) => {
    const tenantId = req.user!.tenantId!;
    const { branchId, category } = req.query as { branchId?: string; category?: string };

    const params: any[] = [tenantId];
    let branchFilter = '';
    if (branchId) {
      params.push(branchId);
      branchFilter = `AND ib.branch_id = $${params.length}`;
    }

    let categoryFilter = '';
    if (category && category !== 'ALL') {
      params.push(category);
      categoryFilter = `AND i.category = $${params.length}`;
    }

    const valuationSql = `
      SELECT
        i.id as ingredient_id,
        i.name as ingredient_name,
        COALESCE(i.category, 'General') as category,
        COALESCE(i.base_unit, i.unit, 'UNIT') as unit,
        COALESCE(i.purchase_cost, i.cost_per_unit, 0)::numeric as latest_purchase_price,
        COALESCE(bs_agg.current_stock, 0)::numeric as available_quantity,
        COALESCE(fifo_agg.total_value, 0)::numeric as remaining_stock_value,
        COALESCE(fifo_agg.batches_count, 0)::int as active_batches_count,
        COALESCE(fifo_agg.batches, '[]'::json) as remaining_batches
      FROM ingredients i
      LEFT JOIN LATERAL (
        SELECT COALESCE(SUM(bs.current_stock), 0) as current_stock
        FROM branch_stocks bs
        WHERE bs.ingredient_id = i.id
          ${branchId ? 'AND bs.branch_id = $2' : ''}
      ) bs_agg ON true
      LEFT JOIN LATERAL (
        SELECT
          COUNT(ib.id) as batches_count,
          COALESCE(SUM(ib.quantity_remaining * ib.unit_cost), 0) as total_value,
          json_agg(
            json_build_object(
              'batch_id', ib.id,
              'purchase_id', ib.purchase_id,
              'received_at', ib.received_at,
              'original_quantity', ib.quantity_received::numeric,
              'remaining_quantity', ib.quantity_remaining::numeric,
              'unit_cost', ib.unit_cost::numeric,
              'remaining_value', (ib.quantity_remaining * ib.unit_cost)::numeric,
              'unit', COALESCE(ib.unit, i.base_unit, i.unit, 'UNIT'),
              'supplier_name', ib.supplier_name,
              'status', ib.status
            ) ORDER BY ib.received_at ASC, ib.created_at ASC
          ) as batches
        FROM inventory_batches ib
        WHERE ib.ingredient_id = i.id AND ib.tenant_id = i.tenant_id
          AND ib.status = 'ACTIVE' AND ib.quantity_remaining > 0
          ${branchFilter}
      ) fifo_agg ON true
      WHERE i.tenant_id = $1 AND i.is_active = true ${categoryFilter}
      ORDER BY i.name ASC
    `;

    const { rows: items } = await query(valuationSql, params, { tenantId });

    const totalInventoryValue = items.reduce((sum, item) => sum + Number(item.remaining_stock_value || 0), 0);
    const totalItemsCount = items.length;
    const totalActiveBatchesCount = items.reduce((sum, item) => sum + Number(item.active_batches_count || 0), 0);

    return reply.send({
      summary: {
        totalInventoryValue,
        totalItemsCount,
        totalActiveBatchesCount,
      },
      items,
    });
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
    const {
      name,
      nameUrdu,
      category,
      sku,
      unit,
      baseUnit,
      purchaseUnit,
      conversionFactor,
      purchaseCost,
      costPerUnit,
      minStockAlert,
      initialBranchStock,
      initialStock,
      branchId,
    } = parsed.data;

    const existing = await query('SELECT id FROM ingredients WHERE tenant_id = $1 AND sku = $2', [tenantId, sku], { tenantId });
    if (existing.rows.length > 0) return reply.status(400).send({ error: 'Ingredient SKU already exists' });

    const resolvedUnit = unit || baseUnit || 'UNIT';
    const resolvedBaseUnit = baseUnit || unit || resolvedUnit;
    const resolvedPurchaseUnit = purchaseUnit || resolvedUnit;
    let resolvedFactor = Number(conversionFactor) > 0 ? Number(conversionFactor) : 1;
    if (!conversionFactor) {
      if (purchaseUnit && purchaseUnit !== resolvedBaseUnit) {
        if (resolvedPurchaseUnit === 'KG' && resolvedBaseUnit === 'G') resolvedFactor = 1000;
        else if (resolvedPurchaseUnit === 'L' && resolvedBaseUnit === 'ML') resolvedFactor = 1000;
        else if (resolvedPurchaseUnit === 'DOZEN' && resolvedBaseUnit === 'PCS') resolvedFactor = 12;
      } else {
        resolvedFactor = 1;
      }
    }
    const resolvedPurchaseCost =
      purchaseCost !== undefined && purchaseCost !== null && Number(purchaseCost) >= 0
        ? Number(purchaseCost)
        : Number(costPerUnit || 0) * resolvedFactor;
    const resolvedBaseCost =
      resolvedPurchaseCost > 0 && resolvedFactor > 0
        ? calculateBaseUnitCost(resolvedPurchaseCost, resolvedFactor)
        : Number(costPerUnit || 0);

    const result = await withTransaction(async (client) => {
      const ingRes = await client.query(
        `
        INSERT INTO ingredients (
          tenant_id, name, name_urdu, category, sku, unit, base_unit,
          purchase_unit, conversion_factor, purchase_cost, cost_per_unit, min_stock_alert, is_active
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, true)
        RETURNING *
        `,
        [
          tenantId,
          name,
          nameUrdu || null,
          category || 'General',
          sku,
          resolvedBaseUnit,
          resolvedBaseUnit,
          resolvedPurchaseUnit,
          resolvedFactor,
          resolvedPurchaseCost,
          resolvedBaseCost,
          minStockAlert,
        ]
      );
      const ingredient = ingRes.rows[0];

      // Consolidate initial stock entries across branches
      const branchStockMap: Record<string, number> = {};
      if (initialBranchStock) {
        Object.assign(branchStockMap, initialBranchStock);
      }
      if (initialStock !== undefined && initialStock > 0) {
        const targetBId = branchId || req.user?.branchId;
        if (targetBId) {
          branchStockMap[targetBId] = (branchStockMap[targetBId] || 0) + Number(initialStock);
        }
      }

      for (const [bId, qty] of Object.entries(branchStockMap)) {
        const baseQty = Number(qty) || 0;
        await client.query(
          `
          INSERT INTO branch_stocks (tenant_id, branch_id, ingredient_id, current_stock, cost_per_unit)
          VALUES ($1, $2, $3, $4, $5)
          ON CONFLICT (branch_id, ingredient_id) DO UPDATE SET current_stock = $4, cost_per_unit = $5
          `,
          [tenantId, bId, ingredient.id, baseQty, resolvedBaseCost]
        );

        if (baseQty > 0) {
          await client.query(
            `
            INSERT INTO inventory_batches (
              tenant_id, branch_id, ingredient_id, quantity_received, quantity_remaining, unit_cost, received_at, status
            ) VALUES ($1, $2, $3, $4, $4, $5, CURRENT_TIMESTAMP, 'ACTIVE')
            `,
            [tenantId, bId, ingredient.id, baseQty, resolvedBaseCost]
          );

          await client.query(
            `
            INSERT INTO stock_movements (
              tenant_id, branch_id, ingredient_id, movement_type, quantity,
              stock_before, stock_after, unit_cost, total_cost, reference_type, reason, recorded_by_user_id
            ) VALUES ($1, $2, $3, 'OPENING_STOCK', $4, 0, $4, $5, $6, 'ADJUSTMENT', 'Opening Stock', $7)
            `,
            [tenantId, bId, ingredient.id, baseQty, resolvedBaseCost, baseQty * resolvedBaseCost, req.user!.id]
          );
        }
      }

      return ingredient;
    }, { tenantId });

    return reply.status(201).send({ ingredient: result });
  });

  fastify.put('/api/inventory/ingredients/:id', {
    preHandler: [requirePermission(Permission.INVENTORY_MANAGE)],
  }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const tenantId = req.user!.tenantId!;
    const {
      name,
      sku,
      category,
      unit,
      baseUnit,
      purchaseUnit,
      conversionFactor,
      purchaseCost,
      costPerUnit,
      minStockAlert,
    } = req.body as any;

    const resolvedBaseUnit = baseUnit || unit;
    const resolvedFactor = conversionFactor !== undefined ? Number(conversionFactor) : undefined;
    const resolvedPurchaseCost = purchaseCost !== undefined ? Number(purchaseCost) : undefined;

    let computedBaseCost: number | undefined = undefined;
    if (resolvedPurchaseCost !== undefined && resolvedFactor !== undefined && resolvedFactor > 0) {
      computedBaseCost = calculateBaseUnitCost(resolvedPurchaseCost, resolvedFactor);
    } else if (costPerUnit !== undefined) {
      computedBaseCost = Number(costPerUnit);
    }

    const { rows } = await query(
      `
      UPDATE ingredients
      SET name = COALESCE($1, name),
          sku = COALESCE($2, sku),
          category = COALESCE($3, category),
          unit = COALESCE($4, unit),
          base_unit = COALESCE($4, base_unit),
          purchase_unit = COALESCE($5, purchase_unit),
          conversion_factor = COALESCE($6, conversion_factor),
          purchase_cost = COALESCE($7, purchase_cost),
          cost_per_unit = COALESCE($8, cost_per_unit),
          min_stock_alert = COALESCE($9, min_stock_alert),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $10 AND tenant_id = $11
      RETURNING *
      `,
      [
        name,
        sku,
        category,
        resolvedBaseUnit,
        purchaseUnit,
        resolvedFactor,
        resolvedPurchaseCost,
        computedBaseCost,
        minStockAlert !== undefined ? Number(minStockAlert) : null,
        id,
        tenantId,
      ],
      { tenantId }
    );

    if (rows.length === 0) return reply.status(404).send({ error: 'Ingredient not found' });
    return reply.send({ ingredient: rows[0] });
  });

  fastify.delete('/api/inventory/ingredients/:id', {
    preHandler: [requirePermission(Permission.INVENTORY_MANAGE)],
  }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const tenantId = req.user!.tenantId!;

    await withTransaction(async (client) => {
      await client.query('DELETE FROM branch_stocks WHERE ingredient_id = $1 AND tenant_id = $2', [id, tenantId]);
      await client.query('DELETE FROM recipe_ingredients WHERE ingredient_id = $1 AND tenant_id = $2', [id, tenantId]);
      await client.query('DELETE FROM ingredients WHERE id = $1 AND tenant_id = $2', [id, tenantId]);
    }, { tenantId });

    return reply.send({ message: 'Ingredient deleted successfully' });
  });

  /**
   * Dedicated Inventory Item Usage / Where Used Mapping
   * Shows which menu items consume this ingredient, units sold, theoretical vs actual FIFO deduction,
   * order-by-order consumption history, wastage, and branch breakdown.
   */
  fastify.get('/api/inventory/ingredients/:id/usage', {
    preHandler: [requirePermission(Permission.INVENTORY_VIEW)],
  }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const tenantId = req.user!.tenantId!;
    const { branchId } = req.query as { branchId?: string };

    const ingParams: any[] = [id, tenantId];
    if (branchId) ingParams.push(branchId);

    // 1. Fetch ingredient details & current branch stock using active FIFO batch valuation
    const ingSql = `
      SELECT i.*,
             COALESCE(latest_b.unit_cost, i.purchase_cost, i.cost_per_unit, 0)::numeric as latest_purchase_price,
             COALESCE(bs_agg.current_stock, 0)::numeric as available_stock,
             COALESCE(fifo_agg.total_value, (COALESCE(bs_agg.current_stock, 0) * COALESCE(latest_b.unit_cost, i.cost_per_unit, 0)))::numeric as total_stock_value
      FROM ingredients i
      LEFT JOIN (
        SELECT ingredient_id,
               SUM(current_stock) as current_stock
        FROM branch_stocks
        ${branchId ? 'WHERE branch_id = $3' : ''}
        GROUP BY ingredient_id
      ) bs_agg ON bs_agg.ingredient_id = i.id
      LEFT JOIN LATERAL (
        SELECT unit_cost
        FROM inventory_batches
        WHERE ingredient_id = i.id AND tenant_id = $2
          ${branchId ? 'AND branch_id = $3' : ''}
        ORDER BY received_at DESC, created_at DESC
        LIMIT 1
      ) latest_b ON true
      LEFT JOIN LATERAL (
        SELECT
          SUM(quantity_remaining * unit_cost) as total_value
        FROM inventory_batches
        WHERE ingredient_id = i.id AND tenant_id = $2 AND status = 'ACTIVE'
          ${branchId ? 'AND branch_id = $3' : ''}
      ) fifo_agg ON true
      WHERE i.id = $1 AND i.tenant_id = $2
    `;
    const { rows: ingRows } = await query(ingSql, ingParams, { tenantId });
    if (ingRows.length === 0) return reply.status(404).send({ error: 'Ingredient not found' });
    const ingredient = ingRows[0];

    // 2. Query Menu Items that use this ingredient with consumption and sales metrics
    const menuItemsSql = `
      SELECT
        p.id as product_id,
        p.name as product_name,
        p.sku as product_sku,
        c.name as category_name,
        COALESCE(p.base_price, 0)::numeric as base_price,
        r.id as recipe_id,
        COALESCE(r.yield_count, 1)::numeric as yield_count,
        COALESCE(ri.entered_quantity, ri.quantity)::numeric as usage_per_item,
        COALESCE(ri.recipe_unit, ri.unit, i.base_unit, 'UNIT') as usage_unit,
        COALESCE(sales.units_sold, 0)::int as units_sold,
        (COALESCE(ri.entered_quantity, ri.quantity) * COALESCE(sales.units_sold, 0))::numeric as theoretical_consumed,
        COALESCE(actual.actual_consumed_qty, 0)::numeric as actual_consumed_qty,
        COALESCE(actual.actual_consumed_cost, 0)::numeric as actual_consumed_cost
      FROM recipe_ingredients ri
      JOIN recipes r ON r.id = ri.recipe_id
      JOIN products p ON p.id = r.product_id
      LEFT JOIN categories c ON c.id = p.category_id
      JOIN ingredients i ON i.id = ri.ingredient_id
      LEFT JOIN (
        SELECT oi.product_id, SUM(oi.quantity)::int as units_sold
        FROM order_items oi
        JOIN orders o ON o.id = oi.order_id
        WHERE o.tenant_id = $2 AND o.status NOT IN ('CANCELLED')
        ${branchId ? 'AND o.branch_id = $3' : ''}
        GROUP BY oi.product_id
      ) sales ON sales.product_id = p.id
      LEFT JOIN (
        SELECT oi.product_id,
               SUM(oibc.quantity)::numeric as actual_consumed_qty,
               SUM(oibc.total_cost)::numeric as actual_consumed_cost
        FROM order_item_batch_consumptions oibc
        JOIN order_items oi ON oi.id = oibc.order_item_id
        JOIN orders o ON o.id = oibc.order_id
        WHERE oibc.tenant_id = $2 AND oibc.ingredient_id = $1
          AND o.status NOT IN ('CANCELLED')
          ${branchId ? 'AND o.branch_id = $3' : ''}
        GROUP BY oi.product_id
      ) actual ON actual.product_id = p.id
      WHERE ri.ingredient_id = $1 AND ri.tenant_id = $2
      ORDER BY theoretical_consumed DESC, actual_consumed_qty DESC, p.name ASC
    `;
    const { rows: menuItems } = await query(menuItemsSql, ingParams, { tenantId });

    // 3. Stock Movements (Wastage, Adjustments, Damaged)
    const movementsSql = `
      SELECT
        movement_type,
        COUNT(*)::int as count,
        COALESCE(SUM(quantity), 0)::numeric as total_quantity
      FROM stock_movements
      WHERE ingredient_id = $1 AND tenant_id = $2
        ${branchId ? 'AND branch_id = $3' : ''}
      GROUP BY movement_type
    `;
    const { rows: movRows } = await query(movementsSql, ingParams, { tenantId });
    const movementsSummary: Record<string, number> = {};
    for (const m of movRows) {
      movementsSummary[m.movement_type] = Number(m.total_quantity || 0);
    }

    // 4. Order-by-order FIFO consumptions (recent 50 orders)
    const recentOrdersSql = `
      SELECT
        oibc.id,
        oibc.order_id,
        o.order_number,
        oibc.created_at,
        oi.product_name,
        oibc.quantity as quantity_consumed,
        COALESCE(ib.unit, i.base_unit, 'UNIT') as unit,
        COALESCE(ib.batch_code, 'LOT-' || SUBSTRING(ib.id::text, 1, 8)) as batch_code,
        oibc.unit_cost,
        oibc.total_cost,
        o.customer_name,
        b.name as branch_name
      FROM order_item_batch_consumptions oibc
      JOIN orders o ON o.id = oibc.order_id
      JOIN order_items oi ON oi.id = oibc.order_item_id
      LEFT JOIN inventory_batches ib ON ib.id = oibc.batch_id
      LEFT JOIN branches b ON b.id = oibc.branch_id
      JOIN ingredients i ON i.id = oibc.ingredient_id
      WHERE oibc.ingredient_id = $1 AND oibc.tenant_id = $2
        ${branchId ? 'AND oibc.branch_id = $3' : ''}
      ORDER BY oibc.created_at DESC
      LIMIT 50
    `;
    const { rows: recentOrders } = await query(recentOrdersSql, ingParams, { tenantId });

    // 5. Branch-wise stock & consumption summary
    const branchSummarySql = `
      SELECT
        b.id as branch_id,
        b.name as branch_name,
        COALESCE(bs.current_stock, 0)::numeric as current_stock,
        COALESCE(cons.total_consumed, 0)::numeric as total_consumed,
        COALESCE(cons.total_cost, 0)::numeric as total_cost
      FROM branches b
      LEFT JOIN branch_stocks bs ON bs.branch_id = b.id AND bs.ingredient_id = $1
      LEFT JOIN (
        SELECT oibc.branch_id,
               SUM(oibc.quantity)::numeric as total_consumed,
               SUM(oibc.total_cost)::numeric as total_cost
        FROM order_item_batch_consumptions oibc
        JOIN orders o ON o.id = oibc.order_id
        WHERE oibc.ingredient_id = $1 AND oibc.tenant_id = $2
          AND o.status NOT IN ('CANCELLED')
        GROUP BY oibc.branch_id
      ) cons ON cons.branch_id = b.id
      WHERE b.tenant_id = $2 AND b.is_active = true
      ORDER BY b.is_main_branch DESC, b.name ASC
    `;
    const { rows: branchSummary } = await query(branchSummarySql, [id, tenantId], { tenantId });

    // 6. Aggregate totals
    const totalTheoretical = menuItems.reduce((acc, m) => acc + Number(m.theoretical_consumed || 0), 0);
    const totalActualQty = menuItems.reduce((acc, m) => acc + Number(m.actual_consumed_qty || 0), 0);
    const totalActualCost = menuItems.reduce((acc, m) => acc + Number(m.actual_consumed_cost || 0), 0);
    const totalUnitsSold = menuItems.reduce((acc, m) => acc + Number(m.units_sold || 0), 0);

    return reply.send({
      ingredient: {
        id: ingredient.id,
        name: ingredient.name,
        sku: ingredient.sku,
        category: ingredient.category,
        unit: ingredient.base_unit || ingredient.unit || 'UNIT',
        availableStock: Number(ingredient.available_stock || 0),
        stockValue: Number(ingredient.total_stock_value || 0),
        latestPurchasePrice: Number(ingredient.latest_purchase_price || 0),
        minStockAlert: Number(ingredient.min_stock_alert || 0),
      },
      summary: {
        menuItemsCount: menuItems.length,
        totalUnitsSold,
        totalTheoreticalConsumed: Number(totalTheoretical.toFixed(4)),
        totalActualConsumedQty: Number(totalActualQty.toFixed(4)),
        totalActualConsumedCost: Number(totalActualCost.toFixed(2)),
        wastageQuantity: Number((movementsSummary['WASTAGE'] || 0).toFixed(4)),
        adjustmentQuantity: Number((movementsSummary['ADJUSTMENT'] || 0).toFixed(4)),
        damagedQuantity: Number((movementsSummary['DAMAGED'] || 0).toFixed(4)),
      },
      menuItems: menuItems.map((m) => {
        const theo = Number(m.theoretical_consumed || 0);
        const pct = totalTheoretical > 0 ? Number(((theo / totalTheoretical) * 100).toFixed(1)) : 0;
        return {
          productId: m.product_id,
          productName: m.product_name,
          productSku: m.product_sku,
          categoryName: m.category_name,
          basePrice: Number(m.base_price),
          recipeId: m.recipe_id,
          yieldCount: Number(m.yield_count),
          usagePerItem: Number(m.usage_per_item),
          usageUnit: m.usage_unit,
          unitsSold: Number(m.units_sold),
          totalTheoreticalConsumed: Number(theo.toFixed(4)),
          actualConsumedQty: Number(Number(m.actual_consumed_qty).toFixed(4)),
          actualConsumedCost: Number(Number(m.actual_consumed_cost).toFixed(2)),
          usagePercentage: pct,
        };
      }),
      recentOrders: recentOrders.map((o) => ({
        id: o.id,
        orderId: o.order_id,
        orderNumber: o.order_number,
        createdAt: o.created_at,
        productName: o.product_name,
        quantityConsumed: Number(o.quantity_consumed),
        unit: o.unit,
        batchCode: o.batch_code,
        unitCost: Number(o.unit_cost),
        totalCost: Number(o.total_cost),
        customerName: o.customer_name,
        branchName: o.branch_name,
      })),
      branchSummary: branchSummary.map((b) => ({
        branchId: b.branch_id,
        branchName: b.branch_name,
        currentStock: Number(b.current_stock || 0),
        totalConsumed: Number(b.total_consumed || 0),
        totalCost: Number(b.total_cost || 0),
      })),
    });
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
        SELECT ri.*,
               COALESCE(ri.entered_quantity, ri.quantity) as entered_quantity,
               COALESCE(ri.recipe_unit, ri.unit) as recipe_unit,
               COALESCE(ri.unit_cost, i.cost_per_unit)::numeric as unit_cost,
               COALESCE(ri.total_cost, (ri.quantity * i.cost_per_unit))::numeric as total_cost,
               i.name as ingredient_name, i.cost_per_unit,
               COALESCE(i.base_unit, i.unit, 'UNIT') as base_unit,
               COALESCE(i.purchase_unit, i.unit, 'UNIT') as purchase_unit,
               COALESCE(i.conversion_factor, 1.0000)::numeric as conversion_factor
        FROM recipe_ingredients ri
        JOIN ingredients i ON i.id = ri.ingredient_id
        WHERE ri.recipe_id = $1 AND ri.tenant_id = $2
        `,
        [r.id, tenantId],
        { tenantId }
      );
      r.ingredients = ings;
      r.items = ings;
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
      // Calculate total recipe cost with automatic unit conversion
      let totalCost = 0;
      const normalizedIngredients = [];

      for (const ing of ingredients) {
        const ingRes = await client.query(
          `SELECT cost_per_unit, base_unit, unit, conversion_factor
           FROM ingredients WHERE id = $1 AND tenant_id = $2`,
          [ing.ingredientId, tenantId]
        );
        const ingRow = ingRes.rows[0];
        const baseUnit = ingRow?.base_unit || ingRow?.unit || 'G';
        const costPerBaseUnit = Number(ingRow?.cost_per_unit || 0);

        const enteredQty = ing.enteredQuantity !== undefined ? ing.enteredQuantity : ing.quantity;
        const recipeUnit = ing.recipeUnit || ing.unit;
        const baseQty = convertRecipeQtyToBase(
          enteredQty,
          recipeUnit,
          baseUnit,
          Number(ingRow?.conversion_factor || 1)
        );
        const lineCost = baseQty * costPerBaseUnit;

        totalCost += lineCost;
        normalizedIngredients.push({
          ingredientId: ing.ingredientId,
          enteredQuantity: enteredQty,
          recipeUnit,
          quantity: baseQty,
          unit: baseUnit,
          unitCost: costPerBaseUnit,
          totalCost: lineCost,
        });
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

      for (const normIng of normalizedIngredients) {
        await client.query(
          `
          INSERT INTO recipe_ingredients (
            tenant_id, recipe_id, ingredient_id, entered_quantity, recipe_unit, quantity, unit, unit_cost, total_cost
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          `,
          [
            tenantId,
            recipeId,
            normIng.ingredientId,
            normIng.enteredQuantity,
            normIng.recipeUnit,
            normIng.quantity,
            normIng.unit,
            normIng.unitCost,
            normIng.totalCost,
          ]
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

      if (movementType === StockMovementType.PHYSICAL_COUNT) {
        // Physical stock count: user specifies actual counted stock in store
        newStock = Math.max(0, quantity);
        qtyDelta = newStock - currentStock;

        if (qtyDelta > 0) {
          // Count surplus: add FIFO batch
          await client.query(
            `
            INSERT INTO inventory_batches (
              tenant_id, branch_id, ingredient_id, quantity_received, quantity_remaining, unit_cost, received_at, status
            ) VALUES ($1, $2, $3, $4, $4, $5, CURRENT_TIMESTAMP, 'ACTIVE')
            `,
            [tenantId, branchId, ingredientId, qtyDelta, costPerUnit]
          );
        } else if (qtyDelta < 0) {
          // Count shortage: deduct from oldest batches
          let remainingToDeduct = Math.abs(qtyDelta);
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
            remainingToDeduct -= take;

            await client.query(
              `UPDATE inventory_batches SET quantity_remaining = $1, status = $2 WHERE id = $3`,
              [avail - take, (avail - take) <= 0 ? 'EXHAUSTED' : 'ACTIVE', b.id]
            );
          }
        }
      } else if (
        movementType === StockMovementType.ADJUSTMENT_ADD ||
        movementType === StockMovementType.OPENING_STOCK
      ) {
        qtyDelta = quantity;
        newStock = currentStock + quantity;

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
        // Subtractions: ADJUSTMENT_SUBTRACT, WASTAGE, DAMAGED, EXPIRED, CORRECTION
        qtyDelta = -quantity;
        newStock = Math.max(0, currentStock - quantity);

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

  fastify.put('/api/inventory/suppliers/:id', {
    preHandler: [requirePermission(Permission.PURCHASES_MANAGE)],
  }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const tenantId = req.user!.tenantId!;
    const { name, contactPerson, phone, email, address, taxNumber } = req.body as any;

    const { rows } = await query(
      `
      UPDATE suppliers
      SET name = COALESCE($1, name),
          contact_person = COALESCE($2, contact_person),
          phone = COALESCE($3, phone),
          email = COALESCE($4, email),
          address = COALESCE($5, address),
          tax_number = COALESCE($6, tax_number)
      WHERE id = $7 AND tenant_id = $8
      RETURNING *
      `,
      [name, contactPerson, phone, email, address, taxNumber, id, tenantId],
      { tenantId }
    );

    if (rows.length === 0) return reply.status(404).send({ error: 'Supplier not found' });
    return reply.send({ supplier: rows[0] });
  });

  fastify.delete('/api/inventory/suppliers/:id', {
    preHandler: [requirePermission(Permission.PURCHASES_MANAGE)],
  }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const tenantId = req.user!.tenantId!;

    await query('DELETE FROM suppliers WHERE id = $1 AND tenant_id = $2', [id, tenantId], { tenantId });
    return reply.send({ message: 'Supplier deleted successfully' });
  });

  /**
   * Record Supplier Payment-Out (Alt + O)
   * Reduces supplier balance payable and records payment
   */
  fastify.post('/api/inventory/suppliers/:id/payment', {
    preHandler: [requirePermission(Permission.PURCHASES_MANAGE)],
  }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const tenantId = req.user!.tenantId!;
    const { amount, paymentMethod, bankAccountId, notes } = req.body as {
      amount: number;
      paymentMethod?: string;
      bankAccountId?: string;
      notes?: string;
    };

    if (!amount || Number(amount) <= 0) {
      return reply.status(400).send({ error: 'Valid payment amount is required' });
    }

    const { rows: suppRows } = await query('SELECT * FROM suppliers WHERE id = $1 AND tenant_id = $2', [id, tenantId], { tenantId });
    if (suppRows.length === 0) return reply.status(404).send({ error: 'Supplier not found' });

    const currentBal = Number(suppRows[0].balance_payable || 0);
    const newBalance = Math.max(0, currentBal - Number(amount));

    const { rows: updated } = await query(
      `
      UPDATE suppliers
      SET balance_payable = $1
      WHERE id = $2 AND tenant_id = $3
      RETURNING *
      `,
      [newBalance, id, tenantId],
      { tenantId }
    );

    return reply.send({
      message: 'Payment-Out recorded successfully',
      supplier: updated[0],
      amountPaid: Number(amount),
      paymentMethod: paymentMethod || 'CASH',
      bankAccountId: bankAccountId || null,
      previousBalance: currentBal,
      newBalance,
    });
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

  fastify.get('/api/inventory/purchases/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const tenantId = req.user!.tenantId!;

    const { rows: purchases } = await query(
      `SELECT pi.*, s.name as supplier_name, s.phone as supplier_phone, b.name as branch_name, u.full_name as recorded_by_name
       FROM purchase_invoices pi
       JOIN suppliers s ON s.id = pi.supplier_id
       JOIN branches b ON b.id = pi.branch_id
       LEFT JOIN users u ON u.id = pi.recorded_by_user_id
       WHERE pi.id = $1 AND pi.tenant_id = $2`,
      [id, tenantId],
      { tenantId }
    );

    if (purchases.length === 0) {
      return reply.status(404).send({ error: 'Purchase invoice not found' });
    }

    const { rows: items } = await query(
      `SELECT pi_item.*, i.name as ingredient_name,
              COALESCE(i.base_unit, i.unit, 'UNIT') as base_unit,
              COALESCE(pi_item.purchase_unit, pi_item.unit) as purchase_unit,
              COALESCE(pi_item.conversion_factor, 1.0000)::numeric as conversion_factor,
              COALESCE(pi_item.base_quantity, pi_item.quantity)::numeric as base_quantity,
              COALESCE(pi_item.base_unit_cost, pi_item.unit_price)::numeric as base_unit_cost
       FROM purchase_items pi_item
       JOIN ingredients i ON i.id = pi_item.ingredient_id
       WHERE pi_item.purchase_id = $1 AND pi_item.tenant_id = $2
       ORDER BY pi_item.id ASC`,
      [id, tenantId],
      { tenantId }
    );

    return reply.send({ purchase: purchases[0], items });
  });

  fastify.post('/api/inventory/purchases', {
    preHandler: [requirePermission(Permission.PURCHASES_MANAGE)],
  }, async (req, reply) => {
    const parsed = CreatePurchaseInvoiceSchema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.format() });

    const tenantId = req.user!.tenantId!;
    const { branchId, supplierId, newSupplierName, invoiceNumber, purchaseDate, taxAmount, paidAmount, receiveNow, notes, items } = parsed.data;

    const subtotal = items.reduce((acc, it) => acc + (it.quantity * it.unitPrice), 0);
    const totalAmount = subtotal + taxAmount;
    const balancePayable = Math.max(0, totalAmount - paidAmount);

    const purchase = await withTransaction(async (client) => {
      // 1. Resolve or create supplier
      let resolvedSupplierId = supplierId;
      if (!resolvedSupplierId && newSupplierName && newSupplierName.trim()) {
        const sTrim = newSupplierName.trim();
        const sCheck = await client.query(
          'SELECT id FROM suppliers WHERE tenant_id = $1 AND LOWER(TRIM(name)) = LOWER($2) LIMIT 1',
          [tenantId, sTrim]
        );
        if (sCheck.rows.length > 0) {
          resolvedSupplierId = sCheck.rows[0].id;
        } else {
          const sNew = await client.query(
            `INSERT INTO suppliers (tenant_id, name, phone, balance_payable, is_active)
             VALUES ($1, $2, 'N/A', 0, true) RETURNING id`,
            [tenantId, sTrim]
          );
          resolvedSupplierId = sNew.rows[0].id;
        }
      }

      if (!resolvedSupplierId) {
        // Fallback to first existing supplier or create default
        const anySup = await client.query('SELECT id FROM suppliers WHERE tenant_id = $1 ORDER BY created_at ASC LIMIT 1', [tenantId]);
        if (anySup.rows.length > 0) {
          resolvedSupplierId = anySup.rows[0].id;
        } else {
          const defaultSup = await client.query(
            `INSERT INTO suppliers (tenant_id, name, phone, balance_payable, is_active)
             VALUES ($1, 'General Supplier', 'N/A', 0, true) RETURNING id`,
            [tenantId]
          );
          resolvedSupplierId = defaultSup.rows[0].id;
        }
      }

      // 2. Resolve invoice number
      const resolvedInvoiceNumber = (invoiceNumber && invoiceNumber.trim())
        ? invoiceNumber.trim()
        : `INV-${Date.now().toString().slice(-6)}`;

      const pRes = await client.query(
        `
        INSERT INTO purchase_invoices (
          tenant_id, branch_id, supplier_id, invoice_number, status,
          subtotal, tax_amount, total_amount, paid_amount, balance_payable,
          recorded_by_user_id, notes, created_at
        ) VALUES ($1, $2, $3, $4, 'DRAFT', $5, $6, $7, $8, $9, $10, $11, COALESCE($12::timestamptz, CURRENT_TIMESTAMP))
        RETURNING *
        `,
        [
          tenantId,
          branchId,
          resolvedSupplierId,
          resolvedInvoiceNumber,
          subtotal,
          taxAmount,
          totalAmount,
          paidAmount,
          balancePayable,
          req.user!.id,
          notes || null,
          purchaseDate ? new Date(purchaseDate).toISOString() : null
        ]
      );
      let newPurchase = pRes.rows[0];

      // 3. Resolve items & automatically create ingredients if not existing
      for (const it of items) {
        let resolvedIngredientId = it.ingredientId;
        const rawName = (it.name || it.itemName || '').trim();

        if (!resolvedIngredientId && rawName) {
          // Check if ingredient exists by name
          const existingIng = await client.query(
            'SELECT id, name, unit FROM ingredients WHERE tenant_id = $1 AND LOWER(TRIM(name)) = LOWER($2) LIMIT 1',
            [tenantId, rawName]
          );

          if (existingIng.rows.length > 0) {
            resolvedIngredientId = existingIng.rows[0].id;
          } else {
            // Automatically create new ingredient
            const autoSku = `ING-${rawName.slice(0, 3).toUpperCase().replace(/[^A-Z0-9]/g, 'X')}-${Date.now().toString().slice(-4)}`;
            const newIngRes = await client.query(
              `
              INSERT INTO ingredients (
                tenant_id, name, sku, unit, base_unit, purchase_unit,
                cost_per_unit, purchase_cost, min_stock_alert, is_active
              ) VALUES ($1, $2, $3, $4, $4, $4, $5, $5, 5, true)
              RETURNING id, name, unit
              `,
              [tenantId, rawName, autoSku, it.unit, it.unitPrice]
            );
            resolvedIngredientId = newIngRes.rows[0].id;

            // Initialize stock in branch
            await client.query(
              `
              INSERT INTO branch_stocks (tenant_id, branch_id, ingredient_id, current_stock, cost_per_unit)
              VALUES ($1, $2, $3, 0, $4)
              ON CONFLICT (branch_id, ingredient_id) DO NOTHING
              `,
              [tenantId, branchId, resolvedIngredientId, it.unitPrice]
            );
          }
        }

        if (!resolvedIngredientId) {
          throw new Error('Item name or ingredient ID is required for all purchase rows');
        }

        const ingRes = await client.query(
          `SELECT base_unit, unit, purchase_unit
           FROM ingredients WHERE id = $1 AND tenant_id = $2`,
          [resolvedIngredientId, tenantId]
        );
        const ingRow = ingRes.rows[0];
        const itemUnit = it.unit || ingRow?.unit || ingRow?.base_unit || 'UNIT';

        const baseQuantity = Number(it.quantity) || 0;
        const baseUnitCost = Number(it.unitPrice) || 0;
        const totalPrice = it.quantity * it.unitPrice;

        await client.query(
          `
          INSERT INTO purchase_items (
            tenant_id, purchase_id, ingredient_id, unit, purchase_unit, conversion_factor,
            quantity, base_quantity, unit_price, base_unit_cost, total_price
          )
          VALUES ($1, $2, $3, $4, $4, 1.0, $5, $5, $6, $6, $7)
          `,
          [
            tenantId,
            newPurchase.id,
            resolvedIngredientId,
            itemUnit,
            baseQuantity,
            baseUnitCost,
            totalPrice,
          ]
        );
      }

      if (receiveNow === true) {
        await receivePurchaseInvoice(client, tenantId, newPurchase.id, req.user!.id);
        const updatedP = await client.query(
          'SELECT * FROM purchase_invoices WHERE id = $1 AND tenant_id = $2',
          [newPurchase.id, tenantId]
        );
        newPurchase = updatedP.rows[0];
      }

      return newPurchase;
    }, { tenantId });

    return reply.status(201).send({ purchase });
  });

  /**
   * Safe Historical Purchase Reconciliation
   */
  fastify.post('/api/inventory/purchases/reconcile', {
    preHandler: [requirePermission(Permission.PURCHASES_MANAGE)],
  }, async (req, reply) => {
    const tenantId = req.user!.tenantId!;
    const { purchaseId } = (req.body as { purchaseId?: string }) || {};

    let reconciledCount = 0;
    const reconciledInvoices: string[] = [];

    await withTransaction(async (client) => {
      // 1. If a specific purchaseId is provided, receive it if not already received
      if (purchaseId) {
        const pRes = await client.query(
          'SELECT id, status FROM purchase_invoices WHERE id = $1 AND tenant_id = $2 FOR UPDATE',
          [purchaseId, tenantId]
        );
        if (pRes.rows.length > 0 && pRes.rows[0].status !== 'RECEIVED') {
          await receivePurchaseInvoice(client, tenantId, purchaseId, req.user!.id);
          reconciledCount++;
          reconciledInvoices.push(purchaseId);
        }
      }

      // 2. Reconcile any unposted received items
      const unpostedRes = await client.query(
        `SELECT DISTINCT pi.id, pi.invoice_number
         FROM purchase_invoices pi
         JOIN purchase_items pit ON pit.purchase_id = pi.id
         LEFT JOIN inventory_batches ib ON ib.purchase_item_id = pit.id
         WHERE pi.tenant_id = $1 AND pi.status = 'RECEIVED' AND ib.id IS NULL`,
        [tenantId]
      );

      for (const row of unpostedRes.rows) {
        const missingItems = await client.query(
          `SELECT pit.*, pi.branch_id
           FROM purchase_items pit
           JOIN purchase_invoices pi ON pi.id = pit.purchase_id
           LEFT JOIN inventory_batches ib ON ib.purchase_item_id = pit.id
           WHERE pit.purchase_id = $1 AND pit.tenant_id = $2 AND ib.id IS NULL`,
          [row.id, tenantId]
        );

        for (const item of missingItems.rows) {
          const factor = Number(item.conversion_factor) > 0 ? Number(item.conversion_factor) : 1;
          const baseQty = item.base_quantity !== null && item.base_quantity !== undefined
            ? Number(item.base_quantity)
            : Number(item.quantity) * factor;
          const baseUnitCost = item.base_unit_cost !== null && item.base_unit_cost !== undefined
            ? Number(item.base_unit_cost)
            : Number(item.unit_price) / factor;

          await client.query(
            `INSERT INTO inventory_batches (
              tenant_id, branch_id, ingredient_id, purchase_item_id,
              quantity_received, quantity_remaining, unit_cost, received_at, status
            ) VALUES ($1, $2, $3, $4, $5, $5, $6, CURRENT_TIMESTAMP, 'ACTIVE')`,
            [tenantId, item.branch_id, item.ingredient_id, item.id, baseQty, baseUnitCost]
          );

          await client.query(
            `INSERT INTO branch_stocks (tenant_id, branch_id, ingredient_id, current_stock, cost_per_unit, last_updated)
             VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
             ON CONFLICT (branch_id, ingredient_id) DO UPDATE SET
               current_stock = branch_stocks.current_stock + $4,
               cost_per_unit = $5,
               last_updated = CURRENT_TIMESTAMP`,
            [tenantId, item.branch_id, item.ingredient_id, baseQty, baseUnitCost]
          );

          await client.query(
            `INSERT INTO stock_movements (
              tenant_id, branch_id, ingredient_id, movement_type,
              quantity, stock_before, stock_after, unit_cost, total_cost,
              reference_type, reference_id, reason, recorded_by_user_id
            ) VALUES ($1, $2, $3, 'PURCHASE_RECEIVE', $4, 0, $4, $5, $6, 'PURCHASE', $7, $8, $9)`,
            [
              tenantId,
              item.branch_id,
              item.ingredient_id,
              baseQty,
              baseUnitCost,
              baseQty * baseUnitCost,
              row.id,
              `Historical reconciliation of Inward Purchase #${row.invoice_number}`,
              req.user!.id,
            ]
          );
        }
        reconciledCount++;
        reconciledInvoices.push(row.invoice_number);
      }
    }, { tenantId });

    return reply.send({
      reconciledCount,
      reconciledInvoices,
      message: reconciledCount > 0
        ? `Successfully reconciled ${reconciledCount} purchase record(s) into inventory.`
        : 'All purchase invoices and inventory records are already 100% reconciled.',
    });
  });

  /**
   * Process Purchase Return (Alt + L)
   * Returns items to supplier, adjusts stock, and reduces supplier balance payable
   */
  fastify.post('/api/inventory/purchases/return', {
    preHandler: [requirePermission(Permission.PURCHASES_MANAGE)],
  }, async (req, reply) => {
    const tenantId = req.user!.tenantId!;
    const { supplierId, branchId, invoiceNumber, items, reason, returnAmount } = req.body as {
      supplierId: string;
      branchId?: string;
      invoiceNumber?: string;
      items: Array<{ ingredientId: string; quantity: number; returnPrice: number }>;
      reason?: string;
      returnAmount?: number;
    };

    if (!supplierId || !items || items.length === 0) {
      return reply.status(400).send({ error: 'Supplier ID and return items are required' });
    }

    const targetBranchId = branchId || req.user?.branchId;
    if (!targetBranchId) return reply.status(400).send({ error: 'Branch ID is required' });

    let totalRefund = returnAmount || 0;
    if (!totalRefund) {
      totalRefund = items.reduce((acc, it) => acc + (Number(it.quantity || 0) * Number(it.returnPrice || 0)), 0);
    }

    await withTransaction(async (client) => {
      // 1. Reduce supplier balance payable
      await client.query(
        'UPDATE suppliers SET balance_payable = GREATEST(0, balance_payable - $1) WHERE id = $2 AND tenant_id = $3',
        [totalRefund, supplierId, tenantId]
      );

      // 2. Adjust stock, deduct from FIFO batches, and log stock movement for each returned item
      for (const item of items) {
        const { rows: curRows } = await client.query(
          `SELECT current_stock, cost_per_unit FROM branch_stocks WHERE tenant_id = $1 AND branch_id = $2 AND ingredient_id = $3 FOR UPDATE`,
          [tenantId, targetBranchId, item.ingredientId]
        );
        const stockBefore = curRows.length > 0 ? Number(curRows[0].current_stock) : 0;
        const stockAfter = Math.max(0, stockBefore - Number(item.quantity));
        const unitCost = Number(item.returnPrice || curRows[0]?.cost_per_unit || 0);

        await client.query(
          `UPDATE branch_stocks
           SET current_stock = $1, last_updated = NOW()
           WHERE tenant_id = $2 AND branch_id = $3 AND ingredient_id = $4`,
          [stockAfter, tenantId, targetBranchId, item.ingredientId]
        );

        // Deduct returned quantity from active FIFO batches
        let remReturn = Number(item.quantity);
        const { rows: bRows } = await client.query(
          `SELECT id, quantity_remaining FROM inventory_batches WHERE tenant_id = $1 AND branch_id = $2 AND ingredient_id = $3 AND status = 'ACTIVE' AND quantity_remaining > 0 ORDER BY received_at DESC FOR UPDATE`,
          [tenantId, targetBranchId, item.ingredientId]
        );
        for (const b of bRows) {
          if (remReturn <= 0) break;
          const avail = Number(b.quantity_remaining);
          const take = Math.min(avail, remReturn);
          remReturn -= take;
          await client.query(`UPDATE inventory_batches SET quantity_remaining = $1, status = $2 WHERE id = $3`, [avail - take, (avail - take) <= 0 ? 'EXHAUSTED' : 'ACTIVE', b.id]);
        }

        await client.query(
          `INSERT INTO stock_movements (
             tenant_id, branch_id, ingredient_id, movement_type,
             quantity, stock_before, stock_after, unit_cost, total_cost,
             reference_type, reason, recorded_by_user_id
           ) VALUES ($1, $2, $3, 'RETURN_TO_SUPPLIER', $4, $5, $6, $7, $8, 'PURCHASE', $9, $10)`,
          [
            tenantId,
            targetBranchId,
            item.ingredientId,
            -Math.abs(item.quantity),
            stockBefore,
            stockAfter,
            unitCost,
            Math.abs(item.quantity) * unitCost,
            reason || `Purchase Return (${invoiceNumber || 'Manual'})`,
            req.user!.id,
          ]
        );
      }
    }, { tenantId });

    return reply.status(201).send({
      message: 'Purchase return processed successfully',
      supplierId,
      totalRefund,
      returnedItemsCount: items.length,
    });
  });

  /**
   * Complete Stock Ledger & Movements History
   */
  fastify.get('/api/inventory/movements', async (req, reply) => {
    const tenantId = req.user!.tenantId!;
    const { branchId, ingredientId, movementType, startDate, endDate, page = '1', limit = '25' } = req.query as {
      branchId?: string;
      ingredientId?: string;
      movementType?: string;
      startDate?: string;
      endDate?: string;
      page?: string;
      limit?: string;
    };

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, Math.min(100, parseInt(limit, 10) || 25));
    const offset = (pageNum - 1) * limitNum;

    let whereClause = 'WHERE sm.tenant_id = $1';
    const params: any[] = [tenantId];

    if (branchId) {
      params.push(branchId);
      whereClause += ` AND sm.branch_id = $${params.length}`;
    }
    if (ingredientId) {
      params.push(ingredientId);
      whereClause += ` AND sm.ingredient_id = $${params.length}`;
    }
    if (movementType) {
      params.push(movementType);
      whereClause += ` AND sm.movement_type = $${params.length}`;
    }
    if (startDate) {
      params.push(startDate);
      whereClause += ` AND sm.created_at >= $${params.length}::timestamptz`;
    }
    if (endDate) {
      params.push(endDate);
      whereClause += ` AND sm.created_at <= $${params.length}::timestamptz`;
    }

    const countRes = await query(
      `SELECT COUNT(*)::int as total FROM stock_movements sm ${whereClause}`,
      params,
      { tenantId }
    );
    const total = countRes.rows[0]?.total || 0;

    const dataSql = `
      SELECT sm.*,
             i.name as ingredient_name,
             COALESCE(i.base_unit, i.unit, 'UNIT') as base_unit,
             COALESCE(i.purchase_unit, i.unit, 'UNIT') as purchase_unit,
             COALESCE(i.conversion_factor, 1)::numeric as conversion_factor,
             b.name as branch_name,
             u.full_name as recorded_by_name,
             CASE WHEN sm.reference_type = 'ORDER' THEN o.order_number ELSE NULL END as order_number,
             CASE WHEN sm.reference_type = 'ORDER' THEN o.order_type ELSE NULL END as order_type
      FROM stock_movements sm
      JOIN ingredients i ON i.id = sm.ingredient_id
      JOIN branches b ON b.id = sm.branch_id
      LEFT JOIN users u ON u.id = sm.recorded_by_user_id
      LEFT JOIN orders o ON o.id = sm.reference_id AND sm.reference_type = 'ORDER'
      ${whereClause}
      ORDER BY sm.created_at DESC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `;

    const { rows: movements } = await query(dataSql, [...params, limitNum, offset], { tenantId });

    return reply.send({
      movements,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  });

  /**
   * Order Inventory Consumption Breakdown
   * Shows which order used which ingredients, quantities, unit costs and FIFO batch records
   */
  fastify.get('/api/inventory/order-consumption', {
    preHandler: [requirePermission(Permission.INVENTORY_VIEW)],
  }, async (req, reply) => {
    const tenantId = req.user!.tenantId!;
    const {
      branchId,
      orderId,
      ingredientId,
      search,
      startDate,
      endDate,
      page = '1',
      limit = '25',
    } = req.query as {
      branchId?: string;
      orderId?: string;
      ingredientId?: string;
      search?: string;
      startDate?: string;
      endDate?: string;
      page?: string;
      limit?: string;
    };

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, Math.min(100, parseInt(limit, 10) || 25));
    const offset = (pageNum - 1) * limitNum;

    let whereClause = 'WHERE oibc.tenant_id = $1';
    const params: any[] = [tenantId];

    if (branchId) {
      params.push(branchId);
      whereClause += ` AND oibc.branch_id = $${params.length}`;
    }
    if (orderId) {
      params.push(orderId);
      whereClause += ` AND oibc.order_id = $${params.length}`;
    }
    if (ingredientId) {
      params.push(ingredientId);
      whereClause += ` AND oibc.ingredient_id = $${params.length}`;
    }
    if (startDate) {
      params.push(startDate);
      whereClause += ` AND oibc.created_at >= $${params.length}::timestamptz`;
    }
    if (endDate) {
      params.push(endDate);
      whereClause += ` AND oibc.created_at <= $${params.length}::timestamptz`;
    }
    if (search && search.trim()) {
      params.push(`%${search.trim()}%`);
      whereClause += ` AND (o.order_number ILIKE $${params.length} OR oi.product_name ILIKE $${params.length} OR i.name ILIKE $${params.length} OR o.customer_name ILIKE $${params.length})`;
    }

    // Summary KPIs
    const summarySql = `
      SELECT
        COUNT(DISTINCT oibc.order_id)::int as total_orders_count,
        COALESCE(SUM(oibc.total_cost), 0)::numeric as total_cogs_amount,
        COUNT(DISTINCT oibc.ingredient_id)::int as unique_ingredients_count,
        COALESCE(SUM(oibc.quantity), 0)::numeric as total_quantity_used
      FROM order_item_batch_consumptions oibc
      JOIN orders o ON o.id = oibc.order_id
      JOIN order_items oi ON oi.id = oibc.order_item_id
      JOIN ingredients i ON i.id = oibc.ingredient_id
      ${whereClause}
    `;
    const { rows: summaryRows } = await query(summarySql, params, { tenantId });
    const summary = summaryRows[0] || {
      total_orders_count: 0,
      total_cogs_amount: 0,
      unique_ingredients_count: 0,
      total_quantity_used: 0,
    };

    // Orders pagination count
    const countSql = `
      SELECT COUNT(DISTINCT oibc.order_id)::int as total
      FROM order_item_batch_consumptions oibc
      JOIN orders o ON o.id = oibc.order_id
      JOIN order_items oi ON oi.id = oibc.order_item_id
      JOIN ingredients i ON i.id = oibc.ingredient_id
      ${whereClause}
    `;
    const countRes = await query(countSql, params, { tenantId });
    const total = countRes.rows[0]?.total || 0;

    // Detailed order-wise aggregation
    const dataSql = `
      SELECT
        o.id as order_id,
        o.order_number,
        o.order_type,
        o.status as order_status,
        o.payment_status,
        o.grand_total,
        o.customer_name,
        o.customer_phone,
        o.created_at as order_created_at,
        b.id as branch_id,
        b.name as branch_name,
        COALESCE(SUM(oibc.total_cost), 0)::numeric as order_total_cogs,
        json_agg(
          json_build_object(
            'consumption_id', oibc.id,
            'order_item_id', oi.id,
            'product_name', oi.product_name,
            'product_quantity', oi.quantity,
            'ingredient_id', i.id,
            'ingredient_name', i.name,
            'ingredient_unit', COALESCE(i.base_unit, i.unit, 'UNIT'),
            'quantity_used', oibc.quantity::numeric,
            'unit_cost', oibc.unit_cost::numeric,
            'total_cost', oibc.total_cost::numeric,
            'batch_id', oibc.batch_id,
            'consumed_at', oibc.created_at
          ) ORDER BY oi.product_name ASC, i.name ASC
        ) as items_consumed
      FROM order_item_batch_consumptions oibc
      JOIN orders o ON o.id = oibc.order_id
      JOIN branches b ON b.id = oibc.branch_id
      JOIN order_items oi ON oi.id = oibc.order_item_id
      JOIN ingredients i ON i.id = oibc.ingredient_id
      ${whereClause}
      GROUP BY o.id, o.order_number, o.order_type, o.status, o.payment_status, o.grand_total, o.customer_name, o.customer_phone, o.created_at, b.id, b.name
      ORDER BY o.created_at DESC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `;

    const { rows: orderConsumptions } = await query(dataSql, [...params, limitNum, offset], { tenantId });

    return reply.send({
      orders: orderConsumptions,
      summary,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
      },
    });
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

  fastify.delete('/api/inventory/purchases/:id', {
    preHandler: [requirePermission(Permission.PURCHASES_MANAGE)],
  }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const tenantId = req.user!.tenantId!;

    const { rows } = await query('SELECT status FROM purchase_invoices WHERE id = $1 AND tenant_id = $2', [id, tenantId], { tenantId });
    if (rows.length === 0) return reply.status(404).send({ error: 'Purchase invoice not found' });
    if (rows[0].status === 'RECEIVED') {
      return reply.status(400).send({ error: 'Cannot delete received purchase invoice as stock is already posted to FIFO lots' });
    }

    await withTransaction(async (client) => {
      await client.query('DELETE FROM purchase_items WHERE purchase_id = $1 AND tenant_id = $2', [id, tenantId]);
      await client.query('DELETE FROM purchase_invoices WHERE id = $1 AND tenant_id = $2', [id, tenantId]);
    }, { tenantId });

    return reply.send({ message: 'Purchase invoice deleted successfully' });
  });

  /**
   * ==========================================
   * Inter-Branch Stock Transfers
   * ==========================================
   */
  fastify.get('/api/inventory/transfers', async (req, reply) => {
    const tenantId = req.user!.tenantId!;
    const { branchId, status } = req.query as { branchId?: string; status?: string };

    let sql = `
      SELECT st.*,
             fb.name as from_branch_name, fb.code as from_branch_code,
             tb.name as to_branch_name, tb.code as to_branch_code,
             COALESCE(i.name, p.name) as item_name,
             COALESCE(i.unit, 'pcs') as unit,
             u1.full_name as requested_by_name,
             u2.full_name as dispatched_by_name,
             u3.full_name as received_by_name
      FROM stock_transfers st
      JOIN branches fb ON fb.id = st.from_branch_id
      JOIN branches tb ON tb.id = st.to_branch_id
      LEFT JOIN ingredients i ON i.id = st.ingredient_id
      LEFT JOIN products p ON p.id = st.product_id
      LEFT JOIN users u1 ON u1.id = st.requested_by_id
      LEFT JOIN users u2 ON u2.id = st.dispatched_by_id
      LEFT JOIN users u3 ON u3.id = st.received_by_id
      WHERE st.tenant_id = $1
    `;
    const params: any[] = [tenantId];

    if (branchId) {
      params.push(branchId);
      sql += ` AND (st.from_branch_id = $${params.length} OR st.to_branch_id = $${params.length})`;
    }
    if (status) {
      params.push(status);
      sql += ` AND st.status = $${params.length}`;
    }

    sql += ` ORDER BY st.created_at DESC`;

    const { rows: transfers } = await query(sql, params, { tenantId });
    return reply.send({ transfers });
  });

  fastify.post('/api/inventory/transfers', {
    preHandler: [requirePermission(Permission.INVENTORY_MANAGE)],
  }, async (req, reply) => {
    const tenantId = req.user!.tenantId!;
    const { fromBranchId, toBranchId, ingredientId, productId, quantity, notes } = req.body as any;

    if (!fromBranchId || !toBranchId || (!ingredientId && !productId) || !quantity || Number(quantity) <= 0) {
      return reply.status(400).send({ error: 'fromBranchId, toBranchId, quantity, and an ingredient or product are required' });
    }

    if (fromBranchId === toBranchId) {
      return reply.status(400).send({ error: 'Origin and destination branches must be different' });
    }

    // Get unit cost from ingredient or product
    let unitCost = 0;
    if (ingredientId) {
      const { rows: ingRows } = await query('SELECT cost_per_unit FROM ingredients WHERE id = $1 AND tenant_id = $2', [ingredientId, tenantId], { tenantId });
      if (ingRows.length > 0) unitCost = Number(ingRows[0].cost_per_unit);
    } else if (productId) {
      const { rows: prodRows } = await query('SELECT cost_price, base_price FROM products WHERE id = $1 AND tenant_id = $2', [productId, tenantId], { tenantId });
      if (prodRows.length > 0) unitCost = Number(prodRows[0].cost_price || prodRows[0].base_price);
    }

    const transferNumber = `TR-${new Date().getFullYear()}-${Date.now().toString().slice(-5)}`;
    const totalCost = Number(quantity) * unitCost;

    const { rows } = await query(
      `
      INSERT INTO stock_transfers (
        tenant_id, transfer_number, from_branch_id, to_branch_id, ingredient_id, product_id,
        quantity, unit_cost, total_cost, status, notes, requested_by_id
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'PENDING', $10, $11)
      RETURNING *
      `,
      [tenantId, transferNumber, fromBranchId, toBranchId, ingredientId || null, productId || null, quantity, unitCost, totalCost, notes || null, req.user!.id],
      { tenantId }
    );

    return reply.status(201).send({ transfer: rows[0] });
  });

  fastify.put('/api/inventory/transfers/:id/dispatch', {
    preHandler: [requirePermission(Permission.INVENTORY_MANAGE)],
  }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const tenantId = req.user!.tenantId!;

    const result = await withTransaction(async (client) => {
      const { rows: trRows } = await client.query(
        'SELECT * FROM stock_transfers WHERE id = $1 AND tenant_id = $2 FOR UPDATE',
        [id, tenantId]
      );

      if (trRows.length === 0) throw new Error('Stock transfer not found');
      const tr = trRows[0];
      if (tr.status !== 'PENDING') throw new Error(`Cannot dispatch transfer in ${tr.status} status`);

      // Deduct stock from from_branch
      if (tr.ingredient_id) {
        const { rows: stRows } = await client.query(
          `SELECT current_stock, cost_per_unit FROM branch_stocks WHERE branch_id = $1 AND ingredient_id = $2 AND tenant_id = $3 FOR UPDATE`,
          [tr.from_branch_id, tr.ingredient_id, tenantId]
        );
        const fromBefore = stRows.length > 0 ? Number(stRows[0].current_stock) : 0;
        const fromAfter = Math.max(0, fromBefore - Number(tr.quantity));
        const unitCost = stRows.length > 0 ? Number(stRows[0].cost_per_unit) : Number(tr.unit_cost || 0);

        await client.query(
          `UPDATE branch_stocks 
           SET current_stock = $1, last_updated = CURRENT_TIMESTAMP
           WHERE branch_id = $2 AND ingredient_id = $3 AND tenant_id = $4`,
          [fromAfter, tr.from_branch_id, tr.ingredient_id, tenantId]
        );

        // Deduct from FIFO batches at from_branch
        let remDispatch = Number(tr.quantity);
        const { rows: bRows } = await client.query(
          `SELECT id, quantity_remaining FROM inventory_batches WHERE tenant_id = $1 AND branch_id = $2 AND ingredient_id = $3 AND status = 'ACTIVE' AND quantity_remaining > 0 ORDER BY received_at ASC FOR UPDATE`,
          [tenantId, tr.from_branch_id, tr.ingredient_id]
        );
        for (const b of bRows) {
          if (remDispatch <= 0) break;
          const avail = Number(b.quantity_remaining);
          const take = Math.min(avail, remDispatch);
          remDispatch -= take;
          await client.query(`UPDATE inventory_batches SET quantity_remaining = $1, status = $2 WHERE id = $3`, [avail - take, (avail - take) <= 0 ? 'EXHAUSTED' : 'ACTIVE', b.id]);
        }

        await client.query(
          `INSERT INTO stock_movements (
             tenant_id, branch_id, ingredient_id, movement_type, quantity, stock_before, stock_after, unit_cost, total_cost,
             reference_type, reference_id, reason, recorded_by_user_id
           )
           VALUES ($1, $2, $3, 'TRANSFER_OUT', $4, $5, $6, $7, $8, 'TRANSFER', $9, 'Inter-branch transfer dispatch', $10)`,
          [tenantId, tr.from_branch_id, tr.ingredient_id, -Number(tr.quantity), fromBefore, fromAfter, unitCost, Number(tr.quantity) * unitCost, tr.id, req.user!.id]
        );
      }

      const { rows: updated } = await client.query(
        `UPDATE stock_transfers 
         SET status = 'DISPATCHED', dispatched_at = CURRENT_TIMESTAMP, dispatched_by_id = $1, updated_at = CURRENT_TIMESTAMP
         WHERE id = $2 RETURNING *`,
        [req.user!.id, id]
      );

      return updated[0];
    }, { tenantId });

    return reply.send({ transfer: result, message: 'Stock transfer dispatched successfully' });
  });

  fastify.put('/api/inventory/transfers/:id/receive', {
    preHandler: [requirePermission(Permission.INVENTORY_MANAGE)],
  }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const tenantId = req.user!.tenantId!;

    const result = await withTransaction(async (client) => {
      const { rows: trRows } = await client.query(
        'SELECT * FROM stock_transfers WHERE id = $1 AND tenant_id = $2 FOR UPDATE',
        [id, tenantId]
      );

      if (trRows.length === 0) throw new Error('Stock transfer not found');
      const tr = trRows[0];
      if (tr.status !== 'DISPATCHED') throw new Error(`Cannot receive transfer in ${tr.status} status. It must be dispatched first.`);

      // Add stock to to_branch and create FIFO batch
      if (tr.ingredient_id) {
        const { rows: toStRows } = await client.query(
          `SELECT current_stock, cost_per_unit FROM branch_stocks WHERE branch_id = $1 AND ingredient_id = $2 AND tenant_id = $3 FOR UPDATE`,
          [tr.to_branch_id, tr.ingredient_id, tenantId]
        );
        const toBefore = toStRows.length > 0 ? Number(toStRows[0].current_stock) : 0;
        const toAfter = toBefore + Number(tr.quantity);
        const unitCost = Number(tr.unit_cost || 0);

        await client.query(
          `INSERT INTO branch_stocks (tenant_id, branch_id, ingredient_id, current_stock, cost_per_unit)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (branch_id, ingredient_id) DO UPDATE SET
             current_stock = $4,
             cost_per_unit = $5,
             last_updated = CURRENT_TIMESTAMP`,
          [tenantId, tr.to_branch_id, tr.ingredient_id, toAfter, unitCost]
        );

        // FIFO stock lot
        await client.query(
          `INSERT INTO inventory_batches (
             tenant_id, branch_id, ingredient_id, quantity_received, quantity_remaining, unit_cost, received_at, status
           )
           VALUES ($1, $2, $3, $4, $4, $5, CURRENT_TIMESTAMP, 'ACTIVE')`,
          [tenantId, tr.to_branch_id, tr.ingredient_id, tr.quantity, unitCost]
        );

        await client.query(
          `INSERT INTO stock_movements (
             tenant_id, branch_id, ingredient_id, movement_type, quantity, stock_before, stock_after, unit_cost, total_cost,
             reference_type, reference_id, reason, recorded_by_user_id
           )
           VALUES ($1, $2, $3, 'TRANSFER_IN', $4, $5, $6, $7, $8, 'TRANSFER', $9, 'Inter-branch transfer received into FIFO batch', $10)`,
          [tenantId, tr.to_branch_id, tr.ingredient_id, Number(tr.quantity), toBefore, toAfter, unitCost, Number(tr.quantity) * unitCost, tr.id, req.user!.id]
        );
      }

      const { rows: updated } = await client.query(
        `UPDATE stock_transfers 
         SET status = 'RECEIVED', received_at = CURRENT_TIMESTAMP, received_by_id = $1, updated_at = CURRENT_TIMESTAMP
         WHERE id = $2 RETURNING *`,
        [req.user!.id, id]
      );

      return updated[0];
    }, { tenantId });

    return reply.send({ transfer: result, message: 'Stock received into destination branch inventory batch' });
  });
}
