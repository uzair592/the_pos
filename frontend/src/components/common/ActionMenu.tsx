import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
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
  const [coords, setCoords] = useState<{ top: number; left: number; openUpward: boolean } | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuPortalRef = useRef<HTMLDivElement>(null);

  const activeItems = items.filter(Boolean) as ActionMenuItem[];

  const updatePosition = () => {
    if (!buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    const menuWidth = 208; // w-52 is 13rem = 208px
    const spaceBelow = window.innerHeight - rect.bottom;
    const openUpward = spaceBelow < 250 && rect.top > spaceBelow;

    let left = align === 'right' ? rect.right - menuWidth : rect.left;
    // Boundary check so menu doesn't overflow viewport edges
    if (left < 10) left = 10;
    if (left + menuWidth > window.innerWidth - 10) {
      left = window.innerWidth - menuWidth - 10;
    }

    const top = openUpward ? rect.top - 6 : rect.bottom + 6;

    setCoords({ top, left, openUpward });
  };

  // Close on outside click, window resize, or scroll
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (
        buttonRef.current && buttonRef.current.contains(e.target as Node)
      ) {
        return;
      }
      if (
        menuPortalRef.current && menuPortalRef.current.contains(e.target as Node)
      ) {
        return;
      }
      setIsOpen(false);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };

    const handleScrollOrResize = () => {
      // Re-position or close if target scrolled away
      if (isOpen) {
        updatePosition();
      }
    };

    document.addEventListener('mousedown', handleClickOutside, true);
    document.addEventListener('keydown', handleKeyDown);
    window.addEventListener('resize', handleScrollOrResize);
    window.addEventListener('scroll', handleScrollOrResize, true);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside, true);
      document.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('resize', handleScrollOrResize);
      window.removeEventListener('scroll', handleScrollOrResize, true);
    };
  }, [isOpen]);

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isOpen) {
      updatePosition();
      setIsOpen(true);
    } else {
      setIsOpen(false);
    }
  };

  if (activeItems.length === 0) return null;

  return (
    <div className={`relative inline-block text-left ${className}`}>
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

      {/* Render Dropdown in Portal to escape table overflow clipping and unwanted scrollbars */}
      {isOpen && coords && createPortal(
        <div
          ref={menuPortalRef}
          role="menu"
          style={{
            position: 'fixed',
            left: `${coords.left}px`,
            top: coords.openUpward ? undefined : `${coords.top}px`,
            bottom: coords.openUpward ? `${window.innerHeight - coords.top}px` : undefined,
            zIndex: 99999,
          }}
          className="w-48 sm:w-52 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl shadow-slate-900/20 dark:shadow-black/70 py-1.5 animate-in fade-in zoom-in-95 duration-100 ring-1 ring-black/5"
        >
          {activeItems.map((item, idx) => {
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
        </div>,
        document.body
      )}
    </div>
  );
};
