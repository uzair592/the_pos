import { FastifyInstance } from 'fastify';
import { query, withTransaction } from '../db/connection.js';
import { authenticate, requireTenant, requirePermission } from '../middleware/auth.js';
import {
  CreateCategorySchema,
  CreateModifierGroupSchema,
  CreateProductSchema,
  Permission,
} from '@pos/shared';

export async function menuRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', authenticate);
  fastify.addHook('preHandler', requireTenant);

  /**
   * Categories
   */
  fastify.get('/api/menu/categories', async (req, reply) => {
    const tenantId = req.user!.tenantId!;
    const { rows } = await query(
      `
      SELECT c.*,
             (SELECT COUNT(*)::int FROM products WHERE category_id = c.id AND is_available = true) as product_count,
             p.name as parent_name
      FROM categories c
      LEFT JOIN categories p ON p.id = c.parent_id
      WHERE c.tenant_id = $1
      ORDER BY c.sort_order ASC, c.name ASC
      `,
      [tenantId],
      { tenantId }
    );
    return reply.send({ categories: rows });
  });

  fastify.post('/api/menu/categories', {
    preHandler: [requirePermission(Permission.MENU_MANAGE)],
  }, async (req, reply) => {
    const parsed = CreateCategorySchema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.format() });

    const tenantId = req.user!.tenantId!;
    const { parentId, name, nameUrdu, description, sortOrder, imageUrl } = parsed.data;

    const { rows } = await query(
      `
      INSERT INTO categories (tenant_id, parent_id, name, name_urdu, description, sort_order, image_url, is_active)
      VALUES ($1, $2, $3, $4, $5, $6, $7, true)
      RETURNING *
      `,
      [tenantId, parentId || null, name, nameUrdu || null, description || null, sortOrder, imageUrl || null],
      { tenantId }
    );
    return reply.status(201).send({ category: rows[0] });
  });

  fastify.put('/api/menu/categories/:id', {
    preHandler: [requirePermission(Permission.MENU_MANAGE)],
  }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const tenantId = req.user!.tenantId!;
    const body = req.body as any;

    const { rows } = await query(
      `
      UPDATE categories
      SET name = COALESCE($1, name),
          name_urdu = COALESCE($2, name_urdu),
          description = COALESCE($3, description),
          sort_order = COALESCE($4, sort_order),
          image_url = COALESCE($5, image_url),
          is_active = COALESCE($6, is_active),
          parent_id = CASE WHEN $7::boolean = true THEN $8::uuid ELSE parent_id END,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $9 AND tenant_id = $10
      RETURNING *
      `,
      [
        body.name, body.nameUrdu, body.description, body.sortOrder, body.imageUrl, body.isActive,
        body.parentId !== undefined, body.parentId || null,
        id, tenantId
      ],
      { tenantId }
    );

    if (rows.length === 0) return reply.status(404).send({ error: 'Category not found' });
    return reply.send({ category: rows[0] });
  });

  fastify.delete('/api/menu/categories/:id', {
    preHandler: [requirePermission(Permission.MENU_MANAGE)],
  }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const tenantId = req.user!.tenantId!;

    // Check if category has products
    const { rows: prodRows } = await query(
      'SELECT id FROM products WHERE category_id = $1 AND tenant_id = $2 LIMIT 1',
      [id, tenantId],
      { tenantId }
    );

    if (prodRows.length > 0) {
      return reply.status(400).send({
        error: 'Cannot delete category that contains products. Reassign or delete the products first.',
      });
    }

    await query('DELETE FROM categories WHERE id = $1 AND tenant_id = $2', [id, tenantId], { tenantId });
    return reply.send({ message: 'Category deleted successfully' });
  });

  /**
   * Modifier Groups
   */
  fastify.get('/api/menu/modifiers', async (req, reply) => {
    const tenantId = req.user!.tenantId!;
    const { rows } = await query(
      'SELECT * FROM modifier_groups WHERE tenant_id = $1 ORDER BY name ASC',
      [tenantId],
      { tenantId }
    );
    return reply.send({ modifierGroups: rows });
  });

  fastify.post('/api/menu/modifiers', {
    preHandler: [requirePermission(Permission.MENU_MANAGE)],
  }, async (req, reply) => {
    const parsed = CreateModifierGroupSchema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.format() });

    const tenantId = req.user!.tenantId!;
    const { name, nameUrdu, minSelect, maxSelect, isRequired, options } = parsed.data;

    // Attach IDs to options
    const optionsWithIds = options.map((opt, idx) => ({
      id: crypto.randomUUID(),
      name: opt.name,
      nameUrdu: opt.nameUrdu,
      price: opt.price,
      isDefault: opt.isDefault,
      isActive: true,
    }));

    const { rows } = await query(
      `
      INSERT INTO modifier_groups (tenant_id, name, name_urdu, min_select, max_select, is_required, options)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
      `,
      [tenantId, name, nameUrdu || null, minSelect, maxSelect, isRequired, JSON.stringify(optionsWithIds)],
      { tenantId }
    );

    return reply.status(201).send({ modifierGroup: rows[0] });
  });

  fastify.put('/api/menu/modifiers/:id', {
    preHandler: [requirePermission(Permission.MENU_MANAGE)],
  }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const tenantId = req.user!.tenantId!;
    const body = req.body as any;

    let optionsJson: string | null = null;
    if (body.options && Array.isArray(body.options)) {
      const optionsWithIds = body.options.map((opt: any) => ({
        id: opt.id || crypto.randomUUID(),
        name: opt.name,
        nameUrdu: opt.nameUrdu || null,
        price: Number(opt.price) || 0,
        isDefault: Boolean(opt.isDefault),
        isActive: opt.isActive !== false,
      }));
      optionsJson = JSON.stringify(optionsWithIds);
    }

    const { rows } = await query(
      `
      UPDATE modifier_groups
      SET name = COALESCE($1, name),
          name_urdu = COALESCE($2, name_urdu),
          min_select = COALESCE($3, min_select),
          max_select = COALESCE($4, max_select),
          is_required = COALESCE($5, is_required),
          options = COALESCE($6::jsonb, options)
      WHERE id = $7 AND tenant_id = $8
      RETURNING *
      `,
      [
        body.name, body.nameUrdu, body.minSelect, body.maxSelect, body.isRequired,
        optionsJson, id, tenantId
      ],
      { tenantId }
    );

    if (rows.length === 0) return reply.status(404).send({ error: 'Modifier group not found' });
    return reply.send({ modifierGroup: rows[0] });
  });

  fastify.delete('/api/menu/modifiers/:id', {
    preHandler: [requirePermission(Permission.MENU_MANAGE)],
  }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const tenantId = req.user!.tenantId!;

    await query('DELETE FROM modifier_groups WHERE id = $1 AND tenant_id = $2', [id, tenantId], { tenantId });
    return reply.send({ message: 'Modifier group deleted successfully' });
  });

  /**
   * Products Management
   */
  fastify.get('/api/menu/products', async (req, reply) => {
    const tenantId = req.user!.tenantId!;
    const { categoryId, station, search } = req.query as {
      categoryId?: string;
      station?: string;
      search?: string;
    };

    let sql = `
      SELECT p.*, c.name as category_name
      FROM products p
      JOIN categories c ON c.id = p.category_id
      WHERE p.tenant_id = $1
    `;
    const params: any[] = [tenantId];

    if (categoryId) {
      params.push(categoryId);
      sql += ` AND p.category_id = $${params.length}`;
    }
    if (station) {
      params.push(station);
      sql += ` AND p.station = $${params.length}`;
    }
    if (search) {
      params.push(`%${search}%`);
      sql += ` AND (p.name ILIKE $${params.length} OR p.sku ILIKE $${params.length} OR p.barcode = $${params.length})`;
    }

    sql += ' ORDER BY p.name ASC';

    const { rows: products } = await query(sql, params, { tenantId });

    // Attach variants and modifier groups to each product
    for (const p of products) {
      const { rows: variants } = await query(
        'SELECT * FROM product_variants WHERE product_id = $1 AND tenant_id = $2 AND is_active = true ORDER BY price ASC',
        [p.id, tenantId],
        { tenantId }
      );
      p.variants = variants;

      const { rows: modGroups } = await query(
        `
        SELECT mg.*
        FROM product_modifier_groups pmg
        JOIN modifier_groups mg ON mg.id = pmg.modifier_group_id
        WHERE pmg.product_id = $1 AND pmg.tenant_id = $2
        `,
        [p.id, tenantId],
        { tenantId }
      );
      p.modifierGroups = modGroups;
    }

    return reply.send({ products });
  });

  fastify.post('/api/menu/products', {
    preHandler: [requirePermission(Permission.MENU_MANAGE)],
  }, async (req, reply) => {
    const parsed = CreateProductSchema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.format() });

    const tenantId = req.user!.tenantId!;
    const {
      categoryId,
      name,
      nameUrdu,
      description,
      sku,
      barcode,
      basePrice,
      costPrice,
      station,
      imageUrl,
      isAvailable,
      trackInventory,
      dineInPrice,
      takeawayPrice,
      deliveryPrice,
      variants,
      modifierGroupIds,
    } = parsed.data;

    // Check SKU unique in tenant
    const existingSku = await query(
      'SELECT id FROM products WHERE tenant_id = $1 AND sku = $2',
      [tenantId, sku],
      { tenantId }
    );
    if (existingSku.rows.length > 0) {
      return reply.status(400).send({ error: 'A product with this SKU already exists' });
    }

    const createdProduct = await withTransaction(async (client) => {
      // 1. Insert product
      const prodRes = await client.query(
        `
        INSERT INTO products (
          tenant_id, category_id, name, name_urdu, description, sku, barcode,
          base_price, cost_price, station, image_url, is_available, track_inventory,
          dine_in_price, takeaway_price, delivery_price
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7,
          $8, $9, $10, $11, $12, $13,
          $14, $15, $16
        ) RETURNING *
        `,
        [
          tenantId, categoryId, name, nameUrdu || null, description || null, sku, barcode || null,
          basePrice, costPrice, station, imageUrl || null, isAvailable, trackInventory,
          dineInPrice || null, takeawayPrice || null, deliveryPrice || null,
        ]
      );
      const product = prodRes.rows[0];

      // 2. Insert variants if any
      const createdVariants: any[] = [];
      if (variants && variants.length > 0) {
        for (const v of variants) {
          const varRes = await client.query(
            `
            INSERT INTO product_variants (
              tenant_id, product_id, name, name_urdu, sku, price, cost_price, is_default, is_active
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true)
            RETURNING *
            `,
            [tenantId, product.id, v.name, v.nameUrdu || null, v.sku || null, v.price, v.costPrice || 0, v.isDefault]
          );
          createdVariants.push(varRes.rows[0]);
        }
      }
      product.variants = createdVariants;

      // 3. Link modifier groups
      if (modifierGroupIds && modifierGroupIds.length > 0) {
        for (const mgId of modifierGroupIds) {
          await client.query(
            'INSERT INTO product_modifier_groups (tenant_id, product_id, modifier_group_id) VALUES ($1, $2, $3)',
            [tenantId, product.id, mgId]
          );
        }
      }

      return product;
    }, { tenantId });

    return reply.status(201).send({ product: createdProduct });
  });

  fastify.put('/api/menu/products/:id', {
    preHandler: [requirePermission(Permission.MENU_MANAGE)],
  }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const tenantId = req.user!.tenantId!;
    const body = req.body as any;

    const { rows } = await query(
      `
      UPDATE products
      SET name = COALESCE($1, name),
          name_urdu = COALESCE($2, name_urdu),
          description = COALESCE($3, description),
          base_price = COALESCE($4, base_price),
          cost_price = COALESCE($5, cost_price),
          station = COALESCE($6, station),
          is_available = COALESCE($7, is_available),
          track_inventory = COALESCE($8, track_inventory),
          dine_in_price = COALESCE($9, dine_in_price),
          takeaway_price = COALESCE($10, takeaway_price),
          delivery_price = COALESCE($11, delivery_price),
          category_id = COALESCE($12, category_id),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $13 AND tenant_id = $14
      RETURNING *
      `,
      [
        body.name, body.nameUrdu, body.description, body.basePrice, body.costPrice,
        body.station, body.isAvailable, body.trackInventory,
        body.dineInPrice, body.takeawayPrice, body.deliveryPrice,
        body.categoryId || null,
        id, tenantId,
      ],
      { tenantId }
    );

    if (rows.length === 0) return reply.status(404).send({ error: 'Product not found' });

    if (Array.isArray(body.modifierGroupIds)) {
      await query('DELETE FROM product_modifier_groups WHERE product_id = $1 AND tenant_id = $2', [id, tenantId], { tenantId });
      for (const mgId of body.modifierGroupIds) {
        await query(
          'INSERT INTO product_modifier_groups (tenant_id, product_id, modifier_group_id) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
          [tenantId, id, mgId],
          { tenantId }
        );
      }
    }

    return reply.send({ product: rows[0] });
  });

  fastify.delete('/api/menu/products/:id', {
    preHandler: [requirePermission(Permission.MENU_MANAGE)],
  }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const tenantId = req.user!.tenantId!;

    // Check if product has completed order records
    const { rows: orderRows } = await query(
      'SELECT id FROM order_items WHERE product_id = $1 AND tenant_id = $2 LIMIT 1',
      [id, tenantId],
      { tenantId }
    );

    if (orderRows.length > 0) {
      // Soft disable availability rather than deleting historical sales order references
      await query(
        'UPDATE products SET is_available = false WHERE id = $1 AND tenant_id = $2',
        [id, tenantId],
        { tenantId }
      );
      return reply.send({ message: 'Product has order history; archived as unavailable.' });
    }

    await query('DELETE FROM products WHERE id = $1 AND tenant_id = $2', [id, tenantId], { tenantId });
    return reply.send({ message: 'Product deleted successfully' });
  });
}
