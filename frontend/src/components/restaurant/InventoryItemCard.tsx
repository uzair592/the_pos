import React from 'react';
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
} from 'lucide-react';
import { ActionMenu } from '../common/ActionMenu.js';

interface InventoryItemCardProps {
  item: any;
  currencySymbol: string;
  onViewDetails: (item: any) => void;
  onEdit: (item: any) => void;
  onLogWastage: (item: any) => void;
  onAdjust: (item: any) => void;
  onWhereUsed: (item: any) => void;
  onViewBatches: (item: any) => void;
  onViewLedger: (item: any) => void;
  onDelete: (item: any) => void;
}

export const InventoryItemCard: React.FC<InventoryItemCardProps> = ({
  item,
  currencySymbol,
  onViewDetails,
  onEdit,
  onLogWastage,
  onAdjust,
  onWhereUsed,
  onViewBatches,
  onViewLedger,
  onDelete,
}) => {
  const stock = Number(item.current_stock || 0);
  const alertThreshold = Number(item.min_stock_alert || 0);
  const isOut = stock <= 0;
  const isLow = stock > 0 && alertThreshold > 0 && stock <= alertThreshold;
  const itemUnit = item.unit || item.base_unit || 'UNIT';

  const activeBatchesList = Array.isArray(item.active_batches) ? item.active_batches : [];
  const activeBatchCount = item.active_batches_count ?? activeBatchesList.length;

  const latestPrice = Number(
    item.latest_purchase_price ?? item.purchase_cost ?? item.cost_per_unit ?? 0
  );
  const stockValue = Number(
    item.total_stock_value ?? (stock * latestPrice)
  );

  return (
    <div
      onClick={() => onViewDetails(item)}
      className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-brand-400 dark:hover:border-brand-500 rounded-2xl p-4 shadow-xs hover:shadow-md transition-all flex flex-col justify-between h-full group cursor-pointer relative"
    >
      {/* Top Header: Category, Status & Action Menu */}
      <div>
        <div className="flex items-center justify-between gap-2 mb-2.5">
          <span className="px-2.5 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 truncate max-w-[140px]">
            {item.category || 'General'}
          </span>

          <div className="flex items-center space-x-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
            {/* Status Badge */}
            {isOut ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-600 dark:bg-rose-400"></span>
                <span>Out of Stock</span>
              </span>
            ) : isLow ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-900">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
                <span>Low Stock</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                <span>In Stock</span>
              </span>
            )}

            {/* 3-Dots Action Menu */}
            <ActionMenu
              items={[
                {
                  label: 'View Full Details & History',
                  icon: Eye,
                  onClick: () => onViewDetails(item),
                },
                {
                  label: 'Edit Item Information',
                  icon: Edit2,
                  onClick: () => onEdit(item),
                },
                {
                  label: 'Log Kitchen Wastage',
                  icon: Trash2,
                  onClick: () => onLogWastage(item),
                },
                {
                  label: 'Adjust Stock / Audit Count',
                  icon: Scale,
                  onClick: () => onAdjust(item),
                },
                {
                  label: 'Where Used in Recipes',
                  icon: UtensilsCrossed,
                  onClick: () => onWhereUsed(item),
                },
                {
                  label: 'View FIFO Lots',
                  icon: Layers,
                  onClick: () => onViewBatches(item),
                },
                {
                  label: 'View Stock Movement Ledger',
                  icon: History,
                  onClick: () => onViewLedger(item),
                },
                {
                  label: 'Delete Item',
                  icon: Trash2,
                  variant: 'danger',
                  divider: true,
                  onClick: () => onDelete(item),
                },
              ]}
            />
          </div>
        </div>

        {/* Item Title & SKU */}
        <div>
          <h3
            className="text-base font-extrabold text-slate-900 dark:text-white truncate group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors"
            title={item.name}
          >
            {item.name}
          </h3>
          {item.name_urdu && (
            <p className="text-xs text-slate-400 font-normal truncate mt-0.5">{item.name_urdu}</p>
          )}

          <div className="flex items-center gap-2 mt-1 min-h-[18px]">
            {item.sku ? (
              <span className="inline-flex items-center gap-1 font-mono text-[10px] font-bold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                <Tag className="w-2.5 h-2.5 text-slate-400" />
                <span>SKU: {item.sku}</span>
              </span>
            ) : (
              <span className="text-[10px] text-slate-400 italic">No SKU</span>
            )}
          </div>
        </div>

        {/* Center: Available Stock (The Most Prominent Element) */}
        <div
          className={`my-3 py-3 px-3.5 rounded-xl border text-center transition-all ${
            isOut
              ? 'bg-rose-50/70 dark:bg-rose-950/30 border-rose-200 dark:border-rose-900/60'
              : isLow
              ? 'bg-amber-50/70 dark:bg-amber-950/30 border-amber-200 dark:border-amber-900/60'
              : 'bg-slate-50 dark:bg-slate-800/60 border-slate-100 dark:border-slate-800'
          }`}
        >
          <span className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-1">
            Available Stock
          </span>
          <div className="flex items-baseline justify-center gap-1.5">
            <span
              className={`text-2xl font-black font-mono tracking-tight ${
                isOut
                  ? 'text-rose-600 dark:text-rose-400'
                  : isLow
                  ? 'text-amber-600 dark:text-amber-400'
                  : 'text-slate-900 dark:text-white'
              }`}
            >
              {stock.toLocaleString(undefined, { maximumFractionDigits: 2 })}
            </span>
            <span className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase">
              {itemUnit}
            </span>
          </div>

          <div className="flex items-center justify-center gap-2 mt-1.5 text-[10px]">
            {activeBatchCount > 0 && (
              <span className="text-blue-600 dark:text-blue-400 font-semibold inline-flex items-center gap-1">
                <Layers className="w-3 h-3" />
                <span>{activeBatchCount} FIFO Lot{activeBatchCount > 1 ? 's' : ''}</span>
              </span>
            )}
            {alertThreshold > 0 && (
              <span className="text-slate-400 font-medium">
                (Min: {alertThreshold} {itemUnit})
              </span>
            )}
          </div>
        </div>

        {/* Pricing & Stock Valuation Matrix */}
        <div className="space-y-1.5 text-xs pt-1 border-t border-slate-100 dark:border-slate-800">
          <div className="flex items-center justify-between text-slate-600 dark:text-slate-400">
            <span className="text-[11px] font-medium">Purchase Price:</span>
            <span className="font-bold text-slate-800 dark:text-slate-200 font-mono text-[11px]">
              {currencySymbol} {latestPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} / {itemUnit}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-slate-600 dark:text-slate-400">Stock Value:</span>
            <span className="font-black text-emerald-600 dark:text-emerald-400 font-mono text-xs">
              {currencySymbol} {stockValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>

          {item.last_purchase_date && (
            <div className="flex items-center justify-between text-[10px] text-slate-400 pt-0.5">
              <span className="flex items-center gap-1">
                <Clock className="w-2.5 h-2.5" />
                <span>Last Purchase:</span>
              </span>
              <span className="font-mono">
                {new Date(item.last_purchase_date).toLocaleDateString()}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Card Footer Actions */}
      <div
        className="mt-3.5 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center gap-2"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={() => onViewDetails(item)}
          className="flex-1 py-1.5 px-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-2xs"
          title="View full purchase history, FIFO batches, and stock movements"
        >
          <Eye className="w-3.5 h-3.5 text-slate-500" />
          <span>View Details</span>
        </button>

        <button
          type="button"
          onClick={() => onEdit(item)}
          className="py-1.5 px-3 bg-brand-50 hover:bg-brand-100 dark:bg-brand-950/60 dark:hover:bg-brand-900/60 text-brand-700 dark:text-brand-300 border border-brand-200 dark:border-brand-800 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-2xs"
          title="Edit item name, unit, safety alert, or cost"
        >
          <Edit2 className="w-3.5 h-3.5 text-brand-500" />
          <span>Edit</span>
        </button>
      </div>
    </div>
  );
};

