import React, { useEffect, useState } from 'react';
import { api } from '../../api/client.js';
import { Modal } from '../../components/common/Modal.js';
import { Users, Plus, ShieldCheck, Mail, Lock } from 'lucide-react';
import { SystemRole } from '@pos/shared';

export const StaffManagement: React.FC = () => {
  const [staff, setStaff] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddOpen, setIsAddOpen] = useState(false);

  const [form, setForm] = useState({
    fullName: '',
    email: '',
    password: 'Password123!',
    role: SystemRole.CASHIER,
    branchId: '',
  });

  const fetchData = async () => {
    try {
      const [staffRes, branchRes] = await Promise.all([
        api.get('/restaurant/users'),
        api.get('/restaurant/branches'),
      ]);
      setStaff(staffRes.users || []);
      setBranches(branchRes.branches || []);
      if (branchRes.branches?.length > 0 && !form.branchId) {
        setForm((prev) => ({ ...prev, branchId: branchRes.branches[0].id }));
      }
    } catch (err) {
      console.error('Failed to load staff:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreateStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/restaurant/users', form);
      setIsAddOpen(false);
      setForm({
        fullName: '',
        email: '',
        password: 'Password123!',
        role: SystemRole.CASHIER,
        branchId: branches[0]?.id || '',
      });
      fetchData();
    } catch (err: any) {
      alert(err.message || 'Failed to add staff member');
    }
  };

  return (
    <div className="p-6 sm:p-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Staff & Roles Management</h1>
          <p className="text-xs text-slate-500 mt-1">
            Manage your restaurant employees, assign roles (Cashiers, Managers, Kitchen), and permissions
          </p>
        </div>
        <button
          onClick={() => setIsAddOpen(true)}
          className="flex items-center space-x-1.5 bg-brand-500 hover:bg-brand-600 text-white px-4 py-2 rounded-xl font-bold text-xs shadow-md transition-all self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Add Employee</span>
        </button>
      </div>

      {/* Staff Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase font-semibold">
              <tr>
                <th className="px-6 py-3.5">Employee Name</th>
                <th className="px-6 py-3.5">Email (Login)</th>
                <th className="px-6 py-3.5">Assigned Role</th>
                <th className="px-6 py-3.5">Branch Location</th>
                <th className="px-6 py-3.5">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {staff.map((u) => (
                <tr key={u.id} className="hover:bg-slate-50/70 transition-colors">
                  <td className="px-6 py-3.5 font-bold text-slate-900">{u.full_name}</td>
                  <td className="px-6 py-3.5 text-slate-600">{u.email}</td>
                  <td className="px-6 py-3.5">
                    <span className="font-semibold text-brand-600 bg-brand-50 px-2 py-0.5 rounded-md">
                      {u.role.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-6 py-3.5 text-slate-600 font-medium">
                    {u.branch_name || 'All Branches'}
                  </td>
                  <td className="px-6 py-3.5">
                    <span
                      className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        u.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {u.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Add Staff */}
      <Modal isOpen={isAddOpen} onClose={() => setIsAddOpen(false)} title="Add Restaurant Staff Member" maxWidth="md">
        <form onSubmit={handleCreateStaff} className="space-y-4 text-xs">
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Full Name</label>
            <input
              type="text"
              required
              placeholder="e.g. Asad Ali"
              value={form.fullName}
              onChange={(e) => setForm({ ...form, fullName: e.target.value })}
              className="w-full border rounded-lg px-3 py-2 text-xs"
            />
          </div>
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Email Address (Login)</label>
            <input
              type="email"
              required
              placeholder="asad@restaurant.com"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="w-full border rounded-lg px-3 py-2 text-xs"
            />
          </div>
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Password</label>
            <input
              type="password"
              required
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              className="w-full border rounded-lg px-3 py-2 text-xs"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">System Role</label>
              <select
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value as any })}
                className="w-full border rounded-lg px-3 py-2 text-xs font-bold"
              >
                <option value={SystemRole.CASHIER}>Cashier (POS Checkout)</option>
                <option value={SystemRole.WAITER}>Waiter / Server (Orders & Tables)</option>
                <option value={SystemRole.KITCHEN_STAFF}>Kitchen Staff (KDS)</option>
                <option value={SystemRole.BRANCH_MANAGER}>Branch Manager</option>
                <option value={SystemRole.INVENTORY_MANAGER}>Inventory Manager</option>
                <option value={SystemRole.ACCOUNTANT}>Accountant (Reports & Finance)</option>
                <option value={SystemRole.RESTAURANT_ADMIN}>Restaurant Administrator</option>
              </select>
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Assigned Branch</label>
              <select
                value={form.branchId}
                onChange={(e) => setForm({ ...form, branchId: e.target.value })}
                className="w-full border rounded-lg px-3 py-2 text-xs"
              >
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex justify-end space-x-2 pt-3 border-t">
            <button
              type="button"
              onClick={() => setIsAddOpen(false)}
              className="px-4 py-2 border rounded-lg text-slate-600"
            >
              Cancel
            </button>
            <button type="submit" className="px-4 py-2 bg-brand-500 text-white rounded-lg font-bold">
              Add Staff Member
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
