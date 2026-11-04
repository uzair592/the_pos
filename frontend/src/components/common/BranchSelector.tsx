import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext.js';
import { Building2, ChevronDown, Check, Globe, MapPin } from 'lucide-react';
import { SystemRole } from '@pos/shared';

interface BranchSelectorProps {
  variant?: 'navbar' | 'hub' | 'card';
  className?: string;
  onChangeBranch?: (branchId: string | null) => void;
}

export const BranchSelector: React.FC<BranchSelectorProps> = ({
  variant = 'navbar',
  className = '',
  onChangeBranch,
}) => {
  const { user, branches, currentBranchId, currentBranch, switchBranch, isSuperAdmin } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (isSuperAdmin || !branches || branches.length === 0) {
    return null;
  }

  const role = (user?.role || '').toUpperCase();
  const isOwnerOrAdmin =
    role === SystemRole.RESTAURANT_OWNER ||
    role === 'OWNER' ||
    role === SystemRole.RESTAURANT_ADMIN ||
    role === 'ADMIN' ||
    role === SystemRole.BRANCH_MANAGER ||
    role === 'MANAGER';

  // If user only has 1 branch and is not owner/admin, display simple badge
  if (branches.length === 1 && !isOwnerOrAdmin) {
    return (
      <div className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold ${
        variant === 'hub'
          ? 'bg-slate-900/80 border border-slate-800 text-slate-300'
          : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
      } ${className}`}>
        <Building2 className="w-3.5 h-3.5 text-brand-500" />
        <span>{branches[0].name}</span>
        <span className="text-[10px] opacity-70 px-1 rounded bg-black/20 font-mono">{branches[0].code}</span>
      </div>
    );
  }

  const handleSelect = (branchId: string | null) => {
    switchBranch(branchId);
    setIsOpen(false);
    if (onChangeBranch) onChangeBranch(branchId);
  };

  // Styles based on variant
  const buttonStyles =
    variant === 'hub'
      ? 'bg-slate-900/90 hover:bg-slate-800 border border-slate-700/80 text-white shadow-lg'
      : 'bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-700';

  const dropdownStyles =
    variant === 'hub'
      ? 'bg-[#0f1423] border border-slate-700/80 text-white shadow-2xl'
      : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white shadow-xl';

  return (
    <div className={`relative inline-block text-left ${className}`} ref={containerRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center space-x-2 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${buttonStyles}`}
        title="Switch Branch / Head Office"
      >
        {currentBranchId ? (
          <>
            <MapPin className="w-3.5 h-3.5 text-brand-500 shrink-0" />
            <span className="truncate max-w-[140px] sm:max-w-[180px]">
              {currentBranch?.name || 'Selected Branch'}
            </span>
            {currentBranch?.code && (
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-brand-500/20 text-brand-400 font-extrabold border border-brand-500/30">
                {currentBranch.code}
              </span>
            )}
          </>
        ) : (
          <>
            <Globe className="w-3.5 h-3.5 text-blue-400 shrink-0" />
            <span className="truncate max-w-[150px] sm:max-w-[200px]">All Branches (Head Office)</span>
          </>
        )}
        <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className={`absolute left-0 sm:right-0 sm:left-auto mt-2 w-72 rounded-2xl p-1.5 z-50 animate-in fade-in zoom-in-95 ${dropdownStyles}`}>
          <div className="px-3 py-2 border-b border-slate-700/50 mb-1">
            <p className="text-[10px] font-black tracking-wider uppercase text-slate-400">
              Active Operational Location
            </p>
            <p className="text-xs text-slate-300 font-medium mt-0.5">
              Select branch for orders, stock & live terminals
            </p>
          </div>

          <div className="space-y-1 max-h-64 overflow-y-auto">
            {/* All Branches Option (Head Office) */}
            {isOwnerOrAdmin && (
              <button
                type="button"
                onClick={() => handleSelect(null)}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                  currentBranchId === null
                    ? 'bg-blue-600 text-white font-bold shadow-md'
                    : 'hover:bg-slate-800/60 text-slate-200'
                }`}
              >
                <div className="flex items-center space-x-2.5">
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${
                    currentBranchId === null ? 'bg-white/20' : 'bg-blue-500/10 text-blue-400'
                  }`}>
                    <Globe className="w-4 h-4" />
                  </div>
                  <div className="text-left">
                    <p className="font-bold leading-tight">All Branches (Head Office)</p>
                    <p className={`text-[10px] ${currentBranchId === null ? 'text-blue-100' : 'text-slate-400'}`}>
                      Consolidated multi-branch overview
                    </p>
                  </div>
                </div>
                {currentBranchId === null && <Check className="w-4 h-4 text-white" />}
              </button>
            )}

            {/* Individual Branches */}
            {branches.map((b) => {
              const isSelected = currentBranchId === b.id;
              return (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => handleSelect(b.id)}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                    isSelected
                      ? 'bg-brand-600 text-white font-bold shadow-md'
                      : 'hover:bg-slate-800/60 text-slate-200'
                  }`}
                >
                  <div className="flex items-center space-x-2.5">
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${
                      isSelected ? 'bg-white/20' : 'bg-brand-500/10 text-brand-400'
                    }`}>
                      <Building2 className="w-4 h-4" />
                    </div>
                    <div className="text-left">
                      <div className="flex items-center space-x-1.5">
                        <span className="font-bold leading-tight">{b.name}</span>
                        {b.is_main_branch && (
                          <span className={`text-[9px] px-1 py-0.2 rounded font-black uppercase ${
                            isSelected ? 'bg-white/30 text-white' : 'bg-amber-500/20 text-amber-400'
                          }`}>
                            Main
                          </span>
                        )}
                      </div>
                      <p className={`text-[10px] ${isSelected ? 'text-white/80' : 'text-slate-400'}`}>
                        {b.code} • {b.city || 'Active Branch'}
                      </p>
                    </div>
                  </div>
                  {isSelected && <Check className="w-4 h-4 text-white" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

