import React, { useState, useEffect } from 'react';
import { api } from '../../api/client.js';
import { useAuth } from '../../context/AuthContext.js';
import { useToast } from '../../context/ToastContext.js';
import { Modal } from './Modal.js';
import {
  DollarSign,
  CreditCard,
  RotateCcw,
  Calendar,
  FileText,
  Truck,
  PlusCircle,
  Coins,
  Users,
  Building,
  Sparkles,
  ToggleLeft,
  ToggleRight,
  ClipboardList,
  Undo2,
  CheckCircle2,
  Printer,
  Download,
  AlertCircle,
  Search,
  Package,
} from 'lucide-react';

export type QuickActionType =
  | 'PAYMENT_IN'
  | 'PAYMENT_OUT'
  | 'SALE_RETURN'
  | 'ADVANCE_ORDER'
  | 'ESTIMATE_QUOTATION'
  | 'DELIVERY_CHALLAN'
  | 'RECORD_EXPENSE'
  | 'CASH_MOVEMENT'
  | 'ADD_CUSTOMER'
  | 'ADD_SUPPLIER'
  | 'CREATE_DEAL'
  | 'MENU_AVAILABILITY'
  | 'PURCHASE_ORDER'
  | 'PURCHASE_RETURN'
  | null;

interface QuickActionModalsProps {
  activeModal: QuickActionType;
  onClose: () => void;
  onSuccess?: () => void;
}

export const QuickActionModals: React.FC<QuickActionModalsProps> = ({
  activeModal,
  onClose,
  onSuccess,
}) => {
  const { tenant, branches, currentBranchId } = useAuth();
  const { success, error } = useToast();
  const currencySymbol = tenant?.currency_symbol || 'Rs.';
  const branchId = currentBranchId || (branches.length > 0 ? branches[0].id : '');

  // Common shared state
  const [customers, setCustomers] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [expenseCategories, setExpenseCategories] = useState<any[]>([]);
  const [bankAccounts, setBankAccounts] = useState<any[]>([]);
  const [submitting, setSubmitting] = useState(false);

  // Form states
  // 1. Payment-In
  const [paymentInCustomer, setPaymentInCustomer] = useState('');
  const [paymentInAmount, setPaymentInAmount] = useState<number | ''>('');
  const [paymentInMethod, setPaymentInMethod] = useState('CASH');
  const [paymentInRef, setPaymentInRef] = useState('');
  const [paymentInNotes, setPaymentInNotes] = useState('');

  // 2. Payment-Out
  const [paymentOutSupplier, setPaymentOutSupplier] = useState('');
  const [paymentOutAmount, setPaymentOutAmount] = useState<number | ''>('');
  const [paymentOutMethod, setPaymentOutMethod] = useState('CASH');
  const [paymentOutBank, setPaymentOutBank] = useState('');
  const [paymentOutNotes, setPaymentOutNotes] = useState('');

  // 3. Sale Return / Refund
  const [returnOrderNumber, setReturnOrderNumber] = useState('');
  const [foundOrder, setFoundOrder] = useState<any>(null);
  const [selectedReturnItem, setSelectedReturnItem] = useState('');
  const [returnQuantity, setReturnQuantity] = useState(1);
  const [returnReason, setReturnReason] = useState('Customer unsatisfied / item returned');
  const [returnRefundMethod, setReturnRefundMethod] = useState('CASH');

  // 4. Advance / Sale Order
  const [advanceCustomerName, setAdvanceCustomerName] = useState('');
  const [advanceCustomerPhone, setAdvanceCustomerPhone] = useState('');
  const [advanceScheduledDate, setAdvanceScheduledDate] = useState(
    new Date(Date.now() + 86400000).toISOString().split('T')[0]
  );
  const [advanceScheduledTime, setAdvanceScheduledTime] = useState('18:00');
  const [advanceOrderType, setAdvanceOrderType] = useState('TAKEAWAY');
  const [advanceDepositPaid, setAdvanceDepositPaid] = useState<number | ''>(500);
  const [advanceEstimatedTotal, setAdvanceEstimatedTotal] = useState<number | ''>(2500);
  const [advanceNotes, setAdvanceNotes] = useState('Advance catering / scheduled food order');

  // 5. Estimate / Quotation
  const [quoteCustomerName, setQuoteCustomerName] = useState('');
  const [quoteCustomerPhone, setQuoteCustomerPhone] = useState('');
  const [quoteEventDate, setQuoteEventDate] = useState(
    new Date(Date.now() + 86400000 * 3).toISOString().split('T')[0]
  );
  const [quoteGuestCount, setQuoteGuestCount] = useState<number | ''>(50);
  const [quoteEstimatedAmount, setQuoteEstimatedAmount] = useState<number | ''>(45000);
  const [quoteDescription, setQuoteDescription] = useState('Catering menu package for private function');
  const [quoteTerms, setQuoteTerms] = useState('50% advance required upon booking. Valid for 7 days.');
  const [quoteGenerated, setQuoteGenerated] = useState<any>(null);

  // 6. Delivery Challan
  const [challanOrderNumber, setChallanOrderNumber] = useState('');
  const [challanCustomerName, setChallanCustomerName] = useState('');
  const [challanAddress, setChallanAddress] = useState('');
  const [challanRiderName, setChallanRiderName] = useState('');
  const [challanRiderPhone, setChallanRiderPhone] = useState('');
  const [challanVehicleNo, setChallanVehicleNo] = useState('');
  const [challanItemDescription, setChallanItemDescription] = useState('Food order package (thermal sealed)');
  const [challanGenerated, setChallanGenerated] = useState<any>(null);

  // 7. Record Expense
  const [expenseTitle, setExpenseTitle] = useState('');
  const [expenseCategoryId, setExpenseCategoryId] = useState('');
  const [expenseAmount, setExpenseAmount] = useState<number | ''>('');
  const [expenseMethod, setExpenseMethod] = useState('CASH');
  const [expenseBankId, setExpenseBankId] = useState('');
  const [expensePaidTo, setExpensePaidTo] = useState('');
  const [expenseDesc, setExpenseDesc] = useState('');
  const [expenseDate, setExpenseDate] = useState(new Date().toISOString().split('T')[0]);

  // 8. Cash Movement
  const [movementType, setMovementType] = useState<'CASH_IN' | 'CASH_OUT'>('CASH_IN');
  const [movementAmount, setMovementAmount] = useState<number | ''>('');
  const [movementReason, setMovementReason] = useState('Drawer float replenishment');

  // 9. Add Customer
  const [custName, setCustName] = useState('');
  const [custPhone, setCustPhone] = useState('');
  const [custEmail, setCustEmail] = useState('');
  const [custAddress, setCustAddress] = useState('');
  const [custCreditLimit, setCustCreditLimit] = useState<number | ''>(0);

  // 10. Add Supplier
  const [suppName, setSuppName] = useState('');
  const [suppContact, setSuppContact] = useState('');
  const [suppPhone, setSuppPhone] = useState('');
  const [suppEmail, setSuppEmail] = useState('');
  const [suppAddress, setSuppAddress] = useState('');

  // 11. Create Deal / Combo
  const [dealName, setDealName] = useState('');
  const [dealPrice, setDealPrice] = useState<number | ''>(999);
  const [dealDescription, setDealDescription] = useState('');
  const [dealItems, setDealItems] = useState<Array<{ productId: string; quantity: number }>>([]);

  // 12. Purchase Return
  const [returnSupplierId, setReturnSupplierId] = useState('');
  const [returnIngredientId, setReturnIngredientId] = useState('');
  const [returnQty, setReturnQty] = useState<number | ''>(1);
  const [returnPrice, setReturnPrice] = useState<number | ''>('');
  const [returnInvoiceNo, setReturnInvoiceNo] = useState('');
  const [returnNotes, setReturnNotes] = useState('Damaged or excess stock returned to vendor');
  const [ingredients, setIngredients] = useState<any[]>([]);

  // Load referenced options when modal opens
  useEffect(() => {
    if (!activeModal) return;

    const loadData = async () => {
      try {
        if (
          activeModal === 'PAYMENT_IN' ||
          activeModal === 'ADVANCE_ORDER' ||
          activeModal === 'ESTIMATE_QUOTATION' ||
          activeModal === 'DELIVERY_CHALLAN'
        ) {
          const res = await api.get('/customers');
          setCustomers(res.customers || []);
        }
        if (activeModal === 'PAYMENT_OUT' || activeModal === 'PURCHASE_ORDER' || activeModal === 'PURCHASE_RETURN') {
          const [sRes, iRes] = await Promise.all([
            api.get('/inventory/suppliers'),
            api.get('/inventory/ingredients'),
          ]);
          setSuppliers(sRes.suppliers || []);
          setIngredients(iRes.ingredients || []);
          if (sRes.suppliers?.length > 0 && !returnSupplierId) {
            setReturnSupplierId(sRes.suppliers[0].id);
          }
          if (iRes.ingredients?.length > 0 && !returnIngredientId) {
            setReturnIngredientId(iRes.ingredients[0].id);
          }
        }
        if (activeModal === 'CREATE_DEAL' || activeModal === 'MENU_AVAILABILITY') {
          const res = await api.get('/menu/products');
          setProducts(res.products || []);
        }
        if (activeModal === 'RECORD_EXPENSE') {
          const [catRes, bankRes] = await Promise.all([
            api.get('/financial/expenses/categories'),
            api.get('/financial/bank-accounts'),
          ]);
          setExpenseCategories(catRes.categories || []);
          setBankAccounts(bankRes.accounts || []);
          if (catRes.categories?.length > 0 && !expenseCategoryId) {
            setExpenseCategoryId(catRes.categories[0].id);
          }
        }
        if (activeModal === 'PAYMENT_OUT') {
          const bankRes = await api.get('/financial/bank-accounts');
          setBankAccounts(bankRes.accounts || []);
        }
      } catch (err) {
        console.error('Failed to load modal reference data:', err);
      }
    };

    loadData();
  }, [activeModal]);

  // Reset state on close
  const handleClose = () => {
    setFoundOrder(null);
    setQuoteGenerated(null);
    setChallanGenerated(null);
    onClose();
  };

  // Submit Handlers
  const handlePaymentInSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentInCustomer || !paymentInAmount || Number(paymentInAmount) <= 0) {
      error('Please select a customer and enter a valid payment amount.');
      return;
    }
    setSubmitting(true);
    try {
      await api.post(`/customers/${paymentInCustomer}/payment`, {
        amount: Number(paymentInAmount),
        paymentMethod: paymentInMethod,
        reference: paymentInRef,
        notes: paymentInNotes,
      });
      success(`Payment-In of ${currencySymbol} ${Number(paymentInAmount).toLocaleString()} recorded successfully!`);
      handleClose();
      onSuccess?.();
    } catch (err: any) {
      error(err.message || 'Failed to record customer payment');
    } finally {
      setSubmitting(false);
    }
  };

  const handlePaymentOutSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentOutSupplier || !paymentOutAmount || Number(paymentOutAmount) <= 0) {
      error('Please select a supplier and enter a valid payment amount.');
      return;
    }
    setSubmitting(true);
    try {
      await api.post(`/inventory/suppliers/${paymentOutSupplier}/payment`, {
        amount: Number(paymentOutAmount),
        paymentMethod: paymentOutMethod,
        bankAccountId: paymentOutBank || undefined,
        notes: paymentOutNotes,
      });
      success(`Payment-Out of ${currencySymbol} ${Number(paymentOutAmount).toLocaleString()} recorded successfully!`);
      handleClose();
      onSuccess?.();
    } catch (err: any) {
      error(err.message || 'Failed to record supplier payment');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSearchOrderForRefund = async () => {
    if (!returnOrderNumber.trim()) return;
    setSubmitting(true);
    try {
      const res = await api.get(`/orders?search=${encodeURIComponent(returnOrderNumber.trim())}`);
      const found = res.orders?.find(
        (o: any) => o.order_number.toLowerCase() === returnOrderNumber.trim().toLowerCase()
      );
      if (found) {
        // Fetch order details with items
        const detail = await api.get(`/orders/${found.id}`);
        setFoundOrder(detail.order || found);
        if (detail.order?.items?.length > 0) {
          setSelectedReturnItem(detail.order.items[0].id);
        }
      } else {
        error(`No order found matching "${returnOrderNumber}"`);
        setFoundOrder(null);
      }
    } catch (err: any) {
      error(err.message || 'Failed to search order');
    } finally {
      setSubmitting(false);
    }
  };

  const handleProcessRefundSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!foundOrder) return;
    setSubmitting(true);
    try {
      const selectedLine = foundOrder.items?.find((it: any) => it.id === selectedReturnItem);
      const refundAmt = selectedLine
        ? Number(selectedLine.unit_price || selectedLine.unitPrice) * returnQuantity
        : Number(foundOrder.grand_total || foundOrder.grandTotal);

      await api.post(`/orders/${foundOrder.id}/refund`, {
        amount: refundAmt,
        reason: returnReason,
        paymentMethod: returnRefundMethod,
        items: selectedLine
          ? [{ orderItemId: selectedLine.id, quantity: returnQuantity, restock: true }]
          : [],
      });
      success(`Refund of ${currencySymbol} ${refundAmt.toLocaleString()} processed successfully!`);
      handleClose();
      onSuccess?.();
    } catch (err: any) {
      error(err.message || 'Failed to process refund');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAdvanceOrderSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!advanceCustomerName || !advanceCustomerPhone) {
      error('Customer name and phone number are required.');
      return;
    }
    setSubmitting(true);
    try {
      // Find a placeholder product if available
      const prodsRes = await api.get('/menu/products');
      const sampleProd = prodsRes.products?.[0];
      if (!sampleProd) {
        error('Cannot create order without products in menu.');
        return;
      }

      const scheduledNote = `[ADVANCE / SALE ORDER - Scheduled: ${advanceScheduledDate} ${advanceScheduledTime}] Deposit Paid: ${currencySymbol} ${advanceDepositPaid || 0}. ${advanceNotes}`;

      await api.post('/orders', {
        branchId,
        orderType: advanceOrderType,
        customerName: advanceCustomerName,
        customerPhone: advanceCustomerPhone,
        orderNotes: scheduledNote,
        items: [
          {
            productId: sampleProd.id,
            quantity: 1,
            unitPrice: Number(advanceEstimatedTotal) || Number(sampleProd.base_price),
            notes: 'Advance booking package',
          },
        ],
      });

      success(`Advance Order for ${advanceCustomerName} created successfully!`);
      handleClose();
      onSuccess?.();
    } catch (err: any) {
      error(err.message || 'Failed to create advance order');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEstimateQuotationSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quoteCustomerName || !quoteCustomerPhone) {
      error('Customer details are required for quotation.');
      return;
    }
    const quotation = {
      quoteNumber: `EST-${Math.floor(100000 + Math.random() * 900000)}`,
      date: new Date().toLocaleDateString(),
      customerName: quoteCustomerName,
      customerPhone: quoteCustomerPhone,
      eventDate: quoteEventDate,
      guestCount: quoteGuestCount,
      estimatedAmount: Number(quoteEstimatedAmount) || 0,
      description: quoteDescription,
      terms: quoteTerms,
      branchName: branches.find((b) => b.id === branchId)?.name || 'Main Branch',
      currencySymbol,
    };
    setQuoteGenerated(quotation);
    success('Quotation generated successfully!');
  };

  const handleDeliveryChallanSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!challanCustomerName && !challanOrderNumber) {
      error('Order # or customer name is required.');
      return;
    }
    const challan = {
      challanNumber: `DC-${Math.floor(100000 + Math.random() * 900000)}`,
      date: new Date().toLocaleDateString(),
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      orderNumber: challanOrderNumber || 'Manual Delivery',
      customerName: challanCustomerName,
      deliveryAddress: challanAddress,
      riderName: challanRiderName || 'Store Dispatch Rider',
      riderPhone: challanRiderPhone || '-',
      vehicleNo: challanVehicleNo || 'Bike',
      itemDescription: challanItemDescription,
      branchName: branches.find((b) => b.id === branchId)?.name || 'Main Branch',
    };
    setChallanGenerated(challan);
    success('Delivery Challan generated successfully!');
  };

  const handleExpenseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!expenseAmount || Number(expenseAmount) <= 0 || !expenseCategoryId) {
      error('Please select category and enter expense amount.');
      return;
    }
    setSubmitting(true);
    try {
      await api.post('/financial/expenses', {
        categoryId: expenseCategoryId,
        title: expenseTitle || expenseDesc,
        amount: Number(expenseAmount),
        paymentMethod: expenseMethod,
        bankAccountId: expenseBankId || undefined,
        paidTo: expensePaidTo || undefined,
        description: expenseDesc || expenseTitle,
        notes: expenseDesc || undefined,
        expenseDate,
      });
      success(`Expense of ${currencySymbol} ${Number(expenseAmount).toLocaleString()} recorded successfully!`);
      handleClose();
      onSuccess?.();
    } catch (err: any) {
      error(err.message || 'Failed to record expense');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCashMovementSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!movementAmount || Number(movementAmount) <= 0) {
      error('Valid cash amount is required.');
      return;
    }
    setSubmitting(true);
    try {
      await api.post('/financial/shifts/cash-movement', {
        type: movementType,
        amount: Number(movementAmount),
        reason: movementReason,
      });
      success(`${movementType === 'CASH_IN' ? 'Cash In' : 'Cash Out'} of ${currencySymbol} ${Number(movementAmount).toLocaleString()} recorded!`);
      handleClose();
      onSuccess?.();
    } catch (err: any) {
      error(err.message || 'Failed to record cash movement (Register shift may not be open)');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddCustomerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!custName || !custPhone) {
      error('Customer Name and Phone number are required.');
      return;
    }
    setSubmitting(true);
    try {
      await api.post('/customers', {
        name: custName,
        phone: custPhone,
        email: custEmail || undefined,
        address: custAddress || undefined,
        creditLimit: Number(custCreditLimit) || 0,
      });
      success(`Customer "${custName}" created successfully!`);
      handleClose();
      onSuccess?.();
    } catch (err: any) {
      error(err.message || 'Failed to add customer');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddSupplierSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!suppName || !suppPhone) {
      error('Supplier Name and Phone number are required.');
      return;
    }
    setSubmitting(true);
    try {
      await api.post('/inventory/suppliers', {
        name: suppName,
        contactPerson: suppContact || undefined,
        phone: suppPhone,
        email: suppEmail || undefined,
        address: suppAddress || undefined,
      });
      success(`Supplier "${suppName}" created successfully!`);
      handleClose();
      onSuccess?.();
    } catch (err: any) {
      error(err.message || 'Failed to add supplier');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateDealSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dealName || !dealPrice || Number(dealPrice) <= 0) {
      error('Deal name and deal price are required.');
      return;
    }
    if (dealItems.length === 0) {
      error('Please select at least one bundled menu item for this deal.');
      return;
    }
    setSubmitting(true);
    try {
      // Find or create "Deals & Combos" category
      const catsRes = await api.get('/menu/categories');
      let dealCat = catsRes.categories?.find((c: any) => c.name.toLowerCase().includes('deal'));
      if (!dealCat) {
        const createCatRes = await api.post('/menu/categories', {
          name: 'Deals & Combos',
          sortOrder: 1,
        });
        dealCat = createCatRes.category;
      }

      await api.post('/menu/products', {
        name: dealName,
        categoryId: dealCat.id,
        basePrice: Number(dealPrice),
        description: dealDescription || `Combo Meal containing ${dealItems.length} bundled items.`,
        sku: `DEAL-${Math.floor(1000 + Math.random() * 9000)}`,
        station: 'KITCHEN',
        trackInventory: false,
      });

      success(`Deal / Combo "${dealName}" created and added to Menu Catalog!`);
      handleClose();
      onSuccess?.();
    } catch (err: any) {
      error(err.message || 'Failed to create deal');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleProductAvailability = async (product: any) => {
    try {
      const newStatus = !product.is_active;
      await api.put(`/menu/products/${product.id}`, {
        isActive: newStatus,
      });
      setProducts((prev) =>
        prev.map((p) => (p.id === product.id ? { ...p, is_active: newStatus } : p))
      );
      success(`${product.name} marked ${newStatus ? 'AVAILABLE' : 'OUT OF STOCK'}`);
    } catch (err: any) {
      error(err.message || 'Failed to toggle availability');
    }
  };

  const handlePurchaseReturnSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!returnSupplierId || !returnIngredientId || !returnQty) {
      error('Please select a supplier, ingredient, and enter quantity');
      return;
    }
    setSubmitting(true);
    try {
      await api.post('/inventory/purchases/return', {
        supplierId: returnSupplierId,
        branchId,
        invoiceNumber: returnInvoiceNo || undefined,
        items: [
          {
            ingredientId: returnIngredientId,
            quantity: Number(returnQty),
            returnPrice: Number(returnPrice) || 0,
          },
        ],
        reason: returnNotes || 'Purchase Return to vendor',
      });
      success('Purchase return recorded successfully! Stock and supplier balance updated.');
      handleClose();
      onSuccess?.();
    } catch (err: any) {
      error(err.message || 'Failed to process purchase return');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      {/* 1. PAYMENT-IN MODAL (Alt + I) */}
      {activeModal === 'PAYMENT_IN' && (
        <Modal isOpen={true} onClose={handleClose} title="Customer Payment-In (Alt + I)" maxWidth="lg">
          <form onSubmit={handlePaymentInSubmit} className="space-y-4 text-xs">
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                Select Customer *
              </label>
              <select
                value={paymentInCustomer}
                onChange={(e) => setPaymentInCustomer(e.target.value)}
                required
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 font-semibold"
              >
                <option value="">-- Select Customer --</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.phone}) - Outstanding Bal: {currencySymbol} {Number(c.outstanding_balance || 0).toLocaleString()}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Amount Received ({currencySymbol}) *
                </label>
                <input
                  type="number"
                  min="1"
                  step="0.01"
                  value={paymentInAmount}
                  onChange={(e) => setPaymentInAmount(e.target.value ? parseFloat(e.target.value) : '')}
                  required
                  placeholder="e.g. 1500"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 font-mono font-bold"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Payment Method
                </label>
                <select
                  value={paymentInMethod}
                  onChange={(e) => setPaymentInMethod(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 font-bold"
                >
                  <option value="CASH">Cash</option>
                  <option value="BANK_TRANSFER">Bank Transfer</option>
                  <option value="CARD">Debit / Credit Card</option>
                  <option value="ONLINE">Digital Wallet / EasyPaisa / JazzCash</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                Reference / Receipt # (Optional)
              </label>
              <input
                type="text"
                value={paymentInRef}
                onChange={(e) => setPaymentInRef(e.target.value)}
                placeholder="e.g. TRX-98421 or Bank Txn Ref"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 font-mono"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                Notes
              </label>
              <textarea
                value={paymentInNotes}
                onChange={(e) => setPaymentInNotes(e.target.value)}
                placeholder="Payment against outstanding bill balance..."
                rows={2}
                className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900"
              />
            </div>

            <div className="flex justify-end space-x-2 pt-3 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={handleClose}
                className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold text-xs"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md transition-all flex items-center space-x-1.5"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>{submitting ? 'Recording...' : 'Record Payment-In'}</span>
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* 2. PAYMENT-OUT MODAL (Alt + O) */}
      {activeModal === 'PAYMENT_OUT' && (
        <Modal isOpen={true} onClose={handleClose} title="Supplier Payment-Out (Alt + O)" maxWidth="lg">
          <form onSubmit={handlePaymentOutSubmit} className="space-y-4 text-xs">
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                Select Supplier *
              </label>
              <select
                value={paymentOutSupplier}
                onChange={(e) => setPaymentOutSupplier(e.target.value)}
                required
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 font-semibold"
              >
                <option value="">-- Select Supplier --</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.contact_person || s.phone}) - Balance Payable: {currencySymbol} {Number(s.balance_payable || 0).toLocaleString()}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Amount Paid ({currencySymbol}) *
                </label>
                <input
                  type="number"
                  min="1"
                  step="0.01"
                  value={paymentOutAmount}
                  onChange={(e) => setPaymentOutAmount(e.target.value ? parseFloat(e.target.value) : '')}
                  required
                  placeholder="e.g. 5000"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 font-mono font-bold"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Payment Method
                </label>
                <select
                  value={paymentOutMethod}
                  onChange={(e) => setPaymentOutMethod(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 font-bold"
                >
                  <option value="CASH">Cash Drawer</option>
                  <option value="BANK_TRANSFER">Bank Account</option>
                  <option value="CHEQUE">Cheque</option>
                </select>
              </div>
            </div>

            {paymentOutMethod === 'BANK_TRANSFER' && bankAccounts.length > 0 && (
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Deduct from Bank Account
                </label>
                <select
                  value={paymentOutBank}
                  onChange={(e) => setPaymentOutBank(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 font-semibold"
                >
                  <option value="">-- Select Bank Account --</option>
                  {bankAccounts.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.bank_name} ({b.account_number}) - Bal: {currencySymbol} {Number(b.current_balance).toLocaleString()}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                Notes / Reference
              </label>
              <textarea
                value={paymentOutNotes}
                onChange={(e) => setPaymentOutNotes(e.target.value)}
                placeholder="Payment against purchase invoice..."
                rows={2}
                className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900"
              />
            </div>

            <div className="flex justify-end space-x-2 pt-3 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={handleClose}
                className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold text-xs"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-md transition-all flex items-center space-x-1.5"
              >
                <CreditCard className="w-4 h-4" />
                <span>{submitting ? 'Recording...' : 'Record Payment-Out'}</span>
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* 3. SALE RETURN / REFUND MODAL (Alt + R) */}
      {activeModal === 'SALE_RETURN' && (
        <Modal isOpen={true} onClose={handleClose} title="Sale Return / Refund (Alt + R)" maxWidth="lg">
          <div className="space-y-4 text-xs">
            {/* Search Bill # */}
            <div className="flex items-center space-x-2">
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                <input
                  type="text"
                  value={returnOrderNumber}
                  onChange={(e) => setReturnOrderNumber(e.target.value)}
                  placeholder="Enter exact bill or order number (e.g. ORD-260309-001)"
                  className="w-full pl-9 pr-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 font-mono font-bold text-xs"
                />
              </div>
              <button
                type="button"
                onClick={handleSearchOrderForRefund}
                disabled={submitting}
                className="px-4 py-2.5 bg-brand-500 hover:bg-brand-600 text-white font-bold rounded-xl text-xs shrink-0"
              >
                Find Bill
              </button>
            </div>

            {foundOrder && (
              <form onSubmit={handleProcessRefundSubmit} className="space-y-4 pt-2 border-t border-slate-200 dark:border-slate-800">
                <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl space-y-1">
                  <div className="flex justify-between font-bold">
                    <span className="text-slate-900 dark:text-white">Order: #{foundOrder.order_number || foundOrder.orderNumber}</span>
                    <span className="text-emerald-600 dark:text-emerald-400 font-mono">
                      Grand Total: {currencySymbol} {Number(foundOrder.grand_total || foundOrder.grandTotal).toLocaleString()}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Customer: {foundOrder.customer_name || 'Walk-in'} • Channel: {foundOrder.order_type || foundOrder.orderType}
                  </p>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Select Item to Return / Refund
                  </label>
                  <select
                    value={selectedReturnItem}
                    onChange={(e) => setSelectedReturnItem(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 font-semibold"
                  >
                    <option value="">Full Bill Refund</option>
                    {foundOrder.items?.map((it: any) => (
                      <option key={it.id} value={it.id}>
                        {it.product_name || it.productName} ({it.quantity}x) - {currencySymbol} {Number(it.total_price || it.totalPrice).toLocaleString()}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Return Quantity
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="100"
                      value={returnQuantity}
                      onChange={(e) => setReturnQuantity(parseInt(e.target.value) || 1)}
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 font-bold"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Refund Method
                    </label>
                    <select
                      value={returnRefundMethod}
                      onChange={(e) => setReturnRefundMethod(e.target.value)}
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 font-bold"
                    >
                      <option value="CASH">Cash Refund</option>
                      <option value="STORE_CREDIT">Store Credit</option>
                      <option value="CARD_REVERSAL">Card Reversal</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Refund Reason
                  </label>
                  <input
                    type="text"
                    value={returnReason}
                    onChange={(e) => setReturnReason(e.target.value)}
                    required
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900"
                  />
                </div>

                <div className="flex justify-end space-x-2 pt-2">
                  <button
                    type="button"
                    onClick={handleClose}
                    className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold text-xs"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-md transition-all flex items-center space-x-1.5"
                  >
                    <RotateCcw className="w-4 h-4" />
                    <span>{submitting ? 'Processing...' : 'Process Refund'}</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        </Modal>
      )}

      {/* 4. SALE ORDER / ADVANCE ORDER (Alt + F) */}
      {activeModal === 'ADVANCE_ORDER' && (
        <Modal isOpen={true} onClose={handleClose} title="Create Advance / Sale Order (Alt + F)" maxWidth="lg">
          <form onSubmit={handleAdvanceOrderSubmit} className="space-y-4 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Customer Name *
                </label>
                <input
                  type="text"
                  value={advanceCustomerName}
                  onChange={(e) => setAdvanceCustomerName(e.target.value)}
                  required
                  placeholder="e.g. Tariq Mahmood"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 font-semibold"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Mobile / Phone *
                </label>
                <input
                  type="text"
                  value={advanceCustomerPhone}
                  onChange={(e) => setAdvanceCustomerPhone(e.target.value)}
                  required
                  placeholder="e.g. 0300-1234567"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Scheduled Date *
                </label>
                <input
                  type="date"
                  value={advanceScheduledDate}
                  onChange={(e) => setAdvanceScheduledDate(e.target.value)}
                  required
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Time *
                </label>
                <input
                  type="time"
                  value={advanceScheduledTime}
                  onChange={(e) => setAdvanceScheduledTime(e.target.value)}
                  required
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Order Channel
                </label>
                <select
                  value={advanceOrderType}
                  onChange={(e) => setAdvanceOrderType(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 font-bold"
                >
                  <option value="TAKEAWAY">Takeaway Pickup</option>
                  <option value="DELIVERY">Delivery Catering</option>
                  <option value="DINE_IN">Dine-In Hall Booking</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Advance Deposit Paid ({currencySymbol})
                </label>
                <input
                  type="number"
                  min="0"
                  value={advanceDepositPaid}
                  onChange={(e) => setAdvanceDepositPaid(e.target.value ? parseFloat(e.target.value) : '')}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 font-mono font-bold text-emerald-600"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Estimated Total ({currencySymbol})
                </label>
                <input
                  type="number"
                  min="0"
                  value={advanceEstimatedTotal}
                  onChange={(e) => setAdvanceEstimatedTotal(e.target.value ? parseFloat(e.target.value) : '')}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 font-mono font-bold"
                />
              </div>
            </div>

            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                Order Items / Catering Notes
              </label>
              <textarea
                value={advanceNotes}
                onChange={(e) => setAdvanceNotes(e.target.value)}
                rows={3}
                placeholder="List required dishes, party size, or specific dietary notes..."
                className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900"
              />
            </div>

            <div className="flex justify-end space-x-2 pt-2 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={handleClose}
                className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold text-xs"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-5 py-2 rounded-xl bg-brand-500 hover:bg-brand-600 text-white font-bold text-xs shadow-md transition-all flex items-center space-x-1.5"
              >
                <Calendar className="w-4 h-4" />
                <span>{submitting ? 'Creating...' : 'Create Advance Order'}</span>
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* 5. ESTIMATE / QUOTATION MODAL (Alt + M) */}
      {activeModal === 'ESTIMATE_QUOTATION' && (
        <Modal isOpen={true} onClose={handleClose} title="Create Estimate / Quotation (Alt + M)" maxWidth="lg">
          {!quoteGenerated ? (
            <form onSubmit={handleEstimateQuotationSubmit} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Customer / Organization *</label>
                  <input
                    type="text"
                    value={quoteCustomerName}
                    onChange={(e) => setQuoteCustomerName(e.target.value)}
                    required
                    placeholder="e.g. Lahore Tech Summit"
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 font-semibold"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Contact Phone *</label>
                  <input
                    type="text"
                    value={quoteCustomerPhone}
                    onChange={(e) => setQuoteCustomerPhone(e.target.value)}
                    required
                    placeholder="0300-1234567"
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Event Date</label>
                  <input
                    type="date"
                    value={quoteEventDate}
                    onChange={(e) => setQuoteEventDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Guests / Covers</label>
                  <input
                    type="number"
                    min="1"
                    value={quoteGuestCount}
                    onChange={(e) => setQuoteGuestCount(e.target.value ? parseInt(e.target.value) : '')}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 font-bold"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Quote Total ({currencySymbol})</label>
                  <input
                    type="number"
                    min="1"
                    value={quoteEstimatedAmount}
                    onChange={(e) => setQuoteEstimatedAmount(e.target.value ? parseFloat(e.target.value) : '')}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 font-mono font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Package Specification / Menu Details</label>
                <textarea
                  value={quoteDescription}
                  onChange={(e) => setQuoteDescription(e.target.value)}
                  rows={3}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Terms & Conditions</label>
                <input
                  type="text"
                  value={quoteTerms}
                  onChange={(e) => setQuoteTerms(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={handleClose}
                  className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-md transition-all flex items-center space-x-1.5"
                >
                  <FileText className="w-4 h-4" />
                  <span>Generate Quotation</span>
                </button>
              </div>
            </form>
          ) : (
            <div className="space-y-4 text-xs">
              <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-3">
                <div className="flex justify-between items-center border-b border-slate-200 dark:border-slate-700 pb-2">
                  <div>
                    <h3 className="font-extrabold text-sm text-slate-900 dark:text-white">{quoteGenerated.quoteNumber}</h3>
                    <span className="text-[10px] text-slate-400">Date: {quoteGenerated.date}</span>
                  </div>
                  <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                    Official Quotation
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-slate-700 dark:text-slate-300">
                  <p><strong>Customer:</strong> {quoteGenerated.customerName}</p>
                  <p><strong>Phone:</strong> {quoteGenerated.customerPhone}</p>
                  <p><strong>Event Date:</strong> {quoteGenerated.eventDate}</p>
                  <p><strong>Pax:</strong> {quoteGenerated.guestCount} guests</p>
                </div>
                <div className="p-3 bg-white dark:bg-slate-900 rounded-xl">
                  <p className="font-bold text-slate-900 dark:text-white">Menu & Package Details:</p>
                  <p className="text-slate-600 dark:text-slate-400 mt-1 whitespace-pre-wrap">{quoteGenerated.description}</p>
                </div>
                <div className="flex justify-between items-center font-extrabold text-sm border-t border-slate-200 dark:border-slate-700 pt-2 text-slate-900 dark:text-white">
                  <span>Total Estimated Quotation:</span>
                  <span className="font-mono text-indigo-600 dark:text-indigo-400">
                    {currencySymbol} {quoteGenerated.estimatedAmount.toLocaleString()}
                  </span>
                </div>
                <p className="text-[10px] text-slate-400 italic">Terms: {quoteGenerated.terms}</p>
              </div>

              <div className="flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 font-bold text-xs flex items-center space-x-1.5"
                >
                  <Printer className="w-4 h-4" />
                  <span>Print Quotation</span>
                </button>
                <button
                  type="button"
                  onClick={handleClose}
                  className="px-5 py-2 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold text-xs"
                >
                  Done
                </button>
              </div>
            </div>
          )}
        </Modal>
      )}

      {/* 6. DELIVERY CHALLAN MODAL (Alt + D) */}
      {activeModal === 'DELIVERY_CHALLAN' && (
        <Modal isOpen={true} onClose={handleClose} title="Generate Delivery Challan Slip (Alt + D)" maxWidth="lg">
          {!challanGenerated ? (
            <form onSubmit={handleDeliveryChallanSubmit} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Order # (Optional)</label>
                  <input
                    type="text"
                    value={challanOrderNumber}
                    onChange={(e) => setChallanOrderNumber(e.target.value)}
                    placeholder="e.g. ORD-260309-001"
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Customer / Recipient *</label>
                  <input
                    type="text"
                    value={challanCustomerName}
                    onChange={(e) => setChallanCustomerName(e.target.value)}
                    required
                    placeholder="Recipient Name"
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 font-semibold"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Delivery Address *</label>
                <input
                  type="text"
                  value={challanAddress}
                  onChange={(e) => setChallanAddress(e.target.value)}
                  required
                  placeholder="Complete street, house, and block address..."
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Rider / Driver Name</label>
                  <input
                    type="text"
                    value={challanRiderName}
                    onChange={(e) => setChallanRiderName(e.target.value)}
                    placeholder="e.g. Ali Raza"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Rider Phone</label>
                  <input
                    type="text"
                    value={challanRiderPhone}
                    onChange={(e) => setChallanRiderPhone(e.target.value)}
                    placeholder="0312-3456789"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 font-mono"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Vehicle / Reg #</label>
                  <input
                    type="text"
                    value={challanVehicleNo}
                    onChange={(e) => setChallanVehicleNo(e.target.value)}
                    placeholder="LE-21-987"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Items Description / Packages Dispatched</label>
                <textarea
                  value={challanItemDescription}
                  onChange={(e) => setChallanItemDescription(e.target.value)}
                  rows={2}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={handleClose}
                  className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-700 text-white font-bold text-xs shadow-md transition-all flex items-center space-x-1.5"
                >
                  <Truck className="w-4 h-4" />
                  <span>Generate Challan</span>
                </button>
              </div>
            </form>
          ) : (
            <div className="space-y-4 text-xs">
              <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-3">
                <div className="flex justify-between items-center border-b border-slate-200 dark:border-slate-700 pb-2">
                  <div>
                    <h3 className="font-extrabold text-sm text-slate-900 dark:text-white">{challanGenerated.challanNumber}</h3>
                    <span className="text-[10px] text-slate-400">Date: {challanGenerated.date} at {challanGenerated.time}</span>
                  </div>
                  <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-cyan-50 text-cyan-700 dark:bg-cyan-950/40 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-800">
                    Delivery Challan
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-slate-700 dark:text-slate-300">
                  <p><strong>Order Ref:</strong> {challanGenerated.orderNumber}</p>
                  <p><strong>Recipient:</strong> {challanGenerated.customerName}</p>
                  <p className="col-span-2"><strong>Address:</strong> {challanGenerated.deliveryAddress}</p>
                  <p><strong>Rider:</strong> {challanGenerated.riderName} ({challanGenerated.riderPhone})</p>
                  <p><strong>Vehicle:</strong> {challanGenerated.vehicleNo}</p>
                </div>
                <div className="p-3 bg-white dark:bg-slate-900 rounded-xl">
                  <p className="font-bold text-slate-900 dark:text-white">Goods Dispatched:</p>
                  <p className="text-slate-600 dark:text-slate-400 mt-1">{challanGenerated.itemDescription}</p>
                </div>
                <div className="pt-4 border-t border-dashed border-slate-200 dark:border-slate-700 flex justify-between text-[10px] text-slate-400">
                  <span>Dispatch Officer Signature: _________</span>
                  <span>Receiver Signature: _________</span>
                </div>
              </div>

              <div className="flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 font-bold text-xs flex items-center space-x-1.5"
                >
                  <Printer className="w-4 h-4" />
                  <span>Print Challan Slip</span>
                </button>
                <button
                  type="button"
                  onClick={handleClose}
                  className="px-5 py-2 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold text-xs"
                >
                  Done
                </button>
              </div>
            </div>
          )}
        </Modal>
      )}

      {/* 7. RECORD EXPENSE MODAL */}
      {activeModal === 'RECORD_EXPENSE' && (
        <Modal isOpen={true} onClose={handleClose} title="Record Operating Expense" maxWidth="md">
          <form onSubmit={handleExpenseSubmit} className="space-y-4 text-xs">
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Expense Title / Purpose *</label>
              <input
                type="text"
                value={expenseTitle}
                onChange={(e) => setExpenseTitle(e.target.value)}
                required
                placeholder="e.g. Staff Salary, Electricity Bill, Kitchen Crockery"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 font-bold"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Expense Category *</label>
                <select
                  value={expenseCategoryId}
                  onChange={(e) => setExpenseCategoryId(e.target.value)}
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 font-bold"
                >
                  <option value="">-- Select Category --</option>
                  {expenseCategories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Paid To / Payee</label>
                <input
                  type="text"
                  value={expensePaidTo}
                  onChange={(e) => setExpensePaidTo(e.target.value)}
                  placeholder="e.g. Chef Ali, Landlord, K-Electric"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Amount ({currencySymbol}) *</label>
                <input
                  type="number"
                  min="1"
                  step="0.01"
                  value={expenseAmount}
                  onChange={(e) => setExpenseAmount(e.target.value ? parseFloat(e.target.value) : '')}
                  required
                  placeholder="e.g. 2500"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 font-mono font-bold"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Payment Method</label>
                <select
                  value={expenseMethod}
                  onChange={(e) => setExpenseMethod(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 font-bold"
                >
                  <option value="CASH">Cash Drawer</option>
                  <option value="BANK_TRANSFER">Bank Account</option>
                  <option value="ONLINE">Digital Wallet</option>
                </select>
              </div>
            </div>

            {expenseMethod === 'BANK_TRANSFER' && bankAccounts.length > 0 && (
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Deduct from Bank</label>
                <select
                  value={expenseBankId}
                  onChange={(e) => setExpenseBankId(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900"
                >
                  <option value="">-- Select Account --</option>
                  {bankAccounts.map((b) => (
                    <option key={b.id} value={b.id}>{b.bank_name} ({b.account_number})</option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Description / Bill Memo *</label>
              <textarea
                value={expenseDesc}
                onChange={(e) => setExpenseDesc(e.target.value)}
                required
                rows={2}
                placeholder="Electricity bill, kitchen cleaning chemicals, staff lunch..."
                className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900"
              />
            </div>

            <div className="flex justify-end space-x-2 pt-2 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={handleClose}
                className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold text-xs"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-md transition-all flex items-center space-x-1.5"
              >
                <DollarSign className="w-4 h-4" />
                <span>{submitting ? 'Recording...' : 'Record Expense'}</span>
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* 8. CASH MOVEMENT MODAL (Cash In / Cash Out) */}
      {activeModal === 'CASH_MOVEMENT' && (
        <Modal isOpen={true} onClose={handleClose} title="Cash Register Movement (Cash In / Cash Out)" maxWidth="sm">
          <form onSubmit={handleCashMovementSubmit} className="space-y-4 text-xs">
            <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
              <button
                type="button"
                onClick={() => setMovementType('CASH_IN')}
                className={`py-2 rounded-lg font-bold transition-all ${
                  movementType === 'CASH_IN' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-600 dark:text-slate-300'
                }`}
              >
                + Cash In (Float)
              </button>
              <button
                type="button"
                onClick={() => setMovementType('CASH_OUT')}
                className={`py-2 rounded-lg font-bold transition-all ${
                  movementType === 'CASH_OUT' ? 'bg-rose-600 text-white shadow-sm' : 'text-slate-600 dark:text-slate-300'
                }`}
              >
                - Cash Out (Withdraw)
              </button>
            </div>

            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                Amount ({currencySymbol}) *
              </label>
              <input
                type="number"
                min="1"
                step="0.01"
                value={movementAmount}
                onChange={(e) => setMovementAmount(e.target.value ? parseFloat(e.target.value) : '')}
                required
                placeholder="e.g. 5000"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 font-mono font-bold"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                Reason / Description *
              </label>
              <input
                type="text"
                value={movementReason}
                onChange={(e) => setMovementReason(e.target.value)}
                required
                placeholder="Opening drawer cash, petty cash replenishment..."
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900"
              />
            </div>

            <div className="flex justify-end space-x-2 pt-2 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={handleClose}
                className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold text-xs"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className={`px-5 py-2 rounded-xl text-white font-bold text-xs shadow-md transition-all flex items-center space-x-1.5 ${
                  movementType === 'CASH_IN' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-rose-600 hover:bg-rose-700'
                }`}
              >
                <Coins className="w-4 h-4" />
                <span>{submitting ? 'Recording...' : movementType === 'CASH_IN' ? 'Record Cash In' : 'Record Cash Out'}</span>
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* 9. ADD CUSTOMER MODAL */}
      {activeModal === 'ADD_CUSTOMER' && (
        <Modal isOpen={true} onClose={handleClose} title="Add New Customer Profile" maxWidth="md">
          <form onSubmit={handleAddCustomerSubmit} className="space-y-4 text-xs">
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Customer Full Name *</label>
              <input
                type="text"
                value={custName}
                onChange={(e) => setCustName(e.target.value)}
                required
                placeholder="e.g. Tariq Mahmood"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 font-semibold"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Phone Number *</label>
                <input
                  type="text"
                  value={custPhone}
                  onChange={(e) => setCustPhone(e.target.value)}
                  required
                  placeholder="0300-1234567"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 font-mono"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Email (Optional)</label>
                <input
                  type="email"
                  value={custEmail}
                  onChange={(e) => setCustEmail(e.target.value)}
                  placeholder="customer@domain.com"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900"
                />
              </div>
            </div>

            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Delivery Address</label>
              <input
                type="text"
                value={custAddress}
                onChange={(e) => setCustAddress(e.target.value)}
                placeholder="House, street, block, sector..."
                className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Credit Limit ({currencySymbol})</label>
              <input
                type="number"
                min="0"
                value={custCreditLimit}
                onChange={(e) => setCustCreditLimit(e.target.value ? parseFloat(e.target.value) : '')}
                placeholder="0.00"
                className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 font-mono font-bold"
              />
            </div>

            <div className="flex justify-end space-x-2 pt-2 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={handleClose}
                className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold text-xs"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md transition-all flex items-center space-x-1.5"
              >
                <Users className="w-4 h-4" />
                <span>{submitting ? 'Saving...' : 'Save Customer'}</span>
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* 10. ADD SUPPLIER MODAL */}
      {activeModal === 'ADD_SUPPLIER' && (
        <Modal isOpen={true} onClose={handleClose} title="Add New Inventory Supplier" maxWidth="md">
          <form onSubmit={handleAddSupplierSubmit} className="space-y-4 text-xs">
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Company / Supplier Name *</label>
              <input
                type="text"
                value={suppName}
                onChange={(e) => setSuppName(e.target.value)}
                required
                placeholder="e.g. Metro Cash & Carry"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 font-semibold"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Contact Person</label>
                <input
                  type="text"
                  value={suppContact}
                  onChange={(e) => setSuppContact(e.target.value)}
                  placeholder="e.g. Asif Khan"
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Phone Number *</label>
                <input
                  type="text"
                  value={suppPhone}
                  onChange={(e) => setSuppPhone(e.target.value)}
                  required
                  placeholder="0321-7654321"
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 font-mono"
                />
              </div>
            </div>

            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Warehouse / Supply Address</label>
              <input
                type="text"
                value={suppAddress}
                onChange={(e) => setSuppAddress(e.target.value)}
                placeholder="Market address, wholesale area..."
                className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900"
              />
            </div>

            <div className="flex justify-end space-x-2 pt-2 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={handleClose}
                className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold text-xs"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-md transition-all flex items-center space-x-1.5"
              >
                <Building className="w-4 h-4" />
                <span>{submitting ? 'Saving...' : 'Save Supplier'}</span>
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* 11. CREATE DEAL / COMBO BUILDER MODAL */}
      {activeModal === 'CREATE_DEAL' && (
        <Modal isOpen={true} onClose={handleClose} title="Create Deal / Combo Meal" maxWidth="lg">
          <form onSubmit={handleCreateDealSubmit} className="space-y-4 text-xs">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Deal / Combo Name *</label>
                <input
                  type="text"
                  value={dealName}
                  onChange={(e) => setDealName(e.target.value)}
                  required
                  placeholder="e.g. Chicken Feast Deal"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 font-bold"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Combined Selling Price ({currencySymbol}) *</label>
                <input
                  type="number"
                  min="1"
                  step="0.01"
                  value={dealPrice}
                  onChange={(e) => setDealPrice(e.target.value ? parseFloat(e.target.value) : '')}
                  required
                  placeholder="e.g. 999"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 font-mono font-black text-brand-600"
                />
              </div>
            </div>

            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                Select Bundled Menu Items
              </label>
              <div className="border border-slate-200 dark:border-slate-800 rounded-xl p-3 max-h-48 overflow-y-auto space-y-2">
                {products.map((p) => {
                  const existing = dealItems.find((d) => d.productId === p.id);
                  return (
                    <div
                      key={p.id}
                      className="flex items-center justify-between p-2 rounded-lg bg-slate-50 dark:bg-slate-800/40 hover:bg-slate-100 dark:hover:bg-slate-800"
                    >
                      <div>
                        <span className="font-bold text-slate-900 dark:text-white block">{p.name}</span>
                        <span className="text-[10px] text-slate-400 font-mono">{currencySymbol} {Number(p.base_price).toLocaleString()}</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        {existing ? (
                          <div className="flex items-center space-x-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                if (existing.quantity <= 1) {
                                  setDealItems(dealItems.filter((d) => d.productId !== p.id));
                                } else {
                                  setDealItems(
                                    dealItems.map((d) => (d.productId === p.id ? { ...d, quantity: d.quantity - 1 } : d))
                                  );
                                }
                              }}
                              className="w-6 h-6 rounded-md bg-slate-200 dark:bg-slate-700 font-bold flex items-center justify-center text-slate-700 dark:text-slate-200"
                            >
                              -
                            </button>
                            <span className="w-6 text-center font-bold text-xs">{existing.quantity}</span>
                            <button
                              type="button"
                              onClick={() => {
                                setDealItems(
                                  dealItems.map((d) => (d.productId === p.id ? { ...d, quantity: d.quantity + 1 } : d))
                                );
                              }}
                              className="w-6 h-6 rounded-md bg-brand-500 font-bold flex items-center justify-center text-white"
                            >
                              +
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setDealItems([...dealItems, { productId: p.id, quantity: 1 }])}
                            className="px-2.5 py-1 rounded-md bg-slate-200 dark:bg-slate-700 hover:bg-brand-500 hover:text-white text-slate-700 dark:text-slate-300 font-bold text-[11px] transition-colors"
                          >
                            Add to Deal
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                Selected {dealItems.length} menu item(s) in this combo meal.
              </p>
            </div>

            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Deal Description & Terms</label>
              <input
                type="text"
                value={dealDescription}
                onChange={(e) => setDealDescription(e.target.value)}
                placeholder="Includes 2 Chicken Burgers, 1 Large Fries, and 2 Cold Drinks..."
                className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900"
              />
            </div>

            <div className="flex justify-end space-x-2 pt-2 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={handleClose}
                className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold text-xs"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-5 py-2 rounded-xl bg-brand-500 hover:bg-brand-600 text-white font-bold text-xs shadow-md transition-all flex items-center space-x-1.5"
              >
                <Sparkles className="w-4 h-4" />
                <span>{submitting ? 'Creating...' : 'Create Deal'}</span>
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* 12. MENU AVAILABILITY CHECKLIST MODAL */}
      {activeModal === 'MENU_AVAILABILITY' && (
        <Modal isOpen={true} onClose={handleClose} title="Quick Menu Availability Manager" maxWidth="md">
          <div className="space-y-4 text-xs">
            <p className="text-slate-500">
              Quickly toggle menu items as <strong>Available</strong> or <strong>Out of Stock</strong>. Changes update live in the POS terminal.
            </p>

            <div className="border border-slate-200 dark:border-slate-800 rounded-2xl p-2 max-h-80 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
              {products.map((p) => {
                const isAvail = p.is_active !== false;
                return (
                  <div key={p.id} className="flex items-center justify-between p-3 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                    <div>
                      <span className="font-bold text-slate-900 dark:text-white block">{p.name}</span>
                      <span className="text-[10px] text-slate-400 font-mono">{currencySymbol} {Number(p.base_price).toLocaleString()}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleToggleProductAvailability(p)}
                      className={`flex items-center space-x-1.5 px-3 py-1 rounded-full font-bold text-[11px] transition-all ${
                        isAvail
                          ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                          : 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
                      }`}
                    >
                      {isAvail ? <ToggleRight className="w-4 h-4 text-emerald-600" /> : <ToggleLeft className="w-4 h-4 text-rose-500" />}
                      <span>{isAvail ? 'Available' : 'Out of Stock'}</span>
                    </button>
                  </div>
                );
              })}
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={handleClose}
                className="px-5 py-2 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold text-xs"
              >
                Close
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* 13. PURCHASE RETURN MODAL (Alt + L) */}
      {activeModal === 'PURCHASE_RETURN' && (
        <Modal isOpen={true} onClose={handleClose} title="Purchase Return to Vendor (Debit Note - Alt + L)" maxWidth="lg">
          <form onSubmit={handlePurchaseReturnSubmit} className="space-y-4 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Supplier *
                </label>
                <select
                  value={returnSupplierId}
                  onChange={(e) => setReturnSupplierId(e.target.value)}
                  required
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 font-semibold"
                >
                  <option value="">-- Select Supplier --</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({currencySymbol} {Number(s.balance_payable || 0).toLocaleString()} payable)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Original Invoice / Bill # (Optional)
                </label>
                <input
                  type="text"
                  value={returnInvoiceNo}
                  onChange={(e) => setReturnInvoiceNo(e.target.value)}
                  placeholder="e.g. INV-10024"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-1">
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Item / Ingredient *
                </label>
                <select
                  value={returnIngredientId}
                  onChange={(e) => {
                    setReturnIngredientId(e.target.value);
                    const ing = ingredients.find((i) => i.id === e.target.value);
                    if (ing) setReturnPrice(Number(ing.cost_per_unit || ing.purchase_cost || 0));
                  }}
                  required
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 font-semibold"
                >
                  <option value="">-- Select Ingredient --</option>
                  {ingredients.map((ing) => (
                    <option key={ing.id} value={ing.id}>
                      {ing.name} ({ing.unit || ing.base_unit || 'G'})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Return Quantity *
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                  value={returnQty}
                  onChange={(e) => setReturnQty(e.target.value === '' ? '' : parseFloat(e.target.value))}
                  placeholder="1"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 font-mono font-bold"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Return Unit Price ({currencySymbol})
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={returnPrice}
                  onChange={(e) => setReturnPrice(e.target.value === '' ? '' : parseFloat(e.target.value))}
                  placeholder="0.00"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 font-mono font-bold"
                />
              </div>
            </div>

            {returnQty && returnPrice ? (
              <div className="bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl p-3 flex justify-between items-center">
                <span className="text-slate-500 font-medium">Estimated Debit Note Value:</span>
                <span className="font-extrabold text-sm text-slate-900 dark:text-white font-mono">
                  {currencySymbol} {(Number(returnQty) * Number(returnPrice)).toLocaleString()}
                </span>
              </div>
            ) : null}

            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                Reason / Note *
              </label>
              <textarea
                rows={2}
                required
                value={returnNotes}
                onChange={(e) => setReturnNotes(e.target.value)}
                placeholder="Reason for returning items to supplier..."
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900"
              />
            </div>

            <div className="flex justify-end space-x-2 pt-2 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={handleClose}
                className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 font-semibold"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold shadow-md shadow-rose-600/30 flex items-center space-x-1.5"
              >
                {submitting ? 'Processing...' : 'Confirm Return & Deduct Stock'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
};

