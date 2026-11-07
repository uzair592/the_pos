import React, { useState, useEffect } from 'react';
import { api } from '../../api/client.js';
import { useAuth } from '../../context/AuthContext.js';
import { useToast } from '../../context/ToastContext.js';
import { Modal } from '../common/Modal.js';
import { ActionMenu } from '../common/ActionMenu.js';
import {
  Armchair,
  Plus,
  Edit2,
  Trash2,
  Save,
  Users,
  CheckCircle2,
  AlertCircle,
  Clock,
  Layers,
  Move,
  RefreshCw,
  Calendar,
  UtensilsCrossed,
  Square,
  Circle,
  RectangleHorizontal,
  Sparkles,
} from 'lucide-react';
import { TableStatus, TableShape } from '@pos/shared';

export const FloorTableManagement: React.FC = () => {
  const { tenant, branches, currentBranchId, user } = useAuth();
  const { success, error, info } = useToast();
  const currencySymbol = tenant?.currency_symbol || 'Rs.';

  const [floors, setFloors] = useState<any[]>([]);
  const [tables, setTables] = useState<any[]>([]);
  const [staffList, setStaffList] = useState<any[]>([]);
  const [selectedFloorId, setSelectedFloorId] = useState<string>('ALL');
  const [branchFilter, setBranchFilter] = useState<string>(currentBranchId || '');
  const [loading, setLoading] = useState(true);

  // Edit Mode for visual layout
  const [isArrangeMode, setIsArrangeMode] = useState(false);
  const [hasUnsavedLayout, setHasUnsavedLayout] = useState(false);
  const [savingLayout, setSavingLayout] = useState(false);

  // Modals
  const [isAddFloorOpen, setIsAddFloorOpen] = useState(false);
  const [isEditFloorOpen, setIsEditFloorOpen] = useState(false);
  const [isAddTableOpen, setIsAddTableOpen] = useState(false);
  const [isEditTableOpen, setIsEditTableOpen] = useState(false);
  const [isCreatingFloorInline, setIsCreatingFloorInline] = useState(false);
  const [inlineFloorName, setInlineFloorName] = useState('');
  const [creatingFloorLoading, setCreatingFloorLoading] = useState(false);

  // Forms
  const [floorForm, setFloorForm] = useState({
    id: '',
    name: '',
    sortOrder: 0,
    branchId: currentBranchId || (branches[0]?.id || ''),
  });

  const [tableForm, setTableForm] = useState({
    id: '',
    floorId: '',
    branchId: currentBranchId || (branches[0]?.id || ''),
    tableNumber: '',
    capacity: 4,
    shape: 'RECTANGLE' as TableShape,
    assignedWaiterId: '',
    assignedWaiterName: '',
    status: TableStatus.AVAILABLE,
    posX: 0,
    posY: 0,
  });

  const fetchData = async () => {
    try {
      setLoading(true);
      const bId = branchFilter || currentBranchId || branches[0]?.id;
      const bParam = bId ? `?branchId=${bId}` : '';

      const [floorsRes, tablesRes, staffRes] = await Promise.all([
        api.get(`/restaurant/floors${bParam}`),
        api.get(`/restaurant/tables${bParam}`),
        api.get('/restaurant/staff'),
      ]);

      setFloors(floorsRes.floors || []);
      setTables(tablesRes.tables || []);
      setStaffList(staffRes.staff || []);

      if (floorsRes.floors?.length > 0 && selectedFloorId === 'ALL') {
        setSelectedFloorId(floorsRes.floors[0].id);
      }
    } catch (err: any) {
      error(err.message || 'Failed to load floors and tables');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!branchFilter && (currentBranchId || branches[0]?.id)) {
      setBranchFilter(currentBranchId || branches[0]?.id);
    }
  }, [currentBranchId, branches, branchFilter]);

  useEffect(() => {
    fetchData();
  }, [branchFilter, currentBranchId]);

  // Floor CRUD
  const handleSaveFloor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!floorForm.name.trim()) {
      error('Floor name is required');
      return;
    }
    const bId = branchFilter || currentBranchId || branches[0]?.id || undefined;

    try {
      if (floorForm.id) {
        await api.put(`/restaurant/floors/${floorForm.id}`, {
          name: floorForm.name,
          sortOrder: Number(floorForm.sortOrder),
        });
        success('Floor updated successfully');
      } else {
        await api.post('/restaurant/floors', {
          branchId: bId,
          name: floorForm.name,
          sortOrder: Number(floorForm.sortOrder),
        });
        success('Floor created successfully');
      }
      setIsAddFloorOpen(false);
      setIsEditFloorOpen(false);
      fetchData();
    } catch (err: any) {
      error(err.message || 'Failed to save floor');
    }
  };

  const handleDeleteFloor = async (floor: any) => {
    const floorTables = tables.filter((t) => t.floor_id === floor.id);
    if (floorTables.length > 0) {
      error(`Cannot delete floor "${floor.name}" because it contains ${floorTables.length} tables. Move or delete tables first.`);
      return;
    }
    if (!window.confirm(`Are you sure you want to delete floor "${floor.name}"?`)) return;

    try {
      await api.delete(`/restaurant/floors/${floor.id}`);
      success(`Floor "${floor.name}" deleted successfully`);
      setSelectedFloorId('ALL');
      fetchData();
    } catch (err: any) {
      error(err.message || 'Failed to delete floor');
    }
  };

  // Quick Inline Floor Creation
  const handleQuickCreateFloor = async (nameToCreate?: string) => {
    const name = (nameToCreate || inlineFloorName).trim();
    if (!name) {
      error('Floor / Dining Section name cannot be empty');
      return null;
    }
    const bId = branchFilter || currentBranchId || branches[0]?.id || undefined;
    try {
      setCreatingFloorLoading(true);
      const res = await api.post('/restaurant/floors', {
        branchId: bId,
        name,
        sortOrder: floors.length + 1,
      });
      const newFloor = res.floor;
      success(`Floor "${newFloor.name}" created successfully!`);
      await fetchData();
      setTableForm((prev) => ({ ...prev, floorId: newFloor.id }));
      setSelectedFloorId(newFloor.id);
      setIsCreatingFloorInline(false);
      setInlineFloorName('');
      return newFloor;
    } catch (err: any) {
      error(err.message || 'Failed to create floor');
      return null;
    } finally {
      setCreatingFloorLoading(false);
    }
  };

  // Table CRUD
  const handleSaveTable = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tableForm.tableNumber.trim()) {
      error('Table number is required');
      return;
    }

    const bId = branchFilter || currentBranchId || branches[0]?.id || undefined;
    let effectiveFloorId = tableForm.floorId;

    // 1. If user typed a new floor name inline, create it immediately
    if (inlineFloorName.trim()) {
      const created = await handleQuickCreateFloor(inlineFloorName.trim());
      if (created) effectiveFloorId = created.id;
    }

    // 2. If still no floor and no floors exist in system, auto-create default 'Main Dining Area'
    if (!effectiveFloorId && floors.length === 0) {
      const created = await handleQuickCreateFloor('Main Dining Area');
      if (created) effectiveFloorId = created.id;
    } else if (!effectiveFloorId && floors.length > 0) {
      // Default to first floor
      effectiveFloorId = floors[0].id;
    }

    const waiter = staffList.find((s) => s.id === tableForm.assignedWaiterId);

    try {
      if (tableForm.id) {
        await api.put(`/restaurant/tables/${tableForm.id}`, {
          floorId: effectiveFloorId,
          tableNumber: tableForm.tableNumber,
          capacity: Number(tableForm.capacity),
          shape: tableForm.shape,
          status: tableForm.status,
          assignedWaiterId: tableForm.assignedWaiterId || null,
          assignedWaiterName: waiter ? waiter.full_name : null,
        });
        success(`Table ${tableForm.tableNumber} updated successfully`);
      } else {
        await api.post('/restaurant/tables', {
          branchId: bId || undefined,
          floorId: effectiveFloorId || undefined,
          floorName: inlineFloorName.trim() || undefined,
          tableNumber: tableForm.tableNumber,
          capacity: Number(tableForm.capacity),
          shape: tableForm.shape,
          assignedWaiterId: tableForm.assignedWaiterId || null,
          assignedWaiterName: waiter ? waiter.full_name : null,
        });
        success(`Table ${tableForm.tableNumber} added successfully!`);
      }
      setIsAddTableOpen(false);
      setIsEditTableOpen(false);
      setIsCreatingFloorInline(false);
      setInlineFloorName('');
      fetchData();
    } catch (err: any) {
      error(err.message || 'Failed to save table');
    }
  };

  const handleDeleteTable = async (table: any) => {
    if (table.status === TableStatus.OCCUPIED || table.current_order_id) {
      error(`Table ${table.table_number} is currently occupied with an active order. Settle or cancel the order before deleting.`);
      return;
    }
    if (!window.confirm(`Are you sure you want to delete Table ${table.table_number}?`)) return;

    try {
      await api.delete(`/restaurant/tables/${table.id}`);
      success(`Table ${table.table_number} removed`);
      fetchData();
    } catch (err: any) {
      error(err.message || 'Failed to delete table');
    }
  };

  // Move table position in visual arrange mode
  const handleMoveTable = (tableId: string, deltaX: number, deltaY: number) => {
    setTables((prev) =>
      prev.map((t) => {
        if (t.id === tableId) {
          const newX = Math.max(0, (Number(t.pos_x) || 0) + deltaX);
          const newY = Math.max(0, (Number(t.pos_y) || 0) + deltaY);
          return { ...t, pos_x: newX, pos_y: newY };
        }
        return t;
      })
    );
    setHasUnsavedLayout(true);
  };

  const handleSaveLayout = async () => {
    setSavingLayout(true);
    try {
      const payload = tables.map((t) => ({
        id: t.id,
        posX: Number(t.pos_x) || 0,
        posY: Number(t.pos_y) || 0,
        shape: t.shape || 'RECTANGLE',
      }));

      await api.put('/restaurant/tables/layout', { tables: payload });
      success('Visual floor plan layout saved successfully!');
      setHasUnsavedLayout(false);
      setIsArrangeMode(false);
    } catch (err: any) {
      error(err.message || 'Failed to save table layout');
    } finally {
      setSavingLayout(false);
    }
  };

  // Filtered tables by selected floor
  const displayedTables = tables.filter((t) => {
    if (selectedFloorId === 'ALL') return true;
    return t.floor_id === selectedFloorId;
  });

  const activeFloorObj = floors.find((f) => f.id === selectedFloorId);

  // Status Badge Helper
  const getStatusBadge = (status: TableStatus) => {
    switch (status) {
      case TableStatus.AVAILABLE:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Available
          </span>
        );
      case TableStatus.OCCUPIED:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-blue-100 dark:bg-blue-950/80 text-blue-700 dark:text-blue-300 border border-blue-300 dark:border-blue-800">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
            Occupied
          </span>
        );
      case TableStatus.RESERVED:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-100 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
            Reserved
          </span>
        );
      case TableStatus.BILL_PRINTED:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-purple-100 dark:bg-purple-950/80 text-purple-700 dark:text-purple-300 border border-purple-300 dark:border-purple-800">
            <span className="w-1.5 h-1.5 rounded-full bg-purple-500" />
            Bill Printed
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner and Header */}
      <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2.5">
            <Armchair className="w-6 h-6 text-brand-500" />
            Floor & Table Management
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Design floor layouts, manage table capacity, shapes, waiter assignments & live dining status
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {branches && branches.length > 1 && (
            <select
              value={branchFilter}
              onChange={(e) => setBranchFilter(e.target.value)}
              className="px-3 py-2 text-xs font-bold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-200"
            >
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  📍 {b.name}
                </option>
              ))}
            </select>
          )}

          <button
            type="button"
            onClick={() => {
              if (isArrangeMode && hasUnsavedLayout) {
                handleSaveLayout();
              } else {
                setIsArrangeMode(!isArrangeMode);
              }
            }}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all shadow-sm ${isArrangeMode
              ? 'bg-amber-500 hover:bg-amber-600 text-white animate-pulse'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
          >
            <Move className="w-4 h-4" />
            <span>{isArrangeMode ? (hasUnsavedLayout ? 'Save Layout Coordinates' : 'Done Arranging') : 'Arrange Positions'}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              const bId = branchFilter || currentBranchId || branches[0]?.id;
              setFloorForm({ id: '', name: '', sortOrder: floors.length + 1, branchId: bId });
              setIsAddFloorOpen(true);
            }}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-bold rounded-xl transition-all"
          >
            <Plus className="w-4 h-4 text-brand-500" />
            <span>Add Floor</span>
          </button>

          <button
            type="button"
            onClick={() => {
              const bId = branchFilter || currentBranchId || branches[0]?.id;
              setTableForm({
                id: '',
                floorId: selectedFloorId !== 'ALL' ? selectedFloorId : (floors[0]?.id || ''),
                branchId: bId,
                tableNumber: `T-${tables.length + 1}`,
                capacity: 4,
                shape: 'RECTANGLE',
                assignedWaiterId: '',
                assignedWaiterName: '',
                status: TableStatus.AVAILABLE,
                posX: 0,
                posY: 0,
              });
              setIsAddTableOpen(true);
            }}
            className="flex items-center gap-1.5 px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white text-xs font-bold rounded-xl shadow-md transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Add New Table</span>
          </button>
        </div>
      </div>

      {/* Empty Floors Onboarding Alert */}
      {floors.length === 0 && (
        <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-amber-900 dark:text-amber-200">
          <div className="flex items-center gap-2.5">
            <Layers className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0" />
            <div>
              <p className="font-extrabold text-sm">No dining floors or sections configured yet</p>
              <p className="text-[11px] text-amber-700 dark:text-amber-300 mt-0.5">
                Add your restaurant floors/sections (e.g. Ground Floor, First Floor, Rooftop, Family Hall) or use 1-click Quick Setup.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => handleQuickCreateFloor('Main Dining Area')}
              disabled={creatingFloorLoading}
              className="px-3.5 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl shadow-xs transition-all flex items-center gap-1.5"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>{creatingFloorLoading ? 'Creating...' : '⚡ Quick Create Main Floor'}</span>
            </button>
            <button
              type="button"
              onClick={() => {
                const bId = branchFilter || currentBranchId || branches[0]?.id;
                setFloorForm({ id: '', name: '', sortOrder: 1, branchId: bId });
                setIsAddFloorOpen(true);
              }}
              className="px-3.5 py-2 bg-white dark:bg-slate-800 hover:bg-amber-100 dark:hover:bg-slate-700 text-amber-900 dark:text-amber-200 font-bold rounded-xl border border-amber-300 dark:border-amber-800 transition-all flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Custom Floor</span>
            </button>
          </div>
        </div>
      )}

      {/* Floor Selection Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
        <button
          onClick={() => setSelectedFloorId('ALL')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${selectedFloorId === 'ALL'
            ? 'bg-brand-500 text-white shadow-sm'
            : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800'
            }`}
        >
          <Layers className="w-4 h-4" />
          <span>All Floors ({tables.length} tables)</span>
        </button>

        {floors.map((floor) => {
          const count = tables.filter((t) => t.floor_id === floor.id).length;
          const isSelected = selectedFloorId === floor.id;
          return (
            <div key={floor.id} className="relative group">
              <button
                onClick={() => setSelectedFloorId(floor.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${isSelected
                  ? 'bg-brand-500 text-white shadow-sm'
                  : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800'
                  }`}
              >
                <span>{floor.name}</span>
                <span
                  className={`px-1.5 py-0.5 rounded-full text-[10px] font-black ${isSelected ? 'bg-white/20 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                    }`}
                >
                  {count}
                </span>
              </button>

              {/* Quick Floor Edit / Delete Menu on Hover */}
              <div className="absolute right-0 top-full mt-1 hidden group-hover:flex items-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg shadow-lg p-1 z-10 gap-1">
                <button
                  type="button"
                  title="Edit Floor Name"
                  onClick={(e) => {
                    e.stopPropagation();
                    setFloorForm({ id: floor.id, name: floor.name, sortOrder: floor.sort_order, branchId: floor.branch_id });
                    setIsEditFloorOpen(true);
                  }}
                  className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 rounded"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  title="Delete Floor"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteFloor(floor);
                  }}
                  className="p-1 hover:bg-red-50 dark:hover:bg-red-950/50 text-red-500 rounded"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          );
        })}

        <button
          type="button"
          onClick={() => {
            const bId = branchFilter || currentBranchId || branches[0]?.id;
            setFloorForm({ id: '', name: '', sortOrder: floors.length + 1, branchId: bId });
            setIsAddFloorOpen(true);
          }}
          className="flex items-center gap-1 px-3 py-2 bg-slate-50 hover:bg-brand-50 dark:bg-slate-800/80 dark:hover:bg-slate-800 text-brand-600 dark:text-brand-400 text-xs font-bold rounded-xl border border-dashed border-slate-300 dark:border-slate-700 transition-all"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>New Floor</span>
        </button>
      </div>

      {/* Arrange Mode Alert */}
      {isArrangeMode && (
        <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 rounded-xl p-3.5 flex items-center justify-between text-xs text-amber-800 dark:text-amber-200">
          <div className="flex items-center gap-2">
            <Move className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
            <span>
              <strong>Visual Layout Arranging Active:</strong> Use the directional arrow buttons on table cards to adjust physical positions across your restaurant floor.
            </span>
          </div>
          {hasUnsavedLayout && (
            <button
              onClick={handleSaveLayout}
              disabled={savingLayout}
              className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-lg shadow transition-all shrink-0"
            >
              {savingLayout ? 'Saving...' : 'Save Table Positions'}
            </button>
          )}
        </div>
      )}

      {/* Tables Grid / Floor Canvas */}
      {displayedTables.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-dashed border-slate-300 dark:border-slate-800 p-12 text-center space-y-3">
          <Armchair className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto" />
          <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">
            {floors.length === 0 ? 'No dining floors or tables configured yet' : 'No tables configured for this floor'}
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
            {floors.length === 0
              ? 'Start by creating your first dining floor or add a table directly (we will set up a main dining section automatically).'
              : 'Click "Add New Table" to create dining tables, configure seating capacity, and assign staff.'}
          </p>
          {floors.length === 0 ? (
            <div className="flex flex-wrap items-center justify-center gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => handleQuickCreateFloor('Main Dining Area')}
                disabled={creatingFloorLoading}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl shadow-md transition-all"
              >
                <Sparkles className="w-4 h-4" />
                <span>{creatingFloorLoading ? 'Creating...' : '⚡ Quick Create Main Floor'}</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  const bId = branchFilter || currentBranchId || branches[0]?.id;
                  setTableForm({
                    id: '',
                    floorId: '',
                    branchId: bId,
                    tableNumber: `T-1`,
                    capacity: 4,
                    shape: 'RECTANGLE',
                    assignedWaiterId: '',
                    assignedWaiterName: '',
                    status: TableStatus.AVAILABLE,
                    posX: 0,
                    posY: 0,
                  });
                  setIsAddTableOpen(true);
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white text-xs font-bold rounded-xl shadow-md transition-all"
              >
                <Plus className="w-4 h-4" />
                <span>Add First Table</span>
              </button>
            </div>
          ) : (
            <button
              onClick={() => {
                const bId = branchFilter || currentBranchId || branches[0]?.id;
                setTableForm({
                  id: '',
                  floorId: selectedFloorId !== 'ALL' ? selectedFloorId : (floors[0]?.id || ''),
                  branchId: bId,
                  tableNumber: `T-${tables.length + 1}`,
                  capacity: 4,
                  shape: 'RECTANGLE',
                  assignedWaiterId: '',
                  assignedWaiterName: '',
                  status: TableStatus.AVAILABLE,
                  posX: 0,
                  posY: 0,
                });
                setIsAddTableOpen(true);
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white text-xs font-bold rounded-xl shadow-md transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>Add First Table</span>
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {displayedTables.map((table) => {
            const isOccupied = table.status === TableStatus.OCCUPIED || table.current_order_id;
            const isReserved = table.status === TableStatus.RESERVED;
            const shape = table.shape || 'RECTANGLE';

            return (
              <div
                key={table.id}
                className={`bg-white dark:bg-slate-900 rounded-2xl border-2 transition-all p-4 flex flex-col justify-between shadow-sm relative group ${isOccupied
                  ? 'border-blue-400 dark:border-blue-700 bg-blue-50/20 dark:bg-blue-950/20'
                  : isReserved
                    ? 'border-amber-400 dark:border-amber-700 bg-amber-50/20 dark:bg-amber-950/20'
                    : 'border-slate-200 dark:border-slate-800 hover:border-brand-400'
                  }`}
              >
                {/* Header: Table Number & Status */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center font-black shadow-sm shrink-0 ${shape === 'ROUND' ? 'rounded-full' : shape === 'SQUARE' ? 'rounded-lg' : 'rounded-xl'
                        } ${isOccupied
                          ? 'bg-blue-500 text-white'
                          : isReserved
                            ? 'bg-amber-500 text-white'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                        }`}
                    >
                      {shape === 'ROUND' ? (
                        <Circle className="w-5 h-5" />
                      ) : shape === 'SQUARE' ? (
                        <Square className="w-5 h-5" />
                      ) : (
                        <RectangleHorizontal className="w-5 h-5" />
                      )}
                    </div>

                    <div>
                      <h4 className="font-black text-slate-900 dark:text-white text-base">
                        {table.table_number}
                      </h4>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1">
                        <Users className="w-3 h-3" />
                        <span>{table.capacity} Seats</span>
                        <span className="text-slate-300 dark:text-slate-600">•</span>
                        <span>{table.floor_name || 'Main'}</span>
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    {getStatusBadge(table.status)}
                    <ActionMenu
                      items={[
                        {
                          label: 'Edit Table Details',
                          icon: Edit2,
                          onClick: () => {
                            setTableForm({
                              id: table.id,
                              floorId: table.floor_id,
                              branchId: table.branch_id,
                              tableNumber: table.table_number,
                              capacity: table.capacity,
                              shape: table.shape || 'RECTANGLE',
                              assignedWaiterId: table.assigned_waiter_id || '',
                              assignedWaiterName: table.assigned_waiter_name || '',
                              status: table.status,
                              posX: table.pos_x || 0,
                              posY: table.pos_y || 0,
                            });
                            setIsEditTableOpen(true);
                          },
                        },
                        {
                          label: 'Delete Table',
                          icon: Trash2,
                          variant: 'danger',
                          onClick: () => handleDeleteTable(table),
                        },
                      ]}
                    />
                  </div>
                </div>

                {/* Body: Active Order or Waiter Details */}
                <div className="my-3 py-2.5 px-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-100 dark:border-slate-800/80 text-xs space-y-1">
                  {isOccupied && table.current_order_number ? (
                    <div className="flex items-center justify-between text-blue-700 dark:text-blue-300 font-bold">
                      <span className="flex items-center gap-1 font-mono text-[11px]">
                        <UtensilsCrossed className="w-3 h-3" />
                        #{table.current_order_number}
                      </span>
                      <span>{currencySymbol} {Number(table.current_order_amount || 0).toLocaleString()}</span>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between text-slate-600 dark:text-slate-400 text-[11px]">
                      <span>Assigned Staff:</span>
                      <strong className="text-slate-800 dark:text-slate-200">
                        {table.assigned_waiter_name || 'Unassigned'}
                      </strong>
                    </div>
                  )}

                  {table.today_reservations_count > 0 && (
                    <div className="text-[10px] text-amber-600 dark:text-amber-400 font-semibold flex items-center gap-1 pt-1 border-t border-slate-200 dark:border-slate-700">
                      <Calendar className="w-3 h-3" />
                      <span>{table.today_reservations_count} reservation(s) booked today</span>
                    </div>
                  )}
                </div>

                {/* Footer: Position Controls (In Arrange Mode) or Info */}
                {isArrangeMode ? (
                  <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-500">
                    <span className="font-mono text-[10px]">Pos: ({table.pos_x || 0}, {table.pos_y || 0})</span>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleMoveTable(table.id, -10, 0)}
                        className="px-1.5 py-0.5 bg-slate-200 dark:bg-slate-800 rounded hover:bg-slate-300 font-bold"
                        title="Move Left"
                      >
                        ←
                      </button>
                      <button
                        type="button"
                        onClick={() => handleMoveTable(table.id, 10, 0)}
                        className="px-1.5 py-0.5 bg-slate-200 dark:bg-slate-800 rounded hover:bg-slate-300 font-bold"
                        title="Move Right"
                      >
                        →
                      </button>
                      <button
                        type="button"
                        onClick={() => handleMoveTable(table.id, 0, -10)}
                        className="px-1.5 py-0.5 bg-slate-200 dark:bg-slate-800 rounded hover:bg-slate-300 font-bold"
                        title="Move Up"
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        onClick={() => handleMoveTable(table.id, 0, 10)}
                        className="px-1.5 py-0.5 bg-slate-200 dark:bg-slate-800 rounded hover:bg-slate-300 font-bold"
                        title="Move Down"
                      >
                        ↓
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1">
                    <span>Shape: <strong className="capitalize text-slate-600 dark:text-slate-300">{shape.toLowerCase()}</strong></span>
                    <span className="font-mono text-[10px]">ID: {table.id.slice(0, 6)}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Modal: Add / Edit Floor */}
      <Modal
        isOpen={isAddFloorOpen || isEditFloorOpen}
        onClose={() => {
          setIsAddFloorOpen(false);
          setIsEditFloorOpen(false);
        }}
        title={
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-brand-50 dark:bg-brand-950/50 rounded-xl text-brand-600 dark:text-brand-400">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                {floorForm.id ? 'Edit Dining Floor' : 'Create New Dining Floor / Section'}
              </h3>
              <p className="text-xs text-slate-500 font-normal mt-0.5">Define dining rooms, outdoor terraces, or family halls</p>
            </div>
          </div>
        }
        maxWidth="xl"
      >
        <form onSubmit={handleSaveFloor} className="space-y-4">
          <div>
            <label className="form-label">
              Floor / Area Name <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Ground Floor, Rooftop Terrace, Family Hall"
              value={floorForm.name}
              onChange={(e) => setFloorForm({ ...floorForm, name: e.target.value })}
              className="form-input"
            />
          </div>

          <div>
            <label className="form-label">
              Display Sort Order
            </label>
            <input
              type="number"
              value={floorForm.sortOrder}
              onChange={(e) => setFloorForm({ ...floorForm, sortOrder: parseInt(e.target.value, 10) || 0 })}
              className="form-input font-mono font-bold"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={() => {
                setIsAddFloorOpen(false);
                setIsEditFloorOpen(false);
              }}
              className="px-5 py-2.5 text-sm font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-6 py-2.5 text-sm font-bold bg-brand-500 hover:bg-brand-600 text-white rounded-xl shadow-md hover:shadow-lg transition-all"
            >
              {floorForm.id ? 'Save Changes' : 'Create Floor'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal: Add / Edit Table */}
      <Modal
        isOpen={isAddTableOpen || isEditTableOpen}
        onClose={() => {
          setIsAddTableOpen(false);
          setIsEditTableOpen(false);
        }}
        title={
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-brand-50 dark:bg-brand-950/50 rounded-xl text-brand-600 dark:text-brand-400">
              <UtensilsCrossed className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                {tableForm.id ? `Edit Table ${tableForm.tableNumber}` : 'Add New Dining Table'}
              </h3>
              <p className="text-xs text-slate-500 font-normal mt-0.5">Assign table number, floor section, seating capacity, and shape</p>
            </div>
          </div>
        }
        maxWidth="2xl"
      >
        <form onSubmit={handleSaveTable} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="form-label">
                Table Number / Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Table 1, T-4, Booth A"
                value={tableForm.tableNumber}
                onChange={(e) => setTableForm({ ...tableForm, tableNumber: e.target.value })}
                className="form-input font-bold"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="form-label mb-0">
                  Floor / Dining Section <span className="text-rose-500">*</span>
                </label>
                <button
                  type="button"
                  onClick={() => setIsCreatingFloorInline((prev) => !prev)}
                  className="text-xs font-bold text-brand-600 hover:text-brand-700 dark:text-brand-400 flex items-center gap-1 hover:underline"
                >
                  <Plus className="w-3 h-3" />
                  <span>{isCreatingFloorInline ? 'Select Existing' : '+ Add New Floor'}</span>
                </button>
              </div>

              {isCreatingFloorInline || floors.length === 0 ? (
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      placeholder="e.g. Ground Floor, Rooftop, Family Hall"
                      value={inlineFloorName}
                      onChange={(e) => setInlineFloorName(e.target.value)}
                      className="form-input border-brand-300 dark:border-brand-700 font-semibold"
                      autoFocus
                    />
                    <button
                      type="button"
                      disabled={creatingFloorLoading || !inlineFloorName.trim()}
                      onClick={() => handleQuickCreateFloor()}
                      className="px-4 py-2.5 bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white rounded-xl text-xs font-bold shrink-0 transition-all shadow-md h-11"
                    >
                      {creatingFloorLoading ? 'Adding...' : 'Save Floor'}
                    </button>
                  </div>
                  {floors.length === 0 ? (
                    <p className="text-xs text-amber-600 dark:text-amber-400 font-medium">
                      💡 No floors exist yet. Type a floor/section name above (or click "Add Table" and we'll auto-create "Main Dining Area").
                    </p>
                  ) : (
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Or <button type="button" onClick={() => setIsCreatingFloorInline(false)} className="text-brand-500 font-bold underline">choose an existing floor</button>
                    </p>
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <select
                    value={tableForm.floorId}
                    onChange={(e) => setTableForm({ ...tableForm, floorId: e.target.value })}
                    className="form-select font-semibold"
                  >
                    <option value="">Select Floor...</option>
                    {floors.map((f) => (
                      <option key={f.id} value={f.id}>
                        📍 {f.name}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    title="Add another floor or dining section"
                    onClick={() => setIsCreatingFloorInline(true)}
                    className="h-11 px-3 bg-slate-100 dark:bg-slate-800 hover:bg-brand-50 dark:hover:bg-brand-950/40 text-brand-600 dark:text-brand-400 rounded-xl border border-slate-200 dark:border-slate-700 shrink-0 transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="form-label">
                Seating Capacity (Guests) <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                min="1"
                max="50"
                required
                value={tableForm.capacity}
                onChange={(e) => setTableForm({ ...tableForm, capacity: parseInt(e.target.value, 10) || 1 })}
                className="form-input font-mono font-bold text-center"
              />
            </div>

            <div>
              <label className="form-label">
                Table Shape
              </label>
              <select
                value={tableForm.shape}
                onChange={(e) => setTableForm({ ...tableForm, shape: e.target.value as TableShape })}
                className="form-select font-semibold"
              >
                <option value="RECTANGLE">Rectangle (Standard Dining)</option>
                <option value="ROUND">Round (Family / Cafe)</option>
                <option value="SQUARE">Square (Compact / Booth)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Assigned Staff / Waiter
              </label>
              <select
                value={tableForm.assignedWaiterId}
                onChange={(e) => setTableForm({ ...tableForm, assignedWaiterId: e.target.value })}
                className="w-full px-3.5 py-2 text-xs font-semibold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
              >
                <option value="">None (Any available waiter)</option>
                {staffList.map((s) => (
                  <option key={s.id} value={s.id}>
                    👤 {s.full_name} ({s.role.replace('_', ' ')})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Initial Status
              </label>
              <select
                value={tableForm.status}
                onChange={(e) => setTableForm({ ...tableForm, status: e.target.value as TableStatus })}
                className="w-full px-3.5 py-2 text-xs font-semibold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
              >
                <option value={TableStatus.AVAILABLE}>Available</option>
                <option value={TableStatus.OCCUPIED}>Occupied</option>
                <option value={TableStatus.RESERVED}>Reserved</option>
              </select>
            </div>
          </div>

          <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={() => {
                setIsAddTableOpen(false);
                setIsEditTableOpen(false);
              }}
              className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 text-xs font-bold bg-brand-500 hover:bg-brand-600 text-white rounded-xl shadow-md"
            >
              {tableForm.id ? 'Save Table' : 'Add Table'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
