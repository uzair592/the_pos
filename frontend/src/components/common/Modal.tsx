import React, { useEffect } from 'react';
import { X } from 'lucide-react';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl' | '5xl' | '6xl' | '7xl' | 'full';
  className?: string;
  bodyClassName?: string;
}

const maxWidthMap = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
  '2xl': 'max-w-2xl',
  '3xl': 'max-w-3xl',
  '4xl': 'max-w-4xl',
  '5xl': 'max-w-5xl',
  '6xl': 'max-w-6xl',
  '7xl': 'max-w-7xl',
  full: 'max-w-[96vw]',
};

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  footer,
  maxWidth = 'lg',
  className = '',
  bodyClassName = '',
}) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto print:static print:overflow-visible">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity no-print"
        onClick={onClose}
      />

      {/* Modal Dialog Container */}
      <div className="flex min-h-full items-center justify-center p-3 sm:p-4 text-center print:p-0 print:block">
        <div
          className={`relative transform overflow-hidden rounded-2xl bg-white dark:bg-slate-900 text-left shadow-2xl transition-all my-2 sm:my-4 md:my-6 w-full ${maxWidthMap[maxWidth]} border border-slate-200 dark:border-slate-800 flex flex-col max-h-[calc(100vh-1.5rem)] sm:max-h-[calc(100vh-2.5rem)] md:max-h-[calc(100vh-3.5rem)] print:transform-none print:shadow-none print:border-none print:static print:max-w-none print:overflow-visible print:bg-transparent print:p-0 ${className}`}
        >
          {/* Header */}
          <div className="no-print flex items-center justify-between border-b border-slate-100 dark:border-slate-800 px-6 py-4 shrink-0 bg-white dark:bg-slate-900 z-10">
            <div className="flex-1 pr-4">
              {typeof title === 'string' ? (
                <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white leading-tight">
                  {title}
                </h3>
              ) : (
                title
              )}
              {subtitle && (
                <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {subtitle}
                </div>
              )}
            </div>
            <button
              onClick={onClose}
              type="button"
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shrink-0"
              title="Close modal (Esc)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Body */}
          <div className={`px-6 py-5 overflow-y-auto flex-1 dark:text-slate-200 print:max-h-none print:overflow-visible print:p-0 ${bodyClassName}`}>
            {children}
          </div>

          {/* Optional Sticky Footer */}
          {footer && (
            <div className="no-print border-t border-slate-100 dark:border-slate-800 bg-slate-50/90 dark:bg-slate-800/70 px-6 py-3.5 shrink-0 rounded-b-2xl">
              {footer}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
