import React from 'react';
import { LucideIcon } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  trend?: string;
  isPositive?: boolean;
  color?: 'orange' | 'blue' | 'green' | 'purple' | 'amber';
}

const colorMap = {
  orange: 'bg-orange-50 text-orange-600 border-orange-100',
  blue: 'bg-blue-50 text-blue-600 border-blue-100',
  green: 'bg-emerald-50 text-emerald-600 border-emerald-100',
  purple: 'bg-purple-50 text-purple-600 border-purple-100',
  amber: 'bg-amber-50 text-amber-600 border-amber-100',
};

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  isPositive,
  color = 'orange',
}) => {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{title}</p>
          <h3 className="text-2xl font-bold text-slate-900 mt-1">{value}</h3>
        </div>
        <div className={`p-3 rounded-lg border ${colorMap[color]}`}>
          <Icon className="w-6 h-6" />
        </div>
      </div>
      {(subtitle || trend) && (
        <div className="mt-3 flex items-center text-xs">
          {trend && (
            <span
              className={`font-semibold mr-1.5 ${
                isPositive ? 'text-emerald-600' : 'text-rose-600'
              }`}
            >
              {trend}
            </span>
          )}
          {subtitle && <span className="text-slate-500">{subtitle}</span>}
        </div>
      )}
    </div>
  );
};
