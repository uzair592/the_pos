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
    paperWidth?: '58mm' | '80mm' | 'A4';
    showBusinessName?: boolean;
    businessNameFontSize?: number;
    showPhone?: boolean;
    phoneFontSize?: number;
    showAddress?: boolean;
    addressFontSize?: number;
    showSlogan?: boolean;
    sloganText?: string;
    sloganFontSize?: number;
    showLogo?: boolean;
    logoUrl?: string;
    logoSize?: 'S' | 'M' | 'L' | 'XL';
    billFontSize?: number;
    lineSpacing?: number;
    marginLeftMm?: number;
    marginRightMm?: number;
    spaceAboveMm?: number;
    spaceBelowMm?: number;
    autoCutReceipt?: boolean;
    receiptCopies?: 'CUSTOMER_ONLY' | 'CUSTOMER_AND_KITCHEN' | 'TWO_CUSTOMER_COPIES';
    desktopCutterCommand?: 'FEED_PARTIAL_CUT' | 'FEED_FULL_CUT' | 'NO_CUT';
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

export function safeNumber(val: any, fallback = 0): number {
  if (val === null || val === undefined) return fallback;
  if (typeof val === 'string') {
    const clean = val.replace(/[^0-9.-]/g, '');
    const num = parseFloat(clean);
    return isNaN(num) || !isFinite(num) ? fallback : num;
  }
  const num = Number(val);
  return isNaN(num) || !isFinite(num) ? fallback : num;
}

export function formatCurrency(amount: any, symbol = 'Rs.'): string {
  const num = safeNumber(amount, 0);
  return `${symbol} ${num.toLocaleString('en-PK', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

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

export function formatOrderType(type?: string): string {
  if (!type) return 'Dine-In';
  const clean = String(type).toUpperCase().replace(/_/g, ' ');
  if (clean === 'DINE IN') return 'Dine-In';
  if (clean === 'TAKEAWAY') return 'Takeaway';
  if (clean === 'DELIVERY') return 'Delivery';
  return clean;
}

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

export function normalizeAndValidateReceiptData(
  raw: any,
  context?: { tenant?: any; branch?: any; user?: any }
): ValidatedReceiptData | null {
  if (!raw) return null;

  const src = raw.receipt || raw.order || raw;
  const tenant = context?.tenant;
  const branch = context?.branch;
  const user = context?.user;

  const restaurantName =
    src.restaurantName ||
    src.restaurant_name ||
    src.tenant_name ||
    tenant?.name ||
    'DELIGHT PIZZA';

  const restaurantLogo =
    src.restaurantLogo ||
    src.restaurant_logo ||
    src.logoUrl ||
    src.receiptSettings?.logoUrl ||
    src.receipt_settings?.logoUrl ||
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
    src.address ||
    tenant?.address ||
    branch?.address ||
    '';

  const rawCity =
    src.branchCity ||
    src.branch_city ||
    tenant?.city ||
    branch?.city ||
    '';

  const branchAddress = rawAddress
    ? `${rawAddress}${rawCity && !rawAddress.includes(rawCity) ? ', ' + rawCity : ''}`
    : '';

  const branchPhone =
    src.branchPhone ||
    src.branch_phone ||
    src.phone ||
    tenant?.phone ||
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
    tenant?.time_zone ||
    'Asia/Karachi';

  const rawDate = src.date || src.created_at || src.createdAt || new Date().toISOString();
  const formattedDate = formatReceiptDate(rawDate, timeZone);

  const currencySymbol =
    src.currencySymbol ||
    src.currency_symbol ||
    tenant?.currency_symbol ||
    'Rs.';

  const orderNumber = String(
    src.orderNumber ||
    src.order_number ||
    src.invoiceNumber ||
    src.invoice_number ||
    (src.id ? '#' + String(src.id).slice(0, 8).toUpperCase() : '#ORD-LIVE')
  );

  const orderType = formatOrderType(src.orderType || src.order_type);
  const tableNumber = src.tableNumber || src.table_number || src.tableName || (src.table?.table_number ? String(src.table.table_number) : null);
  const floorName = String(src.floorName || src.floor_name || src.table?.floor_name || '');
  const coverCount = safeNumber(src.coverCount || src.cover_count || src.guest_count, 1);

  const customerName = String(src.customerName || src.customer_name || src.customer?.name || '');
  const customerPhone = String(src.customerPhone || src.customer_phone || src.customer?.phone || '');
  const deliveryAddress = String(src.deliveryAddress || src.delivery_address || src.customer?.address || '');
  const riderName = String(src.riderName || src.rider_name || '');
  const riderPhone = String(src.riderPhone || src.rider_phone || '');

  const cashierName = String(
    src.cashierName ||
    src.cashier_name ||
    user?.fullName ||
    'Cashier'
  );

  const serverName = String(src.serverName || src.server_name || '');
  const orderNotes = String(src.orderNotes || src.order_notes || src.notes || '');

  const rawItems = Array.isArray(src.items)
    ? src.items
    : Array.isArray(src.order_items)
    ? src.order_items
    : Array.isArray(src.orderItems)
    ? src.orderItems
    : [];

  const items: ValidatedReceiptItem[] = rawItems.map((item: any, idx: number) => {
    const rawQuantity = safeNumber(item.quantity, 1);
    const rawUnitPrice = safeNumber(
      item.unitPrice !== undefined
        ? item.unitPrice
        : item.unit_price !== undefined
        ? item.unit_price
        : item.price,
      0
    );

    const calculatedTotal = rawQuantity * rawUnitPrice;
    const rawTotalPrice = safeNumber(
      item.totalPrice !== undefined
        ? item.totalPrice
        : item.total_price !== undefined
        ? item.total_price
        : calculatedTotal,
      calculatedTotal
    );

    const rawDiscount = safeNumber(item.itemDiscount || item.item_discount || item.discount, 0);

    let modifiers: Array<{ name: string; unitPrice: number }> = [];
    if (Array.isArray(item.modifiers)) {
      modifiers = item.modifiers.map((m: any) => ({
        name: String(m.name || m.option_name || m.optionName || 'Modifier'),
        unitPrice: safeNumber(m.unitPrice !== undefined ? m.unitPrice : m.unit_price, 0),
      }));
    } else if (typeof item.modifiers === 'string' && item.modifiers.trim()) {
      try {
        const parsed = JSON.parse(item.modifiers);
        if (Array.isArray(parsed)) {
          modifiers = parsed.map((m: any) => ({
            name: String(m.name || m.option_name || m.optionName || 'Modifier'),
            unitPrice: safeNumber(m.unitPrice !== undefined ? m.unitPrice : m.unit_price, 0),
          }));
        }
      } catch (_) {}
    }

    return {
      id: String(item.id || item.productId || `item-${idx}`),
      productName: String(item.productName || item.product_name || item.name || 'Menu Item'),
      variantName: String(item.variantName || item.variant_name || ''),
      quantity: rawQuantity,
      unitPrice: rawUnitPrice,
      totalPrice: rawTotalPrice,
      itemDiscount: rawDiscount,
      modifiers,
      notes: String(item.notes || item.special_instructions || ''),
    };
  });

  const subtotal = safeNumber(
    src.subtotal !== undefined
      ? src.subtotal
      : items.reduce((sum, it) => sum + it.totalPrice, 0),
    0
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

export async function resolveAuthoritativeReceipt(
  orderOrData: any,
  context?: { tenant?: any; branch?: any; user?: any }
): Promise<ValidatedReceiptData> {
  let raw = orderOrData;

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
 * Returns pixel width corresponding to user's selected Logo Size
 */
export function getLogoMaxPx(size?: string): number {
  switch (size) {
    case 'S':
      return 60;
    case 'M':
      return 90;
    case 'L':
      return 130;
    case 'XL':
    default:
      return 180;
  }
}

/**
 * Generates clean, professional thermal receipt HTML with full custom billing controls
 */
export function generateThermalReceiptHtml(
  data: ValidatedReceiptData,
  options: { isReprint?: boolean; paperWidth?: '58mm' | '80mm' } = {}
): string {
  const rs = data.receiptSettings || {};
  const paperWidth = options.paperWidth || rs.paperWidth || '80mm';
  const is58mm = paperWidth === '58mm';
  const sym = data.currencySymbol || 'Rs.';

  const widthCss = is58mm ? '52mm' : '76mm';
  const baseFontSizePx = rs.billFontSize ? Number(rs.billFontSize) : (is58mm ? 12 : 14);
  const lineSpacing = rs.lineSpacing !== undefined ? Number(rs.lineSpacing) : 1.25;
  const marginLeftMm = rs.marginLeftMm !== undefined ? Number(rs.marginLeftMm) : 0;
  const marginRightMm = rs.marginRightMm !== undefined ? Number(rs.marginRightMm) : 0;
  const spaceAboveMm = rs.spaceAboveMm !== undefined ? Number(rs.spaceAboveMm) : 0;
  const spaceBelowMm = rs.spaceBelowMm !== undefined ? Number(rs.spaceBelowMm) : 20;

  const showBusinessName = rs.showBusinessName !== false;
  const businessNamePx = rs.businessNameFontSize ? Number(rs.businessNameFontSize) : 21;
  const showPhone = rs.showPhone !== false && !!data.branchPhone;
  const phonePx = rs.phoneFontSize ? Number(rs.phoneFontSize) : 14;
  const showAddress = rs.showAddress !== false && !!data.branchAddress;
  const addressPx = rs.addressFontSize ? Number(rs.addressFontSize) : 14;
  const showSlogan = rs.showSlogan !== false && (!!rs.sloganText || !!rs.headerText);
  const sloganText = rs.sloganText || rs.headerText || '';
  const sloganPx = rs.sloganFontSize ? Number(rs.sloganFontSize) : 13;

  const showLogo = rs.showLogo !== false && (!!rs.logoUrl || !!data.restaurantLogo);
  const logoUrl = rs.logoUrl || data.restaurantLogo || '';
  const logoMaxPx = getLogoMaxPx(rs.logoSize || 'XL');

  const selectedTemplate = rs.defaultTemplate || 'TABLE_GRID';
  const isTableGrid = selectedTemplate === 'TABLE_GRID' || selectedTemplate === 'STANDARD_80MM';
  const isDarkBanner = selectedTemplate === 'MODERN_DARK_BANNER';
  const isFormal = selectedTemplate === 'FORMAL_ELEGANT';
  const isEcoCompact = selectedTemplate === 'ECO_SAVE_COMPACT';

  const itemsHtml = data.items
    .map((item, idx) => {
      const variantDisplay = item.variantName ? ` <span style="font-size:0.88em;font-style:italic;color:#333;">(${escapeHtml(item.variantName)})</span>` : '';
      const notesDisplay = item.notes ? `<div style="font-size:0.85em;color:#555;padding-left:4px;">* ${escapeHtml(item.notes)}</div>` : '';
      const modsDisplay = item.modifiers.length > 0
        ? `<div style="font-size:0.85em;color:#444;padding-left:4px;">${item.modifiers.map(m => `+ ${escapeHtml(m.name)}${m.unitPrice > 0 ? ` (+${sym} ${m.unitPrice.toFixed(0)})` : ''}`).join('<br/>')}</div>`
        : '';

      if (isTableGrid) {
        return `
          <tr style="border-bottom: 1px solid #ddd;">
            <td style="padding: ${isEcoCompact ? '2px 4px' : '4px'}; border-right: 1px solid #ddd; vertical-align: top;">
              <span style="font-weight: bold;">${escapeHtml(item.productName)}</span>${variantDisplay}
              ${modsDisplay}
              ${notesDisplay}
            </td>
            <td style="padding: ${isEcoCompact ? '2px 4px' : '4px'}; text-align: center; border-right: 1px solid #ddd; vertical-align: top; font-weight: bold;">
              ${item.quantity}
            </td>
            <td style="padding: ${isEcoCompact ? '2px 4px' : '4px'}; text-align: right; border-right: 1px solid #ddd; vertical-align: top; white-space: nowrap;">
              ${item.unitPrice.toLocaleString('en-PK', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
            </td>
            <td style="padding: ${isEcoCompact ? '2px 4px' : '4px'}; text-align: right; vertical-align: top; font-weight: bold; white-space: nowrap;">
              ${item.totalPrice.toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </td>
          </tr>
        `;
      }

      if (is58mm || isEcoCompact) {
        return `
          <div style="margin-bottom: ${isEcoCompact ? '2px' : '4px'};">
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
      font-family: ${isFormal ? "'Times New Roman', serif" : "'Courier New', Courier, monospace, -apple-system, sans-serif"};
      font-size: ${baseFontSizePx}px;
      line-height: ${lineSpacing};
      color: #000000;
      background: #ffffff;
      padding-top: ${spaceAboveMm}mm;
      padding-bottom: ${spaceBelowMm}mm;
      padding-left: ${marginLeftMm}mm;
      padding-right: ${marginRightMm}mm;
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
      border-top: ${isFormal ? '2px double #000000' : '1px dashed #000000'};
      margin: 5px 0;
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
      font-size: 1.15em;
      font-weight: 900;
    }
    .dark-banner {
      background: #000000;
      color: #ffffff;
      padding: 6px;
      margin-bottom: 6px;
      text-align: center;
    }
    .grid-table {
      width: 100%;
      border-collapse: collapse;
      border: 1px solid #bbb;
      margin: 6px 0;
      font-size: 0.95em;
    }
    .grid-table th {
      background: #f0f0f0;
      border: 1px solid #bbb;
      padding: 4px;
      font-weight: 900;
      text-transform: uppercase;
    }
    .grid-table td {
      border: 1px solid #ddd;
    }
  </style>
</head>
<body>
  <!-- Header -->
  <div class="text-center" style="margin-bottom: 4px;">
    ${showLogo && logoUrl ? `
      <div style="margin-bottom: 6px;">
        <img src="${logoUrl}" alt="Logo" style="max-width: ${logoMaxPx}px; height: auto; display: inline-block; object-fit: contain;" />
      </div>
    ` : ''}

    ${isDarkBanner ? `
      <div class="dark-banner">
        ${showBusinessName ? `<div style="font-size: ${businessNamePx}px; font-weight: 900; letter-spacing: 0.5px; text-transform: uppercase;">${escapeHtml(data.restaurantName)}</div>` : ''}
        ${showSlogan && sloganText ? `<div style="font-size: ${sloganPx}px; font-style: italic; opacity: 0.9; margin-top: 2px;">${escapeHtml(sloganText)}</div>` : ''}
      </div>
    ` : `
      ${showBusinessName ? `
        <div style="font-size: ${businessNamePx}px; font-weight: 900; letter-spacing: 0.5px; text-transform: uppercase;">
          ${escapeHtml(data.restaurantName)}
        </div>
      ` : ''}
      ${showSlogan && sloganText ? `
        <div style="font-size: ${sloganPx}px; font-style: italic; color: #333; margin-top: 2px;">
          ${escapeHtml(sloganText)}
        </div>
      ` : ''}
    `}

    ${showAddress ? `
      <div style="font-size: ${addressPx}px; color: #222; margin-top: 2px; line-height: 1.2;">
        ${escapeHtml(data.branchAddress)}
      </div>
    ` : ''}

    ${showPhone ? `
      <div style="font-size: ${phonePx}px; font-weight: bold; margin-top: 2px;">
        Tel: ${escapeHtml(data.branchPhone)}
      </div>
    ` : ''}

    ${data.taxRegistrationNumber && rs.showTaxBreakdown !== false ? `
      <div style="font-size: 0.85em; font-weight: 900; margin-top: 2px;">
        STRN/NTN: ${escapeHtml(data.taxRegistrationNumber)}
      </div>
    ` : ''}
  </div>

  ${options.isReprint ? `
    <div style="border: 1px dashed #000; padding: 3px; margin: 4px 0; text-align: center; font-weight: 900; font-size: 0.9em;">
      *** DUPLICATE / REPRINT RECEIPT ***
    </div>
  ` : ''}

  <div class="divider"></div>

  <!-- Order Meta -->
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
    ${rs.showCashierName !== false ? `
      <div class="row">
        <span>Cashier:</span>
        <span>${escapeHtml(data.cashierName)}</span>
      </div>
    ` : ''}
    ${rs.showCustomerDetails !== false && data.customerName ? `
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
  </div>

  <div class="divider"></div>

  <!-- Items Content -->
  ${isTableGrid ? `
    <table class="grid-table">
      <thead>
        <tr>
          <th style="text-align: left;">Item</th>
          <th style="width: 32px; text-align: center;">Qty</th>
          <th style="width: 48px; text-align: right;">Price</th>
          <th style="width: 60px; text-align: right;">Total</th>
        </tr>
      </thead>
      <tbody>
        ${itemsHtml || '<tr><td colspan="4" style="text-align:center;padding:6px;">No items</td></tr>'}
      </tbody>
    </table>
  ` : `
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
    <div style="padding-top: 4px;">
      ${itemsHtml || '<div class="text-center" style="font-style:italic;padding:6px 0;">No items on order</div>'}
    </div>
  `}

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
    ${data.taxAmount > 0 && rs.showTaxBreakdown !== false ? `
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
      ${escapeHtml(rs.footerText || 'Thank you for your visit!')}
    </div>
    <div style="font-size: 0.8em; color: #444; margin-top: 2px;">
      Please retain receipt for exchange or refund within 24 hours
    </div>
  </div>
</body>
</html>`;
}

export async function executeThermalPrint(
  orderOrData: any,
  options: PrintReceiptOptions = {}
): Promise<boolean> {
  const data = await resolveAuthoritativeReceipt(orderOrData, options.context);
  const html = generateThermalReceiptHtml(data, options);

  return new Promise((resolve, reject) => {
    try {
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
