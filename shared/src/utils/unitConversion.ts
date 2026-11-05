/**
 * Automatic Unit of Measurement (UOM) & Recipe Conversion Engine
 * Provides standard dimension compatibility, precision conversions,
 * custom purchase package multipliers, and dual stock display formatting.
 */

export enum MeasurementDimension {
  WEIGHT = 'WEIGHT',
  VOLUME = 'VOLUME',
  COUNT = 'COUNT',
}

export interface UnitDefinition {
  code: string;
  name: string;
  dimension: MeasurementDimension;
  baseUnit: string;
  defaultFactor: number; // Ratio of this unit to its dimension base unit
  symbol: string;
}

export const INGREDIENT_CATEGORIES = [
  'Meat & Poultry',
  'Dairy & Cheese',
  'Produce & Vegetables',
  'Bakery & Grains',
  'Beverages & Syrups',
  'Oils, Fats & Ghee',
  'Spices, Herbs & Seasonings',
  'Sauces & Condiments',
  'Packaging & Disposables',
  'Dry Goods & Pulses',
  'General',
] as const;

export type IngredientCategory = typeof INGREDIENT_CATEGORIES[number];

/**
 * Standard Units Catalog
 */
export const STANDARD_UNITS: Record<string, UnitDefinition> = {
  // --- WEIGHT (Base Unit: G) ---
  KG: {
    code: 'KG',
    name: 'Kilogram',
    dimension: MeasurementDimension.WEIGHT,
    baseUnit: 'G',
    defaultFactor: 1000,
    symbol: 'kg',
  },
  G: {
    code: 'G',
    name: 'Gram',
    dimension: MeasurementDimension.WEIGHT,
    baseUnit: 'G',
    defaultFactor: 1,
    symbol: 'g',
  },
  MG: {
    code: 'MG',
    name: 'Milligram',
    dimension: MeasurementDimension.WEIGHT,
    baseUnit: 'G',
    defaultFactor: 0.001,
    symbol: 'mg',
  },

  // --- VOLUME (Base Unit: ML) ---
  L: {
    code: 'L',
    name: 'Liter',
    dimension: MeasurementDimension.VOLUME,
    baseUnit: 'ML',
    defaultFactor: 1000,
    symbol: 'L',
  },
  ML: {
    code: 'ML',
    name: 'Milliliter',
    dimension: MeasurementDimension.VOLUME,
    baseUnit: 'ML',
    defaultFactor: 1,
    symbol: 'ml',
  },

  // --- COUNT / PACKAGES (Base Unit: PCS) ---
  PCS: {
    code: 'PCS',
    name: 'Piece / Unit',
    dimension: MeasurementDimension.COUNT,
    baseUnit: 'PCS',
    defaultFactor: 1,
    symbol: 'pcs',
  },
  DOZEN: {
    code: 'DOZEN',
    name: 'Dozen (12 pcs)',
    dimension: MeasurementDimension.COUNT,
    baseUnit: 'PCS',
    defaultFactor: 12,
    symbol: 'doz',
  },
  TRAY: {
    code: 'TRAY',
    name: 'Tray (30 pcs)',
    dimension: MeasurementDimension.COUNT,
    baseUnit: 'PCS',
    defaultFactor: 30,
    symbol: 'tray',
  },
  BOX: {
    code: 'BOX',
    name: 'Box',
    dimension: MeasurementDimension.COUNT,
    baseUnit: 'PCS',
    defaultFactor: 10,
    symbol: 'box',
  },
  CARTON: {
    code: 'CARTON',
    name: 'Carton (24 pcs)',
    dimension: MeasurementDimension.COUNT,
    baseUnit: 'PCS',
    defaultFactor: 24,
    symbol: 'ctn',
  },
  PACK: {
    code: 'PACK',
    name: 'Pack / Bundle',
    dimension: MeasurementDimension.COUNT,
    baseUnit: 'PCS',
    defaultFactor: 1,
    symbol: 'pk',
  },
  SACK: {
    code: 'SACK',
    name: 'Sack / Bag (25 kg / custom)',
    dimension: MeasurementDimension.COUNT,
    baseUnit: 'PCS',
    defaultFactor: 1,
    symbol: 'sack',
  },
  BOTTLE: {
    code: 'BOTTLE',
    name: 'Bottle',
    dimension: MeasurementDimension.COUNT,
    baseUnit: 'PCS',
    defaultFactor: 1,
    symbol: 'btl',
  },
  CAN: {
    code: 'CAN',
    name: 'Can / Tin',
    dimension: MeasurementDimension.COUNT,
    baseUnit: 'PCS',
    defaultFactor: 1,
    symbol: 'can',
  },
};

/**
 * Normalizes unit code string to uppercase standard format
 */
export function normalizeUnitCode(rawUnit: string): string {
  if (!rawUnit) return 'G';
  const clean = String(rawUnit).trim().toUpperCase();
  if (clean === 'GRAM' || clean === 'GRAMS') return 'G';
  if (clean === 'KILOGRAM' || clean === 'KILOGRAMS') return 'KG';
  if (clean === 'MILLIGRAM' || clean === 'MILLIGRAMS') return 'MG';
  if (clean === 'LITER' || clean === 'LITERS' || clean === 'LTR' || clean === 'LTRS') return 'L';
  if (clean === 'MILLILITER' || clean === 'MILLILITERS') return 'ML';
  if (clean === 'PIECE' || clean === 'PIECES' || clean === 'UNIT' || clean === 'UNITS') return 'PCS';
  if (clean === 'DOZ') return 'DOZEN';
  return clean;
}

/**
 * Returns measurement dimension for a given unit
 */
export function getUnitDimension(unit: string): MeasurementDimension | null {
  const norm = normalizeUnitCode(unit);
  return STANDARD_UNITS[norm]?.dimension || null;
}

/**
 * Checks whether two units belong to the same dimension and can be converted automatically
 */
export function areUnitsCompatible(unitA: string, unitB: string): boolean {
  const normA = normalizeUnitCode(unitA);
  const normB = normalizeUnitCode(unitB);
  if (normA === normB) return true;

  const dimA = getUnitDimension(normA);
  const dimB = getUnitDimension(normB);
  if (dimA && dimB && dimA === dimB) return true;

  return false;
}

/**
 * Returns available compatible units for a base unit
 */
export function getCompatibleUnits(baseUnit: string): UnitDefinition[] {
  const norm = normalizeUnitCode(baseUnit);
  const dim = getUnitDimension(norm);
  if (!dim) return Object.values(STANDARD_UNITS);

  return Object.values(STANDARD_UNITS).filter((u) => u.dimension === dim);
}

/**
 * Converts a quantity between two units.
 * Supports:
 * 1. Standard intra-dimension conversions (KG <-> G <-> MG, L <-> ML, DOZEN <-> PCS).
 * 2. Ingredient-specific custom conversion factors (e.g., 1 Tray = 30 Eggs, 1 Sack = 25 KG).
 */
export function convertUnitQuantity(
  qty: number,
  fromUnit: string,
  toUnit: string,
  customFactor?: number
): { convertedQty: number; success: boolean; message?: string } {
  const numQty = Number(qty) || 0;
  const normFrom = normalizeUnitCode(fromUnit);
  const normTo = normalizeUnitCode(toUnit);

  if (normFrom === normTo) {
    return { convertedQty: numQty, success: true };
  }

  const defFrom = STANDARD_UNITS[normFrom];
  const defTo = STANDARD_UNITS[normTo];

  // 1. Same dimension standard conversions
  if (defFrom && defTo && defFrom.dimension === defTo.dimension) {
    // Convert from -> dimension base unit -> to
    const qtyInDimensionBase = numQty * defFrom.defaultFactor;
    const targetQty = qtyInDimensionBase / defTo.defaultFactor;
    return {
      convertedQty: Math.round(targetQty * 10000) / 10000,
      success: true,
    };
  }

  // 2. Custom package / ingredient-defined conversion factor
  if (customFactor && customFactor > 0) {
    // If converting from purchase package to base unit
    return {
      convertedQty: Math.round(numQty * customFactor * 10000) / 10000,
      success: true,
    };
  }

  return {
    convertedQty: numQty,
    success: false,
    message: `Cannot automatically convert between incompatible dimensions: ${normFrom} and ${normTo} without an ingredient conversion factor.`,
  };
}

/**
 * Converts a recipe consumption quantity into the ingredient's base unit.
 */
export function convertRecipeQtyToBase(
  enteredQty: number,
  recipeUnit: string,
  baseUnit: string,
  ingredientFactor: number = 1
): number {
  const normRecipe = normalizeUnitCode(recipeUnit);
  const normBase = normalizeUnitCode(baseUnit);

  if (normRecipe === normBase) return Number(enteredQty) || 0;

  const result = convertUnitQuantity(enteredQty, normRecipe, normBase, ingredientFactor);
  return result.convertedQty;
}

/**
 * Converts a purchase quantity into the ingredient's base unit.
 */
export function convertPurchaseQtyToBase(
  purchaseQty: number,
  purchaseUnit: string,
  baseUnit: string,
  conversionFactor: number = 1
): number {
  const normPurchase = normalizeUnitCode(purchaseUnit);
  const normBase = normalizeUnitCode(baseUnit);

  if (normPurchase === normBase) return Number(purchaseQty) || 0;

  // Use custom factor if defined (> 0 and != 1)
  if (conversionFactor && conversionFactor > 0 && conversionFactor !== 1) {
    return Math.round(Number(purchaseQty) * conversionFactor * 10000) / 10000;
  }

  // Fallback to standard conversion
  const result = convertUnitQuantity(purchaseQty, normPurchase, normBase, conversionFactor);
  return result.convertedQty;
}

/**
 * Computes base unit cost from purchase price and conversion factor
 */
export function calculateBaseUnitCost(purchaseCost: number, conversionFactor: number): number {
  const cost = Number(purchaseCost) || 0;
  const factor = Number(conversionFactor) || 1;
  if (factor <= 0) return cost;
  return Math.round((cost / factor) * 10000) / 10000;
}

/**
 * Formats inventory stock into human-readable dual representation.
 * Example: 4,850 G (base) with purchase unit KG (factor 1000) -> "4.85 KG (4,850 g)"
 */
export function formatDisplayStock(
  baseQty: number,
  baseUnit: string,
  purchaseUnit?: string,
  conversionFactor?: number
): string {
  const num = Number(baseQty) || 0;
  const normBase = normalizeUnitCode(baseUnit);
  const normPurchase = purchaseUnit ? normalizeUnitCode(purchaseUnit) : null;
  const factor = Number(conversionFactor) || (normPurchase && STANDARD_UNITS[normPurchase] ? STANDARD_UNITS[normPurchase].defaultFactor : 1);

  if (!normPurchase || normPurchase === normBase || factor <= 1) {
    return `${num.toLocaleString(undefined, { maximumFractionDigits: 2 })} ${normBase}`;
  }

  const purchaseEquivalent = num / factor;
  return `${purchaseEquivalent.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${normPurchase} (${num.toLocaleString(undefined, { maximumFractionDigits: 2 })} ${normBase})`;
}
