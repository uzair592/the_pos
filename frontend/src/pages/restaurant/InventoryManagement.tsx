import React, { useEffect, useState } from 'react';
import { api } from '../../api/client.js';
import { useAuth } from '../../context/AuthContext.js';
import { useToast } from '../../context/ToastContext.js';
import { Modal } from '../../components/common/Modal.js';
import {
  Boxes,
  Plus,
  Search,
  AlertTriangle,
  FileText,
  TrendingDown,
  RefreshCw,
  Scale,
  Layers,
  History,
  CheckCircle2,
} from 'lucide-react';
import { StockUnit, StockMovementType } from '@pos/shared';

export const InventoryManagement: React.FC = () => {
  const { tenant } = useAuth();
  const { success, error } = useToast();
  const [ingredients, setIngredients] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [recipes, setRecipes] = useState<any[]>([]);
  const [batches, setBatches] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'STOCK' | 'BATCHES' | 'RECIPES'>('STOCK');
  const [loading, setLoading] = useState(true);

  // Batches filter
  const [batchStatusFilter, setBatchStatusFilter] = useState<'ALL' | 'ACTIVE' | 'EXHAUSTED'>('ACTIVE');
  const [batchIngredientFilter, setBatchIngredientFilter] = useState<string>('');

  // Modals
  const [isAddIngredientOpen, setIsAddIngredientOpen] = useState(false);
  const [isAddRecipeOpen, setIsAddRecipeOpen] = useState(false);
  const [isAdjustmentOpen, setIsAdjustmentOpen] = useState(false);

  // Ingredient Form
  const [ingForm, setIngForm] = useState({
    name: '',
    sku: '',
    unit: StockUnit.KG,
    costPerUnit: 100,
    minStockAlert: 5,
    initialStock: 10,
  });

  // Adjustment Form
  const [adjForm, setAdjForm] = useState({
    ingredientId: '',
    movementType: StockMovementType.ADJUSTMENT_SUBTRACT,
    quantity: 1,
    reason: 'Wastage / Spoilage',
  });

  // Recipe Form
  const [recipeForm, setRecipeForm] = useState({
    productId: '',
    yieldCount: 1,
    ingredients: [{ ingredientId: '', quantity: 1, unit: StockUnit.PCS }],
  });

  const currencySymbol = tenant?.currency_symbol || 'Rs.';

  const fetchData = async () => {
    try {
      const [ingsRes, prodsRes, recipesRes, batchesRes] = await Promise.all([
        api.get('/inventory/ingredients'),
        api.get('/menu/products'),
        api.get('/inventory/recipes'),
        api.get('/inventory/batches'),
      ]);
      setIngredients(ingsRes.ingredients || []);
      setProducts(prodsRes.products || []);
      setRecipes(recipesRes.recipes || []);
      setBatches(batchesRes.batches || []);

      if (ingsRes.ingredients?.length > 0 && !adjForm.ingredientId) {
        setAdjForm((prev) => ({ ...prev, ingredientId: ingsRes.ingredients[0].id }));
      }
      if (prodsRes.products?.length > 0 && !recipeForm.productId) {
        setRecipeForm((prev) => ({ ...prev, productId: prodsRes.products[0].id }));
      }
    } catch (err: any) {
      console.error('Failed to load inventory data:', err);
      error(err.message || 'Failed to load inventory');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreateIngredient = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/inventory/ingredients', {
        name: ingForm.name,
        sku: ingForm.sku.toUpperCase(),
        unit: ingForm.unit,
        costPerUnit: Number(ingForm.costPerUnit),
        minStockAlert: Number(ingForm.minStockAlert),
      });
      success(`Ingredient "${ingForm.name}" created successfully`);
      setIsAddIngredientOpen(false);
      setIngForm({
        name: '',
        sku: '',
        unit: StockUnit.KG,
        costPerUnit: 100,
        minStockAlert: 5,
        initialStock: 10,
      });
      fetchData();
    } catch (err: any) {
      error(err.message || 'Failed to create ingredient');
    }
  };

  const handleStockAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/inventory/adjustments', {
        ingredientId: adjForm.ingredientId,
        movementType: adjForm.movementType,
        quantity: Number(adjForm.quantity),
        reason: adjForm.reason,
      });
      success('Stock adjustment and FIFO batch update recorded');
      setIsAdjustmentOpen(false);
      fetchData();
    } catch (err: any) {
      error(err.message || 'Adjustment failed');
    }
  };

  const handleSaveRecipe = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/inventory/recipes', {
        productId: recipeForm.productId,
        yieldCount: Number(recipeForm.yieldCount),
        ingredients: recipeForm.ingredients.map((i) => ({
          ingredientId: i.ingredientId,
          quantity: Number(i.quantity),
          unit: i.unit,
        })),
      });
      success('Recipe saved successfully');
      setIsAddRecipeOpen(false);
      fetchData();
    } catch (err: any) {
      error(err.message || 'Failed to save recipe');
    }
  };

  // Filtered Batches
  const filteredBatches = batches.filter((b) => {
    if (batchStatusFilter !== 'ALL' && b.status !== batchStatusFilter) return false;
    if (batchIngredientFilter && b.ingredient_id !== batchIngredientFilter) return false;
    return true;
  });

  return (
    <div className="p-6 sm:p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
            Inventory & FIFO Batch Management
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Raw ingredients, strict First-In-First-Out stock lots, recipe yields, and wastage tracking
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setIsAdjustmentOpen(true)}
            className="flex items-center space-x-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 px-3.5 py-2 rounded-xl font-bold text-xs shadow-sm transition-all"
          >
            <TrendingDown className="w-4 h-4 text-amber-600" />
            <span>Stock Adjustment / Wastage</span>
          </button>
          <button
            onClick={() => setIsAddRecipeOpen(true)}
            className="flex items-center space-x-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 px-3.5 py-2 rounded-xl font-bold text-xs shadow-sm transition-all"
          >
            <Scale className="w-4 h-4 text-brand-600" />
            <span>Define Recipe</span>
          </button>
          <button
            onClick={() => setIsAddIngredientOpen(true)}
            className="flex items-center space-x-1.5 bg-brand-500 hover:bg-brand-600 text-white px-4 py-2 rounded-xl font-bold text-xs shadow-md transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Add Ingredient</span>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex space-x-2 border-b border-slate-200 dark:border-slate-800 pb-3 text-xs font-bold overflow-x-auto">
        <button
          onClick={() => setActiveTab('STOCK')}
          className={`px-4 py-2 rounded-xl transition-all shrink-0 ${
            activeTab === 'STOCK'
              ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-md'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          Raw Ingredients & Stock ({ingredients.length})
        </button>
        <button
          onClick={() => setActiveTab('BATCHES')}
          className={`flex items-center space-x-1.5 px-4 py-2 rounded-xl transition-all shrink-0 ${
            activeTab === 'BATCHES'
              ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-md'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Layers className="w-4 h-4 text-brand-500" />
          <span>FIFO Stock Lots / Batches ({batches.length})</span>
        </button>
        <button
          onClick={() => setActiveTab('RECIPES')}
          className={`px-4 py-2 rounded-xl transition-all shrink-0 ${
            activeTab === 'RECIPES'
              ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-md'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          Menu Item Recipes ({recipes.length})
        </button>
      </div>

      {/* Tab: Stock List */}
      {activeTab === 'STOCK' && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 uppercase font-semibold">
                <tr>
                  <th className="px-6 py-3.5">Ingredient Name</th>
                  <th className="px-6 py-3.5">SKU</th>
                  <th className="px-6 py-3.5">Unit</th>
                  <th className="px-6 py-3.5">Total Current Stock</th>
                  <th className="px-6 py-3.5">Active FIFO Batches</th>
                  <th className="px-6 py-3.5">Latest Unit Cost</th>
                  <th className="px-6 py-3.5">Alert Threshold</th>
                  <th className="px-6 py-3.5">Stock Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {ingredients.map((ing) => {
                  const stock = Number(ing.current_stock || 0);
                  const alertThreshold = Number(ing.min_stock_alert || 0);
                  const isLow = stock <= alertThreshold;
                  const activeBatchCount = batches.filter(
                    (b) => b.ingredient_id === ing.id && b.status === 'ACTIVE'
                  ).length;

                  return (
                    <tr key={ing.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="px-6 py-3.5 font-bold text-slate-900 dark:text-white">{ing.name}</td>
                      <td className="px-6 py-3.5 font-mono text-slate-500 dark:text-slate-400">{ing.sku}</td>
                      <td className="px-6 py-3.5 font-semibold text-slate-700 dark:text-slate-300">{ing.unit}</td>
                      <td className="px-6 py-3.5 font-black text-sm text-slate-900 dark:text-white">
                        {stock.toLocaleString()} {ing.unit}
                      </td>
                      <td className="px-6 py-3.5">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                          {activeBatchCount} lot(s) active
                        </span>
                      </td>
                      <td className="px-6 py-3.5 text-slate-700 dark:text-slate-300 font-semibold">
                        {currencySymbol} {Number(ing.cost_per_unit).toLocaleString()}
                      </td>
                      <td className="px-6 py-3.5 text-slate-500">
                        {alertThreshold} {ing.unit}
                      </td>
                      <td className="px-6 py-3.5">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                            isLow
                              ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900'
                              : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300'
                          }`}
                        >
                          {isLow ? 'Low Stock Alert' : 'Healthy'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab: FIFO Batches */}
      {activeTab === 'BATCHES' && (
        <div className="space-y-4">
          {/* Batches Controls */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm text-xs">
            <div className="flex flex-wrap items-center gap-3">
              <span className="font-bold text-slate-700 dark:text-slate-300">Filter By Status:</span>
              <div className="flex space-x-1">
                {(['ALL', 'ACTIVE', 'EXHAUSTED'] as const).map((st) => (
                  <button
                    key={st}
                    onClick={() => setBatchStatusFilter(st)}
                    className={`px-3 py-1 rounded-lg font-bold transition-all ${
                      batchStatusFilter === st
                        ? 'bg-brand-500 text-white shadow-sm'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
                    }`}
                  >
                    {st}
                  </button>
                ))}
              </div>

              <span className="font-bold text-slate-700 dark:text-slate-300 ml-2">Ingredient:</span>
              <select
                value={batchIngredientFilter}
                onChange={(e) => setBatchIngredientFilter(e.target.value)}
                className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1 text-slate-800 dark:text-slate-200"
              >
                <option value="">All Ingredients</option>
                {ingredients.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.name}
                  </option>
                ))}
              </select>
            </div>

            <p className="text-slate-500 dark:text-slate-400 text-[11px]">
              Showing {filteredBatches.length} batch lot(s) (consumed strictly oldest first)
            </p>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 uppercase font-semibold">
                  <tr>
                    <th className="px-5 py-3.5">Batch / Lot ID</th>
                    <th className="px-5 py-3.5">Received Date</th>
                    <th className="px-5 py-3.5">Ingredient</th>
                    <th className="px-5 py-3.5">Branch</th>
                    <th className="px-5 py-3.5 text-right">Qty Received</th>
                    <th className="px-5 py-3.5 text-right">Qty Remaining</th>
                    <th className="px-5 py-3.5 text-right">Lot Unit Cost</th>
                    <th className="px-5 py-3.5 text-right">Remaining Value</th>
                    <th className="px-5 py-3.5 text-center">FIFO Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredBatches.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="px-6 py-10 text-center text-slate-400">
                        No FIFO batches found matching current filters.
                      </td>
                    </tr>
                  ) : (
                    filteredBatches.map((b) => {
                      const remaining = Number(b.quantity_remaining || 0);
                      const unitCost = Number(b.unit_cost || 0);
                      const remainingVal = remaining * unitCost;

                      return (
                        <tr key={b.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
                          <td className="px-5 py-3 font-mono font-bold text-slate-800 dark:text-slate-200">
                            {b.id.substring(0, 8)}...
                          </td>
                          <td className="px-5 py-3 text-slate-600 dark:text-slate-300">
                            {new Date(b.received_at).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </td>
                          <td className="px-5 py-3 font-bold text-slate-900 dark:text-white">
                            {b.ingredient_name}
                          </td>
                          <td className="px-5 py-3 text-slate-600 dark:text-slate-400">{b.branch_name}</td>
                          <td className="px-5 py-3 text-right text-slate-700 dark:text-slate-300">
                            {Number(b.quantity_received).toLocaleString()} {b.ingredient_unit}
                          </td>
                          <td className="px-5 py-3 text-right font-black text-slate-900 dark:text-white">
                            {remaining.toLocaleString()} {b.ingredient_unit}
                          </td>
                          <td className="px-5 py-3 text-right font-bold text-brand-600 dark:text-brand-400">
                            {currencySymbol} {unitCost.toLocaleString()}
                          </td>
                          <td className="px-5 py-3 text-right font-bold text-emerald-600 dark:text-emerald-400">
                            {currencySymbol} {remainingVal.toLocaleString()}
                          </td>
                          <td className="px-5 py-3 text-center">
                            <span
                              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-extrabold ${
                                b.status === 'ACTIVE'
                                  ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                                  : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                              }`}
                            >
                              {b.status}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Tab: Recipes */}
      {activeTab === 'RECIPES' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {recipes.map((r) => (
            <div
              key={r.id}
              className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm space-y-3 text-xs"
            >
              <div className="flex justify-between items-start border-b border-slate-100 dark:border-slate-800 pb-2.5">
                <div>
                  <h4 className="font-extrabold text-slate-900 dark:text-white text-sm">{r.product_name}</h4>
                  <p className="text-slate-500 dark:text-slate-400 text-[11px]">Yield: {r.yield_count} serving(s)</p>
                </div>
                <div className="text-right">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Estimated Recipe Cost</span>
                  <p className="text-sm font-black text-brand-600 dark:text-brand-400">
                    {currencySymbol} {Number(r.total_cost).toLocaleString()}
                  </p>
                </div>
              </div>

              <div className="space-y-1.5">
                <p className="text-[10px] font-bold text-slate-400 uppercase">Consumed Ingredients</p>
                {r.ingredients?.map((ing: any) => (
                  <div
                    key={ing.id}
                    className="flex justify-between items-center text-slate-700 dark:text-slate-300 p-1.5 bg-slate-50 dark:bg-slate-800/60 rounded-lg"
                  >
                    <span>{ing.ingredient_name}</span>
                    <span className="font-semibold">
                      {Number(ing.quantity)} {ing.unit}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal: Add Ingredient */}
      <Modal isOpen={isAddIngredientOpen} onClose={() => setIsAddIngredientOpen(false)} title="Add Raw Ingredient" maxWidth="md">
        <form onSubmit={handleCreateIngredient} className="space-y-4 text-xs">
          <div>
            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Ingredient Name</label>
            <input
              type="text"
              required
              placeholder="e.g. Fresh Tomatoes"
              value={ingForm.name}
              onChange={(e) => setIngForm({ ...ingForm, name: e.target.value })}
              className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-white"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">SKU / Code</label>
              <input
                type="text"
                required
                placeholder="ING-TOM-01"
                value={ingForm.sku}
                onChange={(e) => setIngForm({ ...ingForm, sku: e.target.value })}
                className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs font-mono text-slate-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Measurement Unit</label>
              <select
                value={ingForm.unit}
                onChange={(e) => setIngForm({ ...ingForm, unit: e.target.value as any })}
                className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs font-bold text-slate-900 dark:text-white"
              >
                <option value={StockUnit.KG}>Kilogram (KG)</option>
                <option value={StockUnit.G}>Gram (G)</option>
                <option value={StockUnit.L}>Liter (L)</option>
                <option value={StockUnit.ML}>Milliliter (ML)</option>
                <option value={StockUnit.PCS}>Pieces (PCS)</option>
                <option value={StockUnit.DOZEN}>Dozen</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Unit Cost Price ({currencySymbol})</label>
              <input
                type="number"
                min="0"
                step="0.01"
                required
                value={ingForm.costPerUnit}
                onChange={(e) => setIngForm({ ...ingForm, costPerUnit: parseFloat(e.target.value) || 0 })}
                className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Min Stock Alert</label>
              <input
                type="number"
                min="0"
                required
                value={ingForm.minStockAlert}
                onChange={(e) => setIngForm({ ...ingForm, minStockAlert: parseFloat(e.target.value) || 0 })}
                className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-white"
              />
            </div>
          </div>
          <div className="flex justify-end space-x-2 pt-3 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setIsAddIngredientOpen(false)}
              className="px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-600 dark:text-slate-400"
            >
              Cancel
            </button>
            <button type="submit" className="px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white rounded-lg font-bold">
              Save Ingredient
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal: Define Recipe */}
      <Modal isOpen={isAddRecipeOpen} onClose={() => setIsAddRecipeOpen(false)} title="Define Menu Recipe" maxWidth="lg">
        <form onSubmit={handleSaveRecipe} className="space-y-4 text-xs">
          <div>
            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Menu Product</label>
            <select
              value={recipeForm.productId}
              onChange={(e) => setRecipeForm({ ...recipeForm, productId: e.target.value })}
              className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs font-bold text-slate-900 dark:text-white"
            >
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <label className="font-bold text-slate-800 dark:text-slate-200">Ingredients Consumed per Serving</label>
              <button
                type="button"
                onClick={() =>
                  setRecipeForm({
                    ...recipeForm,
                    ingredients: [
                      ...recipeForm.ingredients,
                      { ingredientId: ingredients[0]?.id || '', quantity: 1, unit: StockUnit.PCS },
                    ],
                  })
                }
                className="text-brand-600 dark:text-brand-400 font-bold hover:underline"
              >
                + Add Ingredient Line
              </button>
            </div>

            {recipeForm.ingredients.map((item, idx) => (
              <div
                key={idx}
                className="flex items-center space-x-2 bg-slate-50 dark:bg-slate-800/60 p-2 rounded-xl border border-slate-200 dark:border-slate-700"
              >
                <select
                  value={item.ingredientId}
                  onChange={(e) => {
                    const next = [...recipeForm.ingredients];
                    const selectedIng = ingredients.find((i) => i.id === e.target.value);
                    next[idx].ingredientId = e.target.value;
                    if (selectedIng) next[idx].unit = selectedIng.unit;
                    setRecipeForm({ ...recipeForm, ingredients: next });
                  }}
                  className="flex-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-2 py-1.5 text-xs text-slate-900 dark:text-white"
                >
                  {ingredients.map((ing) => (
                    <option key={ing.id} value={ing.id}>
                      {ing.name} ({ing.unit})
                    </option>
                  ))}
                </select>

                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  placeholder="Qty"
                  value={item.quantity}
                  onChange={(e) => {
                    const next = [...recipeForm.ingredients];
                    next[idx].quantity = parseFloat(e.target.value) || 0;
                    setRecipeForm({ ...recipeForm, ingredients: next });
                  }}
                  className="w-20 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-2 py-1.5 text-xs text-right text-slate-900 dark:text-white"
                />

                <span className="text-slate-500 font-semibold w-12">{item.unit}</span>

                {recipeForm.ingredients.length > 1 && (
                  <button
                    type="button"
                    onClick={() => {
                      const next = recipeForm.ingredients.filter((_, i) => i !== idx);
                      setRecipeForm({ ...recipeForm, ingredients: next });
                    }}
                    className="text-rose-500 hover:text-rose-700 p-1 font-bold text-sm"
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
          </div>

          <div className="flex justify-end space-x-2 pt-3 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setIsAddRecipeOpen(false)}
              className="px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-600 dark:text-slate-400"
            >
              Cancel
            </button>
            <button type="submit" className="px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white rounded-lg font-bold">
              Save Recipe
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal: Stock Adjustment / Wastage */}
      <Modal
        isOpen={isAdjustmentOpen}
        onClose={() => setIsAdjustmentOpen(false)}
        title="Record Stock Adjustment / Wastage (FIFO)"
        maxWidth="sm"
      >
        <form onSubmit={handleStockAdjustment} className="space-y-4 text-xs">
          <div>
            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Ingredient</label>
            <select
              value={adjForm.ingredientId}
              onChange={(e) => setAdjForm({ ...adjForm, ingredientId: e.target.value })}
              className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-white"
            >
              {ingredients.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name} ({i.unit})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Movement Type</label>
            <select
              value={adjForm.movementType}
              onChange={(e) => setAdjForm({ ...adjForm, movementType: e.target.value as any })}
              className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-white"
            >
              <option value={StockMovementType.WASTAGE}>Wastage / Spoilage / Expired</option>
              <option value={StockMovementType.ADJUSTMENT_SUBTRACT}>Inventory Shrinkage (Subtract)</option>
              <option value={StockMovementType.ADJUSTMENT_ADD}>Stock Recount Surplus (Add)</option>
            </select>
          </div>
          <div>
            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Quantity</label>
            <input
              type="number"
              min="0.1"
              step="0.1"
              required
              value={adjForm.quantity}
              onChange={(e) => setAdjForm({ ...adjForm, quantity: parseFloat(e.target.value) || 0 })}
              className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-white"
            />
          </div>
          <div>
            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Reason / Note</label>
            <input
              type="text"
              required
              value={adjForm.reason}
              onChange={(e) => setAdjForm({ ...adjForm, reason: e.target.value })}
              className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-white"
            />
          </div>
          <button type="submit" className="w-full bg-brand-500 hover:bg-brand-600 text-white font-bold py-2.5 rounded-lg shadow-md transition-all">
            Record Movement
          </button>
        </form>
      </Modal>
    </div>
  );
};
