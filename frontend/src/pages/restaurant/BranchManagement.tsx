import React, { useEffect, useState } from 'react';
import { api } from '../../api/client.js';
import { Modal } from '../../components/common/Modal.js';
import { ActionMenu, ActionMenuItem } from '../../components/common/ActionMenu.js';
import { Store, Plus, MapPin, Phone, Edit2, Trash2, CheckCircle2, ShieldCheck, Building2 } from 'lucide-react';

export const BranchManagement: React.FC = () => {
  const [branches, setBranches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingBranch, setEditingBranch] = useState<any | null>(null);

  const [form, setForm] = useState({
    name: '',
    code: '',
    phone: '',
    email: '',
    address: '',
    city: 'Karachi',
    isMainBranch: false,
  });

  const [editForm, setEditForm] = useState({
    name: '',
    code: '',
    phone: '',
    email: '',
    address: '',
    city: 'Karachi',
    isMainBranch: false,
    isActive: true,
  });

  const fetchBranches = async () => {
    try {
      const data = await api.get('/restaurant/branches');
      setBranches(data.branches || []);
    } catch (err) {
      console.error('Failed to load branches:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBranches();
  }, []);

  const handleCreateBranch = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/restaurant/branches', form);
      setIsAddOpen(false);
      setForm({
        name: '',
        code: '',
        phone: '',
        email: '',
        address: '',
        city: 'Karachi',
        isMainBranch: false,
      });
      fetchBranches();
    } catch (err: any) {
      alert(err.message || 'Failed to add branch. Check your subscription limits.');
    }
  };

  const handleOpenEdit = (branch: any) => {
    setEditingBranch(branch);
    setEditForm({
      name: branch.name || '',
      code: branch.code || '',
      phone: branch.phone || '',
      email: branch.email || '',
      address: branch.address || '',
      city: branch.city || 'Karachi',
      isMainBranch: branch.is_main_branch || false,
      isActive: branch.is_active !== undefined ? branch.is_active : true,
    });
    setIsEditOpen(true);
  };

  const handleUpdateBranch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingBranch) return;
    try {
      await api.put(`/restaurant/branches/${editingBranch.id}`, editForm);
      setIsEditOpen(false);
      setEditingBranch(null);
      fetchBranches();
    } catch (err: any) {
      alert(err.message || 'Failed to update branch');
    }
  };

  const handleSetMainBranch = async (branch: any) => {
    if (branch.is_main_branch) return;
    if (!confirm(`Are you sure you want to designate "${branch.name}" as the primary flagship branch?`)) return;
    try {
      await api.put(`/restaurant/branches/${branch.id}`, { isMainBranch: true });
      fetchBranches();
    } catch (err: any) {
      alert(err.message || 'Failed to set main branch');
    }
  };

  const handleDeleteBranch = async (branch: any) => {
    if (branch.is_main_branch) {
      alert('Cannot delete the primary flagship branch. Please designate another branch as primary first.');
      return;
    }
    if (!confirm(`Are you sure you want to delete or deactivate branch "${branch.name}" (${branch.code})?`)) return;
    try {
      const res = await api.delete(`/restaurant/branches/${branch.id}`);
      alert(res.message || 'Branch removed successfully');
      fetchBranches();
    } catch (err: any) {
      alert(err.message || 'Failed to remove branch');
    }
  };

  return (
    <div className="p-6 sm:p-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Branches Management</h1>
          <p className="text-xs text-slate-500 mt-1">
            Manage your restaurant locations, branch-specific stock, and regional POS registers
          </p>
        </div>
        <button
          onClick={() => setIsAddOpen(true)}
          className="flex items-center space-x-1.5 bg-brand-500 hover:bg-brand-600 text-white px-4 py-2 rounded-xl font-bold text-xs shadow-md transition-all self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Add Location / Branch</span>
        </button>
      </div>

      {/* Branches Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {branches.map((b) => {
          const menuActions: ActionMenuItem[] = [
            {
              label: 'Edit Branch Details',
              icon: <Edit2 className="w-3.5 h-3.5" />,
              onClick: () => handleOpenEdit(b),
            },
            ...(!b.is_main_branch
              ? [
                  {
                    label: 'Set as Main Flagship',
                    icon: <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />,
                    onClick: () => handleSetMainBranch(b),
                  },
                ]
              : []),
            {
              label: 'Delete Location',
              icon: <Trash2 className="w-3.5 h-3.5" />,
              variant: 'danger',
              disabled: b.is_main_branch,
              onClick: () => handleDeleteBranch(b),
            },
          ];

          return (
            <div key={b.id} className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-3 text-xs relative hover:border-slate-300 transition-all">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <span className="font-mono font-bold text-[10px] text-brand-600 bg-brand-50 px-2 py-0.5 rounded border border-brand-100">
                    {b.code}
                  </span>
                  {b.is_main_branch ? (
                    <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 flex items-center space-x-1">
                      <ShieldCheck className="w-3 h-3 text-emerald-600" />
                      <span>Main Flagship</span>
                    </span>
                  ) : !b.is_active ? (
                    <span className="text-[10px] font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200">
                      Inactive
                    </span>
                  ) : null}
                </div>

                {/* 3-dots Action Menu */}
                <ActionMenu items={menuActions} />
              </div>

              <div>
                <h3 className="text-base font-extrabold text-slate-900">{b.name}</h3>
                <p className="text-slate-500 flex items-center space-x-1 mt-1">
                  <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span>{b.address}, {b.city}</span>
                </p>
                <p className="text-slate-500 flex items-center space-x-1 mt-0.5">
                  <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span>{b.phone}</span>
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal: Add Branch */}
      <Modal
        isOpen={isAddOpen}
        onClose={() => setIsAddOpen(false)}
        title={
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-brand-50 dark:bg-brand-950/50 rounded-xl text-brand-600 dark:text-brand-400">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Add Restaurant Location</h3>
              <p className="text-xs text-slate-500 font-normal mt-0.5">Register an outlet branch for orders, kitchen, and inventory</p>
            </div>
          </div>
        }
        maxWidth="xl"
      >
        <form onSubmit={handleCreateBranch} className="space-y-4">
          <div>
            <label className="form-label">Branch Name <span className="text-rose-500">*</span></label>
            <input
              type="text"
              required
              placeholder="e.g. Gulshan Outlet, DHA Phase 6"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="form-input"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="form-label">Branch Code <span className="text-rose-500">*</span></label>
              <input
                type="text"
                required
                placeholder="GUL-01"
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                className="form-input font-mono font-bold"
              />
            </div>
            <div>
              <label className="form-label">Phone Number <span className="text-rose-500">*</span></label>
              <input
                type="text"
                required
                placeholder="021-111-222-333"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className="form-input"
              />
            </div>
          </div>
          <div>
            <label className="form-label">Physical Address <span className="text-rose-500">*</span></label>
            <input
              type="text"
              required
              placeholder="e.g. Plot 42, Block 13-A, Main University Road"
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              className="form-input"
            />
          </div>
          <div>
            <label className="form-label">City <span className="text-rose-500">*</span></label>
            <input
              type="text"
              required
              placeholder="e.g. Karachi, Lahore, Islamabad"
              value={form.city}
              onChange={(e) => setForm({ ...form, city: e.target.value })}
              className="form-input"
            />
          </div>
          <div className="pt-2">
            <button
              type="submit"
              className="w-full h-11 bg-brand-500 hover:bg-brand-600 text-white font-bold rounded-xl text-sm shadow-md hover:shadow-lg transition-all flex items-center justify-center space-x-2"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Create Branch Location</span>
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal: Edit Branch */}
      <Modal
        isOpen={isEditOpen}
        onClose={() => { setIsEditOpen(false); setEditingBranch(null); }}
        title={
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-brand-50 dark:bg-brand-950/50 rounded-xl text-brand-600 dark:text-brand-400">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Edit Branch Location</h3>
              <p className="text-xs text-slate-500 font-normal mt-0.5">Update outlet contact information and physical address</p>
            </div>
          </div>
        }
        maxWidth="xl"
      >
        <form onSubmit={handleUpdateBranch} className="space-y-4">
          <div>
            <label className="form-label">Branch Name <span className="text-rose-500">*</span></label>
            <input
              type="text"
              required
              value={editForm.name}
              onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
              className="form-input"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="form-label">Branch Code <span className="text-rose-500">*</span></label>
              <input
                type="text"
                required
                value={editForm.code}
                onChange={(e) => setEditForm({ ...editForm, code: e.target.value.toUpperCase() })}
                className="form-input font-mono font-bold"
              />
            </div>
            <div>
              <label className="form-label">Phone Number <span className="text-rose-500">*</span></label>
              <input
                type="text"
                required
                value={editForm.phone}
                onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                className="form-input"
              />
            </div>
          </div>
          <div>
            <label className="form-label">Physical Address <span className="text-rose-500">*</span></label>
            <input
              type="text"
              required
              value={editForm.address}
              onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
              className="form-input"
            />
          </div>
          <div>
            <label className="form-label">City <span className="text-rose-500">*</span></label>
            <input
              type="text"
              required
              value={editForm.city}
              onChange={(e) => setEditForm({ ...editForm, city: e.target.value })}
              className="form-input"
            />
          </div>
          <div className="flex items-center space-x-3 pt-2">
            <input
              type="checkbox"
              id="editIsMainBranch"
              checked={editForm.isMainBranch}
              onChange={(e) => setEditForm({ ...editForm, isMainBranch: e.target.checked })}
              className="w-4 h-4 rounded text-brand-600 focus:ring-brand-500"
            />
            <label htmlFor="editIsMainBranch" className="text-xs font-bold text-slate-700 dark:text-slate-300 cursor-pointer">
              Designate as Main Flagship Branch
            </label>
          </div>
          <div className="pt-2">
            <button
              type="submit"
              className="w-full h-11 bg-brand-500 hover:bg-brand-600 text-white font-bold rounded-xl text-sm shadow-md hover:shadow-lg transition-all flex items-center justify-center space-x-2"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Save Branch Changes</span>
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
