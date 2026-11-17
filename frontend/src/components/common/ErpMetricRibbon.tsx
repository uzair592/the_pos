import React from 'react';

export interface ErpMetricPill {
  id?: string;
  label: string;
  value: React.ReactNode;
  subtext?: string;
  variant?: 'emerald' | 'amber' | 'rose' | 'indigo' | 'slate' | 'orange';
  icon?: React.ReactNode;
  onClick?: () => void;
}

interface ErpMetricRibbonProps {
  metrics: ErpMetricPill[];
  actions?: React.ReactNode;
  className?: string;
}

const variantStyles: Record<NonNullable<ErpMetricPill['variant']>, string> = {
  emerald:
    'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800/60 text-emerald-900 dark:text-emerald-200',
  amber:
    'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800/60 text-amber-900 dark:text-amber-200',
  rose:
    'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800/60 text-rose-900 dark:text-rose-200',
  indigo:
    'bg-indigo-50 dark:bg-indigo-950/40 border-indigo-200 dark:border-indigo-800/60 text-indigo-900 dark:text-indigo-200',
  slate:
    'bg-slate-100 dark:bg-slate-800/70 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200',
  orange:
    'bg-orange-50 dark:bg-orange-950/40 border-orange-200 dark:border-orange-800/60 text-orange-900 dark:text-orange-200',
};

const dotColors: Record<NonNullable<ErpMetricPill['variant']>, string> = {
  emerald: 'bg-emerald-500',
  amber: 'bg-amber-500',
  rose: 'bg-rose-500',
  indigo: 'bg-indigo-500',
  slate: 'bg-slate-400',
  orange: 'bg-orange-500',
};

export const ErpMetricRibbon: React.FC<ErpMetricRibbonProps> = ({
  metrics,
  actions,
  className = '',
}) => {
  return (
    <div
      className={`h-11 min-h-[44px] max-h-[44px] bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-3 flex items-center justify-between gap-3 shrink-0 overflow-x-auto select-none ${className}`}
    >
      <div className="flex items-center gap-2 overflow-x-auto py-1 scrollbar-none">
        {metrics.map((m, idx) => {
          const v = m.variant || 'slate';
          return (
            <div
              key={m.id || idx}
              onClick={m.onClick}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded border text-xs font-medium whitespace-nowrap transition-colors ${
                variantStyles[v]
              } ${m.onClick ? 'cursor-pointer hover:brightness-95' : ''}`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${dotColors[v]}`} />
              {m.icon && <span className="opacity-75">{m.icon}</span>}
              <span className="text-[11px] opacity-75 font-normal tracking-wide">{m.label}:</span>
              <span className="font-semibold font-mono tabular-nums">{m.value}</span>
              {m.subtext && <span className="text-[10px] opacity-60">({m.subtext})</span>}
            </div>
          );
        })}
      </div>

      {actions && (
        <div className="flex items-center gap-2 shrink-0 pl-2 border-l border-slate-200 dark:border-slate-800">
          {actions}
        </div>
      )}
    </div>
  );
};

export default ErpMetricRibbon;
