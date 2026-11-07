import React from 'react';
import { Modal } from './Modal.js';
import { Keyboard, Command, Sparkles } from 'lucide-react';

interface KeyboardShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const KeyboardShortcutsModal: React.FC<KeyboardShortcutsModalProps> = ({ isOpen, onClose }) => {
  const sections = [
    {
      title: 'Top Header & Quick Actions',
      shortcuts: [
        { key: 'Alt + S', desc: 'Open POS Terminal / New Sale' },
        { key: 'Alt + F', desc: 'Sale Order / Advance Order' },
        { key: 'Alt + I', desc: 'Payment-In (Customer Receipt)' },
        { key: 'Alt + R', desc: 'Sale Return / Refund' },
        { key: 'Alt + M', desc: 'Estimate / Quotation' },
        { key: 'Alt + D', desc: 'Delivery Challan Slip' },
        { key: 'Alt + P', desc: 'Add Purchase / Purchase Bill' },
        { key: 'Alt + G', desc: 'Create Purchase Order' },
        { key: 'Alt + L', desc: 'Purchase Return to Supplier' },
        { key: 'Alt + O', desc: 'Payment-Out (Supplier Payment)' },
        { key: 'Ctrl + K', desc: 'Global Unified Search' },
      ],
    },
    {
      title: 'POS Billing Terminal',
      shortcuts: [
        { key: 'Space / F9', desc: 'Instant Exact Cash Checkout' },
        { key: 'F1', desc: 'Switch to Dine-In Mode' },
        { key: 'F2', desc: 'Switch to Takeaway Mode' },
        { key: 'F4', desc: 'Switch to Delivery Mode' },
        { key: 'F8', desc: 'Apply Bill Discount' },
        { key: 'Esc', desc: 'Cancel Order / Close Modal' },
      ],
    },
    {
      title: 'Navigation & General',
      shortcuts: [
        { key: 'Alt + 1', desc: 'Navigate to Dashboard' },
        { key: 'Alt + 2', desc: 'Navigate to Orders' },
        { key: 'Alt + 3', desc: 'Navigate to Kitchen (KDS)' },
        { key: 'Alt + 4', desc: 'Navigate to Inventory' },
      ],
    },
  ];

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Keyboard Shortcuts Cheat Sheet" maxWidth="xl">
      <div className="space-y-6 text-xs">
        <div className="flex items-center space-x-2.5 bg-brand-50/70 dark:bg-brand-950/30 p-3.5 rounded-2xl border border-brand-200 dark:border-brand-900/50 text-slate-700 dark:text-slate-300">
          <Sparkles className="w-5 h-5 text-brand-500 shrink-0" />
          <p>
            Use keyboard shortcuts to operate the restaurant POS at high speed. Shortcuts work across any page unless you are typing in an input field.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {sections.map((sec, idx) => (
            <div
              key={idx}
              className={`bg-slate-50/80 dark:bg-slate-800/40 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 space-y-2.5 ${
                idx === 0 ? 'md:col-span-2' : ''
              }`}
            >
              <h4 className="font-extrabold text-slate-900 dark:text-white uppercase tracking-wider text-[11px] mb-2 flex items-center space-x-1.5">
                <Keyboard className="w-3.5 h-3.5 text-brand-500" />
                <span>{sec.title}</span>
              </h4>
              <div className={`grid ${idx === 0 ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1'} gap-2`}>
                {sec.shortcuts.map((sc, sIdx) => (
                  <div
                    key={sIdx}
                    className="flex items-center justify-between p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-2xs"
                  >
                    <span className="text-slate-600 dark:text-slate-300 font-medium">{sc.desc}</span>
                    <kbd className="px-2 py-1 rounded-md bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-mono font-black text-[10px] text-slate-800 dark:text-slate-200 shadow-2xs">
                      {sc.key}
                    </kbd>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="flex justify-end pt-2 border-t border-slate-200 dark:border-slate-800">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold text-xs shadow-sm hover:opacity-90 transition-opacity"
          >
            Close Guide
          </button>
        </div>
      </div>
    </Modal>
  );
};

