import { Link } from 'react-router-dom';
import React, { useEffect, useState } from 'react';
import { api } from '../../api/client.js';
import { useAuth } from '../../context/AuthContext.js';
import { useToast } from '../../context/ToastContext.js';
import { Modal } from '../../components/common/Modal.js';
import { ActionMenu } from '../../components/common/ActionMenu.js';
import {
  Boxes,
  Edit2,
  Trash2,
  Eye,
  Printer,
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
  ArrowRightLeft,
  Truck,
  Building2,
  Clock,
  ArrowRight,
  Send,
  Download,
} from 'lucide-react';
import {
  StockUnit,
  StockMovementType,
  INGREDIENT_CATEGORIES,
  STANDARD_UNITS,
  getCompatibleUnits,
  convertRecipeQtyToBase,
  calculateBaseUnitCost,
  formatDisplayStock,
} from '@pos/shared';

export const InventoryManagement: React.FC = () => {
  const { tenant, branches, currentBranchId } = useAuth();
  const { success, error } = useToast();
  const [ingredients, setIngredients] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [recipes, setRecipes] = useState<any[]>([]);
  const [batches, setBatches] = useState<any[]>([]);
  const [transfers, setTransfers] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'STOCK' | 'BATCHES' | 'RECIPES' | 'TRANSFERS'>('STOCK');
  const [loading, setLoading] = useState(true);

  // Batches filter
  const [batchStatusFilter, setBatchStatusFilter] = useState<'ALL' | 'ACTIVE' | 'EXHAUSTED'>('ACTIVE');
  const [batchIngredientFilter, setBatchIngredientFilter] = useState<string>('');

  // Transfer filter
  const [transferStatusFilter, setTransferStatusFilter] = useState<'ALL' | 'PENDING' | 'DISPATCHED' | 'RECEIVED'>('ALL');

  // Modals
  const [isAddIngredientOpen, setIsAddIngredientOpen] = useState(false);
  const [isEditIngredientOpen, setIsEditIngredientOpen] = useState(false);
  const [isAddRecipeOpen, setIsAddRecipeOpen] = useState(false);
  const [isAdjustmentOpen, setIsAdjustmentOpen] = useState(false);
  const [isAddTransferOpen, setIsAddTransferOpen] = useState(false);

  // Stock filters
  const [stockSearchTerm, setStockSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');

  // Edit Ingredient Form
  const [editIngForm, setEditIngForm] = useState({
    id: '',
    name: '',
    nameUrdu: '',
    category: 'Meat & Poultry',
    sku: '',
    baseUnit: 'G',
    purchaseUnit: 'KG',
    conversionFactor: 1000,
    purchaseCost: 1000,
    costPerUnit: 1,
    minStockAlert: 500,
  });

  // Ingredient Form
  const [ingForm, setIngForm] = useState({
    name: '',
    nameUrdu: '',
    category: 'Meat & Poultry',
    sku: '',
    baseUnit: 'G',
    purchaseUnit: 'KG',
    conversionFactor: 1000,
    purchaseCost: 1000,
    costPerUnit: 1,
    minStockAlert: 500,
    initialStock: 5000,
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
    ingredients: [{ ingredientId: '', quantity: 1, enteredQuantity: 1, recipeUnit: 'G', unit: 'G' }],
  });

  // Transfer Form
  const [transferForm, setTransferForm] = useState({
    fromBranchId: '',
    toBranchId: '',
    ingredientId: '',
    quantity: 1,
    notes: '',
  });

  const currencySymbol = tenant?.currency_symbol || 'Rs.';

  const fetchData = async () => {
    try {
      const branchParam = currentBranchId ? `?branchId=${currentBranchId}` : '';
      const [ingsRes, prodsRes, recipesRes, batchesRes, transfersRes] = await Promise.all([
        api.get(`/inventory/ingredients${branchParam}`),
        api.get('/menu/products'),
        api.get('/inventory/recipes'),
        api.get(`/inventory/batches${branchParam}`),
        api.get(`/inventory/transfers${branchParam}`),
      ]);
      setIngredients(ingsRes.ingredients || []);
      setProducts(prodsRes.products || []);
      setRecipes(recipesRes.recipes || []);
      setBatches(batchesRes.batches || []);
      setTransfers(transfersRes.transfers || []);

      if (ingsRes.ingredients?.length > 0 && !adjForm.ingredientId) {
        setAdjForm((prev) => ({ ...prev, ingredientId: ingsRes.ingredients[0].id }));
      }
      if (prodsRes.products?.length > 0 && !recipeForm.productId) {
        setRecipeForm((prev) => ({ ...prev, productId: prodsRes.products[0].id }));
      }
      if (branches?.length >= 2 && !transferForm.fromBranchId) {
        setTransferForm((prev) => ({
          ...prev,
          fromBranchId: branches[0].id,
          toBranchId: branches[1].id,
          ingredientId: ingsRes.ingredients?.[0]?.id || '',
        }));
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
  }, [currentBranchId]);

  const handleCreateIngredient = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const factor = Number(ingForm.conversionFactor) > 0 ? Number(ingForm.conversionFactor) : 1;
      const pCost = Number(ingForm.purchaseCost) >= 0 ? Number(ingForm.purchaseCost) : 0;
      const bCost = calculateBaseUnitCost(pCost, factor);

      await api.post('/inventory/ingredients', {
        name: ingForm.name,
        nameUrdu: ingForm.nameUrdu || undefined,
        category: ingForm.category || 'General',
        sku: ingForm.sku,
        baseUnit: ingForm.baseUnit,
        purchaseUnit: ingForm.purchaseUnit,
        conversionFactor: factor,
        purchaseCost: pCost,
        costPerUnit: bCost,
        minStockAlert: Number(ingForm.minStockAlert) || 0,
        initialStock: Number(ingForm.initialStock) || 0,
        branchId: currentBranchId || undefined,
      });
      success('Ingredient registered with automatic unit conversion and FIFO batch!');
      setIsAddIngredientOpen(false);
      setIngForm({
        name: '',
        nameUrdu: '',
        category: 'Meat & Poultry',
        sku: '',
        baseUnit: 'G',
        purchaseUnit: 'KG',
        conversionFactor: 1000,
        purchaseCost: 1000,
        costPerUnit: 1,
        minStockAlert: 500,
        initialStock: 5000,
      });
      fetchData();
    } catch (err: any) {
      error(err.message || 'Failed to create ingredient');
    }
  };

  const handleUpdateIngredient = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const factor = Number(editIngForm.conversionFactor) > 0 ? Number(editIngForm.conversionFactor) : 1;
      const pCost = Number(editIngForm.purchaseCost) >= 0 ? Number(editIngForm.purchaseCost) : 0;
      const bCost = calculateBaseUnitCost(pCost, factor);

      await api.put(`/inventory/ingredients/${editIngForm.id}`, {
        name: editIngForm.name,
        nameUrdu: editIngForm.nameUrdu || undefined,
        category: editIngForm.category || 'General',
        sku: editIngForm.sku,
        baseUnit: editIngForm.baseUnit,
        purchaseUnit: editIngForm.purchaseUnit,
        conversionFactor: factor,
        purchaseCost: pCost,
        costPerUnit: bCost,
        minStockAlert: Number(editIngForm.minStockAlert) || 0,
      });
      setIsEditIngredientOpen(false);
      success('Ingredient updated successfully');
      fetchData();
    } catch (err: any) {
      error(err.message || 'Failed to update ingredient');
    }
  };

  const handleDeleteIngredient = async (id: string, name: string) => {
    if (!window.confirm(`Are you sure you want to delete ingredient "${name}"? This will delete stock associations.`)) {
      return;
    }
    try {
      await api.delete(`/inventory/ingredients/${id}`);
      success(`Ingredient "${name}" deleted successfully`);
      fetchData();
    } catch (err: any) {
      error(err.message || 'Failed to delete ingredient');
    }
  };

  const handleDeleteRecipe = async (id: string, productName: string) => {
    if (!window.confirm(`Are you sure you want to delete the recipe for "${productName}"?`)) {
      return;
    }
    try {
      await api.delete(`/inventory/recipes/${id}`);
      success(`Recipe for "${productName}" deleted successfully`);
      fetchData();
    } catch (err: any) {
      error(err.message || 'Failed to delete recipe');
    }
  };

  const handleDeleteTransfer = async (id: string, transferNum: string) => {
    if (!window.confirm(`Are you sure you want to cancel and delete pending transfer "${transferNum}"?`)) {
      return;
    }
    try {
      await api.delete(`/inventory/transfers/${id}`);
      success(`Transfer "${transferNum}" cancelled successfully`);
      fetchData();
    } catch (err: any) {
      error(err.message || 'Failed to delete transfer');
    }
  };

  const handleStockAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/inventory/adjustments', {
        ...adjForm,
        branchId: currentBranchId || undefined,
      });
      success('Stock movement logged & FIFO batches adjusted!');
      setIsAdjustmentOpen(false);
      fetchData();
    } catch (err: any) {
      error(err.message || 'Failed to log adjustment');
    }
  };

  const handleCreateRecipe = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const processedItems = recipeForm.ingredients.map((it) => {
        const ing = ingredients.find((i) => i.id === it.ingredientId);
        const baseU = ing ? (ing.base_unit || ing.unit || 'G') : (it.unit || 'G');
        const rUnit = it.recipeUnit || baseU;
        const enteredQ = Number(it.enteredQuantity || it.quantity) || 0;
        const factor = Number(ing?.conversion_factor || 1);
        const baseQ = convertRecipeQtyToBase(enteredQ, rUnit, baseU, factor);

        return {
          ingredientId: it.ingredientId,
          quantity: baseQ,
          unit: baseU,
          enteredQuantity: enteredQ,
          recipeUnit: rUnit,
        };
      });

      await api.post('/inventory/recipes', {
        productId: recipeForm.productId,
        yieldCount: Number(recipeForm.yieldCount) || 1,
        ingredients: processedItems,
      });
      success('Recipe saved for automatic FIFO stock deduction!');
      setIsAddRecipeOpen(false);
      fetchData();
    } catch (err: any) {
      error(err.message || 'Failed to save recipe');
    }
  };

  // Inter-Branch Stock Transfers Handlers
  const handleCreateTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!transferForm.fromBranchId || !transferForm.toBranchId) {
      error('Please select both origin and destination branches');
      return;
    }
    if (transferForm.fromBranchId === transferForm.toBranchId) {
      error('Origin and destination branches must be different');
      return;
    }
    try {
      await api.post('/inventory/transfers', transferForm);
      success('Stock transfer initiated!');
      setIsAddTransferOpen(false);
      fetchData();
    } catch (err: any) {
      error(err.message || 'Failed to initiate transfer');
    }
  };

  const handleDispatchTransfer = async (transferId: string) => {
    try {
      await api.put(`/inventory/transfers/${transferId}/dispatch`, {});
      success('Stock transfer dispatched! Stock deducted from origin branch.');
      fetchData();
    } catch (err: any) {
      error(err.message || 'Failed to dispatch transfer');
    }
  };

  const handleReceiveTransfer = async (transferId: string) => {
    try {
      await api.put(`/inventory/transfers/${transferId}/receive`, {});
      success('Transfer received into destination branch! New FIFO batch activated.');
      fetchData();
    } catch (err: any) {
      error(err.message || 'Failed to receive transfer');
    }
  };

  const filteredBatches = batches.filter((b) => {
    const matchesStatus =
      batchStatusFilter === 'ALL' ? true : b.status === batchStatusFilter;
    const matchesIng = batchIngredientFilter
      ? b.ingredient_id === batchIngredientFilter
      : true;
    return matchesStatus && matchesIng;
  });

  const filteredTransfers = transfers.filter((t) => {
    if (transferStatusFilter === 'ALL') return true;
    return t.status === transferStatusFilter;
  });

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[400px]">
        <div className="w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="p-6 sm:p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
            Inventory & FIFO Engine
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Batch-tracked First-In, First-Out costing, recipes, and inventory valuation
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => setIsAdjustmentOpen(true)}
            className="flex items-center space-x-1.5 px-3.5 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold shadow-sm hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
          >
            <TrendingDown className="w-4 h-4 text-rose-500" />
            <span>Wastage / Adjustment</span>
          </button>

          <Link
            to="/app/purchases"
            className="flex items-center space-x-1.5 px-3.5 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold shadow-sm hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
          >
            <Truck className="w-4 h-4 text-emerald-500" />
            <span>Purchases & Vendors</span>
          </Link>

          {branches.length > 1 && (
            <button
              onClick={() => setIsAddTransferOpen(true)}
              className="flex items-center space-x-1.5 px-3.5 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold shadow-sm hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
            >
              <ArrowRightLeft className="w-4 h-4 text-blue-500" />
              <span>New Stock Transfer</span>
            </button>
          )}

          <button
            onClick={() => setIsAddRecipeOpen(true)}
            className="flex items-center space-x-1.5 px-3.5 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold shadow-sm hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
          >
            <Scale className="w-4 h-4 text-amber-500" />
            <span>Create Recipe</span>
          </button>

          <button
            onClick={() => setIsAddIngredientOpen(true)}
            className="flex items-center space-x-1.5 px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white rounded-xl text-xs font-bold shadow-md transition-all"
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
        {branches.length > 1 && (
          <button
            onClick={() => setActiveTab('TRANSFERS')}
            className={`flex items-center space-x-1.5 px-4 py-2 rounded-xl transition-all shrink-0 ${
              activeTab === 'TRANSFERS'
                ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-md'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <Truck className="w-4 h-4 text-blue-500" />
            <span>Stock Transfers ({transfers.length})</span>
          </button>
        )}
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
        <div className="space-y-4">
          {/* Search & Category Filter Bar */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm space-y-3">
            <div className="flex flex-col md:flex-row gap-3 items-center justify-between">
              <div className="relative w-full md:w-96">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={stockSearchTerm}
                  onChange={(e) => setStockSearchTerm(e.target.value)}
                  placeholder="Search raw ingredient name, SKU, or category..."
                  className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>

              <div className="flex items-center space-x-2 text-xs font-semibold text-slate-500">
                <span>Total Items:</span>
                <span className="font-bold text-slate-900 dark:text-white">
                  {ingredients.filter((ing) => {
                    const q = stockSearchTerm.toLowerCase().trim();
                    const matchesSearch =
                      !q ||
                      ing.name?.toLowerCase().includes(q) ||
                      ing.sku?.toLowerCase().includes(q) ||
                      ing.category?.toLowerCase().includes(q);
                    const matchesCat =
                      selectedCategory === 'ALL' || (ing.category || 'General') === selectedCategory;
                    return matchesSearch && matchesCat;
                  }).length} of {ingredients.length}
                </span>
              </div>
            </div>

            {/* Category Pills */}
            <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 text-xs">
              <button
                type="button"
                onClick={() => setSelectedCategory('ALL')}
                className={`px-3 py-1.5 rounded-lg font-bold shrink-0 transition-all ${
                  selectedCategory === 'ALL'
                    ? 'bg-brand-500 text-white shadow-sm'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                All Categories
              </button>
              {INGREDIENT_CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3 py-1.5 rounded-lg font-bold shrink-0 transition-all ${
                    selectedCategory === cat
                      ? 'bg-brand-500 text-white shadow-sm'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 uppercase font-semibold">
                  <tr>
                    <th className="px-6 py-3.5">Raw Ingredient</th>
                    <th className="px-6 py-3.5">SKU</th>
                    <th className="px-6 py-3.5">UOM & Ratio</th>
                    <th className="px-6 py-3.5">Available Stock (Dual Display)</th>
                    <th className="px-6 py-3.5">Active FIFO Lots</th>
                    <th className="px-6 py-3.5">Unit Valuation</th>
                    <th className="px-6 py-3.5">Alert Level</th>
                    <th className="px-6 py-3.5">Stock Status</th>
                    <th className="px-6 py-3.5 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {ingredients
                    .filter((ing) => {
                      const q = stockSearchTerm.toLowerCase().trim();
                      const matchesSearch =
                        !q ||
                        ing.name?.toLowerCase().includes(q) ||
                        ing.sku?.toLowerCase().includes(q) ||
                        ing.category?.toLowerCase().includes(q);
                      const matchesCat =
                        selectedCategory === 'ALL' || (ing.category || 'General') === selectedCategory;
                      return matchesSearch && matchesCat;
                    })
                    .map((ing) => {
                      const stock = Number(ing.current_stock || 0);
                      const alertThreshold = Number(ing.min_stock_alert || 0);
                      const isLow = stock <= alertThreshold;
                      const activeBatchCount = batches.filter(
                        (b) => b.ingredient_id === ing.id && b.status === 'ACTIVE'
                      ).length;
                      const baseU = ing.base_unit || ing.unit || 'G';
                      const purchaseU = ing.purchase_unit || ing.unit || 'KG';
                      const factor = Number(ing.conversion_factor || 1);
                      const displayStr =
                        ing.display_stock || formatDisplayStock(stock, baseU, purchaseU, factor);

                      return (
                        <tr key={ing.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
                          <td className="px-6 py-3.5">
                            <span className="font-bold text-slate-900 dark:text-white block text-sm">
                              {ing.name}
                            </span>
                            <span className="inline-block mt-0.5 px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                              {ing.category || 'General'}
                            </span>
                          </td>
                          <td className="px-6 py-3.5 font-mono text-slate-500 dark:text-slate-400 font-semibold">
                            {ing.sku}
                          </td>
                          <td className="px-6 py-3.5">
                            <span className="font-extrabold text-slate-800 dark:text-slate-200">
                              {baseU}
                            </span>
                            <span className="text-[10px] text-slate-400 block">
                              Base Unit
                            </span>
                            {purchaseU !== baseU && factor > 1 && (
                              <span className="inline-block text-[10px] text-brand-600 dark:text-brand-400 font-bold bg-brand-50 dark:bg-brand-950/40 px-1.5 py-0.5 rounded mt-0.5">
                                1 {purchaseU} = {factor.toLocaleString()} {baseU}
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-3.5">
                            <span className="font-black text-sm text-slate-900 dark:text-white block font-mono">
                              {displayStr}
                            </span>
                            <span className="text-[10px] text-slate-400 font-mono">
                              ({stock.toLocaleString()} {baseU} in base inventory)
                            </span>
                          </td>
                          <td className="px-6 py-3.5">
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                              {activeBatchCount} lot(s) active
                            </span>
                          </td>
                          <td className="px-6 py-3.5 text-slate-700 dark:text-slate-300 font-mono">
                            <div className="font-bold">
                              {currencySymbol} {Number(ing.cost_per_unit || 0).toFixed(4)} / {baseU}
                            </div>
                            {Number(ing.purchase_cost) > 0 && purchaseU !== baseU && (
                              <div className="text-[10px] text-slate-400">
                                {currencySymbol} {Number(ing.purchase_cost || 0).toLocaleString()} / {purchaseU}
                              </div>
                            )}
                          </td>
                          <td className="px-6 py-3.5 font-mono text-slate-500">
                            {alertThreshold.toLocaleString()} {baseU}
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
                          <td className="px-6 py-3.5 text-center whitespace-nowrap">
                            <ActionMenu
                              items={[
                                {
                                  label: 'Adjust Stock / Write-off',
                                  icon: Scale,
                                  onClick: () => {
                                    setAdjForm((prev) => ({
                                      ...prev,
                                      ingredientId: ing.id,
                                    }));
                                    setIsAdjustmentOpen(true);
                                  },
                                },
                                {
                                  label: 'Edit Ingredient',
                                  icon: Edit2,
                                  onClick: () => {
                                    setEditIngForm({
                                      id: ing.id,
                                      name: ing.name,
                                      nameUrdu: ing.name_urdu || '',
                                      category: ing.category || 'General',
                                      sku: ing.sku,
                                      baseUnit: ing.base_unit || ing.unit || 'G',
                                      purchaseUnit: ing.purchase_unit || ing.unit || 'KG',
                                      conversionFactor: Number(ing.conversion_factor || 1),
                                      purchaseCost: Number(ing.purchase_cost || ing.cost_per_unit || 0),
                                      costPerUnit: Number(ing.cost_per_unit || 0),
                                      minStockAlert: Number(ing.min_stock_alert || 5),
                                    });
                                    setIsEditIngredientOpen(true);
                                  },
                                },
                                {
                                  label: 'View FIFO Batches',
                                  icon: Layers,
                                  onClick: () => {
                                    setBatchIngredientFilter(ing.id);
                                    setActiveTab('BATCHES');
                                  },
                                },
                                {
                                  label: 'Delete Ingredient',
                                  icon: Trash2,
                                  variant: 'danger',
                                  divider: true,
                                  onClick: () => handleDeleteIngredient(ing.id, ing.name),
                                },
                              ]}
                            />
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Tab: FIFO Batches */}
      {activeTab === 'BATCHES' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800">
            <div className="flex items-center space-x-2">
              <span className="text-xs font-semibold text-slate-500">Filter Status:</span>
              {(['ACTIVE', 'EXHAUSTED', 'ALL'] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setBatchStatusFilter(s)}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                    batchStatusFilter === s
                      ? 'bg-brand-500 text-white'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>

            <div className="flex items-center space-x-2">
              <span className="text-xs font-semibold text-slate-500">Ingredient:</span>
              <select
                value={batchIngredientFilter}
                onChange={(e) => setBatchIngredientFilter(e.target.value)}
                className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1 text-xs text-slate-900 dark:text-white"
              >
                <option value="">All Ingredients</option>
                {ingredients.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 uppercase font-semibold">
                  <tr>
                    <th className="px-6 py-3.5">Batch Received Date</th>
                    <th className="px-6 py-3.5">Ingredient</th>
                    <th className="px-6 py-3.5">Branch</th>
                    <th className="px-6 py-3.5">Initial Received</th>
                    <th className="px-6 py-3.5">Remaining Stock</th>
                    <th className="px-6 py-3.5">Batch Unit Cost</th>
                    <th className="px-6 py-3.5">Remaining Value</th>
                    <th className="px-6 py-3.5">FIFO Priority</th>
                    <th className="px-6 py-3.5">Status</th>
                    <th className="px-6 py-3.5 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredBatches.map((b, idx) => {
                    const remainingVal = Number(b.quantity_remaining) * Number(b.unit_cost);
                    const isActive = b.status === 'ACTIVE';

                    return (
                      <tr key={b.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
                        <td className="px-6 py-3.5 font-mono text-slate-500 dark:text-slate-400">
                          {new Date(b.received_at).toLocaleDateString()} {new Date(b.received_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td className="px-6 py-3.5 font-bold text-slate-900 dark:text-white">
                          {b.ingredient_name}
                        </td>
                        <td className="px-6 py-3.5 font-semibold text-slate-600 dark:text-slate-300">
                          {b.branch_name || 'Main Branch'}
                        </td>
                        <td className="px-6 py-3.5 text-slate-700 dark:text-slate-300 font-medium">
                          {Number(b.quantity_received).toLocaleString()} {b.unit}
                        </td>
                        <td className="px-6 py-3.5 font-black text-slate-900 dark:text-white">
                          {Number(b.quantity_remaining).toLocaleString()} {b.unit}
                        </td>
                        <td className="px-6 py-3.5 font-semibold text-slate-700 dark:text-slate-300">
                          {currencySymbol} {Number(b.unit_cost).toLocaleString()}
                        </td>
                        <td className="px-6 py-3.5 font-bold text-brand-600 dark:text-brand-400">
                          {currencySymbol} {remainingVal.toLocaleString()}
                        </td>
                        <td className="px-6 py-3.5">
                          {isActive ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-900">
                              FIFO Consume Next
                            </span>
                          ) : (
                            <span className="text-slate-400 text-[11px] font-medium italic">Fully Depleted</span>
                          )}
                        </td>
                        <td className="px-6 py-3.5">
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                              isActive
                                ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                            }`}
                          >
                            {b.status}
                          </span>
                        </td>
                        <td className="px-6 py-3.5 text-center whitespace-nowrap">
                          <ActionMenu
                            items={[
                              {
                                label: 'Waste / Adjust Stock',
                                icon: Scale,
                                onClick: () => {
                                  setAdjForm((prev) => ({
                                    ...prev,
                                    ingredientId: b.ingredient_id,
                                    movementType: StockMovementType.WASTAGE,
                                  }));
                                  setIsAdjustmentOpen(true);
                                },
                              },
                              {
                                label: 'Filter Stock by Item',
                                icon: Eye,
                                onClick: () => {
                                  setBatchIngredientFilter(b.ingredient_id);
                                },
                              },
                            ]}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Tab: Inter-Branch Stock Transfers */}
      {activeTab === 'TRANSFERS' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800">
            <div className="flex items-center space-x-2">
              <span className="text-xs font-semibold text-slate-500">Filter Transfer Status:</span>
              {(['ALL', 'PENDING', 'DISPATCHED', 'RECEIVED'] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setTransferStatusFilter(s)}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                    transferStatusFilter === s
                      ? 'bg-brand-500 text-white'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>

            <button
              onClick={() => setIsAddTransferOpen(true)}
              className="flex items-center space-x-1.5 px-3.5 py-1.5 bg-brand-500 hover:bg-brand-600 text-white rounded-xl text-xs font-bold shadow-sm transition-all"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Initiate Stock Transfer</span>
            </button>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 uppercase font-semibold">
                  <tr>
                    <th className="px-6 py-3.5">Transfer Number</th>
                    <th className="px-6 py-3.5">Origin Branch</th>
                    <th className="px-6 py-3.5">Destination Branch</th>
                    <th className="px-6 py-3.5">Item & Qty</th>
                    <th className="px-6 py-3.5">Valuation</th>
                    <th className="px-6 py-3.5">Initiated By</th>
                    <th className="px-6 py-3.5">Status</th>
                    <th className="px-6 py-3.5 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredTransfers.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-slate-400 italic">
                        No inter-branch transfers found matching the filter
                      </td>
                    </tr>
                  ) : (
                    filteredTransfers.map((t) => {
                      const isPending = t.status === 'PENDING';
                      const isDispatched = t.status === 'DISPATCHED';
                      const isReceived = t.status === 'RECEIVED';

                      return (
                        <tr key={t.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
                          <td className="px-6 py-3.5 font-mono font-bold text-slate-900 dark:text-white">
                            {t.transfer_number}
                          </td>
                          <td className="px-6 py-3.5 font-medium text-slate-700 dark:text-slate-300">
                            <span className="flex items-center space-x-1">
                              <Building2 className="w-3.5 h-3.5 text-slate-400" />
                              <span>{t.from_branch_name}</span>
                            </span>
                          </td>
                          <td className="px-6 py-3.5 font-bold text-slate-900 dark:text-white">
                            <span className="flex items-center space-x-1">
                              <ArrowRight className="w-3.5 h-3.5 text-brand-500" />
                              <span>{t.to_branch_name}</span>
                            </span>
                          </td>
                          <td className="px-6 py-3.5">
                            <p className="font-bold text-slate-900 dark:text-white">{t.item_name}</p>
                            <p className="text-[11px] text-slate-400">
                              {Number(t.quantity).toLocaleString()} {t.unit}
                            </p>
                          </td>
                          <td className="px-6 py-3.5 font-bold text-slate-900 dark:text-white">
                            {currencySymbol} {Number(t.total_cost).toLocaleString()}
                          </td>
                          <td className="px-6 py-3.5 text-slate-500">
                            <p className="font-medium text-slate-700 dark:text-slate-300">{t.requested_by_name || 'Staff'}</p>
                            <p className="text-[10px]">{new Date(t.created_at).toLocaleDateString()}</p>
                          </td>
                          <td className="px-6 py-3.5">
                            <span
                              className={`inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                                isPending
                                  ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200'
                                  : isDispatched
                                  ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 animate-pulse'
                                  : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200'
                              }`}
                            >
                              {isPending && <Clock className="w-3 h-3 mr-1" />}
                              {isDispatched && <Truck className="w-3 h-3 mr-1" />}
                              {isReceived && <CheckCircle2 className="w-3 h-3 mr-1" />}
                              <span>{t.status}</span>
                            </span>
                          </td>
                          <td className="px-6 py-3.5 text-center whitespace-nowrap">
                            <ActionMenu
                              items={[
                                isPending && {
                                  label: 'Dispatch Stock',
                                  icon: Send,
                                  variant: 'success',
                                  onClick: () => handleDispatchTransfer(t.id),
                                },
                                isDispatched && {
                                  label: 'Receive into Stock',
                                  icon: Download,
                                  variant: 'success',
                                  onClick: () => handleReceiveTransfer(t.id),
                                },
                                isPending && {
                                  label: 'Cancel & Delete Transfer',
                                  icon: Trash2,
                                  variant: 'danger',
                                  divider: true,
                                  onClick: () => handleDeleteTransfer(t.id, t.transfer_number),
                                },
                              ]}
                            />
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
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Active Product Recipes</h3>
            <button
              onClick={() => setIsAddRecipeOpen(true)}
              className="flex items-center space-x-1.5 px-3 py-1.5 bg-brand-500 hover:bg-brand-600 text-white rounded-lg text-xs font-bold"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New Recipe</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {recipes.map((r) => (
              <div key={r.id} className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <h4 className="font-bold text-slate-900 dark:text-white text-xs">{r.product_name}</h4>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-brand-500/10 text-brand-500 font-bold inline-block mt-0.5">
                      Yield: {r.yield_count}
                    </span>
                  </div>
                  <ActionMenu
                    items={[
                      {
                        label: 'Delete Recipe',
                        icon: Trash2,
                        variant: 'danger',
                        onClick: () => handleDeleteRecipe(r.id, r.product_name),
                      },
                    ]}
                  />
                </div>
                <div className="space-y-1 text-[11px] text-slate-500 dark:text-slate-400">
                  {r.items?.map((item: any, idx: number) => (
                    <div key={idx} className="flex justify-between">
                      <span>{item.ingredient_name}</span>
                      <span className="font-bold text-slate-700 dark:text-slate-300">
                        {item.quantity} {item.unit}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal: Add Ingredient */}
      <Modal isOpen={isAddIngredientOpen} onClose={() => setIsAddIngredientOpen(false)} title="Register Raw Ingredient (UOM & Conversion)" maxWidth="lg">
        <form onSubmit={handleCreateIngredient} className="space-y-4 text-xs">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Ingredient Name *</label>
              <input
                type="text"
                required
                value={ingForm.name}
                onChange={(e) => setIngForm({ ...ingForm, name: e.target.value })}
                placeholder="e.g. Chicken Boneless, Cooking Oil, Eggs"
                className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Category *</label>
              <select
                value={ingForm.category}
                onChange={(e) => setIngForm({ ...ingForm, category: e.target.value })}
                className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-white"
              >
                {INGREDIENT_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">SKU / Code *</label>
              <input
                type="text"
                required
                value={ingForm.sku}
                onChange={(e) => setIngForm({ ...ingForm, sku: e.target.value })}
                placeholder="ING-CHK-01"
                className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-white uppercase"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Base Unit (Inventory Storage) *
              </label>
              <select
                value={ingForm.baseUnit}
                onChange={(e) => {
                  const bUnit = e.target.value;
                  let pUnit = 'KG';
                  let factor = 1000;
                  if (bUnit === 'G') {
                    pUnit = 'KG';
                    factor = 1000;
                  } else if (bUnit === 'ML') {
                    pUnit = 'L';
                    factor = 1000;
                  } else if (bUnit === 'PCS') {
                    pUnit = 'DOZEN';
                    factor = 12;
                  } else if (bUnit === 'MG') {
                    pUnit = 'G';
                    factor = 1000;
                  } else if (bUnit === 'KG') {
                    pUnit = 'KG';
                    factor = 1;
                  } else if (bUnit === 'L') {
                    pUnit = 'L';
                    factor = 1;
                  }
                  setIngForm({
                    ...ingForm,
                    baseUnit: bUnit,
                    purchaseUnit: pUnit,
                    conversionFactor: factor,
                  });
                }}
                className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs font-bold text-slate-900 dark:text-white"
              >
                <option value="G">G - Gram (Weight Base)</option>
                <option value="ML">ML - Milliliter (Volume Base)</option>
                <option value="PCS">PCS - Piece / Unit (Count Base)</option>
                <option value="KG">KG - Kilogram</option>
                <option value="L">L - Liter</option>
                <option value="MG">MG - Milligram</option>
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Default Purchase Unit *
              </label>
              <select
                value={ingForm.purchaseUnit}
                onChange={(e) => {
                  const pUnit = e.target.value;
                  const def = STANDARD_UNITS[pUnit];
                  let factor = ingForm.conversionFactor;
                  if (pUnit === 'KG' && ingForm.baseUnit === 'G') factor = 1000;
                  else if (pUnit === 'L' && ingForm.baseUnit === 'ML') factor = 1000;
                  else if (pUnit === 'DOZEN' && ingForm.baseUnit === 'PCS') factor = 12;
                  else if (pUnit === 'TRAY' && ingForm.baseUnit === 'PCS') factor = 30;
                  else if (pUnit === 'CARTON' && ingForm.baseUnit === 'PCS') factor = 24;
                  else if (pUnit === 'BOX' && ingForm.baseUnit === 'PCS') factor = 10;
                  else if (pUnit === ingForm.baseUnit) factor = 1;
                  else if (def?.defaultFactor) factor = def.defaultFactor;

                  setIngForm({ ...ingForm, purchaseUnit: pUnit, conversionFactor: factor });
                }}
                className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs font-bold text-slate-900 dark:text-white"
              >
                {Object.values(STANDARD_UNITS).map((u) => (
                  <option key={u.code} value={u.code}>
                    {u.name} ({u.code})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="p-3 bg-brand-50/50 dark:bg-brand-950/20 rounded-xl border border-brand-200 dark:border-brand-900/60 space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-center">
              <div>
                <label className="block font-bold text-brand-900 dark:text-brand-300 mb-1">
                  Conversion Factor (Ratio to Base Unit) *
                </label>
                <input
                  type="number"
                  min="0.0001"
                  step="any"
                  required
                  value={ingForm.conversionFactor}
                  onChange={(e) =>
                    setIngForm({ ...ingForm, conversionFactor: parseFloat(e.target.value) || 1 })
                  }
                  className="w-full bg-white dark:bg-slate-800 border border-brand-300 dark:border-brand-800 rounded-lg px-3 py-2 text-xs font-mono font-bold text-slate-900 dark:text-white"
                />
              </div>

              <div className="p-2.5 bg-white dark:bg-slate-800 rounded-lg border border-brand-200 dark:border-brand-800 text-xs">
                <span className="text-slate-500 block font-semibold">Automatic Conversion Rule:</span>
                <span className="font-extrabold text-brand-600 dark:text-brand-400 font-mono text-sm">
                  1 {ingForm.purchaseUnit} = {Number(ingForm.conversionFactor).toLocaleString()} {ingForm.baseUnit}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-center">
              <div>
                <label className="block font-bold text-brand-900 dark:text-brand-300 mb-1">
                  Purchase Cost per {ingForm.purchaseUnit} ({currencySymbol}) *
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  required
                  value={ingForm.purchaseCost}
                  onChange={(e) =>
                    setIngForm({ ...ingForm, purchaseCost: parseFloat(e.target.value) || 0 })
                  }
                  className="w-full bg-white dark:bg-slate-800 border border-brand-300 dark:border-brand-800 rounded-lg px-3 py-2 text-xs font-mono font-bold text-slate-900 dark:text-white"
                />
              </div>

              <div className="p-2.5 bg-white dark:bg-slate-800 rounded-lg border border-brand-200 dark:border-brand-800 text-xs">
                <span className="text-slate-500 block font-semibold">Calculated Base Unit Cost:</span>
                <span className="font-extrabold text-emerald-600 dark:text-emerald-400 font-mono text-sm">
                  {currencySymbol}{' '}
                  {calculateBaseUnitCost(
                    Number(ingForm.purchaseCost) || 0,
                    Number(ingForm.conversionFactor) || 1
                  ).toFixed(4)}{' '}
                  / {ingForm.baseUnit}
                </span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Initial Stock in Base Unit ({ingForm.baseUnit}) *
              </label>
              <input
                type="number"
                min="0"
                step="any"
                required
                value={ingForm.initialStock}
                onChange={(e) =>
                  setIngForm({ ...ingForm, initialStock: parseFloat(e.target.value) || 0 })
                }
                className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs font-mono text-slate-900 dark:text-white"
              />
              <span className="text-[10px] text-slate-400 block mt-0.5">
                Displays as:{' '}
                {formatDisplayStock(
                  Number(ingForm.initialStock) || 0,
                  ingForm.baseUnit,
                  ingForm.purchaseUnit,
                  Number(ingForm.conversionFactor) || 1
                )}
              </span>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Low Stock Alert Threshold ({ingForm.baseUnit}) *
              </label>
              <input
                type="number"
                min="0"
                step="any"
                required
                value={ingForm.minStockAlert}
                onChange={(e) =>
                  setIngForm({ ...ingForm, minStockAlert: parseFloat(e.target.value) || 0 })
                }
                className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs font-mono text-slate-900 dark:text-white"
              />
            </div>
          </div>

          <button
            type="submit"
            className="w-full bg-brand-500 hover:bg-brand-600 text-white font-bold py-2.5 rounded-lg shadow-md transition-all text-xs"
          >
            Save Ingredient & Register Initial FIFO Lot
          </button>
        </form>
      </Modal>

      {/* Modal: Edit Ingredient */}
      <Modal isOpen={isEditIngredientOpen} onClose={() => setIsEditIngredientOpen(false)} title="Edit Raw Ingredient (UOM & Conversion)" maxWidth="lg">
        <form onSubmit={handleUpdateIngredient} className="space-y-4 text-xs">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Ingredient Name *</label>
              <input
                type="text"
                required
                value={editIngForm.name}
                onChange={(e) => setEditIngForm({ ...editIngForm, name: e.target.value })}
                className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Category *</label>
              <select
                value={editIngForm.category}
                onChange={(e) => setEditIngForm({ ...editIngForm, category: e.target.value })}
                className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-white"
              >
                {INGREDIENT_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">SKU / Code *</label>
              <input
                type="text"
                required
                value={editIngForm.sku}
                onChange={(e) => setEditIngForm({ ...editIngForm, sku: e.target.value })}
                className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-white uppercase"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Base Unit (Inventory Storage) *
              </label>
              <select
                value={editIngForm.baseUnit}
                onChange={(e) => setEditIngForm({ ...editIngForm, baseUnit: e.target.value })}
                className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs font-bold text-slate-900 dark:text-white"
              >
                <option value="G">G - Gram (Weight Base)</option>
                <option value="ML">ML - Milliliter (Volume Base)</option>
                <option value="PCS">PCS - Piece / Unit (Count Base)</option>
                <option value="KG">KG - Kilogram</option>
                <option value="L">L - Liter</option>
                <option value="MG">MG - Milligram</option>
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Default Purchase Unit *
              </label>
              <select
                value={editIngForm.purchaseUnit}
                onChange={(e) => {
                  const pUnit = e.target.value;
                  const def = STANDARD_UNITS[pUnit];
                  let factor = editIngForm.conversionFactor;
                  if (pUnit === 'KG' && editIngForm.baseUnit === 'G') factor = 1000;
                  else if (pUnit === 'L' && editIngForm.baseUnit === 'ML') factor = 1000;
                  else if (pUnit === 'DOZEN' && editIngForm.baseUnit === 'PCS') factor = 12;
                  else if (pUnit === 'TRAY' && editIngForm.baseUnit === 'PCS') factor = 30;
                  else if (pUnit === 'CARTON' && editIngForm.baseUnit === 'PCS') factor = 24;
                  else if (pUnit === 'BOX' && editIngForm.baseUnit === 'PCS') factor = 10;
                  else if (pUnit === editIngForm.baseUnit) factor = 1;
                  else if (def?.defaultFactor) factor = def.defaultFactor;

                  setEditIngForm({ ...editIngForm, purchaseUnit: pUnit, conversionFactor: factor });
                }}
                className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs font-bold text-slate-900 dark:text-white"
              >
                {Object.values(STANDARD_UNITS).map((u) => (
                  <option key={u.code} value={u.code}>
                    {u.name} ({u.code})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="p-3 bg-brand-50/50 dark:bg-brand-950/20 rounded-xl border border-brand-200 dark:border-brand-900/60 space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-center">
              <div>
                <label className="block font-bold text-brand-900 dark:text-brand-300 mb-1">
                  Conversion Factor (Ratio to Base Unit) *
                </label>
                <input
                  type="number"
                  min="0.0001"
                  step="any"
                  required
                  value={editIngForm.conversionFactor}
                  onChange={(e) =>
                    setEditIngForm({ ...editIngForm, conversionFactor: parseFloat(e.target.value) || 1 })
                  }
                  className="w-full bg-white dark:bg-slate-800 border border-brand-300 dark:border-brand-800 rounded-lg px-3 py-2 text-xs font-mono font-bold text-slate-900 dark:text-white"
                />
              </div>

              <div className="p-2.5 bg-white dark:bg-slate-800 rounded-lg border border-brand-200 dark:border-brand-800 text-xs">
                <span className="text-slate-500 block font-semibold">Automatic Conversion Rule:</span>
                <span className="font-extrabold text-brand-600 dark:text-brand-400 font-mono text-sm">
                  1 {editIngForm.purchaseUnit} = {Number(editIngForm.conversionFactor).toLocaleString()} {editIngForm.baseUnit}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-center">
              <div>
                <label className="block font-bold text-brand-900 dark:text-brand-300 mb-1">
                  Purchase Cost per {editIngForm.purchaseUnit} ({currencySymbol}) *
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  required
                  value={editIngForm.purchaseCost}
                  onChange={(e) =>
                    setEditIngForm({ ...editIngForm, purchaseCost: parseFloat(e.target.value) || 0 })
                  }
                  className="w-full bg-white dark:bg-slate-800 border border-brand-300 dark:border-brand-800 rounded-lg px-3 py-2 text-xs font-mono font-bold text-slate-900 dark:text-white"
                />
              </div>

              <div className="p-2.5 bg-white dark:bg-slate-800 rounded-lg border border-brand-200 dark:border-brand-800 text-xs">
                <span className="text-slate-500 block font-semibold">Calculated Base Unit Cost:</span>
                <span className="font-extrabold text-emerald-600 dark:text-emerald-400 font-mono text-sm">
                  {currencySymbol}{' '}
                  {calculateBaseUnitCost(
                    Number(editIngForm.purchaseCost) || 0,
                    Number(editIngForm.conversionFactor) || 1
                  ).toFixed(4)}{' '}
                  / {editIngForm.baseUnit}
                </span>
              </div>
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Low Stock Alert Threshold ({editIngForm.baseUnit}) *
            </label>
            <input
              type="number"
              min="0"
              step="any"
              required
              value={editIngForm.minStockAlert}
              onChange={(e) =>
                setEditIngForm({ ...editIngForm, minStockAlert: parseFloat(e.target.value) || 0 })
              }
              className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs font-mono text-slate-900 dark:text-white"
            />
          </div>

          <button
            type="submit"
            className="w-full bg-brand-500 hover:bg-brand-600 text-white font-bold py-2.5 rounded-lg shadow-md transition-all text-xs"
          >
            Update Ingredient
          </button>
        </form>
      </Modal>

      {/* Modal: New Stock Transfer */}
      <Modal isOpen={isAddTransferOpen} onClose={() => setIsAddTransferOpen(false)} title="Initiate Inter-Branch Stock Transfer">
        <form onSubmit={handleCreateTransfer} className="space-y-4 text-xs">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Origin Branch (Source)</label>
              <select
                value={transferForm.fromBranchId}
                onChange={(e) => setTransferForm({ ...transferForm, fromBranchId: e.target.value })}
                className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-white"
              >
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} ({b.code})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Destination Branch (Target)</label>
              <select
                value={transferForm.toBranchId}
                onChange={(e) => setTransferForm({ ...transferForm, toBranchId: e.target.value })}
                className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-white"
              >
                {branches.filter((b) => b.id !== transferForm.fromBranchId).map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} ({b.code})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Ingredient to Transfer</label>
            <select
              value={transferForm.ingredientId}
              onChange={(e) => setTransferForm({ ...transferForm, ingredientId: e.target.value })}
              className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-white"
            >
              {ingredients.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name} (Available: {Number(i.current_stock || 0)} {i.unit})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Transfer Quantity</label>
            <input
              type="number"
              min="0.1"
              step="0.1"
              required
              value={transferForm.quantity}
              onChange={(e) => setTransferForm({ ...transferForm, quantity: parseFloat(e.target.value) || 0 })}
              className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-white"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Notes / Reason (Optional)</label>
            <input
              type="text"
              value={transferForm.notes}
              onChange={(e) => setTransferForm({ ...transferForm, notes: e.target.value })}
              placeholder="e.g. Urgent stock replenishment for weekend rush"
              className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-white"
            />
          </div>

          <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 rounded-lg shadow-md transition-all">
            Initiate Stock Transfer
          </button>
        </form>
      </Modal>

      {/* Modal: Create Recipe */}
      <Modal isOpen={isAddRecipeOpen} onClose={() => setIsAddRecipeOpen(false)} title="Define Product Recipe (FIFO Link)" maxWidth="lg">
        <form onSubmit={handleCreateRecipe} className="space-y-4 text-xs">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Menu Product</label>
              <select
                value={recipeForm.productId}
                onChange={(e) => setRecipeForm({ ...recipeForm, productId: e.target.value })}
                className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-white"
              >
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({currencySymbol} {Number(p.base_price).toLocaleString()})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Yield Count</label>
              <input
                type="number"
                min="1"
                required
                value={recipeForm.yieldCount}
                onChange={(e) => setRecipeForm({ ...recipeForm, yieldCount: parseInt(e.target.value) || 1 })}
                className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-white"
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="block font-semibold text-slate-700 dark:text-slate-300">
                Required Recipe Ingredients
              </label>
              <button
                type="button"
                onClick={() =>
                  setRecipeForm({
                    ...recipeForm,
                    ingredients: [
                      ...recipeForm.ingredients,
                      { ingredientId: ingredients[0]?.id || '', quantity: 1, enteredQuantity: 1, recipeUnit: ingredients[0]?.base_unit || 'G', unit: ingredients[0]?.base_unit || 'G' },
                    ],
                  })
                }
                className="text-xs font-bold text-brand-600 dark:text-brand-400 hover:underline"
              >
                + Add Ingredient
              </button>
            </div>

            {recipeForm.ingredients.map((item, idx) => {
              const ing = ingredients.find((i) => i.id === item.ingredientId);
              const baseU = ing ? (ing.base_unit || ing.unit || 'G') : (item.unit || 'G');
              const recipeU = item.recipeUnit || baseU;
              const enteredQ = Number(item.enteredQuantity || item.quantity) || 0;
              const factor = Number(ing?.conversion_factor || 1);
              const baseQ = convertRecipeQtyToBase(enteredQ, recipeU, baseU, factor);
              const lineCost = (Number(ing?.cost_per_unit || 0)) * baseQ;

              return (
                <div key={idx} className="p-2.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2">
                  <div className="flex items-center space-x-2">
                    <div className="flex-1">
                      <select
                        value={item.ingredientId}
                        onChange={(e) => {
                          const next = [...recipeForm.ingredients];
                          const selectedIng = ingredients.find((i) => i.id === e.target.value);
                          const newBaseU = selectedIng?.base_unit || selectedIng?.unit || 'G';
                          next[idx] = {
                            ...next[idx],
                            ingredientId: e.target.value,
                            unit: newBaseU,
                            recipeUnit: newBaseU,
                          };
                          setRecipeForm({ ...recipeForm, ingredients: next });
                        }}
                        className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 dark:text-white"
                      >
                        <option value="">Select ingredient</option>
                        {ingredients.map((i) => (
                          <option key={i.id} value={i.id}>
                            {i.name} (Base: {i.base_unit || i.unit})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="w-24">
                      <input
                        type="number"
                        step="any"
                        min="0.0001"
                        placeholder="Qty"
                        value={item.enteredQuantity || item.quantity}
                        onChange={(e) => {
                          const next = [...recipeForm.ingredients];
                          const val = parseFloat(e.target.value) || 0;
                          next[idx].enteredQuantity = val;
                          next[idx].quantity = convertRecipeQtyToBase(val, next[idx].recipeUnit || baseU, baseU, factor);
                          setRecipeForm({ ...recipeForm, ingredients: next });
                        }}
                        className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-right font-mono font-bold text-slate-900 dark:text-white"
                      />
                    </div>

                    <div className="w-28">
                      <select
                        value={item.recipeUnit || baseU}
                        onChange={(e) => {
                          const next = [...recipeForm.ingredients];
                          const newRecipeU = e.target.value;
                          next[idx].recipeUnit = newRecipeU;
                          next[idx].quantity = convertRecipeQtyToBase(next[idx].enteredQuantity || next[idx].quantity, newRecipeU, baseU, factor);
                          setRecipeForm({ ...recipeForm, ingredients: next });
                        }}
                        className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1.5 text-xs font-mono font-bold text-slate-900 dark:text-white"
                      >
                        {getCompatibleUnits(baseU).map((u) => (
                          <option key={u.code} value={u.code}>
                            {u.code}
                          </option>
                        ))}
                      </select>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        const next = recipeForm.ingredients.filter((_, i) => i !== idx);
                        setRecipeForm({ ...recipeForm, ingredients: next });
                      }}
                      className="p-1.5 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors"
                      title="Remove Row"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="flex items-center justify-between text-[11px] px-1 text-slate-500">
                    <span className="font-mono bg-white dark:bg-slate-900 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-800">
                      Converts to: <strong className="text-brand-600 dark:text-brand-400">{baseQ} {baseU}</strong> base
                    </span>
                    <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                      Line Cost: {currencySymbol} {lineCost.toFixed(2)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex justify-end space-x-2 pt-2">
            <button
              type="button"
              onClick={() => setIsAddRecipeOpen(false)}
              className="px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-600 dark:text-slate-300"
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
