import React, { useState, useMemo } from 'react';
import { Modal } from './Modal.js';
import {
  Printer,
  Copy,
  Check,
  QrCode,
  FileText,
  Sliders,
  Utensils,
  Receipt,
  Sparkles,
  Layers,
  ChevronDown,
  Building,
  User,
  Phone,
  Calendar,
  CheckCircle2,
} from 'lucide-react';
import { ReceiptTemplateType } from '@pos/shared';

interface ReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  receiptData: any;
}

export const ReceiptModal: React.FC<ReceiptModalProps> = ({
  isOpen,
  onClose,
  receiptData,
}) => {
  if (!receiptData) return null;

  // Determine initial template based on restaurant settings or fallback
  const initialTemplate: ReceiptTemplateType =
    receiptData.receiptSettings?.defaultTemplate || 'STANDARD_80MM';

  const [activeTemplate, setActiveTemplate] = useState<ReceiptTemplateType>(initialTemplate);
  const [copied, setCopied] = useState(false);

  // Customization options state
  const [showUrdu] = useState<boolean>(false);
  const [showQrCode, setShowQrCode] = useState<boolean>(
    receiptData.receiptSettings?.showQrCode !== false
  );
  const [showTaxDetails, setShowTaxDetails] = useState<boolean>(
    receiptData.receiptSettings?.showTaxBreakdown !== false
  );
  const [showCustomer, setShowCustomer] = useState<boolean>(
    receiptData.receiptSettings?.showCustomerDetails !== false
  );
  const [showTipGuide, setShowTipGuide] = useState<boolean>(
    receiptData.receiptSettings?.showTipGuide !== false
  );

  const currency = receiptData.currencySymbol || 'Rs.';

  const handlePrint = () => {
    window.print();
  };

  // Generate plain-text representation for SMS / WhatsApp sharing
  const handleCopyText = () => {
    let text = `========================================\n`;
    text += `${receiptData.restaurantName?.toUpperCase()}\n`;
    text += `${receiptData.branchName} - Tel: ${receiptData.branchPhone || ''}\n`;
    if (receiptData.taxRegistrationNumber) {
      text += `STRN/NTN: ${receiptData.taxRegistrationNumber}\n`;
    }
    text += `========================================\n`;
    text += `Order #: ${receiptData.orderNumber}\n`;
    text += `Date: ${new Date(receiptData.date).toLocaleString()}\n`;
    text += `Type: ${receiptData.orderType}${receiptData.tableNumber ? ' (Table ' + receiptData.tableNumber + ')' : ''}\n`;
    text += `Cashier: ${receiptData.cashierName || 'Staff'}\n`;
    if (receiptData.customerName) {
      text += `Customer: ${receiptData.customerName} (${receiptData.customerPhone || ''})\n`;
    }
    text += `----------------------------------------\n`;
    receiptData.items?.forEach((i: any) => {
      text += `${i.quantity}x ${i.productName}${i.variantName ? ' (' + i.variantName + ')' : ''} - ${currency} ${Number(i.totalPrice).toLocaleString()}\n`;
      if (i.modifiers && Array.isArray(i.modifiers) && i.modifiers.length > 0) {
        const mods = i.modifiers.map((m: any) => m.name).join(', ');
        text += `   + Addons: ${mods}\n`;
      }
      if (i.notes) {
        text += `   * Note: ${i.notes}\n`;
      }
    });
    text += `----------------------------------------\n`;
    text += `Subtotal: ${currency} ${Number(receiptData.subtotal).toLocaleString()}\n`;
    if (receiptData.discount > 0) {
      text += `Discount: -${currency} ${Number(receiptData.discount).toLocaleString()}\n`;
    }
    if (receiptData.taxAmount > 0) {
      text += `Tax (${receiptData.taxPercent}%): ${currency} ${Number(receiptData.taxAmount).toLocaleString()}\n`;
    }
    if (receiptData.serviceChargeAmount > 0) {
      text += `Service Charge: ${currency} ${Number(receiptData.serviceChargeAmount).toLocaleString()}\n`;
    }
    if (receiptData.deliveryFee > 0) {
      text += `Delivery Fee: ${currency} ${Number(receiptData.deliveryFee).toLocaleString()}\n`;
    }
    text += `GRAND TOTAL: ${currency} ${Number(receiptData.grandTotal).toLocaleString()}\n`;
    text += `========================================\n`;
    text += `${receiptData.receiptSettings?.footerText || 'Thank you for your visit!'}\n`;

    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // SVG QR Code generator simulation
  const renderQrCodeSvg = (value: string) => (
    <svg className="w-20 h-20 mx-auto" viewBox="0 0 33 33" fill="currentColor">
      <rect x="0" y="0" width="7" height="7" fill="black" />
      <rect x="1" y="1" width="5" height="5" fill="white" />
      <rect x="2" y="2" width="3" height="3" fill="black" />
      <rect x="26" y="0" width="7" height="7" fill="black" />
      <rect x="27" y="1" width="5" height="5" fill="white" />
      <rect x="28" y="2" width="3" height="3" fill="black" />
      <rect x="0" y="26" width="7" height="7" fill="black" />
      <rect x="1" y="27" width="5" height="5" fill="white" />
      <rect x="2" y="28" width="3" height="3" fill="black" />
      <rect x="9" y="2" width="2" height="2" fill="black" />
      <rect x="13" y="1" width="3" height="2" fill="black" />
      <rect x="18" y="2" width="2" height="3" fill="black" />
      <rect x="22" y="3" width="2" height="2" fill="black" />
      <rect x="9" y="8" width="3" height="3" fill="black" />
      <rect x="14" y="9" width="4" height="2" fill="black" />
      <rect x="20" y="8" width="2" height="4" fill="black" />
      <rect x="2" y="9" width="3" height="2" fill="black" />
      <rect x="8" y="14" width="2" height="4" fill="black" />
      <rect x="12" y="13" width="4" height="4" fill="black" />
      <rect x="18" y="14" width="3" height="2" fill="black" />
      <rect x="23" y="13" width="4" height="3" fill="black" />
      <rect x="29" y="10" width="3" height="3" fill="black" />
      <rect x="10" y="20" width="2" height="3" fill="black" />
      <rect x="14" y="19" width="3" height="2" fill="black" />
      <rect x="19" y="18" width="4" height="3" fill="black" />
      <rect x="25" y="19" width="3" height="4" fill="black" />
      <rect x="9" y="26" width="3" height="2" fill="black" />
      <rect x="14" y="25" width="2" height="4" fill="black" />
      <rect x="18" y="26" width="4" height="2" fill="black" />
      <rect x="24" y="26" width="2" height="3" fill="black" />
      <rect x="28" y="25" width="3" height="3" fill="black" />
      <rect x="10" y="30" width="4" height="2" fill="black" />
      <rect x="16" y="29" width="3" height="2" fill="black" />
      <rect x="21" y="30" width="4" height="2" fill="black" />
      <rect x="27" y="30" width="3" height="2" fill="black" />
    </svg>
  );

  // SVG Barcode representation
  const renderBarcodeSvg = (value: string) => (
    <div className="flex flex-col items-center justify-center my-1">
      <div className="flex items-center space-x-[2px] h-8">
        {[2, 1, 3, 1, 2, 4, 1, 3, 2, 1, 4, 2, 1, 3, 1, 2, 3, 1, 2, 4, 1, 2, 3, 1, 2].map((w, i) => (
          <div
            key={i}
            className="bg-black h-full"
            style={{ width: `${w}px` }}
          />
        ))}
      </div>
      <span className="text-[9px] font-mono tracking-widest mt-0.5">{value}</span>
    </div>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Print Bill & Invoice - Template Selection"
      maxWidth={activeTemplate === 'TAX_INVOICE_A4' ? '2xl' : 'lg'}
    >
      <div className="space-y-4">
        {/* ==================== TEMPLATE SELECTOR TABS ==================== */}
        <div className="no-print bg-slate-100 dark:bg-slate-800/80 p-1.5 rounded-2xl border border-slate-200 dark:border-slate-700/80">
          <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1.5 px-2 flex items-center justify-between">
            <span className="flex items-center space-x-1">
              <Layers className="w-3.5 h-3.5 text-brand-500" />
              <span>Select Bill Format / Print Template:</span>
            </span>
            <span className="text-[10px] text-brand-600 dark:text-brand-400 font-extrabold uppercase">
              5 Styles Available
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5">
            {[
              {
                id: 'STANDARD_80MM' as ReceiptTemplateType,
                name: 'Standard Thermal',
                subtitle: '80mm POS Roll',
                icon: '🧾',
              },
              {
                id: 'FINE_DINING' as ReceiptTemplateType,
                name: 'Guest Check',
                subtitle: 'Dine-In Slip',
                icon: '🍽️',
              },
              {
                id: 'COMPACT_58MM' as ReceiptTemplateType,
                name: 'Compact 58mm',
                subtitle: 'Mobile Roll',
                icon: '⚡',
              },
              {
                id: 'TAX_INVOICE_A4' as ReceiptTemplateType,
                name: 'GST Tax Invoice',
                subtitle: 'Full A4 Format',
                icon: '📑',
              },
              {
                id: 'KITCHEN_TOKEN' as ReceiptTemplateType,
                name: 'Kitchen Token',
                subtitle: 'KOT / Dispatch',
                icon: '🎟️',
              },
            ].map((t) => {
              const isSelected = activeTemplate === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setActiveTemplate(t.id)}
                  className={`p-2 rounded-xl text-left flex flex-col justify-between transition-all select-none ${
                    isSelected
                      ? 'bg-brand-500 text-white shadow-md ring-2 ring-brand-400/50'
                      : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700/60'
                  }`}
                >
                  <div className="flex items-center space-x-1.5 mb-1">
                    <span className="text-sm">{t.icon}</span>
                    <span className="font-extrabold text-xs truncate leading-tight">
                      {t.name}
                    </span>
                  </div>
                  <span
                    className={`text-[10px] font-medium leading-none ${
                      isSelected ? 'text-brand-100' : 'text-slate-400'
                    }`}
                  >
                    {t.subtitle}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* ==================== DISPLAY TOGGLES ==================== */}
        <div className="no-print flex flex-wrap items-center justify-between gap-2 px-3 py-2 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-200 dark:border-slate-800 text-xs">
          <span className="font-bold text-slate-600 dark:text-slate-400 flex items-center space-x-1">
            <Sliders className="w-3.5 h-3.5 text-slate-400" />
            <span>Print Options:</span>
          </span>

          <div className="flex flex-wrap items-center gap-3">
            

            <label className="flex items-center space-x-1.5 cursor-pointer text-slate-700 dark:text-slate-300">
              <input
                type="checkbox"
                checked={showQrCode}
                onChange={(e) => setShowQrCode(e.target.checked)}
                className="rounded text-brand-500 focus:ring-brand-500 w-3.5 h-3.5"
              />
              <span>QR Code</span>
            </label>

            <label className="flex items-center space-x-1.5 cursor-pointer text-slate-700 dark:text-slate-300">
              <input
                type="checkbox"
                checked={showTaxDetails}
                onChange={(e) => setShowTaxDetails(e.target.checked)}
                className="rounded text-brand-500 focus:ring-brand-500 w-3.5 h-3.5"
              />
              <span>STRN / NTN</span>
            </label>

            {activeTemplate === 'FINE_DINING' && (
              <label className="flex items-center space-x-1.5 cursor-pointer text-slate-700 dark:text-slate-300">
                <input
                  type="checkbox"
                  checked={showTipGuide}
                  onChange={(e) => setShowTipGuide(e.target.checked)}
                  className="rounded text-brand-500 focus:ring-brand-500 w-3.5 h-3.5"
                />
                <span>Tip Guide</span>
              </label>
            )}
          </div>
        </div>

        {/* ==================== PRINTABLE BILL TEMPLATE RENDERER ==================== */}
        <div className="max-h-[62vh] overflow-y-auto p-3 bg-slate-200 dark:bg-slate-950/70 rounded-2xl flex justify-center shadow-inner">
          {/* =========================================================================
              TEMPLATE 1: STANDARD 80MM POS THERMAL RECEIPT
             ========================================================================= */}
          {activeTemplate === 'STANDARD_80MM' && (
            <div
              id="printable-area"
              className="printable-receipt bg-white text-slate-900 p-5 rounded-xl shadow-lg font-mono text-xs w-full"
              style={{ maxWidth: '340px' }}
            >
              {/* Header */}
              <div className="text-center border-b border-dashed border-slate-400 pb-3 mb-3">
                <h2 className="text-base font-extrabold uppercase tracking-wider text-slate-900">
                  {receiptData.restaurantName}
                </h2>
                <p className="text-[11px] font-semibold text-slate-700 mt-0.5">{receiptData.branchName}</p>
                <p className="text-[10px] text-slate-500 leading-tight">{receiptData.branchAddress}</p>
                <p className="text-[10px] text-slate-500">Tel: {receiptData.branchPhone}</p>
                {showTaxDetails && receiptData.taxRegistrationNumber && (
                  <p className="text-[10px] text-slate-700 font-bold mt-1">
                    STRN/NTN: {receiptData.taxRegistrationNumber}
                  </p>
                )}
                {receiptData.receiptSettings?.headerText && (
                  <p className="text-[11px] text-slate-700 italic mt-1 font-sans">
                    {receiptData.receiptSettings.headerText}
                  </p>
                )}
                
              </div>

              {/* Order Meta */}
              <div className="text-[11px] space-y-1 border-b border-dashed border-slate-400 pb-2.5 mb-2.5">
                <div className="flex justify-between">
                  <span className="font-bold">Order #:</span>
                  <span className="font-extrabold">{receiptData.orderNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span>Date:</span>
                  <span>{new Date(receiptData.date).toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span>Type:</span>
                  <span className="font-bold uppercase bg-slate-100 px-1.5 py-0.2 rounded">
                    {receiptData.orderType}
                  </span>
                </div>
                {receiptData.tableNumber && (
                  <div className="flex justify-between">
                    <span className="font-bold">Dining Table:</span>
                    <span className="font-extrabold text-brand-600">Table {receiptData.tableNumber}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span>Cashier / Server:</span>
                  <span>{receiptData.serverName || receiptData.cashierName}</span>
                </div>
                {showCustomer && receiptData.customerName && (
                  <div className="flex justify-between pt-1 border-t border-dotted border-slate-200">
                    <span>Customer:</span>
                    <span className="font-semibold">{receiptData.customerName} {receiptData.customerPhone ? `(${receiptData.customerPhone})` : ''}</span>
                  </div>
                )}
                {receiptData.deliveryAddress && (
                  <div className="text-[10px] text-slate-600 pt-0.5">
                    <strong>Address:</strong> {receiptData.deliveryAddress}
                  </div>
                )}
                {receiptData.riderName && (
                  <div className="flex justify-between pt-0.5 text-[10px] text-slate-600">
                    <span>Rider:</span>
                    <span className="font-semibold">{receiptData.riderName} {receiptData.riderPhone ? `(${receiptData.riderPhone})` : ''}</span>
                  </div>
                )}
              </div>

              {/* Items Table */}
              <div className="border-b border-dashed border-slate-400 pb-2 mb-2">
                <div className="flex justify-between font-extrabold text-[11px] pb-1 border-b border-slate-300">
                  <span className="w-1/2">Item Description</span>
                  <span className="w-1/6 text-center">Qty</span>
                  <span className="w-1/3 text-right">Price</span>
                </div>
                <div className="divide-y divide-dotted divide-slate-200">
                  {receiptData.items?.map((item: any, idx: number) => {
                    let mods: any[] = [];
                    try {
                      mods = Array.isArray(item.modifiers) ? item.modifiers : JSON.parse(item.modifiers || '[]');
                    } catch (e) {
                      mods = [];
                    }

                    return (
                      <div key={idx} className="py-1.5 text-[11px]">
                        <div className="flex justify-between items-start">
                          <div className="w-1/2 pr-1">
                            <span className="font-bold text-slate-900">{item.productName}</span>
                            {item.variantName && (
                              <span className="text-[10px] text-slate-500 italic block">
                                Portion: {item.variantName}
                              </span>
                            )}
                          </div>
                          <span className="w-1/6 text-center font-bold">{item.quantity}</span>
                          <span className="w-1/3 text-right font-extrabold">
                            {currency} {Number(item.totalPrice).toLocaleString()}
                          </span>
                        </div>

                        {/* Modifiers / Addons */}
                        {mods.length > 0 && (
                          <div className="pl-2 mt-0.5 space-y-0.5">
                            {mods.map((m: any, mIdx: number) => (
                              <div key={mIdx} className="text-[10px] text-slate-600 flex justify-between">
                                <span>+ {m.name}</span>
                                {Number(m.unitPrice) > 0 && <span>+{currency} {Number(m.unitPrice)}</span>}
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Cooking Instruction */}
                        {item.notes && (
                          <div className="text-[10px] text-amber-700 italic pl-2 mt-0.5">
                            * {item.notes}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Totals Breakdown */}
              <div className="text-[11px] space-y-1 border-b border-dashed border-slate-400 pb-2 mb-2">
                <div className="flex justify-between">
                  <span>Subtotal:</span>
                  <span className="font-semibold">{currency} {Number(receiptData.subtotal).toLocaleString()}</span>
                </div>
                {receiptData.discount > 0 && (
                  <div className="flex justify-between text-rose-600 font-semibold">
                    <span>Discount Applied:</span>
                    <span>-{currency} {Number(receiptData.discount).toLocaleString()}</span>
                  </div>
                )}
                {receiptData.taxAmount > 0 && (
                  <div className="flex justify-between text-slate-700">
                    <span>Sales Tax ({receiptData.taxPercent}%):</span>
                    <span>{currency} {Number(receiptData.taxAmount).toLocaleString()}</span>
                  </div>
                )}
                {receiptData.serviceChargeAmount > 0 && (
                  <div className="flex justify-between text-slate-700">
                    <span>Service Charge:</span>
                    <span>{currency} {Number(receiptData.serviceChargeAmount).toLocaleString()}</span>
                  </div>
                )}
                {receiptData.deliveryFee > 0 && (
                  <div className="flex justify-between text-slate-700">
                    <span>Delivery Charge:</span>
                    <span>{currency} {Number(receiptData.deliveryFee).toLocaleString()}</span>
                  </div>
                )}

                {/* Grand Total Box */}
                <div className="flex justify-between text-sm font-black text-slate-900 border-t-2 border-slate-900 pt-1.5 mt-1.5">
                  <span>NET TOTAL:</span>
                  <span className="text-base">{currency} {Number(receiptData.grandTotal).toLocaleString()}</span>
                </div>
              </div>

              {/* Payments & Change */}
              <div className="text-[11px] space-y-1 border-b border-dashed border-slate-400 pb-2 mb-2">
                {receiptData.payments?.map((p: any, idx: number) => (
                  <div key={idx} className="flex justify-between text-slate-700">
                    <span>Paid via {p.method}:</span>
                    <span className="font-bold">{currency} {Number(p.amount).toLocaleString()}</span>
                  </div>
                ))}
                {receiptData.changeGiven > 0 && (
                  <div className="flex justify-between font-extrabold text-emerald-800">
                    <span>Change Returned:</span>
                    <span>{currency} {Number(receiptData.changeGiven).toLocaleString()}</span>
                  </div>
                )}
              </div>

              {/* QR & Barcode Verification */}
              {showQrCode && (
                <div className="text-center py-2 border-b border-dashed border-slate-300">
                  {renderQrCodeSvg(receiptData.orderNumber)}
                  <p className="text-[9px] text-slate-400 mt-1">Scan for Digital E-Receipt & Feedback</p>
                </div>
              )}

              {/* Footer */}
              <div className="text-center pt-2.5 text-[10px] text-slate-600">
                <p className="font-bold">{receiptData.receiptSettings?.footerText || 'Thank you for your visit!'}</p>
                
                <p className="mt-1.5 text-[8px] text-slate-400 uppercase tracking-widest">
                  Software Powered by POS SaaS
                </p>
              </div>
            </div>
          )}

          {/* =========================================================================
              TEMPLATE 2: FINE DINING GUEST CHECK / TABLE SLIP
             ========================================================================= */}
          {activeTemplate === 'FINE_DINING' && (
            <div
              id="printable-area"
              className="printable-receipt bg-[#fdfbf7] text-slate-900 p-6 rounded-xl shadow-lg border-2 border-slate-800 font-serif text-xs w-full"
              style={{ maxWidth: '360px' }}
            >
              {/* Crest / Header */}
              <div className="text-center border-b-2 border-double border-slate-800 pb-3 mb-3">
                <div className="w-10 h-10 rounded-full border border-slate-800 mx-auto flex items-center justify-center font-bold text-sm mb-1.5 bg-slate-900 text-white">
                  🍽️
                </div>
                <h2 className="text-base font-black tracking-widest uppercase text-slate-900">
                  {receiptData.restaurantName}
                </h2>
                <p className="text-[11px] font-sans font-semibold text-slate-700 tracking-wider">
                  {receiptData.branchName}
                </p>
                <p className="text-[10px] font-sans text-slate-500">{receiptData.branchAddress}</p>
                <div className="mt-2 py-0.5 px-3 bg-slate-900 text-white rounded font-sans text-[10px] font-black uppercase tracking-widest inline-block">
                  GUEST CHECK & SUMMARY
                </div>
              </div>

              {/* Table & Server Badge */}
              <div className="grid grid-cols-2 gap-2 p-2 bg-slate-100 rounded-lg border border-slate-300 font-sans text-[11px] mb-3">
                <div>
                  <span className="text-slate-500 block text-[9px] uppercase font-bold">Dining Table</span>
                  <span className="font-black text-sm text-slate-900">
                    {receiptData.tableNumber ? `Table ${receiptData.tableNumber}` : 'Walk-In'}
                  </span>
                  {receiptData.floorName && (
                    <span className="text-[10px] text-slate-500 block">Floor: {receiptData.floorName}</span>
                  )}
                </div>
                <div className="text-right">
                  <span className="text-slate-500 block text-[9px] uppercase font-bold">Server</span>
                  <span className="font-bold text-slate-800">{receiptData.serverName || receiptData.cashierName}</span>
                  <span className="text-[10px] text-slate-500 block">
                    Covers: {receiptData.coverCount || 2} Guests
                  </span>
                </div>
              </div>

              {/* Order Meta Info */}
              <div className="flex justify-between text-[10px] font-sans text-slate-600 border-b border-slate-300 pb-1.5 mb-2.5">
                <span>Check #: <strong>{receiptData.orderNumber}</strong></span>
                <span>Time: {new Date(receiptData.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
              </div>

              {/* Itemized Table */}
              <div className="border-b-2 border-double border-slate-800 pb-2 mb-3">
                <div className="flex justify-between font-sans font-bold text-[10px] uppercase text-slate-600 pb-1 border-b border-slate-300">
                  <span className="w-3/5">Course / Selection</span>
                  <span className="w-1/5 text-center">Qty</span>
                  <span className="w-1/5 text-right">Amount</span>
                </div>

                <div className="divide-y divide-slate-200">
                  {receiptData.items?.map((item: any, idx: number) => {
                    let mods: any[] = [];
                    try {
                      mods = Array.isArray(item.modifiers) ? item.modifiers : JSON.parse(item.modifiers || '[]');
                    } catch (e) {
                      mods = [];
                    }

                    return (
                      <div key={idx} className="py-1.5">
                        <div className="flex justify-between items-start">
                          <div className="w-3/5 pr-1">
                            <span className="font-bold text-slate-900 text-xs">{item.productName}</span>
                            {item.variantName && (
                              <span className="text-[10px] text-slate-500 italic block font-sans">
                                ({item.variantName})
                              </span>
                            )}
                          </div>
                          <span className="w-1/5 text-center font-sans font-bold">{item.quantity}</span>
                          <span className="w-1/5 text-right font-sans font-extrabold">
                            {currency} {Number(item.totalPrice).toLocaleString()}
                          </span>
                        </div>

                        {/* Modifiers */}
                        {mods.length > 0 && (
                          <div className="pl-2 mt-0.5 text-[10px] font-sans text-slate-600">
                            {mods.map((m: any, mIdx: number) => (
                              <div key={mIdx} className="flex justify-between">
                                <span>+ {m.name}</span>
                                {Number(m.unitPrice) > 0 && <span>+{currency} {Number(m.unitPrice)}</span>}
                              </div>
                            ))}
                          </div>
                        )}

                        {item.notes && (
                          <div className="text-[9px] font-sans text-amber-800 italic pl-2">
                            * {item.notes}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Financial Summary */}
              <div className="space-y-1 font-sans text-[11px] border-b border-slate-300 pb-2.5 mb-2.5">
                <div className="flex justify-between text-slate-700">
                  <span>Food & Beverage Subtotal:</span>
                  <span>{currency} {Number(receiptData.subtotal).toLocaleString()}</span>
                </div>
                {receiptData.discount > 0 && (
                  <div className="flex justify-between text-rose-600 font-semibold">
                    <span>Discount:</span>
                    <span>-{currency} {Number(receiptData.discount).toLocaleString()}</span>
                  </div>
                )}
                {receiptData.taxAmount > 0 && (
                  <div className="flex justify-between text-slate-700">
                    <span>Government Tax ({receiptData.taxPercent}%):</span>
                    <span>{currency} {Number(receiptData.taxAmount).toLocaleString()}</span>
                  </div>
                )}
                {receiptData.serviceChargeAmount > 0 && (
                  <div className="flex justify-between text-slate-700">
                    <span>Service Charge:</span>
                    <span>{currency} {Number(receiptData.serviceChargeAmount).toLocaleString()}</span>
                  </div>
                )}
                <div className="flex justify-between font-black text-sm text-slate-950 border-t border-slate-800 pt-1.5 mt-1.5">
                  <span>TOTAL DUE:</span>
                  <span className="text-base">{currency} {Number(receiptData.grandTotal).toLocaleString()}</span>
                </div>
              </div>

              {/* Tip / Gratuity Guide */}
              {showTipGuide && (
                <div className="p-2.5 bg-slate-100 rounded-lg border border-slate-300 font-sans text-[10px] mb-3 space-y-1.5">
                  <span className="font-extrabold uppercase text-slate-700 block">
                    Suggested Gratuity Guide:
                  </span>
                  <div className="grid grid-cols-3 gap-1 text-center">
                    <div className="bg-white p-1 rounded border border-slate-200">
                      <span className="block font-bold">10%</span>
                      <span className="text-slate-600">
                        {currency} {Math.round(receiptData.subtotal * 0.1)}
                      </span>
                    </div>
                    <div className="bg-white p-1 rounded border border-slate-200">
                      <span className="block font-bold">15%</span>
                      <span className="text-slate-600">
                        {currency} {Math.round(receiptData.subtotal * 0.15)}
                      </span>
                    </div>
                    <div className="bg-white p-1 rounded border border-slate-200">
                      <span className="block font-bold">20%</span>
                      <span className="text-slate-600">
                        {currency} {Math.round(receiptData.subtotal * 0.2)}
                      </span>
                    </div>
                  </div>
                  <div className="pt-2 flex justify-between items-center text-[10px]">
                    <span>Custom Gratuity: ________________</span>
                  </div>
                </div>
              )}

              {/* Signature Line */}
              <div className="font-sans pt-2 mb-3 text-[10px] text-slate-600 space-y-2">
                <div className="flex justify-between border-b border-slate-300 pb-1">
                  <span>Room / Member ID: ______________</span>
                </div>
                <div className="flex justify-between border-b border-slate-300 pb-1">
                  <span>Guest Signature: __________________</span>
                </div>
              </div>

              {/* Closing Message */}
              <div className="text-center font-serif text-[11px] text-slate-700 italic border-t border-slate-300 pt-2">
                <p>"{receiptData.receiptSettings?.footerText || 'It was a genuine honor to serve you today.'}"</p>
                
              </div>
            </div>
          )}

          {/* =========================================================================
              TEMPLATE 3: COMPACT 58MM MOBILE / KIOSK SLIP
             ========================================================================= */}
          {activeTemplate === 'COMPACT_58MM' && (
            <div
              id="printable-area"
              className="printable-receipt bg-white text-slate-900 p-3 rounded-lg shadow-md font-mono text-[10px] leading-tight w-full"
              style={{ maxWidth: '230px' }}
            >
              {/* Ultra compact header */}
              <div className="text-center border-b border-dashed border-slate-400 pb-1.5 mb-1.5">
                <h3 className="font-black text-xs uppercase truncate">{receiptData.restaurantName}</h3>
                <p className="text-[9px] text-slate-600 truncate">{receiptData.branchName}</p>
                <p className="text-[8px] text-slate-500">Tel: {receiptData.branchPhone}</p>
              </div>

              {/* Meta */}
              <div className="text-[9px] space-y-0.5 border-b border-dashed border-slate-400 pb-1 mb-1">
                <div className="flex justify-between">
                  <span>ORD:</span>
                  <span className="font-extrabold">{receiptData.orderNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span>{new Date(receiptData.date).toLocaleDateString()}</span>
                  <span>{new Date(receiptData.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
                <div className="flex justify-between font-bold">
                  <span>{receiptData.orderType}</span>
                  {receiptData.tableNumber && <span>TBL: {receiptData.tableNumber}</span>}
                </div>
              </div>

              {/* Items */}
              <div className="border-b border-dashed border-slate-400 pb-1 mb-1 space-y-1">
                {receiptData.items?.map((item: any, idx: number) => {
                  let mods: any[] = [];
                  try {
                    mods = Array.isArray(item.modifiers) ? item.modifiers : JSON.parse(item.modifiers || '[]');
                  } catch (e) {
                    mods = [];
                  }

                  return (
                    <div key={idx}>
                      <div className="flex justify-between items-start">
                        <span className="font-bold flex-1 truncate pr-1">
                          {item.quantity}x {item.productName}
                        </span>
                        <span className="font-black">
                          {currency} {Number(item.totalPrice).toLocaleString()}
                        </span>
                      </div>
                      {mods.length > 0 && (
                        <p className="text-[8px] text-slate-500 pl-2">
                          +{mods.map((m: any) => m.name).join(', ')}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Compact Totals */}
              <div className="space-y-0.5 text-[10px] border-b border-dashed border-slate-400 pb-1 mb-1">
                <div className="flex justify-between">
                  <span>SUB:</span>
                  <span>{currency} {Number(receiptData.subtotal).toLocaleString()}</span>
                </div>
                {receiptData.taxAmount > 0 && (
                  <div className="flex justify-between text-slate-600">
                    <span>TAX:</span>
                    <span>{currency} {Number(receiptData.taxAmount).toLocaleString()}</span>
                  </div>
                )}
                {receiptData.discount > 0 && (
                  <div className="flex justify-between text-rose-600">
                    <span>DISC:</span>
                    <span>-{currency} {Number(receiptData.discount).toLocaleString()}</span>
                  </div>
                )}
                <div className="flex justify-between font-black text-xs pt-1 border-t border-slate-800">
                  <span>TOTAL:</span>
                  <span>{currency} {Number(receiptData.grandTotal).toLocaleString()}</span>
                </div>
              </div>

              {/* Barcode representation */}
              {renderBarcodeSvg(receiptData.orderNumber)}

              <p className="text-center text-[8px] text-slate-500 mt-1">Thank you! Visit again.</p>
            </div>
          )}

          {/* =========================================================================
              TEMPLATE 4: OFFICIAL GST / COMMERCIAL TAX INVOICE (A4 FULL PAGE)
             ========================================================================= */}
          {activeTemplate === 'TAX_INVOICE_A4' && (
            <div
              id="printable-area"
              className="printable-receipt bg-white text-slate-900 p-8 rounded-xl shadow-lg border border-slate-300 font-sans text-xs w-full"
              style={{ maxWidth: '750px' }}
            >
              {/* Invoice Top Header */}
              <div className="flex justify-between items-start border-b-2 border-slate-900 pb-4 mb-4">
                <div>
                  <div className="flex items-center space-x-2">
                    <div className="w-8 h-8 rounded-lg bg-brand-600 text-white flex items-center justify-center font-black text-base">
                      POS
                    </div>
                    <div>
                      <h1 className="text-xl font-black text-slate-950 uppercase tracking-tight">
                        {receiptData.restaurantName}
                      </h1>
                      <p className="text-xs font-semibold text-slate-600">{receiptData.branchName}</p>
                    </div>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-2 max-w-sm leading-relaxed">
                    {receiptData.branchAddress} • Tel: {receiptData.branchPhone}
                  </p>
                  {receiptData.taxRegistrationNumber && (
                    <div className="mt-1.5 inline-flex items-center space-x-1.5 px-2.5 py-0.5 bg-slate-100 rounded text-[11px] font-bold text-slate-800 border border-slate-200">
                      <span>GST / STRN / NTN:</span>
                      <span className="font-mono">{receiptData.taxRegistrationNumber}</span>
                    </div>
                  )}
                </div>

                <div className="text-right">
                  <h2 className="text-lg font-black text-brand-600 uppercase tracking-wider">
                    TAX INVOICE / BILL
                  </h2>
                  <div className="mt-1 space-y-0.5 text-xs">
                    <p><strong className="text-slate-600">Invoice #:</strong> <span className="font-mono font-bold text-slate-900">{receiptData.orderNumber}</span></p>
                    <p><strong className="text-slate-600">Date:</strong> {new Date(receiptData.date).toLocaleDateString()}</p>
                    <p><strong className="text-slate-600">Time:</strong> {new Date(receiptData.date).toLocaleTimeString()}</p>
                    <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-emerald-100 text-emerald-800 border border-emerald-300 mt-1">
                      PAID INVOICE
                    </span>
                  </div>
                </div>
              </div>

              {/* Bill To & Order Scope Split */}
              <div className="grid grid-cols-2 gap-4 p-3 bg-slate-50 rounded-xl border border-slate-200 mb-4 text-xs">
                <div>
                  <h4 className="font-bold text-[10px] text-slate-400 uppercase tracking-wider mb-1">
                    Billed To / Customer Details:
                  </h4>
                  <p className="font-bold text-slate-900 text-sm">
                    {receiptData.customerName || 'Counter Guest / Walk-In'}
                  </p>
                  {receiptData.customerPhone && (
                    <p className="text-slate-600 text-[11px] mt-0.5">Phone: {receiptData.customerPhone}</p>
                  )}
                  {receiptData.deliveryAddress && (
                    <p className="text-slate-600 text-[11px] mt-0.5">Address: {receiptData.deliveryAddress}</p>
                  )}
                  {receiptData.riderName && (
                    <p className="text-slate-600 text-[11px] mt-0.5 font-medium">Rider: {receiptData.riderName} {receiptData.riderPhone ? `(${receiptData.riderPhone})` : ''}</p>
                  )}
                </div>

                <div className="text-right sm:text-left sm:pl-6 sm:border-l sm:border-slate-200">
                  <h4 className="font-bold text-[10px] text-slate-400 uppercase tracking-wider mb-1">
                    Order Reference & Dining Scope:
                  </h4>
                  <p className="text-slate-800">Order Mode: <strong className="uppercase">{receiptData.orderType}</strong></p>
                  {receiptData.tableNumber && (
                    <p className="text-slate-800">Table: <strong>Table {receiptData.tableNumber} {receiptData.floorName ? `(${receiptData.floorName})` : ''}</strong></p>
                  )}
                  <p className="text-slate-800">Cashier: <strong>{receiptData.cashierName}</strong></p>
                </div>
              </div>

              {/* Formal Items Table */}
              <table className="w-full text-left border-collapse mb-4">
                <thead>
                  <tr className="border-b-2 border-slate-900 bg-slate-100 text-[11px] font-black text-slate-800 uppercase">
                    <th className="py-2 px-2 w-10 text-center">#</th>
                    <th className="py-2 px-2">Item Description & Customizations</th>
                    <th className="py-2 px-2 text-center w-16">Qty</th>
                    <th className="py-2 px-2 text-right w-24">Rate</th>
                    <th className="py-2 px-2 text-right w-28">Total Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-xs">
                  {receiptData.items?.map((item: any, idx: number) => {
                    let mods: any[] = [];
                    try {
                      mods = Array.isArray(item.modifiers) ? item.modifiers : JSON.parse(item.modifiers || '[]');
                    } catch (e) {
                      mods = [];
                    }

                    return (
                      <tr key={idx} className="hover:bg-slate-50/50">
                        <td className="py-2 px-2 text-center text-slate-400 font-mono text-[11px]">{idx + 1}</td>
                        <td className="py-2 px-2">
                          <span className="font-bold text-slate-900">{item.productName}</span>
                          {item.variantName && (
                            <span className="text-[10px] text-slate-500 italic block">Size: {item.variantName}</span>
                          )}
                          {mods.length > 0 && (
                            <div className="text-[10px] text-purple-700 mt-0.5">
                              Addons: {mods.map((m: any) => `${m.name} (+Rs. ${m.unitPrice})`).join(', ')}
                            </div>
                          )}
                          {item.notes && (
                            <div className="text-[10px] text-amber-700 italic mt-0.5">Note: {item.notes}</div>
                          )}
                        </td>
                        <td className="py-2 px-2 text-center font-bold">{item.quantity}</td>
                        <td className="py-2 px-2 text-right font-mono text-slate-600">
                          {currency} {Number(item.unitPrice).toLocaleString()}
                        </td>
                        <td className="py-2 px-2 text-right font-mono font-bold text-slate-900">
                          {currency} {Number(item.totalPrice).toLocaleString()}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {/* Bottom Summary Grid */}
              <div className="grid grid-cols-2 gap-6 pt-2 border-t border-slate-200 mb-6">
                {/* Left: Payment details & Legal */}
                <div className="text-xs space-y-2 text-slate-600">
                  <h4 className="font-bold text-[10px] text-slate-400 uppercase tracking-wider">Payment Breakdown:</h4>
                  <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200 space-y-1">
                    {receiptData.payments?.map((p: any, idx: number) => (
                      <div key={idx} className="flex justify-between">
                        <span>Payment Method ({p.method}):</span>
                        <strong className="text-slate-800">{currency} {Number(p.amount).toLocaleString()}</strong>
                      </div>
                    ))}
                    {receiptData.changeGiven > 0 && (
                      <div className="flex justify-between text-emerald-700 font-bold border-t border-slate-200 pt-1">
                        <span>Change Returned:</span>
                        <span>{currency} {Number(receiptData.changeGiven).toLocaleString()}</span>
                      </div>
                    )}
                  </div>

                  <p className="text-[10px] text-slate-400 leading-relaxed pt-2">
                    * This is a computer-generated tax invoice verified under provincial revenue authority compliance.
                  </p>
                </div>

                {/* Right: Totals Box */}
                <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-1.5 text-xs">
                  <div className="flex justify-between text-slate-600">
                    <span>Subtotal:</span>
                    <span className="font-mono font-semibold">{currency} {Number(receiptData.subtotal).toLocaleString()}</span>
                  </div>
                  {receiptData.discount > 0 && (
                    <div className="flex justify-between text-rose-600">
                      <span>Total Discounts:</span>
                      <span className="font-mono font-semibold">-{currency} {Number(receiptData.discount).toLocaleString()}</span>
                    </div>
                  )}
                  {receiptData.taxAmount > 0 && (
                    <div className="flex justify-between text-slate-700">
                      <span>Sales Tax / GST ({receiptData.taxPercent}%):</span>
                      <span className="font-mono font-semibold">{currency} {Number(receiptData.taxAmount).toLocaleString()}</span>
                    </div>
                  )}
                  {receiptData.serviceChargeAmount > 0 && (
                    <div className="flex justify-between text-slate-700">
                      <span>Service Charge:</span>
                      <span className="font-mono font-semibold">{currency} {Number(receiptData.serviceChargeAmount).toLocaleString()}</span>
                    </div>
                  )}
                  {receiptData.deliveryFee > 0 && (
                    <div className="flex justify-between text-slate-700">
                      <span>Delivery Fee:</span>
                      <span className="font-mono font-semibold">{currency} {Number(receiptData.deliveryFee).toLocaleString()}</span>
                    </div>
                  )}

                  <div className="flex justify-between text-base font-black text-slate-900 border-t-2 border-slate-900 pt-2 mt-2">
                    <span>FINAL INVOICE TOTAL:</span>
                    <span className="text-lg text-brand-600">{currency} {Number(receiptData.grandTotal).toLocaleString()}</span>
                  </div>
                </div>
              </div>

              {/* Signatures & Footer */}
              <div className="grid grid-cols-2 gap-6 pt-6 border-t border-dashed border-slate-300 text-xs">
                <div className="text-center pt-8 border-t border-slate-400">
                  <span className="font-semibold text-slate-500">Customer Confirmation</span>
                </div>
                <div className="text-center pt-8 border-t border-slate-400">
                  <span className="font-bold text-slate-800">Authorized Signatory & Official Stamp</span>
                </div>
              </div>
            </div>
          )}

          {/* =========================================================================
              TEMPLATE 5: KITCHEN ORDER / CUSTOMER PICKUP TOKEN
             ========================================================================= */}
          {activeTemplate === 'KITCHEN_TOKEN' && (
            <div
              id="printable-area"
              className="printable-receipt bg-white text-slate-900 p-5 rounded-xl shadow-lg border-2 border-slate-900 font-mono text-xs w-full"
              style={{ maxWidth: '340px' }}
            >
              {/* Giant Token Header */}
              <div className="text-center border-b-2 border-slate-900 pb-3 mb-3 bg-slate-900 text-white p-3 rounded-lg">
                <span className="text-xs uppercase tracking-widest text-slate-300 font-bold block">
                  ORDER TOKEN & DISPATCH SLIP
                </span>
                <h1 className="text-3xl font-black tracking-tight my-1 text-amber-300">
                  {receiptData.orderNumber.replace(/^[^-]+-/, '')}
                </h1>
                <span className="text-[11px] font-extrabold uppercase bg-amber-400 text-slate-950 px-2.5 py-0.5 rounded-full inline-block mt-0.5">
                  {receiptData.orderType} {receiptData.tableNumber ? `• TABLE ${receiptData.tableNumber}` : ''}
                </span>
              </div>

              {/* Time & Server */}
              <div className="flex justify-between text-[11px] font-bold border-b border-dashed border-slate-400 pb-2 mb-2 text-slate-700">
                <span>Order: #{receiptData.orderNumber}</span>
                <span>Time: {new Date(receiptData.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
              </div>

              {/* Item Checklist for Kitchen / Dispatch */}
              <div className="space-y-2 border-b-2 border-slate-900 pb-3 mb-3">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">
                  Items to Prepare / Pack:
                </span>

                {receiptData.items?.map((item: any, idx: number) => {
                  let mods: any[] = [];
                  try {
                    mods = Array.isArray(item.modifiers) ? item.modifiers : JSON.parse(item.modifiers || '[]');
                  } catch (e) {
                    mods = [];
                  }

                  return (
                    <div key={idx} className="p-2 bg-slate-50 border border-slate-300 rounded-lg">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center space-x-2">
                          <span className="w-5 h-5 rounded border-2 border-slate-700 flex items-center justify-center font-bold text-xs" />
                          <span className="font-black text-sm text-slate-950">
                            {item.quantity}x {item.productName}
                          </span>
                        </div>
                        {item.variantName && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-200 font-bold">
                            {item.variantName}
                          </span>
                        )}
                      </div>

                      {/* Addons */}
                      {mods.length > 0 && (
                        <div className="pl-7 mt-1 space-y-0.5">
                          {mods.map((m: any, mIdx: number) => (
                            <span key={mIdx} className="inline-block text-[10px] font-extrabold text-purple-800 bg-purple-100 border border-purple-200 px-1.5 py-0.2 rounded mr-1">
                              ⚡ {m.name}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Cooking Instruction */}
                      {item.notes && (
                        <div className="pl-7 mt-1 text-[10px] font-extrabold text-amber-900 bg-amber-100 border border-amber-300 p-1 rounded">
                          🔥 Note: {item.notes}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {receiptData.orderNotes && (
                <div className="p-2 bg-amber-50 border border-amber-300 rounded-lg text-amber-900 font-bold text-[11px] mb-3">
                  ⚠️ General Order Note: {receiptData.orderNotes}
                </div>
              )}

              {/* Counter Tear-off */}
              <div className="text-center pt-2 border-t border-dashed border-slate-400">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">
                  *** CUSTOMER PICKUP COPY ***
                </span>
                <p className="text-[9px] text-slate-400 mt-0.5">Please retain this token until food is served</p>
              </div>
            </div>
          )}
        </div>

        {/* ==================== ACTION BUTTONS ==================== */}
        <div className="no-print flex items-center justify-between pt-3 border-t border-slate-200 dark:border-slate-800">
          <button
            onClick={handleCopyText}
            className="flex items-center space-x-1.5 px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4 text-slate-400" />}
            <span>{copied ? 'Copied to Clipboard!' : 'Copy Bill Text (WhatsApp)'}</span>
          </button>

          <div className="flex items-center space-x-2.5">
            <button
              onClick={onClose}
              className="px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              Close
            </button>
            <button
              onClick={handlePrint}
              className="flex items-center space-x-2 px-5 py-2.5 bg-brand-500 hover:bg-brand-600 text-white rounded-xl text-xs font-black shadow-lg transition-transform active:scale-95"
            >
              <Printer className="w-4 h-4" />
              <span>Print Bill ({activeTemplate.replace('_', ' ')})</span>
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
};
