export type ProfitabilityStatus = 'EXCELLENT' | 'HEALTHY' | 'WARNING' | 'CRITICAL';

export interface RecipeCostIngredientItem {
  ingredientId: string;
  ingredientName: string;
  category?: string;
  enteredQuantity: number;
  recipeUnit: string;
  baseQuantity: number;
  baseUnit: string;
  baseUnitCost: number;
  lineCost: number;
  costPercentage: number;
}

export interface MenuItemProfitabilityItem {
  productId: string;
  variantId?: string | null;
  productName: string;
  variantName?: string | null;
  sku: string;
  categoryId: string;
  categoryName: string;
  station: string;
  sellingPrice: number;
  dineInPrice?: number;
  takeawayPrice?: number;
  deliveryPrice?: number;
  ingredientCost: number;
  packagingCost: number;
  additionalCost: number;
  totalDirectCost: number;
  grossProfit: number;
  foodCostPercentage: number;
  grossProfitMargin: number;
  targetFoodCostPercentage: number;
  status: ProfitabilityStatus;
  hasRecipe: boolean;
  recipeYield: number;
  ingredientCount: number;
  ingredients: RecipeCostIngredientItem[];
}

export interface MenuProfitabilitySummary {
  totalMenuItems: number;
  itemsWithRecipes: number;
  avgFoodCostPercentage: number;
  avgGrossProfit: number;
  totalRecipeCost: number;
  highestFoodCostItem?: {
    name: string;
    foodCostPercentage: number;
    sellingPrice: number;
    directCost: number;
  } | null;
  mostProfitableItem?: {
    name: string;
    grossProfit: number;
    grossProfitMargin: number;
    sellingPrice: number;
  } | null;
}

export interface CategoryFoodCostAnalysis {
  categoryId: string;
  categoryName: string;
  itemCount: number;
  totalSales: number;
  totalCogs: number;
  grossProfit: number;
  foodCostPercentage: number;
  grossProfitMargin: number;
}

export interface FoodCostTrendItem {
  period: string;
  netSales: number;
  cogs: number;
  grossProfit: number;
  foodCostPercentage: number;
  orderCount: number;
}

export interface BranchFoodCostComparison {
  branchId: string;
  branchName: string;
  orderCount: number;
  netSales: number;
  cogs: number;
  grossProfit: number;
  foodCostPercentage: number;
  grossProfitMargin: number;
}

export interface TheoreticalVsActualItem {
  ingredientId: string;
  ingredientName: string;
  category: string;
  baseUnit: string;
  purchaseUnit: string;
  conversionFactor: number;
  costPerBaseUnit: number;
  theoreticalQuantity: number;
  theoreticalCost: number;
  actualQuantity: number;
  actualCost: number;
  batchConsumedQuantity: number;
  wastageQuantity: number;
  adjustmentQuantity: number;
  quantityVariance: number;
  costVariance: number;
  variancePercentage: number;
  status: 'NORMAL' | 'WATCH' | 'INVESTIGATE';
}

export interface IngredientPurchaseHistoryEntry {
  id: string;
  invoiceNumber?: string;
  supplierName?: string;
  date: string;
  purchaseQuantity?: number;
  purchaseUnit?: string;
  purchaseUnitPrice: number;
  baseUnitCost: number;
  sourceType: string;
  notes?: string;
}

export interface IngredientPriceHistoryItem {
  ingredientId: string;
  ingredientName: string;
  category: string;
  baseUnit: string;
  purchaseUnit: string;
  conversionFactor: number;
  currentBaseCost: number;
  currentPurchaseCost: number;
  previousPurchaseCost: number;
  latestPurchaseCost: number;
  averagePurchaseCost: number;
  priceChangePercentage: number;
  recipesAffectedCount: number;
  affectedMenuProducts: {
    id: string;
    name: string;
    currentFoodCostPct: number;
  }[];
  history: IngredientPurchaseHistoryEntry[];
}
