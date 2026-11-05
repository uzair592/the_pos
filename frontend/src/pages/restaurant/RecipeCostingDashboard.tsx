import React, { useState, useEffect, useMemo } from 'react';
import { api } from '../../api/client.js';
import { useAuth } from '../../context/AuthContext.js';
import { useToast } from '../../context/ToastContext.js';
import { StatCard } from '../../components/common/StatCard.js';
import { Modal } from '../../components/common/Modal.js';
import { ActionMenu } from '../../components/common/ActionMenu.js';
import {
  MenuItemProfitabilityItem,
  MenuProfitabilitySummary,
  CategoryFoodCostAnalysis,
  FoodCostTrendItem,
  BranchFoodCostComparison,
  TheoreticalVsActualItem,
  IngredientPriceHistoryItem,
} from '@pos/shared';
import {
  exportMenuItemProfitabilityPdf,
  exportFoodCostAnalysisPdf,
  exportTheoreticalVsActualPdf,
  exportIngredientCostHistoryPdf,
} from '../../utils/pdfExport.js';
import { exportToCsv } from '../../utils/csvExport.js';
import {
  Calculator,
  TrendingUp,
  TrendingDown,
  DollarSign,
  PieChart,
  BarChart3,
  Layers,
  Search,
  Filter,
  Download,
  Printer,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Eye,
  Sliders,
  Sparkles,
  ArrowUpDown,
  UtensilsCrossed,
  Package,
  History,
  Building2,
  Calendar,
  X,
  Plus,
  Scale,
  ShoppingBag,
} from 'lucide-react';

type CostingTab = 'MENU_PROFITABILITY' | 'FOOD_COST_ANALYSIS' | 'THEORETICAL_VS_ACTUAL' | 'INGREDIENT_PRICES';

export const RecipeCostingDashboard: React.FC = () => {
  const { tenant, branches, currentBranchId } = useAuth();
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState<CostingTab>('MENU_PROFITABILITY');
  const [selectedBranchId, setSelectedBranchId] = useState<string>(currentBranchId || '');

  // Date Range State
  const todayStr = new Date().toISOString().split('T')[0];
  const thirtyDaysAgoStr = new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split('T')[0];
  const [startDate, setStartDate] = useState<string>(thirtyDaysAgoStr);
  const [endDate, setEndDate] = useState<string>(todayStr);
  const [datePreset, setDatePreset] = useState<'today' | '7d' | '30d' | 'this_month' | 'custom'>('30d');

  // Loading States
  const [loading, setLoading] = useState<boolean>(true);
  const [recalculating, setRecalculating] = useState<boolean>(false);

  // Tab 1: Menu Profitability Data
  const [menuItems, setMenuItems] = useState<MenuItemProfitabilityItem[]>([]);
  const [summary, setSummary] = useState<MenuProfitabilitySummary | null>(null);
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sortBy, setSortBy] = useState<string>('foodCostDesc');

  // Tab 2: Food Cost Analysis Data
  const [analysisData, setAnalysisData] = useState<any>(null);
  const [analysisGroupBy, setAnalysisGroupBy] = useState<'day' | 'week' | 'month'>('day');

  // Tab 3: Theoretical vs Actual Data
  const [theoData, setTheoData] = useState<{ items: TheoreticalVsActualItem[]; summary: any } | null>(null);

  // Tab 4: Ingredient Price History Data
  const [ingredientPrices, setIngredientPrices] = useState<IngredientPriceHistoryItem[]>([]);
  const [selectedIngredientHistory, setSelectedIngredientHistory] = useState<IngredientPriceHistoryItem | null>(null);

  // Modals & Drawers
  const [selectedRecipeItem, setSelectedRecipeItem] = useState<MenuItemProfitabilityItem | null>(null);
  const [isRecipeModalOpen, setIsRecipeModalOpen] = useState<boolean>(false);
  const [isEditCostsOpen, setIsEditCostsOpen] = useState<boolean>(false);
  const [editPackagingCost, setEditPackagingCost] = useState<number>(0);
  const [editAdditionalCost, setEditAdditionalCost] = useState<number>(0);
  const [editTargetFoodCost, setEditTargetFoodCost] = useState<number>(30);
  const [editBasePrice, setEditBasePrice] = useState<number>(0);

  // Simulator State inside Recipe Modal
  const [simulatedPrice, setSimulatedPrice] = useState<number>(0);

  // Multi-item Compare State
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);
  const [isCompareModalOpen, setIsCompareModalOpen] = useState<boolean>(false);

  const currencySymbol = tenant?.currency || 'PKR';

  // Date Presets Handler
  const handleDatePreset = (preset: 'today' | '7d' | '30d' | 'this_month') => {
    setDatePreset(preset);
    const now = new Date();
    const end = now.toISOString().split('T')[0];
    let start = end;

    if (preset === '7d') {
      start = new Date(new Date().setDate(now.getDate() - 7)).toISOString().split('T')[0];
    } else if (preset === '30d') {
      start = new Date(new Date().setDate(now.getDate() - 30)).toISOString().split('T')[0];
    } else if (preset === 'this_month') {
      start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    }

    setStartDate(start);
    setEndDate(end);
  };

  // Fetch Categories on mount
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const res = await api.get<{ categories: { id: string; name: string }[] }>('/api/menu/categories');
        setCategories(res.categories || []);
      } catch (err) {
        console.error('Failed to load categories', err);
      }
    };
    fetchCategories();
  }, []);

  // Fetch Active Tab Data
  const fetchData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'MENU_PROFITABILITY') {
        const params: any = {};
        if (selectedBranchId) params.branchId = selectedBranchId;
        if (selectedCategory !== 'ALL') params.categoryId = selectedCategory;
        if (searchQuery) params.search = searchQuery;
        if (sortBy) params.sortBy = sortBy;

        const res = await api.get<{ items: MenuItemProfitabilityItem[]; summary: MenuProfitabilitySummary }>(
          '/api/costing/menu-profitability',
          { params }
        );
        setMenuItems(res.items || []);
        setSummary(res.summary || null);
      } else if (activeTab === 'FOOD_COST_ANALYSIS') {
        const params: any = {
          startDate: `${startDate}T00:00:00.000Z`,
          endDate: `${endDate}T23:59:59.999Z`,
          groupBy: analysisGroupBy,
        };
        if (selectedBranchId) params.branchId = selectedBranchId;

        const res = await api.get('/api/costing/food-cost-analysis', { params });
        setAnalysisData(res);
      } else if (activeTab === 'THEORETICAL_VS_ACTUAL') {
        const params: any = {
          startDate: `${startDate}T00:00:00.000Z`,
          endDate: `${endDate}T23:59:59.999Z`,
        };
        if (selectedBranchId) params.branchId = selectedBranchId;

        const res = await api.get<{ items: TheoreticalVsActualItem[]; summary: any }>(
          '/api/costing/theoretical-vs-actual',
          { params }
        );
        setTheoData(res);
      } else if (activeTab === 'INGREDIENT_PRICES') {
        const params: any = {};
        if (selectedBranchId) params.branchId = selectedBranchId;

        const res = await api.get<{ ingredients: IngredientPriceHistoryItem[] }>(
          '/api/costing/ingredient-price-history',
          { params }
        );
        setIngredientPrices(res.ingredients || []);
      }
    } catch (err: any) {
      toast(err.message || 'Failed to load costing metrics', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [activeTab, selectedBranchId, selectedCategory, sortBy, startDate, endDate, analysisGroupBy]);

  // Recalculate All Recipes
  const handleRecalculateAll = async () => {
    setRecalculating(true);
    try {
      const res = await api.post<{ message: string; updatedRecipesCount: number }>('/api/costing/recalculate-recipes');
      toast(`Recalculated ${res.updatedRecipesCount} menu recipes using latest ingredient costs!`, 'success');
      fetchData();
    } catch (err: any) {
      toast(err.message || 'Failed to recalculate recipes', 'error');
    } finally {
      setRecalculating(false);
    }
  };

  // Open Recipe Modal
  const handleOpenRecipeModal = (item: MenuItemProfitabilityItem) => {
    setSelectedRecipeItem(item);
    setSimulatedPrice(item.sellingPrice);
    setIsRecipeModalOpen(true);
  };

  // Open Edit Direct Costs
  const handleOpenEditCosts = (item: MenuItemProfitabilityItem) => {
    setSelectedRecipeItem(item);
    setEditPackagingCost(item.packagingCost);
    setEditAdditionalCost(item.additionalCost);
    setEditTargetFoodCost(item.targetFoodCostPercentage);
    setEditBasePrice(item.sellingPrice);
    setIsEditCostsOpen(true);
  };

  // Save Direct Costs
  const handleSaveDirectCosts = async () => {
    if (!selectedRecipeItem) return;
    try {
      await api.put(`/api/costing/recipe/${selectedRecipeItem.productId}/direct-costs`, {
        packagingCost: editPackagingCost,
        additionalCost: editAdditionalCost,
        targetFoodCostPercentage: editTargetFoodCost,
        basePrice: editBasePrice,
      });
      toast('Product direct costs and pricing updated successfully', 'success');
      setIsEditCostsOpen(false);
      fetchData();
      if (isRecipeModalOpen) {
        // Refresh detail
        const updated = await api.get<{ item: MenuItemProfitabilityItem }>(`/api/costing/recipe/${selectedRecipeItem.productId}`);
        setSelectedRecipeItem(updated.item);
        setSimulatedPrice(updated.item.sellingPrice);
      }
    } catch (err: any) {
      toast(err.message || 'Failed to update direct costs', 'error');
    }
  };

  // Toggle item comparison selection
  const handleToggleSelect = (productId: string) => {
    setSelectedItemIds((prev) => {
      if (prev.includes(productId)) return prev.filter((id) => id !== productId);
      if (prev.length >= 4) {
        toast('You can compare a maximum of 4 items simultaneously', 'info');
        return prev;
      }
      return [...prev, productId];
    });
  };

  const comparedItems = useMemo(() => {
    return menuItems.filter((i) => selectedItemIds.includes(i.productId));
  }, [menuItems, selectedItemIds]);

  // Export PDF Handler
  const handleExportPdf = () => {
    const meta = {
      name: tenant?.name || 'Restaurant POS',
      currency: currencySymbol,
      currencySymbol,
      branch: branches.find((b) => b.id === selectedBranchId)?.name || 'All Branches (Consolidated)',
    };

    if (activeTab === 'MENU_PROFITABILITY') {
      exportMenuItemProfitabilityPdf(menuItems, summary, meta);
    } else if (activeTab === 'FOOD_COST_ANALYSIS') {
      exportFoodCostAnalysisPdf(analysisData, meta, { startDate, endDate });
    } else if (activeTab === 'THEORETICAL_VS_ACTUAL') {
      exportTheoreticalVsActualPdf(theoData?.items || [], theoData?.summary, meta, { startDate, endDate });
    } else if (activeTab === 'INGREDIENT_PRICES') {
      exportIngredientCostHistoryPdf(ingredientPrices, meta);
    }
  };

  // Export CSV Handler
  const handleExportCsv = () => {
    if (activeTab === 'MENU_PROFITABILITY') {
      const headers = [
        'Product Name',
        'Category',
        'SKU',
        'Station',
        'Selling Price',
        'Ingredient Cost',
        'Packaging Cost',
        'Additional Cost',
        'Total Direct Cost',
        'Gross Profit',
        'Food Cost %',
        'Gross Margin %',
        'Status',
      ];
      const rows = menuItems.map((i) => [
        i.productName,
        i.categoryName,
        i.sku,
        i.station,
        i.sellingPrice,
        i.ingredientCost,
        i.packagingCost,
        i.additionalCost,
        i.totalDirectCost,
        i.grossProfit,
        i.foodCostPercentage,
        i.grossProfitMargin,
        i.status,
      ]);
      exportToCsv(`Menu_Item_Profitability_${todayStr}`, headers, rows);
    } else if (activeTab === 'FOOD_COST_ANALYSIS') {
      const headers = ['Category', 'Items', 'Net Sales', 'Food Cost (COGS)', 'Gross Profit', 'Food Cost %', 'Margin %'];
      const rows = (analysisData?.categoryBreakdown || []).map((c: any) => [
        c.categoryName,
        c.itemCount,
        c.totalSales,
        c.totalCogs,
        c.grossProfit,
        c.foodCostPercentage,
        c.grossProfitMargin,
      ]);
      exportToCsv(`Category_Food_Cost_Analysis_${startDate}_to_${endDate}`, headers, rows);
    } else if (activeTab === 'THEORETICAL_VS_ACTUAL') {
      const headers = [
        'Ingredient',
        'Category',
        'Base Unit',
        'Expected Qty',
        'Expected Cost',
        'Actual Qty',
        'Actual Cost',
        'Wastage Qty',
        'Quantity Variance',
        'Cost Variance',
        'Variance %',
        'Status',
      ];
      const rows = (theoData?.items || []).map((t) => [
        t.ingredientName,
        t.category,
        t.baseUnit,
        t.theoreticalQuantity,
        t.theoreticalCost,
        t.actualQuantity,
        t.actualCost,
        t.wastageQuantity,
        t.quantityVariance,
        t.costVariance,
        t.variancePercentage,
        t.status,
      ]);
      exportToCsv(`Theoretical_vs_Actual_${startDate}_to_${endDate}`, headers, rows);
    } else if (activeTab === 'INGREDIENT_PRICES') {
      const headers = [
        'Ingredient',
        'Category',
        'Base Unit',
        'Packaging Unit',
        'Current Base Cost',
        'Prev Purchase Cost',
        'Latest Purchase Cost',
        'Avg Purchase Cost',
        'Price Change %',
        'Recipes Affected',
      ];
      const rows = ingredientPrices.map((p) => [
        p.ingredientName,
        p.category,
        p.baseUnit,
        p.purchaseUnit,
        p.currentBaseCost,
        p.previousPurchaseCost,
        p.latestPurchaseCost,
        p.averagePurchaseCost,
        p.priceChangePercentage,
        p.recipesAffectedCount,
      ]);
      exportToCsv(`Ingredient_Price_History_${todayStr}`, headers, rows);
    }
  };

  // Status Badge Helper
  const renderStatusBadge = (status: string) => {
    switch (status) {
      case 'EXCELLENT':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
            <CheckCircle2 className="w-3 h-3 mr-1" />
            Excellent (&le;28%)
          </span>
        );
      case 'HEALTHY':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300">
            Healthy (28-35%)
          </span>
        );
      case 'WARNING':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
            <AlertTriangle className="w-3 h-3 mr-1" />
            Warning (35-45%)
          </span>
        );
      case 'CRITICAL':
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300">
            <AlertCircle className="w-3 h-3 mr-1" />
            Critical (&gt;45%)
          </span>
        );
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-[1600px] mx-auto min-h-screen">
      {/* 1. Header & Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-2 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-brand-500/10 dark:bg-brand-500/20 text-brand-600 dark:text-brand-400 flex items-center justify-center">
              <Calculator className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                Recipe Costing & Profitability
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                Food cost analytics, ingredient pricing, theoretical consumption, and menu gross profit margins
              </p>
            </div>
          </div>
        </div>

        {/* Global Controls: Branch & Export Actions */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Branch Selector */}
          <div className="flex items-center space-x-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5 shadow-sm text-xs">
            <Building2 className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={selectedBranchId}
              onChange={(e) => setSelectedBranchId(e.target.value)}
              className="bg-transparent border-none text-slate-800 dark:text-slate-200 font-semibold focus:outline-none cursor-pointer"
            >
              <option value="">All Branches (Consolidated)</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>

          {/* Recalculate Button */}
          <button
            onClick={handleRecalculateAll}
            disabled={recalculating}
            className="flex items-center space-x-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-semibold transition-all shadow-sm disabled:opacity-50"
            title="Recalculate all recipes using latest ingredient purchase costs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${recalculating ? 'animate-spin text-brand-500' : ''}`} />
            <span>Recalculate</span>
          </button>

          {/* Export A4 PDF */}
          <button
            onClick={handleExportPdf}
            className="flex items-center space-x-1.5 px-3.5 py-2 bg-brand-500 hover:bg-brand-600 text-white rounded-xl text-xs font-bold transition-all shadow-sm shadow-brand-500/20"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>A4 PDF</span>
          </button>

          {/* Export CSV / Excel */}
          <button
            onClick={handleExportCsv}
            className="flex items-center space-x-1.5 px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-semibold transition-all shadow-sm"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Excel / CSV</span>
          </button>
        </div>
      </div>

      {/* 2. Interactive Navigation Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-slate-900 p-1.5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            onClick={() => setActiveTab('MENU_PROFITABILITY')}
            className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl font-bold text-xs transition-all ${
              activeTab === 'MENU_PROFITABILITY'
                ? 'bg-brand-500 text-white shadow-md shadow-brand-500/25'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/60'
            }`}
          >
            <DollarSign className="w-4 h-4" />
            <span>Menu Item Costing & Profitability</span>
            {menuItems.length > 0 && (
              <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-black ${
                activeTab === 'MENU_PROFITABILITY' ? 'bg-white/20 text-white' : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
              }`}>
                {menuItems.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('FOOD_COST_ANALYSIS')}
            className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl font-bold text-xs transition-all ${
              activeTab === 'FOOD_COST_ANALYSIS'
                ? 'bg-brand-500 text-white shadow-md shadow-brand-500/25'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/60'
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            <span>Food Cost Analysis & Trends</span>
          </button>

          <button
            onClick={() => setActiveTab('THEORETICAL_VS_ACTUAL')}
            className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl font-bold text-xs transition-all ${
              activeTab === 'THEORETICAL_VS_ACTUAL'
                ? 'bg-brand-500 text-white shadow-md shadow-brand-500/25'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/60'
            }`}
          >
            <Scale className="w-4 h-4" />
            <span>Theoretical vs Actual (Wastage)</span>
            {theoData?.items && theoData.items.some((i) => i.status === 'INVESTIGATE') && (
              <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
            )}
          </button>

          <button
            onClick={() => setActiveTab('INGREDIENT_PRICES')}
            className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl font-bold text-xs transition-all ${
              activeTab === 'INGREDIENT_PRICES'
                ? 'bg-brand-500 text-white shadow-md shadow-brand-500/25'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/60'
            }`}
          >
            <History className="w-4 h-4" />
            <span>Ingredient Cost History</span>
          </button>
        </div>

        {/* Date Filter (Used in tabs 2 and 3) */}
        {(activeTab === 'FOOD_COST_ANALYSIS' || activeTab === 'THEORETICAL_VS_ACTUAL') && (
          <div className="flex flex-wrap items-center gap-2 pr-2">
            <div className="flex bg-slate-100 dark:bg-slate-800/80 p-0.5 rounded-lg text-xs font-semibold">
              <button
                onClick={() => handleDatePreset('today')}
                className={`px-2.5 py-1 rounded-md transition-all ${datePreset === 'today' ? 'bg-white dark:bg-slate-700 shadow-sm text-brand-600 dark:text-brand-400' : 'text-slate-500'}`}
              >
                Today
              </button>
              <button
                onClick={() => handleDatePreset('7d')}
                className={`px-2.5 py-1 rounded-md transition-all ${datePreset === '7d' ? 'bg-white dark:bg-slate-700 shadow-sm text-brand-600 dark:text-brand-400' : 'text-slate-500'}`}
              >
                7D
              </button>
              <button
                onClick={() => handleDatePreset('30d')}
                className={`px-2.5 py-1 rounded-md transition-all ${datePreset === '30d' ? 'bg-white dark:bg-slate-700 shadow-sm text-brand-600 dark:text-brand-400' : 'text-slate-500'}`}
              >
                30D
              </button>
              <button
                onClick={() => handleDatePreset('this_month')}
                className={`px-2.5 py-1 rounded-md transition-all ${datePreset === 'this_month' ? 'bg-white dark:bg-slate-700 shadow-sm text-brand-600 dark:text-brand-400' : 'text-slate-500'}`}
              >
                Month
              </button>
            </div>

            <div className="flex items-center space-x-1.5 text-xs text-slate-600 dark:text-slate-400">
              <input
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  setDatePreset('custom');
                }}
                className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 text-xs"
              />
              <span>to</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value);
                  setDatePreset('custom');
                }}
                className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 text-xs"
              />
            </div>
          </div>
        )}
      </div>

      {/* =========================================================================
          TAB 1: MENU ITEM COSTING & PROFITABILITY
          ========================================================================= */}
      {activeTab === 'MENU_PROFITABILITY' && (
        <div className="space-y-6">
          {/* Summary KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3.5">
            <StatCard
              title="Total Menu Items"
              value={summary?.totalMenuItems || menuItems.length}
              subtitle={`${summary?.itemsWithRecipes || 0} items with recipes`}
              icon={UtensilsCrossed}
            />
            <StatCard
              title="Avg Food Cost %"
              value={`${summary?.avgFoodCostPercentage || 0}%`}
              subtitle={summary?.avgFoodCostPercentage && summary.avgFoodCostPercentage <= 32 ? 'Optimal portfolio margin' : 'Review high cost items'}
              icon={PieChart}
              color="blue"
            />
            <StatCard
              title="Total Recipe Direct Cost"
              value={`${currencySymbol} ${(summary?.totalRecipeCost || 0).toLocaleString()}`}
              subtitle="Sum of portfolio direct costs"
              icon={DollarSign}
            />
            <StatCard
              title="Avg Gross Profit / Item"
              value={`${currencySymbol} ${(summary?.avgGrossProfit || 0).toLocaleString()}`}
              subtitle="Before general overheads"
              icon={TrendingUp}
              color="green"
            />
            <StatCard
              title="Highest Food Cost"
              value={summary?.highestFoodCostItem ? `${summary.highestFoodCostItem.foodCostPercentage}%` : 'N/A'}
              subtitle={summary?.highestFoodCostItem?.name || 'No recipes'}
              icon={AlertTriangle}
              color="amber"
            />
            <StatCard
              title="Most Profitable Item"
              value={summary?.mostProfitableItem ? `${currencySymbol} ${summary.mostProfitableItem.grossProfit.toLocaleString()}` : 'N/A'}
              subtitle={summary?.mostProfitableItem ? `${summary.mostProfitableItem.name} (${summary.mostProfitableItem.grossProfitMargin}%)` : 'No recipes'}
              icon={Sparkles}
              color="green"
            />
          </div>

          {/* Educational Notice Banner (Gross Profit vs Net Profit) */}
          <div className="flex items-start space-x-3 p-3.5 bg-amber-500/10 border border-amber-500/20 rounded-2xl text-amber-900 dark:text-amber-200 text-xs">
            <HelpCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <span className="font-bold">Understanding Gross Profit vs Net Profit:</span>
              <p className="text-amber-800 dark:text-amber-300 leading-relaxed">
                Gross Profit in this module strictly measures <strong>Selling Price minus Direct Raw Material & Packaging Costs</strong>. Operating expenses such as staff salaries, restaurant rent, electricity/gas utilities, platform fees, and government taxes are not deducted here.
              </p>
            </div>
          </div>

          {/* Search, Filter Pills & Sort Bar */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
            {/* Search Box */}
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search menu items by name or SKU..."
                className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-brand-500 text-slate-900 dark:text-slate-100"
              />
            </div>

            {/* Category Filter Pills & Sort Dropdown */}
            <div className="flex flex-wrap items-center gap-2.5">
              {/* Category Pills */}
              <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 max-w-full">
                <button
                  onClick={() => setSelectedCategory('ALL')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 ${
                    selectedCategory === 'ALL'
                      ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-sm'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
                  }`}
                >
                  All Categories
                </button>
                {categories.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => setSelectedCategory(c.id)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all shrink-0 ${
                      selectedCategory === c.id
                        ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-sm'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
                    }`}
                  >
                    {c.name}
                  </button>
                ))}
              </div>

              {/* Sort Dropdown */}
              <div className="flex items-center space-x-2 border-l border-slate-200 dark:border-slate-800 pl-3">
                <span className="text-xs text-slate-400 font-medium">Sort:</span>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 text-xs font-semibold rounded-xl px-2.5 py-1.5 focus:outline-none cursor-pointer"
                >
                  <option value="foodCostDesc">Highest Food Cost %</option>
                  <option value="foodCostAsc">Lowest Food Cost %</option>
                  <option value="profitDesc">Highest Gross Profit</option>
                  <option value="profitAsc">Lowest Gross Profit</option>
                  <option value="marginDesc">Highest Gross Margin %</option>
                  <option value="priceDesc">Highest Selling Price</option>
                  <option value="nameAsc">Menu Item A - Z</option>
                </select>
              </div>

              {/* Compare Button (Active when items selected) */}
              {selectedItemIds.length > 0 && (
                <button
                  onClick={() => setIsCompareModalOpen(true)}
                  className="flex items-center space-x-1.5 px-3 py-1.5 bg-brand-500 hover:bg-brand-600 text-white rounded-xl text-xs font-bold transition-all shadow-md animate-bounce"
                >
                  <Sliders className="w-3.5 h-3.5" />
                  <span>Compare ({selectedItemIds.length})</span>
                </button>
              )}
            </div>
          </div>

          {/* Detailed Menu Items Profitability Table */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 uppercase tracking-wider font-bold border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="py-3.5 px-3 w-10 text-center">
                      <span className="sr-only">Select</span>
                    </th>
                    <th className="py-3.5 px-4 font-bold">Menu Item Name</th>
                    <th className="py-3.5 px-3">Category</th>
                    <th className="py-3.5 px-4 text-right">Selling Price</th>
                    <th className="py-3.5 px-4 text-right">Raw Food Cost</th>
                    <th className="py-3.5 px-3 text-right">Packaging</th>
                    <th className="py-3.5 px-4 text-right">Gross Profit</th>
                    <th className="py-3.5 px-4 text-center">Food Cost %</th>
                    <th className="py-3.5 px-3 text-center">Gross Margin</th>
                    <th className="py-3.5 px-3 text-center">Status</th>
                    <th className="py-3.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium text-slate-700 dark:text-slate-300">
                  {loading ? (
                    <tr>
                      <td colSpan={11} className="py-12 text-center text-slate-400">
                        <div className="flex flex-col items-center justify-center space-y-2">
                          <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
                          <span>Computing recipe costs and margins...</span>
                        </div>
                      </td>
                    </tr>
                  ) : menuItems.length === 0 ? (
                    <tr>
                      <td colSpan={11} className="py-12 text-center text-slate-400">
                        No menu items found matching the selected filter.
                      </td>
                    </tr>
                  ) : (
                    menuItems.map((item) => {
                      const isSelected = selectedItemIds.includes(item.productId);
                      return (
                        <tr
                          key={item.productId}
                          className={`hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors ${
                            isSelected ? 'bg-brand-50/20 dark:bg-brand-950/20' : ''
                          }`}
                        >
                          <td className="py-3 px-3 text-center">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => handleToggleSelect(item.productId)}
                              className="w-4 h-4 rounded text-brand-600 focus:ring-brand-500 border-slate-300 cursor-pointer"
                            />
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center space-x-2">
                              <div>
                                <span className="font-bold text-slate-900 dark:text-white block hover:text-brand-500 cursor-pointer" onClick={() => handleOpenRecipeModal(item)}>
                                  {item.productName}
                                </span>
                                <div className="flex items-center space-x-2 text-[10px] text-slate-400">
                                  <span>SKU: {item.sku}</span>
                                  <span>&bull;</span>
                                  <span className="uppercase">{item.station}</span>
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-3 text-slate-500">{item.categoryName}</td>
                          <td className="py-3 px-4 text-right font-bold text-slate-900 dark:text-white">
                            {currencySymbol} {item.sellingPrice.toLocaleString()}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <span className="font-semibold text-slate-700 dark:text-slate-300">
                              {currencySymbol} {item.ingredientCost.toLocaleString()}
                            </span>
                            <span className="block text-[10px] text-slate-400">
                              {item.ingredientCount} ingredients
                            </span>
                          </td>
                          <td className="py-3 px-3 text-right text-slate-500">
                            {currencySymbol} {(item.packagingCost + item.additionalCost).toLocaleString()}
                          </td>
                          <td className="py-3 px-4 text-right font-bold text-emerald-600 dark:text-emerald-400">
                            {currencySymbol} {item.grossProfit.toLocaleString()}
                          </td>
                          <td className="py-3 px-4 text-center">
                            <div className="flex flex-col items-center">
                              <span
                                className={`font-black text-xs ${
                                  item.foodCostPercentage > 45
                                    ? 'text-rose-600 dark:text-rose-400'
                                    : item.foodCostPercentage > 35
                                    ? 'text-amber-600 dark:text-amber-400'
                                    : 'text-emerald-600 dark:text-emerald-400'
                                }`}
                              >
                                {item.foodCostPercentage}%
                              </span>
                              {/* Mini progress bar */}
                              <div className="w-16 h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full mt-1 overflow-hidden">
                                <div
                                  className={`h-full rounded-full ${
                                    item.foodCostPercentage > 45
                                      ? 'bg-rose-500'
                                      : item.foodCostPercentage > 35
                                      ? 'bg-amber-500'
                                      : 'bg-emerald-500'
                                  }`}
                                  style={{ width: `${Math.min(100, item.foodCostPercentage)}%` }}
                                />
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-3 text-center font-bold text-slate-800 dark:text-slate-200">
                            {item.grossProfitMargin}%
                          </td>
                          <td className="py-3 px-3 text-center">{renderStatusBadge(item.status)}</td>
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end space-x-1">
                              <button
                                onClick={() => handleOpenRecipeModal(item)}
                                className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors"
                                title="View Recipe Cost Breakdown & Pricing Simulator"
                              >
                                <Eye className="w-4 h-4 text-brand-500" />
                              </button>
                              <ActionMenu
                                items={[
                                  {
                                    label: 'Recipe Cost Breakdown',
                                    icon: Eye,
                                    onClick: () => handleOpenRecipeModal(item),
                                  },
                                  {
                                    label: 'Edit Packaging & Direct Costs',
                                    icon: Package,
                                    onClick: () => handleOpenEditCosts(item),
                                  },
                                  {
                                    label: 'Live Pricing Simulator',
                                    icon: Sliders,
                                    onClick: () => handleOpenRecipeModal(item),
                                  },
                                ]}
                              />
                            </div>
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

      {/* =========================================================================
          TAB 2: FOOD COST ANALYSIS & TRENDS
          ========================================================================= */}
      {activeTab === 'FOOD_COST_ANALYSIS' && (
        <div className="space-y-6">
          {/* Overall Metrics Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <StatCard
              title="Total Net Sales"
              value={`${currencySymbol} ${(analysisData?.overall?.netSales || 0).toLocaleString()}`}
              subtitle={`${analysisData?.overall?.orderCount || 0} completed orders`}
              icon={DollarSign}
            />
            <StatCard
              title="Total Food Cost (COGS)"
              value={`${currencySymbol} ${(analysisData?.overall?.totalCogs || 0).toLocaleString()}`}
              subtitle="FIFO batch consumption"
              icon={ShoppingBag}
              color="orange"
            />
            <StatCard
              title="Overall Food Cost %"
              value={`${analysisData?.overall?.overallFoodCostPercent || 0}%`}
              subtitle={analysisData?.overall?.overallFoodCostPercent <= 32 ? 'Target (<32%) met' : 'Above target threshold'}
              icon={PieChart}
              color={analysisData?.overall?.overallFoodCostPercent > 35 ? 'amber' : 'blue'}
            />
            <StatCard
              title="Overall Gross Margin"
              value={`${currencySymbol} ${(analysisData?.overall?.grossProfit || 0).toLocaleString()} (${analysisData?.overall?.overallGrossMargin || 0}%)`}
              subtitle="Total revenue retained"
              icon={TrendingUp}
              color="green"
            />
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* 1. Food Cost & Sales Trend */}
            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    Food Cost % & Sales Trend
                  </h3>
                  <p className="text-xs text-slate-400">Net sales vs raw food cost over time</p>
                </div>
                <div className="flex space-x-1 bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg text-xs font-semibold">
                  <button
                    onClick={() => setAnalysisGroupBy('day')}
                    className={`px-2 py-0.5 rounded ${analysisGroupBy === 'day' ? 'bg-white dark:bg-slate-700 shadow-xs' : 'text-slate-400'}`}
                  >
                    Day
                  </button>
                  <button
                    onClick={() => setAnalysisGroupBy('week')}
                    className={`px-2 py-0.5 rounded ${analysisGroupBy === 'week' ? 'bg-white dark:bg-slate-700 shadow-xs' : 'text-slate-400'}`}
                  >
                    Week
                  </button>
                  <button
                    onClick={() => setAnalysisGroupBy('month')}
                    className={`px-2 py-0.5 rounded ${analysisGroupBy === 'month' ? 'bg-white dark:bg-slate-700 shadow-xs' : 'text-slate-400'}`}
                  >
                    Month
                  </button>
                </div>
              </div>

              {/* Trend SVG Chart */}
              <div className="h-64 flex flex-col justify-end pt-4">
                {analysisData?.trends && analysisData.trends.length > 0 ? (
                  <div className="h-full flex items-end gap-2 overflow-x-auto pb-4">
                    {analysisData.trends.map((tr: FoodCostTrendItem, idx: number) => {
                      const maxSales = Math.max(...analysisData.trends.map((t: any) => t.netSales), 1);
                      const barHeight = (tr.netSales / maxSales) * 160;
                      return (
                        <div key={idx} className="flex flex-col items-center min-w-[48px] space-y-1.5 group cursor-pointer">
                          <span className="text-[10px] font-bold text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity">
                            {tr.foodCostPercentage}%
                          </span>
                          <div className="w-7 bg-slate-100 dark:bg-slate-800 rounded-t-md relative flex flex-col justify-end" style={{ height: `${Math.max(20, barHeight)}px` }}>
                            {/* Food cost portion inside bar */}
                            <div
                              className="w-full bg-brand-500 rounded-t-md transition-all"
                              style={{ height: `${Math.min(100, tr.foodCostPercentage)}%` }}
                              title={`${tr.period}: ${currencySymbol} ${tr.netSales.toLocaleString()} sales, ${tr.foodCostPercentage}% food cost`}
                            />
                          </div>
                          <span className="text-[10px] text-slate-400 truncate max-w-[48px]">
                            {tr.period.split('-').slice(1).join('/')}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="h-full flex items-center justify-center text-xs text-slate-400">
                    No order sales in this period.
                  </div>
                )}
              </div>
            </div>

            {/* 2. Category Profitability Breakdown */}
            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Category-Wise Food Cost % & Margins
                </h3>
                <p className="text-xs text-slate-400">Comparing menu categories against the 30% target benchmark</p>
              </div>

              <div className="space-y-3.5 pt-2 max-h-64 overflow-y-auto">
                {analysisData?.categoryBreakdown && analysisData.categoryBreakdown.length > 0 ? (
                  analysisData.categoryBreakdown.map((cat: CategoryFoodCostAnalysis) => (
                    <div key={cat.categoryId} className="space-y-1.5">
                      <div className="flex justify-between items-center text-xs">
                        <span className="font-bold text-slate-800 dark:text-slate-200">{cat.categoryName}</span>
                        <div className="flex items-center space-x-3 text-slate-500">
                          <span>{currencySymbol} {cat.totalSales.toLocaleString()}</span>
                          <span className={`font-black ${cat.foodCostPercentage > 35 ? 'text-rose-500' : 'text-emerald-500'}`}>
                            {cat.foodCostPercentage}% Food Cost
                          </span>
                        </div>
                      </div>
                      <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden flex">
                        <div
                          className={`h-full ${cat.foodCostPercentage > 35 ? 'bg-rose-500' : cat.foodCostPercentage > 28 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                          style={{ width: `${Math.min(100, cat.foodCostPercentage)}%` }}
                        />
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-10 text-xs text-slate-400">No category sales recorded yet.</div>
                )}
              </div>
            </div>
          </div>

          {/* Top 10 Most Profitable vs Top 10 Highest Food Cost */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Most Profitable Menu Items */}
            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
              <div className="flex items-center space-x-2">
                <Sparkles className="w-5 h-5 text-emerald-500" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">Top 10 Most Profitable Menu Items</h3>
              </div>
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {analysisData?.topProfitable && analysisData.topProfitable.length > 0 ? (
                  analysisData.topProfitable.map((p: any, idx: number) => (
                    <div key={p.productId} className="py-2.5 flex items-center justify-between text-xs">
                      <div className="flex items-center space-x-2">
                        <span className="w-5 font-bold text-slate-400">#{idx + 1}</span>
                        <div>
                          <span className="font-bold text-slate-800 dark:text-slate-200">{p.productName}</span>
                          <span className="text-[10px] text-slate-400 block">{p.quantitySold} units sold</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="font-black text-emerald-600 dark:text-emerald-400 block">
                          +{currencySymbol} {p.grossProfit.toLocaleString()}
                        </span>
                        <span className="text-[10px] text-slate-400">{p.grossProfitMargin}% margin</span>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="py-6 text-center text-xs text-slate-400">No item sales recorded.</div>
                )}
              </div>
            </div>

            {/* Highest Food Cost Menu Items (Require Investigation) */}
            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
              <div className="flex items-center space-x-2">
                <AlertTriangle className="w-5 h-5 text-rose-500" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">Top 10 Highest Food Cost Items</h3>
              </div>
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {analysisData?.highestFoodCost && analysisData.highestFoodCost.length > 0 ? (
                  analysisData.highestFoodCost.map((p: any, idx: number) => (
                    <div key={p.productId} className="py-2.5 flex items-center justify-between text-xs">
                      <div className="flex items-center space-x-2">
                        <span className="w-5 font-bold text-slate-400">#{idx + 1}</span>
                        <div>
                          <span className="font-bold text-slate-800 dark:text-slate-200">{p.productName}</span>
                          <span className="text-[10px] text-slate-400 block">{p.quantitySold} units sold</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="font-black text-rose-600 dark:text-rose-400 block">
                          {p.foodCostPercentage}%
                        </span>
                        <span className="text-[10px] text-slate-400">Food Cost</span>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="py-6 text-center text-xs text-slate-400">No item sales recorded.</div>
                )}
              </div>
            </div>
          </div>

          {/* Branch Comparison Table */}
          {analysisData?.branchComparison && analysisData.branchComparison.length > 0 && (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden p-5 space-y-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Multi-Branch Costing & Performance Comparison
                </h3>
                <p className="text-xs text-slate-400">Benchmark food costs and gross profit across different restaurant locations</p>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 uppercase font-bold border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="py-3 px-4">Branch Name</th>
                      <th className="py-3 px-4 text-center">Orders</th>
                      <th className="py-3 px-4 text-right">Net Sales</th>
                      <th className="py-3 px-4 text-right">Food Cost (COGS)</th>
                      <th className="py-3 px-4 text-right">Gross Profit</th>
                      <th className="py-3 px-4 text-center">Food Cost %</th>
                      <th className="py-3 px-4 text-center">Gross Margin %</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                    {analysisData.branchComparison.map((b: BranchFoodCostComparison) => (
                      <tr key={b.branchId} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                        <td className="py-3 px-4 font-bold text-slate-900 dark:text-white">{b.branchName}</td>
                        <td className="py-3 px-4 text-center text-slate-500">{b.orderCount}</td>
                        <td className="py-3 px-4 text-right font-bold text-slate-900 dark:text-white">
                          {currencySymbol} {b.netSales.toLocaleString()}
                        </td>
                        <td className="py-3 px-4 text-right text-slate-700 dark:text-slate-300">
                          {currencySymbol} {b.cogs.toLocaleString()}
                        </td>
                        <td className="py-3 px-4 text-right font-bold text-emerald-600 dark:text-emerald-400">
                          {currencySymbol} {b.grossProfit.toLocaleString()}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className={`font-bold ${b.foodCostPercentage > 35 ? 'text-rose-500' : 'text-emerald-500'}`}>
                            {b.foodCostPercentage}%
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center font-bold text-slate-800 dark:text-slate-200">
                          {b.grossProfitMargin}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* =========================================================================
          TAB 3: THEORETICAL VS ACTUAL FOOD COST
          ========================================================================= */}
      {activeTab === 'THEORETICAL_VS_ACTUAL' && (
        <div className="space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <StatCard
              title="Theoretical Cost (Expected)"
              value={`${currencySymbol} ${(theoData?.summary?.totalTheoreticalCost || 0).toLocaleString()}`}
              subtitle="Completed recipe sales requirement"
              icon={Calculator}
            />
            <StatCard
              title="Actual Inventory Consumption"
              value={`${currencySymbol} ${(theoData?.summary?.totalActualCost || 0).toLocaleString()}`}
              subtitle="Batch depletion + movements"
              icon={Package}
              color="blue"
            />
            <StatCard
              title="Recorded Wastage / Loss"
              value={`${currencySymbol} ${(theoData?.summary?.totalWastageCost || 0).toLocaleString()}`}
              subtitle="Trimming, spoilage & damages"
              icon={AlertTriangle}
              color="amber"
            />
            <StatCard
              title="Net Consumption Variance"
              value={`${currencySymbol} ${(theoData?.summary?.totalCostVariance || 0).toLocaleString()} (${Number(theoData?.summary?.variancePercentage || 0).toFixed(1)}%)`}
              subtitle="Unaccounted variance requiring audit"
              icon={TrendingUp}
              color={theoData?.summary?.totalCostVariance > 0 ? 'amber' : 'green'}
            />
          </div>

          {/* Explanation Alert */}
          <div className="p-3.5 bg-blue-500/10 border border-blue-500/20 rounded-2xl text-blue-900 dark:text-blue-200 text-xs flex items-start space-x-3">
            <HelpCircle className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              <strong>How Theoretical vs Actual Works:</strong> Theoretical consumption is the ideal ingredient usage based on completed orders multiplied by recipe consumption. Actual consumption accounts for real FIFO batch deductions, kitchen prep wastage, and inventory stock adjustments. Variances exceeding 8% are highlighted for kitchen portion audit.
            </p>
          </div>

          {/* Theoretical vs Actual Table */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 uppercase font-bold border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="py-3 px-4 font-bold">Raw Ingredient</th>
                    <th className="py-3 px-3">Category</th>
                    <th className="py-3 px-2 text-center">Unit</th>
                    <th className="py-3 px-3 text-right">Expected Qty</th>
                    <th className="py-3 px-3 text-right">Expected Cost</th>
                    <th className="py-3 px-3 text-right">Actual Qty</th>
                    <th className="py-3 px-3 text-right">Actual Cost</th>
                    <th className="py-3 px-3 text-right">Wastage</th>
                    <th className="py-3 px-3 text-right">Variance Qty</th>
                    <th className="py-3 px-3 text-right">Cost Variance</th>
                    <th className="py-3 px-3 text-center">Variance %</th>
                    <th className="py-3 px-4 text-center">Audit Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                  {loading ? (
                    <tr>
                      <td colSpan={12} className="py-12 text-center text-slate-400">
                        Calculating ingredient variances...
                      </td>
                    </tr>
                  ) : !theoData?.items || theoData.items.length === 0 ? (
                    <tr>
                      <td colSpan={12} className="py-12 text-center text-slate-400">
                        No recipe-based ingredient consumption found for the selected period.
                      </td>
                    </tr>
                  ) : (
                    theoData.items.map((row) => (
                      <tr key={row.ingredientId} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                        <td className="py-3 px-4 font-bold text-slate-900 dark:text-white">{row.ingredientName}</td>
                        <td className="py-3 px-3 text-slate-500">{row.category}</td>
                        <td className="py-3 px-2 text-center font-bold text-slate-400">{row.baseUnit}</td>
                        <td className="py-3 px-3 text-right">{row.theoreticalQuantity.toLocaleString()}</td>
                        <td className="py-3 px-3 text-right font-semibold text-slate-700 dark:text-slate-300">
                          {currencySymbol} {row.theoreticalCost.toLocaleString()}
                        </td>
                        <td className="py-3 px-3 text-right font-bold text-slate-900 dark:text-white">
                          {row.actualQuantity.toLocaleString()}
                        </td>
                        <td className="py-3 px-3 text-right font-bold text-slate-900 dark:text-white">
                          {currencySymbol} {row.actualCost.toLocaleString()}
                        </td>
                        <td className="py-3 px-3 text-right text-rose-500 font-semibold">
                          {row.wastageQuantity > 0 ? `${row.wastageQuantity} ${row.baseUnit}` : '-'}
                        </td>
                        <td className={`py-3 px-3 text-right font-bold ${row.quantityVariance > 0 ? 'text-rose-500' : 'text-emerald-500'}`}>
                          {row.quantityVariance > 0 ? `+${row.quantityVariance}` : row.quantityVariance}
                        </td>
                        <td className={`py-3 px-3 text-right font-bold ${row.costVariance > 0 ? 'text-rose-500' : 'text-emerald-500'}`}>
                          {row.costVariance > 0 ? `+${currencySymbol} ${row.costVariance.toLocaleString()}` : `${currencySymbol} ${row.costVariance.toLocaleString()}`}
                        </td>
                        <td className="py-3 px-3 text-center">
                          <span className={`font-bold ${row.variancePercentage > 8 ? 'text-rose-500' : 'text-slate-700 dark:text-slate-300'}`}>
                            {row.variancePercentage > 0 ? `+${row.variancePercentage}%` : `${row.variancePercentage}%`}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          {row.status === 'NORMAL' ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                              <CheckCircle2 className="w-3 h-3 mr-1" /> Normal
                            </span>
                          ) : row.status === 'WATCH' ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
                              <AlertTriangle className="w-3 h-3 mr-1" /> Watch
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 animate-pulse">
                              <AlertCircle className="w-3 h-3 mr-1" /> Investigate
                            </span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 4: INGREDIENT COST HISTORY & TRACKING
          ========================================================================= */}
      {activeTab === 'INGREDIENT_PRICES' && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Raw Material Cost History & Purchase Movements
                </h3>
                <p className="text-xs text-slate-400">Track inflation and wholesale supplier price fluctuations</p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 uppercase font-bold border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="py-3 px-4">Ingredient Name</th>
                    <th className="py-3 px-3">Category</th>
                    <th className="py-3 px-3">Package Unit</th>
                    <th className="py-3 px-3 text-right">Base Unit Cost</th>
                    <th className="py-3 px-3 text-right">Prev Purchase Price</th>
                    <th className="py-3 px-3 text-right">Latest Purchase Price</th>
                    <th className="py-3 px-3 text-right">Average Price</th>
                    <th className="py-3 px-3 text-center">Change %</th>
                    <th className="py-3 px-4 text-center">Recipes Exposed</th>
                    <th className="py-3 px-4 text-right">History</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                  {loading ? (
                    <tr>
                      <td colSpan={10} className="py-12 text-center text-slate-400">
                        Loading ingredient price history...
                      </td>
                    </tr>
                  ) : ingredientPrices.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="py-12 text-center text-slate-400">
                        No active ingredients found.
                      </td>
                    </tr>
                  ) : (
                    ingredientPrices.map((ing) => (
                      <tr key={ing.ingredientId} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                        <td className="py-3 px-4 font-bold text-slate-900 dark:text-white">{ing.ingredientName}</td>
                        <td className="py-3 px-3 text-slate-500">{ing.category}</td>
                        <td className="py-3 px-3 text-slate-600 dark:text-slate-400">
                          {ing.purchaseUnit} <span className="text-[10px] text-slate-400">({ing.conversionFactor} {ing.baseUnit})</span>
                        </td>
                        <td className="py-3 px-3 text-right font-mono text-slate-700 dark:text-slate-300">
                          {currencySymbol} {ing.currentBaseCost.toFixed(4)} / {ing.baseUnit}
                        </td>
                        <td className="py-3 px-3 text-right text-slate-500">
                          {currencySymbol} {ing.previousPurchaseCost.toLocaleString()}
                        </td>
                        <td className="py-3 px-3 text-right font-bold text-slate-900 dark:text-white">
                          {currencySymbol} {ing.latestPurchaseCost.toLocaleString()}
                        </td>
                        <td className="py-3 px-3 text-right text-slate-600 dark:text-slate-400">
                          {currencySymbol} {ing.averagePurchaseCost.toLocaleString()}
                        </td>
                        <td className="py-3 px-3 text-center">
                          {ing.priceChangePercentage > 0 ? (
                            <span className="inline-flex items-center text-rose-500 font-bold">
                              <TrendingUp className="w-3.5 h-3.5 mr-0.5" /> +{ing.priceChangePercentage}%
                            </span>
                          ) : ing.priceChangePercentage < 0 ? (
                            <span className="inline-flex items-center text-emerald-500 font-bold">
                              <TrendingDown className="w-3.5 h-3.5 mr-0.5" /> {ing.priceChangePercentage}%
                            </span>
                          ) : (
                            <span className="text-slate-400">0.0%</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                            {ing.recipesAffectedCount} recipes
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <button
                            onClick={() => setSelectedIngredientHistory(ing)}
                            className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-300"
                          >
                            View Audit
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL: RECIPE COST BREAKDOWN & LIVE PRICING SIMULATOR
          ========================================================================= */}
      {selectedRecipeItem && (
        <Modal
          isOpen={isRecipeModalOpen}
          onClose={() => setIsRecipeModalOpen(false)}
          title={`Recipe Cost Breakdown & Simulator: ${selectedRecipeItem.productName}`}
          maxWidth="4xl"
        >
          <div className="space-y-6 text-xs text-slate-700 dark:text-slate-300">
            {/* Header Product Card */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-4 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700">
              <div>
                <span className="text-slate-400 block text-[10px] font-bold uppercase">Current Selling Price</span>
                <span className="text-base font-black text-slate-900 dark:text-white">
                  {currencySymbol} {selectedRecipeItem.sellingPrice.toLocaleString()}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] font-bold uppercase">Total Recipe Cost</span>
                <span className="text-base font-black text-brand-500">
                  {currencySymbol} {selectedRecipeItem.totalDirectCost.toLocaleString()}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] font-bold uppercase">Gross Profit</span>
                <span className="text-base font-black text-emerald-500">
                  {currencySymbol} {selectedRecipeItem.grossProfit.toLocaleString()}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] font-bold uppercase">Food Cost % / Margin</span>
                <span className="text-base font-black text-slate-900 dark:text-white">
                  {selectedRecipeItem.foodCostPercentage}% / {selectedRecipeItem.grossProfitMargin}%
                </span>
              </div>
            </div>

            {/* Ingredient Breakdown Table */}
            <div>
              <h4 className="font-bold text-slate-900 dark:text-white text-xs mb-2">
                Ingredients Consumption & Line Costs
              </h4>
              <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-400 uppercase font-bold text-[10px]">
                    <tr>
                      <th className="py-2.5 px-3">Ingredient</th>
                      <th className="py-2.5 px-3">Recipe Qty</th>
                      <th className="py-2.5 px-3">Inventory Base Qty</th>
                      <th className="py-2.5 px-3 text-right">Base Unit Cost</th>
                      <th className="py-2.5 px-3 text-right">Line Total Cost</th>
                      <th className="py-2.5 px-3 text-right">Cost Share %</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {selectedRecipeItem.ingredients.map((ing) => (
                      <tr key={ing.ingredientId} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                        <td className="py-2.5 px-3 font-bold text-slate-900 dark:text-white">{ing.ingredientName}</td>
                        <td className="py-2.5 px-3">{ing.enteredQuantity} {ing.recipeUnit}</td>
                        <td className="py-2.5 px-3 font-semibold text-slate-500">{ing.baseQuantity} {ing.baseUnit}</td>
                        <td className="py-2.5 px-3 text-right font-mono text-slate-600 dark:text-slate-400">
                          {currencySymbol} {ing.baseUnitCost.toFixed(4)} / {ing.baseUnit}
                        </td>
                        <td className="py-2.5 px-3 text-right font-bold text-slate-900 dark:text-white">
                          {currencySymbol} {ing.lineCost.toFixed(2)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-bold text-brand-600 dark:text-brand-400">
                          {ing.costPercentage}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Direct Packaging & Consumables Breakdown */}
            <div className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-800 flex justify-between items-center">
              <div>
                <span className="font-bold text-slate-900 dark:text-white block">Additional Direct Packaging & Consumables</span>
                <span className="text-slate-400 text-[11px]">Containers, wrappers, bags, and preparation consumables</span>
              </div>
              <div className="flex items-center space-x-3">
                <span className="font-bold text-slate-700 dark:text-slate-300">
                  {currencySymbol} {(selectedRecipeItem.packagingCost + selectedRecipeItem.additionalCost).toLocaleString()}
                </span>
                <button
                  onClick={() => handleOpenEditCosts(selectedRecipeItem)}
                  className="px-2.5 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50"
                >
                  Edit Costs
                </button>
              </div>
            </div>

            {/* Live Pricing & Food Cost Margin Simulator */}
            <div className="p-4 bg-brand-500/10 border border-brand-500/20 rounded-2xl space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Sliders className="w-4 h-4 text-brand-500" />
                  <h4 className="font-bold text-slate-900 dark:text-white">Live Pricing & Margin Simulator</h4>
                </div>
                <span className="text-[11px] text-slate-500">
                  Simulate price adjustments to view instant margin impact
                </span>
              </div>

              {/* Slider & Price Input */}
              <div className="flex items-center space-x-4">
                <input
                  type="range"
                  min={Math.round(selectedRecipeItem.totalDirectCost)}
                  max={Math.round(selectedRecipeItem.sellingPrice * 2.5)}
                  step={10}
                  value={simulatedPrice}
                  onChange={(e) => setSimulatedPrice(Number(e.target.value))}
                  className="flex-1 accent-brand-500 cursor-pointer"
                />
                <div className="flex items-center space-x-1 font-bold text-sm bg-white dark:bg-slate-900 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700">
                  <span className="text-slate-400">{currencySymbol}</span>
                  <input
                    type="number"
                    value={simulatedPrice}
                    onChange={(e) => setSimulatedPrice(Number(e.target.value))}
                    className="w-20 bg-transparent text-right font-black focus:outline-none"
                  />
                </div>
              </div>

              {/* Simulation Result Cards */}
              {(() => {
                const simProfit = Math.max(0, simulatedPrice - selectedRecipeItem.totalDirectCost);
                const simFoodCostPct = simulatedPrice > 0 ? Number(((selectedRecipeItem.totalDirectCost / simulatedPrice) * 100).toFixed(1)) : 0;
                const simMargin = simulatedPrice > 0 ? Number(((simProfit / simulatedPrice) * 100).toFixed(1)) : 0;
                return (
                  <div className="grid grid-cols-3 gap-3 text-center">
                    <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
                      <span className="text-slate-400 block text-[10px] uppercase font-bold">Simulated Gross Profit</span>
                      <span className="text-sm font-black text-emerald-500">
                        {currencySymbol} {simProfit.toLocaleString()}
                      </span>
                    </div>
                    <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
                      <span className="text-slate-400 block text-[10px] uppercase font-bold">Simulated Food Cost %</span>
                      <span className={`text-sm font-black ${simFoodCostPct > 35 ? 'text-rose-500' : 'text-emerald-500'}`}>
                        {simFoodCostPct}%
                      </span>
                    </div>
                    <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
                      <span className="text-slate-400 block text-[10px] uppercase font-bold">Simulated Margin %</span>
                      <span className="text-sm font-black text-slate-900 dark:text-white">
                        {simMargin}%
                      </span>
                    </div>
                  </div>
                );
              })()}
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setIsRecipeModalOpen(false)}
                className="px-4 py-2 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl text-xs font-bold"
              >
                Close Breakdown
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* =========================================================================
          MODAL: EDIT PACKAGING & ADDITIONAL COSTS
          ========================================================================= */}
      {selectedRecipeItem && (
        <Modal
          isOpen={isEditCostsOpen}
          onClose={() => setIsEditCostsOpen(false)}
          title={`Edit Direct Costs: ${selectedRecipeItem.productName}`}
          maxWidth="md"
        >
          <div className="space-y-4 text-xs text-slate-700 dark:text-slate-300">
            <div>
              <label className="block font-bold text-slate-800 dark:text-slate-200 mb-1">
                Selling Price ({currencySymbol})
              </label>
              <input
                type="number"
                value={editBasePrice}
                onChange={(e) => setEditBasePrice(Number(e.target.value))}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-800 dark:text-slate-200 mb-1">
                Packaging / Container Cost ({currencySymbol})
              </label>
              <input
                type="number"
                value={editPackagingCost}
                onChange={(e) => setEditPackagingCost(Number(e.target.value))}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-800 dark:text-slate-200 mb-1">
                Consumables / Direct Prep Cost ({currencySymbol})
              </label>
              <input
                type="number"
                value={editAdditionalCost}
                onChange={(e) => setEditAdditionalCost(Number(e.target.value))}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-800 dark:text-slate-200 mb-1">
                Target Food Cost Percentage (%)
              </label>
              <input
                type="number"
                value={editTargetFoodCost}
                onChange={(e) => setEditTargetFoodCost(Number(e.target.value))}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none"
              />
            </div>

            <div className="flex justify-end space-x-2 pt-2 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setIsEditCostsOpen(false)}
                className="px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveDirectCosts}
                className="px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white rounded-xl text-xs font-bold shadow-md shadow-brand-500/20"
              >
                Save Costs
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* =========================================================================
          MODAL: MULTI-ITEM SIDE-BY-SIDE COMPARISON
          ========================================================================= */}
      <Modal
        isOpen={isCompareModalOpen}
        onClose={() => setIsCompareModalOpen(false)}
        title="Side-by-Side Menu Item Costing Comparison"
        maxWidth="4xl"
      >
        <div className="space-y-6 text-xs text-slate-700 dark:text-slate-300">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {comparedItems.map((item) => (
              <div
                key={item.productId}
                className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-3"
              >
                <div className="border-b border-slate-200 dark:border-slate-700 pb-2">
                  <span className="font-black text-sm text-slate-900 dark:text-white block truncate">
                    {item.productName}
                  </span>
                  <span className="text-[10px] text-slate-400">{item.categoryName}</span>
                </div>

                <div className="space-y-1.5">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Selling Price:</span>
                    <span className="font-bold text-slate-900 dark:text-white">
                      {currencySymbol} {item.sellingPrice.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Raw Food Cost:</span>
                    <span className="font-semibold text-slate-700 dark:text-slate-300">
                      {currencySymbol} {item.ingredientCost.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Packaging:</span>
                    <span className="font-semibold text-slate-500">
                      {currencySymbol} {(item.packagingCost + item.additionalCost).toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between border-t border-slate-200 dark:border-slate-700 pt-1">
                    <span className="text-slate-400 font-bold">Total Direct Cost:</span>
                    <span className="font-black text-slate-900 dark:text-white">
                      {currencySymbol} {item.totalDirectCost.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400 font-bold">Gross Profit:</span>
                    <span className="font-black text-emerald-500">
                      {currencySymbol} {item.grossProfit.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between items-center pt-1">
                    <span className="text-slate-400">Food Cost %:</span>
                    <span className={`font-black text-sm ${item.foodCostPercentage > 35 ? 'text-rose-500' : 'text-emerald-500'}`}>
                      {item.foodCostPercentage}%
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">Gross Margin:</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200">{item.grossProfitMargin}%</span>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-200 dark:border-slate-700">
                  <span className="font-bold text-[10px] text-slate-400 block mb-1">Ingredients:</span>
                  <ul className="space-y-1 text-[11px] text-slate-600 dark:text-slate-400 max-h-32 overflow-y-auto">
                    {item.ingredients.map((ing) => (
                      <li key={ing.ingredientId} className="flex justify-between">
                        <span>{ing.ingredientName} ({ing.enteredQuantity} {ing.recipeUnit})</span>
                        <span className="font-semibold text-slate-700 dark:text-slate-300">
                          {currencySymbol} {ing.lineCost}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-between items-center pt-2 border-t border-slate-200 dark:border-slate-800">
            <button
              onClick={() => setSelectedItemIds([])}
              className="text-xs text-rose-500 hover:underline font-semibold"
            >
              Clear Selection
            </button>
            <button
              onClick={() => setIsCompareModalOpen(false)}
              className="px-4 py-2 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl text-xs font-bold"
            >
              Close Comparison
            </button>
          </div>
        </div>
      </Modal>

      {/* =========================================================================
          MODAL: INGREDIENT INWARD PURCHASE HISTORY AUDIT
          ========================================================================= */}
      {selectedIngredientHistory && (
        <Modal
          isOpen={!!selectedIngredientHistory}
          onClose={() => setSelectedIngredientHistory(null)}
          title={`Purchase Price Audit: ${selectedIngredientHistory.ingredientName}`}
          maxWidth="4xl"
        >
          <div className="space-y-4 text-xs text-slate-700 dark:text-slate-300">
            <div className="grid grid-cols-3 gap-3 p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl">
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Base Unit Cost</span>
                <span className="font-black text-slate-900 dark:text-white">
                  {currencySymbol} {selectedIngredientHistory.currentBaseCost.toFixed(4)} / {selectedIngredientHistory.baseUnit}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Packaging Unit</span>
                <span className="font-black text-slate-900 dark:text-white">
                  1 {selectedIngredientHistory.purchaseUnit} = {selectedIngredientHistory.conversionFactor} {selectedIngredientHistory.baseUnit}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Latest Purchase Cost</span>
                <span className="font-black text-slate-900 dark:text-white">
                  {currencySymbol} {selectedIngredientHistory.latestPurchaseCost.toLocaleString()}
                </span>
              </div>
            </div>

            {/* Inward Invoices Timeline */}
            <div>
              <h4 className="font-bold text-slate-900 dark:text-white mb-2">Inward Invoice Purchase History</h4>
              <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden max-h-60 overflow-y-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-400 uppercase font-bold text-[10px]">
                    <tr>
                      <th className="py-2.5 px-3">Date</th>
                      <th className="py-2.5 px-3">Invoice #</th>
                      <th className="py-2.5 px-3">Supplier</th>
                      <th className="py-2.5 px-3 text-right">Qty Received</th>
                      <th className="py-2.5 px-3 text-right">Package Price</th>
                      <th className="py-2.5 px-3 text-right">Base Unit Cost</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {selectedIngredientHistory.history.map((h) => (
                      <tr key={h.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                        <td className="py-2 px-3 text-slate-500">{h.date}</td>
                        <td className="py-2 px-3 font-mono font-semibold">{h.invoiceNumber || 'Manual Adjustment'}</td>
                        <td className="py-2 px-3 text-slate-700 dark:text-slate-300">{h.supplierName}</td>
                        <td className="py-2 px-3 text-right">
                          {h.purchaseQuantity ? `${h.purchaseQuantity} ${h.purchaseUnit}` : '-'}
                        </td>
                        <td className="py-2 px-3 text-right font-bold text-slate-900 dark:text-white">
                          {currencySymbol} {h.purchaseUnitPrice.toLocaleString()}
                        </td>
                        <td className="py-2 px-3 text-right font-mono text-slate-600 dark:text-slate-400">
                          {currencySymbol} {h.baseUnitCost.toFixed(4)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Affected Menu Items */}
            {selectedIngredientHistory.affectedMenuProducts.length > 0 && (
              <div>
                <h4 className="font-bold text-slate-900 dark:text-white mb-2">
                  Exposed Menu Items ({selectedIngredientHistory.affectedMenuProducts.length} recipes)
                </h4>
                <div className="flex flex-wrap gap-2">
                  {selectedIngredientHistory.affectedMenuProducts.map((p) => (
                    <span
                      key={p.id}
                      className="px-2.5 py-1 bg-slate-100 dark:bg-slate-800 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-300"
                    >
                      {p.name} ({p.currentFoodCostPct}% Food Cost)
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setSelectedIngredientHistory(null)}
                className="px-4 py-2 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl text-xs font-bold"
              >
                Close Audit
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
