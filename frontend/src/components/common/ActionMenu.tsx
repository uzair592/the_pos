import React, { useState, useRef, useEffect } from 'react';
import { MoreVertical } from 'lucide-react';

export interface ActionMenuItem {
  label: string;
  icon?: React.ComponentType<{ className?: string }> | React.ReactNode;
  onClick: () => void;
  variant?: 'default' | 'danger' | 'warning' | 'success';
  disabled?: boolean;
  divider?: boolean;
}

export interface ActionMenuProps {
  items: (ActionMenuItem | null | undefined | false)[];
  align?: 'right' | 'left';
  className?: string;
  buttonClassName?: string;
  ariaLabel?: string;
}

export const ActionMenu: React.FC<ActionMenuProps> = ({
  items,
  align = 'right',
  className = '',
  buttonClassName = '',
  ariaLabel = 'Actions menu',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [openUpward, setOpenUpward] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const activeItems = items.filter(Boolean) as ActionMenuItem[];

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  // Check if we should open upward to avoid viewport bottom clipping
  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      // If less than 240px below, flip upward
      setOpenUpward(spaceBelow < 240);
    }
    setIsOpen((prev) => !prev);
  };

  if (activeItems.length === 0) return null;

  return (
    <div ref={menuRef} className={`relative inline-block text-left ${className}`}>
      {/* 3 Dots Trigger Button */}
      <button
        ref={buttonRef}
        type="button"
        onClick={handleToggle}
        aria-label={ariaLabel}
        aria-expanded={isOpen}
        className={`p-1.5 rounded-lg text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500/40 ${
          isOpen ? 'bg-slate-100 dark:bg-slate-800 text-brand-600 dark:text-brand-400 ring-1 ring-slate-300 dark:ring-slate-700' : ''
        } ${buttonClassName}`}
        title="More Actions"
      >
        <MoreVertical className="w-4 h-4" />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div
          role="menu"
          className={`absolute ${align === 'right' ? 'right-0' : 'left-0'} ${
            openUpward ? 'bottom-full mb-1.5' : 'top-full mt-1.5'
          } w-48 sm:w-52 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xl shadow-slate-900/10 dark:shadow-black/50 py-1.5 z-50 animate-in fade-in zoom-in-95 duration-100`}
        >
          {activeItems.map((item, idx) => {
            const Icon = item.icon;

            const variantClasses = {
              default: 'text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/70',
              danger: 'text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40',
              warning: 'text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/40',
              success: 'text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40',
            }[item.variant || 'default'];

            return (
              <React.Fragment key={idx}>
                {item.divider && (
                  <div className="my-1 border-t border-slate-100 dark:border-slate-800/80" />
                )}
                <button
                  type="button"
                  role="menuitem"
                  disabled={item.disabled}
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsOpen(false);
                    item.onClick();
                  }}
                  className={`w-full flex items-center space-x-2.5 px-3.5 py-2 text-xs font-semibold text-left transition-colors ${
                    item.disabled ? 'opacity-40 cursor-not-allowed' : variantClasses
                  }`}
                >
                  {React.isValidElement(item.icon) ? (
                    item.icon
                  ) : typeof item.icon === 'function' ? (
                    <item.icon className="w-3.5 h-3.5 shrink-0 opacity-80" />
                  ) : null}
                  <span className="truncate">{item.label}</span>
                </button>
              </React.Fragment>
            );
          })}
        </div>
      )}
    </div>
  );
};
