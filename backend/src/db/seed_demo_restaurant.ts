import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import { query } from './connection.js';
import { SystemRole } from '@pos/shared';

dotenv.config();

export async function seedDemoRestaurant() {
  console.log('Seeding demo restaurant and updating credentials...');

  // 1. Super Admin: update or create with SuperAdmin123!
  const superAdminEmail = 'admin@posplatform.com';
  const superAdminPassword = 'SuperAdmin123!';
  const superAdminHash = await bcrypt.hash(superAdminPassword, 10);

  const { rows: existingAdmins } = await query(
    'SELECT id FROM platform_admins WHERE email = $1',
    [superAdminEmail],
    { isSuperAdmin: true }
  );

  if (existingAdmins.length === 0) {
    await query(
      `
      INSERT INTO platform_admins (email, password_hash, full_name, is_active)
      VALUES ($1, $2, $3, true)
      `,
      [superAdminEmail, superAdminHash, 'Platform Administrator'],
      { isSuperAdmin: true }
    );
    console.log(`Created Super Admin: ${superAdminEmail}`);
  } else {
    await query(
      `
      UPDATE platform_admins
      SET password_hash = $1, is_active = true, updated_at = CURRENT_TIMESTAMP
      WHERE email = $2
      `,
      [superAdminHash, superAdminEmail],
      { isSuperAdmin: true }
    );
    console.log(`Updated Super Admin password to SuperAdmin123! for ${superAdminEmail}`);
  }

  // 2. Fetch Growth or Enterprise Plan
  const { rows: plans } = await query(
    "SELECT id FROM subscription_plans WHERE code = 'GROWTH' OR code = 'ENTERPRISE' ORDER BY code DESC LIMIT 1",
    [],
    { isSuperAdmin: true }
  );

  if (plans.length === 0) {
    throw new Error('No subscription plans found. Please run seedDatabase first.');
  }
  const planId = plans[0].id;

  // 3. Create or Get Restaurant Tenant
  const tenantEmail = 'owner@lahorekarahi.com';
  const defaultPassword = 'Password123!';
  const userPasswordHash = await bcrypt.hash(defaultPassword, 10);

  let tenantId: string;
  const { rows: existingTenants } = await query(
    'SELECT id FROM tenants WHERE email = $1',
    [tenantEmail],
    { isSuperAdmin: true }
  );

  if (existingTenants.length === 0) {
    const { rows: newTenant } = await query(
      `
      INSERT INTO tenants (
        name, legal_name, subdomain, owner_name, email, phone,
        address, city, country, currency, time_zone, business_type,
        is_active, is_onboarded
      )
      VALUES (
        'Lahore Karahi & Grill', 'Lahore Karahi Pvt Ltd', 'lahore-karahi', 'Tariq Mahmood',
        $1, '+92 300 1234567', 'Main Boulevard, Gulberg III', 'Lahore', 'Pakistan',
        'PKR', 'Asia/Karachi', 'FINE_DINE', true, true
      )
      RETURNING id
      `,
      [tenantEmail],
      { isSuperAdmin: true }
    );
    tenantId = newTenant[0].id;
    console.log(`Created Tenant: Lahore Karahi & Grill (${tenantId})`);

    // Create Subscription
    const oneYearFromNow = new Date(Date.now() + 365 * 24 * 3600 * 1000);
    await query(
      `
      INSERT INTO tenant_subscriptions (
        tenant_id, plan_id, status, current_period_start, current_period_end
      )
      VALUES ($1, $2, 'ACTIVE', CURRENT_TIMESTAMP, $3)
      `,
      [tenantId, planId, oneYearFromNow],
      { isSuperAdmin: true }
    );
  } else {
    tenantId = existingTenants[0].id;
    await query(
      'UPDATE tenants SET is_active = true, is_onboarded = true WHERE id = $1',
      [tenantId],
      { isSuperAdmin: true }
    );
    console.log(`Using existing Tenant: ${tenantId}`);
  }

  // 4. Create or Update Branch
  let branchId: string;
  const { rows: existingBranches } = await query(
    'SELECT id FROM branches WHERE tenant_id = $1 AND code = $2',
    [tenantId, 'LHE-01'],
    { isSuperAdmin: true }
  );

  if (existingBranches.length === 0) {
    const { rows: newBranch } = await query(
      `
      INSERT INTO branches (
        tenant_id, name, code, phone, email, address, city, state, is_main_branch, is_active
      )
      VALUES (
        $1, 'Gulberg Main Branch', 'LHE-01', '+92 42 35789000', 'gulberg@lahorekarahi.com',
        'Main Boulevard, Gulberg III', 'Lahore', 'Punjab', true, true
      )
      RETURNING id
      `,
      [tenantId],
      { isSuperAdmin: true }
    );
    branchId = newBranch[0].id;
    console.log(`Created Branch: Gulberg Main Branch (${branchId})`);
  } else {
    branchId = existingBranches[0].id;
  }

  // 5. Create or Update Restaurant Settings
  await query(
    `
    INSERT INTO restaurant_settings (
      tenant_id, currency, currency_symbol, time_zone, tax_rate_percent,
      is_tax_inclusive, service_charge_percent, stock_deduction_trigger,
      allow_negative_inventory, order_number_prefix, kot_number_prefix
    )
    VALUES ($1, 'PKR', 'Rs.', 'Asia/Karachi', 16.00, false, 5.00, 'ON_ORDER_COMPLETED', false, 'ORD-', 'KOT-')
    ON CONFLICT (tenant_id) DO UPDATE SET
      tax_rate_percent = 16.00,
      service_charge_percent = 5.00,
      updated_at = CURRENT_TIMESTAMP
    `,
    [tenantId],
    { isSuperAdmin: true }
  );

  // 6. Users (Staff & Admins)
  const usersToSeed = [
    { email: 'owner@lahorekarahi.com', fullName: 'Tariq Mahmood (Owner)', role: SystemRole.RESTAURANT_OWNER },
    { email: 'manager@lahorekarahi.com', fullName: 'Hamza Ali (Manager)', role: SystemRole.BRANCH_MANAGER },
    { email: 'cashier@lahorekarahi.com', fullName: 'Bilal Ahmed (Cashier)', role: SystemRole.CASHIER },
    { email: 'waiter@lahorekarahi.com', fullName: 'Usman Shah (Waiter)', role: SystemRole.WAITER },
    { email: 'kitchen@lahorekarahi.com', fullName: 'Chef Rasheed (Kitchen)', role: SystemRole.KITCHEN_STAFF },
  ];

  for (const u of usersToSeed) {
    const { rows: existingUser } = await query(
      'SELECT id FROM users WHERE tenant_id = $1 AND email = $2',
      [tenantId, u.email],
      { isSuperAdmin: true }
    );

    if (existingUser.length === 0) {
      await query(
        `
        INSERT INTO users (
          tenant_id, branch_id, email, password_hash, full_name, role, is_active, token_version
        )
        VALUES ($1, $2, $3, $4, $5, $6, true, 1)
        `,
        [tenantId, branchId, u.email, userPasswordHash, u.fullName, u.role],
        { isSuperAdmin: true }
      );
      console.log(`Created User: ${u.email} (${u.role})`);
    } else {
      await query(
        `
        UPDATE users
        SET password_hash = $1, is_active = true, branch_id = $2, role = $3, token_version = 1
        WHERE id = $4
        `,
        [userPasswordHash, branchId, u.role, existingUser[0].id],
        { isSuperAdmin: true }
      );
      console.log(`Updated User password to Password123! for ${u.email}`);
    }
  }

  // 7. Floor & Dining Tables
  let floorId: string;
  const { rows: existingFloors } = await query(
    'SELECT id FROM floors WHERE tenant_id = $1 AND branch_id = $2',
    [tenantId, branchId],
    { isSuperAdmin: true }
  );

  if (existingFloors.length === 0) {
    const { rows: newFloor } = await query(
      `
      INSERT INTO floors (tenant_id, branch_id, name, sort_order, is_active)
      VALUES ($1, $2, 'Main Dining Hall', 1, true)
      RETURNING id
      `,
      [tenantId, branchId],
      { isSuperAdmin: true }
    );
    floorId = newFloor[0].id;
  } else {
    floorId = existingFloors[0].id;
  }

  const tables = [
    { number: 'T-01', capacity: 4 },
    { number: 'T-02', capacity: 2 },
    { number: 'T-03', capacity: 6 },
    { number: 'T-04', capacity: 4 },
    { number: 'T-05', capacity: 8 },
    { number: 'T-06', capacity: 4 },
  ];

  for (const t of tables) {
    await query(
      `
      INSERT INTO restaurant_tables (tenant_id, branch_id, floor_id, table_number, capacity, status, is_active)
      VALUES ($1, $2, $3, $4, $5, 'AVAILABLE', true)
      ON CONFLICT (branch_id, table_number) DO UPDATE SET is_active = true
      `,
      [tenantId, branchId, floorId, t.number, t.capacity],
      { isSuperAdmin: true }
    );
  }
  console.log(`Seeded ${tables.length} dining tables.`);

  // 8. Categories & Sub-Categories
  const mainCategories = [
    { name: 'Karahi & Handi', nameUrdu: 'کڑاہی اور ہانڈی', sortOrder: 1 },
    { name: 'BBQ & Grills', nameUrdu: 'باربی کیو', sortOrder: 2 },
    { name: 'Fast Food & Burgers', nameUrdu: 'فاسٹ فوڈ اور برگرز', sortOrder: 3 },
    { name: 'Naan & Breads', nameUrdu: 'نان اور روٹی', sortOrder: 4 },
    { name: 'Beverages & Drinks', nameUrdu: 'مشروبات', sortOrder: 5 },
  ];

  const catMap = new Map<string, string>();
  for (const cat of mainCategories) {
    const { rows: existingCat } = await query(
      'SELECT id FROM categories WHERE tenant_id = $1 AND name = $2',
      [tenantId, cat.name],
      { isSuperAdmin: true }
    );
    if (existingCat.length === 0) {
      const { rows: newCat } = await query(
        `
        INSERT INTO categories (tenant_id, name, name_urdu, sort_order, is_active)
        VALUES ($1, $2, $3, $4, true)
        RETURNING id
        `,
        [tenantId, cat.name, cat.nameUrdu, cat.sortOrder],
        { isSuperAdmin: true }
      );
      catMap.set(cat.name, newCat[0].id);
    } else {
      catMap.set(cat.name, existingCat[0].id);
    }
  }

  // Seed Sub-Categories
  const subCategories = [
    { name: 'Chicken Karahi Specialties', nameUrdu: 'چکن کڑاہی', parent: 'Karahi & Handi', sortOrder: 1 },
    { name: 'Mutton & Beef Handi', nameUrdu: 'مٹن ہانڈی', parent: 'Karahi & Handi', sortOrder: 2 },
    { name: 'Tikka & Boti', nameUrdu: 'ٹکہ بوٹی', parent: 'BBQ & Grills', sortOrder: 1 },
    { name: 'Seekh Kebabs', nameUrdu: 'سیخ کباب', parent: 'BBQ & Grills', sortOrder: 2 },
    { name: 'Smash Burgers', nameUrdu: 'سمیش برگرز', parent: 'Fast Food & Burgers', sortOrder: 1 },
    { name: 'Wraps & Shawarma', nameUrdu: 'ریپس اور شوارما', parent: 'Fast Food & Burgers', sortOrder: 2 },
  ];

  for (const sub of subCategories) {
    const parentId = catMap.get(sub.parent);
    const { rows: existingSub } = await query(
      'SELECT id FROM categories WHERE tenant_id = $1 AND name = $2',
      [tenantId, sub.name],
      { isSuperAdmin: true }
    );
    if (existingSub.length === 0) {
      const { rows: newSub } = await query(
        `
        INSERT INTO categories (tenant_id, parent_id, name, name_urdu, sort_order, is_active)
        VALUES ($1, $2, $3, $4, $5, true)
        RETURNING id
        `,
        [tenantId, parentId, sub.name, sub.nameUrdu, sub.sortOrder],
        { isSuperAdmin: true }
      );
      catMap.set(sub.name, newSub[0].id);
    } else {
      catMap.set(sub.name, existingSub[0].id);
    }
  }

  // 9. Ingredients and FIFO Batches
  const ingredients = [
    { name: 'Chicken Meat', sku: 'ING-CHICKEN', unit: 'kg', costPrice: 650, currentStock: 50 },
    { name: 'Cooking Oil', sku: 'ING-OIL', unit: 'liter', costPrice: 480, currentStock: 40 },
    { name: 'Special Karahi Masala', sku: 'ING-MASALA', unit: 'kg', costPrice: 1200, currentStock: 15 },
    { name: 'Fine Flour (Maida)', sku: 'ING-FLOUR', unit: 'kg', costPrice: 140, currentStock: 80 },
  ];

  const ingMap = new Map<string, string>();
  for (const ing of ingredients) {
    let ingId: string;
    const { rows: existingIng } = await query(
      'SELECT id FROM ingredients WHERE tenant_id = $1 AND sku = $2',
      [tenantId, ing.sku],
      { isSuperAdmin: true }
    );

    if (existingIng.length === 0) {
      const { rows: newIng } = await query(
        `
        INSERT INTO ingredients (
          tenant_id, name, sku, unit, cost_per_unit, min_stock_alert, is_active
        )
        VALUES ($1, $2, $3, $4, $5, 5, true)
        RETURNING id
        `,
        [tenantId, ing.name, ing.sku, ing.unit, ing.costPrice],
        { isSuperAdmin: true }
      );
      ingId = newIng[0].id;
    } else {
      ingId = existingIng[0].id;
    }
    ingMap.set(ing.name, ingId);

    // Branch stock
    await query(
      `
      INSERT INTO branch_stocks (tenant_id, branch_id, ingredient_id, current_stock, cost_per_unit)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (branch_id, ingredient_id) DO UPDATE SET
        current_stock = EXCLUDED.current_stock,
        cost_per_unit = EXCLUDED.cost_per_unit,
        last_updated = CURRENT_TIMESTAMP
      `,
      [tenantId, branchId, ingId, ing.currentStock, ing.costPrice],
      { isSuperAdmin: true }
    );

    // Insert active FIFO Batches
    const { rows: existingBatches } = await query(
      'SELECT id FROM inventory_batches WHERE tenant_id = $1 AND ingredient_id = $2 AND status = $3',
      [tenantId, ingId, 'ACTIVE'],
      { isSuperAdmin: true }
    );

    if (existingBatches.length === 0) {
      const halfQty = ing.currentStock / 2;
      const olderDate = new Date(Date.now() - 3 * 24 * 3600 * 1000);
      const newerDate = new Date(Date.now() - 1 * 24 * 3600 * 1000);

      // Batch 1 (older, unit cost slightly lower)
      await query(
        `
        INSERT INTO inventory_batches (
          tenant_id, branch_id, ingredient_id, quantity_received, quantity_remaining, unit_cost, received_at, status
        )
        VALUES ($1, $2, $3, $4, $4, $5, $6, 'ACTIVE')
        `,
        [tenantId, branchId, ingId, halfQty, Math.round(ing.costPrice * 0.95), olderDate],
        { isSuperAdmin: true }
      );

      // Batch 2 (newer, unit cost regular)
      await query(
        `
        INSERT INTO inventory_batches (
          tenant_id, branch_id, ingredient_id, quantity_received, quantity_remaining, unit_cost, received_at, status
        )
        VALUES ($1, $2, $3, $4, $4, $5, $6, 'ACTIVE')
        `,
        [tenantId, branchId, ingId, halfQty, ing.costPrice, newerDate],
        { isSuperAdmin: true }
      );
    }
  }
  console.log(`Seeded ingredients, branch stocks, and active FIFO batches.`);

  // 10. Products
  const products = [
    {
      name: 'Chicken Karahi (Full)',
      catName: 'Karahi & Handi',
      basePrice: 2400,
      costPrice: 950,
      station: 'KITCHEN',
      sku: 'CK-FULL',
      recipe: [
        { ing: 'Chicken Meat', qty: 1.0, unit: 'kg' },
        { ing: 'Cooking Oil', qty: 0.15, unit: 'liter' },
        { ing: 'Special Karahi Masala', qty: 0.05, unit: 'kg' },
      ],
    },
    {
      name: 'Chicken Karahi (Half)',
      catName: 'Karahi & Handi',
      basePrice: 1350,
      costPrice: 520,
      station: 'KITCHEN',
      sku: 'CK-HALF',
      recipe: [
        { ing: 'Chicken Meat', qty: 0.5, unit: 'kg' },
        { ing: 'Cooking Oil', qty: 0.08, unit: 'liter' },
        { ing: 'Special Karahi Masala', qty: 0.03, unit: 'kg' },
      ],
    },
    {
      name: 'Chicken Malai Boti',
      catName: 'BBQ & Grills',
      basePrice: 950,
      costPrice: 420,
      station: 'GRILL',
      sku: 'BBQ-MALAI',
      recipe: [
        { ing: 'Chicken Meat', qty: 0.4, unit: 'kg' },
        { ing: 'Cooking Oil', qty: 0.05, unit: 'liter' },
      ],
    },
    {
      name: 'Seekh Kebab (4 Pcs)',
      catName: 'BBQ & Grills',
      basePrice: 850,
      costPrice: 380,
      station: 'GRILL',
      sku: 'BBQ-SEEKH',
      recipe: [],
    },
    {
      name: 'Roghani Naan',
      catName: 'Naan & Breads',
      basePrice: 120,
      costPrice: 35,
      station: 'KITCHEN',
      sku: 'NAN-ROGH',
      recipe: [{ ing: 'Fine Flour (Maida)', qty: 0.15, unit: 'kg' }],
    },
    {
      name: 'Garlic Naan',
      catName: 'Naan & Breads',
      basePrice: 150,
      costPrice: 45,
      station: 'KITCHEN',
      sku: 'NAN-GARLIC',
      recipe: [{ ing: 'Fine Flour (Maida)', qty: 0.15, unit: 'kg' }],
    },
    {
      name: 'Fresh Mint Margarita',
      catName: 'Beverages & Drinks',
      basePrice: 350,
      costPrice: 80,
      station: 'BAR',
      sku: 'BEV-MINT',
      recipe: [],
    },
    {
      name: 'Mineral Water (1.5L)',
      catName: 'Beverages & Drinks',
      basePrice: 150,
      costPrice: 70,
      station: 'BAR',
      sku: 'BEV-WATER',
      recipe: [],
    },
  ];

  for (const p of products) {
    const catId = catMap.get(p.catName);
    let prodId: string;

    const { rows: existingProd } = await query(
      'SELECT id FROM products WHERE tenant_id = $1 AND sku = $2',
      [tenantId, p.sku],
      { isSuperAdmin: true }
    );

    if (existingProd.length === 0) {
      const { rows: newProd } = await query(
        `
        INSERT INTO products (
          tenant_id, category_id, name, sku, base_price, cost_price, station, is_available, track_inventory
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, true, true)
        RETURNING id
        `,
        [tenantId, catId, p.name, p.sku, p.basePrice, p.costPrice, p.station],
        { isSuperAdmin: true }
      );
      prodId = newProd[0].id;
    } else {
      prodId = existingProd[0].id;
    }

    // Insert recipes
    if (p.recipe.length > 0) {
      let recipeId: string;
      const { rows: existingRecipe } = await query(
        'SELECT id FROM recipes WHERE tenant_id = $1 AND product_id = $2',
        [tenantId, prodId],
        { isSuperAdmin: true }
      );

      if (existingRecipe.length === 0) {
        const { rows: newRec } = await query(
          `
          INSERT INTO recipes (tenant_id, product_id, yield_count, total_cost)
          VALUES ($1, $2, 1.0, $3)
          RETURNING id
          `,
          [tenantId, prodId, p.costPrice],
          { isSuperAdmin: true }
        );
        recipeId = newRec[0].id;
      } else {
        recipeId = existingRecipe[0].id;
      }

      for (const r of p.recipe) {
        const ingId = ingMap.get(r.ing);
        if (ingId) {
          const { rows: existingRecIng } = await query(
            'SELECT id FROM recipe_ingredients WHERE recipe_id = $1 AND ingredient_id = $2',
            [recipeId, ingId],
            { isSuperAdmin: true }
          );
          if (existingRecIng.length === 0) {
            await query(
              `
              INSERT INTO recipe_ingredients (tenant_id, recipe_id, ingredient_id, quantity, unit)
              VALUES ($1, $2, $3, $4, $5)
              `,
              [tenantId, recipeId, ingId, r.qty, r.unit],
              { isSuperAdmin: true }
            );
          }
        }
      }
    }
  }
  console.log(`Seeded ${products.length} menu products with recipes.`);

  // 10b. Modifier / Add-on Groups (e.g. Extra Sauces, Cheese, Dips)
  const addonGroups = [
    {
      name: 'Extra Sauces & Dips',
      nameUrdu: 'اضافی ساس اور چٹنی',
      minSelect: 0,
      maxSelect: 5,
      isRequired: false,
      options: [
        { id: '11111111-aaaa-bbbb-cccc-111111111111', name: 'Extra Garlic Mayo Sauce', price: 50, isDefault: false, isActive: true },
        { id: '22222222-aaaa-bbbb-cccc-222222222222', name: 'Spicy Mint Raita', price: 40, isDefault: false, isActive: true },
        { id: '33333333-aaaa-bbbb-cccc-333333333333', name: 'Smoky BBQ Dip Sauce', price: 60, isDefault: false, isActive: true },
        { id: '44444444-aaaa-bbbb-cccc-444444444444', name: 'Special Imlee Chutney', price: 30, isDefault: false, isActive: true },
      ],
    },
    {
      name: 'Burger & Meal Addons',
      nameUrdu: 'برگر اور کھانے کے ایڈ آنز',
      minSelect: 0,
      maxSelect: 3,
      isRequired: false,
      options: [
        { id: '55555555-aaaa-bbbb-cccc-555555555555', name: 'Extra Cheddar Cheese Slice', price: 70, isDefault: false, isActive: true },
        { id: '66666666-aaaa-bbbb-cccc-666666666666', name: 'Crispy Fried Egg', price: 60, isDefault: false, isActive: true },
        { id: '77777777-aaaa-bbbb-cccc-777777777777', name: 'Side French Fries (Small)', price: 150, isDefault: false, isActive: true },
      ],
    },
  ];

  for (const ag of addonGroups) {
    const { rows: existingAg } = await query(
      'SELECT id FROM modifier_groups WHERE tenant_id = $1 AND name = $2',
      [tenantId, ag.name],
      { isSuperAdmin: true }
    );
    let agId: string;
    if (existingAg.length === 0) {
      const { rows: newAg } = await query(
        `INSERT INTO modifier_groups (tenant_id, name, name_urdu, min_select, max_select, is_required, options)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id`,
        [tenantId, ag.name, ag.nameUrdu, ag.minSelect, ag.maxSelect, ag.isRequired, JSON.stringify(ag.options)],
        { isSuperAdmin: true }
      );
      agId = newAg[0].id;
    } else {
      agId = existingAg[0].id;
    }

    // Attach addon group to all products in tenant
    const { rows: prods } = await query('SELECT id FROM products WHERE tenant_id = $1', [tenantId], { isSuperAdmin: true });
    for (const pr of prods) {
      await query(
        `INSERT INTO product_modifier_groups (tenant_id, product_id, modifier_group_id)
         VALUES ($1, $2, $3)
         ON CONFLICT (product_id, modifier_group_id) DO NOTHING`,
        [tenantId, pr.id, agId],
        { isSuperAdmin: true }
      );
    }
  }
  console.log('Seeded demo addon modifier groups & linked to products.');

  // 11. Initial Open Shift for Cashier
  const { rows: existingShifts } = await query(
    "SELECT id FROM register_shifts WHERE tenant_id = $1 AND branch_id = $2 AND status = 'OPEN'",
    [tenantId, branchId],
    { isSuperAdmin: true }
  );

  if (existingShifts.length === 0) {
    const { rows: cashierUser } = await query(
      "SELECT id FROM users WHERE tenant_id = $1 AND email = 'cashier@lahorekarahi.com'",
      [tenantId],
      { isSuperAdmin: true }
    );

    if (cashierUser.length > 0) {
      await query(
        `
        INSERT INTO register_shifts (
          tenant_id, branch_id, cashier_id, register_name, opening_cash, status
        )
        VALUES ($1, $2, $3, 'Main Counter Register 1', 5000.00, 'OPEN')
        `,
        [tenantId, branchId, cashierUser[0].id],
        { isSuperAdmin: true }
      );
      console.log('Opened initial active shift with 5,000 PKR opening cash in register_shifts.');
    }
  }


  // 12. Multi-Branch Seed: DHA Phase 5 Branch (LHE-02)
  let dhaBranchId: string;
  const { rows: existingDha } = await query(
    'SELECT id FROM branches WHERE tenant_id = $1 AND code = $2',
    [tenantId, 'LHE-02'],
    { isSuperAdmin: true }
  );

  if (existingDha.length === 0) {
    const { rows: newDha } = await query(
      `
      INSERT INTO branches (
        tenant_id, name, code, phone, email, address, city, state, is_main_branch, is_active
      )
      VALUES (
        $1, 'DHA Phase 5 Branch', 'LHE-02', '+92 42 35891100', 'dha@lahorekarahi.com',
        'Sector C, Commercial Area, DHA Phase 5', 'Lahore', 'Punjab', false, true
      )
      RETURNING id
      `,
      [tenantId],
      { isSuperAdmin: true }
    );
    dhaBranchId = newDha[0].id;
    console.log(`Created Second Branch: DHA Phase 5 Branch (${dhaBranchId})`);
  } else {
    dhaBranchId = existingDha[0].id;
  }

  // DHA Floor & Tables
  const { rows: existingDhaFloor } = await query(
    'SELECT id FROM floors WHERE tenant_id = $1 AND branch_id = $2',
    [tenantId, dhaBranchId],
    { isSuperAdmin: true }
  );
  let dhaFloorId: string;
  if (existingDhaFloor.length === 0) {
    const { rows: newFloor } = await query(
      `INSERT INTO floors (tenant_id, branch_id, name, sort_order, is_active)
       VALUES ($1, $2, 'Rooftop Terrace & Dining', 1, true) RETURNING id`,
      [tenantId, dhaBranchId],
      { isSuperAdmin: true }
    );
    dhaFloorId = newFloor[0].id;
  } else {
    dhaFloorId = existingDhaFloor[0].id;
  }

  const dhaTables = [
    { number: 'DHA-01', capacity: 4 },
    { number: 'DHA-02', capacity: 4 },
    { number: 'DHA-03', capacity: 6 },
    { number: 'DHA-04', capacity: 8 },
    { number: 'DHA-05', capacity: 2 },
  ];
  for (const t of dhaTables) {
    await query(
      `INSERT INTO restaurant_tables (tenant_id, branch_id, floor_id, table_number, capacity, status, is_active)
       VALUES ($1, $2, $3, $4, $5, 'AVAILABLE', true)
       ON CONFLICT (branch_id, table_number) DO UPDATE SET is_active = true`,
      [tenantId, dhaBranchId, dhaFloorId, t.number, t.capacity],
      { isSuperAdmin: true }
    );
  }

  // DHA Branch Stocks & FIFO Batches
  const { rows: allIngs } = await query(
    'SELECT id, name, unit, cost_per_unit FROM ingredients WHERE tenant_id = $1',
    [tenantId],
    { isSuperAdmin: true }
  );

  for (const ing of allIngs) {
    await query(
      `INSERT INTO branch_stocks (tenant_id, branch_id, ingredient_id, current_stock, cost_per_unit)
       VALUES ($1, $2, $3, 40.0, $4)
       ON CONFLICT (branch_id, ingredient_id) DO UPDATE SET current_stock = branch_stocks.current_stock`,
      [tenantId, dhaBranchId, ing.id, ing.cost_per_unit],
      { isSuperAdmin: true }
    );

    const { rows: existingDhaBatches } = await query(
      'SELECT id FROM inventory_batches WHERE tenant_id = $1 AND branch_id = $2 AND ingredient_id = $3',
      [tenantId, dhaBranchId, ing.id],
      { isSuperAdmin: true }
    );
    if (existingDhaBatches.length === 0) {
      await query(
        `INSERT INTO inventory_batches (
           tenant_id, branch_id, ingredient_id, quantity_received, quantity_remaining, unit_cost, received_at, status
         )
         VALUES ($1, $2, $3, 40.0, 40.0, $4, CURRENT_TIMESTAMP, 'ACTIVE')`,
        [tenantId, dhaBranchId, ing.id, ing.cost_per_unit],
        { isSuperAdmin: true }
      );
    }
  }

  // 13. Registered Devices for Multi-Device Operations
  const devices = [
    { fp: 'fp-glb-pos-01', name: 'Gulberg Main Cashier POS', type: 'POS_TERMINAL', branch: branchId, ws: 'POS', user: 'Bilal Ahmed', email: 'cashier@lahorekarahi.com' },
    { fp: 'fp-glb-tab-01', name: 'Gulberg Floor Waiter Tablet', type: 'TABLET', branch: branchId, ws: 'POS', user: 'Usman Shah', email: 'waiter@lahorekarahi.com' },
    { fp: 'fp-glb-kds-01', name: 'Gulberg Kitchen Display Monitor', type: 'KDS_DISPLAY', branch: branchId, ws: 'KDS', user: 'Chef Rasheed', email: 'kitchen@lahorekarahi.com' },
    { fp: 'fp-dha-pos-01', name: 'DHA Counter Terminal', type: 'POS_TERMINAL', branch: dhaBranchId, ws: 'POS', user: 'Hamza Ali', email: 'manager@lahorekarahi.com' },
    { fp: 'fp-dha-tab-01', name: 'DHA Rooftop Tablet #1', type: 'TABLET', branch: dhaBranchId, ws: 'POS', user: null, email: null },
  ];

  for (const d of devices) {
    await query(
      `INSERT INTO registered_devices (
         tenant_id, branch_id, device_fingerprint, device_name, device_type, ip_address, is_active,
         default_workspace, last_user_name, last_user_email
       )
       VALUES ($1, $2, $3, $4, $5, '192.168.1.100', true, $6, $7, $8)
       ON CONFLICT (tenant_id, device_fingerprint) DO UPDATE SET
         device_name = $4, is_active = true, default_workspace = $6, last_user_name = $7, last_user_email = $8,
         last_active_at = CURRENT_TIMESTAMP`,
      [tenantId, d.branch, d.fp, d.name, d.type, d.ws, d.user, d.email],
      { isSuperAdmin: true }
    );
  }
  console.log('Seeded registered devices for Gulberg and DHA branches.');

  // 14. Inter-Branch Stock Transfers
  const chickenIng = allIngs.find((i: any) => i.name.toLowerCase().includes('chicken')) || allIngs[0];
  const oilIng = allIngs.find((i: any) => i.name.toLowerCase().includes('oil')) || allIngs[1] || allIngs[0];
  const riceIng = allIngs.find((i: any) => i.name.toLowerCase().includes('rice')) || allIngs[2] || allIngs[0];

  const sampleTransfers = [
    {
      num: 'TR-2026-00001',
      from: branchId,
      to: dhaBranchId,
      ing: chickenIng?.id,
      qty: 25.0,
      cost: Number(chickenIng?.cost_per_unit || 800),
      status: 'RECEIVED',
      notes: 'Initial emergency stock replenishment for DHA grand opening',
    },
    {
      num: 'TR-2026-00002',
      from: branchId,
      to: dhaBranchId,
      ing: oilIng?.id,
      qty: 15.0,
      cost: Number(oilIng?.cost_per_unit || 450),
      status: 'DISPATCHED',
      notes: 'Weekly standard replenishment en route via delivery van',
    },
    {
      num: 'TR-2026-00003',
      from: dhaBranchId,
      to: branchId,
      ing: riceIng?.id,
      qty: 10.0,
      cost: Number(riceIng?.cost_per_unit || 280),
      status: 'PENDING',
      notes: 'Surplus transfer request awaiting manager dispatch approval',
    },
  ];

  for (const st of sampleTransfers) {
    if (st.ing) {
      await query(
        `INSERT INTO stock_transfers (
           tenant_id, transfer_number, from_branch_id, to_branch_id, ingredient_id, quantity, unit_cost, total_cost, status, notes
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         ON CONFLICT (tenant_id, transfer_number) DO UPDATE SET status = $9`,
        [tenantId, st.num, st.from, st.to, st.ing, st.qty, st.cost, st.qty * st.cost, st.status, st.notes],
        { isSuperAdmin: true }
      );
    }
  }
  console.log('Seeded sample inter-branch stock transfers.');

    console.log('✅ Demo restaurant seeding completed successfully!');
}

if (process.argv[1] && process.argv[1].endsWith('seed_demo_restaurant.ts')) {
  seedDemoRestaurant()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Seeding failed:', err);
      process.exit(1);
    });
}
