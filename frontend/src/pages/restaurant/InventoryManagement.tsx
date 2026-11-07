import { Link, useSearchParams } from 'react-router-dom';
import React, { useEffect, useState } from 'react';
import { api } from '../../api/client.js';
import { useAuth } from '../../context/AuthContext.js';
import { useToast } from '../../context/ToastContext.js';
import { Modal } from '../../components/common/Modal.js';
import { ActionMenu } from '../../components/common/ActionMenu.js';
import { IngredientUsageModal } from '../../components/restaurant/IngredientUsageModal.js';
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
  LayoutDashboard,
  ShoppingBag,
  ChevronDown,
  ChevronUp,
  UtensilsCrossed,
  Receipt,
  DollarSign,
  PieChart,
  Info,
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
  const [searchParams, setSearchParams] = useSearchParams();
  const queryTab = searchParams.get('tab');
  const initialTab = queryTab === 'adjustments' ? 'BATCHES' : (queryTab as any) || 'overview';

  const [ingredients, setIngredients] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [recipes, setRecipes] = useState<any[]>([]);
  const [batches, setBatches] = useState<any[]>([]);
  const [transfers, setTransfers] = useState<any[]>([]);
  const [movements, setMovements] = useState<any[]>([]);
  const [loadingMovements, setLoadingMovements] = useState(false);
  const [movementTypeFilter, setMovementTypeFilter] = useState('');
  const [movementIngredientFilter, setMovementIngredientFilter] = useState('');
  const [reconciling, setReconciling] = useState(false);

  // Order Inventory Usage state
  const [orderConsumptions, setOrderConsumptions] = useState<any[]>([]);
  const [orderUsageSummary, setOrderUsageSummary] = useState<any | null>(null);
  const [loadingOrderUsage, setLoadingOrderUsage] = useState(false);
  const [orderUsageSearch, setOrderUsageSearch] = useState('');
  const [orderUsageDateRange, setOrderUsageDateRange] = useState<'today' | '7d' | '30d' | 'all'>('30d');
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
  const [selectedOrderDetails, setSelectedOrderDetails] = useState<any | null>(null);

  // Valuation State
  const [valuationData, setValuationData] = useState<{ summary: any; items: any[] } | null>(null);
  const [loadingValuation, setLoadingValuation] = useState(false);
  const [expandedIngBatches, setExpandedIngBatches] = useState<Record<string, boolean>>({});

  const [activeTab, setActiveTab] = useState<'overview' | 'STOCK' | 'VALUATION' | 'ORDER_USAGE' | 'movements' | 'low_stock' | 'BATCHES' | 'RECIPES' | 'TRANSFERS'>(initialTab);

  useEffect(() => {
    const tabParam = searchParams.get('tab');
    const actionParam = searchParams.get('action');

    if (actionParam === 'new-ingredient') {
      setIsAddIngredientOpen(true);
    } else if (actionParam === 'new' && (tabParam === 'adjustments' || tabParam === 'BATCHES')) {
      setIsAdjustmentOpen(true);
    } else if (actionParam === 'new' && tabParam === 'TRANSFERS') {
      setIsAddTransferOpen(true);
    }

    if (tabParam === 'adjustments') {
      setActiveTab('BATCHES');
    } else if (tabParam && ['overview', 'STOCK', 'VALUATION', 'ORDER_USAGE', 'movements', 'low_stock', 'BATCHES', 'RECIPES', 'TRANSFERS'].includes(tabParam)) {
      setActiveTab(tabParam as any);
    }
  }, [searchParams]);

  const handleTabChange = (tab: any) => {
    setActiveTab(tab);
    setSearchParams({ tab });
  };
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

  // Ingredient Where Used Mapping Modal State
  const [usageModalOpen, setUsageModalOpen] = useState(false);
  const [usageIngredientId, setUsageIngredientId] = useState<string | null>(null);
  const [usageIngredientName, setUsageIngredientName] = useState<string>('');

  const handleOpenUsage = (ing: any) => {
    setUsageIngredientId(ing.id);
    setUsageIngredientName(ing.name);
    setUsageModalOpen(true);
  };

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
    unit: 'KG',
    costPerUnit: 500,
    minStockAlert: 5,
  });

  // Ingredient Form
  const [ingForm, setIngForm] = useState({
    name: '',
    nameUrdu: '',
    category: 'Meat & Poultry',
    sku: '',
    unit: 'KG',
    costPerUnit: 500,
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

  const fetchMovements = async () => {
    setLoadingMovements(true);
    try {
      const params: any = { limit: 50 };
      if (currentBranchId) params.branchId = currentBranchId;
      if (movementTypeFilter) params.movementType = movementTypeFilter;
      if (movementIngredientFilter) params.ingredientId = movementIngredientFilter;
      const queryStr = new URLSearchParams(params).toString();
      const res = await api.get(`/inventory/movements?${queryStr}`);
      setMovements(res.movements || []);
    } catch (err: any) {
      console.error('Failed to load movements:', err);
    } finally {
      setLoadingMovements(false);
    }
  };

  const fetchOrderConsumptions = async () => {
    setLoadingOrderUsage(true);
    try {
      const params: any = { limit: 50 };
      if (currentBranchId) params.branchId = currentBranchId;
      if (orderUsageSearch.trim()) params.search = orderUsageSearch.trim();

      const now = new Date();
      if (orderUsageDateRange === 'today') {
        const d = new Date(now);
        d.setHours(0, 0, 0, 0);
        params.startDate = d.toISOString();
      } else if (orderUsageDateRange === '7d') {
        const d = new Date(now);
        d.setDate(d.getDate() - 7);
        params.startDate = d.toISOString();
      } else if (orderUsageDateRange === '30d') {
        const d = new Date(now);
        d.setDate(d.getDate() - 30);
        params.startDate = d.toISOString();
      }

      const queryStr = new URLSearchParams(params).toString();
      const res = await api.get(`/inventory/order-consumption?${queryStr}`);
      setOrderConsumptions(res.orders || []);
      setOrderUsageSummary(res.summary || null);
    } catch (err: any) {
      console.error('Failed to load order consumption:', err);
    } finally {
      setLoadingOrderUsage(false);
    }
  };

  const fetchValuation = async () => {
    setLoadingValuation(true);
    try {
      const params: any = {};
      if (currentBranchId) params.branchId = currentBranchId;
      if (selectedCategory && selectedCategory !== 'ALL') params.category = selectedCategory;
      const queryStr = new URLSearchParams(params).toString();
      const res = await api.get(`/inventory/valuation?${queryStr}`);
      setValuationData(res);
    } catch (err: any) {
      console.error('Failed to load valuation:', err);
    } finally {
      setLoadingValuation(false);
    }
  };

  const handleReconcilePurchases = async () => {
    if (!window.confirm('Reconcile historical inward purchases into inventory stock? This will safely find any unposted purchases and create corresponding FIFO batches and ledger entries without double-counting.')) return;
    setReconciling(true);
    try {
      const res = await api.post('/inventory/purchases/reconcile', {
        branchId: currentBranchId || undefined,
      });
      success(res.message || 'Historical inward purchases reconciled successfully!');
      fetchData();
      if (activeTab === 'movements') fetchMovements();
    } catch (err: any) {
      error(err.message || 'Failed to reconcile inward purchases');
    } finally {
      setReconciling(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [currentBranchId]);

  useEffect(() => {
    if (activeTab === 'movements') {
      fetchMovements();
    }
  }, [activeTab, currentBranchId, movementTypeFilter, movementIngredientFilter]);

  useEffect(() => {
    if (activeTab === 'ORDER_USAGE') {
      fetchOrderConsumptions();
    }
  }, [activeTab, currentBranchId, orderUsageDateRange, orderUsageSearch]);

  useEffect(() => {
    if (activeTab === 'VALUATION') {
      fetchValuation();
    }
  }, [activeTab, currentBranchId, selectedCategory]);

  const handleCreateIngredient = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const selectedUnit = ingForm.unit || 'KG';
      const cost = Number(ingForm.costPerUnit) >= 0 ? Number(ingForm.costPerUnit) : 0;

      await api.post('/inventory/ingredients', {
        name: ingForm.name,
        nameUrdu: ingForm.nameUrdu || undefined,
        category: ingForm.category || 'General',
        sku: ingForm.sku,
        unit: selectedUnit,
        baseUnit: selectedUnit,
        purchaseUnit: selectedUnit,
        conversionFactor: 1,
        purchaseCost: cost,
        costPerUnit: cost,
        minStockAlert: Number(ingForm.minStockAlert) || 0,
        initialStock: Number(ingForm.initialStock) || 0,
        branchId: currentBranchId || undefined,
      });
      success('Ingredient registered successfully with exact unit tracking and initial lot!');
      setIsAddIngredientOpen(false);
      setIngForm({
        name: '',
        nameUrdu: '',
        category: 'Meat & Poultry',
        sku: '',
        unit: 'KG',
        costPerUnit: 500,
        minStockAlert: 5,
        initialStock: 10,
      });
      fetchData();
    } catch (err: any) {
      error(err.message || 'Failed to create ingredient');
    }
  };

  const handleUpdateIngredient = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const selectedUnit = editIngForm.unit || 'KG';
      const cost = Number(editIngForm.costPerUnit) >= 0 ? Number(editIngForm.costPerUnit) : 0;

      await api.put(`/inventory/ingredients/${editIngForm.id}`, {
        name: editIngForm.name,
        nameUrdu: editIngForm.nameUrdu || undefined,
        category: editIngForm.category || 'General',
        sku: editIngForm.sku,
        unit: selectedUnit,
        baseUnit: selectedUnit,
        purchaseUnit: selectedUnit,
        conversionFactor: 1,
        purchaseCost: cost,
        costPerUnit: cost,
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
      const effBranchId = currentBranchId || (branches && branches.length > 0 ? branches[0].id : undefined);
      await api.post('/inventory/adjustments', {
        ...adjForm,
        branchId: effBranchId,
      });
      success('Inventory operation recorded & stock ledger updated!');
      setIsAdjustmentOpen(false);
      fetchData();
      if (activeTab === 'movements') fetchMovements();
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

  const lowStockItems = ingredients.filter((ing) => {
    const current = Number(ing.current_stock || 0);
    const minAlert = Number(ing.min_stock_alert || 0);
    return minAlert > 0 && current <= minAlert;
  });
  const outOfStockItems = ingredients.filter((ing) => Number(ing.current_stock || 0) <= 0);
  const totalValuation = ingredients.reduce((sum, ing) => sum + (Number(ing.current_stock || 0) * Number(ing.cost_per_unit || 0)), 0);

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
          <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight flex items-center space-x-2.5">
            <Boxes className="w-7 h-7 text-brand-500" />
            <span>Ingredients & Inventory Hub</span>
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Batch-tracked First-In, First-Out costing, dual-unit conversion, stock ledger & reorder alerts
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={handleReconcilePurchases}
            disabled={reconciling}
            className="flex items-center space-x-1.5 px-3.5 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold transition-all disabled:opacity-50"
            title="Sync unposted purchases into stock ledger and FIFO lots"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${reconciling ? 'animate-spin text-brand-500' : ''}`} />
            <span>{reconciling ? 'Reconciling...' : 'Reconcile Stock'}</span>
          </button>

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
            <span>Purchases & Inward Stock</span>
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
      <div className="flex space-x-1.5 border-b border-slate-200 dark:border-slate-800 pb-3 text-xs font-bold overflow-x-auto">
        {[
          { id: 'overview', label: 'Overview', icon: LayoutDashboard },
          { id: 'STOCK', label: 'Ingredients & Stock', icon: Boxes, count: ingredients.length },
          { id: 'VALUATION', label: 'FIFO Valuation Report', icon: DollarSign },
          { id: 'ORDER_USAGE', label: 'Order Usage & Deductions', icon: ShoppingBag, count: orderConsumptions.length },
          { id: 'movements', label: 'Stock Movements / Ledger', icon: History },
          { id: 'low_stock', label: 'Low Stock & Reorder', icon: AlertTriangle, count: lowStockItems.length, alert: lowStockItems.length > 0 },
          { id: 'BATCHES', label: 'Stock Adjustments & Lots', icon: Layers, count: batches.length },
          ...(branches.length > 1 ? [{ id: 'TRANSFERS', label: 'Stock Transfers', icon: Truck, count: transfers.length }] : []),
          { id: 'RECIPES', label: 'Menu Recipes', icon: Scale, count: recipes.length },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => handleTabChange(tab.id)}
              className={`flex items-center space-x-1.5 px-3.5 py-2 rounded-xl transition-all shrink-0 ${
                isActive
                  ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-md'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <Icon className={`w-3.5 h-3.5 ${tab.alert ? 'text-amber-500' : ''}`} />
              <span>{tab.label}</span>
              {tab.count !== undefined && (
                <span
                  className={`px-1.5 py-0.2 text-[10px] rounded-full font-black ${
                    tab.alert
                      ? 'bg-amber-500 text-white animate-pulse'
                      : isActive
                      ? 'bg-slate-700 dark:bg-slate-200 text-white dark:text-slate-900'
                      : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Tab: Overview Dashboard */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Top KPI Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm flex items-center space-x-3.5">
              <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                <Boxes className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Raw Materials</p>
                <p className="text-xl font-extrabold text-slate-900 dark:text-white">{ingredients.length}</p>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm flex items-center space-x-3.5">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Stock Valuation</p>
                <p className="text-xl font-extrabold text-emerald-600 dark:text-emerald-400">
                  {currencySymbol} {Math.round(totalValuation).toLocaleString()}
                </p>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm flex items-center space-x-3.5">
              <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Low Stock Alerts</p>
                <p className={`text-xl font-extrabold ${lowStockItems.length > 0 ? 'text-amber-600' : 'text-slate-900 dark:text-white'}`}>
                  {lowStockItems.length}
                </p>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm flex items-center space-x-3.5">
              <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
                <Layers className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Active FIFO Lots</p>
                <p className="text-xl font-extrabold text-slate-900 dark:text-white">
                  {batches.filter((b) => b.status === 'ACTIVE').length}
                </p>
              </div>
            </div>
          </div>

          {/* Low Stock Warning Banner if any */}
          {lowStockItems.length > 0 && (
            <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-start space-x-3">
                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-xs text-amber-900 dark:text-amber-200">
                    {lowStockItems.length} Raw Material(s) Running Low
                  </p>
                  <p className="text-[11px] text-amber-700 dark:text-amber-400 mt-0.5">
                    Items have reached or fallen below configured minimum safety thresholds. Generate purchase orders to prevent menu stockouts.
                  </p>
                </div>
              </div>
              <button
                onClick={() => handleTabChange('low_stock')}
                className="flex items-center space-x-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm shrink-0"
              >
                <span>View Low Stock List</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Quick Actions & Category Summary */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Category Valuation Breakdown */}
            <div className="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
              <h3 className="font-bold text-sm text-slate-900 dark:text-white border-b border-slate-100 dark:border-slate-800 pb-2 flex items-center justify-between">
                <span>Inventory Valuation by Category</span>
                <span className="text-xs text-slate-400 font-normal">Base Units Aggregated</span>
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                {INGREDIENT_CATEGORIES.map((cat) => {
                  const catItems = ingredients.filter((i) => (i.category || 'General') === cat);
                  if (catItems.length === 0) return null;
                  const catVal = catItems.reduce((acc, i) => acc + (Number(i.current_stock || 0) * Number(i.cost_per_unit || 0)), 0);
                  return (
                    <div key={cat} className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-100 dark:border-slate-800 flex items-center justify-between">
                      <div>
                        <p className="font-bold text-slate-800 dark:text-slate-200">{cat}</p>
                        <p className="text-[11px] text-slate-400">{catItems.length} ingredient(s)</p>
                      </div>
                      <span className="font-bold text-slate-900 dark:text-white font-mono">
                        {currencySymbol} {Math.round(catVal).toLocaleString()}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Operational Shortcuts */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-3 text-xs">
              <h3 className="font-bold text-sm text-slate-900 dark:text-white border-b border-slate-100 dark:border-slate-800 pb-2">
                Inventory Operations
              </h3>
              <div className="space-y-2">
                <button
                  onClick={() => setIsAddIngredientOpen(true)}
                  className="w-full flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors font-semibold text-slate-700 dark:text-slate-300"
                >
                  <span className="flex items-center space-x-2">
                    <Plus className="w-4 h-4 text-brand-500" />
                    <span>Register Raw Ingredient</span>
                  </span>
                  <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                </button>

                <Link
                  to="/app/purchases"
                  className="w-full flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors font-semibold text-slate-700 dark:text-slate-300"
                >
                  <span className="flex items-center space-x-2">
                    <Truck className="w-4 h-4 text-emerald-500" />
                    <span>Receive Inward Purchase</span>
                  </span>
                  <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                </Link>

                <button
                  onClick={() => setIsAdjustmentOpen(true)}
                  className="w-full flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors font-semibold text-slate-700 dark:text-slate-300"
                >
                  <span className="flex items-center space-x-2">
                    <TrendingDown className="w-4 h-4 text-rose-500" />
                    <span>Record Wastage / Spoilage</span>
                  </span>
                  <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                </button>

                <button
                  onClick={() => handleTabChange('movements')}
                  className="w-full flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors font-semibold text-slate-700 dark:text-slate-300"
                >
                  <span className="flex items-center space-x-2">
                    <History className="w-4 h-4 text-blue-500" />
                    <span>Audit Stock Movements</span>
                  </span>
                  <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

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
                    <th className="px-5 py-3.5">Raw Ingredient</th>
                    <th className="px-4 py-3.5">Available Stock</th>
                    <th className="px-3 py-3.5">Unit</th>
                    <th className="px-4 py-3.5 text-right">Total Stock Value</th>
                    <th className="px-4 py-3.5 text-right">Latest Purchase Price</th>
                    <th className="px-5 py-3.5 text-center">Active FIFO Lots</th>
                    <th className="px-4 py-3.5 text-center">Stock Status</th>
                    <th className="px-4 py-3.5 text-center">Action</th>
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
                      const isLow = stock <= alertThreshold && stock > 0;
                      const isOut = stock <= 0;
                      const itemUnit = ing.unit || ing.base_unit || 'UNIT';
                      const activeBatchesList = Array.isArray(ing.active_batches) ? ing.active_batches : [];
                      const activeBatchCount = ing.active_batches_count ?? activeBatchesList.length;
                      const latestPrice = Number(ing.latest_purchase_price ?? ing.purchase_cost ?? ing.cost_per_unit ?? 0);
                      const stockValue = Number(ing.total_stock_value ?? (stock * latestPrice));
                      const isExpanded = !!expandedIngBatches[ing.id];

                      return (
                        <React.Fragment key={ing.id}>
                          <tr className={`hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors ${isExpanded ? 'bg-brand-50/20 dark:bg-brand-950/20' : ''}`}>
                            <td className="px-5 py-3.5">
                              <div className="flex items-center space-x-2">
                                <div>
                                  <span className="font-bold text-slate-900 dark:text-white block text-sm">
                                    {ing.name}
                                  </span>
                                  <div className="flex items-center space-x-1.5 mt-0.5">
                                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                                      {ing.category || 'General'}
                                    </span>
                                    {ing.sku && (
                                      <span className="font-mono text-[10px] text-slate-400">
                                        SKU: {ing.sku}
                                      </span>
                                    )}
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleOpenUsage(ing);
                                      }}
                                      className="inline-flex items-center gap-1 text-[10px] font-bold text-brand-600 dark:text-brand-400 hover:text-brand-700 bg-brand-50 dark:bg-brand-950/60 hover:bg-brand-100 dark:hover:bg-brand-900/60 px-2 py-0.5 rounded transition-colors"
                                      title="Where Used: View which recipes and POS orders consume this ingredient"
                                    >
                                      <UtensilsCrossed className="w-2.5 h-2.5" />
                                      <span>Where Used</span>
                                    </button>
                                  </div>
                                </div>
                              </div>
                            </td>

                            <td className="px-4 py-3.5 font-mono font-black text-sm text-slate-900 dark:text-white">
                              {stock.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                            </td>

                            <td className="px-3 py-3.5">
                              <span className="px-2 py-0.5 rounded font-extrabold text-[11px] bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                                {itemUnit}
                              </span>
                            </td>

                            <td className="px-4 py-3.5 text-right font-mono font-extrabold text-sm text-emerald-600 dark:text-emerald-400">
                              {currencySymbol} {stockValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </td>

                            <td className="px-4 py-3.5 text-right font-mono text-slate-700 dark:text-slate-300">
                              <div className="font-bold">
                                {currencySymbol} {latestPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </div>
                              <div className="text-[10px] text-slate-400">per {itemUnit}</div>
                            </td>

                            <td className="px-5 py-3.5 text-center">
                              {activeBatchesList.length > 0 ? (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setExpandedIngBatches((prev) => ({
                                      ...prev,
                                      [ing.id]: !prev[ing.id],
                                    }))
                                  }
                                  className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-all cursor-pointer"
                                  title="Click to view remaining FIFO lots"
                                >
                                  <Layers className="w-3 h-3 text-blue-500" />
                                  <span>{activeBatchCount} lot(s)</span>
                                  {isExpanded ? (
                                    <ChevronUp className="w-3 h-3 text-blue-500" />
                                  ) : (
                                    <ChevronDown className="w-3 h-3 text-blue-500" />
                                  )}
                                </button>
                              ) : (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-500">
                                  0 lots
                                </span>
                              )}
                            </td>

                            <td className="px-4 py-3.5 text-center">
                              <span
                                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                                  isOut
                                    ? 'bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-200 border border-rose-300 dark:border-rose-800'
                                    : isLow
                                    ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-900'
                                    : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300'
                                }`}
                              >
                                {isOut ? 'Out of Stock' : isLow ? 'Low Stock Alert' : 'In Stock'}
                              </span>
                            </td>

                            <td className="px-4 py-3.5 text-center whitespace-nowrap">
                              <ActionMenu
                                items={[
                                  {
                                    label: 'Where Used / Recipe Mapping',
                                    icon: UtensilsCrossed,
                                    onClick: () => handleOpenUsage(ing),
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
                                    label: 'View Stock Ledger / History',
                                    icon: History,
                                    onClick: () => {
                                      setMovementIngredientFilter(ing.id);
                                      setActiveTab('movements');
                                    },
                                  },
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
                                        unit: ing.unit || ing.base_unit || 'KG',
                                        costPerUnit: Number(ing.cost_per_unit || ing.purchase_cost || 0),
                                        minStockAlert: Number(ing.min_stock_alert || 5),
                                      });
                                      setIsEditIngredientOpen(true);
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

                          {/* Expanded FIFO Lots Sub-table */}
                          {isExpanded && activeBatchesList.length > 0 && (
                            <tr className="bg-slate-50/80 dark:bg-slate-900/80 border-y border-brand-200 dark:border-brand-900/50">
                              <td colSpan={8} className="p-4 pl-8">
                                <div className="space-y-2">
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center space-x-2">
                                      <Layers className="w-4 h-4 text-brand-500" />
                                      <span className="font-bold text-slate-800 dark:text-slate-200 text-xs">
                                        Active FIFO Stock Lots for {ing.name} (Consumed in First-In, First-Out order)
                                      </span>
                                    </div>
                                    <span className="text-[11px] text-slate-500 font-medium">
                                      Total Active: {activeBatchesList.length} lot(s) | Valued at{' '}
                                      <strong className="text-emerald-600 dark:text-emerald-400">
                                        {currencySymbol}{' '}
                                        {activeBatchesList
                                          .reduce((sum: number, b: any) => sum + Number(b.quantity_remaining || 0) * Number(b.unit_cost || 0), 0)
                                          .toFixed(2)}
                                      </strong>
                                    </span>
                                  </div>

                                  <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden bg-white dark:bg-slate-900">
                                    <table className="w-full text-left text-[11px]">
                                      <thead className="bg-slate-100/70 dark:bg-slate-800 text-slate-600 dark:text-slate-400 uppercase tracking-wider font-semibold">
                                        <tr>
                                          <th className="px-3 py-2">FIFO Queue</th>
                                          <th className="px-3 py-2">Lot # / Ref</th>
                                          <th className="px-3 py-2">Received Date</th>
                                          <th className="px-3 py-2 text-right">Remaining Qty</th>
                                          <th className="px-3 py-2 text-right">Initial Qty</th>
                                          <th className="px-3 py-2 text-right">Unit Cost</th>
                                          <th className="px-3 py-2 text-right">Remaining Value</th>
                                          <th className="px-3 py-2">Supplier</th>
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                        {activeBatchesList.map((batch: any, bIdx: number) => {
                                          const remQty = Number(batch.quantity_remaining || 0);
                                          const origQty = Number(batch.quantity_received || 0);
                                          const uCost = Number(batch.unit_cost || 0);
                                          const remVal = remQty * uCost;
                                          return (
                                            <tr key={batch.id || bIdx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                                              <td className="px-3 py-2">
                                                {bIdx === 0 ? (
                                                  <span className="px-1.5 py-0.5 rounded text-[10px] font-black bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                                                    1st In (Next Out)
                                                  </span>
                                                ) : (
                                                  <span className="text-slate-400 font-mono text-[10px]">
                                                    Queue #{bIdx + 1}
                                                  </span>
                                                )}
                                              </td>
                                              <td className="px-3 py-2 font-mono font-bold text-slate-700 dark:text-slate-300">
                                                #{String(batch.id || '').slice(-8)}
                                              </td>
                                              <td className="px-3 py-2 text-slate-500 whitespace-nowrap">
                                                {batch.received_at ? new Date(batch.received_at).toLocaleDateString() : '-'}
                                              </td>
                                              <td className="px-3 py-2 text-right font-mono font-black text-slate-900 dark:text-white">
                                                {remQty.toLocaleString(undefined, { maximumFractionDigits: 2 })} {batch.unit || itemUnit}
                                              </td>
                                              <td className="px-3 py-2 text-right font-mono text-slate-400">
                                                {origQty.toLocaleString(undefined, { maximumFractionDigits: 2 })} {batch.unit || itemUnit}
                                              </td>
                                              <td className="px-3 py-2 text-right font-mono text-slate-700 dark:text-slate-300">
                                                {currencySymbol} {uCost.toFixed(2)}
                                              </td>
                                              <td className="px-3 py-2 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                                                {currencySymbol} {remVal.toFixed(2)}
                                              </td>
                                              <td className="px-3 py-2 text-slate-600 dark:text-slate-400">
                                                {batch.supplier_name || 'Standard Inward'}
                                              </td>
                                            </tr>
                                          );
                                        })}
                                      </tbody>
                                    </table>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Tab: FIFO Inventory Valuation Report */}
      {activeTab === 'VALUATION' && (
        <div className="space-y-6">
          {/* Top KPI Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm flex items-center space-x-3.5">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                <DollarSign className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Total FIFO Valuation</p>
                <p className="text-xl font-extrabold text-emerald-600 dark:text-emerald-400 font-mono">
                  {currencySymbol}{' '}
                  {Number(valuationData?.summary?.totalInventoryValue ?? totalValuation).toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </p>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm flex items-center space-x-3.5">
              <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                <Boxes className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Tracked Raw Items</p>
                <p className="text-xl font-extrabold text-slate-900 dark:text-white">
                  {valuationData?.summary?.totalItemsCount ?? ingredients.length}
                </p>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm flex items-center space-x-3.5">
              <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
                <Layers className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Active FIFO Lots</p>
                <p className="text-xl font-extrabold text-purple-600 dark:text-purple-400">
                  {valuationData?.summary?.totalActiveBatchesCount ?? batches.filter((b) => b.status === 'ACTIVE').length}
                </p>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm flex items-center space-x-3.5">
              <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                <PieChart className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Avg Value / Item</p>
                <p className="text-xl font-extrabold text-slate-900 dark:text-white font-mono">
                  {currencySymbol}{' '}
                  {valuationData?.items?.length
                    ? (
                        Number(valuationData.summary?.totalInventoryValue || 0) /
                        Math.max(1, valuationData.items.filter((i) => Number(i.remaining_stock_value || 0) > 0).length || 1)
                      ).toFixed(2)
                    : '0.00'}
                </p>
              </div>
            </div>
          </div>

          {/* Filter & Search Bar */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm space-y-3">
            <div className="flex flex-col md:flex-row gap-3 items-center justify-between">
              <div className="relative w-full md:w-96">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={stockSearchTerm}
                  onChange={(e) => setStockSearchTerm(e.target.value)}
                  placeholder="Filter inventory valuation by name or category..."
                  className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>

              <div className="flex items-center space-x-2">
                <button
                  onClick={fetchValuation}
                  disabled={loadingValuation}
                  className="flex items-center space-x-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold transition-all"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loadingValuation ? 'animate-spin text-brand-500' : ''}`} />
                  <span>Refresh Report</span>
                </button>
              </div>
            </div>

            {/* Category Filter */}
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

          {/* Valuation Table */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 uppercase font-semibold">
                  <tr>
                    <th className="px-5 py-3.5">Raw Material</th>
                    <th className="px-4 py-3.5 font-mono">Available Stock</th>
                    <th className="px-3 py-3.5">Unit</th>
                    <th className="px-4 py-3.5 text-right font-mono">Latest Purchase Cost</th>
                    <th className="px-4 py-3.5 text-right font-mono">Total FIFO Valuation</th>
                    <th className="px-5 py-3.5 text-center">Active FIFO Lots</th>
                    <th className="px-4 py-3.5 text-center">Lot Breakdown</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {loadingValuation ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-12 text-center text-slate-400">
                        <div className="inline-flex items-center space-x-2">
                          <RefreshCw className="w-4 h-4 animate-spin text-brand-500" />
                          <span>Calculating FIFO batch inventory valuations...</span>
                        </div>
                      </td>
                    </tr>
                  ) : !valuationData?.items || valuationData.items.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-12 text-center text-slate-400">
                        <Boxes className="w-10 h-10 mx-auto mb-2 text-slate-300 dark:text-slate-600" />
                        <p className="font-bold text-slate-700 dark:text-slate-300 text-sm">No Inventory Items Found</p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 max-w-md mx-auto mt-1">
                          Record inward purchases to automatically generate FIFO stock valuation records.
                        </p>
                      </td>
                    </tr>
                  ) : (
                    valuationData.items
                      .filter((item: any) => {
                        const q = stockSearchTerm.toLowerCase().trim();
                        return (
                          !q ||
                          item.ingredient_name?.toLowerCase().includes(q) ||
                          item.category?.toLowerCase().includes(q)
                        );
                      })
                      .map((item: any) => {
                        const stock = Number(item.available_quantity || 0);
                        const batchesList = Array.isArray(item.remaining_batches) ? item.remaining_batches : [];
                        const val = Number(item.remaining_stock_value || 0);
                        const latestPrice = Number(item.latest_purchase_price || 0);
                        const isExpanded = !!expandedIngBatches[item.ingredient_id];

                        return (
                          <React.Fragment key={item.ingredient_id}>
                            <tr
                              className={`hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors ${
                                isExpanded ? 'bg-brand-50/20 dark:bg-brand-950/20' : ''
                              }`}
                            >
                              <td className="px-5 py-3.5">
                                <span className="font-bold text-slate-900 dark:text-white block text-sm">
                                  {item.ingredient_name}
                                </span>
                                <span className="inline-block mt-0.5 px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                                  {item.category || 'General'}
                                </span>
                              </td>

                              <td className="px-4 py-3.5 font-mono font-black text-sm text-slate-900 dark:text-white">
                                {stock.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                              </td>

                              <td className="px-3 py-3.5">
                                <span className="px-2 py-0.5 rounded font-extrabold text-[11px] bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                                  {item.unit}
                                </span>
                              </td>

                              <td className="px-4 py-3.5 text-right font-mono text-slate-700 dark:text-slate-300">
                                <span className="font-bold">
                                  {currencySymbol} {latestPrice.toFixed(2)}
                                </span>
                                <span className="text-[10px] text-slate-400 block">per {item.unit}</span>
                              </td>

                              <td className="px-4 py-3.5 text-right font-mono font-black text-sm text-emerald-600 dark:text-emerald-400">
                                {currencySymbol} {val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </td>

                              <td className="px-5 py-3.5 text-center">
                                <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-purple-50 dark:bg-purple-950/50 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                                  <Layers className="w-3 h-3 text-purple-500" />
                                  <span>{batchesList.length} lot(s)</span>
                                </span>
                              </td>

                              <td className="px-4 py-3.5 text-center">
                                {batchesList.length > 0 ? (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setExpandedIngBatches((prev) => ({
                                        ...prev,
                                        [item.ingredient_id]: !prev[item.ingredient_id],
                                      }))
                                    }
                                    className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors"
                                  >
                                    <span>{isExpanded ? 'Hide Lots' : 'Inspect Lots'}</span>
                                    {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                                  </button>
                                ) : (
                                  <span className="text-slate-400 italic text-[11px]">No active lots</span>
                                )}
                              </td>
                            </tr>

                            {/* Expanded FIFO Lots Table */}
                            {isExpanded && batchesList.length > 0 && (
                              <tr className="bg-slate-50/80 dark:bg-slate-900/80 border-y border-brand-200 dark:border-brand-900/50">
                                <td colSpan={7} className="p-4 pl-8">
                                  <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                      <div className="flex items-center space-x-2">
                                        <Layers className="w-4 h-4 text-brand-500" />
                                        <span className="font-bold text-slate-800 dark:text-slate-200 text-xs">
                                          FIFO Lot Valuation Breakdown for {item.ingredient_name}
                                        </span>
                                      </div>
                                      <span className="text-[11px] text-slate-500 font-medium">
                                        Sum of FIFO Lots = <strong className="text-emerald-600 dark:text-emerald-400">{currencySymbol} {val.toFixed(2)}</strong>
                                      </span>
                                    </div>

                                    <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden bg-white dark:bg-slate-900">
                                      <table className="w-full text-left text-[11px]">
                                        <thead className="bg-slate-100/70 dark:bg-slate-800 text-slate-600 dark:text-slate-400 uppercase tracking-wider font-semibold">
                                          <tr>
                                            <th className="px-3 py-2">Queue Order</th>
                                            <th className="px-3 py-2">Batch Lot ID</th>
                                            <th className="px-3 py-2">Received Date</th>
                                            <th className="px-3 py-2 text-right">Remaining Qty</th>
                                            <th className="px-3 py-2 text-right">Inward Unit Cost</th>
                                            <th className="px-3 py-2 text-right">Remaining Value</th>
                                            <th className="px-3 py-2">Supplier Ref</th>
                                          </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                          {batchesList.map((batch: any, bIdx: number) => {
                                            const remQty = Number(batch.remaining_quantity || 0);
                                            const uCost = Number(batch.unit_cost || 0);
                                            const remVal = Number(batch.remaining_value || remQty * uCost);
                                            return (
                                              <tr key={batch.batch_id || bIdx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                                                <td className="px-3 py-2 font-bold">
                                                  {bIdx === 0 ? (
                                                    <span className="px-1.5 py-0.5 rounded text-[10px] bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                                                      Next FIFO Lot
                                                    </span>
                                                  ) : (
                                                    <span className="font-mono text-slate-400 text-[10px]">
                                                      Lot #{bIdx + 1}
                                                    </span>
                                                  )}
                                                </td>
                                                <td className="px-3 py-2 font-mono font-bold text-slate-700 dark:text-slate-300">
                                                  #{String(batch.batch_id || '').slice(-8)}
                                                </td>
                                                <td className="px-3 py-2 text-slate-500 whitespace-nowrap">
                                                  {batch.received_at ? new Date(batch.received_at).toLocaleDateString() : '-'}
                                                </td>
                                                <td className="px-3 py-2 text-right font-mono font-black text-slate-900 dark:text-white">
                                                  {remQty.toLocaleString(undefined, { maximumFractionDigits: 2 })} {batch.unit || item.unit}
                                                </td>
                                                <td className="px-3 py-2 text-right font-mono text-slate-700 dark:text-slate-300">
                                                  {currencySymbol} {uCost.toFixed(2)}
                                                </td>
                                                <td className="px-3 py-2 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                                                  {currencySymbol} {remVal.toFixed(2)}
                                                </td>
                                                <td className="px-3 py-2 text-slate-600 dark:text-slate-400">
                                                  {batch.supplier_name || 'Standard Inward'}
                                                </td>
                                              </tr>
                                            );
                                          })}
                                        </tbody>
                                      </table>
                                    </div>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        );
                      })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
      {activeTab === 'ORDER_USAGE' && (
        <div className="space-y-6">
          {/* Summary KPIs */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm flex items-center space-x-3.5">
              <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                <ShoppingBag className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Orders with Deductions</p>
                <p className="text-xl font-extrabold text-slate-900 dark:text-white">
                  {orderUsageSummary?.total_orders_count ?? orderConsumptions.length}
                </p>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm flex items-center space-x-3.5">
              <div className="w-10 h-10 rounded-xl bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
                <DollarSign className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Total Inventory COGS</p>
                <p className="text-xl font-extrabold text-rose-600 dark:text-rose-400">
                  {currencySymbol} {Number(orderUsageSummary?.total_cogs_amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm flex items-center space-x-3.5">
              <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
                <Boxes className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Ingredients Consumed</p>
                <p className="text-xl font-extrabold text-purple-600 dark:text-purple-400">
                  {orderUsageSummary?.unique_ingredients_count ?? 0}
                </p>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm flex items-center space-x-3.5">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                <PieChart className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Total Qty Consumed</p>
                <p className="text-xl font-extrabold text-emerald-600 dark:text-emerald-400">
                  {Number(orderUsageSummary?.total_quantity_used || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                </p>
              </div>
            </div>
          </div>

          {/* Filter & Toolbar */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
            <div className="flex flex-wrap items-center gap-3">
              {/* Search */}
              <div className="relative min-w-[240px]">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search Order #, Product, Ingredient..."
                  value={orderUsageSearch}
                  onChange={(e) => setOrderUsageSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>

              {/* Date Filters */}
              <div className="flex items-center space-x-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
                {[
                  { id: 'today', label: 'Today' },
                  { id: '7d', label: 'Last 7 Days' },
                  { id: '30d', label: 'Last 30 Days' },
                  { id: 'all', label: 'All History' },
                ].map((range) => (
                  <button
                    key={range.id}
                    onClick={() => setOrderUsageDateRange(range.id as any)}
                    className={`px-3 py-1 rounded-lg font-bold transition-all ${
                      orderUsageDateRange === range.id
                        ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    {range.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center space-x-2 self-end md:self-auto">
              <Link
                to="/app/recipe-costing"
                className="flex items-center space-x-1.5 px-3 py-1.5 bg-brand-50 dark:bg-brand-950/40 border border-brand-200 dark:border-brand-800 text-brand-600 dark:text-brand-400 rounded-xl font-bold hover:bg-brand-100 dark:hover:bg-brand-900/40 transition-colors"
              >
                <PieChart className="w-3.5 h-3.5" />
                <span>Recipe Costing & Profitability</span>
              </Link>
              <button
                onClick={fetchOrderConsumptions}
                className="flex items-center space-x-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl font-bold transition-all"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loadingOrderUsage ? 'animate-spin text-brand-500' : ''}`} />
                <span>Refresh</span>
              </button>
            </div>
          </div>

          {/* Table of Orders with Inventory Deductions */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider">
                  <tr>
                    <th className="px-4 py-3">Order Number & Date</th>
                    <th className="px-4 py-3">Order Type</th>
                    <th className="px-4 py-3">Sold Menu Items</th>
                    <th className="px-4 py-3">Ingredients Deducted</th>
                    <th className="px-4 py-3 text-right">Sale Price</th>
                    <th className="px-4 py-3 text-right">Raw COGS</th>
                    <th className="px-4 py-3 text-right">Gross Profit</th>
                    <th className="px-4 py-3 text-center">Breakdown</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {loadingOrderUsage ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-12 text-center text-slate-400">
                        <div className="inline-flex items-center space-x-2">
                          <RefreshCw className="w-4 h-4 animate-spin text-brand-500" />
                          <span>Loading order inventory deductions...</span>
                        </div>
                      </td>
                    </tr>
                  ) : orderConsumptions.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-12 text-center text-slate-400">
                        <ShoppingBag className="w-10 h-10 mx-auto mb-2 text-slate-300 dark:text-slate-600" />
                        <p className="font-bold text-slate-700 dark:text-slate-300 text-sm">No Order Inventory Usage Recorded Yet</p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 max-w-md mx-auto mt-1">
                          When customers order items that have Recipes linked in the Menu Recipes tab, the exact ingredients and FIFO batches deducted will show here order-by-order.
                        </p>
                        <button
                          onClick={() => handleTabChange('RECIPES')}
                          className="mt-3 inline-flex items-center space-x-1.5 px-3.5 py-1.5 bg-brand-500 hover:bg-brand-600 text-white rounded-xl text-xs font-bold transition-all shadow-sm"
                        >
                          <Scale className="w-3.5 h-3.5" />
                          <span>Link Menu Recipes</span>
                        </button>
                      </td>
                    </tr>
                  ) : (
                    orderConsumptions.map((order) => {
                      const isExpanded = expandedOrderId === order.order_id;
                      const salePrice = Number(order.grand_total || 0);
                      const cogs = Number(order.order_total_cogs || 0);
                      const grossProfit = salePrice - cogs;
                      const marginPct = salePrice > 0 ? (grossProfit / salePrice) * 100 : 0;

                      // Unique menu item names sold
                      const uniqueProducts: string[] = Array.from(new Set<string>((order.items_consumed || []).map((i: any) => `${i.product_name} (x${i.product_quantity})`)));

                      // Unique ingredient badges
                      const ingredientSummary = (order.items_consumed || []).slice(0, 4);
                      const extraIngredientsCount = Math.max(0, (order.items_consumed || []).length - 4);

                      return (
                        <React.Fragment key={order.order_id}>
                          <tr
                            onClick={() => setExpandedOrderId(isExpanded ? null : order.order_id)}
                            className={`cursor-pointer transition-colors ${
                              isExpanded
                                ? 'bg-brand-50/40 dark:bg-brand-950/20'
                                : 'hover:bg-slate-50/70 dark:hover:bg-slate-800/40'
                            }`}
                          >
                            <td className="px-4 py-3">
                              <div className="flex items-center space-x-2">
                                <span className="font-mono font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 px-2 py-0.5 rounded border border-blue-200 dark:border-blue-800 text-[11px]">
                                  #{order.order_number}
                                </span>
                                <span className="text-[11px] text-slate-500">
                                  {new Date(order.order_created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                              </div>
                              <p className="text-[10px] text-slate-400 mt-0.5 font-mono">
                                {new Date(order.order_created_at).toLocaleDateString()}
                              </p>
                            </td>

                            <td className="px-4 py-3">
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                                {order.order_type || 'DINE_IN'}
                              </span>
                              {order.customer_name && (
                                <p className="text-[11px] font-medium text-slate-600 dark:text-slate-400 mt-0.5">
                                  {order.customer_name}
                                </p>
                              )}
                            </td>

                            <td className="px-4 py-3">
                              <div className="flex flex-wrap gap-1 max-w-xs">
                                {uniqueProducts.length > 0 ? (
                                  uniqueProducts.map((pName, idx) => (
                                    <span
                                      key={idx}
                                      className="inline-flex items-center space-x-1 px-1.5 py-0.5 rounded bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 font-semibold text-[10px] border border-amber-200 dark:border-amber-800"
                                    >
                                      <UtensilsCrossed className="w-2.5 h-2.5" />
                                      <span>{pName}</span>
                                    </span>
                                  ))
                                ) : (
                                  <span className="text-slate-400 italic">No products recorded</span>
                                )}
                              </div>
                            </td>

                            <td className="px-4 py-3">
                              <div className="flex flex-wrap gap-1 max-w-sm">
                                {ingredientSummary.map((item: any, idx: number) => (
                                  <span
                                    key={idx}
                                    className="inline-flex items-center space-x-1 px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[10px]"
                                  >
                                    <span className="font-bold">{item.ingredient_name}:</span>
                                    <span>{Number(item.quantity_used).toLocaleString()} {item.ingredient_unit}</span>
                                  </span>
                                ))}
                                {extraIngredientsCount > 0 && (
                                  <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-[10px] font-bold">
                                    +{extraIngredientsCount} more
                                  </span>
                                )}
                              </div>
                            </td>

                            <td className="px-4 py-3 text-right font-mono font-bold text-slate-900 dark:text-white">
                              {currencySymbol} {salePrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </td>

                            <td className="px-4 py-3 text-right font-mono font-bold text-rose-600 dark:text-rose-400">
                              {currencySymbol} {cogs.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </td>

                            <td className="px-4 py-3 text-right font-mono">
                              <p className={`font-bold ${grossProfit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600'}`}>
                                {currencySymbol} {grossProfit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </p>
                              <span
                                className={`inline-block px-1.5 py-0.2 rounded text-[10px] font-black ${
                                  marginPct >= 60
                                    ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                                    : marginPct >= 40
                                    ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300'
                                    : 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300'
                                }`}
                              >
                                {marginPct.toFixed(1)}% margin
                              </span>
                            </td>

                            <td className="px-4 py-3 text-center">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setExpandedOrderId(isExpanded ? null : order.order_id);
                                }}
                                className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 transition-colors"
                                title={isExpanded ? 'Collapse breakdown' : 'Expand full ingredient breakdown'}
                              >
                                {isExpanded ? <ChevronUp className="w-4 h-4 text-brand-500" /> : <ChevronDown className="w-4 h-4" />}
                              </button>
                            </td>
                          </tr>

                          {/* Expanded Ingredient Breakdown Row */}
                          {isExpanded && (
                            <tr className="bg-slate-50/80 dark:bg-slate-900/80 border-y border-brand-200 dark:border-brand-900/50">
                              <td colSpan={8} className="p-4 pl-8">
                                <div className="space-y-3">
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center space-x-2">
                                      <Boxes className="w-4 h-4 text-brand-500" />
                                      <span className="font-bold text-slate-800 dark:text-slate-200 text-xs">
                                        Raw Material FIFO Batch Consumption for Order #{order.order_number}
                                      </span>
                                    </div>
                                    <span className="text-[11px] text-slate-500">
                                      Total Deducted: <strong className="text-rose-600 dark:text-rose-400">{currencySymbol} {cogs.toFixed(2)}</strong> across {(order.items_consumed || []).length} ingredient lots
                                    </span>
                                  </div>

                                  <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden bg-white dark:bg-slate-900">
                                    <table className="w-full text-left text-[11px]">
                                      <thead className="bg-slate-100/70 dark:bg-slate-800 text-slate-600 dark:text-slate-400 uppercase tracking-wider font-semibold">
                                        <tr>
                                          <th className="px-3 py-2">Menu Item</th>
                                          <th className="px-3 py-2">Ingredient Consumed</th>
                                          <th className="px-3 py-2 text-right">Quantity Deducted</th>
                                          <th className="px-3 py-2 text-right">FIFO Unit Cost</th>
                                          <th className="px-3 py-2 text-right">Total Food Cost (COGS)</th>
                                          <th className="px-3 py-2">FIFO Batch Lot ID</th>
                                          <th className="px-3 py-2">Deduction Timestamp</th>
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                        {(order.items_consumed || []).map((lot: any, lotIdx: number) => (
                                          <tr key={lotIdx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                                            <td className="px-3 py-2 font-semibold text-slate-900 dark:text-white flex items-center space-x-1.5">
                                              <UtensilsCrossed className="w-3 h-3 text-amber-500" />
                                              <span>{lot.product_name}</span>
                                            </td>
                                            <td className="px-3 py-2 font-bold text-slate-700 dark:text-slate-300">
                                              {lot.ingredient_name}
                                            </td>
                                            <td className="px-3 py-2 text-right font-mono font-bold text-slate-800 dark:text-slate-200">
                                              {Number(lot.quantity_used).toLocaleString()} {lot.ingredient_unit}
                                            </td>
                                            <td className="px-3 py-2 text-right font-mono text-slate-500">
                                              {currencySymbol} {Number(lot.unit_cost).toFixed(2)} / {lot.ingredient_unit}
                                            </td>
                                            <td className="px-3 py-2 text-right font-mono font-bold text-rose-600 dark:text-rose-400">
                                              {currencySymbol} {Number(lot.total_cost).toFixed(2)}
                                            </td>
                                            <td className="px-3 py-2 font-mono text-[10px] text-slate-400">
                                              {lot.batch_id ? (
                                                <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                                                  Lot #{String(lot.batch_id).slice(-8)}
                                                </span>
                                              ) : (
                                                'Standard'
                                              )}
                                            </td>
                                            <td className="px-3 py-2 text-slate-400 text-[10px] whitespace-nowrap">
                                              {new Date(lot.consumed_at).toLocaleString()}
                                            </td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Tab: Stock Movements / Audit Ledger */}
      {activeTab === 'movements' && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center space-x-1.5">
                <span className="font-bold text-slate-500">Movement Type:</span>
                <select
                  value={movementTypeFilter}
                  onChange={(e) => setMovementTypeFilter(e.target.value)}
                  className="px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-900 dark:text-white"
                >
                  <option value="">All Movement Types</option>
                  <option value="PURCHASE_RECEIVE">Inward Purchases</option>
                  <option value="SALE_DEDUCTION">Recipe Order Deductions</option>
                  <option value="WASTAGE_SPOILAGE">Wastage / Spoilage</option>
                  <option value="ADJUSTMENT_ADD">Manual Additions</option>
                  <option value="ADJUSTMENT_SUBTRACT">Manual Subtractions</option>
                  <option value="TRANSFER_IN">Transfer In</option>
                  <option value="TRANSFER_OUT">Transfer Out</option>
                </select>
              </div>

              <div className="flex items-center space-x-1.5">
                <span className="font-bold text-slate-500">Ingredient:</span>
                <select
                  value={movementIngredientFilter}
                  onChange={(e) => setMovementIngredientFilter(e.target.value)}
                  className="px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-900 dark:text-white max-w-xs"
                >
                  <option value="">All Ingredients</option>
                  {ingredients.map((ing) => (
                    <option key={ing.id} value={ing.id}>
                      {ing.name} ({ing.unit})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <button
              onClick={fetchMovements}
              className="flex items-center space-x-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl font-bold transition-all self-end md:self-auto"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingMovements ? 'animate-spin text-brand-500' : ''}`} />
              <span>Refresh Ledger</span>
            </button>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider">
                  <tr>
                    <th className="px-4 py-3">Timestamp</th>
                    <th className="px-4 py-3">Ingredient</th>
                    <th className="px-4 py-3">Movement Type</th>
                    <th className="px-4 py-3 text-right">Quantity Changed</th>
                    <th className="px-4 py-3 text-center">Stock Progression</th>
                    <th className="px-4 py-3 text-right">Unit / Total Cost</th>
                    <th className="px-4 py-3">Reason / Reference</th>
                    <th className="px-4 py-3">Staff</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {loadingMovements ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-12 text-center text-slate-400">
                        <div className="inline-flex items-center space-x-2">
                          <RefreshCw className="w-4 h-4 animate-spin text-brand-500" />
                          <span>Loading stock ledger movements...</span>
                        </div>
                      </td>
                    </tr>
                  ) : movements.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-12 text-center text-slate-400">
                        <History className="w-8 h-8 mx-auto mb-2 text-slate-300 dark:text-slate-600" />
                        <p className="font-semibold text-slate-600 dark:text-slate-400">No stock movements recorded</p>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          Inward purchases, POS order sales, and wastage adjustments automatically record here
                        </p>
                      </td>
                    </tr>
                  ) : (
                    movements.map((m) => {
                      const isAddition = ['PURCHASE_RECEIVE', 'ADJUSTMENT_ADD', 'TRANSFER_IN'].includes(m.movement_type);
                      return (
                        <tr key={m.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
                          <td className="px-4 py-3 text-slate-500 font-mono text-[11px] whitespace-nowrap">
                            {new Date(m.created_at).toLocaleString()}
                          </td>
                          <td className="px-4 py-3 font-bold text-slate-900 dark:text-white">
                            {m.ingredient_name}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                                isAddition
                                  ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200'
                                  : 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200'
                              }`}
                            >
                              {m.movement_type?.replace('_', ' ')}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right font-mono font-bold">
                            <span className={isAddition ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}>
                              {isAddition ? '+' : '-'}{Math.abs(Number(m.quantity)).toLocaleString()} {m.unit}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center text-[11px] font-mono text-slate-500">
                            <span>{Number(m.stock_before).toLocaleString()}</span>
                            <span className="mx-1.5 text-slate-400">→</span>
                            <span className="font-bold text-slate-800 dark:text-slate-200">{Number(m.stock_after).toLocaleString()}</span>
                          </td>
                          <td className="px-4 py-3 text-right font-mono">
                            <p className="font-bold text-slate-900 dark:text-white">
                              {currencySymbol} {Number(m.total_cost || 0).toLocaleString()}
                            </p>
                            <p className="text-[10px] text-slate-400">
                              @{currencySymbol} {Number(m.unit_cost || 0).toFixed(2)}/{m.unit}
                            </p>
                          </td>
                          <td className="px-4 py-3 text-slate-600 dark:text-slate-300 text-[11px]">
                            {m.order_number ? (
                              <div className="flex flex-col space-y-1">
                                <span className="inline-flex items-center space-x-1 font-mono font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 px-2 py-0.5 rounded border border-blue-200 dark:border-blue-800 text-[10px] w-fit">
                                  <Receipt className="w-3 h-3" />
                                  <span>Order #{m.order_number}</span>
                                </span>
                                <span>{m.reason || m.reference_type}</span>
                              </div>
                            ) : (
                              m.reason || m.reference_type || '—'
                            )}
                          </td>
                          <td className="px-4 py-3 text-slate-500 text-[11px]">
                            {m.recorded_by_name || 'System / POS'}
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

      {/* Tab: Low Stock & Reorder Alerts */}
      {activeTab === 'low_stock' && (
        <div className="space-y-4">
          <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div className="flex items-start space-x-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <h3 className="font-bold text-amber-900 dark:text-amber-200 text-sm">
                  Low Stock & Reorder Management
                </h3>
                <p className="text-[11px] text-amber-700 dark:text-amber-400 mt-0.5">
                  Items below minimum stock threshold are listed below with recommended reorder quantities based on your purchase units.
                </p>
              </div>
            </div>

            <Link
              to="/app/purchases"
              className="flex items-center space-x-1.5 px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white rounded-xl font-bold transition-all shadow-md shrink-0"
            >
              <Truck className="w-4 h-4" />
              <span>Create Purchase Invoice</span>
            </Link>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider">
                  <tr>
                    <th className="px-4 py-3">Raw Ingredient</th>
                    <th className="px-4 py-3">Category</th>
                    <th className="px-4 py-3 text-right">Current Stock</th>
                    <th className="px-4 py-3 text-right">Min Threshold</th>
                    <th className="px-4 py-3 text-right">Stock Deficit</th>
                    <th className="px-4 py-3 text-right">Suggested Reorder</th>
                    <th className="px-4 py-3 text-right">Purchase Cost</th>
                    <th className="px-4 py-3 text-right">Est. Reorder Cost</th>
                    <th className="px-4 py-3 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {lowStockItems.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="px-4 py-12 text-center text-slate-400">
                        <CheckCircle2 className="w-10 h-10 mx-auto mb-2 text-emerald-500" />
                        <p className="font-bold text-slate-800 dark:text-slate-200 text-sm">
                          All Raw Materials Sufficiently Stocked!
                        </p>
                        <p className="text-[11px] text-slate-400 mt-1">
                          No ingredients are currently at or below their minimum safety alert threshold.
                        </p>
                      </td>
                    </tr>
                  ) : (
                    lowStockItems.map((ing) => {
                      const current = Number(ing.current_stock || 0);
                      const minAlert = Number(ing.min_stock_alert || 0);
                      const deficit = Math.max(0, minAlert - current);
                      const factor = Number(ing.conversion_factor || 1);
                      const bUnit = ing.base_unit || ing.unit || 'G';
                      const pUnit = ing.purchase_unit || ing.unit || 'KG';
                      const pCost = Number(ing.purchase_cost || (Number(ing.cost_per_unit || 0) * factor));

                      // Suggested reorder: top up to 2x min threshold
                      const suggestedBase = Math.max(deficit, minAlert * 2 - current);
                      const suggestedPurch = factor > 0 ? (suggestedBase / factor) : suggestedBase;
                      const estCost = suggestedPurch * pCost;

                      return (
                        <tr key={ing.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
                          <td className="px-4 py-3">
                            <p className="font-bold text-slate-900 dark:text-white">{ing.name}</p>
                            {ing.sku && <p className="text-[10px] text-slate-400 font-mono">SKU: {ing.sku}</p>}
                          </td>
                          <td className="px-4 py-3">
                            <span className="px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-[10px] font-bold text-slate-600 dark:text-slate-400">
                              {ing.category || 'General'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <p className={`font-mono font-bold ${current <= 0 ? 'text-rose-600' : 'text-amber-600'}`}>
                              {current.toLocaleString()} {bUnit}
                            </p>
                            {factor > 1 && (
                              <p className="text-[10px] text-slate-400">
                                ~{(current / factor).toFixed(2)} {pUnit}
                              </p>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right font-mono font-semibold text-slate-700 dark:text-slate-300">
                            {minAlert.toLocaleString()} {bUnit}
                          </td>
                          <td className="px-4 py-3 text-right font-mono font-bold text-rose-600">
                            -{deficit.toLocaleString()} {bUnit}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <p className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                              {suggestedPurch.toFixed(2)} {pUnit}
                            </p>
                            <p className="text-[10px] text-slate-400">
                              ({suggestedBase.toLocaleString()} {bUnit})
                            </p>
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-slate-600 dark:text-slate-300">
                            {currencySymbol} {pCost.toLocaleString()} / {pUnit}
                          </td>
                          <td className="px-4 py-3 text-right font-mono font-bold text-slate-900 dark:text-white">
                            {currencySymbol} {Math.round(estCost).toLocaleString()}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <Link
                              to="/app/purchases"
                              className="inline-flex items-center space-x-1 px-3 py-1 bg-brand-50 hover:bg-brand-100 dark:bg-brand-950/50 dark:hover:bg-brand-900/50 text-brand-700 dark:text-brand-300 rounded-lg text-xs font-bold border border-brand-200 dark:border-brand-800 transition-colors"
                            >
                              <Truck className="w-3 h-3" />
                              <span>Order</span>
                            </Link>
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
      <Modal
        isOpen={isAddIngredientOpen}
        onClose={() => setIsAddIngredientOpen(false)}
        title={
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-brand-50 dark:bg-brand-950/50 rounded-xl text-brand-600 dark:text-brand-400">
              <Boxes className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Register Raw Ingredient</h3>
              <p className="text-xs text-slate-500 font-normal mt-0.5">Define a raw material or pantry item for stock tracking and recipe usage</p>
            </div>
          </div>
        }
        maxWidth="2xl"
      >
        <form onSubmit={handleCreateIngredient} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="form-label">Ingredient Name <span className="text-rose-500">*</span></label>
              <input
                type="text"
                required
                value={ingForm.name}
                onChange={(e) => setIngForm({ ...ingForm, name: e.target.value })}
                placeholder="e.g. Chicken Boneless, Cooking Oil, Basmati Rice"
                className="form-input"
              />
            </div>
            <div>
              <label className="form-label">Category <span className="text-rose-500">*</span></label>
              <select
                value={ingForm.category}
                onChange={(e) => setIngForm({ ...ingForm, category: e.target.value })}
                className="form-select"
              >
                {INGREDIENT_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="form-label">SKU / Code <span className="text-rose-500">*</span></label>
              <input
                type="text"
                required
                value={ingForm.sku}
                onChange={(e) => setIngForm({ ...ingForm, sku: e.target.value })}
                placeholder="ING-CHK-01"
                className="form-input uppercase font-mono font-bold"
              />
            </div>

            <div>
              <label className="form-label">
                Unit of Measure (UOM) <span className="text-rose-500">*</span>
              </label>
              <select
                value={ingForm.unit}
                onChange={(e) => setIngForm({ ...ingForm, unit: e.target.value })}
                className="form-select font-bold"
              >
                {Object.values(STANDARD_UNITS).map((u) => (
                  <option key={u.code} value={u.code}>
                    {u.name} ({u.code})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="form-label">
                Cost per {ingForm.unit} ({currencySymbol}) <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                required
                value={ingForm.costPerUnit}
                onChange={(e) =>
                  setIngForm({ ...ingForm, costPerUnit: parseFloat(e.target.value) || 0 })
                }
                className="form-input font-mono font-bold text-slate-900 dark:text-white"
              />
            </div>

            <div>
              <label className="form-label">
                Initial Stock ({ingForm.unit}) <span className="text-rose-500">*</span>
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
                className="form-input font-mono font-bold text-slate-900 dark:text-white"
              />
            </div>

            <div>
              <label className="form-label">
                Low Stock Alert ({ingForm.unit}) <span className="text-rose-500">*</span>
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
                className="form-input font-mono text-slate-900 dark:text-white"
              />
            </div>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              className="w-full h-11 bg-brand-500 hover:bg-brand-600 text-white font-bold rounded-xl shadow-md hover:shadow-lg transition-all text-sm flex items-center justify-center space-x-2"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Save Ingredient & Register Initial Stock Lot</span>
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal: Edit Ingredient */}
      <Modal
        isOpen={isEditIngredientOpen}
        onClose={() => setIsEditIngredientOpen(false)}
        title={
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-brand-50 dark:bg-brand-950/50 rounded-xl text-brand-600 dark:text-brand-400">
              <Edit2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Edit Raw Ingredient</h3>
              <p className="text-xs text-slate-500 font-normal mt-0.5">Modify unit, category, and minimum stock alert levels</p>
            </div>
          </div>
        }
        maxWidth="2xl"
      >
        <form onSubmit={handleUpdateIngredient} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="form-label">Ingredient Name <span className="text-rose-500">*</span></label>
              <input
                type="text"
                required
                value={editIngForm.name}
                onChange={(e) => setEditIngForm({ ...editIngForm, name: e.target.value })}
                className="form-input"
              />
            </div>
            <div>
              <label className="form-label">Category <span className="text-rose-500">*</span></label>
              <select
                value={editIngForm.category}
                onChange={(e) => setEditIngForm({ ...editIngForm, category: e.target.value })}
                className="form-select"
              >
                {INGREDIENT_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="form-label">SKU / Code <span className="text-rose-500">*</span></label>
              <input
                type="text"
                required
                value={editIngForm.sku}
                onChange={(e) => setEditIngForm({ ...editIngForm, sku: e.target.value })}
                className="form-input uppercase font-mono font-bold"
              />
            </div>

            <div>
              <label className="form-label">
                Unit of Measure (UOM) <span className="text-rose-500">*</span>
              </label>
              <select
                value={editIngForm.unit}
                onChange={(e) => setEditIngForm({ ...editIngForm, unit: e.target.value })}
                className="form-select font-bold"
              >
                {Object.values(STANDARD_UNITS).map((u) => (
                  <option key={u.code} value={u.code}>
                    {u.name} ({u.code})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="form-label">
                Cost per {editIngForm.unit} ({currencySymbol}) <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                required
                value={editIngForm.costPerUnit}
                onChange={(e) =>
                  setEditIngForm({ ...editIngForm, costPerUnit: parseFloat(e.target.value) || 0 })
                }
                className="form-input font-mono font-bold"
              />
            </div>

            <div>
              <label className="form-label">
                Low Stock Alert Threshold ({editIngForm.unit}) <span className="text-rose-500">*</span>
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
                className="form-input font-mono"
              />
            </div>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              className="w-full h-11 bg-brand-500 hover:bg-brand-600 text-white font-bold rounded-xl shadow-md hover:shadow-lg transition-all text-sm flex items-center justify-center space-x-2"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Update Ingredient Settings</span>
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal: New Stock Transfer */}
      <Modal
        isOpen={isAddTransferOpen}
        onClose={() => setIsAddTransferOpen(false)}
        title={
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-blue-50 dark:bg-blue-950/50 rounded-xl text-blue-600 dark:text-blue-400">
              <ArrowRightLeft className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Initiate Inter-Branch Stock Transfer</h3>
              <p className="text-xs text-slate-500 font-normal mt-0.5">Transfer raw inventory lots between kitchen branches</p>
            </div>
          </div>
        }
        maxWidth="2xl"
      >
        <form onSubmit={handleCreateTransfer} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="form-label">Origin Branch (Source) <span className="text-rose-500">*</span></label>
              <select
                value={transferForm.fromBranchId}
                onChange={(e) => setTransferForm({ ...transferForm, fromBranchId: e.target.value })}
                className="form-select font-semibold"
              >
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} ({b.code})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="form-label">Destination Branch (Target) <span className="text-rose-500">*</span></label>
              <select
                value={transferForm.toBranchId}
                onChange={(e) => setTransferForm({ ...transferForm, toBranchId: e.target.value })}
                className="form-select font-semibold"
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
            <label className="form-label">Ingredient to Transfer <span className="text-rose-500">*</span></label>
            <select
              value={transferForm.ingredientId}
              onChange={(e) => setTransferForm({ ...transferForm, ingredientId: e.target.value })}
              className="form-select font-semibold"
            >
              {ingredients.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name} (Available: {Number(i.current_stock || 0)} {i.unit})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="form-label">Transfer Quantity <span className="text-rose-500">*</span></label>
            <input
              type="number"
              min="0.1"
              step="0.1"
              required
              value={transferForm.quantity}
              onChange={(e) => setTransferForm({ ...transferForm, quantity: parseFloat(e.target.value) || 0 })}
              className="form-input font-mono font-bold"
            />
          </div>

          <div>
            <label className="form-label">Notes / Transfer Reason <span className="text-slate-400 font-normal">(Optional)</span></label>
            <input
              type="text"
              value={transferForm.notes}
              onChange={(e) => setTransferForm({ ...transferForm, notes: e.target.value })}
              placeholder="e.g. Urgent stock replenishment for weekend rush"
              className="form-input"
            />
          </div>

          <div className="pt-2">
            <button
              type="submit"
              className="w-full h-11 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-md hover:shadow-lg transition-all text-sm flex items-center justify-center space-x-2"
            >
              <ArrowRightLeft className="w-4 h-4" />
              <span>Initiate Stock Transfer</span>
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal: Create Recipe */}
      <Modal
        isOpen={isAddRecipeOpen}
        onClose={() => setIsAddRecipeOpen(false)}
        title={
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-brand-50 dark:bg-brand-950/50 rounded-xl text-brand-600 dark:text-brand-400">
              <UtensilsCrossed className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Define Product Recipe (FIFO Link)</h3>
              <p className="text-xs text-slate-500 font-normal mt-0.5">Map raw materials and portion quantities to deduct automatically on sales</p>
            </div>
          </div>
        }
        maxWidth="3xl"
      >
        <form onSubmit={handleCreateRecipe} className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2">
              <label className="form-label">Menu Product <span className="text-rose-500">*</span></label>
              <select
                value={recipeForm.productId}
                onChange={(e) => setRecipeForm({ ...recipeForm, productId: e.target.value })}
                className="form-select font-semibold"
              >
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({currencySymbol} {Number(p.base_price).toLocaleString()})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="form-label">Yield Count <span className="text-rose-500">*</span></label>
              <input
                type="number"
                min="1"
                required
                value={recipeForm.yieldCount}
                onChange={(e) => setRecipeForm({ ...recipeForm, yieldCount: parseInt(e.target.value) || 1 })}
                className="form-input font-mono font-bold text-center"
              />
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between pb-1 border-b border-slate-200 dark:border-slate-800">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                Required Recipe Ingredients & Portions
              </span>
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
                className="inline-flex items-center space-x-1 text-xs font-bold text-brand-600 dark:text-brand-400 hover:underline"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Ingredient Line</span>
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
                <div key={idx} className="p-3 bg-slate-50 dark:bg-slate-850 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-2">
                  <div className="flex items-center space-x-3">
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
                        className="form-select font-semibold"
                      >
                        <option value="">Select ingredient...</option>
                        {ingredients.map((i) => (
                          <option key={i.id} value={i.id}>
                            {i.name} (Base Unit: {i.base_unit || i.unit})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="w-32">
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
                        className="form-input font-mono font-bold text-center"
                      />
                    </div>

                    <div className="w-32">
                      <select
                        value={item.recipeUnit || baseU}
                        onChange={(e) => {
                          const next = [...recipeForm.ingredients];
                          const newRecipeU = e.target.value;
                          next[idx].recipeUnit = newRecipeU;
                          next[idx].quantity = convertRecipeQtyToBase(next[idx].enteredQuantity || next[idx].quantity, newRecipeU, baseU, factor);
                          setRecipeForm({ ...recipeForm, ingredients: next });
                        }}
                        className="form-select font-mono font-bold"
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
                      className="p-2 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl transition-colors"
                      title="Remove Row"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="flex items-center justify-between text-xs px-1 text-slate-500 pt-1">
                    <span className="font-mono bg-white dark:bg-slate-900 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-800">
                      Converts to: <strong className="text-brand-600 dark:text-brand-400 font-bold">{baseQ} {baseU}</strong> base
                    </span>
                    <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 text-sm">
                      Line Cost: {currencySymbol} {lineCost.toFixed(2)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex justify-end space-x-3 pt-3 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setIsAddRecipeOpen(false)}
              className="px-5 py-2.5 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl text-sm font-bold transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-6 py-2.5 bg-brand-500 hover:bg-brand-600 text-white font-bold rounded-xl shadow-md hover:shadow-lg transition-all text-sm flex items-center space-x-2"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Save Recipe</span>
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal: Perform Inventory Operation */}
      <Modal
        isOpen={isAdjustmentOpen}
        onClose={() => setIsAdjustmentOpen(false)}
        title={
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-brand-50 dark:bg-brand-950/50 rounded-xl text-brand-600 dark:text-brand-400">
              <Scale className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Perform Inventory Operation</h3>
              <p className="text-xs text-slate-500 font-normal mt-0.5">Post stock adjustments, kitchen wastage, physical audit counts, or corrections</p>
            </div>
          </div>
        }
        maxWidth="2xl"
      >
        <form onSubmit={handleStockAdjustment} className="space-y-4">
          {(() => {
            const selectedIng = ingredients.find((i) => i.id === adjForm.ingredientId);
            const currentStockVal = Number(selectedIng?.current_stock || 0);
            const currentUnit = selectedIng?.base_unit || selectedIng?.unit || 'G';

            return (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="form-label">
                      Product / Ingredient <span className="text-rose-500">*</span>
                    </label>
                    <select
                      value={adjForm.ingredientId}
                      onChange={(e) => setAdjForm({ ...adjForm, ingredientId: e.target.value })}
                      className="form-select font-semibold"
                      required
                    >
                      {ingredients.map((i) => (
                        <option key={i.id} value={i.id}>
                          {i.name} ({i.unit || i.base_unit || 'G'})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="form-label">
                      Operation Type <span className="text-rose-500">*</span>
                    </label>
                    <select
                      value={adjForm.movementType}
                      onChange={(e) => {
                        const mType = e.target.value as any;
                        let defaultReason = 'Inventory Operation';
                        if (mType === StockMovementType.WASTAGE) defaultReason = 'Kitchen Wastage / Spoilage';
                        else if (mType === StockMovementType.DAMAGED) defaultReason = 'Damaged goods write-off';
                        else if (mType === StockMovementType.EXPIRED) defaultReason = 'Expired stock removal';
                        else if (mType === StockMovementType.ADJUSTMENT_ADD) defaultReason = 'Manual stock addition (surplus)';
                        else if (mType === StockMovementType.ADJUSTMENT_SUBTRACT) defaultReason = 'Manual stock deduction';
                        else if (mType === StockMovementType.PHYSICAL_COUNT) defaultReason = 'Physical stock count audit';
                        else if (mType === StockMovementType.OPENING_STOCK) defaultReason = 'Opening stock balance';
                        else if (mType === StockMovementType.CORRECTION) defaultReason = 'Data entry correction';

                        setAdjForm({
                          ...adjForm,
                          movementType: mType,
                          reason: defaultReason,
                        });
                      }}
                      className="form-select font-bold"
                    >
                      <option value={StockMovementType.ADJUSTMENT_ADD}>Stock Addition (Surplus / Inward)</option>
                      <option value={StockMovementType.ADJUSTMENT_SUBTRACT}>Stock Deduction (Manual reduction)</option>
                      <option value={StockMovementType.WASTAGE}>Wastage / Spoilage</option>
                      <option value={StockMovementType.DAMAGED}>Damaged Stock</option>
                      <option value={StockMovementType.EXPIRED}>Expired Stock</option>
                      <option value={StockMovementType.PHYSICAL_COUNT}>Physical Stock Count (Audit reconciliation)</option>
                      <option value={StockMovementType.OPENING_STOCK}>Opening Stock</option>
                      <option value={StockMovementType.CORRECTION}>Inventory Correction</option>
                    </select>
                  </div>
                </div>

                {/* Stock info banner */}
                <div className="bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 flex items-center justify-between">
                  <div>
                    <span className="text-xs text-slate-500 dark:text-slate-400 block font-medium">Currently Recorded Stock</span>
                    <span className="text-lg font-extrabold text-slate-900 dark:text-white font-mono">
                      {currentStockVal.toLocaleString(undefined, { maximumFractionDigits: 2 })} {currentUnit}
                    </span>
                  </div>
                  {adjForm.movementType === StockMovementType.PHYSICAL_COUNT && (
                    <div className="text-right">
                      <span className="text-xs text-slate-500 dark:text-slate-400 block font-medium">Count Discrepancy</span>
                      <span className={`text-lg font-extrabold font-mono ${adjForm.quantity - currentStockVal >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                        {adjForm.quantity - currentStockVal >= 0 ? '+' : ''}{(adjForm.quantity - currentStockVal).toLocaleString(undefined, { maximumFractionDigits: 2 })} {currentUnit}
                      </span>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="form-label">
                      {adjForm.movementType === StockMovementType.PHYSICAL_COUNT ? 'Counted Physical Stock' : 'Quantity'} ({currentUnit}) <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      required
                      value={adjForm.quantity}
                      onChange={(e) => setAdjForm({ ...adjForm, quantity: parseFloat(e.target.value) || 0 })}
                      className="form-input font-mono font-bold text-slate-900 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="form-label">Reason / Memo Note <span className="text-rose-500">*</span></label>
                    <input
                      type="text"
                      required
                      value={adjForm.reason}
                      onChange={(e) => setAdjForm({ ...adjForm, reason: e.target.value })}
                      placeholder="e.g. Daily shift recount, kitchen prep waste"
                      className="form-input"
                    />
                  </div>
                </div>

                <div className="pt-3 flex items-center justify-end space-x-3 border-t border-slate-200 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => setIsAdjustmentOpen(false)}
                    className="px-5 py-2.5 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl text-sm font-bold transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-6 py-2.5 bg-brand-500 hover:bg-brand-600 text-white font-bold rounded-xl shadow-md hover:shadow-lg transition-all text-sm flex items-center space-x-2"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Confirm & Post Operation</span>
                  </button>
                </div>
              </>
            );
          })()}
        </form>
      </Modal>

      {/* Ingredient Where-Used & Recipe Mapping Modal */}
      <IngredientUsageModal
        isOpen={usageModalOpen}
        onClose={() => setUsageModalOpen(false)}
        ingredientId={usageIngredientId}
        ingredientName={usageIngredientName}
        branchId={currentBranchId || undefined}
        currencySymbol={currencySymbol}
      />
    </div>
  );
};
