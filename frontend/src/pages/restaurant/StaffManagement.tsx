import React, { useEffect, useState } from 'react';
import { api } from '../../api/client.js';
import { useToast } from '../../context/ToastContext.js';
import { Modal } from '../../components/common/Modal.js';
import {
  Users,
  Plus,
  ShieldCheck,
  Mail,
  Lock,
  Edit2,
  KeyRound,
  Search,
  CheckCircle2,
  XCircle,
  Power,
  RefreshCw,
  Eye,
  EyeOff,
  Building2,
  Sparkles,
  Shield,
  UserCheck,
  AlertCircle,
} from 'lucide-react';
import { SystemRole } from '@pos/shared';

export const StaffManagement: React.FC = () => {
  const { success, error } = useToast();

  const [staff, setStaff] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedBranch, setSelectedBranch] = useState('ALL');
  const [selectedRole, setSelectedRole] = useState('ALL');

  // Add Employee Modal
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [addForm, setAddForm] = useState({
    fullName: '',
    email: '',
    password: 'Password123!',
    role: SystemRole.CASHIER,
    branchId: '',
  });

  // Edit Employee Modal
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState<any | null>(null);
  const [editForm, setEditForm] = useState({
    fullName: '',
    email: '',
    password: '',
    role: SystemRole.CASHIER,
    branchId: '',
    isActive: true,
  });
  const [showEditPassword, setShowEditPassword] = useState(false);

  // Quick Password Reset Modal
  const [isResetPasswordOpen, setIsResetPasswordOpen] = useState(false);
  const [resetStaffTarget, setResetStaffTarget] = useState<any | null>(null);
  const [newResetPassword, setNewResetPassword] = useState('');
  const [showResetPassword, setShowResetPassword] = useState(false);

  const fetchData = async () => {
    try {
      const [staffRes, branchRes] = await Promise.all([
        api.get('/restaurant/users'),
        api.get('/restaurant/branches'),
      ]);
      setStaff(staffRes.users || []);
      setBranches(branchRes.branches || []);
      if (branchRes.branches?.length > 0 && !addForm.branchId) {
        setAddForm((prev) => ({ ...prev, branchId: branchRes.branches[0].id }));
      }
    } catch (err: any) {
      console.error('Failed to load staff:', err);
      error(err.message || 'Failed to load staff');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Helper to generate a strong temporary password
  const generateRandomPassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
    let res = 'Pass#';
    for (let i = 0; i < 4; i++) {
      res += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    res += '!';
    return res;
  };

  // Add Employee Handler
  const handleCreateStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addForm.fullName.trim() || !addForm.email.trim() || !addForm.password) {
      error('Please fill in all required fields');
      return;
    }
    try {
      await api.post('/restaurant/users', {
        fullName: addForm.fullName.trim(),
        email: addForm.email.toLowerCase().trim(),
        password: addForm.password,
        role: addForm.role,
        branchId: addForm.branchId || null,
      });
      success(`Employee "${addForm.fullName}" added successfully`);
      setIsAddOpen(false);
      setAddForm({
        fullName: '',
        email: '',
        password: 'Password123!',
        role: SystemRole.CASHIER,
        branchId: branches[0]?.id || '',
      });
      fetchData();
    } catch (err: any) {
      error(err.message || 'Failed to add staff member');
    }
  };

  // Open Edit Modal
  const handleOpenEdit = (user: any) => {
    setEditingStaff(user);
    setEditForm({
      fullName: user.full_name || '',
      email: user.email || '',
      password: '',
      role: user.role || SystemRole.CASHIER,
      branchId: user.branch_id || (branches[0]?.id || ''),
      isActive: user.is_active !== false,
    });
    setShowEditPassword(false);
    setIsEditOpen(true);
  };

  // Save Edit Employee
  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStaff) return;
    if (!editForm.fullName.trim()) {
      error('Full Name is required');
      return;
    }
    if (!editForm.email.trim()) {
      error('Email / Username is required');
      return;
    }

    try {
      const payload: any = {
        fullName: editForm.fullName.trim(),
        email: editForm.email.toLowerCase().trim(),
        role: editForm.role,
        branchId: editForm.branchId || null,
        isActive: editForm.isActive,
      };

      if (editForm.password && editForm.password.trim().length > 0) {
        if (editForm.password.trim().length < 6) {
          error('Password must be at least 6 characters');
          return;
        }
        payload.password = editForm.password.trim();
      }

      await api.put(`/restaurant/users/${editingStaff.id}`, payload);
      success(`Updated employee details for "${editForm.fullName}"`);
      setIsEditOpen(false);
      setEditingStaff(null);
      fetchData();
    } catch (err: any) {
      error(err.message || 'Failed to update employee details');
    }
  };

  // Open Quick Password Reset Modal
  const handleOpenPasswordReset = (user: any) => {
    setResetStaffTarget(user);
    setNewResetPassword(generateRandomPassword());
    setShowResetPassword(true);
    setIsResetPasswordOpen(true);
  };

  // Submit Quick Password Reset
  const handleSavePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetStaffTarget) return;
    if (!newResetPassword || newResetPassword.trim().length < 6) {
      error('Password must be at least 6 characters');
      return;
    }

    try {
      await api.put(`/restaurant/users/${resetStaffTarget.id}`, {
        password: newResetPassword.trim(),
      });
      success(`Password reset successfully for ${resetStaffTarget.full_name}`);
      setIsResetPasswordOpen(false);
      setResetStaffTarget(null);
      setNewResetPassword('');
      fetchData();
    } catch (err: any) {
      error(err.message || 'Failed to reset password');
    }
  };

  // Toggle Active/Inactive Status
  const handleToggleStatus = async (user: any) => {
    try {
      await api.put(`/restaurant/users/${user.id}`, {
        isActive: !user.is_active,
      });
      success(`Employee "${user.full_name}" is now ${!user.is_active ? 'Active' : 'Inactive'}`);
      fetchData();
    } catch (err: any) {
      error(err.message || 'Failed to change employee status');
    }
  };

  // Filtered Staff
  const filteredStaff = staff.filter((u) => {
    const matchesSearch =
      u.full_name?.toLowerCase().includes(search.toLowerCase()) ||
      u.email?.toLowerCase().includes(search.toLowerCase()) ||
      u.role?.toLowerCase().includes(search.toLowerCase());

    const matchesBranch =
      selectedBranch === 'ALL' ||
      u.branch_id === selectedBranch ||
      (!u.branch_id && selectedBranch === 'ALL');

    const matchesRole = selectedRole === 'ALL' || u.role === selectedRole;

    return matchesSearch && matchesBranch && matchesRole;
  });

  const getRoleBadge = (role: string) => {
    const r = (role || '').toUpperCase();
    if (r === SystemRole.RESTAURANT_OWNER || r === 'OWNER') {
      return 'bg-purple-100 dark:bg-purple-950/50 text-purple-700 dark:text-purple-300 border-purple-300 dark:border-purple-800';
    }
    if (r === SystemRole.BRANCH_MANAGER || r === 'MANAGER' || r === SystemRole.RESTAURANT_ADMIN) {
      return 'bg-indigo-100 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 border-indigo-300 dark:border-indigo-800';
    }
    if (r === SystemRole.CASHIER) {
      return 'bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800';
    }
    if (r === SystemRole.WAITER) {
      return 'bg-blue-100 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-800';
    }
    if (r === SystemRole.KITCHEN_STAFF) {
      return 'bg-rose-100 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border-rose-300 dark:border-rose-800';
    }
    if (r === SystemRole.INVENTORY_MANAGER) {
      return 'bg-amber-100 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-800';
    }
    return 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700';
  };

  return (
    <div className="p-6 sm:p-8 space-y-6">
      {/* Top Header & Metrics */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight flex items-center space-x-2">
            <Users className="w-6 h-6 text-brand-500" />
            <span>Staff & Roles Management</span>
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Manage employee accounts, update usernames & login credentials, reset passwords, and assign branch permissions
          </p>
        </div>
        <button
          onClick={() => setIsAddOpen(true)}
          className="flex items-center space-x-1.5 bg-brand-500 hover:bg-brand-600 text-white px-4 py-2.5 rounded-xl font-bold text-xs shadow-md transition-all self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Add Employee</span>
        </button>
      </div>

      {/* Metrics Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 shadow-sm">
          <span className="text-[10px] text-slate-400 font-semibold block uppercase tracking-wider">Total Staff</span>
          <span className="text-xl font-black text-slate-900 dark:text-white">{staff.length}</span>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 shadow-sm">
          <span className="text-[10px] text-slate-400 font-semibold block uppercase tracking-wider">Active Accounts</span>
          <span className="text-xl font-black text-emerald-600 dark:text-emerald-400">
            {staff.filter((s) => s.is_active !== false).length}
          </span>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 shadow-sm">
          <span className="text-[10px] text-slate-400 font-semibold block uppercase tracking-wider">Branches Configured</span>
          <span className="text-xl font-black text-brand-600 dark:text-brand-400">{branches.length}</span>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 shadow-sm">
          <span className="text-[10px] text-slate-400 font-semibold block uppercase tracking-wider">Kitchen & POS Staff</span>
          <span className="text-xl font-black text-indigo-600 dark:text-indigo-400">
            {staff.filter((s) => [SystemRole.CASHIER, SystemRole.WAITER, SystemRole.KITCHEN_STAFF].includes(s.role)).length}
          </span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            placeholder="Search by employee name, email/username, or role..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-medium text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>

        <select
          value={selectedBranch}
          onChange={(e) => setSelectedBranch(e.target.value)}
          className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500"
        >
          <option value="ALL">All Branch Locations</option>
          {branches.map((b) => (
            <option key={b.id} value={b.id}>
              📍 {b.name}
            </option>
          ))}
        </select>

        <select
          value={selectedRole}
          onChange={(e) => setSelectedRole(e.target.value)}
          className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500"
        >
          <option value="ALL">All Roles</option>
          <option value={SystemRole.CASHIER}>Cashier (POS)</option>
          <option value={SystemRole.WAITER}>Waiter / Server</option>
          <option value={SystemRole.KITCHEN_STAFF}>Kitchen Staff (KDS)</option>
          <option value={SystemRole.BRANCH_MANAGER}>Branch Manager</option>
          <option value={SystemRole.INVENTORY_MANAGER}>Inventory Manager</option>
          <option value={SystemRole.ACCOUNTANT}>Accountant</option>
          <option value={SystemRole.RESTAURANT_ADMIN}>Restaurant Admin</option>
          <option value={SystemRole.RESTAURANT_OWNER}>Restaurant Owner</option>
        </select>
      </div>

      {/* Staff Table */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 uppercase font-semibold">
              <tr>
                <th className="px-5 py-3.5">Employee Name</th>
                <th className="px-5 py-3.5">Email / Username</th>
                <th className="px-5 py-3.5">Assigned Role</th>
                <th className="px-5 py-3.5">Branch Location</th>
                <th className="px-5 py-3.5 text-center">Status</th>
                <th className="px-5 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
              {loading ? (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-slate-400">
                    Loading staff members...
                  </td>
                </tr>
              ) : filteredStaff.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-slate-400">
                    No staff members match the selected filters.
                  </td>
                </tr>
              ) : (
                filteredStaff.map((u) => {
                  const initial = u.full_name ? u.full_name.trim()[0].toUpperCase() : 'U';
                  const isOwner = u.role === SystemRole.RESTAURANT_OWNER || u.role === 'OWNER';

                  return (
                    <tr key={u.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="px-5 py-3.5">
                        <div className="flex items-center space-x-2.5">
                          <div className="w-7 h-7 rounded-full bg-brand-500/20 text-brand-600 dark:text-brand-400 flex items-center justify-center font-bold text-xs border border-brand-500/30">
                            {initial}
                          </div>
                          <div>
                            <span className="font-bold text-slate-900 dark:text-white block">
                              {u.full_name}
                            </span>
                            {isOwner && (
                              <span className="text-[10px] text-purple-600 dark:text-purple-400 font-semibold block">
                                Primary Owner
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      <td className="px-5 py-3.5 text-slate-600 dark:text-slate-300 font-mono text-[11px]">
                        <div className="flex items-center space-x-1.5">
                          <Mail className="w-3.5 h-3.5 text-slate-400" />
                          <span>{u.email}</span>
                        </div>
                      </td>

                      <td className="px-5 py-3.5">
                        <span className={`inline-block px-2.5 py-0.5 rounded-lg text-[10px] font-bold border ${getRoleBadge(u.role)}`}>
                          {u.role?.replace('_', ' ')}
                        </span>
                      </td>

                      <td className="px-5 py-3.5 text-slate-600 dark:text-slate-300 font-medium">
                        <div className="flex items-center space-x-1.5">
                          <Building2 className="w-3.5 h-3.5 text-slate-400" />
                          <span>{u.branch_name || 'All Branches'}</span>
                        </div>
                      </td>

                      <td className="px-5 py-3.5 text-center">
                        <span
                          className={`inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[10px] font-black border ${
                            u.is_active !== false
                              ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-500 border-slate-300 dark:border-slate-700'
                          }`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${u.is_active !== false ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
                          <span>{u.is_active !== false ? 'Active' : 'Inactive'}</span>
                        </span>
                      </td>

                      <td className="px-5 py-3.5 text-right space-x-1.5 whitespace-nowrap">
                        {/* Edit Employee Button */}
                        <button
                          onClick={() => handleOpenEdit(u)}
                          className="px-2.5 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-brand-500 hover:text-white dark:hover:bg-brand-600 text-slate-700 dark:text-slate-200 rounded-lg font-bold text-[11px] transition-all inline-flex items-center space-x-1 border border-slate-200 dark:border-slate-700"
                          title="Edit Employee & Credentials"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                          <span>Edit</span>
                        </button>

                        {/* Reset Password Button */}
                        <button
                          onClick={() => handleOpenPasswordReset(u)}
                          className="px-2.5 py-1.5 bg-amber-50 dark:bg-amber-950/40 hover:bg-amber-500 hover:text-white dark:hover:bg-amber-600 text-amber-700 dark:text-amber-300 rounded-lg font-bold text-[11px] transition-all inline-flex items-center space-x-1 border border-amber-300 dark:border-amber-800"
                          title="Quick Reset Password"
                        >
                          <KeyRound className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline">Password</span>
                        </button>

                        {/* Toggle Active Status */}
                        {!isOwner && (
                          <button
                            onClick={() => handleToggleStatus(u)}
                            className={`p-1.5 rounded-lg border transition-all ${
                              u.is_active !== false
                                ? 'text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 border-transparent hover:border-rose-300'
                                : 'text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 border-transparent hover:border-emerald-300'
                            }`}
                            title={u.is_active !== false ? 'Deactivate Employee' : 'Activate Employee'}
                          >
                            <Power className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ======================================================== */}
      {/* MODAL 1: ADD NEW EMPLOYEE */}
      {/* ======================================================== */}
      <Modal isOpen={isAddOpen} onClose={() => setIsAddOpen(false)} title="Add Restaurant Staff Member" maxWidth="md">
        <form onSubmit={handleCreateStaff} className="space-y-4 text-xs">
          <div>
            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Full Name *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Asad Ali"
              value={addForm.fullName}
              onChange={(e) => setAddForm({ ...addForm, fullName: e.target.value })}
              className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-brand-500"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Email / Login Username *
            </label>
            <input
              type="email"
              required
              placeholder="asad@lahorekarahi.com"
              value={addForm.email}
              onChange={(e) => setAddForm({ ...addForm, email: e.target.value })}
              className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-brand-500"
            />
            <p className="text-[10px] text-slate-400 mt-1">This email acts as the login username for POS, KDS & Dashboard.</p>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block font-semibold text-slate-700 dark:text-slate-300">
                Password *
              </label>
              <button
                type="button"
                onClick={() => setAddForm({ ...addForm, password: generateRandomPassword() })}
                className="text-[10px] text-brand-600 dark:text-brand-400 hover:underline font-bold flex items-center space-x-1"
              >
                <Sparkles className="w-2.5 h-2.5" />
                <span>Auto-Generate</span>
              </button>
            </div>
            <input
              type="text"
              required
              placeholder="Min 6 characters"
              value={addForm.password}
              onChange={(e) => setAddForm({ ...addForm, password: e.target.value })}
              className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs font-mono text-slate-900 dark:text-white focus:ring-2 focus:ring-brand-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                System Role *
              </label>
              <select
                value={addForm.role}
                onChange={(e) => setAddForm({ ...addForm, role: e.target.value as any })}
                className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-brand-500"
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
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Assigned Branch *
              </label>
              <select
                value={addForm.branchId}
                onChange={(e) => setAddForm({ ...addForm, branchId: e.target.value })}
                className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-brand-500"
              >
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex justify-end space-x-2 pt-3 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setIsAddOpen(false)}
              className="px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:text-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-brand-500 hover:bg-brand-600 text-white rounded-xl text-xs font-bold shadow-md"
            >
              Add Staff Member
            </button>
          </div>
        </form>
      </Modal>

      {/* ======================================================== */}
      {/* MODAL 2: EDIT EMPLOYEE (NAME, USERNAME/EMAIL, PASSWORD, ROLE) */}
      {/* ======================================================== */}
      <Modal
        isOpen={isEditOpen}
        onClose={() => {
          setIsEditOpen(false);
          setEditingStaff(null);
        }}
        title={`Edit Employee: ${editingStaff?.full_name || ''}`}
        maxWidth="md"
      >
        <form onSubmit={handleSaveEdit} className="space-y-4 text-xs">
          <div>
            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Full Name *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Asad Ali"
              value={editForm.fullName}
              onChange={(e) => setEditForm({ ...editForm, fullName: e.target.value })}
              className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-brand-500"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Email / Login Username *
            </label>
            <input
              type="email"
              required
              placeholder="asad@lahorekarahi.com"
              value={editForm.email}
              onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
              className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-brand-500"
            />
            <p className="text-[10px] text-slate-400 mt-1">
              Changing this updates the login username for this staff member.
            </p>
          </div>

          {/* Optional Password Update */}
          <div className="bg-slate-50 dark:bg-slate-800/60 p-3 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2">
            <div className="flex items-center justify-between">
              <label className="block font-bold text-slate-700 dark:text-slate-200">
                Change Password (Optional)
              </label>
              <button
                type="button"
                onClick={() => setEditForm({ ...editForm, password: generateRandomPassword() })}
                className="text-[10px] text-brand-600 dark:text-brand-400 hover:underline font-bold flex items-center space-x-1"
              >
                <Sparkles className="w-2.5 h-2.5" />
                <span>Auto-Generate</span>
              </button>
            </div>
            <div className="relative">
              <input
                type={showEditPassword ? 'text' : 'password'}
                placeholder="Leave blank to keep current password"
                value={editForm.password}
                onChange={(e) => setEditForm({ ...editForm, password: e.target.value })}
                className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg pl-3 pr-10 py-2 text-xs font-mono text-slate-900 dark:text-white focus:ring-2 focus:ring-brand-500"
              />
              <button
                type="button"
                onClick={() => setShowEditPassword(!showEditPassword)}
                className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                {showEditPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>
            <p className="text-[10px] text-slate-400">
              Only fill this in if you want to reset the password. Must be at least 6 characters.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                System Role *
              </label>
              <select
                value={editForm.role}
                onChange={(e) => setEditForm({ ...editForm, role: e.target.value as any })}
                className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-brand-500"
              >
                <option value={SystemRole.CASHIER}>Cashier (POS Checkout)</option>
                <option value={SystemRole.WAITER}>Waiter / Server (Orders & Tables)</option>
                <option value={SystemRole.KITCHEN_STAFF}>Kitchen Staff (KDS)</option>
                <option value={SystemRole.BRANCH_MANAGER}>Branch Manager</option>
                <option value={SystemRole.INVENTORY_MANAGER}>Inventory Manager</option>
                <option value={SystemRole.ACCOUNTANT}>Accountant (Reports & Finance)</option>
                <option value={SystemRole.RESTAURANT_ADMIN}>Restaurant Administrator</option>
                <option value={SystemRole.RESTAURANT_OWNER}>Restaurant Owner</option>
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Assigned Branch Location *
              </label>
              <select
                value={editForm.branchId}
                onChange={(e) => setEditForm({ ...editForm, branchId: e.target.value })}
                className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-brand-500"
              >
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Account Status Switch */}
          <div className="pt-2">
            <label className="flex items-center space-x-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={editForm.isActive}
                onChange={(e) => setEditForm({ ...editForm, isActive: e.target.checked })}
                className="rounded text-brand-500 focus:ring-brand-400 w-4 h-4"
              />
              <span className="font-semibold text-slate-800 dark:text-slate-200 text-xs">
                Account Active (Can log in and access POS / KDS)
              </span>
            </label>
          </div>

          <div className="flex justify-end space-x-2 pt-3 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={() => {
                setIsEditOpen(false);
                setEditingStaff(null);
              }}
              className="px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:text-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-brand-500 hover:bg-brand-600 text-white rounded-xl text-xs font-bold shadow-md"
            >
              Save Changes
            </button>
          </div>
        </form>
      </Modal>

      {/* ======================================================== */}
      {/* MODAL 3: QUICK PASSWORD RESET */}
      {/* ======================================================== */}
      <Modal
        isOpen={isResetPasswordOpen}
        onClose={() => {
          setIsResetPasswordOpen(false);
          setResetStaffTarget(null);
        }}
        title={`Reset Password: ${resetStaffTarget?.full_name || ''}`}
        maxWidth="sm"
      >
        <form onSubmit={handleSavePasswordReset} className="space-y-4 text-xs">
          <div className="bg-amber-50 dark:bg-amber-950/30 p-3 rounded-xl border border-amber-200 dark:border-amber-800 text-[11px] text-amber-800 dark:text-amber-300">
            Resetting password for login email: <strong className="font-mono">{resetStaffTarget?.email}</strong>.
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block font-semibold text-slate-700 dark:text-slate-300">
                New Password *
              </label>
              <button
                type="button"
                onClick={() => setNewResetPassword(generateRandomPassword())}
                className="text-[10px] text-brand-600 dark:text-brand-400 hover:underline font-bold flex items-center space-x-1"
              >
                <Sparkles className="w-2.5 h-2.5" />
                <span>Auto-Generate</span>
              </button>
            </div>
            <div className="relative">
              <input
                type={showResetPassword ? 'text' : 'password'}
                required
                placeholder="At least 6 characters"
                value={newResetPassword}
                onChange={(e) => setNewResetPassword(e.target.value)}
                className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg pl-3 pr-10 py-2 text-xs font-mono font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-brand-500"
              />
              <button
                type="button"
                onClick={() => setShowResetPassword(!showResetPassword)}
                className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                {showResetPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          <div className="flex justify-end space-x-2 pt-3 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={() => {
                setIsResetPasswordOpen(false);
                setResetStaffTarget(null);
              }}
              className="px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:text-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold shadow-md"
            >
              Update Password
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
