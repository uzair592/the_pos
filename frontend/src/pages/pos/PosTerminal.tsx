import { BranchSelector } from '../../components/common/BranchSelector.js';
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api/client.js';
import { useAuth } from '../../context/AuthContext.js';
import { useToast } from '../../context/ToastContext.js';
import { useTheme } from '../../context/ThemeContext.js';
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
  Sun,
  Moon,
  Radio,
  Wifi,
  Flame,
  UtensilsCrossed,
  Check,
  Receipt,
  FileText,
  Tablet,
  Lock,
} from 'lucide-react';
import { OrderType, PaymentMethod, SystemRole } from '@pos/shared';

export const PosTerminal: React.FC = () => {
  const { user, tenant, currentBranchId, currentBranch, branches } = useAuth();
  const { success, error, info } = useToast();
  const { theme, toggleTheme } = useTheme();

  const [categories, setCategories] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [tables, setTables] = useState<any[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedSubCategory, setSelectedSubCategory] = useState<string>('ALL');

  // Customization & Addons Modal State
  const [customizingProduct, setCustomizingProduct] = useState<any | null>(null);
  const [customizingVariant, setCustomizingVariant] = useState<any | null>(null);
  const [selectedModifiers, setSelectedModifiers] = useState<Array<{ name: string; unitPrice: number; groupId: string; optionId: string }>>([]);
  const [itemCustomNotes, setItemCustomNotes] = useState<string>('');
  const [customQuantity, setCustomQuantity] = useState<number>(1);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  // Active Register Shift
  const [currentShift, setCurrentShift] = useState<any | null>(null);
  const [isOpenShiftModalOpen, setIsOpenShiftModalOpen] = useState(false);
  const [openingCashInput, setOpeningCashInput] = useState(5000);

  // Cart State
  const [cartItems, setCartItems] = useState<any[]>([]);
  const [orderType, setOrderType] = useState<OrderType>(OrderType.DINE_IN);
  const [selectedTable, setSelectedTable] = useState<any | null>(null);
  const [isTableModalOpen, setIsTableModalOpen] = useState(false);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [billDiscountPercent, setBillDiscountPercent] = useState(0);
  const [billDiscountAmount, setBillDiscountAmount] = useState(0);
  const [orderNotes, setOrderNotes] = useState('');
  const [isSubmittingKitchen, setIsSubmittingKitchen] = useState(false);

  // Held Orders
  const [heldOrders, setHeldOrders] = useState<any[]>([]);
  const [isHeldOrdersModalOpen, setIsHeldOrdersModalOpen] = useState(false);

  // ==================== UNPAID & ACTIVE DINING ORDERS ====================
  const [unpaidOrders, setUnpaidOrders] = useState<any[]>([]);
  const [isUnpaidModalOpen, setIsUnpaidModalOpen] = useState(false);
  const [unpaidFilter, setUnpaidFilter] = useState<'ALL' | 'SERVED' | 'PREPARING'>('ALL');
  const [activeCheckoutOrder, setActiveCheckoutOrder] = useState<any | null>(null);

  // Checkout Modal State
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [payments, setPayments] = useState<Array<{ method: PaymentMethod; amount: number; reference?: string }>>([]);
  const [activePaymentMethod, setActivePaymentMethod] = useState<PaymentMethod>(PaymentMethod.CASH);
  const [cashTendered, setCashTendered] = useState<number>(0);
  const [isSubmittingCheckout, setIsSubmittingCheckout] = useState(false);

  // Receipt Modal State
  const [completedReceipt, setCompletedReceipt] = useState<any | null>(null);

  // Station Lock State
  const [isStationLocked, setIsStationLocked] = useState(false);
  const [unlockPassword, setUnlockPassword] = useState('');
  const [unlockError, setUnlockError] = useState('');
  const [unlockLoading, setUnlockLoading] = useState(false);

  const handleUnlockTerminal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!unlockPassword) return;
    setUnlockLoading(true);
    setUnlockError('');
    try {
      await api.post('/auth/login', {
        email: user?.email,
        password: unlockPassword,
      });
      setIsStationLocked(false);
      setUnlockPassword('');
    } catch (err: any) {
      setUnlockError(err.message || 'Invalid password to unlock terminal');
    } finally {
      setUnlockLoading(false);
    }
  };

  // Item Cooking Notes Modal
  const [noteItemIndex, setNoteItemIndex] = useState<number | null>(null);
  const [itemNoteText, setItemNoteText] = useState('');

  // Table Transfer Modal
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [orderToTransfer, setOrderToTransfer] = useState<any | null>(null);
  const [targetTableId, setTargetTableId] = useState('');

  // Offline Order Queue
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [offlineQueue, setOfflineQueue] = useState<any[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('pos_offline_orders') || '[]');
    } catch {
      return [];
    }
  });

  // Offline Listeners & Sync
  const syncOfflineOrders = async () => {
    try {
      const queue = JSON.parse(localStorage.getItem('pos_offline_orders') || '[]');
      if (!queue || queue.length === 0) return;
      info(`Syncing ${queue.length} offline orders to cloud server...`);
      const remaining = [];
      for (const ord of queue) {
        try {
          await api.post('/orders', {
            branchId: ord.branchId,
            orderType: ord.orderType,
            tableId: ord.tableId,
            customerName: ord.customerName,
            customerPhone: ord.customerPhone,
            billDiscountPercent: ord.billDiscountPercent,
            billDiscountAmount: ord.billDiscountAmount,
            orderNotes: ord.orderNotes,
            idempotencyKey: ord.localId,
            items: ord.items.map((i: any) => ({
              productId: i.productId,
              variantId: i.variantId,
              quantity: i.quantity,
              unitPrice: i.unitPrice,
              itemDiscount: i.itemDiscount,
              notes: i.notes,
            })),
          });
        } catch (e) {
          remaining.push(ord);
        }
      }
      setOfflineQueue(remaining);
      localStorage.setItem('pos_offline_orders', JSON.stringify(remaining));
      if (remaining.length === 0) {
        success('All queued offline orders synced successfully!');
      }
      fetchInitialData();
      fetchUnpaidOrders();
    } catch (err) {
      console.error('Failed to sync offline orders:', err);
    }
  };

  useEffect(() => {
    const handleOnline = () => {
      setIsOffline(false);
      syncOfflineOrders();
    };
    const handleOffline = () => setIsOffline(true);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Multi-Device Sync tracking
  const lastEventIdRef = useRef<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<'CONNECTED' | 'SYNCING'>('CONNECTED');

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

      if (!shiftRes.shift && (user?.role === SystemRole.CASHIER || user?.role === SystemRole.RESTAURANT_OWNER)) {
        setIsOpenShiftModalOpen(true);
      }
    } catch (err: any) {
      console.error('Failed to load POS data:', err);
      error(err.message || 'Failed to load POS catalog');
    } finally {
      setLoading(false);
    }
  };

  // Fetch Unpaid / Active Orders
  const fetchUnpaidOrders = async () => {
    try {
      const data = await api.get('/orders/active');
      setUnpaidOrders(data.orders || []);
    } catch (err) {
      // quiet fail on polling
    }
  };

  useEffect(() => {
    fetchInitialData();
    fetchUnpaidOrders();
  }, []);

  // Multi-device synchronization polling
  useEffect(() => {
    const pollInterval = setInterval(async () => {
      try {
        const queryParam = lastEventIdRef.current ? `?lastEventId=${lastEventIdRef.current}` : '';
        const data = await api.get(`/sync/events${queryParam}`);
        const events = data.events || [];

        if (events.length > 0) {
          lastEventIdRef.current = events[events.length - 1].id;
          setSyncStatus('SYNCING');

          // Always refresh unpaid orders and tables on remote sync
          const [tablesRes, unpaidRes] = await Promise.all([
            api.get('/restaurant/tables'),
            api.get('/orders/active'),
          ]);
          setTables(tablesRes.tables || []);
          setUnpaidOrders(unpaidRes.orders || []);

          const servedEvent = events.find((e: any) => e.eventType === 'ORDER_STATUS_CHANGED' && e.payload?.status === 'SERVED');
          if (servedEvent) {
            info(`🔔 Food Served! Order #${servedEvent.payload?.orderNumber || ''} (Table ${servedEvent.payload?.tableNumber || ''}) is ready for payment!`);
          }

          setTimeout(() => setSyncStatus('CONNECTED'), 800);
        }
      } catch (e) {
        // Silent catch for background polling
      }
    }, 3200);

    return () => clearInterval(pollInterval);
  }, [info]);

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

  const totalItemDiscounts = useMemo(() => {
    return cartItems.reduce((acc, item) => acc + (item.itemDiscount || 0) * item.quantity, 0);
  }, [cartItems]);

  const effectiveBillDiscount = useMemo(() => {
    if (billDiscountPercent > 0) {
      return ((cartSubtotal - totalItemDiscounts) * billDiscountPercent) / 100;
    }
    return billDiscountAmount;
  }, [cartSubtotal, totalItemDiscounts, billDiscountPercent, billDiscountAmount]);

  const netTaxableAmount = Math.max(0, cartSubtotal - totalItemDiscounts - effectiveBillDiscount);

  const calculatedTax = useMemo(() => {
    if (isTaxInclusive) {
      return netTaxableAmount - netTaxableAmount / (1 + taxRate / 100);
    }
    return (netTaxableAmount * taxRate) / 100;
  }, [netTaxableAmount, taxRate, isTaxInclusive]);

  const calculatedServiceCharge = useMemo(() => {
    if (orderType === OrderType.DINE_IN && serviceChargeRate > 0) {
      return (netTaxableAmount * serviceChargeRate) / 100;
    }
    return 0;
  }, [orderType, serviceChargeRate, netTaxableAmount]);

  const grandTotal = useMemo(() => {
    if (isTaxInclusive) {
      return Math.round(netTaxableAmount + calculatedServiceCharge);
    }
    return Math.round(netTaxableAmount + calculatedTax + calculatedServiceCharge);
  }, [netTaxableAmount, calculatedTax, calculatedServiceCharge, isTaxInclusive]);

  // Add Item to Cart
  const addToCart = (product: any, variant?: any) => {
    const unitPrice = variant ? Number(variant.price) : Number(product.base_price);
    const existingIndex = cartItems.findIndex(
      (item) => item.productId === product.id && item.variantId === (variant?.id || null)
    );

    if (existingIndex > -1) {
      const newItems = [...cartItems];
      newItems[existingIndex].quantity += 1;
      setCartItems(newItems);
    } else {
      setCartItems([
        ...cartItems,
        {
          productId: product.id,
          productName: product.name + (variant ? ` (${variant.name})` : ''),
          variantId: variant?.id || null,
          unitPrice,
          quantity: 1,
          itemDiscount: 0,
          notes: '',
        },
      ]);
    }
  };

  const updateQuantity = (index: number, delta: number) => {
    const newItems = [...cartItems];
    const newQty = newItems[index].quantity + delta;
    if (newQty <= 0) {
      newItems.splice(index, 1);
    } else {
      newItems[index].quantity = newQty;
    }
    setCartItems(newItems);
  };

  const removeItem = (index: number) => {
    const newItems = [...cartItems];
    newItems.splice(index, 1);
    setCartItems(newItems);
  };

  // ==================== WORKFLOW 1: SEND ORDER TO KITCHEN (UNPAID) ====================
  const handleSendToKitchen = async () => {
    if (cartItems.length === 0) {
      error('Please select products to place an order');
      return;
    }

    if (orderType === OrderType.DINE_IN && !selectedTable) {
      setIsTableModalOpen(true);
      info('Please select a dining table for Dine-In order');
      return;
    }

    setIsSubmittingKitchen(true);
    try {
      const createOrderRes = await api.post('/orders', {
        branchId: currentBranchId || user?.branchId || branches[0]?.id,
        orderType,
        tableId: selectedTable?.id || null,
        customerId: null,
        customerName: customerName || undefined,
        customerPhone: customerPhone || undefined,
        billDiscountPercent,
        billDiscountAmount,
        shiftId: currentShift?.id || null,
        orderNotes: orderNotes || undefined,
        idempotencyKey: `pos-kitchen-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
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
      success(`Order #${order.order_number} sent to Kitchen Display! Table ${selectedTable ? selectedTable.table_number : ''} is now Active.`);

      // Reset Cart for next waiter order
      setCartItems([]);
      setSelectedTable(null);
      setCustomerName('');
      setCustomerPhone('');
      setBillDiscountPercent(0);
      setBillDiscountAmount(0);
      setOrderNotes('');

      // Refresh tables and unpaid orders list
      fetchInitialData();
      fetchUnpaidOrders();
    } catch (err: any) {
      error(err.message || 'Failed to send order to kitchen');
    } finally {
      setIsSubmittingKitchen(false);
    }
  };

  // Hold and Resume Orders
  const holdCurrentOrder = () => {
    if (cartItems.length === 0) return;
    const orderToHold = {
      id: `hold-${Date.now()}`,
      time: new Date().toLocaleTimeString(),
      cartItems,
      orderType,
      selectedTable,
      customerName,
      customerPhone,
      billDiscountPercent,
      billDiscountAmount,
      orderNotes,
    };
    setHeldOrders([...heldOrders, orderToHold]);
    setCartItems([]);
    setSelectedTable(null);
    setCustomerName('');
    setCustomerPhone('');
    success(`Order placed on hold (${orderToHold.id})`);
  };

  const resumeHeldOrder = (held: any) => {
    setCartItems(held.cartItems);
    setOrderType(held.orderType);
    setSelectedTable(held.selectedTable);
    setCustomerName(held.customerName);
    setCustomerPhone(held.customerPhone);
    setBillDiscountPercent(held.billDiscountPercent);
    setBillDiscountAmount(held.billDiscountAmount);
    setOrderNotes(held.orderNotes);
    setHeldOrders(heldOrders.filter((h) => h.id !== held.id));
    setIsHeldOrdersModalOpen(false);
    info(`Resumed held order`);
  };

  // Open Shift
  const handleOpenShift = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await api.post('/financial/shifts/open', {
        registerName: 'Main POS Register 1',
        openingCash: openingCashInput,
      });
      setCurrentShift(res.shift);
      setIsOpenShiftModalOpen(false);
      success('Shift opened successfully! Cash drawer ready.');
    } catch (err: any) {
      error(err.message || 'Failed to open shift');
    }
  };

  // Open Direct Checkout Modal
  const openDirectCheckout = () => {
    if (cartItems.length === 0) return;
    setActiveCheckoutOrder(null);
    setPayments([{ method: PaymentMethod.CASH, amount: grandTotal }]);
    setCashTendered(grandTotal);
    setActivePaymentMethod(PaymentMethod.CASH);
    setIsCheckoutOpen(true);
  };

  // ==================== WORKFLOW 2: TAKE PAYMENT FOR UNPAID / SERVED ORDER ====================
  const openCheckoutForUnpaidOrder = (unpaidOrder: any) => {
    setActiveCheckoutOrder(unpaidOrder);
    const total = Number(unpaidOrder.grand_total);
    setPayments([{ method: PaymentMethod.CASH, amount: total }]);
    setCashTendered(total);
    setActivePaymentMethod(PaymentMethod.CASH);
    setIsCheckoutOpen(true);
  };

  // Process Final Checkout & Take Payment
  const handleCheckoutSubmit = async () => {
    setIsSubmittingCheckout(true);
    try {
      let orderIdToComplete: string;
      let finalDue: number;

      if (activeCheckoutOrder) {
        // Checking out an existing served / unpaid order
        orderIdToComplete = activeCheckoutOrder.id;
        finalDue = Number(activeCheckoutOrder.grand_total);
      } else {
        // Immediate counter payment: create order first
        const createOrderRes = await api.post('/orders', {
          branchId: currentBranchId || user?.branchId || branches[0]?.id,
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
        orderIdToComplete = createOrderRes.order.id;
        finalDue = grandTotal;
      }

      // Complete payment
      const totalPaid = payments.reduce((acc, p) => acc + Number(p.amount), 0);
      const changeGiven = Math.max(0, (activePaymentMethod === PaymentMethod.CASH ? cashTendered : totalPaid) - finalDue);

      await api.post(`/orders/${orderIdToComplete}/checkout`, {
        payments,
        changeGiven,
      });

      // Fetch printable thermal receipt
      const receiptRes = await api.get(`/orders/${orderIdToComplete}/receipt`);
      setCompletedReceipt(receiptRes.receipt);

      success(`Payment complete! Order is now COMPLETED and moved to Orders History.`);

      // Reset state
      setCartItems([]);
      setSelectedTable(null);
      setCustomerName('');
      setCustomerPhone('');
      setBillDiscountPercent(0);
      setBillDiscountAmount(0);
      setOrderNotes('');
      setActiveCheckoutOrder(null);
      setIsCheckoutOpen(false);
      setIsUnpaidModalOpen(false);

      fetchInitialData();
      fetchUnpaidOrders();
    } catch (err: any) {
      error(err.message || 'Checkout failed');
    } finally {
      setIsSubmittingCheckout(false);
    }
  };

  const handleTransferTable = async () => {
    if (!orderToTransfer || !targetTableId) {
      error('Please select destination table');
      return;
    }
    try {
      const res = await api.post(`/orders/${orderToTransfer.id}/transfer-table`, {
        newTableId: targetTableId,
      });
      success(res.message || 'Table transferred successfully!');
      setIsTransferModalOpen(false);
      setOrderToTransfer(null);
      setTargetTableId('');
      fetchInitialData();
      fetchUnpaidOrders();
    } catch (err: any) {
      error(err.message || 'Failed to transfer table');
    }
  };

  // Served Count Calculation
  const servedCount = unpaidOrders.filter((o) => o.status === 'SERVED').length;
  const filteredUnpaidOrders = unpaidOrders.filter((o) => {
    if (unpaidFilter === 'SERVED') return o.status === 'SERVED';
    if (unpaidFilter === 'PREPARING') return ['PENDING', 'CONFIRMED', 'ACCEPTED', 'PREPARING', 'READY'].includes(o.status);
    return true;
  });

  return (
    <div className="h-screen flex flex-col bg-slate-100 dark:bg-slate-950 overflow-hidden font-sans">
      {/* Top POS Action Header */}
      <header className="bg-slate-900 text-white px-4 py-2.5 flex items-center justify-between border-b border-slate-800 shrink-0">
        <div className="flex items-center space-x-3">
          <Link
            to="/hub"
            className="flex items-center space-x-1 text-slate-400 hover:text-white text-xs font-semibold px-2.5 py-1 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Workspace Hub</span>
          </Link>
          <span className="font-extrabold text-sm tracking-tight text-white">
            {tenant?.name || 'Restaurant POS'}
          </span>
          <span className="text-[10px] px-2 py-0.5 bg-brand-500/20 text-brand-400 border border-brand-500/30 rounded-md font-bold uppercase">
            Live Terminal
          </span>

          {/* Multi-Device Live Indicator */}
          <div className="hidden lg:flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full bg-emerald-950/60 border border-emerald-800 text-[10px] font-bold text-emerald-400">
            <span className={`w-2 h-2 rounded-full ${syncStatus === 'SYNCING' ? 'bg-amber-400 animate-ping' : 'bg-emerald-400 animate-pulse'}`} />
            <span>Multi-Device Sync Online</span>
          </div>
        </div>

        <div className="flex items-center space-x-2 text-xs">
          <BranchSelector variant="hub" />
          {/* ==================== UNPAID ORDERS BUTTON & BADGE ==================== */}
          <button
            onClick={() => {
              fetchUnpaidOrders();
              setIsUnpaidModalOpen(true);
            }}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl font-bold text-xs transition-all shadow-sm ${
              servedCount > 0
                ? 'bg-blue-600 hover:bg-blue-500 text-white animate-pulse'
                : unpaidOrders.length > 0
                ? 'bg-amber-500 hover:bg-amber-600 text-white'
                : 'bg-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            <UtensilsCrossed className="w-3.5 h-3.5" />
            <span>Unpaid Bills ({unpaidOrders.length})</span>
            {servedCount > 0 && (
              <span className="ml-1 px-1.5 py-0.2 bg-white text-blue-900 text-[10px] rounded-full font-black">
                {servedCount} Served!
              </span>
            )}
          </button>

          {/* Shift indicator */}
          {currentShift ? (
            <div className="hidden sm:flex items-center space-x-1.5 text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-lg">
              <Clock className="w-3.5 h-3.5" />
              <span className="font-semibold text-[11px]">Shift: {currentShift.register_name}</span>
            </div>
          ) : (
            <button
              onClick={() => setIsOpenShiftModalOpen(true)}
              className="flex items-center space-x-1.5 text-amber-300 bg-amber-500/20 border border-amber-500/30 px-2.5 py-1 rounded-lg font-bold hover:bg-amber-500/30"
            >
              <AlertCircle className="w-3.5 h-3.5" />
              <span>Open Shift</span>
            </button>
          )}

          {/* Held orders counter */}
          {heldOrders.length > 0 && (
            <button
              onClick={() => setIsHeldOrdersModalOpen(true)}
              className="flex items-center space-x-1 bg-amber-500 hover:bg-amber-600 text-white font-bold px-2.5 py-1 rounded-lg text-xs"
            >
              <PlayCircle className="w-3.5 h-3.5" />
              <span>Held ({heldOrders.length})</span>
            </button>
          )}

          {/* Lock Station Button */}
          <button
            onClick={() => setIsStationLocked(true)}
            className="flex items-center space-x-1.5 px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg text-xs font-semibold transition-colors border border-slate-700"
            title="Lock Terminal"
          >
            <Lock className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden sm:inline">Lock</span>
          </button>

          {/* Theme Toggle Button */}
          <button
            onClick={toggleTheme}
            className="p-1.5 text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors"
            title="Toggle Light / Dark Mode"
          >
            {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-300" />}
          </button>

          <div className="flex items-center space-x-2 pl-2 border-l border-slate-700 text-slate-300">
            <User className="w-4 h-4 text-slate-400" />
            <span className="font-semibold hidden sm:inline">{user?.fullName}</span>
          </div>
        </div>
      </header>

      {/* Main POS Interface (Split: Catalog on left, Cart on right) */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: Product Catalog & Search */}
        <div className="flex-1 flex flex-col bg-slate-50 dark:bg-slate-950 border-r border-slate-200 dark:border-slate-800 overflow-hidden">
          {/* Category Tabs & Search Bar */}
          <div className="p-3 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 space-y-2 shrink-0 shadow-sm">
            <div className="flex items-center space-x-2">
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search item name, SKU, or scan barcode..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full bg-slate-100 dark:bg-slate-800 border-none rounded-xl pl-9 pr-4 py-2 text-xs text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:ring-2 focus:ring-brand-500"
                />
              </div>
              <div className="flex items-center space-x-1 bg-slate-100 dark:bg-slate-800 px-3 py-2 rounded-xl text-slate-500 dark:text-slate-400 text-xs font-semibold">
                <Barcode className="w-4 h-4 text-slate-400" />
                <span className="hidden sm:inline">Scanner Active</span>
              </div>
            </div>

            {/* Category Pills */}
            <div className="flex items-center space-x-2 overflow-x-auto pb-1 text-xs">
              <button
                onClick={() => setSelectedCategory('ALL')}
                className={`px-3.5 py-1.5 rounded-xl font-bold whitespace-nowrap transition-all ${
                  selectedCategory === 'ALL'
                    ? 'bg-brand-500 text-white shadow-sm'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                All Menu Items
              </button>
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`px-3.5 py-1.5 rounded-xl font-bold whitespace-nowrap transition-all ${
                    selectedCategory === cat.id
                      ? 'bg-brand-500 text-white shadow-sm'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
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
                        const def = p.variants.find((v: any) => v.is_default) || p.variants[0];
                        addToCart(p, def);
                      } else {
                        addToCart(p);
                      }
                    }}
                    className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-3.5 flex flex-col justify-between hover:border-brand-500 hover:shadow-md cursor-pointer transition-all active:scale-[0.98] select-none"
                  >
                    <div>
                      <div className="flex items-center justify-between text-[10px] text-slate-400 mb-1">
                        <span className="font-mono">{p.sku}</span>
                        <span className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 rounded text-slate-600 dark:text-slate-400 font-semibold uppercase">
                          {p.station}
                        </span>
                      </div>
                      <h4 className="font-bold text-slate-900 dark:text-white text-xs leading-snug line-clamp-2">
                        {p.name}
                      </h4>
                      {p.name_urdu && (
                        <p className="font-urdu text-xs text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-1" dir="rtl">
                          {p.name_urdu}
                        </p>
                      )}
                    </div>

                    <div className="mt-3 pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                      <span className="font-extrabold text-sm text-brand-600 dark:text-brand-400">
                        {currencySymbol} {Number(p.base_price).toLocaleString()}
                      </span>
                      <span className="w-6 h-6 rounded-lg bg-brand-50 dark:bg-brand-950/40 text-brand-600 dark:text-brand-400 flex items-center justify-center font-bold text-xs hover:bg-brand-500 hover:text-white transition-colors">
                        +
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right: Shopping Cart & Waiter Checkout Panel */}
        <div className="w-96 bg-white dark:bg-slate-900 flex flex-col justify-between shadow-xl shrink-0 z-10 border-l border-slate-200 dark:border-slate-800">
          {/* Order Meta / Type Bar */}
          <div className="p-3.5 border-b border-slate-200 dark:border-slate-800 space-y-2.5">
            {/* Order Type Selector */}
            <div className="grid grid-cols-4 gap-1.5 text-xs font-bold">
              {[
                { type: OrderType.DINE_IN, label: 'Dine-In' },
                { type: OrderType.COUNTER, label: 'Counter' },
                { type: OrderType.TAKEAWAY, label: 'Takeaway' },
                { type: OrderType.DELIVERY, label: 'Delivery' },
              ].map((ot) => (
                <button
                  key={ot.type}
                  onClick={() => setOrderType(ot.type)}
                  className={`py-1.5 rounded-lg text-center transition-colors ${
                    orderType === ot.type
                      ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-sm'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  {ot.label}
                </button>
              ))}
            </div>

            {/* Table Selection for Dine-In */}
            {orderType === OrderType.DINE_IN && (
              <div className="flex items-center justify-between bg-brand-50 dark:bg-brand-950/40 border border-brand-200/80 dark:border-brand-900 rounded-xl px-3 py-1.5 text-xs">
                <div className="flex items-center space-x-1.5">
                  <span className={`w-2.5 h-2.5 rounded-full ${selectedTable ? 'bg-amber-500' : 'bg-slate-400'}`} />
                  <span className="font-bold text-brand-800 dark:text-brand-300">
                    {selectedTable ? `Table: ${selectedTable.table_number}` : 'Select Table for Dine-In'}
                  </span>
                </div>
                <button
                  onClick={() => setIsTableModalOpen(true)}
                  className="text-brand-600 dark:text-brand-400 font-bold hover:underline"
                >
                  {selectedTable ? 'Change Table' : 'Select Table →'}
                </button>
              </div>
            )}
          </div>

          {/* Cart Items List */}
          <div className="flex-1 p-3.5 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800 text-xs">
            {cartItems.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-400 dark:text-slate-500 space-y-2">
                <ShoppingBag className="w-8 h-8 opacity-40" />
                <p>Cart is empty</p>
                <p className="text-[11px] text-slate-400">Tap items on the left to take customer order</p>
              </div>
            ) : (
              cartItems.map((item, idx) => (
                <div key={idx} className="py-2.5 flex items-center justify-between">
                  <div className="flex-1 pr-2">
                    <p className="font-bold text-slate-800 dark:text-slate-200 truncate">{item.productName}</p>
                    <p className="text-[11px] text-slate-400">
                      {currencySymbol} {item.unitPrice.toLocaleString()} each
                    </p>
                  </div>

                  {/* Quantity Controls */}
                  <div className="flex items-center space-x-1.5">
                    <button
                      onClick={() => updateQuantity(idx, -1)}
                      className="w-6 h-6 rounded bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 flex items-center justify-center font-bold text-slate-600 dark:text-slate-300"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    <span className="font-extrabold text-xs w-6 text-center text-slate-900 dark:text-white">{item.quantity}</span>
                    <button
                      onClick={() => updateQuantity(idx, 1)}
                      className="w-6 h-6 rounded bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 flex items-center justify-center font-bold text-slate-600 dark:text-slate-300"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>

                  {/* Item Total */}
                  <div className="text-right w-20 pl-2">
                    <p className="font-extrabold text-slate-900 dark:text-white">
                      {currencySymbol} {(item.unitPrice * item.quantity).toLocaleString()}
                    </p>
                    <button
                      onClick={() => removeItem(idx)}
                      className="text-[10px] text-rose-500 hover:text-rose-700 font-semibold"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Cart Bottom Summary & Actions */}
          <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 border-t border-slate-200 dark:border-slate-800 space-y-2 text-xs">
            <div className="space-y-1">
              <div className="flex justify-between text-slate-500 dark:text-slate-400">
                <span>Subtotal</span>
                <span>{currencySymbol} {cartSubtotal.toLocaleString()}</span>
              </div>
              {effectiveBillDiscount > 0 && (
                <div className="flex justify-between text-rose-600">
                  <span>Discount</span>
                  <span>-{currencySymbol} {effectiveBillDiscount.toLocaleString()}</span>
                </div>
              )}
              <div className="flex justify-between text-slate-500 dark:text-slate-400">
                <span>Sales Tax ({taxRate}%{isTaxInclusive ? ' incl.' : ''})</span>
                <span>{currencySymbol} {Math.round(calculatedTax).toLocaleString()}</span>
              </div>
              {calculatedServiceCharge > 0 && (
                <div className="flex justify-between text-slate-500 dark:text-slate-400">
                  <span>Service Charge ({serviceChargeRate}%)</span>
                  <span>{currencySymbol} {Math.round(calculatedServiceCharge).toLocaleString()}</span>
                </div>
              )}
              <div className="flex justify-between font-black text-slate-900 dark:text-white text-base pt-1 border-t border-slate-200 dark:border-slate-700">
                <span>Total Bill</span>
                <span className="text-brand-600 dark:text-brand-400">{currencySymbol} {grandTotal.toLocaleString()}</span>
              </div>
            </div>

            {/* Quick Actions (Hold, Clear) */}
            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                onClick={holdCurrentOrder}
                disabled={cartItems.length === 0}
                className="py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 disabled:opacity-50 transition-colors"
              >
                Hold Order
              </button>
              <button
                onClick={() => setCartItems([])}
                disabled={cartItems.length === 0}
                className="py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-bold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 disabled:opacity-50 transition-colors"
              >
                Clear Cart
              </button>
            </div>

            {/* ==================== WORKFLOW ACTION BUTTONS ==================== */}
            <div className="flex space-x-2 pt-1">
              {/* Button 1: Send to Kitchen / KOT (Waiter tablet mode) */}
              <button
                onClick={handleSendToKitchen}
                disabled={cartItems.length === 0 || isSubmittingKitchen}
                className="flex-1 flex items-center justify-center space-x-1.5 bg-brand-500 hover:bg-brand-600 text-white font-extrabold py-3 rounded-xl shadow-md text-xs transition-all disabled:opacity-50 active:scale-[0.98]"
              >
                <Flame className="w-4 h-4 text-amber-200" />
                <span>{isSubmittingKitchen ? 'Sending...' : 'Send to Kitchen (KOT)'}</span>
              </button>

              {/* Button 2: Direct Counter Pay */}
              <button
                onClick={openDirectCheckout}
                disabled={cartItems.length === 0}
                className="flex-1 flex items-center justify-center space-x-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold py-3 rounded-xl shadow-md text-xs transition-all disabled:opacity-50 active:scale-[0.98]"
              >
                <Banknote className="w-4 h-4 text-emerald-200" />
                <span>Pay & Complete</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ==================== MODAL: UNPAID & ACTIVE DINING ORDERS ==================== */}
      <Modal
        isOpen={isUnpaidModalOpen}
        onClose={() => setIsUnpaidModalOpen(false)}
        title="Unpaid & Dining Orders"
        maxWidth="2xl"
      >
        <div className="space-y-4 text-xs">
          {/* Filters bar */}
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
            <div className="flex space-x-2">
              <button
                onClick={() => setUnpaidFilter('ALL')}
                className={`px-3 py-1.5 rounded-xl font-bold transition-all ${
                  unpaidFilter === 'ALL'
                    ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-sm'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                }`}
              >
                All Unpaid ({unpaidOrders.length})
              </button>
              <button
                onClick={() => setUnpaidFilter('SERVED')}
                className={`flex items-center space-x-1 px-3 py-1.5 rounded-xl font-bold transition-all ${
                  unpaidFilter === 'SERVED'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800'
                }`}
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Food Served / Ready for Bill ({servedCount})</span>
              </button>
              <button
                onClick={() => setUnpaidFilter('PREPARING')}
                className={`px-3 py-1.5 rounded-xl font-bold transition-all ${
                  unpaidFilter === 'PREPARING'
                    ? 'bg-orange-600 text-white shadow-sm'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                }`}
              >
                In Kitchen ({unpaidOrders.length - servedCount})
              </button>
            </div>

            <button
              onClick={fetchUnpaidOrders}
              className="text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 text-xs font-semibold flex items-center space-x-1"
            >
              <span>Refresh</span>
            </button>
          </div>

          {/* Orders list */}
          <div className="max-h-[60vh] overflow-y-auto space-y-3">
            {filteredUnpaidOrders.length === 0 ? (
              <div className="py-12 text-center text-slate-400">
                <UtensilsCrossed className="w-8 h-8 mx-auto opacity-30 mb-2" />
                <p className="font-bold">No unpaid orders in this section.</p>
                <p className="text-[11px] text-slate-400">Orders placed by waiters will appear here until checkout is completed.</p>
              </div>
            ) : (
              filteredUnpaidOrders.map((ord) => {
                const isServed = ord.status === 'SERVED';
                return (
                  <div
                    key={ord.id}
                    className={`p-4 rounded-2xl border transition-all ${
                      isServed
                        ? 'bg-blue-50/60 dark:bg-blue-950/30 border-blue-300 dark:border-blue-800 ring-1 ring-blue-400/30'
                        : 'bg-white dark:bg-slate-800/60 border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-slate-200/80 dark:border-slate-700 pb-3 mb-3">
                      <div>
                        <div className="flex items-center space-x-2">
                          <span className="font-extrabold text-sm text-slate-900 dark:text-white">
                            {ord.table_number ? `Table: ${ord.table_number}` : ord.order_type}
                          </span>
                          <span className="font-mono text-xs text-brand-600 dark:text-brand-400 font-bold">
                            #{ord.order_number}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">
                          Waiter/Staff: {ord.cashier_name} • Floor: {ord.floor_name || 'Main Dining'}
                        </p>
                      </div>

                      <div className="flex items-center space-x-2">
                        <span
                          className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                            isServed
                              ? 'bg-blue-600 text-white shadow-sm'
                              : ord.status === 'READY'
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                              : 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                          }`}
                        >
                          {isServed ? '🍽️ SERVED - AWAITING PAYMENT' : ord.status}
                        </span>

                        <span className="text-sm font-black text-slate-900 dark:text-white pl-2">
                          {currencySymbol} {Number(ord.grand_total).toLocaleString()}
                        </span>
                      </div>
                    </div>

                    {/* Items summary */}
                    <div className="text-slate-600 dark:text-slate-300 text-[11px] space-y-1 mb-3">
                      {ord.items?.map((it: any) => (
                        <div key={it.id} className="flex justify-between">
                          <span>{it.quantity}x {it.product_name}</span>
                          <span className="font-semibold">{currencySymbol} {Number(it.total_price).toLocaleString()}</span>
                        </div>
                      ))}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                      <button
                        onClick={async () => {
                          const receiptRes = await api.get(`/orders/${ord.id}/receipt`);
                          setCompletedReceipt(receiptRes.receipt);
                        }}
                        className="flex items-center space-x-1 px-3 py-1.5 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 text-slate-700 dark:text-slate-200 rounded-lg font-bold text-xs"
                      >
                        <Printer className="w-3.5 h-3.5" />
                        <span>Print Bill</span>
                      </button>

                      <button
                        onClick={() => openCheckoutForUnpaidOrder(ord)}
                        className="flex items-center space-x-1 px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold rounded-lg text-xs shadow-md"
                      >
                        <Banknote className="w-3.5 h-3.5" />
                        <span>Take Payment / Complete Order →</span>
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </Modal>

      {/* Modal: Open Shift */}
      <Modal isOpen={isOpenShiftModalOpen} onClose={() => setIsOpenShiftModalOpen(false)} title="Open Register Shift" maxWidth="sm">
        <form onSubmit={handleOpenShift} className="space-y-4 text-xs">
          <p className="text-slate-500 dark:text-slate-400">
            Enter the starting cash amount in the cash drawer to open your cashier shift.
          </p>
          <div>
            <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Opening Cash ({currency})</label>
            <input
              type="number"
              min="0"
              required
              value={openingCashInput}
              onChange={(e) => setOpeningCashInput(parseFloat(e.target.value) || 0)}
              className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm font-bold text-slate-900 dark:text-white"
            />
          </div>
          <button
            type="submit"
            className="w-full bg-brand-500 hover:bg-brand-600 text-white font-bold py-2.5 rounded-lg shadow-md"
          >
            Confirm & Open Shift
          </button>
        </form>
      </Modal>

      {/* Modal: Table Selection for Dine-In */}
      <Modal isOpen={isTableModalOpen} onClose={() => setIsTableModalOpen(false)} title="Select Dining Table" maxWidth="lg">
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-3 text-xs">
          {tables.map((t) => {
            const isAvail = t.status === 'AVAILABLE';
            const isOccupied = t.status === 'OCCUPIED';
            return (
              <button
                key={t.id}
                onClick={() => {
                  setSelectedTable(t);
                  setIsTableModalOpen(false);
                }}
                className={`p-3 rounded-xl border flex flex-col items-center justify-center transition-all ${
                  isAvail
                    ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200 hover:border-emerald-500'
                    : isOccupied
                    ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200'
                    : 'bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800 text-blue-900 dark:text-blue-200'
                }`}
              >
                <span className="font-extrabold text-sm">{t.table_number}</span>
                <span className="text-[10px] mt-1">{t.floor_name} • {t.capacity} Seats</span>
                <span className="text-[9px] font-bold uppercase mt-1 px-1.5 py-0.5 rounded bg-white/80 dark:bg-slate-800">
                  {t.status}
                </span>
              </button>
            );
          })}
        </div>
      </Modal>

      {/* Modal: Checkout / Fast Payment */}
      <Modal
        isOpen={isCheckoutOpen}
        onClose={() => {
          setIsCheckoutOpen(false);
          setActiveCheckoutOrder(null);
        }}
        title={activeCheckoutOrder ? `Settle Bill: Order #${activeCheckoutOrder.order_number}` : 'Fast Order Checkout'}
        maxWidth="md"
      >
        <div className="space-y-4 text-xs">
          {/* Total display */}
          <div className="bg-slate-900 text-white p-4 rounded-xl text-center">
            <p className="text-slate-400 text-xs">Total Amount Due</p>
            <p className="text-3xl font-black mt-1 text-emerald-400">
              {currencySymbol} {activeCheckoutOrder ? Number(activeCheckoutOrder.grand_total).toLocaleString() : grandTotal.toLocaleString()}
            </p>
            {activeCheckoutOrder && (
              <p className="text-[11px] text-slate-300 mt-1">
                Table: {activeCheckoutOrder.table_number || 'Takeaway'} • {activeCheckoutOrder.customer_name || 'Customer'}
              </p>
            )}
          </div>

          {/* Payment Method Selector */}
          <div>
            <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1.5">Payment Method</label>
            <div className="grid grid-cols-4 gap-2">
              {[
                { method: PaymentMethod.CASH, label: 'Cash', icon: Banknote },
                { method: PaymentMethod.CARD, label: 'Card', icon: CreditCard },
                { method: PaymentMethod.DIGITAL_WALLET, label: 'Wallet', icon: Smartphone },
                { method: PaymentMethod.BANK_TRANSFER, label: 'Bank', icon: Banknote },
              ].map((m) => {
                const Icon = m.icon;
                const isSelected = activePaymentMethod === m.method;
                const totalDue = activeCheckoutOrder ? Number(activeCheckoutOrder.grand_total) : grandTotal;
                return (
                  <button
                    key={m.method}
                    onClick={() => {
                      setActivePaymentMethod(m.method);
                      setPayments([{ method: m.method, amount: totalDue }]);
                      setCashTendered(totalDue);
                    }}
                    className={`p-2.5 rounded-xl border flex flex-col items-center justify-center font-bold transition-all ${
                      isSelected
                        ? 'border-brand-500 bg-brand-50 dark:bg-brand-950/40 text-brand-700 dark:text-brand-300 shadow-sm'
                        : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300'
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
            <div className="space-y-2 bg-slate-50 dark:bg-slate-800/60 p-3 rounded-xl border border-slate-200 dark:border-slate-700">
              <label className="block font-bold text-slate-700 dark:text-slate-300">Cash Received ({currency})</label>
              <input
                type="number"
                min={activeCheckoutOrder ? Number(activeCheckoutOrder.grand_total) : grandTotal}
                value={cashTendered}
                onChange={(e) => setCashTendered(parseFloat(e.target.value) || 0)}
                className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-base font-bold text-slate-900 dark:text-white"
              />

              {/* Quick Pakistani Rupee buttons */}
              <div className="flex space-x-2 pt-1">
                {[500, 1000, 5000].map((denom) => (
                  <button
                    key={denom}
                    type="button"
                    onClick={() => setCashTendered(denom)}
                    className="flex-1 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100"
                  >
                    +{denom}
                  </button>
                ))}
              </div>

              {/* Change to return */}
              <div className="flex justify-between items-center pt-2 font-bold text-slate-800 dark:text-slate-200">
                <span>Change to Return:</span>
                <span className="text-base text-emerald-600 dark:text-emerald-400">
                  {currencySymbol} {Math.max(0, cashTendered - (activeCheckoutOrder ? Number(activeCheckoutOrder.grand_total) : grandTotal)).toLocaleString()}
                </span>
              </div>
            </div>
          )}

          {/* Complete Button */}
          <button
            onClick={handleCheckoutSubmit}
            disabled={
              isSubmittingCheckout ||
              (activePaymentMethod === PaymentMethod.CASH &&
                cashTendered < (activeCheckoutOrder ? Number(activeCheckoutOrder.grand_total) : grandTotal))
            }
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold py-3 rounded-xl text-sm shadow-md transition-all disabled:opacity-50"
          >
            {isSubmittingCheckout ? 'Processing Payment...' : 'Complete Payment & Print Receipt'}
          </button>
        </div>
      </Modal>

      {/* Modal: Held Orders */}
      <Modal isOpen={isHeldOrdersModalOpen} onClose={() => setIsHeldOrdersModalOpen(false)} title="Held Orders" maxWidth="md">
        <div className="space-y-2 text-xs">
          {heldOrders.map((h) => (
            <div key={h.id} className="p-3 border border-slate-200 dark:border-slate-700 rounded-xl flex items-center justify-between bg-slate-50 dark:bg-slate-800">
              <div>
                <p className="font-bold text-slate-900 dark:text-white">{h.orderType} • {h.time}</p>
                <p className="text-slate-500 dark:text-slate-400">{h.cartItems.length} item(s)</p>
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
      {/* Modal: Item Cooking Note & Instructions */}
      <Modal
        isOpen={noteItemIndex !== null}
        onClose={() => setNoteItemIndex(null)}
        title="Item Cooking Note & Instructions"
        maxWidth="sm"
      >
        <div className="space-y-3 text-xs">
          <p className="text-slate-500 dark:text-slate-400">
            Select standard cooking instructions or enter special preparation instructions for the kitchen:
          </p>

          <div className="flex flex-wrap gap-1.5">
            {['🌶️ Less Spicy', '🔥 Extra Spicy', '🧅 No Onions', '🧀 Extra Cheese', '🥩 Well Done', '🥡 Pack Separately', 'Urgent Rush'].map((chip) => (
              <button
                key={chip}
                type="button"
                onClick={() => setItemNoteText(chip)}
                className="px-2.5 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-amber-100 dark:hover:bg-amber-950/40 hover:text-amber-800 dark:hover:text-amber-300 rounded-lg font-medium text-[11px] transition-colors border border-slate-200 dark:border-slate-700"
              >
                {chip}
              </button>
            ))}
          </div>

          <div>
            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Custom Instruction</label>
            <input
              type="text"
              value={itemNoteText}
              onChange={(e) => setItemNoteText(e.target.value)}
              placeholder="e.g. Mild gravy, serve with extra spoons"
              className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-white"
            />
          </div>

          <div className="flex justify-end space-x-2 pt-2">
            <button
              type="button"
              onClick={() => {
                if (noteItemIndex !== null) {
                  const updated = [...cartItems];
                  updated[noteItemIndex].notes = '';
                  setCartItems(updated);
                }
                setNoteItemIndex(null);
              }}
              className="px-3 py-1.5 text-slate-500 hover:text-rose-500 font-semibold"
            >
              Clear
            </button>
            <button
              type="button"
              onClick={() => {
                if (noteItemIndex !== null) {
                  const updated = [...cartItems];
                  updated[noteItemIndex].notes = itemNoteText.trim();
                  setCartItems(updated);
                }
                setNoteItemIndex(null);
              }}
              className="px-4 py-1.5 bg-brand-500 hover:bg-brand-600 text-white font-bold rounded-lg shadow-sm"
            >
              Save Note
            </button>
          </div>
        </div>
      </Modal>

      {/* Modal: Transfer Table */}
      <Modal
        isOpen={isTransferModalOpen}
        onClose={() => setIsTransferModalOpen(false)}
        title="Transfer Table"
        maxWidth="md"
      >
        <div className="space-y-4 text-xs">
          <div className="p-3 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900 rounded-xl">
            <p className="font-bold text-blue-900 dark:text-blue-200">
              Transfer Order #{orderToTransfer?.order_number}
            </p>
            <p className="text-blue-700 dark:text-blue-300 text-[11px] mt-0.5">
              Current Table: <strong>{orderToTransfer?.table_number || 'None'}</strong> • Grand Total: {currencySymbol} {Number(orderToTransfer?.grand_total || 0).toLocaleString()}
            </p>
          </div>

          <div>
            <label className="block font-bold text-slate-700 dark:text-slate-300 mb-2">
              Select Destination Dining Table:
            </label>
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5 max-h-56 overflow-y-auto p-1">
              {tables
                .filter((t) => t.id !== orderToTransfer?.table_id)
                .map((t) => {
                  const isAvailable = t.status === 'AVAILABLE';
                  const isSelected = targetTableId === t.id;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      disabled={!isAvailable}
                      onClick={() => setTargetTableId(t.id)}
                      className={`p-3 rounded-xl border text-center transition-all ${
                        isSelected
                          ? 'bg-blue-600 text-white border-blue-600 ring-2 ring-blue-400/50 shadow-md'
                          : isAvailable
                          ? 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-blue-400 text-slate-800 dark:text-slate-200'
                          : 'bg-slate-100 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-400 opacity-50 cursor-not-allowed'
                      }`}
                    >
                      <p className="font-black text-sm">{t.table_number}</p>
                      <p className="text-[10px] mt-0.5 opacity-80">{t.capacity} seats</p>
                      <span className={`inline-block mt-1 text-[9px] px-1 rounded uppercase font-bold ${
                        isAvailable ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'
                      }`}>
                        {t.status}
                      </span>
                    </button>
                  );
                })}
            </div>
          </div>

          <div className="flex justify-end space-x-2 pt-3 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setIsTransferModalOpen(false)}
              className="px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-600 dark:text-slate-400"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleTransferTable}
              disabled={!targetTableId}
              className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg shadow-md transition-all disabled:opacity-40"
            >
              Move Order to Selected Table
            </button>
          </div>
        </div>
      </Modal>
      <ReceiptModal
        isOpen={!!completedReceipt}
        onClose={() => setCompletedReceipt(null)}
        receiptData={completedReceipt}
      />
    </div>
  );
};