import React from 'react';

interface ErpPageHeaderProps {
  title: string;
  badge?: React.ReactNode;
  subtitle?: string;
  breadcrumbs?: React.ReactNode;
  actions?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}

export const ErpPageHeader: React.FC<ErpPageHeaderProps> = ({
  title,
  badge,
  subtitle,
  breadcrumbs,
  actions,
  children,
  className = '',
}) => {
  return (
    <div
      className={`h-11 min-h-[44px] max-h-[44px] bg-slate-50 dark:bg-slate-900/90 border-b border-slate-200 dark:border-slate-800 px-3.5 flex items-center justify-between gap-3 shrink-0 ${className}`}
    >
      <div className="flex items-center gap-2.5 min-w-0">
        {breadcrumbs && (
          <div className="hidden md:flex items-center text-xs text-slate-500 mr-1 shrink-0">
            {breadcrumbs}
          </div>
        )}
        <h1 className="text-sm font-bold text-slate-800 dark:text-slate-100 uppercase tracking-wide truncate flex items-center gap-2">
          {title}
          {badge && (
            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
              {badge}
            </span>
          )}
        </h1>
        {subtitle && (
          <span className="hidden xl:inline text-xs text-slate-600 dark:text-slate-300 truncate max-w-xs">
            | {subtitle}
          </span>
        )}
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {children}
        {actions && <div className="flex items-center gap-1.5">{actions}</div>}
      </div>
    </div>
  );
};

export default ErpPageHeader;
