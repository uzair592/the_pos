import { FastifyInstance } from 'fastify';
import { authenticate, requireTenant, requirePermission } from '../middleware/auth.js';
import { Permission } from '@pos/shared';
import {
  getMenuItemProfitability,
  getRecipeCostingBreakdown,
  updateProductDirectCosts,
  getFoodCostAnalysis,
  getTheoreticalVsActual,
  getIngredientPriceHistory,
  recalculateAllRecipes,
} from '../services/costingService.js';

export async function costingRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', authenticate);
  fastify.addHook('preHandler', requireTenant);

  /**
   * 1. Get Menu Item Profitability and Portfolio KPI Summary
   */
  fastify.get('/api/costing/menu-profitability', {
    preHandler: [requirePermission(Permission.MENU_VIEW)],
  }, async (req, reply) => {
    const tenantId = req.user!.tenantId!;
    const { branchId, categoryId, search, sortBy, sortOrder } = req.query as {
      branchId?: string;
      categoryId?: string;
      search?: string;
      sortBy?: string;
      sortOrder?: 'asc' | 'desc';
    };

    const result = await getMenuItemProfitability({
      tenantId,
      branchId,
      categoryId,
      search,
      sortBy,
      sortOrder,
    });

    return reply.send(result);
  });

  /**
   * 2. Get Recipe Costing Breakdown for a specific Product
   */
  fastify.get('/api/costing/recipe/:productId', {
    preHandler: [requirePermission(Permission.MENU_VIEW)],
  }, async (req, reply) => {
    const tenantId = req.user!.tenantId!;
    const { productId } = req.params as { productId: string };
    const { branchId } = req.query as { branchId?: string };

    const result = await getRecipeCostingBreakdown(tenantId, productId, branchId);
    if (!result) {
      return reply.status(404).send({ error: 'Menu item or recipe not found' });
    }

    return reply.send({ item: result });
  });

  /**
   * 3. Update Product Direct Costs (Packaging, Consumables, Target Margin)
   */
  fastify.put('/api/costing/recipe/:productId/direct-costs', {
    preHandler: [requirePermission(Permission.MENU_MANAGE)],
  }, async (req, reply) => {
    const tenantId = req.user!.tenantId!;
    const { productId } = req.params as { productId: string };
    const { packagingCost, additionalCost, targetFoodCostPercentage, basePrice } = req.body as {
      packagingCost?: number;
      additionalCost?: number;
      targetFoodCostPercentage?: number;
      basePrice?: number;
    };

    const updated = await updateProductDirectCosts(tenantId, productId, {
      packagingCost: packagingCost !== undefined ? Number(packagingCost) : undefined,
      additionalCost: additionalCost !== undefined ? Number(additionalCost) : undefined,
      targetFoodCostPercentage: targetFoodCostPercentage !== undefined ? Number(targetFoodCostPercentage) : undefined,
      basePrice: basePrice !== undefined ? Number(basePrice) : undefined,
    });

    return reply.send({ product: updated, message: 'Direct costs updated successfully' });
  });

  /**
   * 4. Food Cost Analysis (Overall, Category-wise, Trends, Top 10, Branch Comparison)
   */
  fastify.get('/api/costing/food-cost-analysis', {
    preHandler: [requirePermission(Permission.REPORTS_FINANCIAL)],
  }, async (req, reply) => {
    const tenantId = req.user!.tenantId!;
    const { branchId, startDate, endDate, groupBy } = req.query as {
      branchId?: string;
      startDate?: string;
      endDate?: string;
      groupBy?: 'day' | 'week' | 'month';
    };

    const analysis = await getFoodCostAnalysis(tenantId, {
      branchId,
      startDate,
      endDate,
      groupBy,
    });

    return reply.send(analysis);
  });

  /**
   * 5. Theoretical vs Actual Food Cost Analysis (Wastage & Variances)
   */
  fastify.get('/api/costing/theoretical-vs-actual', {
    preHandler: [requirePermission(Permission.INVENTORY_VIEW)],
  }, async (req, reply) => {
    const tenantId = req.user!.tenantId!;
    const { branchId, startDate, endDate, ingredientId } = req.query as {
      branchId?: string;
      startDate?: string;
      endDate?: string;
      ingredientId?: string;
    };

    const result = await getTheoreticalVsActual(tenantId, {
      branchId,
      startDate,
      endDate,
      ingredientId,
    });

    return reply.send(result);
  });

  /**
   * 6. Ingredient Price History & Impact Tracking
   */
  fastify.get('/api/costing/ingredient-price-history', {
    preHandler: [requirePermission(Permission.INVENTORY_VIEW)],
  }, async (req, reply) => {
    const tenantId = req.user!.tenantId!;
    const { branchId, ingredientId } = req.query as {
      branchId?: string;
      ingredientId?: string;
    };

    const result = await getIngredientPriceHistory(tenantId, {
      branchId,
      ingredientId,
    });

    return reply.send({ ingredients: result });
  });

  /**
   * 7. Recalculate All Recipes
   */
  fastify.post('/api/costing/recalculate-recipes', {
    preHandler: [requirePermission(Permission.INVENTORY_MANAGE)],
  }, async (req, reply) => {
    const tenantId = req.user!.tenantId!;
    const result = await recalculateAllRecipes(tenantId);
    return reply.send({ message: 'All recipe costs recalculated successfully', ...result });
  });
}

