import React from 'react';
import { Modal } from './Modal.js';
import { Printer, CheckCircle2 } from 'lucide-react';

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

  const handlePrint = () => {
    window.print();
  };

  const currency = receiptData.currencySymbol || 'Rs.';

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Order Receipt & Invoice" maxWidth="md">
      <div className="space-y-4">
        {/* Printable thermal container */}
        <div
          id="printable-area"
          className="printable-receipt bg-white p-6 border border-slate-200 rounded-xl shadow-inner font-mono text-xs text-slate-800"
          style={{ maxWidth: '340px', margin: '0 auto' }}
        >
          {/* Header */}
          <div className="text-center border-b border-dashed border-slate-300 pb-3 mb-3">
            <h2 className="text-base font-bold uppercase tracking-wider text-slate-900">
              {receiptData.restaurantName}
            </h2>
            <p className="text-[11px] text-slate-600 mt-0.5">{receiptData.branchName}</p>
            <p className="text-[10px] text-slate-500">{receiptData.branchAddress}</p>
            <p className="text-[10px] text-slate-500">Tel: {receiptData.branchPhone}</p>
            {receiptData.taxRegistrationNumber && (
              <p className="text-[10px] text-slate-600 font-semibold mt-1">
                STRN/NTN: {receiptData.taxRegistrationNumber}
              </p>
            )}
            {receiptData.receiptSettings?.headerText && (
              <p className="text-[11px] text-slate-700 italic mt-1">
                {receiptData.receiptSettings.headerText}
              </p>
            )}
            {receiptData.receiptSettings?.customUrduHeader && (
              <p className="font-urdu text-sm text-slate-800 mt-1" dir="rtl">
                {receiptData.receiptSettings.customUrduHeader}
              </p>
            )}
          </div>

          {/* Meta Info */}
          <div className="text-[11px] space-y-1 border-b border-dashed border-slate-300 pb-2 mb-2">
            <div className="flex justify-between">
              <span>Order #:</span>
              <span className="font-bold">{receiptData.orderNumber}</span>
            </div>
            <div className="flex justify-between">
              <span>Date:</span>
              <span>{new Date(receiptData.date).toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span>Type:</span>
              <span className="font-semibold">{receiptData.orderType}</span>
            </div>
            {receiptData.tableNumber && (
              <div className="flex justify-between">
                <span>Table:</span>
                <span className="font-bold">{receiptData.tableNumber}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span>Cashier:</span>
              <span>{receiptData.cashierName}</span>
            </div>
          </div>

          {/* Items Table */}
          <div className="border-b border-dashed border-slate-300 pb-2 mb-2">
            <div className="flex justify-between font-bold text-[11px] pb-1 border-b border-slate-200">
              <span className="w-1/2">Item</span>
              <span className="w-1/6 text-center">Qty</span>
              <span className="w-1/3 text-right">Total</span>
            </div>
            <div className="divide-y divide-slate-100">
              {receiptData.items?.map((item: any, idx: number) => (
                <div key={idx} className="py-1 text-[11px]">
                  <div className="flex justify-between">
                    <span className="w-1/2 font-medium truncate">{item.productName}</span>
                    <span className="w-1/6 text-center">{item.quantity}</span>
                    <span className="w-1/3 text-right">
                      {currency} {Number(item.totalPrice).toLocaleString()}
                    </span>
                  </div>
                  {item.variantName && (
                    <div className="text-[10px] text-slate-500 italic pl-1">
                      Size: {item.variantName}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Financial Breakdown */}
          <div className="text-[11px] space-y-1 border-b border-dashed border-slate-300 pb-2 mb-2">
            <div className="flex justify-between">
              <span>Subtotal:</span>
              <span>
                {currency} {Number(receiptData.subtotal).toLocaleString()}
              </span>
            </div>
            {receiptData.discount > 0 && (
              <div className="flex justify-between text-rose-600">
                <span>Discount:</span>
                <span>
                  -{currency} {Number(receiptData.discount).toLocaleString()}
                </span>
              </div>
            )}
            {receiptData.taxAmount > 0 && (
              <div className="flex justify-between">
                <span>Tax ({receiptData.taxPercent}%):</span>
                <span>
                  {currency} {Number(receiptData.taxAmount).toLocaleString()}
                </span>
              </div>
            )}
            {receiptData.serviceChargeAmount > 0 && (
              <div className="flex justify-between">
                <span>Service Charge:</span>
                <span>
                  {currency} {Number(receiptData.serviceChargeAmount).toLocaleString()}
                </span>
              </div>
            )}
            {receiptData.deliveryFee > 0 && (
              <div className="flex justify-between">
                <span>Delivery Fee:</span>
                <span>
                  {currency} {Number(receiptData.deliveryFee).toLocaleString()}
                </span>
              </div>
            )}
            <div className="flex justify-between text-sm font-bold text-slate-900 border-t border-slate-200 pt-1 mt-1">
              <span>GRAND TOTAL:</span>
              <span>
                {currency} {Number(receiptData.grandTotal).toLocaleString()}
              </span>
            </div>
          </div>

          {/* Payments & Change */}
          <div className="text-[11px] space-y-1 border-b border-dashed border-slate-300 pb-2 mb-2">
            {receiptData.payments?.map((p: any, idx: number) => (
              <div key={idx} className="flex justify-between text-slate-600">
                <span>Paid ({p.method}):</span>
                <span className="font-medium">
                  {currency} {Number(p.amount).toLocaleString()}
                </span>
              </div>
            ))}
            {receiptData.changeGiven > 0 && (
              <div className="flex justify-between font-semibold text-emerald-700">
                <span>Change Returned:</span>
                <span>
                  {currency} {Number(receiptData.changeGiven).toLocaleString()}
                </span>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="text-center pt-2 text-[10px] text-slate-500">
            <p>{receiptData.receiptSettings?.footerText || 'Thank you for your visit!'}</p>
            {receiptData.receiptSettings?.customUrduFooter && (
              <p className="font-urdu text-xs text-slate-700 mt-1" dir="rtl">
                {receiptData.receiptSettings.customUrduFooter}
              </p>
            )}
            <p className="mt-1 text-[9px] text-slate-400">Powered by Multi-Tenant POS SaaS</p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-100">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-slate-200 rounded-lg text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
          >
            Close
          </button>
          <button
            onClick={handlePrint}
            className="flex items-center space-x-2 px-5 py-2 bg-brand-500 hover:bg-brand-600 text-white rounded-lg text-sm font-semibold shadow-md transition-colors"
          >
            <Printer className="w-4 h-4" />
            <span>Print Receipt</span>
          </button>
        </div>
      </div>
    </Modal>
  );
};
