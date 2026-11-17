import React, { useEffect, useState } from 'react';
import {
  Boxes,
  Eye,
  Edit2,
  Trash2,
  Scale,
  Layers,
  History,
  UtensilsCrossed,
  AlertTriangle,
  Clock,
  Tag,
  CheckCircle2,
  Truck,
  ArrowRight,
  TrendingDown,
  TrendingUp,
  X,
  FileSpreadsheet,
} from 'lucide-react';
import { Modal } from '../common/Modal.js';
import { api } from '../../api/client.js';

interface InventoryDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  ingredientId: string | null;
  currencySymbol: string;
  currentBranchId?: string;
  onEdit: (item: any) => void;
  onLogWastage: (ingredientId: string) => void;
  onAdjust: (ingredientId: string) => void;
}

export const InventoryDetailsModal: React.FC<InventoryDetailsModalProps> = ({
  isOpen,
  onClose,
  ingredientId,
  currencySymbol,
  currentBranchId,
  onEdit,
  onLogWastage,
  onAdjust,
}) => {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any | null>(null);
  const [activeSubTab, setActiveSubTab] = useState<'movements' | 'batches' | 'recipes' | 'purchases'>('movements');

  useEffect(() => {
    if (!isOpen || !ingredientId) {
      setData(null);
      return;
    }

    let isMounted = true;
    const fetchDetails = async () => {
      setLoading(true);
      try {
        const bParam = currentBranchId ? `?branchId=${currentBranchId}` : '';
        const res = await api.get(`/inventory/ingredients/${ingredientId}/details${bParam}`);
        if (isMounted) {
          setData(res);
        }
      } catch (err: any) {
        console.error('Failed to load ingredient details:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchDetails();
    return () => {
      isMounted = false;
    };
  }, [isOpen, ingredientId, currentBranchId]);

  if (!isOpen) return null;

  const ing = data?.ingredient;
  const lifecycle = data?.stockLifecycle;
  const movements = data?.recentMovements || [];
  const batches = data?.activeBatches || [];
  const purchases = data?.purchaseHistory || [];
  const recipes = data?.recipes || [];

  const stock = Number(ing?.availableStock || 0);
  const alertThreshold = Number(ing?.minStockAlert || 0);
  const isOut = stock <= 0;
  const isLow = stock > 0 && alertThreshold > 0 && stock <= alertThreshold;
  const unit = ing?.unit || 'UNIT';

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div className="flex items-center space-x-3">
          <div className="p-2.5 bg-brand-50 dark:bg-brand-950/60 text-brand-600 dark:text-brand-400 rounded-2xl">
            <Boxes className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-black text-slate-900 dark:text-white">
                {ing ? ing.name : 'Loading Inventory Details...'}
              </h2>
              {ing && (
                <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                  {ing.category || 'General'}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 font-normal mt-0.5">
              Comprehensive stock balance, purchases, wastage, FIFO lots & recipe consumption
            </p>
          </div>
        </div>
      }
      maxWidth="4xl"
    >
      {loading || !ing ? (
        <div className="py-16 flex flex-col items-center justify-center space-y-3">
          <div className="w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full animate-spin"></div>
          <span className="text-xs font-bold text-slate-500">Loading complete stock history...</span>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Header Summary & Badges */}
          <div className="bg-slate-50 dark:bg-slate-800/60 rounded-2xl p-4 border border-slate-200/80 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              {ing.sku ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-mono text-xs font-bold text-slate-700 dark:text-slate-200">
                  <Tag className="w-3.5 h-3.5 text-slate-400" />
                  <span>SKU: {ing.sku}</span>
                </span>
              ) : (
                <span className="text-xs text-slate-400 italic">No SKU Assigned</span>
              )}

              <span className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200">
                Unit: <strong className="uppercase">{unit}</strong>
              </span>

              {ing.lastPurchaseDate && (
                <span className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs text-slate-600 dark:text-slate-300 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-slate-400" />
                  <span>Last Inward: {new Date(ing.lastPurchaseDate).toLocaleDateString()}</span>
                </span>
              )}
            </div>

            <div>
              {isOut ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-100 dark:bg-rose-950/70 text-rose-800 dark:text-rose-200 border border-rose-300 dark:border-rose-800">
                  <span className="w-2 h-2 rounded-full bg-rose-600 dark:bg-rose-400"></span>
                  <span>Out of Stock</span>
                </span>
              ) : isLow ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-100 dark:bg-amber-950/70 text-amber-800 dark:text-amber-200 border border-amber-300 dark:border-amber-800">
                  <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
                  <span>Low Stock Alert</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-200 border border-emerald-300 dark:border-emerald-800">
                  <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                  <span>In Stock</span>
                </span>
              )}
            </div>
          </div>

          {/* Key Metric Stat Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3.5 shadow-2xs">
              <span className="text-[10px] font-black uppercase text-slate-500 tracking-wider block">
                Available Stock
              </span>
              <p
                className={`text-xl font-black font-mono tracking-tight mt-0.5 ${
                  isOut ? 'text-rose-600' : isLow ? 'text-amber-600' : 'text-slate-900 dark:text-white'
                }`}
              >
                {stock.toLocaleString(undefined, { maximumFractionDigits: 2 })}{' '}
                <span className="text-xs uppercase font-bold text-slate-400">{unit}</span>
              </p>
              <span className="text-[10px] text-slate-400 mt-0.5 block">
                {batches.length} active FIFO lot(s)
              </span>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3.5 shadow-2xs">
              <span className="text-[10px] font-black uppercase text-slate-500 tracking-wider block">
                Purchase Price
              </span>
              <p className="text-xl font-black font-mono tracking-tight text-slate-900 dark:text-white mt-0.5">
                {currencySymbol} {Number(ing.latestPurchasePrice || ing.costPerUnit || 0).toFixed(2)}
              </p>
              <span className="text-[10px] text-slate-400 mt-0.5 block">per {unit}</span>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3.5 shadow-2xs">
              <span className="text-[10px] font-black uppercase text-slate-500 tracking-wider block">
                Total Stock Value
              </span>
              <p className="text-xl font-black font-mono tracking-tight text-emerald-600 dark:text-emerald-400 mt-0.5">
                {currencySymbol} {Number(ing.stockValue || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
              <span className="text-[10px] text-slate-400 mt-0.5 block">FIFO Batch Valuation</span>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3.5 shadow-2xs">
              <span className="text-[10px] font-black uppercase text-slate-500 tracking-wider block">
                Safety Threshold
              </span>
              <p className="text-xl font-black font-mono tracking-tight text-slate-900 dark:text-white mt-0.5">
                {alertThreshold}{' '}
                <span className="text-xs uppercase font-bold text-slate-400">{unit}</span>
              </p>
              <span className="text-[10px] text-slate-400 mt-0.5 block">Min alert trigger</span>
            </div>
          </div>

          {/* Stock Lifecycle Flow (Section 5 Requirement) */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-2xs space-y-3">
            <h3 className="text-xs font-black uppercase text-slate-800 dark:text-slate-200 tracking-wider flex items-center gap-1.5 border-b border-slate-100 dark:border-slate-800 pb-2">
              <History className="w-4 h-4 text-brand-500" />
              <span>Inventory Stock Lifecycle Balance</span>
            </h3>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 text-center text-xs">
              <div className="p-2.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-100 dark:border-slate-800">
                <span className="text-[10px] font-bold text-slate-500 uppercase block">Opening Stock</span>
                <span className="font-mono font-bold text-sm text-slate-800 dark:text-slate-200">
                  {Number(lifecycle?.openingStock || 0).toFixed(2)}
                </span>
                <span className="text-[10px] text-slate-400 block">{unit}</span>
              </div>

              <div className="p-2.5 bg-emerald-50/60 dark:bg-emerald-950/30 rounded-xl border border-emerald-100 dark:border-emerald-900/40">
                <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-300 uppercase block">
                  + Total Purchases
                </span>
                <span className="font-mono font-bold text-sm text-emerald-700 dark:text-emerald-300">
                  +{Number(lifecycle?.totalPurchased || 0).toFixed(2)}
                </span>
                <span className="text-[10px] text-emerald-600/70 block">{unit}</span>
              </div>

              <div className="p-2.5 bg-blue-50/60 dark:bg-blue-950/30 rounded-xl border border-blue-100 dark:border-blue-900/40">
                <span className="text-[10px] font-bold text-blue-700 dark:text-blue-300 uppercase block">
                  - Recipe Consumption
                </span>
                <span className="font-mono font-bold text-sm text-blue-700 dark:text-blue-300">
                  -{Number(lifecycle?.totalConsumed || 0).toFixed(2)}
                </span>
                <span className="text-[10px] text-blue-600/70 block">{unit}</span>
              </div>

              <div className="p-2.5 bg-rose-50/60 dark:bg-rose-950/30 rounded-xl border border-rose-100 dark:border-rose-900/40">
                <span className="text-[10px] font-bold text-rose-700 dark:text-rose-300 uppercase block">
                  - Total Wastage
                </span>
                <span className="font-mono font-bold text-sm text-rose-700 dark:text-rose-300">
                  -{Number(lifecycle?.totalWasted || 0).toFixed(2)}
                </span>
                <span className="text-[10px] text-rose-600/70 block">{unit}</span>
              </div>

              <div className="p-2.5 bg-brand-50/70 dark:bg-brand-950/40 rounded-xl border border-brand-200 dark:border-brand-900/60 col-span-2 sm:col-span-1">
                <span className="text-[10px] font-black text-brand-800 dark:text-brand-200 uppercase block">
                  = Current Stock
                </span>
                <span className="font-mono font-black text-base text-brand-600 dark:text-brand-400">
                  {stock.toFixed(2)}
                </span>
                <span className="text-[10px] text-brand-700/70 font-bold block">{unit}</span>
              </div>
            </div>
          </div>

          {/* Sub-Tabs Navigation */}
          <div className="space-y-3">
            <div className="flex items-center space-x-1.5 border-b border-slate-200 dark:border-slate-800 pb-2 text-xs font-bold overflow-x-auto">
              <button
                type="button"
                onClick={() => setActiveSubTab('movements')}
                className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl transition-all ${
                  activeSubTab === 'movements'
                    ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <History className="w-3.5 h-3.5" />
                <span>Recent Movements ({movements.length})</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveSubTab('batches')}
                className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl transition-all ${
                  activeSubTab === 'batches'
                    ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <Layers className="w-3.5 h-3.5 text-blue-500" />
                <span>Active FIFO Lots ({batches.length})</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveSubTab('recipes')}
                className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl transition-all ${
                  activeSubTab === 'recipes'
                    ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <UtensilsCrossed className="w-3.5 h-3.5 text-amber-500" />
                <span>Where Used / Recipes ({recipes.length})</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveSubTab('purchases')}
                className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl transition-all ${
                  activeSubTab === 'purchases'
                    ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <Truck className="w-3.5 h-3.5 text-emerald-500" />
                <span>Inward Purchases ({purchases.length})</span>
              </button>
            </div>

            {/* Sub-Tab 1: Recent Movements */}
            {activeSubTab === 'movements' && (
              <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden bg-white dark:bg-slate-900">
                {movements.length === 0 ? (
                  <p className="p-6 text-center text-xs text-slate-400 italic">No stock movements recorded yet</p>
                ) : (
                  <div className="overflow-x-auto max-h-[300px]">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 dark:bg-slate-800/80 sticky top-0 text-slate-500 font-bold border-b border-slate-200 dark:border-slate-800">
                        <tr>
                          <th className="px-4 py-2.5">Date & Time</th>
                          <th className="px-3 py-2.5">Type</th>
                          <th className="px-3 py-2.5 text-right">Qty Change</th>
                          <th className="px-3 py-2.5 text-right">Balance</th>
                          <th className="px-4 py-2.5">Reason / Reference</th>
                          <th className="px-3 py-2.5">Recorded By</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono">
                        {movements.map((m: any) => {
                          const q = Number(m.quantity || 0);
                          const isPositive = q > 0;
                          return (
                            <tr key={m.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                              <td className="px-4 py-2 text-slate-600 dark:text-slate-400 text-[11px] whitespace-nowrap">
                                {new Date(m.created_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                              </td>
                              <td className="px-3 py-2">
                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold font-sans ${
                                  m.movement_type === 'PURCHASE_RECEIVE' || m.movement_type === 'OPENING_STOCK'
                                    ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                                    : m.movement_type === 'WASTAGE' || m.movement_type === 'EXPIRED' || m.movement_type === 'DAMAGED'
                                    ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300'
                                    : 'bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300'
                                }`}>
                                  {m.movement_type}
                                </span>
                              </td>
                              <td className={`px-3 py-2 text-right font-black ${isPositive ? 'text-emerald-600' : 'text-rose-600'}`}>
                                {isPositive ? `+${q.toFixed(2)}` : q.toFixed(2)} {unit}
                              </td>
                              <td className="px-3 py-2 text-right font-bold text-slate-800 dark:text-slate-200">
                                {Number(m.stock_after ?? 0).toFixed(2)}
                              </td>
                              <td className="px-4 py-2 font-sans text-slate-600 dark:text-slate-400 text-[11px] truncate max-w-[180px]">
                                {m.reason || m.reference_type || '-'}
                              </td>
                              <td className="px-3 py-2 font-sans text-slate-500 text-[11px]">
                                {m.recorded_by_name || 'System'}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* Sub-Tab 2: Active FIFO Batches */}
            {activeSubTab === 'batches' && (
              <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden bg-white dark:bg-slate-900">
                {batches.length === 0 ? (
                  <p className="p-6 text-center text-xs text-slate-400 italic">No active FIFO lots for this item</p>
                ) : (
                  <div className="overflow-x-auto max-h-[300px]">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 dark:bg-slate-800/80 sticky top-0 text-slate-500 font-bold border-b border-slate-200 dark:border-slate-800">
                        <tr>
                          <th className="px-3 py-2.5">Queue</th>
                          <th className="px-3 py-2.5">Lot Ref</th>
                          <th className="px-3 py-2.5">Received Date</th>
                          <th className="px-3 py-2.5 text-right">Remaining Qty</th>
                          <th className="px-3 py-2.5 text-right">Unit Cost</th>
                          <th className="px-3 py-2.5 text-right">Remaining Value</th>
                          <th className="px-4 py-2.5">Supplier</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono">
                        {batches.map((b: any, idx: number) => {
                          const rem = Number(b.quantity_remaining || 0);
                          const cost = Number(b.unit_cost || 0);
                          return (
                            <tr key={b.id || idx} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                              <td className="px-3 py-2 font-sans">
                                {idx === 0 ? (
                                  <span className="px-1.5 py-0.5 rounded text-[10px] font-black bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">
                                    Next Out (1st)
                                  </span>
                                ) : (
                                  <span className="text-slate-400 text-xs">#{idx + 1}</span>
                                )}
                              </td>
                              <td className="px-3 py-2 font-bold text-slate-800 dark:text-slate-200">
                                {b.batch_code || `#${String(b.id).slice(-6)}`}
                              </td>
                              <td className="px-3 py-2 text-slate-500 text-[11px] whitespace-nowrap">
                                {b.received_at ? new Date(b.received_at).toLocaleDateString() : '-'}
                              </td>
                              <td className="px-3 py-2 text-right font-black text-slate-900 dark:text-white">
                                {rem.toFixed(2)} {b.unit || unit}
                              </td>
                              <td className="px-3 py-2 text-right text-slate-700 dark:text-slate-300">
                                {currencySymbol} {cost.toFixed(2)}
                              </td>
                              <td className="px-3 py-2 text-right font-bold text-emerald-600 dark:text-emerald-400">
                                {currencySymbol} {(rem * cost).toFixed(2)}
                              </td>
                              <td className="px-4 py-2 font-sans text-slate-600 dark:text-slate-400 text-[11px] truncate max-w-[140px]">
                                {b.supplier_name || 'Inward Receipt'}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* Sub-Tab 3: Where Used in Recipes */}
            {activeSubTab === 'recipes' && (
              <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden bg-white dark:bg-slate-900">
                {recipes.length === 0 ? (
                  <p className="p-6 text-center text-xs text-slate-400 italic">
                    This item is not currently configured in any menu item recipes.
                  </p>
                ) : (
                  <div className="overflow-x-auto max-h-[300px]">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 dark:bg-slate-800/80 sticky top-0 text-slate-500 font-bold border-b border-slate-200 dark:border-slate-800">
                        <tr>
                          <th className="px-4 py-2.5">Menu Product</th>
                          <th className="px-3 py-2.5">Category</th>
                          <th className="px-3 py-2.5 text-right">Recipe Usage</th>
                          <th className="px-3 py-2.5 text-right">Menu Price</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {recipes.map((r: any) => (
                          <tr key={r.product_id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                            <td className="px-4 py-2 font-bold text-slate-900 dark:text-white">
                              {r.product_name}
                              {r.product_sku && <span className="font-mono text-[10px] text-slate-400 ml-1.5 font-normal">({r.product_sku})</span>}
                            </td>
                            <td className="px-3 py-2 text-slate-500 text-[11px]">
                              {r.category_name || 'General'}
                            </td>
                            <td className="px-3 py-2 text-right font-mono font-bold text-brand-600 dark:text-brand-400">
                              {Number(r.usage_per_item || 0).toLocaleString()} {r.usage_unit}
                            </td>
                            <td className="px-3 py-2 text-right font-mono font-bold text-slate-800 dark:text-slate-200">
                              {currencySymbol} {Number(r.base_price || 0).toFixed(2)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* Sub-Tab 4: Inward Purchases */}
            {activeSubTab === 'purchases' && (
              <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden bg-white dark:bg-slate-900">
                {purchases.length === 0 ? (
                  <p className="p-6 text-center text-xs text-slate-400 italic">No inward purchase invoices recorded yet</p>
                ) : (
                  <div className="overflow-x-auto max-h-[300px]">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 dark:bg-slate-800/80 sticky top-0 text-slate-500 font-bold border-b border-slate-200 dark:border-slate-800">
                        <tr>
                          <th className="px-4 py-2.5">Invoice #</th>
                          <th className="px-4 py-2.5">Supplier</th>
                          <th className="px-3 py-2.5">Date</th>
                          <th className="px-3 py-2.5 text-right">Purchased Qty</th>
                          <th className="px-3 py-2.5 text-right">Unit Price</th>
                          <th className="px-4 py-2.5 text-right">Total Price</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono">
                        {purchases.map((p: any) => (
                          <tr key={p.purchase_item_id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                            <td className="px-4 py-2 font-bold text-brand-600 dark:text-brand-400">
                              {p.invoice_number}
                            </td>
                            <td className="px-4 py-2 font-sans text-slate-700 dark:text-slate-300 text-[11px]">
                              {p.supplier_name || 'Standard Vendor'}
                            </td>
                            <td className="px-3 py-2 text-slate-500 text-[11px] whitespace-nowrap">
                              {p.received_at ? new Date(p.received_at).toLocaleDateString() : '-'}
                            </td>
                            <td className="px-3 py-2 text-right font-bold text-slate-900 dark:text-white">
                              {Number(p.quantity || 0).toLocaleString()} {p.unit || unit}
                            </td>
                            <td className="px-3 py-2 text-right text-slate-700 dark:text-slate-300">
                              {currencySymbol} {Number(p.unit_price || 0).toFixed(2)}
                            </td>
                            <td className="px-4 py-2 text-right font-black text-emerald-600 dark:text-emerald-400">
                              {currencySymbol} {Number(p.total_price || 0).toFixed(2)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Modal Footer Quick Actions */}
          <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onLogWastage(ing.id);
                }}
                className="px-3 py-2 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 rounded-xl text-xs font-bold transition-colors flex items-center space-x-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Log Wastage</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  onClose();
                  onAdjust(ing.id);
                }}
                className="px-3 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold transition-colors flex items-center space-x-1.5"
              >
                <Scale className="w-3.5 h-3.5 text-amber-500" />
                <span>Adjust Stock / Audit</span>
              </button>
            </div>

            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onEdit({
                    id: ing.id,
                    name: ing.name,
                    name_urdu: ing.nameUrdu,
                    category: ing.category,
                    sku: ing.sku,
                    unit: ing.unit,
                    base_unit: ing.baseUnit,
                    cost_per_unit: ing.costPerUnit,
                    purchase_cost: ing.purchaseCost,
                    min_stock_alert: ing.minStockAlert,
                  });
                }}
                className="px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center space-x-1.5"
              >
                <Edit2 className="w-3.5 h-3.5" />
                <span>Edit Item</span>
              </button>

              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
};

