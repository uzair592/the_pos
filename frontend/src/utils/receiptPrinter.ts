import { api } from '../api/client.js';

export interface ValidatedReceiptItem {
  id: string;
  productName: string;
  variantName: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  itemDiscount: number;
  modifiers: Array<{ name: string; unitPrice: number }>;
  notes: string;
}

export interface ValidatedReceiptPayment {
  method: string;
  amount: number;
}

export interface ValidatedReceiptData {
  id?: string;
  restaurantName: string;
  restaurantLogo?: string;
  branchName: string;
  branchAddress: string;
  branchPhone: string;
  taxRegistrationNumber: string;
  timeZone: string;
  orderNumber: string;
  orderType: string;
  tableNumber: string | null;
  floorName: string;
  coverCount: number;
  customerName: string;
  customerPhone: string;
  deliveryAddress: string;
  riderName: string;
  riderPhone: string;
  cashierName: string;
  serverName: string;
  orderNotes: string;
  date: string;
  formattedDate: string;
  currencySymbol: string;
  items: ValidatedReceiptItem[];
  subtotal: number;
  discount: number;
  billDiscountPercent: number;
  billDiscountAmount: number;
  itemDiscountsTotal: number;
  taxPercent: number;
  taxAmount: number;
  serviceChargeAmount: number;
  deliveryFee: number;
  grandTotal: number;
  paidAmount: number;
  changeGiven: number;
  balanceDue: number;
  paymentStatus: string;
  payments: ValidatedReceiptPayment[];
  receiptSettings: {
    paperWidth?: '58mm' | '80mm';
    showLogo?: boolean;
    showTaxBreakdown?: boolean;
    showCashierName?: boolean;
    showCustomerDetails?: boolean;
    showTipGuide?: boolean;
    showQrCode?: boolean;
    headerText?: string;
    footerText?: string;
    defaultTemplate?: any;
    activeTemplate?: any;
    [key: string]: any;
  };
}

export interface PrintReceiptOptions {
  isReprint?: boolean;
  paperWidth?: '58mm' | '80mm';
  context?: {
    tenant?: any;
    branch?: any;
    user?: any;
  };
}

/**
 * Safe number parser: guarantees a finite number, never NaN or undefined
 */
export function safeNumber(val: any, fallback = 0): number {
  if (val === null || val === undefined) return fallback;
  if (typeof val === 'string') {
    // Strip non-numeric currency prefixes (e.g. "Rs.", ",", etc.)
    const clean = val.replace(/[^0-9.-]/g, '');
    const num = parseFloat(clean);
    return isNaN(num) || !isFinite(num) ? fallback : num;
  }
  const num = Number(val);
  return isNaN(num) || !isFinite(num) ? fallback : num;
}

/**
 * Safe currency formatter: guarantees formatted string, never "Rs. NaN"
 */
export function formatCurrency(amount: any, symbol = 'Rs.'): string {
  const num = safeNumber(amount, 0);
  return `${symbol} ${num.toLocaleString('en-PK', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/**
 * Safe Date Formatter in Pakistan Standard Time (Asia/Karachi)
 * Guarantees a readable date, never "Invalid Date"
 */
export function formatReceiptDate(dateStr?: any, timeZone = 'Asia/Karachi'): string {
  if (!dateStr) {
    return new Date().toLocaleString('en-PK', {
      timeZone,
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  }

  const d = new Date(dateStr);
  if (isNaN(d.getTime())) {
    return new Date().toLocaleString('en-PK', {
      timeZone,
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  }

  try {
    return d.toLocaleString('en-PK', {
      timeZone,
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  } catch {
    return d.toLocaleString('en-PK');
  }
}

/**
 * Clean Order Type display
 */
export function formatOrderType(type?: string): string {
  if (!type) return 'Dine-In';
  const clean = String(type).toUpperCase().replace(/_/g, ' ');
  if (clean === 'DINE IN') return 'Dine-In';
  if (clean === 'TAKEAWAY') return 'Takeaway';
  if (clean === 'DELIVERY') return 'Delivery';
  return clean;
}

/**
 * Clean Payment Method display
 */
export function formatPaymentMethod(method?: string): string {
  if (!method) return 'Cash';
  const clean = String(method).toUpperCase().replace(/_/g, ' ');
  if (clean === 'CASH') return 'Cash';
  if (clean === 'CARD') return 'Card';
  if (clean === 'DIGITAL WALLET') return 'Digital Wallet';
  if (clean === 'BANK TRANSFER') return 'Bank Transfer';
  if (clean === 'CUSTOMER CREDIT') return 'Customer Credit';
  return clean;
}

/**
 * Normalizes and validates raw order / receipt data with zero-leak guarantees
 */
export function normalizeAndValidateReceiptData(
  raw: any,
  context?: { tenant?: any; branch?: any; user?: any }
): ValidatedReceiptData | null {
  if (!raw) return null;

  const src = raw.receipt || raw.order || raw;

  const tenant = context?.tenant;
  const branch = context?.branch;
  const user = context?.user;

  // Restaurant details
  const restaurantName =
    src.restaurantName ||
    src.restaurant_name ||
    src.tenant_name ||
    tenant?.name ||
    'Restaurant POS';

  const restaurantLogo =
    src.restaurantLogo ||
    src.restaurant_logo ||
    tenant?.logo_url ||
    '';

  const branchName =
    src.branchName ||
    src.branch_name ||
    branch?.name ||
    'Main Branch';

  const rawAddress =
    src.branchAddress ||
    src.branch_address ||
    branch?.address ||
    '';

  const rawCity =
    src.branchCity ||
    src.branch_city ||
    branch?.city ||
    '';

  const branchAddress = rawAddress
    ? `${rawAddress}${rawCity && !rawAddress.includes(rawCity) ? ', ' + rawCity : ''}`
    : '';

  const branchPhone =
    src.branchPhone ||
    src.branch_phone ||
    branch?.phone ||
    '';

  const taxRegistrationNumber =
    src.taxRegistrationNumber ||
    src.tax_registration_number ||
    src.strn ||
    src.ntn ||
    tenant?.tax_registration_number ||
    '';

  const timeZone =
    src.timeZone ||
    src.time_zone ||
    'Asia/Karachi';

  const orderNumber =
    src.orderNumber ||
    src.order_number ||
    (src.id ? `ORD-${String(src.id).slice(0, 8).toUpperCase()}` : 'ORD-001');

  const rawDate = src.date || src.created_at || src.createdAt || new Date().toISOString();
  const formattedDate = formatReceiptDate(rawDate, timeZone);

  const orderType = formatOrderType(src.orderType || src.order_type);

  const tableNumber =
    src.tableNumber !== undefined && src.tableNumber !== null
      ? String(src.tableNumber)
      : src.table_number !== undefined && src.table_number !== null
      ? String(src.table_number)
      : null;

  const floorName = src.floorName || src.floor_name || '';
  const coverCount = Math.max(1, safeNumber(src.coverCount || src.cover_count, 1));

  const cashierName =
    src.cashierName ||
    src.cashier_name ||
    user?.fullName ||
    'Staff';

  const serverName =
    src.serverName ||
    src.server_name ||
    src.waiter_name ||
    cashierName;

  const customerName = src.customerName || src.customer_name || '';
  const customerPhone = src.customerPhone || src.customer_phone || '';
  const deliveryAddress = src.deliveryAddress || src.delivery_address || '';
  const riderName = src.riderName || src.rider_name || '';
  const riderPhone = src.riderPhone || src.rider_phone || '';
  const orderNotes = src.orderNotes || src.order_notes || src.notes || '';
  const currencySymbol = src.currencySymbol || src.currency_symbol || tenant?.currencySymbol || 'Rs.';

  // Raw items normalization
  const rawItems: any[] = Array.isArray(src.items)
    ? src.items
    : Array.isArray(src.order_items)
    ? src.order_items
    : Array.isArray(src.orderItems)
    ? src.orderItems
    : Array.isArray(src.cartItems)
    ? src.cartItems
    : [];

  const items: ValidatedReceiptItem[] = rawItems.map((item: any, idx: number) => {
    const productName =
      item.productName ||
      item.product_name ||
      item.name ||
      item.title ||
      item.product?.name ||
      `Item #${idx + 1}`;

    const variantName =
      item.variantName ||
      item.variant_name ||
      item.variant?.name ||
      item.variant ||
      '';

    const quantity = Math.max(1, safeNumber(item.quantity, 1));
    const unitPrice = safeNumber(
      item.unitPrice !== undefined
        ? item.unitPrice
        : item.unit_price !== undefined
        ? item.unit_price
        : item.price,
      0
    );

    const calculatedTotal = unitPrice * quantity;
    const totalPrice = safeNumber(
      item.totalPrice !== undefined
        ? item.totalPrice
        : item.total_price !== undefined
        ? item.total_price
        : item.amount,
      calculatedTotal
    );

    let rawModifiers = item.modifiers;
    if (typeof rawModifiers === 'string') {
      try {
        rawModifiers = JSON.parse(rawModifiers);
      } catch {
        rawModifiers = [];
      }
    }
    if (!Array.isArray(rawModifiers)) rawModifiers = [];

    const modifiers = rawModifiers.map((m: any) => ({
      name: String(m.name || m.modifier_name || m.optionName || 'Addon'),
      unitPrice: safeNumber(m.unitPrice !== undefined ? m.unitPrice : m.unit_price || m.price, 0),
    }));

    const notes = item.notes || item.special_instructions || item.instruction || '';

    return {
      id: String(item.id || `item-${idx}`),
      productName: String(productName),
      variantName: String(variantName),
      quantity,
      unitPrice,
      totalPrice,
      itemDiscount: safeNumber(item.itemDiscount || item.item_discount, 0),
      modifiers,
      notes: String(notes),
    };
  });

  // Calculate totals robustly
  const fallbackSubtotal = items.reduce((acc, it) => acc + it.totalPrice, 0);
  const subtotal = safeNumber(
    src.subtotal !== undefined
      ? src.subtotal
      : src.gross_sales !== undefined
      ? src.gross_sales
      : src.items_subtotal,
    fallbackSubtotal
  );

  const discount = safeNumber(
    src.discount !== undefined
      ? src.discount
      : src.total_discount !== undefined
      ? src.total_discount
      : src.discount_amount,
    0
  );

  const billDiscountPercent = safeNumber(src.billDiscountPercent || src.bill_discount_percent, 0);
  const billDiscountAmount = safeNumber(src.billDiscountAmount || src.bill_discount_amount, 0);
  const itemDiscountsTotal = safeNumber(src.itemDiscountsTotal || src.item_discounts_total, 0);

  const taxPercent = safeNumber(
    src.taxPercent !== undefined
      ? src.taxPercent
      : src.tax_percent !== undefined
      ? src.tax_percent
      : src.tax_rate_percent,
    0
  );

  const taxAmount = safeNumber(src.taxAmount !== undefined ? src.taxAmount : src.tax_amount, 0);

  const serviceChargeAmount = safeNumber(
    src.serviceChargeAmount !== undefined
      ? src.serviceChargeAmount
      : src.service_charge_amount !== undefined
      ? src.service_charge_amount
      : src.service_charge,
    0
  );

  const deliveryFee = safeNumber(src.deliveryFee !== undefined ? src.deliveryFee : src.delivery_fee, 0);

  // Grand Total = Subtotal - Discount + Tax + Service Charge + Delivery
  const calculatedGrandTotal = Math.max(0, subtotal - discount + taxAmount + serviceChargeAmount + deliveryFee);
  const grandTotal = safeNumber(
    src.grandTotal !== undefined
      ? src.grandTotal
      : src.grand_total !== undefined
      ? src.grand_total
      : src.total_amount,
    calculatedGrandTotal
  );

  const paidAmount = safeNumber(src.paidAmount !== undefined ? src.paidAmount : src.paid_amount, grandTotal);
  const changeGiven = safeNumber(src.changeGiven !== undefined ? src.changeGiven : src.change_given, 0);
  const balanceDue = safeNumber(src.balanceDue !== undefined ? src.balanceDue : src.balance_due, 0);
  const paymentStatus = String(src.paymentStatus || src.payment_status || (balanceDue <= 0 ? 'PAID' : 'PENDING'));

  // Payments
  const rawPayments = Array.isArray(src.payments)
    ? src.payments
    : Array.isArray(src.order_payments)
    ? src.order_payments
    : [];

  const payments: ValidatedReceiptPayment[] =
    rawPayments.length > 0
      ? rawPayments.map((p: any) => ({
          method: formatPaymentMethod(p.method || p.payment_method),
          amount: safeNumber(p.amount, grandTotal),
        }))
      : src.payment_method
      ? [{ method: formatPaymentMethod(src.payment_method), amount: grandTotal }]
      : [{ method: 'Cash', amount: grandTotal }];

  const receiptSettings = src.receiptSettings || src.receipt_settings || {};

  return {
    id: src.id,
    restaurantName,
    restaurantLogo,
    branchName,
    branchAddress,
    branchPhone,
    taxRegistrationNumber,
    timeZone,
    orderNumber,
    orderType,
    tableNumber,
    floorName,
    coverCount,
    cashierName,
    serverName,
    customerName,
    customerPhone,
    deliveryAddress,
    riderName,
    riderPhone,
    orderNotes,
    date: rawDate,
    formattedDate,
    currencySymbol,
    items,
    subtotal,
    discount,
    billDiscountPercent,
    billDiscountAmount,
    itemDiscountsTotal,
    taxPercent,
    taxAmount,
    serviceChargeAmount,
    deliveryFee,
    grandTotal,
    paidAmount,
    changeGiven,
    balanceDue,
    paymentStatus,
    payments,
    receiptSettings,
  };
}

/**
 * Resolves full authoritative receipt data from server if only partial data is available
 */
export async function resolveAuthoritativeReceipt(
  orderOrData: any,
  context?: { tenant?: any; branch?: any; user?: any }
): Promise<ValidatedReceiptData> {
  let raw = orderOrData;

  // If a string ID is passed, fetch from server
  if (typeof orderOrData === 'string') {
    const res = await api.get(`/orders/${orderOrData}/receipt`);
    raw = res.receipt || res;
  } else if (orderOrData && typeof orderOrData === 'object') {
    const orderId = orderOrData.id || orderOrData.order_id || orderOrData.orderId;
    const items = orderOrData.items || orderOrData.order_items || orderOrData.orderItems;
    const isMissingDetails =
      !Array.isArray(items) ||
      items.length === 0 ||
      !orderOrData.restaurantName ||
      !orderOrData.branchName;

    // If order has an ID and is missing line items or metadata, fetch authoritative receipt
    if (orderId && isMissingDetails) {
      try {
        const res = await api.get(`/orders/${orderId}/receipt`);
        if (res?.receipt) {
          raw = res.receipt;
        }
      } catch (err) {
        console.warn('Could not fetch complete receipt from backend, using provided order data:', err);
      }
    }
  }

  const validated = normalizeAndValidateReceiptData(raw, context);
  if (!validated) {
    throw new Error('Unable to construct valid receipt data');
  }
  return validated;
}

/**
 * Generates clean, professional thermal receipt HTML for 80mm and 58mm widths
 */
export function generateThermalReceiptHtml(
  data: ValidatedReceiptData,
  options: { isReprint?: boolean; paperWidth?: '58mm' | '80mm' } = {}
): string {
  const paperWidth = options.paperWidth || data.receiptSettings?.paperWidth || '80mm';
  const is58mm = paperWidth === '58mm';
  const sym = data.currencySymbol || 'Rs.';

  const widthCss = is58mm ? '52mm' : '76mm';
  const fontCss = is58mm ? '10px' : '12px';
  const headerFontCss = is58mm ? '13px' : '16px';
  const totalFontCss = is58mm ? '14px' : '16px';

  const itemsHtml = data.items
    .map((item) => {
      const variantDisplay = item.variantName ? ` <span style="font-size:0.9em;font-style:italic;">(${escapeHtml(item.variantName)})</span>` : '';
      const notesDisplay = item.notes ? `<div style="font-size:0.85em;color:#444;padding-left:8px;">* ${escapeHtml(item.notes)}</div>` : '';
      const modsDisplay = item.modifiers.length > 0
        ? `<div style="font-size:0.85em;color:#444;padding-left:8px;">${item.modifiers.map(m => `+ ${escapeHtml(m.name)}${m.unitPrice > 0 ? ` (+${sym} ${m.unitPrice.toFixed(0)})` : ''}`).join('<br/>')}</div>`
        : '';

      if (is58mm) {
        return `
          <div style="margin-bottom: 4px;">
            <div style="display:flex;justify-content:space-between;font-weight:bold;">
              <span style="flex:1;padding-right:4px;">${escapeHtml(item.productName)}${variantDisplay}</span>
              <span style="white-space:nowrap;">${sym} ${item.totalPrice.toLocaleString('en-PK', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}</span>
            </div>
            <div style="display:flex;justify-content:space-between;font-size:0.9em;color:#555;">
              <span>${item.quantity} x ${sym} ${item.unitPrice.toLocaleString('en-PK', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}</span>
              ${item.itemDiscount > 0 ? `<span style="color:#c00;">-${sym} ${item.itemDiscount}</span>` : ''}
            </div>
            ${modsDisplay}
            ${notesDisplay}
          </div>
        `;
      }

      return `
        <div style="margin-bottom: 4px;">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;">
            <div style="flex:1;padding-right:6px;">
              <span style="font-weight:bold;">${escapeHtml(item.productName)}</span>${variantDisplay}
            </div>
            <div style="width:36px;text-align:center;font-weight:bold;">${item.quantity}</div>
            <div style="width:72px;text-align:right;font-weight:bold;white-space:nowrap;">
              ${sym} ${item.totalPrice.toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </div>
          ${modsDisplay}
          ${notesDisplay}
        </div>
      `;
    })
    .join('');

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Receipt ${escapeHtml(data.orderNumber)}</title>
  <style>
    @page {
      size: ${paperWidth} auto;
      margin: 0mm;
    }
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    body {
      font-family: 'Courier New', Courier, monospace, -apple-system, sans-serif;
      font-size: ${fontCss};
      line-height: 1.3;
      color: #000000;
      background: #ffffff;
      padding: ${is58mm ? '2mm 1.5mm' : '4mm 2.5mm'};
      width: ${widthCss};
      margin: 0 auto;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .text-center { text-align: center; }
    .text-right { text-align: right; }
    .text-left { text-align: left; }
    .bold { font-weight: bold; }
    .bolder { font-weight: 900; }
    .uppercase { text-transform: uppercase; }
    .divider {
      border-top: 1px dashed #000000;
      margin: 5px 0;
    }
    .divider-double {
      border-top: 2px solid #000000;
      border-bottom: 1px solid #000000;
      height: 3px;
      margin: 6px 0;
    }
    .row {
      display: flex;
      justify-content: space-between;
      margin-bottom: 2px;
    }
    .grand-total-box {
      border-top: 2px solid #000;
      border-bottom: 2px solid #000;
      padding: 4px 0;
      margin: 5px 0;
      display: flex;
      justify-content: space-between;
      font-size: ${totalFontCss};
      font-weight: 900;
    }
    .reprint-banner {
      border: 1px dashed #000;
      padding: 3px;
      margin: 4px 0;
      text-align: center;
      font-weight: 900;
      font-size: 0.9em;
      letter-spacing: 1px;
    }
  </style>
</head>
<body>
  <!-- Header -->
  <div class="text-center">
    <div style="font-size: ${headerFontCss}; font-weight: 900; letter-spacing: 0.5px; text-transform: uppercase;">
      ${escapeHtml(data.restaurantName)}
    </div>
    <div style="font-weight: bold; font-size: 0.95em; margin-top: 2px;">
      ${escapeHtml(data.branchName)}
    </div>
    ${data.branchAddress ? `<div style="font-size: 0.85em; color: #222; margin-top: 1px;">${escapeHtml(data.branchAddress)}</div>` : ''}
    ${data.branchPhone ? `<div style="font-size: 0.85em; font-weight: bold; margin-top: 1px;">Tel: ${escapeHtml(data.branchPhone)}</div>` : ''}
    ${data.taxRegistrationNumber ? `<div style="font-size: 0.85em; font-weight: 900; margin-top: 2px;">STRN/NTN: ${escapeHtml(data.taxRegistrationNumber)}</div>` : ''}
    ${data.receiptSettings.headerText ? `<div style="font-size: 0.85em; font-style: italic; margin-top: 2px;">${escapeHtml(data.receiptSettings.headerText)}</div>` : ''}
  </div>

  ${options.isReprint ? `
    <div class="reprint-banner">
      *** DUPLICATE / REPRINT RECEIPT ***
    </div>
  ` : ''}

  <div class="divider"></div>

  <!-- Order Metadata -->
  <div>
    <div class="row">
      <span class="bold">Order #:</span>
      <span class="bolder" style="font-size: 1.1em;">${escapeHtml(data.orderNumber)}</span>
    </div>
    <div class="row">
      <span>Date:</span>
      <span>${escapeHtml(data.formattedDate)}</span>
    </div>
    <div class="row">
      <span>Type:</span>
      <span class="bold uppercase">${escapeHtml(data.orderType)}</span>
    </div>
    ${data.tableNumber ? `
      <div class="row">
        <span class="bold">Table:</span>
        <span class="bolder">Table ${escapeHtml(data.tableNumber)}${data.floorName ? ` (${escapeHtml(data.floorName)})` : ''}</span>
      </div>
    ` : ''}
    <div class="row">
      <span>Cashier:</span>
      <span>${escapeHtml(data.cashierName)}</span>
    </div>
    ${data.customerName ? `
      <div class="row" style="border-top: 1px dotted #888; padding-top: 2px; margin-top: 2px;">
        <span>Customer:</span>
        <span class="bold">${escapeHtml(data.customerName)}${data.customerPhone ? ` (${escapeHtml(data.customerPhone)})` : ''}</span>
      </div>
    ` : ''}
    ${data.deliveryAddress ? `
      <div style="font-size: 0.85em; padding-top: 1px;">
        <strong>Address:</strong> ${escapeHtml(data.deliveryAddress)}
      </div>
    ` : ''}
    ${data.riderName ? `
      <div class="row" style="font-size: 0.85em;">
        <span>Rider:</span>
        <span>${escapeHtml(data.riderName)}${data.riderPhone ? ` (${escapeHtml(data.riderPhone)})` : ''}</span>
      </div>
    ` : ''}
  </div>

  <div class="divider"></div>

  <!-- Items Table Header -->
  ${is58mm ? `
    <div style="display:flex;justify-content:space-between;font-weight:900;text-transform:uppercase;font-size:0.9em;padding-bottom:3px;border-bottom:1px solid #000;">
      <span>Item Description</span>
      <span>Amount</span>
    </div>
  ` : `
    <div style="display:flex;justify-content:space-between;font-weight:900;text-transform:uppercase;font-size:0.9em;padding-bottom:3px;border-bottom:1px solid #000;">
      <span style="flex:1;">Item</span>
      <span style="width:36px;text-align:center;">Qty</span>
      <span style="width:72px;text-align:right;">Amount</span>
    </div>
  `}

  <!-- Items Body -->
  <div style="padding-top: 4px;">
    ${itemsHtml || '<div class="text-center" style="font-style:italic;padding:6px 0;">No items on order</div>'}
  </div>

  <div class="divider"></div>

  <!-- Financial Summary -->
  <div>
    <div class="row">
      <span>Subtotal:</span>
      <span class="bold">${formatCurrency(data.subtotal, sym)}</span>
    </div>
    ${data.discount > 0 ? `
      <div class="row" style="font-weight:bold;">
        <span>Discount:</span>
        <span>-${formatCurrency(data.discount, sym)}</span>
      </div>
    ` : ''}
    ${data.taxAmount > 0 ? `
      <div class="row">
        <span>Sales Tax (${data.taxPercent}%):</span>
        <span>${formatCurrency(data.taxAmount, sym)}</span>
      </div>
    ` : ''}
    ${data.serviceChargeAmount > 0 ? `
      <div class="row">
        <span>Service Charge:</span>
        <span>${formatCurrency(data.serviceChargeAmount, sym)}</span>
      </div>
    ` : ''}
    ${data.deliveryFee > 0 ? `
      <div class="row">
        <span>Delivery Fee:</span>
        <span>${formatCurrency(data.deliveryFee, sym)}</span>
      </div>
    ` : ''}

    <div class="grand-total-box">
      <span>GRAND TOTAL:</span>
      <span>${formatCurrency(data.grandTotal, sym)}</span>
    </div>

    ${data.payments.map(p => `
      <div class="row">
        <span>Paid via ${escapeHtml(p.method)}:</span>
        <span class="bold">${formatCurrency(p.amount, sym)}</span>
      </div>
    `).join('')}

    ${data.changeGiven > 0 ? `
      <div class="row" style="font-weight:bold;">
        <span>Change Returned:</span>
        <span>${formatCurrency(data.changeGiven, sym)}</span>
      </div>
    ` : ''}

    <div class="row" style="font-size:0.85em;color:#444;margin-top:2px;">
      <span>Payment Status:</span>
      <span class="bold uppercase">${escapeHtml(data.paymentStatus)}</span>
    </div>
  </div>

  <div class="divider"></div>

  <!-- Footer -->
  <div class="text-center" style="margin-top: 4px;">
    <div style="font-weight:bold;">
      ${escapeHtml(data.receiptSettings.footerText || 'Thank you for your visit!')}
    </div>
    <div style="font-size: 0.8em; color: #444; margin-top: 2px;">
      Please retain receipt for exchange or refund within 24 hours
    </div>
  </div>
</body>
</html>`;
}

/**
 * Executes high-speed direct thermal printing via a hidden sandboxed iframe.
 * Dispatches directly to the system print dialog without opening ANY preview modal.
 */
export async function executeThermalPrint(
  orderOrData: any,
  options: PrintReceiptOptions = {}
): Promise<boolean> {
  const data = await resolveAuthoritativeReceipt(orderOrData, options.context);
  const html = generateThermalReceiptHtml(data, options);

  return new Promise((resolve, reject) => {
    try {
      // Clean up any stale print frame
      const existing = document.getElementById('pos-silent-thermal-frame');
      if (existing) existing.remove();

      const iframe = document.createElement('iframe');
      iframe.id = 'pos-silent-thermal-frame';
      iframe.style.position = 'fixed';
      iframe.style.top = '-9999px';
      iframe.style.left = '-9999px';
      iframe.style.width = '1px';
      iframe.style.height = '1px';
      iframe.style.border = 'none';
      iframe.style.opacity = '0';
      iframe.style.pointerEvents = 'none';

      document.body.appendChild(iframe);

      const doc = iframe.contentWindow?.document;
      if (!doc) {
        throw new Error('Failed to access print iframe document');
      }

      doc.open();
      doc.write(html);
      doc.close();

      // Allow DOM and fonts to lay out
      setTimeout(() => {
        try {
          iframe.contentWindow?.focus();
          iframe.contentWindow?.print();
          resolve(true);
        } catch (err) {
          reject(err);
        } finally {
          setTimeout(() => {
            try {
              iframe.remove();
            } catch (_) {}
          }, 3000);
        }
      }, 250);
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Formats plain text receipt for WhatsApp, SMS, or clipboard copying.
 * Guarantees zero "undefined", zero "Invalid Date", zero "NaN".
 */
export function formatReceiptPlainText(
  raw: any,
  options: { isReprint?: boolean; context?: any } = {}
): string {
  const data = normalizeAndValidateReceiptData(raw, options.context);
  if (!data) return '';

  const sym = data.currencySymbol || 'Rs.';

  let text = `========================================\n`;
  text += `${data.restaurantName.toUpperCase()}\n`;
  text += `${data.branchName}\n`;
  if (data.branchAddress) {
    text += `${data.branchAddress}\n`;
  }
  if (data.branchPhone) {
    text += `Tel: ${data.branchPhone}\n`;
  }
  if (data.taxRegistrationNumber) {
    text += `STRN/NTN: ${data.taxRegistrationNumber}\n`;
  }
  if (options.isReprint) {
    text += `*** DUPLICATE / REPRINT RECEIPT ***\n`;
  }
  text += `========================================\n`;
  text += `Order #: ${data.orderNumber}\n`;
  text += `Date: ${data.formattedDate}\n`;
  text += `Type: ${data.orderType}${data.tableNumber ? ' (Table ' + data.tableNumber + ')' : ''}\n`;
  text += `Cashier: ${data.cashierName}\n`;
  if (data.customerName) {
    text += `Customer: ${data.customerName}${data.customerPhone ? ' (' + data.customerPhone + ')' : ''}\n`;
  }
  if (data.deliveryAddress) {
    text += `Address: ${data.deliveryAddress}\n`;
  }
  if (data.riderName) {
    text += `Rider: ${data.riderName}${data.riderPhone ? ' (' + data.riderPhone + ')' : ''}\n`;
  }
  text += `----------------------------------------\n`;
  data.items.forEach((item) => {
    text += `${item.quantity}x ${item.productName}${item.variantName ? ' (' + item.variantName + ')' : ''} - ${formatCurrency(item.totalPrice, sym)}\n`;
    if (item.modifiers.length > 0) {
      const mods = item.modifiers.map((m) => m.name + (m.unitPrice > 0 ? ` (+${sym} ${m.unitPrice})` : '')).join(', ');
      text += `   + Addons: ${mods}\n`;
    }
    if (item.notes) {
      text += `   * Note: ${item.notes}\n`;
    }
  });
  text += `----------------------------------------\n`;
  text += `Subtotal: ${formatCurrency(data.subtotal, sym)}\n`;
  if (data.discount > 0) {
    text += `Discount: -${formatCurrency(data.discount, sym)}\n`;
  }
  if (data.taxAmount > 0) {
    text += `Sales Tax (${data.taxPercent}%): ${formatCurrency(data.taxAmount, sym)}\n`;
  }
  if (data.serviceChargeAmount > 0) {
    text += `Service Charge: ${formatCurrency(data.serviceChargeAmount, sym)}\n`;
  }
  if (data.deliveryFee > 0) {
    text += `Delivery Fee: ${formatCurrency(data.deliveryFee, sym)}\n`;
  }
  text += `========================================\n`;
  text += `GRAND TOTAL: ${formatCurrency(data.grandTotal, sym)}\n`;
  text += `========================================\n`;
  data.payments.forEach((p) => {
    text += `Paid via ${p.method}: ${formatCurrency(p.amount, sym)}\n`;
  });
  if (data.changeGiven > 0) {
    text += `Change Returned: ${formatCurrency(data.changeGiven, sym)}\n`;
  }
  text += `Payment Status: ${data.paymentStatus.toUpperCase()}\n`;
  text += `========================================\n`;
  text += `${data.receiptSettings?.footerText || 'Thank you for your visit!'}\n`;

  return text;
}

function escapeHtml(str: string): string {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
