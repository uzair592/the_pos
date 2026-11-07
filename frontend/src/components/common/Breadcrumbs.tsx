import React from 'react';
import { useLocation, Link } from 'react-router-dom';
import { ChevronRight, Home } from 'lucide-react';

interface BreadcrumbItem {
  label: string;
  to?: string;
}

export const Breadcrumbs: React.FC = () => {
  const location = useLocation();
  const path = location.pathname;
  const search = location.search;
  const full = path + search;

  // Resolve breadcrumbs hierarchy based on path and query parameters
  const getBreadcrumbs = (): BreadcrumbItem[] => {
    // 1. Dashboard & Hub
    if (path === '/app') {
      return [{ label: 'General' }, { label: 'Dashboard', to: '/app' }];
    }
    if (path === '/hub' || path === '/workspace') {
      return [{ label: 'General' }, { label: 'Workspace Hub', to: '/hub' }];
    }

    // 2. Sales
    if (path === '/pos') {
      return [{ label: 'Sales' }, { label: 'POS', to: '/pos' }];
    }
    if (path === '/kds') {
      return [{ label: 'Sales' }, { label: 'Kitchen', to: '/kds' }];
    }
    if (path.startsWith('/app/orders')) {
      const base: BreadcrumbItem[] = [{ label: 'Sales' }, { label: 'Orders', to: '/app/orders' }];
      if (search.includes('tab=active')) {
        base.push({ label: 'Active & Queued' });
      } else if (search.includes('tab=completed')) {
        base.push({ label: 'Completed Orders' });
      } else if (search.includes('tab=cancelled')) {
        base.push({ label: 'Cancelled Orders' });
      } else if (search.includes('tab=reservations') || path.includes('/reservations')) {
        base.push({ label: 'Reservations' });
      } else if (search.includes('tab=waitlist') || path.includes('/waitlist')) {
        base.push({ label: 'Waitlist' });
      } else {
        base.push({ label: 'All Orders' });
      }
      return base;
    }

    // 3. Inventory
    if (path === '/app/menu') {
      return [{ label: 'Inventory' }, { label: 'Menu', to: '/app/menu' }];
    }
    if (path === '/app/purchases') {
      return [{ label: 'Inventory' }, { label: 'Purchases', to: '/app/purchases' }];
    }
    if (path.startsWith('/app/inventory')) {
      const base: BreadcrumbItem[] = [
        { label: 'Inventory' },
        { label: 'Inventory', to: '/app/inventory?tab=overview' },
      ];
      if (search.includes('tab=STOCK')) {
        base.push({ label: 'Ingredients' });
      } else if (search.includes('tab=movements')) {
        base.push({ label: 'Movements' });
      } else if (search.includes('tab=low_stock')) {
        base.push({ label: 'Low Stock' });
      } else if (search.includes('tab=adjustments') || search.includes('tab=BATCHES')) {
        base.push({ label: 'Adjustments' });
      } else if (search.includes('tab=TRANSFERS')) {
        base.push({ label: 'Transfers' });
      } else if (search.includes('tab=RECIPES')) {
        base.push({ label: 'Recipes' });
      } else {
        base.push({ label: 'Overview' });
      }
      return base;
    }

    // 4. Operations
    if (path === '/app/daybook') {
      return [{ label: 'Operations' }, { label: 'Daybook', to: '/app/daybook' }];
    }
    if (path === '/app/cash-and-bank' || path === '/app/cash-bank') {
      return [{ label: 'Operations' }, { label: 'Cash & Bank', to: '/app/cash-and-bank' }];
    }

    // 5. Finance
    if (path === '/app/recipe-costing' || path === '/app/reports/recipe-costing') {
      return [{ label: 'Finance' }, { label: 'Costing', to: '/app/reports/recipe-costing' }];
    }
    if (path === '/app/expenses') {
      return [{ label: 'Finance' }, { label: 'Expenses', to: '/app/expenses' }];
    }
    if (path.startsWith('/app/reports')) {
      const base: BreadcrumbItem[] = [{ label: 'Finance' }, { label: 'Reports', to: '/app/reports' }];
      if (path.includes('bill-profit-loss') || search.includes('tab=BILL_PROFIT_LOSS')) {
        base.push({ label: 'Bill-Wise Profit & Loss' });
      } else if (search.includes('tab=SALES')) {
        base.push({ label: 'Sales & Revenue' });
      } else if (search.includes('tab=EXPENSES')) {
        base.push({ label: 'Expense Analysis' });
      } else if (search.includes('tab=GROSS_PROFIT') || search.includes('tab=DAILY_PL')) {
        base.push({ label: 'Daily Profit & Loss' });
      } else if (search.includes('tab=MONTHLY_PL')) {
        base.push({ label: 'Monthly Profit & Loss' });
      } else if (search.includes('tab=BRANCH_FINANCIAL')) {
        base.push({ label: 'Branch-wise Financials' });
      }
      return base;
    }

    // 6. Management
    if (path === '/app/staff') {
      return [{ label: 'Management' }, { label: 'Staff', to: '/app/staff' }];
    }
    if (path.startsWith('/app/settings')) {
      const base: BreadcrumbItem[] = [
        { label: 'Management' },
        { label: 'Settings', to: '/app/settings?tab=general' },
      ];
      if (search.includes('tab=tables')) {
        base.push({ label: 'Floor & Table Management' });
      } else if (search.includes('tab=printing')) {
        base.push({ label: 'Receipt & Printing' });
      } else if (search.includes('tab=devices')) {
        base.push({ label: 'Registered Terminals' });
      } else if (search.includes('tab=backups')) {
        base.push({ label: 'Backups & Recovery' });
      } else {
        base.push({ label: 'General Settings' });
      }
      return base;
    }

    // 7. Platform Super Admin
    if (path.startsWith('/platform-admin')) {
      const sub = path.replace('/platform-admin', '').replace('/', '') || 'Dashboard';
      return [
        { label: 'CloudPOS Platform' },
        { label: sub.charAt(0).toUpperCase() + sub.slice(1) },
      ];
    }

    return [{ label: 'Application' }];
  };

  const items = getBreadcrumbs();

  return (
    <nav aria-label="Breadcrumb" className="flex items-center space-x-1.5 text-xs">
      <Link
        to="/app"
        className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
        title="Go to Dashboard"
      >
        <Home className="w-3.5 h-3.5" />
      </Link>

      {items.map((item, index) => {
        const isLast = index === items.length - 1;
        return (
          <React.Fragment key={index}>
            <ChevronRight className="w-3 h-3 text-slate-300 dark:text-slate-600 shrink-0" />
            {item.to && !isLast ? (
              <Link
                to={item.to}
                className="text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white font-medium transition-colors truncate max-w-[140px] sm:max-w-none"
              >
                {item.label}
              </Link>
            ) : (
              <span
                className={`truncate max-w-[160px] sm:max-w-none ${
                  isLast
                    ? 'font-extrabold text-slate-800 dark:text-slate-100'
                    : 'text-slate-500 dark:text-slate-400 font-medium'
                }`}
              >
                {item.label}
              </span>
            )}
          </React.Fragment>
        );
      })}
    </nav>
  );
};

