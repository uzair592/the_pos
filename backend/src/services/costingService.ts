import { query, withTransaction } from '../db/connection.js';
import {
  MenuItemProfitabilityItem,
  MenuProfitabilitySummary,
  RecipeCostIngredientItem,
  CategoryFoodCostAnalysis,
  FoodCostTrendItem,
  BranchFoodCostComparison,
  TheoreticalVsActualItem,
  IngredientPriceHistoryItem,
  IngredientPurchaseHistoryEntry,
  convertRecipeQtyToBase,
  calculateBaseUnitCost,
} from '@pos/shared';

export interface MenuProfitabilityFilter {
  tenantId: string;
  branchId?: string;
  categoryId?: string;
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

/**
 * 1. Calculate Menu Item Profitability and Portfolio Summary
 */
export async function getMenuItemProfitability(filter: MenuProfitabilityFilter): Promise<{
  items: MenuItemProfitabilityItem[];
  summary: MenuProfitabilitySummary;
}> {
  const { tenantId, branchId, categoryId, search, sortBy = 'foodCostDesc', sortOrder = 'desc' } = filter;

  // Query all active products with category information
  let sql = `
    SELECT
      p.id as product_id,
      p.name as product_name,
      p.sku,
      p.category_id,
      c.name as category_name,
      p.station,
      COALESCE(p.base_price, 0)::numeric as selling_price,
      COALESCE(p.dine_in_price, p.base_price)::numeric as dine_in_price,
      COALESCE(p.takeaway_price, p.base_price)::numeric as takeaway_price,
      COALESCE(p.delivery_price, p.base_price)::numeric as delivery_price,
      COALESCE(p.packaging_cost, 0)::numeric as packaging_cost,
      COALESCE(p.additional_cost, 0)::numeric as additional_cost,
      COALESCE(p.target_food_cost_percentage, 30.00)::numeric as target_food_cost_percentage,
      r.id as recipe_id,
      COALESCE(r.yield_count, 1.00)::numeric as recipe_yield
    FROM products p
    JOIN categories c ON c.id = p.category_id
    LEFT JOIN recipes r ON r.product_id = p.id AND r.variant_id IS NULL AND r.tenant_id = $1
    WHERE p.tenant_id = $1 AND p.is_available = true
  `;
  const params: any[] = [tenantId];

  if (categoryId) {
    params.push(categoryId);
    sql += ` AND p.category_id = $${params.length}`;
  }

  if (search) {
    params.push(`%${search}%`);
    sql += ` AND (p.name ILIKE $${params.length} OR p.sku ILIKE $${params.length} OR c.name ILIKE $${params.length})`;
  }

  sql += ` ORDER BY p.name ASC`;

  const { rows: products } = await query(sql, params, { tenantId });

  // For each product, compute exact recipe ingredient costs using latest base costs
  const items: MenuItemProfitabilityItem[] = [];

  for (const prod of products) {
    let ingredientCost = 0;
    const ingredientsList: RecipeCostIngredientItem[] = [];

    if (prod.recipe_id) {
      const { rows: recipeIngs } = await query(
        `
        SELECT
          ri.ingredient_id,
          i.name as ingredient_name,
          COALESCE(i.category, 'General') as category,
          COALESCE(ri.entered_quantity, ri.quantity)::numeric as entered_quantity,
          COALESCE(ri.recipe_unit, ri.unit, i.base_unit, 'G') as recipe_unit,
          COALESCE(i.base_unit, i.unit, 'G') as base_unit,
          COALESCE(i.conversion_factor, 1.0000)::numeric as conversion_factor,
          COALESCE(bs.cost_per_unit, i.cost_per_unit, 0)::numeric as base_unit_cost
        FROM recipe_ingredients ri
        JOIN ingredients i ON i.id = ri.ingredient_id
        LEFT JOIN branch_stocks bs ON bs.ingredient_id = i.id ${branchId ? 'AND bs.branch_id = $3' : ''}
        WHERE ri.recipe_id = $1 AND ri.tenant_id = $2
        ORDER BY i.name ASC
        `,
        branchId ? [prod.recipe_id, tenantId, branchId] : [prod.recipe_id, tenantId],
        { tenantId }
      );

      // Calculate each ingredient's base consumption and cost
      for (const ing of recipeIngs) {
        const baseQty = convertRecipeQtyToBase(
          Number(ing.entered_quantity),
          ing.recipe_unit,
          ing.base_unit,
          Number(ing.conversion_factor || 1)
        );
        const lineCost = baseQty * Number(ing.base_unit_cost);
        ingredientCost += lineCost;

        ingredientsList.push({
          ingredientId: ing.ingredient_id,
          ingredientName: ing.ingredient_name,
          category: ing.category,
          enteredQuantity: Number(ing.entered_quantity),
          recipeUnit: ing.recipe_unit,
          baseQuantity: Number(baseQty.toFixed(4)),
          baseUnit: ing.base_unit,
          baseUnitCost: Number(ing.base_unit_cost),
          lineCost: Number(lineCost.toFixed(2)),
          costPercentage: 0, // filled below
        });
      }

      // Populate line cost percentage of total recipe cost
      if (ingredientCost > 0) {
        for (const ing of ingredientsList) {
          ing.costPercentage = Number(((ing.lineCost / ingredientCost) * 100).toFixed(1));
        }
      }
    }

    const sellingPrice = Number(prod.selling_price);
    const packagingCost = Number(prod.packaging_cost || 0);
    const additionalCost = Number(prod.additional_cost || 0);
    const totalDirectCost = Number((ingredientCost + packagingCost + additionalCost).toFixed(2));
    const grossProfit = Number((sellingPrice - totalDirectCost).toFixed(2));
    const foodCostPercentage = sellingPrice > 0 ? Number(((totalDirectCost / sellingPrice) * 100).toFixed(1)) : 0;
    const grossProfitMargin = sellingPrice > 0 ? Number(((grossProfit / sellingPrice) * 100).toFixed(1)) : 0;

    let status: MenuItemProfitabilityItem['status'] = 'HEALTHY';
    if (foodCostPercentage <= 28) status = 'EXCELLENT';
    else if (foodCostPercentage <= 35) status = 'HEALTHY';
    else if (foodCostPercentage <= 45) status = 'WARNING';
    else status = 'CRITICAL';

    items.push({
      productId: prod.product_id,
      variantId: null,
      productName: prod.product_name,
      variantName: null,
      sku: prod.sku,
      categoryId: prod.category_id,
      categoryName: prod.category_name,
      station: prod.station,
      sellingPrice,
      dineInPrice: Number(prod.dine_in_price),
      takeawayPrice: Number(prod.takeaway_price),
      deliveryPrice: Number(prod.delivery_price),
      ingredientCost: Number(ingredientCost.toFixed(2)),
      packagingCost,
      additionalCost,
      totalDirectCost,
      grossProfit,
      foodCostPercentage,
      grossProfitMargin,
      targetFoodCostPercentage: Number(prod.target_food_cost_percentage || 30.00),
      status,
      hasRecipe: ingredientsList.length > 0,
      recipeYield: Number(prod.recipe_yield || 1.00),
      ingredientCount: ingredientsList.length,
      ingredients: ingredientsList,
    });
  }

  // Sorting logic
  items.sort((a, b) => {
    switch (sortBy) {
      case 'foodCostDesc':
        return b.foodCostPercentage - a.foodCostPercentage;
      case 'foodCostAsc':
        return a.foodCostPercentage - b.foodCostPercentage;
      case 'profitDesc':
        return b.grossProfit - a.grossProfit;
      case 'profitAsc':
        return a.grossProfit - b.grossProfit;
      case 'marginDesc':
        return b.grossProfitMargin - a.grossProfitMargin;
      case 'marginAsc':
        return a.grossProfitMargin - b.grossProfitMargin;
      case 'priceDesc':
        return b.sellingPrice - a.sellingPrice;
      case 'priceAsc':
        return a.sellingPrice - b.sellingPrice;
      case 'nameAsc':
      default:
        return a.productName.localeCompare(b.productName);
    }
  });

  // Calculate Summary KPI Cards
  const itemsWithRecipes = items.filter((i) => i.hasRecipe);
  const totalMenuItems = items.length;
  const avgFoodCostPercentage =
    itemsWithRecipes.length > 0
      ? Number((itemsWithRecipes.reduce((sum, i) => sum + i.foodCostPercentage, 0) / itemsWithRecipes.length).toFixed(1))
      : 0;
  const avgGrossProfit =
    itemsWithRecipes.length > 0
      ? Number((itemsWithRecipes.reduce((sum, i) => sum + i.grossProfit, 0) / itemsWithRecipes.length).toFixed(2))
      : 0;
  const totalRecipeCost = Number(itemsWithRecipes.reduce((sum, i) => sum + i.totalDirectCost, 0).toFixed(2));

  // Find Highest Food Cost Item and Most Profitable Item
  let highestFoodCostItem: MenuProfitabilitySummary['highestFoodCostItem'] = null;
  let mostProfitableItem: MenuProfitabilitySummary['mostProfitableItem'] = null;

  if (itemsWithRecipes.length > 0) {
    const sortedByCost = [...itemsWithRecipes].sort((a, b) => b.foodCostPercentage - a.foodCostPercentage);
    const sortedByProfit = [...itemsWithRecipes].sort((a, b) => b.grossProfit - a.grossProfit);

    highestFoodCostItem = {
      name: sortedByCost[0].productName,
      foodCostPercentage: sortedByCost[0].foodCostPercentage,
      sellingPrice: sortedByCost[0].sellingPrice,
      directCost: sortedByCost[0].totalDirectCost,
    };

    mostProfitableItem = {
      name: sortedByProfit[0].productName,
      grossProfit: sortedByProfit[0].grossProfit,
      grossProfitMargin: sortedByProfit[0].grossProfitMargin,
      sellingPrice: sortedByProfit[0].sellingPrice,
    };
  }

  const summary: MenuProfitabilitySummary = {
    totalMenuItems,
    itemsWithRecipes: itemsWithRecipes.length,
    avgFoodCostPercentage,
    avgGrossProfit,
    totalRecipeCost,
    highestFoodCostItem,
    mostProfitableItem,
  };

  return { items, summary };
}

/**
 * 2. Get Recipe Costing Breakdown for a single product
 */
export async function getRecipeCostingBreakdown(tenantId: string, productId: string, branchId?: string) {
  const { items } = await getMenuItemProfitability({ tenantId, branchId });
  const item = items.find((i) => i.productId === productId);
  if (!item) return null;

  // Recommended selling price to achieve target food cost percentage
  const targetPct = item.targetFoodCostPercentage || 30.00;
  const recommendedSellingPrice = targetPct > 0 ? Number(((item.totalDirectCost / (targetPct / 100))).toFixed(0)) : item.sellingPrice;

  return {
    ...item,
    recommendedSellingPrice,
  };
}

/**
 * 3. Update Product Additional Direct Costs (Packaging, Consumables, Target Food Cost %)
 */
export async function updateProductDirectCosts(
  tenantId: string,
  productId: string,
  data: {
    packagingCost?: number;
    additionalCost?: number;
    targetFoodCostPercentage?: number;
    basePrice?: number;
  }
) {
  const { packagingCost, additionalCost, targetFoodCostPercentage, basePrice } = data;

  const result = await withTransaction(async (client) => {
    let updateSql = `UPDATE products SET updated_at = CURRENT_TIMESTAMP`;
    const params: any[] = [productId, tenantId];

    if (packagingCost !== undefined) {
      params.push(packagingCost);
      updateSql += `, packaging_cost = $${params.length}`;
    }
    if (additionalCost !== undefined) {
      params.push(additionalCost);
      updateSql += `, additional_cost = $${params.length}`;
    }
    if (targetFoodCostPercentage !== undefined) {
      params.push(targetFoodCostPercentage);
      updateSql += `, target_food_cost_percentage = $${params.length}`;
    }
    if (basePrice !== undefined) {
      params.push(basePrice);
      updateSql += `, base_price = $${params.length}`;
    }

    updateSql += ` WHERE id = $1 AND tenant_id = $2 RETURNING *`;
    const res = await client.query(updateSql, params);

    // Also update packaging_cost and additional_cost on recipe if exists
    if (packagingCost !== undefined || additionalCost !== undefined) {
      await client.query(
        `
        UPDATE recipes
        SET packaging_cost = COALESCE($1, packaging_cost),
            additional_cost = COALESCE($2, additional_cost),
            updated_at = CURRENT_TIMESTAMP
        WHERE product_id = $3 AND tenant_id = $4
        `,
        [packagingCost ?? 0, additionalCost ?? 0, productId, tenantId]
      );
    }

    return res.rows[0];
  }, { tenantId });

  return result;
}

/**
 * 4. Food Cost Analysis (Overall, Category-wise, Trends, Top 10, Branch Comparison)
 */
export async function getFoodCostAnalysis(
  tenantId: string,
  options: {
    branchId?: string;
    startDate?: string;
    endDate?: string;
    groupBy?: 'day' | 'week' | 'month';
  }
) {
  const { branchId, startDate, endDate, groupBy = 'day' } = options;
  const start = startDate || new Date(new Date().setDate(new Date().getDate() - 30)).toISOString();
  const end = endDate || new Date().toISOString();

  // 1. Overall Metrics
  let overallSql = `
    SELECT
      COALESCE(SUM(o.subtotal - o.total_discount), 0)::numeric as net_sales,
      COALESCE(SUM(cogs_sub.total_cogs), 0)::numeric as total_cogs,
      (COALESCE(SUM(o.subtotal - o.total_discount), 0) - COALESCE(SUM(cogs_sub.total_cogs), 0))::numeric as gross_profit,
      COUNT(o.id)::int as order_count
    FROM orders o
    LEFT JOIN LATERAL (
      SELECT COALESCE(SUM(COALESCE(cogs, cost_price * quantity, 0)), 0) as total_cogs
      FROM order_items
      WHERE order_id = o.id
    ) cogs_sub ON true
    WHERE o.tenant_id = $1 AND o.status = 'COMPLETED'
      AND o.created_at >= $2::timestamptz AND o.created_at <= $3::timestamptz
  `;
  const overallParams: any[] = [tenantId, start, end];
  if (branchId) {
    overallParams.push(branchId);
    overallSql += ` AND o.branch_id = $${overallParams.length}`;
  }

  const { rows: overallRows } = await query(overallSql, overallParams, { tenantId });
  const overall = overallRows[0] || { net_sales: 0, total_cogs: 0, gross_profit: 0, order_count: 0 };
  const netSales = Number(overall.net_sales || 0);
  const totalCogs = Number(overall.total_cogs || 0);
  const grossProfit = Number(overall.gross_profit || 0);
  const overallFoodCostPercent = netSales > 0 ? Number(((totalCogs / netSales) * 100).toFixed(1)) : 0;
  const overallGrossMargin = netSales > 0 ? Number(((grossProfit / netSales) * 100).toFixed(1)) : 0;

  // 2. Category Breakdown
  let categorySql = `
    SELECT
      c.id as category_id,
      c.name as category_name,
      COUNT(DISTINCT p.id)::int as item_count,
      COALESCE(SUM(oi.total_price), 0)::numeric as total_sales,
      COALESCE(SUM(COALESCE(oi.cogs, oi.cost_price * oi.quantity, 0)), 0)::numeric as total_cogs
    FROM categories c
    JOIN products p ON p.category_id = c.id
    LEFT JOIN order_items oi ON oi.product_id = p.id
    LEFT JOIN orders o ON o.id = oi.order_id
      AND o.status = 'COMPLETED'
      AND o.created_at >= $2::timestamptz AND o.created_at <= $3::timestamptz
      ${branchId ? 'AND o.branch_id = $4' : ''}
    WHERE c.tenant_id = $1 AND c.is_active = true
    GROUP BY c.id, c.name
    ORDER BY total_sales DESC
  `;
  const catParams: any[] = [tenantId, start, end];
  if (branchId) catParams.push(branchId);

  const { rows: catRows } = await query(categorySql, catParams, { tenantId });
  const categoryBreakdown: CategoryFoodCostAnalysis[] = catRows.map((cat) => {
    const catSales = Number(cat.total_sales || 0);
    const catCogs = Number(cat.total_cogs || 0);
    const catProfit = Number((catSales - catCogs).toFixed(2));
    const catFoodCostPct = catSales > 0 ? Number(((catCogs / catSales) * 100).toFixed(1)) : 0;
    const catMargin = catSales > 0 ? Number(((catProfit / catSales) * 100).toFixed(1)) : 0;

    return {
      categoryId: cat.category_id,
      categoryName: cat.category_name,
      itemCount: Number(cat.item_count),
      totalSales: catSales,
      totalCogs: catCogs,
      grossProfit: catProfit,
      foodCostPercentage: catFoodCostPct,
      grossProfitMargin: catMargin,
    };
  });

  // 3. Trends (Daily, Weekly, Monthly)
  let dateTrunc = 'day';
  if (groupBy === 'week') dateTrunc = 'week';
  if (groupBy === 'month') dateTrunc = 'month';

  let trendSql = `
    SELECT
      TO_CHAR(DATE_TRUNC('${dateTrunc}', o.created_at), 'YYYY-MM-DD') as period,
      COALESCE(SUM(o.subtotal - o.total_discount), 0)::numeric as net_sales,
      COALESCE(SUM(cogs_sub.total_cogs), 0)::numeric as cogs,
      (COALESCE(SUM(o.subtotal - o.total_discount), 0) - COALESCE(SUM(cogs_sub.total_cogs), 0))::numeric as gross_profit,
      COUNT(o.id)::int as order_count
    FROM orders o
    LEFT JOIN LATERAL (
      SELECT COALESCE(SUM(COALESCE(cogs, cost_price * quantity, 0)), 0) as total_cogs
      FROM order_items
      WHERE order_id = o.id
    ) cogs_sub ON true
    WHERE o.tenant_id = $1 AND o.status = 'COMPLETED'
      AND o.created_at >= $2::timestamptz AND o.created_at <= $3::timestamptz
  `;
  const trendParams: any[] = [tenantId, start, end];
  if (branchId) {
    trendParams.push(branchId);
    trendSql += ` AND o.branch_id = $${trendParams.length}`;
  }
  trendSql += ` GROUP BY DATE_TRUNC('${dateTrunc}', o.created_at) ORDER BY period ASC`;

  const { rows: trendRows } = await query(trendSql, trendParams, { tenantId });
  const trends: FoodCostTrendItem[] = trendRows.map((tr) => {
    const trSales = Number(tr.net_sales || 0);
    const trCogs = Number(tr.cogs || 0);
    const trProfit = Number(tr.gross_profit || 0);
    const trPct = trSales > 0 ? Number(((trCogs / trSales) * 100).toFixed(1)) : 0;
    return {
      period: tr.period,
      netSales: trSales,
      cogs: trCogs,
      grossProfit: trProfit,
      foodCostPercentage: trPct,
      orderCount: Number(tr.order_count),
    };
  });

  // 4. Product Sales Performance for Top 10 Profitable & Highest Food Cost
  let prodPerfSql = `
    SELECT
      p.id as product_id,
      p.name as product_name,
      c.name as category_name,
      SUM(oi.quantity)::numeric as quantity_sold,
      SUM(oi.total_price)::numeric as total_sales,
      SUM(COALESCE(oi.cogs, oi.cost_price * oi.quantity, 0))::numeric as total_cogs,
      (SUM(oi.total_price) - SUM(COALESCE(oi.cogs, oi.cost_price * oi.quantity, 0)))::numeric as gross_profit
    FROM order_items oi
    JOIN orders o ON o.id = oi.order_id
    JOIN products p ON p.id = oi.product_id
    JOIN categories c ON c.id = p.category_id
    WHERE o.tenant_id = $1 AND o.status = 'COMPLETED'
      AND o.created_at >= $2::timestamptz AND o.created_at <= $3::timestamptz
  `;
  const prodParams: any[] = [tenantId, start, end];
  if (branchId) {
    prodParams.push(branchId);
    prodPerfSql += ` AND o.branch_id = $${prodParams.length}`;
  }
  prodPerfSql += ` GROUP BY p.id, p.name, c.name HAVING SUM(oi.total_price) > 0`;

  const { rows: prodRows } = await query(prodPerfSql, prodParams, { tenantId });
  const prodItems = prodRows.map((r) => {
    const s = Number(r.total_sales || 0);
    const c = Number(r.total_cogs || 0);
    const gp = Number(r.gross_profit || 0);
    const pct = s > 0 ? Number(((c / s) * 100).toFixed(1)) : 0;
    const margin = s > 0 ? Number(((gp / s) * 100).toFixed(1)) : 0;
    return {
      productId: r.product_id,
      productName: r.product_name,
      categoryName: r.category_name,
      quantitySold: Number(r.quantity_sold),
      totalSales: s,
      totalCogs: c,
      grossProfit: gp,
      foodCostPercentage: pct,
      grossProfitMargin: margin,
    };
  });

  const topProfitable = [...prodItems].sort((a, b) => b.grossProfit - a.grossProfit).slice(0, 10);
  const highestFoodCost = [...prodItems].sort((a, b) => b.foodCostPercentage - a.foodCostPercentage).slice(0, 10);

  // 5. Branch Comparison
  const branchSql = `
    SELECT
      b.id as branch_id,
      b.name as branch_name,
      COUNT(o.id)::int as order_count,
      COALESCE(SUM(o.subtotal - o.total_discount), 0)::numeric as net_sales,
      COALESCE(SUM(cogs_sub.total_cogs), 0)::numeric as total_cogs,
      (COALESCE(SUM(o.subtotal - o.total_discount), 0) - COALESCE(SUM(cogs_sub.total_cogs), 0))::numeric as gross_profit
    FROM branches b
    LEFT JOIN orders o ON o.branch_id = b.id
      AND o.status = 'COMPLETED'
      AND o.created_at >= $2::timestamptz AND o.created_at <= $3::timestamptz
    LEFT JOIN LATERAL (
      SELECT COALESCE(SUM(COALESCE(cogs, cost_price * quantity, 0)), 0) as total_cogs
      FROM order_items
      WHERE order_id = o.id
    ) cogs_sub ON true
    WHERE b.tenant_id = $1 AND b.is_active = true
    GROUP BY b.id, b.name
    ORDER BY net_sales DESC
  `;
  const { rows: branchRows } = await query(branchSql, [tenantId, start, end], { tenantId });
  const branchComparison: BranchFoodCostComparison[] = branchRows.map((br) => {
    const s = Number(br.net_sales || 0);
    const c = Number(br.total_cogs || 0);
    const gp = Number(br.gross_profit || 0);
    const pct = s > 0 ? Number(((c / s) * 100).toFixed(1)) : 0;
    const margin = s > 0 ? Number(((gp / s) * 100).toFixed(1)) : 0;
    return {
      branchId: br.branch_id,
      branchName: br.branch_name,
      orderCount: Number(br.order_count),
      netSales: s,
      cogs: c,
      grossProfit: gp,
      foodCostPercentage: pct,
      grossProfitMargin: margin,
    };
  });

  return {
    period: { start, end },
    overall: {
      netSales,
      totalCogs,
      grossProfit,
      overallFoodCostPercent,
      overallGrossMargin,
      orderCount: Number(overall.order_count),
    },
    categoryBreakdown,
    trends,
    topProfitable,
    highestFoodCost,
    branchComparison,
  };
}

/**
 * 5. Theoretical vs Actual Food Cost Analysis (Wastage & Consumption Variance)
 */
export async function getTheoreticalVsActual(
  tenantId: string,
  options: {
    branchId?: string;
    startDate?: string;
    endDate?: string;
    ingredientId?: string;
  }
): Promise<{
  items: TheoreticalVsActualItem[];
  summary: {
    totalTheoreticalCost: number;
    totalActualCost: number;
    totalCostVariance: number;
    totalWastageCost: number;
    variancePercentage: number;
  };
}> {
  const { branchId, startDate, endDate, ingredientId } = options;
  const start = startDate || new Date(new Date().setDate(new Date().getDate() - 30)).toISOString();
  const end = endDate || new Date().toISOString();

  // 1. Calculate Theoretical Consumption from completed orders x recipes
  let theoSql = `
    SELECT
      ri.ingredient_id,
      i.name as ingredient_name,
      COALESCE(i.category, 'General') as category,
      COALESCE(i.base_unit, i.unit, 'G') as base_unit,
      COALESCE(i.purchase_unit, 'KG') as purchase_unit,
      COALESCE(i.conversion_factor, 1.0000)::numeric as conversion_factor,
      COALESCE(bs.cost_per_unit, i.cost_per_unit, 0)::numeric as cost_per_base_unit,
      SUM(oi.quantity * ri.quantity)::numeric as theoretical_quantity,
      SUM(oi.quantity * ri.quantity * COALESCE(bs.cost_per_unit, ri.unit_cost, i.cost_per_unit, 0))::numeric as theoretical_cost
    FROM orders o
    JOIN order_items oi ON oi.order_id = o.id
    JOIN recipes r ON r.product_id = oi.product_id AND (r.variant_id = oi.variant_id OR (r.variant_id IS NULL AND oi.variant_id IS NULL))
    JOIN recipe_ingredients ri ON ri.recipe_id = r.id
    JOIN ingredients i ON i.id = ri.ingredient_id
    LEFT JOIN branch_stocks bs ON bs.ingredient_id = i.id ${branchId ? 'AND bs.branch_id = $4' : ''}
    WHERE o.tenant_id = $1 AND o.status = 'COMPLETED'
      AND o.created_at >= $2::timestamptz AND o.created_at <= $3::timestamptz
  `;
  const theoParams: any[] = [tenantId, start, end];
  if (branchId) {
    theoParams.push(branchId);
    theoSql += ` AND o.branch_id = $${theoParams.length}`;
  }
  if (ingredientId) {
    theoParams.push(ingredientId);
    theoSql += ` AND ri.ingredient_id = $${theoParams.length}`;
  }
  theoSql += ` GROUP BY ri.ingredient_id, i.name, i.category, i.base_unit, i.unit, i.purchase_unit, i.conversion_factor, bs.cost_per_unit, i.cost_per_unit`;

  const { rows: theoRows } = await query(theoSql, theoParams, { tenantId });

  // 2. Query Actual FIFO batch consumption for orders
  let actualBatchSql = `
    SELECT
      c.ingredient_id,
      SUM(c.quantity)::numeric as batch_consumed_qty,
      SUM(c.total_cost)::numeric as batch_consumed_cost
    FROM order_item_batch_consumptions c
    JOIN orders o ON o.id = c.order_id
    WHERE c.tenant_id = $1 AND o.status = 'COMPLETED'
      AND o.created_at >= $2::timestamptz AND o.created_at <= $3::timestamptz
  `;
  const actualBatchParams: any[] = [tenantId, start, end];
  if (branchId) {
    actualBatchParams.push(branchId);
    actualBatchSql += ` AND c.branch_id = $${actualBatchParams.length}`;
  }
  if (ingredientId) {
    actualBatchParams.push(ingredientId);
    actualBatchSql += ` AND c.ingredient_id = $${actualBatchParams.length}`;
  }
  actualBatchSql += ` GROUP BY c.ingredient_id`;

  const { rows: batchRows } = await query(actualBatchSql, actualBatchParams, { tenantId });
  const batchMap = new Map<string, { qty: number; cost: number }>();
  for (const b of batchRows) {
    batchMap.set(b.ingredient_id, {
      qty: Number(b.batch_consumed_qty || 0),
      cost: Number(b.batch_consumed_cost || 0),
    });
  }

  // 3. Query Wastage, Spoilage, Damage, and Adjustments from stock_movements
  let movementSql = `
    SELECT
      sm.ingredient_id,
      SUM(CASE WHEN sm.movement_type = 'WASTAGE' THEN ABS(sm.quantity) ELSE 0 END)::numeric as wastage_qty,
      SUM(CASE WHEN sm.movement_type = 'WASTAGE' THEN ABS(sm.total_cost) ELSE 0 END)::numeric as wastage_cost,
      SUM(CASE WHEN sm.movement_type IN ('ADJUSTMENT_SUBTRACT', 'RETURN_TO_SUPPLIER') THEN ABS(sm.quantity) ELSE 0 END)::numeric as adjustment_qty,
      SUM(CASE WHEN sm.movement_type IN ('ADJUSTMENT_SUBTRACT', 'RETURN_TO_SUPPLIER') THEN ABS(sm.total_cost) ELSE 0 END)::numeric as adjustment_cost
    FROM stock_movements sm
    WHERE sm.tenant_id = $1
      AND sm.created_at >= $2::timestamptz AND sm.created_at <= $3::timestamptz
  `;
  const moveParams: any[] = [tenantId, start, end];
  if (branchId) {
    moveParams.push(branchId);
    movementSql += ` AND sm.branch_id = $${moveParams.length}`;
  }
  if (ingredientId) {
    moveParams.push(ingredientId);
    movementSql += ` AND sm.ingredient_id = $${moveParams.length}`;
  }
  movementSql += ` GROUP BY sm.ingredient_id`;

  const { rows: moveRows } = await query(movementSql, moveParams, { tenantId });
  const moveMap = new Map<string, { wasteQty: number; wasteCost: number; adjQty: number; adjCost: number }>();
  for (const m of moveRows) {
    moveMap.set(m.ingredient_id, {
      wasteQty: Number(m.wastage_qty || 0),
      wasteCost: Number(m.wastage_cost || 0),
      adjQty: Number(m.adjustment_qty || 0),
      adjCost: Number(m.adjustment_cost || 0),
    });
  }

  // Combine datasets
  const items: TheoreticalVsActualItem[] = [];
  let totalTheoreticalCost = 0;
  let totalActualCost = 0;
  let totalWastageCost = 0;

  for (const theo of theoRows) {
    const ingId = theo.ingredient_id;
    const batchData = batchMap.get(ingId) || { qty: 0, cost: 0 };
    const moveData = moveMap.get(ingId) || { wasteQty: 0, wasteCost: 0, adjQty: 0, adjCost: 0 };

    const theoQty = Number(theo.theoretical_quantity || 0);
    const theoCost = Number(theo.theoretical_cost || 0);

    // If batch records are not yet consumed or orders were completed before FIFO batch tracking, fallback to theoretical as baseline
    const batchQty = batchData.qty > 0 ? batchData.qty : theoQty;
    const batchCost = batchData.cost > 0 ? batchData.cost : theoCost;

    const actualQty = Number((batchQty + moveData.wasteQty + moveData.adjQty).toFixed(4));
    const actualCost = Number((batchCost + moveData.wasteCost + moveData.adjCost).toFixed(2));

    const qtyVariance = Number((actualQty - theoQty).toFixed(4));
    const costVariance = Number((actualCost - theoCost).toFixed(2));
    const variancePercentage = theoQty > 0 ? Number(((qtyVariance / theoQty) * 100).toFixed(1)) : 0;

    let status: TheoreticalVsActualItem['status'] = 'NORMAL';
    if (Math.abs(variancePercentage) <= 3) status = 'NORMAL';
    else if (variancePercentage <= 8) status = 'WATCH';
    else status = 'INVESTIGATE';

    totalTheoreticalCost += theoCost;
    totalActualCost += actualCost;
    totalWastageCost += moveData.wasteCost;

    items.push({
      ingredientId: ingId,
      ingredientName: theo.ingredient_name,
      category: theo.category,
      baseUnit: theo.base_unit,
      purchaseUnit: theo.purchase_unit,
      conversionFactor: Number(theo.conversion_factor),
      costPerBaseUnit: Number(theo.cost_per_base_unit),
      theoreticalQuantity: Number(theoQty.toFixed(4)),
      theoreticalCost: Number(theoCost.toFixed(2)),
      actualQuantity: actualQty,
      actualCost: actualCost,
      batchConsumedQuantity: Number(batchQty.toFixed(4)),
      wastageQuantity: Number(moveData.wasteQty.toFixed(4)),
      adjustmentQuantity: Number(moveData.adjQty.toFixed(4)),
      quantityVariance: qtyVariance,
      costVariance: costVariance,
      variancePercentage,
      status,
    });
  }

  // Sort by highest cost variance descending
  items.sort((a, b) => Math.abs(b.costVariance) - Math.abs(a.costVariance));

  const totalCostVariance = Number((totalActualCost - totalTheoreticalCost).toFixed(2));
  const variancePercentage =
    totalTheoreticalCost > 0 ? Number(((totalCostVariance / totalTheoreticalCost) * 100).toFixed(1)) : 0;

  return {
    items,
    summary: {
      totalTheoreticalCost: Number(totalTheoreticalCost.toFixed(2)),
      totalActualCost: Number(totalActualCost.toFixed(2)),
      totalCostVariance,
      totalWastageCost: Number(totalWastageCost.toFixed(2)),
      variancePercentage,
    },
  };
}

/**
 * 6. Ingredient Price History & Impact Tracking
 */
export async function getIngredientPriceHistory(
  tenantId: string,
  options: { branchId?: string; ingredientId?: string }
): Promise<IngredientPriceHistoryItem[]> {
  const { branchId, ingredientId } = options;

  let ingSql = `
    SELECT
      i.id as ingredient_id,
      i.name as ingredient_name,
      COALESCE(i.category, 'General') as category,
      COALESCE(i.base_unit, i.unit, 'G') as base_unit,
      COALESCE(i.purchase_unit, 'KG') as purchase_unit,
      COALESCE(i.conversion_factor, 1.0000)::numeric as conversion_factor,
      COALESCE(bs.cost_per_unit, i.cost_per_unit, 0)::numeric as current_base_cost,
      COALESCE(i.purchase_cost, i.cost_per_unit * i.conversion_factor, 0)::numeric as current_purchase_cost
    FROM ingredients i
    LEFT JOIN branch_stocks bs ON bs.ingredient_id = i.id ${branchId ? 'AND bs.branch_id = $2' : ''}
    WHERE i.tenant_id = $1 AND i.is_active = true
  `;
  const params: any[] = [tenantId];
  if (branchId) params.push(branchId);
  if (ingredientId) {
    params.push(ingredientId);
    ingSql += ` AND i.id = $${params.length}`;
  }
  ingSql += ` ORDER BY i.name ASC`;

  const { rows: ings } = await query(ingSql, params, { tenantId });
  const result: IngredientPriceHistoryItem[] = [];

  for (const ing of ings) {
    // 1. Fetch purchase history entries for this ingredient
    const { rows: historyRows } = await query(
      `
      SELECT
        pi.id,
        inv.invoice_number,
        s.name as supplier_name,
        COALESCE(inv.received_at, inv.created_at) as invoice_date,
        pi.quantity as purchase_quantity,
        COALESCE(pi.purchase_unit, pi.unit) as purchase_unit,
        pi.unit_price as purchase_unit_price,
        COALESCE(pi.base_unit_cost, pi.unit_price / COALESCE(pi.conversion_factor, 1.0)) as base_unit_cost,
        'PURCHASE_INVOICE' as source_type,
        inv.notes
      FROM purchase_items pi
      JOIN purchase_invoices inv ON inv.id = pi.purchase_id
      LEFT JOIN suppliers s ON s.id = inv.supplier_id
      WHERE pi.ingredient_id = $1 AND inv.tenant_id = $2 AND inv.status = 'RECEIVED'
        ${branchId ? 'AND inv.branch_id = $3' : ''}
      ORDER BY COALESCE(inv.received_at, inv.created_at) DESC
      LIMIT 20
      `,
      branchId ? [ing.ingredient_id, tenantId, branchId] : [ing.ingredient_id, tenantId],
      { tenantId }
    );

    // Also fetch any manual cost changes from ingredient_cost_history
    const { rows: manualRows } = await query(
      `
      SELECT
        id,
        NULL as invoice_number,
        supplier_name,
        created_at as invoice_date,
        NULL as purchase_quantity,
        NULL as purchase_unit,
        new_purchase_cost as purchase_unit_price,
        new_cost_per_unit as base_unit_cost,
        source_type,
        notes
      FROM ingredient_cost_history
      WHERE ingredient_id = $1 AND tenant_id = $2
      ORDER BY created_at DESC
      LIMIT 10
      `,
      [ing.ingredient_id, tenantId],
      { tenantId }
    );

    const mergedHistory: IngredientPurchaseHistoryEntry[] = [...historyRows, ...manualRows].map((h) => ({
      id: h.id,
      invoiceNumber: h.invoice_number || undefined,
      supplierName: h.supplier_name || 'System Baseline',
      date: new Date(h.invoice_date).toISOString().split('T')[0],
      purchaseQuantity: h.purchase_quantity ? Number(h.purchase_quantity) : undefined,
      purchaseUnit: h.purchase_unit || ing.purchase_unit,
      purchaseUnitPrice: Number(h.purchase_unit_price || 0),
      baseUnitCost: Number(h.base_unit_cost || 0),
      sourceType: h.source_type,
      notes: h.notes || undefined,
    }));

    mergedHistory.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    // Compute previous cost, latest cost, average cost, % change
    const currentBaseCost = Number(ing.current_base_cost);
    const currentPurchaseCost = Number(ing.current_purchase_cost);
    const latestPurchaseCost = mergedHistory.length > 0 ? mergedHistory[0].purchaseUnitPrice : currentPurchaseCost;
    const previousPurchaseCost = mergedHistory.length > 1 ? mergedHistory[1].purchaseUnitPrice : latestPurchaseCost;
    const averagePurchaseCost =
      mergedHistory.length > 0
        ? Number(
            (
              mergedHistory.reduce((sum, h) => sum + h.purchaseUnitPrice, 0) / mergedHistory.length
            ).toFixed(2)
          )
        : currentPurchaseCost;

    const priceChangePercentage =
      previousPurchaseCost > 0
        ? Number((((latestPurchaseCost - previousPurchaseCost) / previousPurchaseCost) * 100).toFixed(1))
        : 0;

    // Find affected menu items (recipes using this ingredient)
    const { rows: affectedProducts } = await query(
      `
      SELECT
        p.id,
        p.name,
        COALESCE(p.base_price, 0)::numeric as selling_price,
        COALESCE(r.total_cost, 0)::numeric as total_cost
      FROM recipe_ingredients ri
      JOIN recipes r ON r.id = ri.recipe_id
      JOIN products p ON p.id = r.product_id
      WHERE ri.ingredient_id = $1 AND r.tenant_id = $2 AND p.is_available = true
      GROUP BY p.id, p.name, p.base_price, r.total_cost
      ORDER BY p.name ASC
      `,
      [ing.ingredient_id, tenantId],
      { tenantId }
    );

    const affectedMenuProducts = affectedProducts.map((p) => {
      const sp = Number(p.selling_price || 0);
      const tc = Number(p.total_cost || 0);
      const pct = sp > 0 ? Number(((tc / sp) * 100).toFixed(1)) : 0;
      return {
        id: p.id,
        name: p.name,
        currentFoodCostPct: pct,
      };
    });

    result.push({
      ingredientId: ing.ingredient_id,
      ingredientName: ing.ingredient_name,
      category: ing.category,
      baseUnit: ing.base_unit,
      purchaseUnit: ing.purchase_unit,
      conversionFactor: Number(ing.conversion_factor),
      currentBaseCost,
      currentPurchaseCost,
      previousPurchaseCost,
      latestPurchaseCost,
      averagePurchaseCost,
      priceChangePercentage,
      recipesAffectedCount: affectedMenuProducts.length,
      affectedMenuProducts,
      history: mergedHistory,
    });
  }

  return result;
}

/**
 * 7. Batch recalculate recipe costs across all products based on latest ingredient base costs
 */
export async function recalculateAllRecipes(tenantId: string) {
  const result = await withTransaction(async (client) => {
    // Query all recipes
    const { rows: recipes } = await client.query(
      `SELECT id, product_id, variant_id, COALESCE(packaging_cost, 0) as packaging_cost, COALESCE(additional_cost, 0) as additional_cost
       FROM recipes WHERE tenant_id = $1`,
      [tenantId]
    );

    let updatedCount = 0;
    for (const r of recipes) {
      // Fetch recipe ingredients with latest ingredient base costs
      const { rows: ings } = await client.query(
        `
        SELECT
          ri.id,
          COALESCE(ri.entered_quantity, ri.quantity)::numeric as entered_quantity,
          COALESCE(ri.recipe_unit, ri.unit, i.base_unit, 'G') as recipe_unit,
          COALESCE(i.base_unit, i.unit, 'G') as base_unit,
          COALESCE(i.conversion_factor, 1.0000)::numeric as conversion_factor,
          COALESCE(i.cost_per_unit, 0)::numeric as base_unit_cost
        FROM recipe_ingredients ri
        JOIN ingredients i ON i.id = ri.ingredient_id
        WHERE ri.recipe_id = $1 AND ri.tenant_id = $2
        `,
        [r.id, tenantId]
      );

      let totalRecipeIngredientCost = 0;
      for (const ing of ings) {
        const baseQty = convertRecipeQtyToBase(
          Number(ing.entered_quantity),
          ing.recipe_unit,
          ing.base_unit,
          Number(ing.conversion_factor || 1)
        );
        const lineCost = baseQty * Number(ing.base_unit_cost);
        totalRecipeIngredientCost += lineCost;

        await client.query(
          `
          UPDATE recipe_ingredients
          SET quantity = $1, unit = $2, unit_cost = $3, total_cost = $4
          WHERE id = $5
          `,
          [baseQty, ing.base_unit, ing.base_unit_cost, lineCost, ing.id]
        );
      }

      const totalCost = Number(
        (totalRecipeIngredientCost + Number(r.packaging_cost || 0) + Number(r.additional_cost || 0)).toFixed(4)
      );

      await client.query(
        `UPDATE recipes SET total_cost = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
        [totalCost, r.id]
      );

      // Also update cost_price on product or variant
      if (r.variant_id) {
        await client.query(
          `UPDATE product_variants SET cost_price = $1 WHERE id = $2 AND tenant_id = $3`,
          [totalCost, r.variant_id, tenantId]
        );
      } else {
        await client.query(
          `UPDATE products SET cost_price = $1 WHERE id = $2 AND tenant_id = $3`,
          [totalCost, r.product_id, tenantId]
        );
      }

      updatedCount++;
    }

    return { updatedRecipesCount: updatedCount };
  }, { tenantId });

  return result;
}
