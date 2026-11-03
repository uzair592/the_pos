import React, { useEffect, useState } from 'react';
import { api } from '../../api/client.js';
import { Modal } from '../../components/common/Modal.js';
import { Store, Plus, MapPin, Phone } from 'lucide-react';

export const BranchManagement: React.FC = () => {
  const [branches, setBranches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddOpen, setIsAddOpen] = useState(false);

  const [form, setForm] = useState({
    name: '',
    code: '',
    phone: '',
    email: '',
    address: '',
    city: 'Karachi',
    isMainBranch: false,
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
        {branches.map((b) => (
          <div key={b.id} className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-3 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-mono font-bold text-[10px] text-brand-600 bg-brand-50 px-2 py-0.5 rounded">
                {b.code}
              </span>
              {b.is_main_branch && (
                <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                  Main Flagship
                </span>
              )}
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
        ))}
      </div>

      {/* Modal: Add Branch */}
      <Modal isOpen={isAddOpen} onClose={() => setIsAddOpen(false)} title="Add Restaurant Location" maxWidth="md">
        <form onSubmit={handleCreateBranch} className="space-y-4 text-xs">
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Branch Name</label>
            <input
              type="text"
              required
              placeholder="e.g. Gulshan Outlet"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full border rounded-lg px-3 py-2 text-xs"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Branch Code</label>
              <input
                type="text"
                required
                placeholder="GUL-01"
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                className="w-full border rounded-lg px-3 py-2 text-xs font-mono"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Phone</label>
              <input
                type="text"
                required
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className="w-full border rounded-lg px-3 py-2 text-xs"
              />
            </div>
          </div>
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Address</label>
            <input
              type="text"
              required
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              className="w-full border rounded-lg px-3 py-2 text-xs"
            />
          </div>
          <div>
            <label className="block font-semibold text-slate-700 mb-1">City</label>
            <input
              type="text"
              required
              value={form.city}
              onChange={(e) => setForm({ ...form, city: e.target.value })}
              className="w-full border rounded-lg px-3 py-2 text-xs"
            />
          </div>
          <button type="submit" className="w-full bg-brand-500 text-white font-bold py-2 rounded-lg">
            Create Branch
          </button>
        </form>
      </Modal>
    </div>
  );
};
