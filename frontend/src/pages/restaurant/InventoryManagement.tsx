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
  ArrowRightLeft,
  Truck,
  Building2,
  Clock,
  ArrowRight,
  Send,
  Download,
} from 'lucide-react';
import { StockUnit, StockMovementType } from '@pos/shared';

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
  const [isAddRecipeOpen, setIsAddRecipeOpen] = useState(false);
  const [isAdjustmentOpen, setIsAdjustmentOpen] = useState(false);
  const [isAddTransferOpen, setIsAddTransferOpen] = useState(false);

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
      await api.post('/inventory/ingredients', {
        ...ingForm,
        branchId: currentBranchId || undefined,
      });
      success('Ingredient added and initial FIFO batch registered!');
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
      await api.post('/inventory/recipes', recipeForm);
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
            Batch-tracked First-In, First-Out costing, recipes, multi-branch stock transfers, and valuation
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

          <button
            onClick={() => setIsAddTransferOpen(true)}
            className="flex items-center space-x-1.5 px-3.5 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold shadow-sm hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
          >
            <ArrowRightLeft className="w-4 h-4 text-blue-500" />
            <span>New Stock Transfer</span>
          </button>

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
                          <td className="px-6 py-3.5 text-center">
                            {isPending && (
                              <button
                                onClick={() => handleDispatchTransfer(t.id)}
                                className="inline-flex items-center space-x-1 px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-all shadow-sm"
                                title="Dispatch transfer and deduct stock from origin branch"
                              >
                                <Send className="w-3 h-3" />
                                <span>Dispatch</span>
                              </button>
                            )}
                            {isDispatched && (
                              <button
                                onClick={() => handleReceiveTransfer(t.id)}
                                className="inline-flex items-center space-x-1 px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-all shadow-sm"
                                title="Receive transfer into destination branch and activate FIFO batch"
                              >
                                <Download className="w-3 h-3" />
                                <span>Receive Stock</span>
                              </button>
                            )}
                            {isReceived && (
                              <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold">
                                Stored in FIFO Batch
                              </span>
                            )}
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
                  <h4 className="font-bold text-slate-900 dark:text-white text-xs">{r.product_name}</h4>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-brand-500/10 text-brand-500 font-bold">
                    Yield: {r.yield_count}
                  </span>
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
      <Modal isOpen={isAddIngredientOpen} onClose={() => setIsAddIngredientOpen(false)} title="Register Raw Ingredient">
        <form onSubmit={handleCreateIngredient} className="space-y-4 text-xs">
          <div>
            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Ingredient Name</label>
            <input
              type="text"
              required
              value={ingForm.name}
              onChange={(e) => setIngForm({ ...ingForm, name: e.target.value })}
              placeholder="e.g. Chicken Boneless, Basmati Rice, Mozzarella"
              className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-white"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">SKU / Code</label>
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
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Unit of Measure</label>
              <select
                value={ingForm.unit}
                onChange={(e) => setIngForm({ ...ingForm, unit: e.target.value as any })}
                className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-white"
              >
                {Object.values(StockUnit).map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Unit Cost ({currencySymbol})</label>
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
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Initial Stock</label>
              <input
                type="number"
                min="0"
                step="0.1"
                required
                value={ingForm.initialStock}
                onChange={(e) => setIngForm({ ...ingForm, initialStock: parseFloat(e.target.value) || 0 })}
                className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Low Alert Qty</label>
              <input
                type="number"
                min="0"
                step="0.1"
                required
                value={ingForm.minStockAlert}
                onChange={(e) => setIngForm({ ...ingForm, minStockAlert: parseFloat(e.target.value) || 0 })}
                className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-white"
              />
            </div>
          </div>
          <button type="submit" className="w-full bg-brand-500 hover:bg-brand-600 text-white font-bold py-2.5 rounded-lg shadow-md transition-all">
            Save Ingredient & Register FIFO Lot
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
            <label className="block font-semibold text-slate-700 dark:text-slate-300">Required Ingredients</label>
            {recipeForm.ingredients.map((item, idx) => (
              <div key={idx} className="flex space-x-2">
                <select
                  value={item.ingredientId}
                  onChange={(e) => {
                    const next = [...recipeForm.ingredients];
                    next[idx].ingredientId = e.target.value;
                    setRecipeForm({ ...recipeForm, ingredients: next });
                  }}
                  className="flex-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-white"
                >
                  <option value="">Select ingredient</option>
                  {ingredients.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.name} ({i.unit})
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
                  className="w-24 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-white"
                />
                <button
                  type="button"
                  onClick={() => {
                    const next = recipeForm.ingredients.filter((_, i) => i !== idx);
                    setRecipeForm({ ...recipeForm, ingredients: next });
                  }}
                  className="px-2 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg"
                >
                  ✕
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() =>
                setRecipeForm({
                  ...recipeForm,
                  ingredients: [...recipeForm.ingredients, { ingredientId: '', quantity: 1, unit: StockUnit.PCS }],
                })
              }
              className="text-xs font-bold text-brand-600 dark:text-brand-400 hover:underline"
            >
              + Add Ingredient to Recipe
            </button>
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
