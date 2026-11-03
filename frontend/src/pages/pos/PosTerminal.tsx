import React, { useState, useEffect, useMemo } from 'react';
import { api } from '../../api/client.js';
import { useAuth } from '../../context/AuthContext.js';
import { ReceiptModal } from '../../components/common/ReceiptModal.js';
import { Modal } from '../../components/common/Modal.js';
import {
  Search,
  Barcode,
  ShoppingBag,
  Plus,
  Minus,
  Trash2,
  Percent,
  CreditCard,
  Banknote,
  Smartphone,
  Split,
  Printer,
  Clock,
  Layers,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  PauseCircle,
  PlayCircle,
  User,
} from 'lucide-react';
import { OrderType, PaymentMethod } from '@pos/shared';

export const PosTerminal: React.FC = () => {
  const { user, tenant } = useAuth();
  const [categories, setCategories] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [tables, setTables] = useState<any[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  // Active Register Shift
  const [currentShift, setCurrentShift] = useState<any | null>(null);
  const [isOpenShiftModalOpen, setIsOpenShiftModalOpen] = useState(false);
  const [openingCashInput, setOpeningCashInput] = useState(5000);

  // Cart State
  const [cartItems, setCartItems] = useState<any[]>([]);
  const [orderType, setOrderType] = useState<OrderType>(OrderType.COUNTER);
  const [selectedTable, setSelectedTable] = useState<any | null>(null);
  const [isTableModalOpen, setIsTableModalOpen] = useState(false);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [billDiscountPercent, setBillDiscountPercent] = useState(0);
  const [billDiscountAmount, setBillDiscountAmount] = useState(0);
  const [orderNotes, setOrderNotes] = useState('');

  // Held Orders
  const [heldOrders, setHeldOrders] = useState<any[]>([]);
  const [isHeldOrdersModalOpen, setIsHeldOrdersModalOpen] = useState(false);

  // Checkout Modal State
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [payments, setPayments] = useState<Array<{ method: PaymentMethod; amount: number; reference?: string }>>([]);
  const [activePaymentMethod, setActivePaymentMethod] = useState<PaymentMethod>(PaymentMethod.CASH);
  const [cashTendered, setCashTendered] = useState<number>(0);
  const [isSubmittingCheckout, setIsSubmittingCheckout] = useState(false);

  // Receipt Modal State
  const [completedReceipt, setCompletedReceipt] = useState<any | null>(null);

  const currency = tenant?.currency || 'PKR';
  const currencySymbol = tenant?.currency_symbol || 'Rs.';
  const taxRate = Number(tenant?.tax_rate_percent) || 0;
  const isTaxInclusive = !!tenant?.is_tax_inclusive;
  const serviceChargeRate = Number(tenant?.service_charge_percent) || 0;

  // Load Menu, Tables, and Current Shift
  const fetchInitialData = async () => {
    try {
      const [catsRes, prodsRes, tablesRes, shiftRes] = await Promise.all([
        api.get('/menu/categories'),
        api.get('/menu/products'),
        api.get('/restaurant/tables'),
        api.get('/financial/shifts/current'),
      ]);

      setCategories(catsRes.categories || []);
      setProducts(prodsRes.products || []);
      setTables(tablesRes.tables || []);
      setCurrentShift(shiftRes.shift || null);

      if (!shiftRes.shift) {
        setIsOpenShiftModalOpen(true);
      }
    } catch (err) {
      console.error('Failed to load POS data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInitialData();
  }, []);

  // Filtered Products
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const matchesCat = selectedCategory === 'ALL' || p.category_id === selectedCategory;
      const matchesSearch =
        !search ||
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        p.sku.toLowerCase().includes(search.toLowerCase()) ||
        (p.barcode && p.barcode.includes(search));
      return matchesCat && matchesSearch && p.is_available;
    });
  }, [products, selectedCategory, search]);

  // Cart Calculations
  const cartSubtotal = useMemo(() => {
    return cartItems.reduce((acc, item) => acc + item.unitPrice * item.quantity, 0);
  }, [cartItems]);

  const cartItemDiscounts = useMemo(() => {
    return cartItems.reduce((acc, item) => acc + (item.itemDiscount || 0), 0);
  }, [cartItems]);

  const effectiveBillDiscount = useMemo(() => {
    if (billDiscountAmount > 0) return billDiscountAmount;
    if (billDiscountPercent > 0) {
      return (cartSubtotal - cartItemDiscounts) * (billDiscountPercent / 100);
    }
    return 0;
  }, [cartSubtotal, cartItemDiscounts, billDiscountAmount, billDiscountPercent]);

  const totalDiscount = cartItemDiscounts + effectiveBillDiscount;
  const discountedSubtotal = Math.max(0, cartSubtotal - totalDiscount);

  const calculatedTax = useMemo(() => {
    if (taxRate <= 0) return 0;
    if (isTaxInclusive) {
      return discountedSubtotal - (discountedSubtotal / (1 + taxRate / 100));
    }
    return discountedSubtotal * (taxRate / 100);
  }, [discountedSubtotal, taxRate, isTaxInclusive]);

  const calculatedServiceCharge = useMemo(() => {
    if (serviceChargeRate <= 0) return 0;
    return discountedSubtotal * (serviceChargeRate / 100);
  }, [discountedSubtotal, serviceChargeRate]);

  const grandTotal = useMemo(() => {
    const taxToAdd = isTaxInclusive ? 0 : calculatedTax;
    return Math.round((discountedSubtotal + taxToAdd + calculatedServiceCharge) * 100) / 100;
  }, [discountedSubtotal, calculatedTax, calculatedServiceCharge, isTaxInclusive]);

  // Cart Actions
  const addToCart = (product: any, variant?: any) => {
    setCartItems((prev) => {
      const existingIdx = prev.findIndex(
        (item) => item.productId === product.id && item.variantId === (variant?.id || null)
      );

      const price = variant ? Number(variant.price) : Number(product.base_price);

      if (existingIdx >= 0) {
        const next = [...prev];
        next[existingIdx].quantity += 1;
        return next;
      } else {
        return [
          ...prev,
          {
            productId: product.id,
            productName: product.name,
            variantId: variant?.id || null,
            variantName: variant?.name || null,
            unitPrice: price,
            quantity: 1,
            itemDiscount: 0,
            notes: '',
            station: product.station,
          },
        ];
      }
    });
  };

  const updateQuantity = (index: number, delta: number) => {
    setCartItems((prev) => {
      const next = [...prev];
      const newQty = next[index].quantity + delta;
      if (newQty <= 0) {
        next.splice(index, 1);
      } else {
        next[index].quantity = newQty;
      }
      return next;
    });
  };

  const removeItem = (index: number) => {
    setCartItems((prev) => prev.filter((_, i) => i !== index));
  };

  // Hold Order
  const handleHoldOrder = () => {
    if (cartItems.length === 0) return;
    const held = {
      id: Date.now().toString(),
      time: new Date().toLocaleTimeString(),
      cartItems,
      orderType,
      selectedTable,
      customerName,
      customerPhone,
      orderNotes,
    };
    setHeldOrders((prev) => [...prev, held]);
    // Reset cart
    setCartItems([]);
    setSelectedTable(null);
    setCustomerName('');
    setCustomerPhone('');
    setOrderNotes('');
  };

  const resumeHeldOrder = (held: any) => {
    setCartItems(held.cartItems);
    setOrderType(held.orderType);
    setSelectedTable(held.selectedTable);
    setCustomerName(held.customerName);
    setCustomerPhone(held.customerPhone);
    setOrderNotes(held.orderNotes);
    setHeldOrders((prev) => prev.filter((h) => h.id !== held.id));
    setIsHeldOrdersModalOpen(false);
  };

  // Open Shift
  const handleOpenShift = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await api.post('/financial/shifts/open', {
        branchId: user!.branchId,
        registerName: 'Main Terminal',
        openingCash: openingCashInput,
      });
      setCurrentShift(res.shift);
      setIsOpenShiftModalOpen(false);
    } catch (err: any) {
      alert(err.message || 'Failed to open shift');
    }
  };

  // Open Checkout Modal
  const openCheckout = () => {
    if (cartItems.length === 0) return;
    setPayments([{ method: PaymentMethod.CASH, amount: grandTotal }]);
    setCashTendered(grandTotal);
    setActivePaymentMethod(PaymentMethod.CASH);
    setIsCheckoutOpen(true);
  };

  // Process Checkout
  const handleCheckoutSubmit = async () => {
    setIsSubmittingCheckout(true);
    try {
      // 1. Create the order
      const createOrderRes = await api.post('/orders', {
        branchId: user!.branchId,
        orderType,
        tableId: selectedTable?.id || null,
        customerId: null,
        customerName: customerName || undefined,
        customerPhone: customerPhone || undefined,
        billDiscountPercent,
        billDiscountAmount,
        shiftId: currentShift?.id || null,
        orderNotes: orderNotes || undefined,
        idempotencyKey: `pos-checkout-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        items: cartItems.map((item) => ({
          productId: item.productId,
          variantId: item.variantId,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          itemDiscount: item.itemDiscount,
          notes: item.notes,
        })),
      });

      const order = createOrderRes.order;

      // 2. Complete payment
      const totalPaid = payments.reduce((acc, p) => acc + Number(p.amount), 0);
      const changeGiven = Math.max(0, (activePaymentMethod === PaymentMethod.CASH ? cashTendered : totalPaid) - grandTotal);

      await api.post(`/orders/${order.id}/checkout`, {
        payments,
        changeGiven,
      });

      // 3. Fetch printable receipt
      const receiptRes = await api.get(`/orders/${order.id}/receipt`);
      setCompletedReceipt(receiptRes.receipt);

      // Reset cart
      setCartItems([]);
      setSelectedTable(null);
      setCustomerName('');
      setCustomerPhone('');
      setBillDiscountPercent(0);
      setBillDiscountAmount(0);
      setOrderNotes('');
      setIsCheckoutOpen(false);
    } catch (err: any) {
      alert(err.message || 'Checkout failed');
    } finally {
      setIsSubmittingCheckout(false);
    }
  };

  return (
    <div className="h-screen flex flex-col bg-slate-100 overflow-hidden font-sans">
      {/* Top POS Action Header */}
      <header className="bg-slate-900 text-white px-4 py-2.5 flex items-center justify-between border-b border-slate-800 shrink-0">
        <div className="flex items-center space-x-3">
          <a
            href="/app"
            className="flex items-center space-x-1 text-slate-400 hover:text-white text-xs font-semibold px-2 py-1 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Dashboard</span>
          </a>
          <span className="font-extrabold text-sm tracking-tight text-white">
            {tenant?.name || 'Restaurant POS'}
          </span>
          <span className="text-[10px] px-2 py-0.5 bg-brand-500/20 text-brand-400 border border-brand-500/30 rounded-md font-bold uppercase">
            Live Terminal
          </span>
        </div>

        <div className="flex items-center space-x-3 text-xs">
          {/* Shift indicator */}
          {currentShift ? (
            <div className="flex items-center space-x-1.5 text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-lg">
              <Clock className="w-3.5 h-3.5" />
              <span className="font-semibold text-[11px]">Shift Open: {currentShift.register_name}</span>
            </div>
          ) : (
            <button
              onClick={() => setIsOpenShiftModalOpen(true)}
              className="flex items-center space-x-1.5 text-amber-300 bg-amber-500/20 border border-amber-500/30 px-2.5 py-1 rounded-lg font-bold hover:bg-amber-500/30"
            >
              <AlertCircle className="w-3.5 h-3.5" />
              <span>Shift Closed (Click to Open)</span>
            </button>
          )}

          {/* Held orders counter */}
          {heldOrders.length > 0 && (
            <button
              onClick={() => setIsHeldOrdersModalOpen(true)}
              className="flex items-center space-x-1 bg-amber-500 hover:bg-amber-600 text-white font-bold px-2.5 py-1 rounded-lg text-xs"
            >
              <PlayCircle className="w-3.5 h-3.5" />
              <span>Resume Held ({heldOrders.length})</span>
            </button>
          )}

          <div className="flex items-center space-x-2 pl-2 border-l border-slate-700 text-slate-300">
            <User className="w-4 h-4 text-slate-400" />
            <span className="font-semibold">{user?.fullName}</span>
          </div>
        </div>
      </header>

      {/* Main POS Interface (Split: Catalog on left, Cart on right) */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: Product Catalog & Search */}
        <div className="flex-1 flex flex-col bg-slate-50 border-r border-slate-200 overflow-hidden">
          {/* Category Tabs & Search Bar */}
          <div className="p-3 bg-white border-b border-slate-200 space-y-2 shrink-0 shadow-sm">
            <div className="flex items-center space-x-2">
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search item name, SKU, or scan barcode..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full bg-slate-100 border-none rounded-xl pl-9 pr-4 py-2 text-xs text-slate-800 placeholder-slate-400 focus:ring-2 focus:ring-brand-500"
                />
              </div>
              <div className="flex items-center space-x-1 bg-slate-100 px-3 py-2 rounded-xl text-slate-500 text-xs font-semibold">
                <Barcode className="w-4 h-4 text-slate-400" />
                <span className="hidden sm:inline">Scanner Active</span>
              </div>
            </div>

            {/* Category Pills */}
            <div className="flex items-center space-x-2 overflow-x-auto pb-1 text-xs">
              <button
                onClick={() => setSelectedCategory('ALL')}
                className={`px-3.5 py-1.5 rounded-xl font-bold whitespace-nowrap transition-colors ${
                  selectedCategory === 'ALL'
                    ? 'bg-brand-500 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                All Menu Items
              </button>
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`px-3.5 py-1.5 rounded-xl font-bold whitespace-nowrap transition-colors ${
                    selectedCategory === cat.id
                      ? 'bg-brand-500 text-white shadow-sm'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {cat.name}
                </button>
              ))}
            </div>
          </div>

          {/* Product Cards Grid */}
          <div className="flex-1 p-4 overflow-y-auto">
            {loading ? (
              <div className="text-center py-12 text-slate-400 text-xs">Loading menu...</div>
            ) : filteredProducts.length === 0 ? (
              <div className="text-center py-12 text-slate-400 text-xs">No products found.</div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3.5">
                {filteredProducts.map((p) => (
                  <div
                    key={p.id}
                    onClick={() => {
                      if (p.variants && p.variants.length > 0) {
                        // If has default variant, add default or first
                        const def = p.variants.find((v: any) => v.is_default) || p.variants[0];
                        addToCart(p, def);
                      } else {
                        addToCart(p);
                      }
                    }}
                    className="bg-white rounded-2xl border border-slate-200 p-3.5 flex flex-col justify-between hover:border-brand-500 hover:shadow-md cursor-pointer transition-all active:scale-[0.98] select-none"
                  >
                    <div>
                      <div className="flex items-center justify-between text-[10px] text-slate-400 mb-1">
                        <span className="font-mono">{p.sku}</span>
                        <span className="px-1.5 py-0.5 bg-slate-100 rounded text-slate-600 font-semibold uppercase">
                          {p.station}
                        </span>
                      </div>
                      <h4 className="font-bold text-slate-900 text-xs leading-snug line-clamp-2">
                        {p.name}
                      </h4>
                      {p.name_urdu && (
                        <p className="font-urdu text-xs text-slate-500 mt-0.5 line-clamp-1" dir="rtl">
                          {p.name_urdu}
                        </p>
                      )}
                    </div>

                    <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between">
                      <span className="font-extrabold text-sm text-brand-600">
                        {currencySymbol} {Number(p.base_price).toLocaleString()}
                      </span>
                      <span className="w-6 h-6 rounded-lg bg-brand-50 text-brand-600 flex items-center justify-center font-bold text-xs hover:bg-brand-500 hover:text-white transition-colors">
                        +
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right: Shopping Cart & Checkout Panel */}
        <div className="w-96 bg-white flex flex-col justify-between shadow-xl shrink-0 z-10">
          {/* Order Meta / Type Bar */}
          <div className="p-3.5 border-b border-slate-200 space-y-2.5">
            {/* Order Type Selector */}
            <div className="grid grid-cols-4 gap-1.5 text-xs font-bold">
              {[
                { type: OrderType.COUNTER, label: 'Counter' },
                { type: OrderType.DINE_IN, label: 'Dine-In' },
                { type: OrderType.TAKEAWAY, label: 'Takeaway' },
                { type: OrderType.DELIVERY, label: 'Delivery' },
              ].map((ot) => (
                <button
                  key={ot.type}
                  onClick={() => setOrderType(ot.type)}
                  className={`py-1.5 rounded-lg text-center transition-colors ${
                    orderType === ot.type
                      ? 'bg-slate-900 text-white shadow-sm'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {ot.label}
                </button>
              ))}
            </div>

            {/* Table Selection for Dine-In */}
            {orderType === OrderType.DINE_IN && (
              <div className="flex items-center justify-between bg-brand-50 border border-brand-200/80 rounded-xl px-3 py-1.5 text-xs">
                <span className="font-bold text-brand-800">
                  {selectedTable ? `Table: ${selectedTable.table_number}` : 'No table assigned'}
                </span>
                <button
                  onClick={() => setIsTableModalOpen(true)}
                  className="text-brand-600 font-bold hover:underline"
                >
                  {selectedTable ? 'Change Table' : 'Select Table →'}
                </button>
              </div>
            )}
          </div>

          {/* Cart Items List */}
          <div className="flex-1 p-3.5 overflow-y-auto divide-y divide-slate-100 text-xs">
            {cartItems.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-2">
                <ShoppingBag className="w-8 h-8 opacity-40" />
                <p>Cart is empty</p>
                <p className="text-[11px] text-slate-300">Tap products on the left to add items</p>
              </div>
            ) : (
              cartItems.map((item, idx) => (
                <div key={idx} className="py-2.5 flex items-center justify-between">
                  <div className="flex-1 pr-2">
                    <p className="font-bold text-slate-800 truncate">{item.productName}</p>
                    <p className="text-[11px] text-slate-400">
                      {currencySymbol} {item.unitPrice.toLocaleString()} each
                    </p>
                  </div>

                  {/* Quantity Controls */}
                  <div className="flex items-center space-x-1.5">
                    <button
                      onClick={() => updateQuantity(idx, -1)}
                      className="w-6 h-6 rounded bg-slate-100 hover:bg-slate-200 flex items-center justify-center font-bold text-slate-600"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    <span className="font-extrabold text-xs w-6 text-center">{item.quantity}</span>
                    <button
                      onClick={() => updateQuantity(idx, 1)}
                      className="w-6 h-6 rounded bg-slate-100 hover:bg-slate-200 flex items-center justify-center font-bold text-slate-600"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>

                  {/* Item Total Price */}
                  <div className="w-20 text-right font-extrabold text-slate-900 ml-2">
                    {currencySymbol} {(item.unitPrice * item.quantity).toLocaleString()}
                  </div>

                  <button
                    onClick={() => removeItem(idx)}
                    className="ml-2 text-slate-300 hover:text-rose-500 p-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))
            )}
          </div>

          {/* Cart Bottom Summary & Checkout Button */}
          <div className="p-4 bg-slate-50 border-t border-slate-200 space-y-3 shrink-0 text-xs">
            {/* Quick Discount / Hold Row */}
            <div className="flex items-center justify-between pt-1">
              <button
                onClick={handleHoldOrder}
                disabled={cartItems.length === 0}
                className="flex items-center space-x-1 text-slate-600 hover:text-slate-900 font-semibold disabled:opacity-40"
              >
                <PauseCircle className="w-4 h-4" />
                <span>Hold Order</span>
              </button>

              <div className="flex items-center space-x-1">
                <span className="text-slate-500">Bill Discount:</span>
                <input
                  type="number"
                  min="0"
                  max="100"
                  placeholder="0%"
                  value={billDiscountPercent || ''}
                  onChange={(e) => setBillDiscountPercent(parseFloat(e.target.value) || 0)}
                  className="w-14 border border-slate-200 rounded px-1.5 py-0.5 text-right font-bold"
                />
                <span className="text-slate-500">%</span>
              </div>
            </div>

            {/* Subtotal, Tax, Service Charge */}
            <div className="space-y-1 text-slate-500 text-[11px] pt-1 border-t border-slate-200">
              <div className="flex justify-between">
                <span>Subtotal:</span>
                <span className="font-semibold text-slate-800">
                  {currencySymbol} {cartSubtotal.toLocaleString()}
                </span>
              </div>
              {totalDiscount > 0 && (
                <div className="flex justify-between text-rose-600">
                  <span>Discount:</span>
                  <span>-{currencySymbol} {totalDiscount.toLocaleString()}</span>
                </div>
              )}
              {calculatedTax > 0 && (
                <div className="flex justify-between">
                  <span>Sales Tax ({taxRate}%):</span>
                  <span>{currencySymbol} {calculatedTax.toLocaleString()}</span>
                </div>
              )}
              {calculatedServiceCharge > 0 && (
                <div className="flex justify-between">
                  <span>Service Charge ({serviceChargeRate}%):</span>
                  <span>{currencySymbol} {calculatedServiceCharge.toLocaleString()}</span>
                </div>
              )}
            </div>

            {/* Total & Checkout Action */}
            <div className="flex items-center justify-between pt-2 border-t border-slate-200">
              <span className="text-xs font-bold text-slate-700">Total Due:</span>
              <span className="text-xl font-black text-slate-900">
                {currencySymbol} {grandTotal.toLocaleString()}
              </span>
            </div>

            <button
              onClick={openCheckout}
              disabled={cartItems.length === 0}
              className="w-full flex items-center justify-center space-x-2 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold py-3 rounded-xl shadow-lg shadow-emerald-600/20 text-sm transition-all disabled:opacity-50 active:scale-[0.99]"
            >
              <span>Proceed to Payment</span>
              <span>•</span>
              <span>{currencySymbol} {grandTotal.toLocaleString()}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Modal: Open Shift */}
      <Modal isOpen={isOpenShiftModalOpen} onClose={() => setIsOpenShiftModalOpen(false)} title="Open Register Shift" maxWidth="sm">
        <form onSubmit={handleOpenShift} className="space-y-4 text-xs">
          <p className="text-slate-500">
            Enter the starting cash amount in the cash drawer to open your cashier shift.
          </p>
          <div>
            <label className="block font-bold text-slate-700 mb-1">Opening Cash ({currency})</label>
            <input
              type="number"
              min="0"
              required
              value={openingCashInput}
              onChange={(e) => setOpeningCashInput(parseFloat(e.target.value) || 0)}
              className="w-full border rounded-lg px-3 py-2 text-sm font-bold"
            />
          </div>
          <button
            type="submit"
            className="w-full bg-brand-500 hover:bg-brand-600 text-white font-bold py-2.5 rounded-lg"
          >
            Confirm & Open Shift
          </button>
        </form>
      </Modal>

      {/* Modal: Table Selection for Dine-In */}
      <Modal isOpen={isTableModalOpen} onClose={() => setIsTableModalOpen(false)} title="Select Dining Table" maxWidth="lg">
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-3 text-xs">
          {tables.map((t) => (
            <button
              key={t.id}
              onClick={() => {
                setSelectedTable(t);
                setIsTableModalOpen(false);
              }}
              className={`p-3 rounded-xl border flex flex-col items-center justify-center transition-all ${
                t.status === 'AVAILABLE'
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-900 hover:border-emerald-500'
                  : 'bg-rose-50 border-rose-200 text-rose-800 opacity-80'
              }`}
            >
              <span className="font-extrabold text-sm">{t.table_number}</span>
              <span className="text-[10px] mt-1">{t.floor_name} • {t.capacity} Seats</span>
              <span className="text-[9px] font-bold uppercase mt-1 px-1.5 py-0.5 rounded bg-white/70">
                {t.status}
              </span>
            </button>
          ))}
        </div>
      </Modal>

      {/* Modal: Checkout / Fast Payment */}
      <Modal isOpen={isCheckoutOpen} onClose={() => setIsCheckoutOpen(false)} title="Fast Order Checkout" maxWidth="md">
        <div className="space-y-4 text-xs">
          {/* Total display */}
          <div className="bg-slate-900 text-white p-4 rounded-xl text-center">
            <p className="text-slate-400 text-xs">Total Amount Due</p>
            <p className="text-3xl font-black mt-1 text-emerald-400">
              {currencySymbol} {grandTotal.toLocaleString()}
            </p>
          </div>

          {/* Payment Method Selector */}
          <div>
            <label className="block font-bold text-slate-700 mb-1.5">Payment Method</label>
            <div className="grid grid-cols-4 gap-2">
              {[
                { method: PaymentMethod.CASH, label: 'Cash', icon: Banknote },
                { method: PaymentMethod.CARD, label: 'Card', icon: CreditCard },
                { method: PaymentMethod.DIGITAL_WALLET, label: 'Wallet', icon: Smartphone },
                { method: PaymentMethod.BANK_TRANSFER, label: 'Bank', icon: Banknote },
              ].map((m) => {
                const Icon = m.icon;
                const isSelected = activePaymentMethod === m.method;
                return (
                  <button
                    key={m.method}
                    onClick={() => {
                      setActivePaymentMethod(m.method);
                      setPayments([{ method: m.method, amount: grandTotal }]);
                      setCashTendered(grandTotal);
                    }}
                    className={`p-2.5 rounded-xl border flex flex-col items-center justify-center font-bold transition-all ${
                      isSelected
                        ? 'border-brand-500 bg-brand-50 text-brand-700 shadow-sm'
                        : 'border-slate-200 hover:bg-slate-50 text-slate-600'
                    }`}
                  >
                    <Icon className="w-5 h-5 mb-1" />
                    <span>{m.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Cash Tendered & Quick Cash Denominations */}
          {activePaymentMethod === PaymentMethod.CASH && (
            <div className="space-y-2 bg-slate-50 p-3 rounded-xl border border-slate-200">
              <label className="block font-bold text-slate-700">Cash Received ({currency})</label>
              <input
                type="number"
                min={grandTotal}
                value={cashTendered}
                onChange={(e) => setCashTendered(parseFloat(e.target.value) || 0)}
                className="w-full border rounded-lg px-3 py-2 text-base font-bold text-slate-900"
              />

              {/* Quick Pakistani Rupee buttons */}
              <div className="flex space-x-2 pt-1">
                {[500, 1000, 5000].map((denom) => (
                  <button
                    key={denom}
                    type="button"
                    onClick={() => setCashTendered(denom)}
                    className="flex-1 py-1.5 bg-white border border-slate-200 rounded-lg font-bold text-slate-700 hover:bg-slate-100"
                  >
                    +{denom}
                  </button>
                ))}
              </div>

              {/* Change to return */}
              <div className="flex justify-between items-center pt-2 font-bold text-slate-800">
                <span>Change to Return:</span>
                <span className="text-base text-emerald-600">
                  {currencySymbol} {Math.max(0, cashTendered - grandTotal).toLocaleString()}
                </span>
              </div>
            </div>
          )}

          {/* Complete Button */}
          <button
            onClick={handleCheckoutSubmit}
            disabled={isSubmittingCheckout || (activePaymentMethod === PaymentMethod.CASH && cashTendered < grandTotal)}
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold py-3 rounded-xl text-sm shadow-md transition-all disabled:opacity-50"
          >
            {isSubmittingCheckout ? 'Processing Transaction...' : 'Complete Payment & Print Receipt'}
          </button>
        </div>
      </Modal>

      {/* Modal: Held Orders */}
      <Modal isOpen={isHeldOrdersModalOpen} onClose={() => setIsHeldOrdersModalOpen(false)} title="Held Orders" maxWidth="md">
        <div className="space-y-2 text-xs">
          {heldOrders.map((h) => (
            <div key={h.id} className="p-3 border rounded-xl flex items-center justify-between bg-slate-50">
              <div>
                <p className="font-bold text-slate-900">{h.orderType} • {h.time}</p>
                <p className="text-slate-500">{h.cartItems.length} item(s)</p>
              </div>
              <button
                onClick={() => resumeHeldOrder(h)}
                className="px-3 py-1.5 bg-brand-500 hover:bg-brand-600 text-white font-bold rounded-lg"
              >
                Resume
              </button>
            </div>
          ))}
        </div>
      </Modal>

      {/* Modal: Printable Receipt on Complete */}
      <ReceiptModal
        isOpen={!!completedReceipt}
        onClose={() => setCompletedReceipt(null)}
        receiptData={completedReceipt}
      />
    </div>
  );
};
