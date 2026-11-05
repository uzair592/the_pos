import React, { useState } from 'react';
import { Modal } from './Modal.js';
import {
  Printer,
  Copy,
  Check,
  Receipt,
  ExternalLink,
} from 'lucide-react';
import { ReceiptTemplateType } from '@pos/shared';

export interface ReceiptThemeConfig {
  id: ReceiptTemplateType;
  name: string;
  subtitle: string;
  hardware: string;
  icon: string;
  badge: string;
  description: string;
}

export const RECEIPT_THEMES: ReceiptThemeConfig[] = [
  {
    id: 'STANDARD_80MM',
    name: 'Standard 80mm POS Thermal',
    subtitle: 'POS Thermal Roll',
    hardware: '80mm (3-inch) Roll',
    icon: '🧾',
    badge: 'Recommended',
    description: 'Crisp, high-contrast thermal receipt for standard 80mm POS printers (Epson, Star, Xprinter). Clean itemized list, bold grand total, and QR code.',
  },
  {
    id: 'FINE_DINING',
    name: 'Fine Dining Guest Check',
    subtitle: 'Dine-In Check Slip',
    hardware: '80mm Roll / Slip',
    icon: '🍽️',
    badge: 'Dine-In',
    description: 'Elegant sit-down dining slip featuring server name, table & covers, gratuity suggestion guide (10%, 15%, 20%), and guest signature line.',
  },
  {
    id: 'COMPACT_58MM',
    name: 'Compact 58mm Mobile Roll',
    subtitle: 'Mobile & Kiosk Slip',
    hardware: '58mm (2-inch) Roll',
    icon: '⚡',
    badge: 'Mobile / Handheld',
    description: 'Condensed layout tailored for 58mm portable Bluetooth printers, handheld terminals, food trucks, and space-constrained kiosk slips.',
  },
  {
    id: 'TAX_INVOICE_A4',
    name: 'Official GST Tax Invoice (A4)',
    subtitle: 'Commercial A4 Invoice',
    hardware: 'Laser / Inkjet A4',
    icon: '📑',
    badge: 'Corporate / GST',
    description: 'Formal commercial full-page tax invoice compliant with revenue authority standards. Full tax breakdown, customer address, and authorized signature area.',
  },
  {
    id: 'KITCHEN_TOKEN',
    name: 'Kitchen Dispatch / Prep Token',
    subtitle: 'KOT / Pickup Token',
    hardware: '80mm Thermal KOT',
    icon: '🎟️',
    badge: 'Kitchen / KOT',
    description: 'High-visibility kitchen order ticket and customer pickup token with oversized order numbers, modifier alerts, and prep item checklists.',
  },
];

export const getTemplateDisplayName = (type: ReceiptTemplateType): string => {
  const match = RECEIPT_THEMES.find((t) => t.id === type);
  return match ? match.name : 'Standard 80mm POS Thermal';
};

// SVG QR Code generator simulation
export const renderQrCodeSvg = (value: string) => (
  <svg className="w-16 h-16 mx-auto" viewBox="0 0 33 33" fill="currentColor">
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
export const renderBarcodeSvg = (value: string) => (
  <div className="flex flex-col items-center justify-center my-1">
    <div className="flex items-center space-x-[2px] h-7">
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

export interface ReceiptPreviewProps {
  template: ReceiptTemplateType;
  receiptData: any;
  showQrCode?: boolean;
  showTaxDetails?: boolean;
  showCustomer?: boolean;
  showTipGuide?: boolean;
  isPrintable?: boolean;
}

/**
 * Reusable visual component that renders a receipt in any of the 5 themes.
 * Used in ReceiptModal (for bill printing) and in RestaurantSettings (for live theme preview).
 */
export const ReceiptPreview: React.FC<ReceiptPreviewProps> = ({
  template,
  receiptData,
  showQrCode = true,
  showTaxDetails = true,
  showCustomer = true,
  showTipGuide = true,
  isPrintable = true,
}) => {
  if (!receiptData) return null;
  const currency = receiptData.currencySymbol || 'Rs.';

  return (
    <div className="w-full flex justify-center">
      {/* =========================================================================
          THEME 1: STANDARD 80MM POS THERMAL RECEIPT
         ========================================================================= */}
      {template === 'STANDARD_80MM' && (
        <div
          id={isPrintable ? 'printable-area' : undefined}
          className={`${
            isPrintable ? 'printable-receipt ' : ''
          }bg-white text-slate-900 p-5 rounded-xl shadow-lg font-mono text-xs w-full border border-slate-200 select-text`}
          style={{ maxWidth: '330px' }}
        >
          {/* Header */}
          <div className="text-center border-b-2 border-dashed border-slate-900 pb-3 mb-2.5">
            <h2 className="text-base font-black uppercase tracking-wider text-slate-950">
              {receiptData.restaurantName}
            </h2>
            <p className="text-[11px] font-bold text-slate-800 mt-0.5">{receiptData.branchName}</p>
            <p className="text-[10px] text-slate-600 leading-tight">{receiptData.branchAddress}</p>
            <p className="text-[10px] text-slate-600 font-medium">Tel: {receiptData.branchPhone}</p>
            {showTaxDetails && receiptData.taxRegistrationNumber && (
              <p className="text-[10px] text-slate-900 font-extrabold mt-1">
                STRN/NTN: {receiptData.taxRegistrationNumber}
              </p>
            )}
            {receiptData.receiptSettings?.headerText && (
              <p className="text-[10px] text-slate-700 italic mt-1 font-sans">
                {receiptData.receiptSettings.headerText}
              </p>
            )}
          </div>

          {/* Order Meta */}
          <div className="text-[11px] space-y-1 border-b border-dashed border-slate-400 pb-2.5 mb-2.5">
            <div className="flex justify-between items-center">
              <span className="font-bold text-slate-700">Order #:</span>
              <span className="font-black text-sm text-slate-950">{receiptData.orderNumber}</span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>Date:</span>
              <span>{new Date(receiptData.date).toLocaleString()}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-700">Type:</span>
              <span className="font-extrabold uppercase bg-slate-100 text-slate-900 px-1.5 py-0.5 rounded text-[10px]">
                {receiptData.orderType}
              </span>
            </div>
            {receiptData.tableNumber && (
              <div className="flex justify-between items-center">
                <span className="font-bold text-slate-700">Table:</span>
                <span className="font-black text-brand-600">Table {receiptData.tableNumber}</span>
              </div>
            )}
            <div className="flex justify-between text-slate-600">
              <span>Staff:</span>
              <span>{receiptData.serverName || receiptData.cashierName}</span>
            </div>
            {showCustomer && receiptData.customerName && (
              <div className="flex justify-between pt-1 border-t border-dotted border-slate-300 text-slate-700">
                <span>Customer:</span>
                <span className="font-bold text-slate-900">
                  {receiptData.customerName} {receiptData.customerPhone ? `(${receiptData.customerPhone})` : ''}
                </span>
              </div>
            )}
            {receiptData.deliveryAddress && (
              <div className="text-[10px] text-slate-700 pt-0.5">
                <strong>Address:</strong> {receiptData.deliveryAddress}
              </div>
            )}
            {receiptData.riderName && (
              <div className="flex justify-between pt-0.5 text-[10px] text-slate-700">
                <span>Rider:</span>
                <span className="font-semibold">{receiptData.riderName} {receiptData.riderPhone ? `(${receiptData.riderPhone})` : ''}</span>
              </div>
            )}
          </div>

          {/* Items Table */}
          <div className="border-b-2 border-dashed border-slate-900 pb-2.5 mb-2.5">
            <div className="flex justify-between font-black text-[10px] uppercase text-slate-800 pb-1 border-b border-slate-300">
              <span className="w-1/2">Item</span>
              <span className="w-1/6 text-center">Qty</span>
              <span className="w-1/3 text-right">Amount</span>
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
                  <div key={idx} className="py-1 text-[11px]">
                    <div className="flex justify-between items-start">
                      <div className="w-1/2 pr-1">
                        <span className="font-bold text-slate-950">{item.productName}</span>
                        {item.variantName && (
                          <span className="text-[10px] text-slate-500 italic block">
                            ({item.variantName})
                          </span>
                        )}
                      </div>
                      <span className="w-1/6 text-center font-bold text-slate-800">{item.quantity}</span>
                      <span className="w-1/3 text-right font-black text-slate-950">
                        {currency} {Number(item.totalPrice).toLocaleString()}
                      </span>
                    </div>

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

                    {item.notes && (
                      <div className="text-[10px] text-amber-800 italic pl-2 mt-0.5">
                        * {item.notes}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Totals Breakdown */}
          <div className="text-[11px] space-y-1 border-b border-dashed border-slate-400 pb-2.5 mb-2.5">
            <div className="flex justify-between text-slate-700">
              <span>Subtotal:</span>
              <span className="font-semibold">{currency} {Number(receiptData.subtotal).toLocaleString()}</span>
            </div>
            {receiptData.discount > 0 && (
              <div className="flex justify-between text-rose-600 font-bold">
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
            <div className="flex justify-between text-sm font-black text-slate-950 border-t-2 border-b-2 border-slate-950 py-1.5 my-1.5">
              <span>NET TOTAL:</span>
              <span className="text-base text-slate-950">{currency} {Number(receiptData.grandTotal).toLocaleString()}</span>
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

          {/* QR Code */}
          {showQrCode && (
            <div className="text-center py-2 border-b border-dashed border-slate-300">
              {renderQrCodeSvg(receiptData.orderNumber)}
              <p className="text-[9px] text-slate-500 mt-1">Scan for Digital E-Receipt & Feedback</p>
            </div>
          )}

          {/* Footer */}
          <div className="text-center pt-2 text-[10px] text-slate-600">
            <p className="font-bold">{receiptData.receiptSettings?.footerText || 'Thank you for your visit!'}</p>
            <p className="mt-1 text-[8px] text-slate-400 uppercase tracking-widest font-sans">
              Powered by POS SaaS
            </p>
          </div>
        </div>
      )}

      {/* =========================================================================
          THEME 2: FINE DINING GUEST CHECK / TABLE SLIP
         ========================================================================= */}
      {template === 'FINE_DINING' && (
        <div
          id={isPrintable ? 'printable-area' : undefined}
          className={`${
            isPrintable ? 'printable-receipt ' : ''
          }bg-[#fefdfb] text-slate-900 p-6 rounded-xl shadow-lg border-2 border-slate-800 font-serif text-xs w-full select-text`}
          style={{ maxWidth: '345px' }}
        >
          {/* Crest / Header */}
          <div className="text-center border-b-2 border-double border-slate-800 pb-3 mb-3">
            <div className="w-9 h-9 rounded-full border border-slate-800 mx-auto flex items-center justify-center font-bold text-sm mb-1.5 bg-slate-900 text-white">
              🍽️
            </div>
            <h2 className="text-base font-black tracking-widest uppercase text-slate-950">
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
              <div className="pt-1 flex justify-between items-center text-[10px]">
                <span>Custom Gratuity: ________________</span>
              </div>
            </div>
          )}

          {/* Signature Line */}
          <div className="font-sans pt-1 mb-3 text-[10px] text-slate-600 space-y-2">
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
          THEME 3: COMPACT 58MM MOBILE / KIOSK SLIP
         ========================================================================= */}
      {template === 'COMPACT_58MM' && (
        <div
          id={isPrintable ? 'printable-area' : undefined}
          className={`${
            isPrintable ? 'printable-receipt ' : ''
          }bg-white text-slate-900 p-3 rounded-lg shadow-md font-mono text-[10px] leading-tight w-full border border-slate-200 select-text`}
          style={{ maxWidth: '230px' }}
        >
          {/* Ultra compact header */}
          <div className="text-center border-b border-dashed border-slate-400 pb-1.5 mb-1.5">
            <h3 className="font-black text-xs uppercase truncate text-slate-950">{receiptData.restaurantName}</h3>
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

          <p className="text-center text-[8px] text-slate-500 mt-1">
            {receiptData.receiptSettings?.footerText || 'Thank you! Visit again.'}
          </p>
        </div>
      )}

      {/* =========================================================================
          THEME 4: OFFICIAL GST / COMMERCIAL TAX INVOICE (A4 FULL PAGE)
         ========================================================================= */}
      {template === 'TAX_INVOICE_A4' && (
        <div
          id={isPrintable ? 'printable-area' : undefined}
          className={`${
            isPrintable ? 'printable-receipt ' : ''
          }bg-white text-slate-900 p-8 rounded-xl shadow-lg border border-slate-300 font-sans text-xs w-full select-text`}
          style={{ maxWidth: '720px' }}
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
                          Addons: {mods.map((m: any) => `${m.name} (+${currency} ${m.unitPrice})`).join(', ')}
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
                * This is a computer-generated tax invoice verified under revenue authority compliance.
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
          THEME 5: KITCHEN ORDER / CUSTOMER PICKUP TOKEN
         ========================================================================= */}
      {template === 'KITCHEN_TOKEN' && (
        <div
          id={isPrintable ? 'printable-area' : undefined}
          className={`${
            isPrintable ? 'printable-receipt ' : ''
          }bg-white text-slate-900 p-5 rounded-xl shadow-lg border-2 border-slate-900 font-mono text-xs w-full select-text`}
          style={{ maxWidth: '330px' }}
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
  );
};

export interface ReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  receiptData: any;
  initialTemplate?: ReceiptTemplateType;
}

export const ReceiptModal: React.FC<ReceiptModalProps> = ({
  isOpen,
  onClose,
  receiptData,
  initialTemplate,
}) => {
  if (!receiptData) return null;

  // Read active template from restaurant receiptSettings, fallback to initialTemplate or localStorage or default
  const activeTemplate: ReceiptTemplateType =
    receiptData.receiptSettings?.defaultTemplate ||
    initialTemplate ||
    (typeof window !== 'undefined'
      ? (localStorage.getItem('pos_default_receipt_template') as ReceiptTemplateType)
      : null) ||
    'STANDARD_80MM';

  const [copied, setCopied] = useState(false);

  // Read toggles directly from receipt settings
  const showQrCode = receiptData.receiptSettings?.showQrCode !== false;
  const showTaxDetails = receiptData.receiptSettings?.showTaxBreakdown !== false;
  const showCustomer = receiptData.receiptSettings?.showCustomerDetails !== false;
  const showTipGuide = receiptData.receiptSettings?.showTipGuide !== false;

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

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Receipt / Bill Preview"
      maxWidth={activeTemplate === 'TAX_INVOICE_A4' ? '2xl' : 'md'}
    >
      <div className="space-y-3">
        {/* Active Theme Indicator Bar - Clean, Non-intrusive */}
        <div className="no-print flex items-center justify-between px-3.5 py-2 bg-slate-100 dark:bg-slate-800/70 rounded-xl text-xs border border-slate-200/80 dark:border-slate-700/60">
          <div className="flex items-center space-x-2">
            <Receipt className="w-3.5 h-3.5 text-brand-500" />
            <span className="text-slate-600 dark:text-slate-300 font-medium">
              Theme: <strong className="text-slate-900 dark:text-white font-bold">{getTemplateDisplayName(activeTemplate)}</strong>
            </span>
          </div>
          <span className="text-[11px] text-slate-400 dark:text-slate-500 hidden sm:inline">
            Manage print theme in Settings
          </span>
        </div>

        {/* Printable Bill Area */}
        <div className="max-h-[64vh] overflow-y-auto p-3.5 bg-slate-200/80 dark:bg-slate-950/80 rounded-2xl flex justify-center shadow-inner">
          <ReceiptPreview
            template={activeTemplate}
            receiptData={receiptData}
            showQrCode={showQrCode}
            showTaxDetails={showTaxDetails}
            showCustomer={showCustomer}
            showTipGuide={showTipGuide}
            isPrintable={true}
          />
        </div>

        {/* Action Buttons: WhatsApp Copy, Close, Print */}
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
              <span>Print Bill</span>
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
};
