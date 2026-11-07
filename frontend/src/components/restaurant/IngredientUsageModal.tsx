import React, { useState, useEffect } from 'react';
import { api } from '../../api/client.js';
import { Modal } from '../common/Modal.js';
import {
  UtensilsCrossed,
  Package,
  Layers,
  ShoppingBag,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Clock,
  Building2,
  Calendar,
  Search,
  ExternalLink,
  ChevronRight,
  RefreshCw,
  Scale,
  Sparkles,
  Receipt,
  Tag,
  CircleDollarSign,
  PieChart,
} from 'lucide-react';

interface IngredientUsageModalProps {
  isOpen: boolean;
  onClose: () => void;
  ingredientId: string | null;
  ingredientName?: string;
  branchId?: string;
  currencySymbol?: string;
  onNavigateToProduct?: (productId: string) => void;
}

export const IngredientUsageModal: React.FC<IngredientUsageModalProps> = ({
  isOpen,
  onClose,
  ingredientId,
  ingredientName,
  branchId,
  currencySymbol = 'Rs.',
  onNavigateToProduct,
}) => {
  const [data, setData] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'MENU_ITEMS' | 'ORDERS' | 'RECONCILIATION' | 'BRANCHES'>('MENU_ITEMS');
  const [searchFilter, setSearchFilter] = useState('');

  const fetchUsage = async () => {
    if (!ingredientId) return;
    setLoading(true);
    setError(null);
    try {
      const url = `/inventory/ingredients/${ingredientId}/usage${branchId ? `?branchId=${branchId}` : ''}`;
      const res = await api.get(url);
      setData(res);
    } catch (err: any) {
      console.error('Failed to load ingredient usage:', err);
      setError(err.message || 'Failed to fetch ingredient usage mapping');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && ingredientId) {
      fetchUsage();
    } else {
      setData(null);
      setError(null);
    }
  }, [isOpen, ingredientId, branchId]);

  if (!isOpen) return null;

  const ingredient = data?.ingredient;
  const summary = data?.summary;
  const menuItems: any[] = data?.menuItems || [];
  const recentOrders: any[] = data?.recentOrders || [];
  const branchSummary: any[] = data?.branchSummary || [];

  const filteredMenuItems = menuItems.filter((item) => {
    if (!searchFilter.trim()) return true;
    const q = searchFilter.toLowerCase();
    return (
      item.productName?.toLowerCase().includes(q) ||
      item.productSku?.toLowerCase().includes(q) ||
      item.categoryName?.toLowerCase().includes(q)
    );
  });

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Where Used: ${ingredient?.name || ingredientName || 'Ingredient'} (${ingredient?.sku || 'SKU'})`}
      maxWidth="4xl"
    >
      {loading ? (
        <div className="py-16 text-center space-y-3">
          <RefreshCw className="w-8 h-8 text-brand-500 animate-spin mx-auto" />
          <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold">
            Analyzing recipe formulas, completed sales & FIFO deductions...
          </p>
        </div>
      ) : error ? (
        <div className="p-6 text-center space-y-3">
          <AlertTriangle className="w-10 h-10 text-amber-500 mx-auto" />
          <p className="text-sm font-bold text-slate-800 dark:text-slate-200">{error}</p>
          <button
            onClick={fetchUsage}
            className="px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white text-xs font-bold rounded-xl"
          >
            Retry Analysis
          </button>
        </div>
      ) : data ? (
        <div className="space-y-5">
          {/* Top KPI Summary Banner */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-slate-50 dark:bg-slate-800/60 p-3 rounded-xl border border-slate-200 dark:border-slate-800">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Available Stock</span>
              <div className="flex items-baseline gap-1 mt-1">
                <span className="text-base font-extrabold text-slate-900 dark:text-white">
                  {Number(ingredient?.availableStock || 0).toLocaleString()}
                </span>
                <span className="text-xs font-semibold text-slate-500">{ingredient?.unit}</span>
              </div>
              <span className="text-[10px] text-slate-500 mt-0.5 block">
                Val: {currencySymbol} {Number(ingredient?.stockValue || 0).toLocaleString()}
              </span>
            </div>

            <div className="bg-brand-50/50 dark:bg-brand-950/30 p-3 rounded-xl border border-brand-200 dark:border-brand-900/40">
              <span className="text-[10px] font-bold text-brand-600 dark:text-brand-400 uppercase tracking-wider block">
                Recipes Using Item
              </span>
              <div className="flex items-baseline gap-1 mt-1">
                <span className="text-base font-extrabold text-brand-700 dark:text-brand-300">
                  {summary?.menuItemsCount || 0}
                </span>
                <span className="text-xs font-semibold text-brand-600/70">Menu Items</span>
              </div>
              <span className="text-[10px] text-brand-600/80 dark:text-brand-400/80 mt-0.5 block">
                {summary?.totalUnitsSold || 0} Total Units Sold
              </span>
            </div>

            <div className="bg-emerald-50/50 dark:bg-emerald-950/30 p-3 rounded-xl border border-emerald-200 dark:border-emerald-900/40">
              <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider block">
                Total Consumed
              </span>
              <div className="flex items-baseline gap-1 mt-1">
                <span className="text-base font-extrabold text-emerald-700 dark:text-emerald-300">
                  {Number(summary?.totalTheoreticalConsumed || 0).toLocaleString()}
                </span>
                <span className="text-xs font-semibold text-emerald-600/70">{ingredient?.unit}</span>
              </div>
              <span className="text-[10px] text-emerald-600/80 dark:text-emerald-400/80 mt-0.5 block">
                Actual: {Number(summary?.totalActualConsumedQty || 0).toLocaleString()} {ingredient?.unit}
              </span>
            </div>

            <div className="bg-purple-50/50 dark:bg-purple-950/30 p-3 rounded-xl border border-purple-200 dark:border-purple-900/40">
              <span className="text-[10px] font-bold text-purple-600 dark:text-purple-400 uppercase tracking-wider block">
                FIFO Cost of Sales
              </span>
              <div className="flex items-baseline gap-1 mt-1">
                <span className="text-base font-extrabold text-purple-700 dark:text-purple-300">
                  {currencySymbol} {Number(summary?.totalActualConsumedCost || 0).toLocaleString()}
                </span>
              </div>
              <span className="text-[10px] text-purple-600/80 dark:text-purple-400/80 mt-0.5 block">
                Latest: {currencySymbol} {Number(ingredient?.latestPurchasePrice || 0).toLocaleString()}/{ingredient?.unit}
              </span>
            </div>
          </div>

          {/* Tab Navigation */}
          <div className="flex items-center space-x-1 border-b border-slate-200 dark:border-slate-800">
            <button
              onClick={() => setActiveTab('MENU_ITEMS')}
              className={`flex items-center gap-2 px-3.5 py-2.5 text-xs font-bold border-b-2 transition-all ${
                activeTab === 'MENU_ITEMS'
                  ? 'border-brand-500 text-brand-600 dark:text-brand-400'
                  : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <UtensilsCrossed className="w-3.5 h-3.5" />
              <span>Menu Items Using Ingredient ({menuItems.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('ORDERS')}
              className={`flex items-center gap-2 px-3.5 py-2.5 text-xs font-bold border-b-2 transition-all ${
                activeTab === 'ORDERS'
                  ? 'border-brand-500 text-brand-600 dark:text-brand-400'
                  : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <Receipt className="w-3.5 h-3.5" />
              <span>Order Consumption Log ({recentOrders.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('RECONCILIATION')}
              className={`flex items-center gap-2 px-3.5 py-2.5 text-xs font-bold border-b-2 transition-all ${
                activeTab === 'RECONCILIATION'
                  ? 'border-brand-500 text-brand-600 dark:text-brand-400'
                  : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <Scale className="w-3.5 h-3.5" />
              <span>Theoretical vs Actual & Wastage</span>
            </button>

            {branchSummary.length > 1 && (
              <button
                onClick={() => setActiveTab('BRANCHES')}
                className={`flex items-center gap-2 px-3.5 py-2.5 text-xs font-bold border-b-2 transition-all ${
                  activeTab === 'BRANCHES'
                    ? 'border-brand-500 text-brand-600 dark:text-brand-400'
                    : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                <Building2 className="w-3.5 h-3.5" />
                <span>Branch Breakdown ({branchSummary.length})</span>
              </button>
            )}
          </div>

          {/* TAB 1: MENU ITEMS USING THIS INGREDIENT */}
          {activeTab === 'MENU_ITEMS' && (
            <div className="space-y-3">
              {menuItems.length > 5 && (
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={searchFilter}
                    onChange={(e) => setSearchFilter(e.target.value)}
                    placeholder="Filter menu items..."
                    className="w-full pl-8 pr-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs"
                  />
                </div>
              )}

              {filteredMenuItems.length === 0 ? (
                <div className="py-10 text-center space-y-2 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-dashed border-slate-200 dark:border-slate-800">
                  <Package className="w-8 h-8 text-slate-400 mx-auto" />
                  <p className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    No recipes configured with this ingredient
                  </p>
                  <p className="text-[11px] text-slate-500 max-w-sm mx-auto">
                    To link this raw material with POS sales, open Menu Catalog, edit a menu item, and add this ingredient in its Recipe formulation.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-100 dark:bg-slate-800/80 text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                      <tr>
                        <th className="py-2.5 px-3">Menu Item / Product</th>
                        <th className="py-2.5 px-3">Recipe Usage / Item</th>
                        <th className="py-2.5 px-3 text-right">Units Sold</th>
                        <th className="py-2.5 px-3 text-right">Total Consumed</th>
                        <th className="py-2.5 px-3 text-right">Actual FIFO Cost</th>
                        <th className="py-2.5 px-3 text-right">Usage Share</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {filteredMenuItems.map((item) => (
                        <tr
                          key={item.productId}
                          className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors"
                        >
                          <td className="py-2.5 px-3">
                            <div className="flex items-center gap-2">
                              <div>
                                <span className="font-bold text-slate-900 dark:text-white block">
                                  {item.productName}
                                </span>
                                <span className="text-[10px] text-slate-400 font-mono">
                                  {item.categoryName || 'General'} • {item.productSku || 'SKU'}
                                </span>
                              </div>
                            </div>
                          </td>
                          <td className="py-2.5 px-3">
                            <span className="font-semibold text-slate-800 dark:text-slate-200">
                              {item.usagePerItem} {item.usageUnit}
                            </span>
                            <span className="text-[10px] text-slate-400 block">per portion</span>
                          </td>
                          <td className="py-2.5 px-3 text-right font-extrabold text-slate-900 dark:text-white">
                            {Number(item.unitsSold || 0).toLocaleString()}
                          </td>
                          <td className="py-2.5 px-3 text-right font-extrabold text-emerald-600 dark:text-emerald-400">
                            {Number(item.totalTheoreticalConsumed || 0).toLocaleString()} {item.usageUnit}
                          </td>
                          <td className="py-2.5 px-3 text-right font-extrabold text-slate-900 dark:text-white">
                            {currencySymbol} {Number(item.actualConsumedCost || 0).toLocaleString()}
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <div className="w-16 bg-slate-200 dark:bg-slate-700 h-1.5 rounded-full overflow-hidden">
                                <div
                                  className="bg-brand-500 h-full rounded-full"
                                  style={{ width: `${Math.min(100, item.usagePercentage || 0)}%` }}
                                />
                              </div>
                              <span className="font-bold text-[11px] text-slate-600 dark:text-slate-400 w-9 text-right">
                                {item.usagePercentage}%
                              </span>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-slate-50 dark:bg-slate-800/60 font-black border-t-2 border-slate-200 dark:border-slate-700">
                      <tr>
                        <td className="py-2.5 px-3 text-slate-800 dark:text-slate-200">
                          Total ({filteredMenuItems.length} recipes)
                        </td>
                        <td className="py-2.5 px-3 text-slate-500">—</td>
                        <td className="py-2.5 px-3 text-right text-slate-900 dark:text-white">
                          {summary?.totalUnitsSold || 0}
                        </td>
                        <td className="py-2.5 px-3 text-right text-emerald-600 dark:text-emerald-400">
                          {Number(summary?.totalTheoreticalConsumed || 0).toLocaleString()} {ingredient?.unit}
                        </td>
                        <td className="py-2.5 px-3 text-right text-purple-600 dark:text-purple-400">
                          {currencySymbol} {Number(summary?.totalActualConsumedCost || 0).toLocaleString()}
                        </td>
                        <td className="py-2.5 px-3 text-right text-slate-500">100%</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: ORDER-BY-ORDER CONSUMPTION LOG */}
          {activeTab === 'ORDERS' && (
            <div className="space-y-3">
              {recentOrders.length === 0 ? (
                <div className="py-10 text-center space-y-2 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-dashed border-slate-200 dark:border-slate-800">
                  <Receipt className="w-8 h-8 text-slate-400 mx-auto" />
                  <p className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    No order deductions recorded yet
                  </p>
                  <p className="text-[11px] text-slate-500 max-w-sm mx-auto">
                    When POS orders containing products linked to this ingredient are completed, exact FIFO batch deductions are recorded here automatically.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800 max-h-96">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-100 dark:bg-slate-800/80 text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider sticky top-0 z-10">
                      <tr>
                        <th className="py-2.5 px-3">Order #</th>
                        <th className="py-2.5 px-3">Date & Time</th>
                        <th className="py-2.5 px-3">Product Sold</th>
                        <th className="py-2.5 px-3 text-right">Deducted</th>
                        <th className="py-2.5 px-3">FIFO Lot Ref</th>
                        <th className="py-2.5 px-3 text-right">Lot Cost</th>
                        <th className="py-2.5 px-3 text-right">Total Cost</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {recentOrders.map((ord) => (
                        <tr key={ord.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
                          <td className="py-2 px-3 font-mono font-bold text-brand-600 dark:text-brand-400">
                            #{ord.orderNumber}
                          </td>
                          <td className="py-2 px-3 text-slate-500 whitespace-nowrap">
                            {new Date(ord.createdAt).toLocaleString(undefined, {
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </td>
                          <td className="py-2 px-3 font-semibold text-slate-800 dark:text-slate-200">
                            {ord.productName}
                          </td>
                          <td className="py-2 px-3 text-right font-extrabold text-emerald-600 dark:text-emerald-400">
                            {ord.quantityConsumed} {ord.unit}
                          </td>
                          <td className="py-2 px-3">
                            <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                              {ord.batchCode}
                            </span>
                          </td>
                          <td className="py-2 px-3 text-right font-mono text-slate-600 dark:text-slate-400">
                            {currencySymbol} {Number(ord.unitCost || 0).toLocaleString()}
                          </td>
                          <td className="py-2 px-3 text-right font-extrabold text-slate-900 dark:text-white">
                            {currencySymbol} {Number(ord.totalCost || 0).toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: THEORETICAL VS ACTUAL & WASTAGE */}
          {activeTab === 'RECONCILIATION' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="bg-slate-50 dark:bg-slate-800/60 p-4 rounded-xl border border-slate-200 dark:border-slate-800 space-y-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    Theoretical Recipe Need
                  </span>
                  <div className="text-xl font-extrabold text-slate-900 dark:text-white">
                    {Number(summary?.totalTheoreticalConsumed || 0).toLocaleString()} {ingredient?.unit}
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Calculated from recipe portions × completed sales volume
                  </p>
                </div>

                <div className="bg-slate-50 dark:bg-slate-800/60 p-4 rounded-xl border border-slate-200 dark:border-slate-800 space-y-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    Actual Recorded FIFO Deductions
                  </span>
                  <div className="text-xl font-extrabold text-emerald-600 dark:text-emerald-400">
                    {Number(summary?.totalActualConsumedQty || 0).toLocaleString()} {ingredient?.unit}
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Stock actually allocated and deducted from active batches
                  </p>
                </div>

                <div className="bg-slate-50 dark:bg-slate-800/60 p-4 rounded-xl border border-slate-200 dark:border-slate-800 space-y-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    Recorded Wastage & Loss
                  </span>
                  <div className="text-xl font-extrabold text-rose-600 dark:text-rose-400">
                    {Number(summary?.wastageQuantity || 0).toLocaleString()} {ingredient?.unit}
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Damaged: {Number(summary?.damagedQuantity || 0).toLocaleString()} {ingredient?.unit} • Manual Adj: {Number(summary?.adjustmentQuantity || 0).toLocaleString()} {ingredient?.unit}
                  </p>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-blue-50/60 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/40 text-xs text-blue-900 dark:text-blue-200 space-y-1">
                <p className="font-extrabold flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-blue-600" />
                  Audit Integrity & Traceability
                </p>
                <p className="text-[11px] text-blue-700 dark:text-blue-300">
                  Every inventory deduction shown in this report originates from an immutable POS order finalization or a signed stock movement record. No weighted average or estimated figures are used.
                </p>
              </div>
            </div>
          )}

          {/* TAB 4: BRANCH DISTRIBUTION */}
          {activeTab === 'BRANCHES' && (
            <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 dark:bg-slate-800/80 text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                  <tr>
                    <th className="py-2.5 px-3">Branch Location</th>
                    <th className="py-2.5 px-3 text-right">Current Stock</th>
                    <th className="py-2.5 px-3 text-right">Total Consumed</th>
                    <th className="py-2.5 px-3 text-right">Total FIFO Cost</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {branchSummary.map((b) => (
                    <tr key={b.branchId} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="py-2.5 px-3 font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                        <Building2 className="w-3.5 h-3.5 text-slate-400" />
                        <span>{b.branchName}</span>
                      </td>
                      <td className="py-2.5 px-3 text-right font-extrabold text-slate-900 dark:text-white">
                        {Number(b.currentStock || 0).toLocaleString()} {ingredient?.unit}
                      </td>
                      <td className="py-2.5 px-3 text-right font-extrabold text-emerald-600 dark:text-emerald-400">
                        {Number(b.totalConsumed || 0).toLocaleString()} {ingredient?.unit}
                      </td>
                      <td className="py-2.5 px-3 text-right font-extrabold text-purple-600 dark:text-purple-400">
                        {currencySymbol} {Number(b.totalCost || 0).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Modal Footer */}
          <div className="flex justify-end pt-3 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2 text-xs font-bold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-xl transition-all"
            >
              Close
            </button>
          </div>
        </div>
      ) : null}
    </Modal>
  );
};
