import React, { useEffect, useState } from 'react';
import { api } from '../../api/client.js';
import { useAuth } from '../../context/AuthContext.js';
import { useToast } from '../../context/ToastContext.js';
import { Modal } from '../../components/common/Modal.js';
import { ActionMenu } from '../../components/common/ActionMenu.js';
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
} from 'lucide-react';
import { StockUnit, Permission } from '@pos/shared';

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

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'DRAFT' | 'RECEIVED'>('ALL');
  const [branchFilter, setBranchFilter] = useState<string>(currentBranchId || 'ALL');

  // Modals
  const [isCreateInvoiceOpen, setIsCreateInvoiceOpen] = useState(false);
  const [isAddSupplierOpen, setIsAddSupplierOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<any | null>(null);
  const [invoiceItems, setInvoiceItems] = useState<any[]>([]);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [receivingInvoiceId, setReceivingInvoiceId] = useState<string | null>(null);

  // New Invoice Form
  const [invoiceForm, setInvoiceForm] = useState({
    branchId: currentBranchId || (branches[0]?.id || ''),
    supplierId: '',
    invoiceNumber: `INV-${Date.now().toString().slice(-6)}`,
    taxAmount: 0,
    paidAmount: 0,
    notes: '',
    items: [
      { ingredientId: '', unit: StockUnit.KG, quantity: 1, unitPrice: 0 },
    ],
  });

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

  const fetchData = async () => {
    try {
      setLoading(true);
      const [purchasesRes, suppliersRes, ingredientsRes] = await Promise.all([
        api.get('/inventory/purchases'),
        api.get('/inventory/suppliers'),
        api.get('/inventory/ingredients'),
      ]);

      setPurchases(purchasesRes.purchases || []);
      setSuppliers(suppliersRes.suppliers || []);
      setIngredients(ingredientsRes.ingredients || []);

      if (suppliersRes.suppliers?.length > 0 && !invoiceForm.supplierId) {
        setInvoiceForm((prev) => ({ ...prev, supplierId: suppliersRes.suppliers[0].id }));
      }
      if (ingredientsRes.ingredients?.length > 0 && !invoiceForm.items[0].ingredientId) {
        const firstIng = ingredientsRes.ingredients[0];
        setInvoiceForm((prev) => ({
          ...prev,
          items: [
            {
              ingredientId: firstIng.id,
              unit: firstIng.unit as StockUnit,
              quantity: 1,
              unitPrice: Number(firstIng.cost_per_unit || 0),
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
    const firstIng = ingredients[0];
    setInvoiceForm((prev) => ({
      ...prev,
      items: [
        ...prev.items,
        {
          ingredientId: firstIng ? firstIng.id : '',
          unit: firstIng ? (firstIng.unit as StockUnit) : StockUnit.KG,
          quantity: 1,
          unitPrice: firstIng ? Number(firstIng.cost_per_unit || 0) : 0,
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

  const updateItemRow = (index: number, field: string, value: any) => {
    setInvoiceForm((prev) => {
      const newItems = [...prev.items];
      if (field === 'ingredientId') {
        const found = ingredients.find((i) => i.id === value);
        newItems[index] = {
          ...newItems[index],
          ingredientId: value,
          unit: found ? (found.unit as StockUnit) : newItems[index].unit,
          unitPrice: found ? Number(found.cost_per_unit || 0) : newItems[index].unitPrice,
        };
      } else {
        newItems[index] = {
          ...newItems[index],
          [field]: value,
        };
      }
      return { ...prev, items: newItems };
    });
  };

  // Compute calculated amounts for current form
  const formSubtotal = invoiceForm.items.reduce((acc, it) => acc + (Number(it.quantity || 0) * Number(it.unitPrice || 0)), 0);
  const formGrandTotal = formSubtotal + Number(invoiceForm.taxAmount || 0);
  const formBalancePayable = Math.max(0, formGrandTotal - Number(invoiceForm.paidAmount || 0));

  const handleCreateInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!invoiceForm.supplierId) {
      error('Please select a supplier');
      return;
    }
    if (!invoiceForm.branchId) {
      error('Please select a destination branch');
      return;
    }
    if (invoiceForm.items.some((it) => !it.ingredientId || it.quantity <= 0)) {
      error('Please provide valid quantities for all ingredients');
      return;
    }

    try {
      await api.post('/inventory/purchases', {
        branchId: invoiceForm.branchId,
        supplierId: invoiceForm.supplierId,
        invoiceNumber: invoiceForm.invoiceNumber,
        taxAmount: Number(invoiceForm.taxAmount || 0),
        paidAmount: Number(invoiceForm.paidAmount || 0),
        notes: invoiceForm.notes,
        items: invoiceForm.items.map((it) => ({
          ingredientId: it.ingredientId,
          unit: it.unit,
          quantity: Number(it.quantity),
          unitPrice: Number(it.unitPrice),
        })),
      });

      success('Purchase invoice draft created successfully');
      setIsCreateInvoiceOpen(false);
      setInvoiceForm({
        branchId: currentBranchId || (branches[0]?.id || ''),
        supplierId: suppliers[0]?.id || '',
        invoiceNumber: `INV-${Date.now().toString().slice(-6)}`,
        taxAmount: 0,
        paidAmount: 0,
        notes: '',
        items: [
          {
            ingredientId: ingredients[0]?.id || '',
            unit: (ingredients[0]?.unit as StockUnit) || StockUnit.KG,
            quantity: 1,
            unitPrice: Number(ingredients[0]?.cost_per_unit || 0),
          },
        ],
      });
      fetchData();
    } catch (err: any) {
      error(err.message || 'Failed to create purchase invoice');
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
      p.supplier_name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'ALL' || p.status === statusFilter;
    const matchesBranch = branchFilter === 'ALL' || p.branch_id === branchFilter;
    return matchesSearch && matchesStatus && matchesBranch;
  });

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
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-brand-600 to-indigo-600 flex items-center justify-center text-white shadow-md">
              <Truck className="w-5 h-5" />
            </div>
            <span>Purchases & Vendor Invoices</span>
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Manage incoming raw material shipments, supplier ledger, and generate automated FIFO inventory lots.
          </p>
        </div>

        {/* Tab Switcher & Quick Actions */}
        <div className="flex items-center space-x-3">
          <div className="flex p-1 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
            <button
              onClick={() => setActiveTab('INVOICES')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeTab === 'INVOICES'
                  ? 'bg-white dark:bg-slate-900 text-brand-600 dark:text-brand-400 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Inward Invoices ({purchases.length})</span>
            </button>
            <button
              onClick={() => setActiveTab('SUPPLIERS')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeTab === 'SUPPLIERS'
                  ? 'bg-white dark:bg-slate-900 text-brand-600 dark:text-brand-400 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>Suppliers ({suppliers.length})</span>
            </button>
          </div>

          {activeTab === 'INVOICES' ? (
            <button
              onClick={() => setIsCreateInvoiceOpen(true)}
              className="flex items-center space-x-2 px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white text-xs font-bold rounded-xl shadow-md transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>New Purchase</span>
            </button>
          ) : (
            <button
              onClick={() => setIsAddSupplierOpen(true)}
              className="flex items-center space-x-2 px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white text-xs font-bold rounded-xl shadow-md transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>Add Supplier</span>
            </button>
          )}
        </div>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Total Purchases</span>
            <div className="w-7 h-7 rounded-lg bg-brand-50 dark:bg-brand-950/50 text-brand-600 dark:text-brand-400 flex items-center justify-center">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <p className="text-xl font-extrabold text-slate-900 dark:text-white font-mono">
            {currencySymbol} {totalPurchasesAmount.toLocaleString()}
          </p>
          <p className="text-[11px] text-slate-400 mt-1">{purchases.length} total purchase shipments recorded</p>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Received Into Stock</span>
            <div className="w-7 h-7 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <p className="text-xl font-extrabold text-emerald-600 dark:text-emerald-400 font-mono">
            {receivedInvoicesCount}
          </p>
          <p className="text-[11px] text-slate-400 mt-1">Active FIFO lots created & stock increased</p>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Draft / In Transit</span>
            <div className="w-7 h-7 rounded-lg bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <p className="text-xl font-extrabold text-amber-600 dark:text-amber-400 font-mono">
            {draftInvoicesCount}
          </p>
          <p className="text-[11px] text-slate-400 mt-1">Awaiting physical receiving at branch</p>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Vendor Debt Payable</span>
            <div className="w-7 h-7 rounded-lg bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 flex items-center justify-center">
              <AlertCircle className="w-4 h-4" />
            </div>
          </div>
          <p className="text-xl font-extrabold text-rose-600 dark:text-rose-400 font-mono">
            {currencySymbol} {totalBalancePayable.toLocaleString()}
          </p>
          <p className="text-[11px] text-slate-400 mt-1">Outstanding balance across all suppliers</p>
        </div>
      </div>

      {/* Main Content Area */}
      {activeTab === 'INVOICES' ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
          {/* Controls Bar */}
          <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 bg-slate-50/50 dark:bg-slate-800/30">
            <div className="flex items-center space-x-2.5 flex-1 max-w-md">
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search by invoice # or supplier..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs focus:ring-2 focus:ring-brand-500 text-slate-900 dark:text-white"
                />
              </div>

              {/* Status Filter */}
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300 focus:ring-2 focus:ring-brand-500"
              >
                <option value="ALL">All Statuses</option>
                <option value="DRAFT">Draft / In Transit</option>
                <option value="RECEIVED">Received into Stock</option>
              </select>

              {/* Branch Filter */}
              {branches.length > 1 && (
                <select
                  value={branchFilter}
                  onChange={(e) => setBranchFilter(e.target.value)}
                  className="px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300 focus:ring-2 focus:ring-brand-500"
                >
                  <option value="ALL">All Branches</option>
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <button
              onClick={fetchData}
              className="p-2 text-slate-500 hover:text-slate-900 dark:hover:text-white rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
              title="Refresh Purchases"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>

          {/* Invoices Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="px-4 py-3">Invoice #</th>
                  <th className="px-4 py-3">Supplier</th>
                  <th className="px-4 py-3">Branch</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3 text-right">Subtotal</th>
                  <th className="px-4 py-3 text-right">Tax</th>
                  <th className="px-4 py-3 text-right">Grand Total</th>
                  <th className="px-4 py-3 text-right">Balance Due</th>
                  <th className="px-4 py-3 text-center">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-slate-700 dark:text-slate-200 font-medium">
                {loading ? (
                  <tr>
                    <td colSpan={10} className="px-4 py-8 text-center text-slate-400">
                      Loading purchase records...
                    </td>
                  </tr>
                ) : filteredPurchases.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="px-4 py-12 text-center text-slate-400">
                      <Truck className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-600 mb-2" />
                      <p className="font-bold text-slate-600 dark:text-slate-300">No purchase invoices found</p>
                      <p className="text-[11px] text-slate-400 mt-1">
                        Record a purchase invoice to receive ingredients from your suppliers into inventory.
                      </p>
                    </td>
                  </tr>
                ) : (
                  filteredPurchases.map((p) => {
                    const isDraft = p.status === 'DRAFT';
                    const balance = Number(p.balance_payable || 0);

                    return (
                      <tr key={p.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                        <td className="px-4 py-3 font-mono font-bold text-brand-600 dark:text-brand-400">
                          {p.invoice_number}
                        </td>
                        <td className="px-4 py-3 font-semibold text-slate-900 dark:text-white">
                          {p.supplier_name}
                        </td>
                        <td className="px-4 py-3 text-slate-500 dark:text-slate-400">
                          {p.branch_name}
                        </td>
                        <td className="px-4 py-3 text-slate-500 dark:text-slate-400">
                          {new Date(p.created_at).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3 text-right font-mono">
                          {currencySymbol} {Number(p.subtotal).toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-slate-500">
                          {currencySymbol} {Number(p.tax_amount || 0).toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-right font-mono font-bold text-slate-900 dark:text-white">
                          {currencySymbol} {Number(p.total_amount).toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-right font-mono font-bold">
                          {balance > 0 ? (
                            <span className="text-rose-500">{currencySymbol} {balance.toLocaleString()}</span>
                          ) : (
                            <span className="text-emerald-500">Paid in Full</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                              isDraft
                                ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border border-amber-300 dark:border-amber-800'
                                : 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-800'
                            }`}
                          >
                            {isDraft ? 'Draft / In Transit' : 'Received into Stock'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right whitespace-nowrap">
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
                                label: 'Print Invoice Slip',
                                icon: Printer,
                                onClick: () => handleViewInvoiceDetails(p),
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
            </table>
          </div>
        </div>
      ) : (
        /* Suppliers View */
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
      )}

      {/* Modal 1: Create Purchase Invoice */}
      <Modal
        isOpen={isCreateInvoiceOpen}
        onClose={() => setIsCreateInvoiceOpen(false)}
        title="Record Inward Purchase Shipment"
        maxWidth="xl"
      >
        <form onSubmit={handleCreateInvoice} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {branches.length > 1 && (
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Destination Branch *
                </label>
                <select
                  value={invoiceForm.branchId}
                  onChange={(e) => setInvoiceForm({ ...invoiceForm, branchId: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-brand-500"
                  required
                >
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name} ({b.code})
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                  Supplier / Vendor *
                </label>
                <button
                  type="button"
                  onClick={() => setIsAddSupplierOpen(true)}
                  className="text-[10px] text-brand-600 dark:text-brand-400 font-bold hover:underline"
                >
                  + Quick Add
                </button>
              </div>
              <select
                value={invoiceForm.supplierId}
                onChange={(e) => setInvoiceForm({ ...invoiceForm, supplierId: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-brand-500"
                required
              >
                <option value="">Select Supplier</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.phone})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Invoice Number *
              </label>
              <input
                type="text"
                value={invoiceForm.invoiceNumber}
                onChange={(e) => setInvoiceForm({ ...invoiceForm, invoiceNumber: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono font-bold focus:ring-2 focus:ring-brand-500"
                placeholder="e.g. INV-100234"
                required
              />
            </div>
          </div>

          {/* Line Items Table */}
          <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden mt-3">
            <div className="bg-slate-100 dark:bg-slate-800/80 px-3 py-2 flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300">
              <span className="flex items-center space-x-1.5">
                <Boxes className="w-3.5 h-3.5 text-brand-500" />
                <span>Purchased Raw Materials / Ingredients</span>
              </span>
              <button
                type="button"
                onClick={addItemRow}
                className="px-2.5 py-1 bg-brand-600 hover:bg-brand-500 text-white rounded-lg text-[11px] font-bold flex items-center space-x-1 transition-colors"
              >
                <Plus className="w-3 h-3" />
                <span>Add Item</span>
              </button>
            </div>

            <div className="p-2 space-y-2 max-h-56 overflow-y-auto">
              {invoiceForm.items.map((row, idx) => (
                <div key={idx} className="flex items-center space-x-2 bg-slate-50 dark:bg-slate-800/50 p-2 rounded-lg border border-slate-200 dark:border-slate-700/60">
                  <div className="flex-1">
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">Ingredient</label>
                    <select
                      value={row.ingredientId}
                      onChange={(e) => updateItemRow(idx, 'ingredientId', e.target.value)}
                      className="w-full px-2 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs"
                      required
                    >
                      {ingredients.map((ing) => (
                        <option key={ing.id} value={ing.id}>
                          {ing.name} ({ing.unit})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="w-24">
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">Unit</label>
                    <select
                      value={row.unit}
                      onChange={(e) => updateItemRow(idx, 'unit', e.target.value)}
                      className="w-full px-2 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-mono"
                    >
                      {Object.values(StockUnit).map((u) => (
                        <option key={u} value={u}>
                          {u}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="w-24">
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">Quantity</label>
                    <input
                      type="number"
                      step="any"
                      min="0.001"
                      value={row.quantity}
                      onChange={(e) => updateItemRow(idx, 'quantity', parseFloat(e.target.value) || 0)}
                      className="w-full px-2 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-mono font-bold"
                      required
                    />
                  </div>

                  <div className="w-28">
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">Unit Price ({currencySymbol})</label>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      value={row.unitPrice}
                      onChange={(e) => updateItemRow(idx, 'unitPrice', parseFloat(e.target.value) || 0)}
                      className="w-full px-2 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-mono font-bold"
                      required
                    />
                  </div>

                  <div className="w-28 text-right">
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">Total</label>
                    <div className="py-1.5 font-mono font-bold text-xs text-brand-600 dark:text-brand-400">
                      {currencySymbol} {(row.quantity * row.unitPrice).toFixed(2)}
                    </div>
                  </div>

                  {invoiceForm.items.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeItemRow(idx)}
                      className="p-1.5 text-slate-400 hover:text-rose-500 rounded-lg transition-colors mt-3"
                      title="Remove Row"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Tax, Payment, and Financial Calculations */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Purchase Notes / Remarks
              </label>
              <textarea
                value={invoiceForm.notes}
                onChange={(e) => setInvoiceForm({ ...invoiceForm, notes: e.target.value })}
                rows={3}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs focus:ring-2 focus:ring-brand-500"
                placeholder="Optional supplier terms, delivery slip #, or carrier info..."
              />
            </div>

            <div className="bg-slate-50 dark:bg-slate-800/80 p-3 rounded-xl border border-slate-200 dark:border-slate-700/80 space-y-2 text-xs">
              <div className="flex justify-between text-slate-600 dark:text-slate-400">
                <span>Subtotal ({invoiceForm.items.length} items):</span>
                <span className="font-mono font-bold text-slate-900 dark:text-white">
                  {currencySymbol} {formSubtotal.toFixed(2)}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-slate-600 dark:text-slate-400">Tax Amount ({currencySymbol}):</span>
                <input
                  type="number"
                  step="any"
                  min="0"
                  value={invoiceForm.taxAmount}
                  onChange={(e) => setInvoiceForm({ ...invoiceForm, taxAmount: parseFloat(e.target.value) || 0 })}
                  className="w-28 px-2 py-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-right font-mono font-bold text-xs"
                />
              </div>

              <div className="flex justify-between border-t border-slate-200 dark:border-slate-700 pt-1 text-sm font-extrabold text-slate-900 dark:text-white">
                <span>Grand Total:</span>
                <span className="font-mono text-brand-600 dark:text-brand-400">
                  {currencySymbol} {formGrandTotal.toFixed(2)}
                </span>
              </div>

              <div className="flex items-center justify-between pt-1">
                <div className="flex items-center space-x-1.5">
                  <span className="text-slate-600 dark:text-slate-400">Paid Now:</span>
                  <button
                    type="button"
                    onClick={() => setInvoiceForm({ ...invoiceForm, paidAmount: formGrandTotal })}
                    className="text-[10px] text-brand-600 dark:text-brand-400 font-bold hover:underline"
                  >
                    (Full)
                  </button>
                </div>
                <input
                  type="number"
                  step="any"
                  min="0"
                  value={invoiceForm.paidAmount}
                  onChange={(e) => setInvoiceForm({ ...invoiceForm, paidAmount: parseFloat(e.target.value) || 0 })}
                  className="w-28 px-2 py-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-right font-mono font-bold text-xs"
                />
              </div>

              <div className="flex justify-between text-xs font-bold pt-1 border-t border-slate-200 dark:border-slate-700">
                <span className="text-slate-600 dark:text-slate-400">Balance Payable:</span>
                <span className={`font-mono ${formBalancePayable > 0 ? 'text-rose-500' : 'text-emerald-500'}`}>
                  {currencySymbol} {formBalancePayable.toFixed(2)}
                </span>
              </div>
            </div>
          </div>

          <div className="flex justify-end space-x-2 pt-3 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setIsCreateInvoiceOpen(false)}
              className="px-4 py-2 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-xl text-xs font-bold"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-brand-600 hover:bg-brand-500 text-white rounded-xl text-xs font-bold shadow-md"
            >
              Save Invoice (Draft)
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal 2: View Invoice Details & Stock Receiving */}
      {selectedInvoice && (
        <Modal
          isOpen={isDetailModalOpen}
          onClose={() => setIsDetailModalOpen(false)}
          title={`Purchase Invoice: ${selectedInvoice.invoice_number}`}
          maxWidth="lg"
        >
          <div className="space-y-4">
            {/* Summary details */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 dark:bg-slate-800/60 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700/60 text-xs">
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Supplier</span>
                <strong className="text-slate-900 dark:text-white font-bold">{selectedInvoice.supplier_name}</strong>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Destination</span>
                <strong className="text-slate-900 dark:text-white font-bold">{selectedInvoice.branch_name}</strong>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Date</span>
                <span className="text-slate-700 dark:text-slate-300">{new Date(selectedInvoice.created_at).toLocaleDateString()}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Status</span>
                <span
                  className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
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
            <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 text-slate-500 font-bold uppercase text-[10px]">
                  <tr>
                    <th className="px-3 py-2">Ingredient Item</th>
                    <th className="px-3 py-2 text-center">Unit</th>
                    <th className="px-3 py-2 text-right">Quantity</th>
                    <th className="px-3 py-2 text-right">Unit Price</th>
                    <th className="px-3 py-2 text-right">Total Price</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                  {invoiceItems.map((it: any) => (
                    <tr key={it.id}>
                      <td className="px-3 py-2 font-bold text-slate-900 dark:text-white">
                        {it.ingredient_name}
                      </td>
                      <td className="px-3 py-2 text-center font-mono">
                        {it.unit}
                      </td>
                      <td className="px-3 py-2 text-right font-mono font-bold">
                        {Number(it.quantity).toLocaleString()}
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-slate-500">
                        {currencySymbol} {Number(it.unit_price).toFixed(2)}
                      </td>
                      <td className="px-3 py-2 text-right font-mono font-bold text-brand-600 dark:text-brand-400">
                        {currencySymbol} {Number(it.total_price).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Totals */}
            <div className="flex justify-between items-center bg-slate-50 dark:bg-slate-800/40 p-3 rounded-xl border border-slate-200 dark:border-slate-700/80 text-xs">
              <div className="space-y-0.5">
                <p className="text-slate-500">Recorded By: <strong className="text-slate-700 dark:text-slate-300">{selectedInvoice.recorded_by_name || 'System'}</strong></p>
                {selectedInvoice.notes && <p className="text-slate-400 italic">Notes: {selectedInvoice.notes}</p>}
              </div>
              <div className="text-right space-y-1">
                <p className="text-slate-500">Grand Total: <strong className="font-mono text-slate-900 dark:text-white font-extrabold text-sm">{currencySymbol} {Number(selectedInvoice.total_amount).toLocaleString()}</strong></p>
                <p className="text-slate-500">
                  Paid: <strong className="font-mono text-emerald-500 font-bold">{currencySymbol} {Number(selectedInvoice.paid_amount || 0).toLocaleString()}</strong> • 
                  Balance Due: <strong className="font-mono text-rose-500 font-bold">{currencySymbol} {Number(selectedInvoice.balance_payable || 0).toLocaleString()}</strong>
                </p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-between items-center pt-3 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setIsDetailModalOpen(false)}
                className="px-4 py-2 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-xl text-xs font-bold"
              >
                Close
              </button>

              {selectedInvoice.status === 'DRAFT' && (
                <button
                  type="button"
                  onClick={() => handleReceiveStock(selectedInvoice.id)}
                  disabled={receivingInvoiceId === selectedInvoice.id}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center space-x-1.5 shadow-md disabled:opacity-50"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{receivingInvoiceId === selectedInvoice.id ? 'Receiving Stock...' : 'Receive Stock & Generate FIFO Lots'}</span>
                </button>
              )}
            </div>
          </div>
        </Modal>
      )}

      {/* Modal 3: Add Supplier */}
      <Modal
        isOpen={isAddSupplierOpen}
        onClose={() => setIsAddSupplierOpen(false)}
        title="Add Raw Material Supplier"
        maxWidth="md"
      >
        <form onSubmit={handleCreateSupplier} className="space-y-3">
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Supplier / Company Name *
            </label>
            <input
              type="text"
              value={supplierForm.name}
              onChange={(e) => setSupplierForm({ ...supplierForm, name: e.target.value })}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs focus:ring-2 focus:ring-brand-500"
              placeholder="e.g. Al-Madina Fresh Poultry Supplies"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Contact Person
              </label>
              <input
                type="text"
                value={supplierForm.contactPerson}
                onChange={(e) => setSupplierForm({ ...supplierForm, contactPerson: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs focus:ring-2 focus:ring-brand-500"
                placeholder="e.g. Haji Muhammad"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Phone Number *
              </label>
              <input
                type="text"
                value={supplierForm.phone}
                onChange={(e) => setSupplierForm({ ...supplierForm, phone: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs focus:ring-2 focus:ring-brand-500"
                placeholder="e.g. 0300-1234567"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Email Address
              </label>
              <input
                type="email"
                value={supplierForm.email}
                onChange={(e) => setSupplierForm({ ...supplierForm, email: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs focus:ring-2 focus:ring-brand-500"
                placeholder="e.g. supplier@domain.com"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Tax / NTN Number
              </label>
              <input
                type="text"
                value={supplierForm.taxNumber}
                onChange={(e) => setSupplierForm({ ...supplierForm, taxNumber: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs focus:ring-2 focus:ring-brand-500"
                placeholder="e.g. NTN-987654"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Address / Warehouse Location
            </label>
            <input
              type="text"
              value={supplierForm.address}
              onChange={(e) => setSupplierForm({ ...supplierForm, address: e.target.value })}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs focus:ring-2 focus:ring-brand-500"
              placeholder="e.g. Wholesale Grain Market, Shop #12"
            />
          </div>

          <div className="flex justify-end space-x-2 pt-3 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setIsAddSupplierOpen(false)}
              className="px-4 py-2 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-xl text-xs font-bold"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-brand-600 hover:bg-brand-500 text-white rounded-xl text-xs font-bold shadow-md"
            >
              Save Supplier
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
