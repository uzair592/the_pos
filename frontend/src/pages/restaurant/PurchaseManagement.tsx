import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../../api/client.js';
import { useAuth } from '../../context/AuthContext.js';
import { useToast } from '../../context/ToastContext.js';
import { Modal } from '../../components/common/Modal.js';
import { ActionMenu } from '../../components/common/ActionMenu.js';
import { ErpPageHeader } from '../../components/common/ErpPageHeader.js';
import { ErpMetricRibbon } from '../../components/common/ErpMetricRibbon.js';
import { formatPKR } from '../../utils/formatPKR.js';
import {
  Truck,
  Edit2,
  Plus,
  Search,
  FileText,
  DollarSign,
  Building2,
  CheckCircle2,
  Clock,
  AlertCircle,
  Eye,
  Trash2,
  Download,
  Printer,
  Phone,
  Mail,
  MapPin,
  RefreshCw,
  Boxes,
  Users,
  FolderPlus,
} from 'lucide-react';
import {
  StockUnit,
  Permission,
  STANDARD_UNITS,
  getCompatibleUnits,
  convertPurchaseQtyToBase,
  calculateBaseUnitCost,
  formatDisplayStock,
} from '@pos/shared';
import { exportPurchaseVoucherPdf } from '../../utils/pdfExport.js';

export const PurchaseManagement: React.FC = () => {
  const { tenant, branches, currentBranchId, hasPermission } = useAuth();
  const { success, error } = useToast();
  const currencySymbol = tenant?.currency_symbol || 'Rs.';

  const [activeTab, setActiveTab] = useState<'INVOICES' | 'SUPPLIERS'>('INVOICES');
  const [loading, setLoading] = useState(true);

  // Data lists
  const [purchases, setPurchases] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [ingredients, setIngredients] = useState<any[]>([]);
  const [categories, setCategories] = useState<string[]>([
    'Meat & Poultry',
    'Dairy & Cheese',
    'Vegetables & Fresh Produce',
    'Bakery & Grains',
    'Spices & Condiments',
    'Beverages & Syrups',
    'Packaging & Disposables',
    'General',
  ]);
  const [isQuickAddCategoryOpen, setIsQuickAddCategoryOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>('ALL');
  const [supplierSearch, setSupplierSearch] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'DRAFT' | 'RECEIVED'>('ALL');
  const [branchFilter, setBranchFilter] = useState<string>(currentBranchId || 'ALL');

  // Modals
  const [isCreateInvoiceOpen, setIsCreateInvoiceOpen] = useState(false);
  const [isAddSupplierOpen, setIsAddSupplierOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<any | null>(null);
  const [invoiceItems, setInvoiceItems] = useState<any[]>([]);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [receivingInvoiceId, setReceivingInvoiceId] = useState<string | null>(null);
  const [isNewSupplierMode, setIsNewSupplierMode] = useState(false);
  const [newSupplierName, setNewSupplierName] = useState('');
  const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().split('T')[0]);

  // New Invoice Form
  const [invoiceForm, setInvoiceForm] = useState({
    branchId: currentBranchId || (branches[0]?.id || ''),
    supplierId: '',
    invoiceNumber: '',
    taxAmount: 0,
    paidAmount: 0,
    receiveNow: true,
    notes: '',
    items: [
      { ingredientId: '', name: '', unit: 'KG', quantity: 1, unitPrice: 0 },
    ],
  });
  const [reconciling, setReconciling] = useState(false);

  // New Supplier Form
  const [supplierForm, setSupplierForm] = useState({
    name: '',
    contactPerson: '',
    phone: '',
    email: '',
    address: '',
    taxNumber: '',
  });

  const [isEditSupplierOpen, setIsEditSupplierOpen] = useState(false);
  const [editSupplierForm, setEditSupplierForm] = useState({
    id: '',
    name: '',
    contactPerson: '',
    phone: '',
    email: '',
    address: '',
    taxNumber: '',
  });

  const [searchParams] = useSearchParams();
  const actionParam = searchParams.get('action');

  useEffect(() => {
    if (actionParam === 'new-bill') {
      setIsCreateInvoiceOpen(true);
    }
  }, [actionParam]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [purchasesRes, suppliersRes, ingredientsRes, categoriesRes] = await Promise.all([
        api.get('/inventory/purchases'),
        api.get('/inventory/suppliers'),
        api.get('/inventory/ingredients'),
        api.get('/inventory/categories').catch(() => ({ categories: [] })),
      ]);

      setPurchases(purchasesRes.purchases || []);
      setSuppliers(suppliersRes.suppliers || []);
      setIngredients(ingredientsRes.ingredients || []);

      if (categoriesRes?.categories?.length > 0) {
        const catNames = categoriesRes.categories.map((c: any) => typeof c === 'string' ? c : c.name);
        setCategories((prev) => Array.from(new Set([...prev, ...catNames])));
      }

      if (suppliersRes.suppliers?.length > 0 && !invoiceForm.supplierId) {
        setInvoiceForm((prev) => ({ ...prev, supplierId: suppliersRes.suppliers[0].id }));
      }
      if (ingredientsRes.ingredients?.length > 0 && !invoiceForm.items[0]?.name && !invoiceForm.items[0]?.ingredientId) {
        const firstIng = ingredientsRes.ingredients[0];
        setInvoiceForm((prev) => ({
          ...prev,
          items: [
            {
              ingredientId: firstIng.id,
              name: firstIng.name,
              unit: firstIng.unit || firstIng.base_unit || 'KG',
              quantity: 1,
              unitPrice: Number(firstIng.purchase_cost || firstIng.cost_per_unit || 0),
            },
          ],
        }));
      }
    } catch (err: any) {
      error(err.message || 'Failed to load purchase records');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [currentBranchId]);

  // Handle adding an item row to the invoice
  const addItemRow = () => {
    setInvoiceForm((prev) => ({
      ...prev,
      items: [
        ...prev.items,
        {
          ingredientId: '',
          name: '',
          unit: 'KG',
          quantity: 1,
          unitPrice: 0,
        },
      ],
    }));
  };

  const removeItemRow = (index: number) => {
    if (invoiceForm.items.length <= 1) return;
    setInvoiceForm((prev) => ({
      ...prev,
      items: prev.items.filter((_, idx) => idx !== index),
    }));
  };

  const handleItemNameChange = (index: number, val: string) => {
    setInvoiceForm((prev) => {
      const newItems = [...prev.items];
      const match = ingredients.find(
        (i) => i.name.toLowerCase().trim() === val.toLowerCase().trim()
      );
      if (match) {
        newItems[index] = {
          ...newItems[index],
          ingredientId: match.id,
          name: match.name,
          unit: match.unit || match.base_unit || 'KG',
          unitPrice: Number(match.purchase_cost || match.cost_per_unit || 0) || newItems[index].unitPrice,
        };
      } else {
        newItems[index] = {
          ...newItems[index],
          ingredientId: '',
          name: val,
        };
      }
      return { ...prev, items: newItems };
    });
  };

  const updateItemRow = (index: number, field: string, value: any) => {
    setInvoiceForm((prev) => {
      const newItems = [...prev.items];
      newItems[index] = {
        ...newItems[index],
        [field]: value,
      };
      return { ...prev, items: newItems };
    });
  };

  // Compute calculated amounts for current form
  const formSubtotal = invoiceForm.items.reduce((acc, it) => acc + (Number(it.quantity || 0) * Number(it.unitPrice || 0)), 0);
  const formGrandTotal = formSubtotal + Number(invoiceForm.taxAmount || 0);
  const formBalancePayable = Math.max(0, formGrandTotal - Number(invoiceForm.paidAmount || 0));

  const handleCreateInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isNewSupplierMode && !invoiceForm.supplierId) {
      error('Please select an existing supplier or click "+ Add New Supplier"');
      return;
    }
    if (isNewSupplierMode && !newSupplierName.trim()) {
      error('Please enter the supplier name');
      return;
    }
    if (!invoiceForm.branchId) {
      error('Please select a destination branch');
      return;
    }

    const hasInvalidItems = invoiceForm.items.some(
      (it) => (!it.ingredientId && !it.name.trim()) || Number(it.quantity) <= 0
    );
    if (hasInvalidItems) {
      error('Please specify an item name and valid quantity for all purchase items');
      return;
    }

    try {
      const isReceiveNow = invoiceForm.receiveNow !== false;
      await api.post('/inventory/purchases', {
        branchId: invoiceForm.branchId,
        supplierId: !isNewSupplierMode ? invoiceForm.supplierId : undefined,
        newSupplierName: isNewSupplierMode ? newSupplierName.trim() : undefined,
        invoiceNumber: invoiceForm.invoiceNumber?.trim() || undefined,
        purchaseDate,
        taxAmount: Number(invoiceForm.taxAmount || 0),
        paidAmount: Number(invoiceForm.paidAmount || 0),
        notes: invoiceForm.notes,
        receiveNow: isReceiveNow,
        items: invoiceForm.items.map((it) => ({
          ingredientId: it.ingredientId || undefined,
          name: it.name.trim() || undefined,
          itemName: it.name.trim() || undefined,
          unit: it.unit || 'KG',
          quantity: Number(it.quantity),
          unitPrice: Number(it.unitPrice),
        })),
      });

      if (isReceiveNow) {
        success('Purchase recorded and stock received into inventory with FIFO batch tracking!');
      } else {
        success('Purchase invoice draft created successfully!');
      }

      setIsCreateInvoiceOpen(false);
      setIsNewSupplierMode(false);
      setNewSupplierName('');
      setInvoiceForm({
        branchId: currentBranchId || (branches[0]?.id || ''),
        supplierId: suppliers[0]?.id || '',
        invoiceNumber: '',
        taxAmount: 0,
        paidAmount: 0,
        receiveNow: true,
        notes: '',
        items: [
          { ingredientId: '', name: '', unit: 'KG', quantity: 1, unitPrice: 0 },
        ],
      });
      fetchData();
    } catch (err: any) {
      error(err.message || 'Failed to record purchase');
    }
  };

  const handleReconcilePurchases = async () => {
    if (!window.confirm('Reconcile historical inward purchases into inventory stock? This will safely find any unposted purchases and create corresponding FIFO batches and ledger entries without double-counting.')) return;
    setReconciling(true);
    try {
      const res = await api.post('/inventory/purchases/reconcile', {
        branchId: currentBranchId || undefined,
      });
      success(res.message || 'Historical inward purchases reconciled successfully!');
      fetchData();
    } catch (err: any) {
      error(err.message || 'Failed to reconcile inward purchases');
    } finally {
      setReconciling(false);
    }
  };

  const handleReceiveStock = async (purchaseId: string) => {
    if (!confirm('Are you sure you want to receive this shipment? This will immediately create active FIFO batches, update branch stock levels, and recalculate weighted average costs.')) {
      return;
    }

    try {
      setReceivingInvoiceId(purchaseId);
      await api.post(`/inventory/purchases/${purchaseId}/receive`, {});
      success('Shipment received! Stock levels and FIFO batches have been updated.');
      setIsDetailModalOpen(false);
      fetchData();
    } catch (err: any) {
      error(err.message || 'Failed to receive purchase invoice');
    } finally {
      setReceivingInvoiceId(null);
    }
  };

  const handleViewInvoiceDetails = async (invoice: any) => {
    try {
      setSelectedInvoice(invoice);
      const res = await api.get(`/inventory/purchases/${invoice.id}`);
      setInvoiceItems(res.items || []);
      setIsDetailModalOpen(true);
    } catch (err: any) {
      error(err.message || 'Failed to fetch invoice details');
    }
  };

  const handleDownloadInvoicePdf = (invoice: any, items: any[] = []) => {
    exportPurchaseVoucherPdf(
      {
        name: tenant?.name || 'Restaurant POS',
        currencySymbol,
        branch: invoice.branch_name || 'Main Branch',
      },
      invoice,
      items,
      { autoPrint: false }
    );
  };

  const handlePrintInvoicePdf = (invoice: any, items: any[] = []) => {
    exportPurchaseVoucherPdf(
      {
        name: tenant?.name || 'Restaurant POS',
        currencySymbol,
        branch: invoice.branch_name || 'Main Branch',
      },
      invoice,
      items,
      { autoPrint: true }
    );
  };

  // Direct Add New Item Modal in Purchase State
  const [isQuickAddItemOpen, setIsQuickAddItemOpen] = useState(false);
  const [targetItemIndex, setTargetItemIndex] = useState<number | null>(null);
  const [quickItemForm, setQuickItemForm] = useState({
    name: '',
    category: 'General',
    sku: '',
    unit: 'KG',
    costPerUnit: 0,
    minStockAlert: 5,
  });

  const handleOpenQuickAddItem = (rowIndex: number) => {
    setTargetItemIndex(rowIndex);
    setQuickItemForm({
      name: invoiceForm.items[rowIndex]?.name || '',
      category: categories[0] || 'General',
      sku: '',
      unit: invoiceForm.items[rowIndex]?.unit || 'KG',
      costPerUnit: invoiceForm.items[rowIndex]?.unitPrice || 0,
      minStockAlert: 5,
    });
    setIsQuickAddItemOpen(true);
  };

  const handleSaveQuickCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCategoryName.trim()) {
      error('Category name is required');
      return;
    }

    try {
      const res = await api.post('/inventory/categories', { name: newCategoryName.trim() });
      const createdName = res.category?.name || newCategoryName.trim();
      setCategories((prev) => Array.from(new Set([...prev, createdName])));
      setQuickItemForm((prev) => ({ ...prev, category: createdName }));
      success(`Category "${createdName}" ready for use!`);
      setNewCategoryName('');
      setIsQuickAddCategoryOpen(false);
    } catch (err: any) {
      error(err.message || 'Failed to create category');
    }
  };

  const handleSaveQuickItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickItemForm.name.trim()) {
      error('Item name is required');
      return;
    }

    try {
      const selectedUnit = quickItemForm.unit || 'KG';
      const cost = Number(quickItemForm.costPerUnit) || 0;
      const res = await api.post('/inventory/ingredients', {
        name: quickItemForm.name.trim(),
        category: quickItemForm.category || 'General',
        sku: quickItemForm.sku?.trim() || undefined,
        unit: selectedUnit,
        baseUnit: selectedUnit,
        purchaseUnit: selectedUnit,
        conversionFactor: 1,
        costPerUnit: cost,
        purchaseCost: cost,
        minStockAlert: Number(quickItemForm.minStockAlert) || 5,
        initialStock: 0,
        branchId: invoiceForm.branchId,
      });

      const createdIngredient = res.ingredient;
      success(`New item "${createdIngredient.name}" created and added to line items!`);

      // Refresh ingredients and categories in background
      api.get('/inventory/ingredients').then((r) => setIngredients(r.ingredients || []));
      api.get('/inventory/categories').then((r) => {
        if (r.categories) {
          const catNames = r.categories.map((c: any) => typeof c === 'string' ? c : c.name);
          setCategories((prev) => Array.from(new Set([...prev, ...catNames])));
        }
      }).catch(() => {});

      // Put into target row
      if (targetItemIndex !== null && invoiceForm.items[targetItemIndex]) {
        updateItemRow(targetItemIndex, 'ingredientId', createdIngredient.id);
        updateItemRow(targetItemIndex, 'name', createdIngredient.name);
        updateItemRow(targetItemIndex, 'unit', createdIngredient.unit || selectedUnit);
        updateItemRow(targetItemIndex, 'unitPrice', cost);
      }

      setIsQuickAddItemOpen(false);
      setQuickItemForm({
        name: '',
        category: categories[0] || 'General',
        sku: '',
        unit: 'KG',
        costPerUnit: 0,
        minStockAlert: 5,
      });
    } catch (err: any) {
      error(err.message || 'Failed to create item');
    }
  };

  const handleCreateSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supplierForm.name || !supplierForm.phone) {
      error('Supplier name and phone are required');
      return;
    }

    try {
      const res = await api.post('/inventory/suppliers', supplierForm);
      success('Supplier added successfully');
      setIsAddSupplierOpen(false);
      setSupplierForm({
        name: '',
        contactPerson: '',
        phone: '',
        email: '',
        address: '',
        taxNumber: '',
      });
      fetchData();
      if (res.supplier?.id) {
        setInvoiceForm((prev) => ({ ...prev, supplierId: res.supplier.id }));
      }
    } catch (err: any) {
      error(err.message || 'Failed to create supplier');
    }
  };

  const handleUpdateSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.put(`/inventory/suppliers/${editSupplierForm.id}`, editSupplierForm);
      success('Supplier updated successfully!');
      setIsEditSupplierOpen(false);
      fetchData();
    } catch (err: any) {
      error(err.message || 'Failed to update supplier');
    }
  };

  const handleDeleteSupplier = async (id: string, name: string) => {
    if (!window.confirm(`Are you sure you want to delete supplier "${name}"?`)) {
      return;
    }
    try {
      await api.delete(`/inventory/suppliers/${id}`);
      success(`Supplier "${name}" deleted successfully`);
      fetchData();
    } catch (err: any) {
      error(err.message || 'Failed to delete supplier');
    }
  };

  const handleDeletePurchase = async (id: string, invNum: string) => {
    if (!window.confirm(`Are you sure you want to cancel and delete draft purchase invoice "${invNum}"?`)) {
      return;
    }
    try {
      await api.delete(`/inventory/purchases/${id}`);
      success(`Purchase invoice "${invNum}" deleted successfully`);
      fetchData();
    } catch (err: any) {
      error(err.message || 'Failed to delete purchase invoice');
    }
  };

  // Filtered Purchases
    const filteredPurchases = purchases.filter((p) => {
    const matchesSearch =
      p.invoice_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (p.supplier_name && p.supplier_name.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesStatus = statusFilter === 'ALL' || p.status === statusFilter;
    const matchesBranch = branchFilter === 'ALL' || p.branch_id === branchFilter;
    const matchesSupplier =
      selectedSupplierId === 'ALL' ||
      p.supplier_id === selectedSupplierId ||
      p.supplierId === selectedSupplierId;
    return matchesSearch && matchesStatus && matchesBranch && matchesSupplier;
  });

  const totalPaidAmount = purchases.reduce((acc, p) => acc + Number(p.paid_amount || 0), 0);
  const totalDueAmount = purchases.reduce(
    (acc, p) => acc + Math.max(0, Number(p.total_amount || 0) - Number(p.paid_amount || 0)),
    0
  );
  const filteredPurchasesSum = filteredPurchases.reduce((acc, p) => acc + Number(p.total_amount || 0), 0);
  const filteredPaidSum = filteredPurchases.reduce((acc, p) => acc + Number(p.paid_amount || 0), 0);
  const filteredDueSum = filteredPurchases.reduce(
    (acc, p) => acc + Math.max(0, Number(p.total_amount || 0) - Number(p.paid_amount || 0)),
    0
  );

  // Filtered Suppliers
  const filteredSuppliers = suppliers.filter(
    (s) =>
      s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (s.phone && s.phone.includes(searchTerm)) ||
      (s.contact_person && s.contact_person.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  // Top KPI calculations
  const totalPurchasesAmount = purchases.reduce((acc, p) => acc + Number(p.total_amount || 0), 0);
  const totalBalancePayable = suppliers.reduce((acc, s) => acc + Number(s.balance_payable || 0), 0);
  const receivedInvoicesCount = purchases.filter((p) => p.status === 'RECEIVED').length;
  const draftInvoicesCount = purchases.filter((p) => p.status === 'DRAFT').length;

  return (
    <div className="h-[calc(100vh-48px)] flex flex-col overflow-hidden font-sans select-none bg-slate-50 dark:bg-slate-950">
      {/* 1. Zero-Bloat ERP Page Header */}
      <ErpPageHeader
        title="Purchases & Inward Bills"
        subtitle="Vendor Procurement & Invoices"
        badge={`${purchases.length} Invoices`}
        actions={
          <div className="flex items-center gap-1.5">
            <div className="flex p-0.5 bg-slate-200/80 dark:bg-slate-800 rounded-lg text-xs font-semibold mr-1">
              <button
                type="button"
                onClick={() => setActiveTab('INVOICES')}
                className={`px-2.5 py-1 rounded-md transition-all ${
                  activeTab === 'INVOICES'
                    ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 font-bold shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                Invoices ({purchases.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('SUPPLIERS')}
                className={`px-2.5 py-1 rounded-md transition-all ${
                  activeTab === 'SUPPLIERS'
                    ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 font-bold shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                Suppliers ({suppliers.length})
              </button>
            </div>

            <button
              type="button"
              onClick={handleReconcilePurchases}
              disabled={reconciling}
              className="flex items-center gap-1 px-2.5 py-1 bg-white dark:bg-slate-800 hover:bg-slate-100 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-semibold"
              title="Sync purchases to FIFO lots"
            >
              <RefreshCw className={`w-3 h-3 ${reconciling ? 'animate-spin text-indigo-600' : ''}`} />
              <span className="hidden sm:inline">Reconcile</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setNewCategoryName('');
                setIsQuickAddCategoryOpen(true);
              }}
              className="flex items-center gap-1 px-2.5 py-1 bg-white dark:bg-slate-800 hover:bg-slate-100 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-semibold"
            >
              <FolderPlus className="w-3.5 h-3.5 text-indigo-600" />
              <span className="hidden sm:inline">+ Category</span>
            </button>

            <button
              type="button"
              onClick={() => setIsAddSupplierOpen(true)}
              className="flex items-center gap-1 px-2.5 py-1 bg-white dark:bg-slate-800 hover:bg-slate-100 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-semibold"
            >
              <Plus className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Supplier</span>
            </button>

            <button
              type="button"
              onClick={() => setIsCreateInvoiceOpen(true)}
              className="flex items-center gap-1 px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold shadow-xs shrink-0"
              title="Record Purchase Bill (Alt+P)"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>+ Purchase Bill (Alt+P)</span>
            </button>
          </div>
        }
      />

      {/* 2. Compact Vyapar Summary Ribbon (44px) */}
      <ErpMetricRibbon
        metrics={[
          {
            label: 'Total Purchases',
            value: formatPKR(totalPurchasesAmount),
            variant: 'slate',
          },
          {
            label: 'Paid Amount',
            value: formatPKR(totalPaidAmount),
            variant: 'emerald',
          },
          {
            label: 'Payable Due',
            value: formatPKR(totalDueAmount),
            variant: 'rose',
          },
          {
            label: 'Received Inward',
            value: receivedInvoicesCount,
            variant: 'indigo',
          },
          {
            label: 'Draft / In-Transit',
            value: draftInvoicesCount,
            variant: 'amber',
            onClick: () => setStatusFilter(statusFilter === 'DRAFT' ? 'ALL' : 'DRAFT'),
          },
        ]}
        actions={
          <div className="flex items-center gap-1 text-xs">
            <span className="text-slate-400 text-[11px] hidden sm:inline">Supplier:</span>
            <span className="font-semibold text-slate-700 dark:text-slate-200">
              {selectedSupplierId === 'ALL'
                ? 'All Suppliers'
                : suppliers.find((s) => s.id === selectedSupplierId)?.name || 'Selected'}
            </span>
            {selectedSupplierId !== 'ALL' && (
              <button
                type="button"
                onClick={() => setSelectedSupplierId('ALL')}
                className="text-xs text-rose-500 hover:text-rose-700 font-bold ml-1"
              >
                Clear
              </button>
            )}
          </div>
        }
      />

      {/* 3. Main Workspace Area */}
      {activeTab === 'INVOICES' ? (
        <div className="flex-1 flex overflow-hidden">
          {/* ========================================================= */}
          {/* LEFT MASTER PANE: Supplier Ledger List (w-64 / w-72)      */}
          {/* ========================================================= */}
          <div className="w-60 xl:w-72 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col shrink-0">
            {/* Supplier Search Bar */}
            <div className="p-2 border-b border-slate-200 dark:border-slate-800 flex items-center gap-1.5 shrink-0 bg-slate-50/50 dark:bg-slate-900/50">
              <div className="relative flex-1">
                <Search className="w-3.5 h-3.5 absolute left-2 top-2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Filter suppliers..."
                  value={supplierSearch}
                  onChange={(e) => setSupplierSearch(e.target.value)}
                  className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md pl-7 pr-2 py-1 text-xs text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
              <button
                type="button"
                onClick={() => setIsAddSupplierOpen(true)}
                className="p-1 rounded-md bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 border border-indigo-200 dark:border-indigo-800 shrink-0"
                title="Add New Supplier"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Scrollable Supplier List */}
            <div className="flex-1 overflow-y-auto p-1.5 space-y-0.5">
              {/* All Purchases Button */}
              <button
                type="button"
                onClick={() => setSelectedSupplierId('ALL')}
                className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-xs transition-colors ${
                  selectedSupplierId === 'ALL'
                    ? 'bg-indigo-600 text-white font-bold shadow-xs'
                    : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 font-medium'
                }`}
              >
                <div className="flex items-center gap-2 truncate">
                  <Truck className="w-3.5 h-3.5 shrink-0 opacity-80" />
                  <span className="truncate">All Invoices</span>
                </div>
                <span
                  className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full font-bold ${
                    selectedSupplierId === 'ALL'
                      ? 'bg-white/25 text-white'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  {purchases.length}
                </span>
              </button>

              <div className="pt-1 pb-1">
                <div className="px-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Suppliers ({suppliers.length})
                </div>
              </div>

              {suppliers
                .filter((s) => !supplierSearch || s.name.toLowerCase().includes(supplierSearch.toLowerCase()))
                .map((s) => {
                  const isSelected = selectedSupplierId === s.id;
                  const supplierInvoices = purchases.filter(
                    (p) => p.supplier_id === s.id || p.supplierId === s.id
                  );
                  const balPayable = Number(s.balance_payable || 0);

                  return (
                    <div
                      key={s.id}
                      onClick={() => setSelectedSupplierId(s.id)}
                      className={`group w-full flex items-center justify-between px-2 py-1.5 rounded-md text-xs cursor-pointer transition-colors ${
                        isSelected
                          ? 'bg-indigo-600 text-white font-bold shadow-xs'
                          : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                      }`}
                    >
                      <div className="min-w-0 pr-1">
                        <div className="font-semibold truncate">{s.name}</div>
                        {balPayable > 0 && (
                          <div
                            className={`font-mono text-[10px] font-bold ${
                              isSelected ? 'text-white/90' : 'text-rose-600 dark:text-rose-400'
                            }`}
                          >
                            Due: {formatPKR(balPayable)}
                          </div>
                        )}
                      </div>
                      <span
                        className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full font-bold shrink-0 ${
                          isSelected
                            ? 'bg-white/25 text-white'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                        }`}
                      >
                        {supplierInvoices.length}
                      </span>
                    </div>
                  );
                })}
            </div>
          </div>

          {/* ========================================================= */}
          {/* RIGHT DETAIL PANE: Spreadsheet Invoices Table             */}
          {/* ========================================================= */}
          <div className="flex-1 flex flex-col overflow-hidden bg-white dark:bg-slate-950">
            {/* Filter Strip (36px) */}
            <div className="h-9 min-h-[36px] bg-slate-50 dark:bg-slate-900/90 border-b border-slate-200 dark:border-slate-800 px-3 flex items-center justify-between gap-2 shrink-0">
              <div className="relative flex-1 max-w-sm">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search invoice # or vendor..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md pl-8 pr-3 py-1 text-xs text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div className="flex items-center gap-1.5">
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as any)}
                  className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold rounded-md px-2 py-1 focus:outline-none"
                >
                  <option value="ALL">All Statuses</option>
                  <option value="DRAFT">Draft / In Transit</option>
                  <option value="RECEIVED">Received into Stock</option>
                </select>

                {branches.length > 1 && (
                  <select
                    value={branchFilter}
                    onChange={(e) => setBranchFilter(e.target.value)}
                    className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold rounded-md px-2 py-1 focus:outline-none"
                  >
                    <option value="ALL">All Outlets</option>
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                )}

                <button
                  type="button"
                  onClick={fetchData}
                  className="p-1 rounded-md text-slate-500 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                  title="Refresh Purchases"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Invoices Table Container */}
            <div className="flex-1 overflow-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-100 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 font-bold uppercase tracking-wider text-[11px] sticky top-0 z-10 select-none divide-x divide-slate-200/80 dark:divide-slate-800">
                  <tr>
                    <th className="px-3 py-2 w-32">Invoice #</th>
                    <th className="px-3 py-2 w-28">Date</th>
                    <th className="px-3 py-2 min-w-[160px]">Supplier</th>
                    <th className="px-3 py-2 w-28">Outlet</th>
                    <th className="px-3 py-2 text-right w-28">Total Amount</th>
                    <th className="px-3 py-2 text-right w-28">Paid</th>
                    <th className="px-3 py-2 text-right w-28">Balance Due</th>
                    <th className="px-2.5 py-2 text-center w-28">Receiving</th>
                    <th className="px-2.5 py-2 text-right w-16">Action</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-200/60 dark:divide-slate-800 text-slate-800 dark:text-slate-200 font-medium">
                  {loading ? (
                    <tr>
                      <td colSpan={9} className="px-4 py-12 text-center text-slate-400">
                        Loading inward purchase invoices...
                      </td>
                    </tr>
                  ) : filteredPurchases.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="px-4 py-14 text-center text-slate-400">
                        <Truck className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-600 mb-2" />
                        <p className="font-bold text-slate-600 dark:text-slate-300 text-sm">
                          No purchase bills found
                        </p>
                        <p className="text-xs text-slate-400 mt-1">
                          Record an incoming vendor shipment to track raw material costs and FIFO lots.
                        </p>
                        <button
                          type="button"
                          onClick={() => setIsCreateInvoiceOpen(true)}
                          className="mt-3 px-3 py-1.5 bg-indigo-600 text-white text-xs font-bold rounded-lg shadow-xs hover:bg-indigo-700"
                        >
                          + Record Purchase Bill (Alt+P)
                        </button>
                      </td>
                    </tr>
                  ) : (
                    filteredPurchases.map((p) => {
                      const isDraft = p.status === 'DRAFT';
                      const totalAmt = Number(p.total_amount || 0);
                      const paidAmt = Number(p.paid_amount || 0);
                      const dueAmt = Math.max(0, totalAmt - paidAmt);

                      return (
                        <tr
                          key={p.id}
                          className="divide-x divide-slate-200/60 dark:divide-slate-800/60 hover:bg-indigo-50/40 dark:hover:bg-indigo-950/20 transition-colors even:bg-slate-50/50 dark:even:bg-slate-900/30"
                        >
                          <td className="px-3 py-1.5 font-mono text-[11px] font-bold text-indigo-700 dark:text-indigo-400 whitespace-nowrap">
                            #{p.invoice_number}
                          </td>
                          <td className="px-3 py-1.5 font-mono text-[11px] text-slate-500 whitespace-nowrap">
                            {p.created_at ? new Date(p.created_at).toLocaleDateString() : '—'}
                          </td>
                          <td className="px-3 py-1.5 font-semibold text-slate-900 dark:text-white truncate">
                            {p.supplier_name || 'Generic Vendor'}
                          </td>
                          <td className="px-3 py-1.5 text-slate-600 dark:text-slate-300 truncate">
                            {p.branch_name || 'Main Outlet'}
                          </td>
                          <td className="px-3 py-1.5 text-right font-mono tabular-nums font-bold text-slate-900 dark:text-white whitespace-nowrap">
                            {formatPKR(totalAmt)}
                          </td>
                          <td className="px-3 py-1.5 text-right font-mono tabular-nums text-emerald-600 dark:text-emerald-400 font-semibold whitespace-nowrap">
                            {formatPKR(paidAmt)}
                          </td>
                          <td className="px-3 py-1.5 text-right font-mono tabular-nums font-bold text-rose-600 dark:text-rose-400 whitespace-nowrap">
                            {formatPKR(dueAmt)}
                          </td>
                          <td className="px-2.5 py-1.5 text-center whitespace-nowrap">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                                isDraft
                                  ? 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300'
                                  : 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300'
                              }`}
                            >
                              {isDraft ? 'In Transit / Draft' : 'Received into Stock'}
                            </span>
                          </td>
                          <td className="px-2.5 py-1.5 text-right whitespace-nowrap">
                            <ActionMenu
                              items={[
                                {
                                  label: 'Preview Invoice Details',
                                  icon: Eye,
                                  onClick: () => handleViewInvoiceDetails(p),
                                },
                                isDraft && {
                                  label: receivingInvoiceId === p.id ? 'Receiving...' : 'Receive Stock into FIFO',
                                  icon: CheckCircle2,
                                  variant: 'success',
                                  disabled: receivingInvoiceId === p.id,
                                  onClick: () => handleReceiveStock(p.id),
                                },
                                {
                                  label: 'Download A4 Invoice (PDF)',
                                  icon: Download,
                                  onClick: () => handleDownloadInvoicePdf(p),
                                },
                                {
                                  label: 'Print A4 Invoice',
                                  icon: Printer,
                                  onClick: () => handlePrintInvoicePdf(p),
                                },
                                isDraft && {
                                  label: 'Cancel & Delete Invoice',
                                  icon: Trash2,
                                  variant: 'danger',
                                  divider: true,
                                  onClick: () => handleDeletePurchase(p.id, p.invoice_number),
                                },
                              ]}
                            />
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>

                {filteredPurchases.length > 0 && (
                  <tfoot className="bg-slate-100 dark:bg-slate-900 border-t-2 border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 font-bold sticky bottom-0 z-10 select-none divide-x divide-slate-200/80 dark:divide-slate-800 text-xs">
                    <tr>
                      <td colSpan={4} className="px-3 py-2 text-slate-600 dark:text-slate-400 font-bold uppercase text-[11px]">
                        Showing {filteredPurchases.length} Inward Invoices
                      </td>
                      <td className="px-3 py-2 text-right font-mono tabular-nums text-slate-900 dark:text-white">
                        {formatPKR(filteredPurchasesSum)}
                      </td>
                      <td className="px-3 py-2 text-right font-mono tabular-nums text-emerald-600 dark:text-emerald-400">
                        {formatPKR(filteredPaidSum)}
                      </td>
                      <td className="px-3 py-2 text-right font-mono tabular-nums text-rose-600 dark:text-rose-400">
                        {formatPKR(filteredDueSum)}
                      </td>
                      <td colSpan={2} className="px-3 py-2 text-right text-[11px] text-slate-500">
                        {filteredPurchases.filter((p) => p.status === 'RECEIVED').length} posted to FIFO
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-auto p-3">
<div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 bg-slate-50/50 dark:bg-slate-800/30">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search suppliers by name, phone, or contact person..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs focus:ring-2 focus:ring-brand-500 text-slate-900 dark:text-white"
              />
            </div>
            <button
              onClick={fetchData}
              className="p-2 text-slate-500 hover:text-slate-900 dark:hover:text-white rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
              title="Refresh Suppliers"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="px-4 py-3">Supplier Name</th>
                  <th className="px-4 py-3">Contact Person</th>
                  <th className="px-4 py-3">Phone</th>
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3">Address</th>
                  <th className="px-4 py-3 text-right">Balance Payable</th>
                  <th className="px-4 py-3 text-right">Created</th>
                  <th className="px-4 py-3 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-slate-700 dark:text-slate-200 font-medium">
                {loading ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-slate-400">
                      Loading suppliers...
                    </td>
                  </tr>
                ) : filteredSuppliers.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-12 text-center text-slate-400">
                      <Users className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-600 mb-2" />
                      <p className="font-bold text-slate-600 dark:text-slate-300">No suppliers registered</p>
                      <p className="text-[11px] text-slate-400 mt-1">
                        Add raw material suppliers to track procurement and balances.
                      </p>
                    </td>
                  </tr>
                ) : (
                  filteredSuppliers.map((s) => {
                    const balance = Number(s.balance_payable || 0);
                    return (
                      <tr key={s.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                        <td className="px-4 py-3 font-bold text-slate-900 dark:text-white">
                          {s.name}
                        </td>
                        <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                          {s.contact_person || '—'}
                        </td>
                        <td className="px-4 py-3 font-mono text-slate-600 dark:text-slate-300">
                          <span className="flex items-center space-x-1">
                            <Phone className="w-3 h-3 text-slate-400" />
                            <span>{s.phone}</span>
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-500 dark:text-slate-400">
                          {s.email ? (
                            <span className="flex items-center space-x-1">
                              <Mail className="w-3 h-3 text-slate-400" />
                              <span>{s.email}</span>
                            </span>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td className="px-4 py-3 text-slate-500 dark:text-slate-400 max-w-xs truncate">
                          {s.address ? (
                            <span className="flex items-center space-x-1">
                              <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                              <span className="truncate">{s.address}</span>
                            </span>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td className="px-4 py-3 text-right font-mono font-bold">
                          {balance > 0 ? (
                            <span className="text-rose-500">{currencySymbol} {balance.toLocaleString()}</span>
                          ) : (
                            <span className="text-emerald-500">Nil</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right text-slate-400 text-[11px]">
                          {new Date(s.created_at).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3 text-center whitespace-nowrap">
                          <ActionMenu
                            items={[
                              {
                                label: 'Edit Supplier Details',
                                icon: Edit2,
                                onClick: () => {
                                  setEditSupplierForm({
                                    id: s.id,
                                    name: s.name,
                                    contactPerson: s.contact_person || '',
                                    phone: s.phone || '',
                                    email: s.email || '',
                                    address: s.address || '',
                                    taxNumber: s.tax_number || '',
                                  });
                                  setIsEditSupplierOpen(true);
                                },
                              },
                              {
                                label: 'Record Inward Purchase',
                                icon: Plus,
                                onClick: () => {
                                  setInvoiceForm((prev) => ({
                                    ...prev,
                                    supplierId: s.id,
                                  }));
                                  setIsCreateInvoiceOpen(true);
                                },
                              },
                              {
                                label: 'Delete Supplier',
                                icon: Trash2,
                                variant: 'danger',
                                divider: true,
                                onClick: () => handleDeleteSupplier(s.id, s.name),
                              },
                            ]}
                          />
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      )}

      {/* Modal 1: Create Purchase Invoice */}
      <Modal
        isOpen={isCreateInvoiceOpen}
        onClose={() => setIsCreateInvoiceOpen(false)}
        title={
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-brand-50 dark:bg-brand-950/50 rounded-xl text-brand-600 dark:text-brand-400">
              <Truck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Record New Purchase & Stock Inward</h3>
              <p className="text-xs text-slate-500 font-normal mt-0.5">Enter vendor supplies, create FIFO inventory batches, and update ingredient balances</p>
            </div>
          </div>
        }
        maxWidth="6xl"
      >
        <form onSubmit={handleCreateInvoice} className="space-y-6">
          <div className="bg-slate-50/80 dark:bg-slate-850/60 p-4 sm:p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200/60 dark:border-slate-800">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                1. Vendor & Invoice Details
              </span>
              <button
                type="button"
                onClick={() => setIsNewSupplierMode(!isNewSupplierMode)}
                className="inline-flex items-center space-x-1.5 text-xs text-brand-600 dark:text-brand-400 font-bold hover:underline"
              >
                <span>{isNewSupplierMode ? '← Choose Existing Supplier' : '+ Add Brand New Supplier'}</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {branches.length > 1 && (
                <div>
                  <label className="form-label">
                    Receiving Branch <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={invoiceForm.branchId}
                    onChange={(e) => setInvoiceForm({ ...invoiceForm, branchId: e.target.value })}
                    className="form-select"
                    required
                  >
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className={branches.length > 1 ? 'lg:col-span-1' : 'lg:col-span-2'}>
                <label className="form-label">
                  {isNewSupplierMode ? 'New Supplier / Vendor Name' : 'Supplier / Vendor'} <span className="text-rose-500">*</span>
                </label>
                {isNewSupplierMode ? (
                  <input
                    type="text"
                    value={newSupplierName}
                    onChange={(e) => setNewSupplierName(e.target.value)}
                    placeholder="e.g. Metro Cash & Carry, Local Poultry Farm"
                    className="form-input border-brand-300 dark:border-brand-700 font-bold"
                    required
                  />
                ) : (
                  <select
                    value={invoiceForm.supplierId}
                    onChange={(e) => setInvoiceForm({ ...invoiceForm, supplierId: e.target.value })}
                    className="form-select"
                    required
                  >
                    <option value="">Select Supplier...</option>
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.phone || 'No phone'})
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div>
                <label className="form-label">
                  Purchase Date <span className="text-rose-500">*</span>
                </label>
                <input
                  type="date"
                  value={purchaseDate}
                  onChange={(e) => setPurchaseDate(e.target.value)}
                  className="form-input"
                  required
                />
              </div>

              <div>
                <label className="form-label">
                  Vendor Invoice / Ref # <span className="text-slate-400 font-normal">(Optional)</span>
                </label>
                <input
                  type="text"
                  value={invoiceForm.invoiceNumber}
                  onChange={(e) => setInvoiceForm({ ...invoiceForm, invoiceNumber: e.target.value })}
                  className="form-input font-mono font-bold"
                  placeholder="e.g. INV-100234 (auto)"
                />
              </div>
            </div>
          </div>

          {/* Line Items Table */}
          <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs">
            <div className="bg-slate-100 dark:bg-slate-800/90 px-4 py-3 flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-700">
              <div className="flex items-center space-x-2.5">
                <div className="p-1.5 bg-brand-500/10 dark:bg-brand-500/20 rounded-lg text-brand-600 dark:text-brand-400">
                  <Boxes className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
                    2. Purchased Items & FIFO Batches
                  </h4>
                  <p className="text-[11px] text-slate-500 font-normal">Select existing inventory items or type a new raw material name</p>
                </div>
              </div>
              <button
                type="button"
                onClick={addItemRow}
                className="px-3.5 py-1.5 bg-brand-500 hover:bg-brand-600 text-white rounded-xl text-xs font-bold flex items-center space-x-1.5 transition-all shadow-xs"
              >
                <Plus className="w-4 h-4" />
                <span>Add Item Row</span>
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50/80 dark:bg-slate-850 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 uppercase font-bold text-xs">
                  <tr>
                    <th className="px-4 py-3 min-w-[320px]">Item / Raw Ingredient Name</th>
                    <th className="px-3 py-3 w-32">Quantity</th>
                    <th className="px-3 py-3 w-32">Unit</th>
                    <th className="px-3 py-3 w-40">Unit Purchase Price</th>
                    <th className="px-4 py-3 w-36 text-right">Line Total</th>
                    <th className="px-3 py-3 w-14 text-center"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 bg-white dark:bg-slate-900">
                  {invoiceForm.items.map((row, idx) => {
                    const isNewItem = !row.ingredientId && Boolean(row.name?.trim());
                    const isExistingItem = Boolean(row.ingredientId);

                    return (
                      <tr key={idx} className="hover:bg-slate-50/70 dark:hover:bg-slate-850/40 transition-colors">
                        <td className="px-4 py-3 align-top">
                          <div className="space-y-1.5">
                            <div className="flex items-center space-x-1.5">
                              <div className="relative flex-1">
                                <input
                                  type="text"
                                  list={`ing-list-${idx}`}
                                  value={row.name}
                                  onChange={(e) => handleItemNameChange(idx, e.target.value)}
                                  placeholder="Search item or type new..."
                                  className="form-input text-sm font-semibold pr-8"
                                  required
                                />
                                <datalist id={`ing-list-${idx}`}>
                                  {ingredients.map((ing) => (
                                    <option key={ing.id} value={ing.name}>
                                      Existing: {ing.name} ({ing.unit || ing.base_unit || 'UNIT'})
                                    </option>
                                  ))}
                                </datalist>
                              </div>
                              <button
                                type="button"
                                onClick={() => handleOpenQuickAddItem(idx)}
                                className="px-2.5 py-2 rounded-xl bg-purple-50 hover:bg-purple-100 dark:bg-purple-950/60 dark:hover:bg-purple-900/60 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 text-xs font-bold whitespace-nowrap flex items-center space-x-1 transition-all shrink-0"
                                title="Add as new item with custom category and min stock alert"
                              >
                                <Plus className="w-3.5 h-3.5" />
                                <span>+ New Item</span>
                              </button>
                            </div>

                            <div className="flex items-center space-x-2">
                              {isNewItem && (
                                <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-purple-50 dark:bg-purple-950/50 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                                  <span>✨ Auto-creates in inventory</span>
                                </span>
                              )}
                              {isExistingItem && (
                                <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                                  <span>✓ Existing item</span>
                                </span>
                              )}
                            </div>
                          </div>
                        </td>

                        <td className="px-3 py-3 align-top">
                          <input
                            type="number"
                            step="any"
                            min="0.001"
                            value={row.quantity || ''}
                            onChange={(e) => updateItemRow(idx, 'quantity', parseFloat(e.target.value) || 0)}
                            placeholder="1"
                            className="form-input font-mono font-bold text-center"
                            required
                          />
                        </td>

                        <td className="px-3 py-3 align-top">
                          <select
                            value={row.unit}
                            onChange={(e) => updateItemRow(idx, 'unit', e.target.value)}
                            className="form-select font-mono font-bold"
                          >
                            {['KG', 'G', 'L', 'ML', 'PCS', 'PACKET', 'BOX', 'CAN', 'BOTTLE', 'DOZEN', 'TRAY', 'PORTION'].map((u) => (
                              <option key={u} value={u}>{u}</option>
                            ))}
                          </select>
                        </td>

                        <td className="px-3 py-3 align-top">
                          <div className="relative">
                            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                              {currencySymbol}
                            </span>
                            <input
                              type="number"
                              step="any"
                              min="0"
                              value={row.unitPrice || ''}
                              onChange={(e) => updateItemRow(idx, 'unitPrice', parseFloat(e.target.value) || 0)}
                              placeholder="0.00"
                              className="form-input pl-8 pr-3 font-mono font-bold text-right"
                              required
                            />
                          </div>
                        </td>

                        <td className="px-4 py-3 align-top pt-5 text-right font-mono font-bold text-sm text-brand-600 dark:text-brand-400 whitespace-nowrap">
                          {currencySymbol} {(Number(row.quantity || 0) * Number(row.unitPrice || 0)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>

                        <td className="px-3 py-3 align-top pt-4 text-center">
                          {invoiceForm.items.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeItemRow(idx)}
                              className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl transition-colors"
                              title="Remove item"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Table Footer Quick Item Row Actions */}
            <div className="px-4 py-2.5 bg-slate-50 dark:bg-slate-850 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={addItemRow}
                  className="px-3 py-1.5 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-bold flex items-center space-x-1.5 transition-all shadow-xs"
                >
                  <Plus className="w-3.5 h-3.5 text-brand-600" />
                  <span>+ Add Line Row</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const newIdx = invoiceForm.items.length;
                    addItemRow();
                    setTimeout(() => handleOpenQuickAddItem(newIdx), 30);
                  }}
                  className="px-3 py-1.5 bg-purple-50 hover:bg-purple-100 dark:bg-purple-950/60 dark:hover:bg-purple-900/60 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 rounded-lg text-xs font-bold flex items-center space-x-1.5 transition-all shadow-xs"
                >
                  <Boxes className="w-3.5 h-3.5" />
                  <span>+ Register New Item to Inventory</span>
                </button>
              </div>
              <span className="text-xs text-slate-500 font-medium">
                {invoiceForm.items.length} line item{invoiceForm.items.length > 1 ? 's' : ''} in purchase
              </span>
            </div>
          </div>

          {/* Section 3: Notes & Financial Calculation Breakdown */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 pt-2">
            <div className="space-y-4">
              <div>
                <label className="form-label">
                  Purchase Notes & Delivery Terms <span className="text-slate-400 font-normal">(Optional)</span>
                </label>
                <textarea
                  value={invoiceForm.notes}
                  onChange={(e) => setInvoiceForm({ ...invoiceForm, notes: e.target.value })}
                  rows={4}
                  className="form-textarea"
                  placeholder="Optional supplier payment terms, delivery receipt numbers, carrier details, or memo..."
                />
              </div>

              <div className="p-4 bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/60 rounded-2xl">
                <label className="flex items-start space-x-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={invoiceForm.receiveNow !== false}
                    onChange={(e) => setInvoiceForm({ ...invoiceForm, receiveNow: e.target.checked })}
                    className="mt-0.5 rounded text-brand-600 focus:ring-brand-500 w-4 h-4"
                  />
                  <div>
                    <span className="block text-xs font-bold text-emerald-900 dark:text-emerald-200">
                      Receive Stock & Post Inward Immediately
                    </span>
                    <span className="block text-[11px] text-emerald-700 dark:text-emerald-400 mt-0.5">
                      Automatically creates FIFO batch lots and immediately updates the on-hand stock balances in inventory.
                    </span>
                  </div>
                </label>
              </div>
            </div>

            <div className="bg-slate-50 dark:bg-slate-850 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3.5">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 pb-1 border-b border-slate-200 dark:border-slate-800">
                3. Financial Breakdown
              </h4>

              <div className="flex justify-between items-center text-sm text-slate-600 dark:text-slate-400">
                <span className="font-medium">Subtotal ({invoiceForm.items.length} item lines):</span>
                <span className="font-mono font-bold text-slate-900 dark:text-white text-base">
                  {currencySymbol} {formSubtotal.toFixed(2)}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-slate-600 dark:text-slate-400">Tax / GST Amount:</span>
                <div className="relative w-36">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                    {currencySymbol}
                  </span>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    value={invoiceForm.taxAmount}
                    onChange={(e) => setInvoiceForm({ ...invoiceForm, taxAmount: parseFloat(e.target.value) || 0 })}
                    className="form-input pl-7 pr-3 py-1.5 text-right font-mono font-bold text-sm h-10"
                  />
                </div>
              </div>

              <div className="flex justify-between items-center border-t border-b border-slate-200 dark:border-slate-800 py-3 text-slate-900 dark:text-white">
                <span className="text-base font-extrabold">Grand Total:</span>
                <span className="font-mono text-xl font-black text-brand-600 dark:text-brand-400">
                  {currencySymbol} {formGrandTotal.toFixed(2)}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <span className="text-sm font-medium text-slate-600 dark:text-slate-400">Amount Paid Now:</span>
                  <button
                    type="button"
                    onClick={() => setInvoiceForm({ ...invoiceForm, paidAmount: formGrandTotal })}
                    className="text-xs text-brand-600 dark:text-brand-400 font-bold hover:underline"
                  >
                    (Pay Full)
                  </button>
                </div>
                <div className="relative w-36">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                    {currencySymbol}
                  </span>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    value={invoiceForm.paidAmount}
                    onChange={(e) => setInvoiceForm({ ...invoiceForm, paidAmount: parseFloat(e.target.value) || 0 })}
                    className="form-input pl-7 pr-3 py-1.5 text-right font-mono font-bold text-sm h-10"
                  />
                </div>
              </div>

              <div className="flex justify-between items-center text-sm font-bold pt-1">
                <span className="text-slate-600 dark:text-slate-400">Balance Due / Payable:</span>
                <span className={`font-mono text-base ${formBalancePayable > 0 ? 'text-rose-500 font-extrabold' : 'text-emerald-500 font-bold'}`}>
                  {currencySymbol} {formBalancePayable.toFixed(2)}
                </span>
              </div>
            </div>
          </div>

          {/* Section 4: Modal Actions */}
          <div className="flex items-center justify-end space-x-3 pt-4 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setIsCreateInvoiceOpen(false)}
              className="px-5 py-2.5 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl text-sm font-bold transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-7 py-2.5 bg-brand-500 hover:bg-brand-600 text-white rounded-xl text-sm font-bold shadow-md hover:shadow-lg flex items-center space-x-2 transition-all transform active:scale-95"
            >
              <CheckCircle2 className="w-5 h-5" />
              <span>Save & Record Purchase</span>
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal 2: View Invoice Details & Stock Receiving */}
      {selectedInvoice && (
        <Modal
          isOpen={isDetailModalOpen}
          onClose={() => setIsDetailModalOpen(false)}
          title={
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-brand-50 dark:bg-brand-950/50 rounded-xl text-brand-600 dark:text-brand-400">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">Purchase Invoice Details</h3>
                <p className="text-xs font-mono text-slate-500 font-normal mt-0.5">{selectedInvoice.invoice_number}</p>
              </div>
            </div>
          }
          maxWidth="5xl"
        >
          <div className="space-y-5">
            {/* Summary details */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 bg-slate-50 dark:bg-slate-850 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 text-xs">
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider mb-0.5">Supplier</span>
                <strong className="text-slate-900 dark:text-white font-bold text-sm">{selectedInvoice.supplier_name}</strong>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider mb-0.5">Destination</span>
                <strong className="text-slate-900 dark:text-white font-bold text-sm">{selectedInvoice.branch_name}</strong>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider mb-0.5">Date</span>
                <span className="text-slate-700 dark:text-slate-300 font-medium text-sm">{new Date(selectedInvoice.created_at).toLocaleDateString()}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider mb-0.5">Status</span>
                <span
                  className={`inline-block px-2.5 py-1 rounded-full text-xs font-black uppercase ${
                    selectedInvoice.status === 'DRAFT'
                      ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400'
                      : 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400'
                  }`}
                >
                  {selectedInvoice.status === 'DRAFT' ? 'Draft / In Transit' : 'Received into Stock'}
                </span>
              </div>
            </div>

            {/* Line items */}
            <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 text-slate-500 font-bold uppercase text-[11px]">
                    <tr>
                      <th className="px-4 py-3">Ingredient Item</th>
                      <th className="px-3 py-3 text-right">Purchased Qty</th>
                      <th className="px-3 py-3 text-right">Inward Base Stock</th>
                      <th className="px-3 py-3 text-right">Purchase Price</th>
                      <th className="px-3 py-3 text-right">Base Cost</th>
                      <th className="px-4 py-3 text-right">Total Price</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                    {invoiceItems.map((it: any) => {
                      const factor = Number(it.conversion_factor) > 0 ? Number(it.conversion_factor) : 1;
                      const baseQ = it.base_quantity !== null && it.base_quantity !== undefined ? Number(it.base_quantity) : Number(it.quantity) * factor;
                      const baseC = it.base_unit_cost !== null && it.base_unit_cost !== undefined ? Number(it.base_unit_cost) : Number(it.unit_price) / factor;
                      const pUnit = it.purchase_unit || it.unit;

                      return (
                        <tr key={it.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                          <td className="px-4 py-3 font-bold text-slate-900 dark:text-white text-sm">
                            {it.ingredient_name}
                          </td>
                          <td className="px-3 py-3 text-right font-mono font-bold text-slate-800 dark:text-slate-200 text-sm">
                            {Number(it.quantity).toLocaleString()} {pUnit}
                          </td>
                          <td className="px-3 py-3 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400 text-sm">
                            {baseQ.toLocaleString()} {it.unit}
                            {pUnit !== it.unit && factor > 1 && (
                              <span className="block text-[10px] text-slate-400 font-normal">
                                (1 {pUnit} = {factor} {it.unit})
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-3 text-right font-mono text-slate-500 text-xs">
                            {currencySymbol} {Number(it.unit_price).toFixed(2)} / {pUnit}
                          </td>
                          <td className="px-3 py-3 text-right font-mono text-slate-500 text-xs">
                            {currencySymbol} {baseC.toFixed(4)} / {it.unit}
                          </td>
                          <td className="px-4 py-3 text-right font-mono font-bold text-brand-600 dark:text-brand-400 text-sm">
                            {currencySymbol} {Number(it.total_price).toFixed(2)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Totals */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-slate-50 dark:bg-slate-850 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 text-xs">
              <div className="space-y-1">
                <p className="text-slate-600 dark:text-slate-400">
                  Recorded By: <strong className="text-slate-900 dark:text-white">{selectedInvoice.recorded_by_name || 'System'}</strong>
                </p>
                {selectedInvoice.notes && <p className="text-slate-500 italic">Notes: {selectedInvoice.notes}</p>}
              </div>
              <div className="text-left sm:text-right space-y-1">
                <p className="text-slate-600 dark:text-slate-400">
                  Grand Total: <strong className="font-mono text-slate-900 dark:text-white font-black text-base">{currencySymbol} {Number(selectedInvoice.total_amount).toLocaleString()}</strong>
                </p>
                <p className="text-slate-500">
                  Paid: <strong className="font-mono text-emerald-500 font-bold">{currencySymbol} {Number(selectedInvoice.paid_amount || 0).toLocaleString()}</strong> • 
                  Balance Due: <strong className="font-mono text-rose-500 font-bold">{currencySymbol} {Number(selectedInvoice.balance_payable || 0).toLocaleString()}</strong>
                </p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-wrap justify-between items-center gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => handleDownloadInvoicePdf(selectedInvoice, invoiceItems)}
                  className="px-4 py-2.5 bg-brand-500 hover:bg-brand-600 text-white rounded-xl text-xs font-bold flex items-center space-x-1.5 shadow-sm transition-all"
                >
                  <Download className="w-4 h-4" />
                  <span>Download A4 PDF</span>
                </button>
                <button
                  type="button"
                  onClick={() => handlePrintInvoicePdf(selectedInvoice, invoiceItems)}
                  className="px-4 py-2.5 bg-slate-900 hover:bg-black text-white rounded-xl text-xs font-bold flex items-center space-x-1.5 shadow-sm transition-all"
                >
                  <Printer className="w-4 h-4" />
                  <span>Print A4 Invoice</span>
                </button>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => setIsDetailModalOpen(false)}
                  className="px-4 py-2.5 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-xl text-xs font-bold"
                >
                  Close
                </button>

                {selectedInvoice.status === 'DRAFT' && (
                  <button
                    type="button"
                    onClick={() => handleReceiveStock(selectedInvoice.id)}
                    disabled={receivingInvoiceId === selectedInvoice.id}
                    className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center space-x-1.5 shadow-md disabled:opacity-50 transition-all"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>{receivingInvoiceId === selectedInvoice.id ? 'Receiving Stock...' : 'Receive Stock & Generate FIFO Lots'}</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* Modal 3: Add Supplier */}
      <Modal
        isOpen={isAddSupplierOpen}
        onClose={() => setIsAddSupplierOpen(false)}
        title={
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-brand-50 dark:bg-brand-950/50 rounded-xl text-brand-600 dark:text-brand-400">
              <Truck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Add Raw Material Supplier</h3>
              <p className="text-xs text-slate-500 font-normal mt-0.5">Register a new vendor for procurement and invoice tracking</p>
            </div>
          </div>
        }
        maxWidth="2xl"
      >
        <form onSubmit={handleCreateSupplier} className="space-y-4">
          <div>
            <label className="form-label">
              Supplier / Company Name <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={supplierForm.name}
              onChange={(e) => setSupplierForm({ ...supplierForm, name: e.target.value })}
              className="form-input"
              placeholder="e.g. Al-Madina Fresh Poultry Supplies"
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="form-label">
                Contact Person Name
              </label>
              <input
                type="text"
                value={supplierForm.contactPerson}
                onChange={(e) => setSupplierForm({ ...supplierForm, contactPerson: e.target.value })}
                className="form-input"
                placeholder="e.g. Haji Muhammad"
              />
            </div>
            <div>
              <label className="form-label">
                Phone Number <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={supplierForm.phone}
                onChange={(e) => setSupplierForm({ ...supplierForm, phone: e.target.value })}
                className="form-input"
                placeholder="e.g. 0300-1234567"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="form-label">
                Email Address
              </label>
              <input
                type="email"
                value={supplierForm.email}
                onChange={(e) => setSupplierForm({ ...supplierForm, email: e.target.value })}
                className="form-input"
                placeholder="e.g. supplier@domain.com"
              />
            </div>
            <div>
              <label className="form-label">
                Tax / NTN Registration Number
              </label>
              <input
                type="text"
                value={supplierForm.taxNumber}
                onChange={(e) => setSupplierForm({ ...supplierForm, taxNumber: e.target.value })}
                className="form-input"
                placeholder="e.g. NTN-987654"
              />
            </div>
          </div>

          <div>
            <label className="form-label">
              Address / Warehouse Location
            </label>
            <input
              type="text"
              value={supplierForm.address}
              onChange={(e) => setSupplierForm({ ...supplierForm, address: e.target.value })}
              className="form-input"
              placeholder="e.g. Wholesale Grain Market, Shop #12"
            />
          </div>

          <div className="flex justify-end space-x-3 pt-4 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setIsAddSupplierOpen(false)}
              className="px-5 py-2.5 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl text-sm font-bold transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-6 py-2.5 bg-brand-600 hover:bg-brand-500 text-white rounded-xl text-sm font-bold shadow-md transition-all"
            >
              Save Supplier
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal 4: Quick Add Item within Purchase */}
      <Modal
        isOpen={isQuickAddItemOpen}
        onClose={() => setIsQuickAddItemOpen(false)}
        title={
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-purple-50 dark:bg-purple-950/50 rounded-xl text-purple-600 dark:text-purple-400">
              <Boxes className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Add New Item to Inventory</h3>
              <p className="text-xs text-slate-500 font-normal mt-0.5">Define new raw ingredient details directly while recording purchase</p>
            </div>
          </div>
        }
        maxWidth="lg"
      >
        <form onSubmit={handleSaveQuickItem} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="form-label">
                Item / Ingredient Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={quickItemForm.name}
                onChange={(e) => setQuickItemForm({ ...quickItemForm, name: e.target.value })}
                placeholder="e.g. Dough, Mozzarella Cheese, Oregano..."
                className="form-input font-bold"
                required
                autoFocus
              />
            </div>

            <div>
              <label className="form-label flex items-center justify-between">
                <span>SKU / Code</span>
                <span className="text-[10px] text-slate-400 font-normal">Optional (auto-generated if blank)</span>
              </label>
              <input
                type="text"
                value={quickItemForm.sku}
                onChange={(e) => setQuickItemForm({ ...quickItemForm, sku: e.target.value })}
                placeholder="Auto-generated (e.g. ING-CHE-xxx)"
                className="form-input font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="form-label mb-0">Category</label>
                <button
                  type="button"
                  onClick={() => setIsQuickAddCategoryOpen(true)}
                  className="text-xs font-bold text-brand-600 dark:text-brand-400 hover:underline flex items-center space-x-1"
                >
                  <Plus className="w-3 h-3" />
                  <span>+ New Category</span>
                </button>
              </div>
              <div className="relative">
                <input
                  type="text"
                  list="quick-item-cats"
                  value={quickItemForm.category}
                  onChange={(e) => setQuickItemForm({ ...quickItemForm, category: e.target.value })}
                  placeholder="Select or type category..."
                  className="form-input font-semibold"
                />
                <datalist id="quick-item-cats">
                  {categories.map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
              </div>
            </div>

            <div>
              <label className="form-label">Unit of Measurement</label>
              <select
                value={quickItemForm.unit}
                onChange={(e) => setQuickItemForm({ ...quickItemForm, unit: e.target.value })}
                className="form-select font-mono font-bold"
              >
                {['KG', 'G', 'L', 'ML', 'PCS', 'PACKET', 'BOX', 'CAN', 'BOTTLE', 'DOZEN', 'TRAY', 'PORTION'].map((u) => (
                  <option key={u} value={u}>{u}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="form-label">Default Purchase Price ({currencySymbol})</label>
              <input
                type="number"
                step="any"
                min="0"
                value={quickItemForm.costPerUnit || ''}
                onChange={(e) => setQuickItemForm({ ...quickItemForm, costPerUnit: parseFloat(e.target.value) || 0 })}
                placeholder="0.00"
                className="form-input font-mono font-bold"
              />
            </div>

            <div>
              <label className="form-label">Low Stock Alert Threshold</label>
              <input
                type="number"
                step="any"
                min="0"
                value={quickItemForm.minStockAlert || ''}
                onChange={(e) => setQuickItemForm({ ...quickItemForm, minStockAlert: parseFloat(e.target.value) || 0 })}
                placeholder="5"
                className="form-input font-mono"
              />
            </div>
          </div>

          <div className="flex justify-end space-x-3 pt-4 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setIsQuickAddItemOpen(false)}
              className="px-4 py-2 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl text-xs font-bold transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-brand-600 hover:bg-brand-500 text-white rounded-xl text-xs font-bold shadow-md transition-all flex items-center space-x-1.5"
            >
              <Plus className="w-4 h-4" />
              <span>Create & Add to Purchase</span>
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal 5: Quick Add Category */}
      <Modal
        isOpen={isQuickAddCategoryOpen}
        onClose={() => setIsQuickAddCategoryOpen(false)}
        title={
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-brand-50 dark:bg-brand-950/50 rounded-xl text-brand-600 dark:text-brand-400">
              <FolderPlus className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Create Inventory Category</h3>
              <p className="text-xs text-slate-500 font-normal mt-0.5">Add a new category for organizing raw ingredients</p>
            </div>
          </div>
        }
        maxWidth="md"
      >
        <form onSubmit={handleSaveQuickCategory} className="space-y-4">
          <div>
            <label className="form-label">
              Category Name <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              placeholder="e.g. Seafood, Sauces, Oils, Desserts..."
              className="form-input font-bold"
              required
              autoFocus
            />
          </div>

          <div className="flex justify-end space-x-3 pt-4 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setIsQuickAddCategoryOpen(false)}
              className="px-4 py-2 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl text-xs font-bold transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-brand-600 hover:bg-brand-500 text-white rounded-xl text-xs font-bold shadow-md transition-all flex items-center space-x-1.5"
            >
              <Plus className="w-4 h-4" />
              <span>Save Category</span>
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
