import React, { useEffect, useState } from 'react';
import { api } from '../../api/client.js';
import { useToast } from '../../context/ToastContext.js';
import { Modal } from '../../components/common/Modal.js';
import {
  LifeBuoy,
  Plus,
  Search,
  MessageSquare,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Building2,
  RefreshCw,
  Send,
  Lock,
  Tag,
  User,
} from 'lucide-react';
import { TicketPriority, TicketStatus, TicketCategory } from '@pos/shared';

export const PlatformTickets: React.FC = () => {
  const { success, error } = useToast();
  const [tickets, setTickets] = useState<any[]>([]);
  const [tenants, setTenants] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');

  // Ticket Thread & Details Modal
  const [selectedTicket, setSelectedTicket] = useState<any | null>(null);
  const [ticketMessages, setTicketMessages] = useState<any[]>([]);
  const [isThreadOpen, setIsThreadOpen] = useState(false);
  const [replyMessage, setReplyMessage] = useState('');
  const [isInternalNote, setIsInternalNote] = useState(false);
  const [replying, setReplying] = useState(false);
  const [threadLoading, setThreadLoading] = useState(false);

  // Create Ticket Modal
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState({
    tenantId: '',
    subject: '',
    category: TicketCategory.TECHNICAL,
    priority: TicketPriority.MEDIUM,
    message: '',
    internalNotes: '',
  });

  const fetchTickets = async () => {
    try {
      let url = '/platform/tickets?';
      if (statusFilter) url += `status=${encodeURIComponent(statusFilter)}&`;
      if (priorityFilter) url += `priority=${encodeURIComponent(priorityFilter)}&`;
      const data = await api.get(url);
      setTickets(data.tickets || []);
    } catch (err: any) {
      console.error('Failed to load tickets:', err);
      error(err.message || 'Failed to load support tickets');
    } finally {
      setLoading(false);
    }
  };

  const fetchTenants = async () => {
    try {
      const data = await api.get('/platform/tenants');
      setTenants(data.tenants || []);
    } catch (err: any) {
      console.error('Failed to load tenants:', err);
    }
  };

  useEffect(() => {
    fetchTickets();
    fetchTenants();
  }, [statusFilter, priorityFilter]);

  const openThreadModal = async (ticket: any) => {
    setSelectedTicket(ticket);
    setIsThreadOpen(true);
    setThreadLoading(true);
    try {
      const data = await api.get(`/platform/tickets/${ticket.id}`);
      setSelectedTicket(data.ticket);
      setTicketMessages(data.messages || []);
    } catch (err: any) {
      error(err.message || 'Failed to load ticket thread');
    } finally {
      setThreadLoading(false);
    }
  };

  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTicket || !replyMessage.trim()) return;
    setReplying(true);
    try {
      await api.post(`/platform/tickets/${selectedTicket.id}/messages`, {
        message: replyMessage.trim(),
        isInternal: isInternalNote,
      });
      setReplyMessage('');
      // Reload thread
      const data = await api.get(`/platform/tickets/${selectedTicket.id}`);
      setTicketMessages(data.messages || []);
      success('Message posted to ticket');
      fetchTickets();
    } catch (err: any) {
      error(err.message || 'Failed to send message');
    } finally {
      setReplying(false);
    }
  };

  const handleUpdateStatus = async (newStatus: string) => {
    if (!selectedTicket) return;
    try {
      await api.put(`/platform/tickets/${selectedTicket.id}/status`, {
        status: newStatus,
      });
      setSelectedTicket({ ...selectedTicket, status: newStatus });
      success(`Ticket status updated to ${newStatus}`);
      fetchTickets();
    } catch (err: any) {
      error(err.message || 'Failed to update ticket status');
    }
  };

  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/platform/tickets', createForm);
      success('Support ticket created successfully');
      setIsCreateOpen(false);
      setCreateForm({
        tenantId: '',
        subject: '',
        category: TicketCategory.TECHNICAL,
        priority: TicketPriority.MEDIUM,
        message: '',
        internalNotes: '',
      });
      fetchTickets();
    } catch (err: any) {
      error(err.message || 'Failed to create ticket');
    }
  };

  return (
    <div className="p-6 sm:p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center space-x-2.5">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-white shadow-md">
            <LifeBuoy className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
              Customer Support & Tickets
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Centralized helpdesk for restaurant POS troubleshooting, billing queries, hardware assistance & SLA tracking
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={() => {
              setLoading(true);
              fetchTickets();
            }}
            className="flex items-center space-x-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl font-bold text-xs transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
          <button
            onClick={() => setIsCreateOpen(true)}
            className="flex items-center space-x-2 bg-brand-500 hover:bg-brand-600 text-white px-4 py-2 rounded-xl font-bold text-xs shadow-md transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>New Ticket</span>
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-wrap gap-3 items-center justify-between shadow-sm">
        <div className="flex flex-wrap items-center gap-2.5">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            <option value="">All Ticket Statuses</option>
            <option value="OPEN">Open</option>
            <option value="IN_PROGRESS">In Progress</option>
            <option value="RESOLVED">Resolved</option>
            <option value="CLOSED">Closed</option>
          </select>

          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            <option value="">All Priorities</option>
            <option value="URGENT">Urgent</option>
            <option value="HIGH">High</option>
            <option value="MEDIUM">Medium</option>
            <option value="LOW">Low</option>
          </select>
        </div>
        <span className="text-xs text-slate-400 font-semibold">{tickets.length} tickets loaded</span>
      </div>

      {/* Tickets Table */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 uppercase font-semibold">
              <tr>
                <th className="px-6 py-3.5">Ticket #</th>
                <th className="px-6 py-3.5">Subject & Category</th>
                <th className="px-6 py-3.5">Restaurant</th>
                <th className="px-6 py-3.5">Priority</th>
                <th className="px-6 py-3.5">Status</th>
                <th className="px-6 py-3.5">Created</th>
                <th className="px-6 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-slate-400">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-brand-500" />
                    Loading support tickets...
                  </td>
                </tr>
              ) : tickets.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-slate-400">
                    No support tickets match your filters.
                  </td>
                </tr>
              ) : (
                tickets.map((t) => (
                  <tr key={t.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="px-6 py-4 font-mono font-bold text-slate-800 dark:text-slate-200">
                      {t.ticket_number}
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-bold text-slate-900 dark:text-white text-sm">{t.subject}</div>
                      <div className="text-[11px] text-slate-400 flex items-center space-x-1 mt-0.5">
                        <Tag className="w-3 h-3 text-slate-400" />
                        <span>{t.category?.replace('_', ' ')}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-semibold text-slate-800 dark:text-slate-200 flex items-center space-x-1">
                        <Building2 className="w-3.5 h-3.5 text-slate-400" />
                        <span>{t.tenant_name || 'General / Unassigned'}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold ${
                          t.priority === 'URGENT'
                            ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300'
                            : t.priority === 'HIGH'
                            ? 'bg-orange-100 text-orange-700 dark:bg-orange-950/40 dark:text-orange-300'
                            : t.priority === 'MEDIUM'
                            ? 'bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300'
                            : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                        }`}
                      >
                        {t.priority}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          t.status === 'RESOLVED' || t.status === 'CLOSED'
                            ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                            : t.status === 'IN_PROGRESS'
                            ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
                            : 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800'
                        }`}
                      >
                        {t.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-slate-500 dark:text-slate-400 text-[11px]">
                      {new Date(t.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => openThreadModal(t)}
                        className="px-3 py-1.5 bg-brand-50 hover:bg-brand-100 dark:bg-brand-950/40 dark:hover:bg-brand-900/50 text-brand-600 dark:text-brand-400 font-bold text-xs rounded-lg transition-colors inline-flex items-center space-x-1"
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                        <span>Open Thread</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: View & Reply to Thread */}
      {selectedTicket && (
        <Modal
          isOpen={isThreadOpen}
          onClose={() => setIsThreadOpen(false)}
          title={`[${selectedTicket.ticket_number}] ${selectedTicket.subject}`}
          maxWidth="2xl"
        >
          <div className="space-y-4 text-xs">
            {/* Ticket Header & Status bar */}
            <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2">
              <div>
                <span className="text-slate-400 text-[10px] uppercase font-bold">Restaurant:</span>{' '}
                <span className="font-bold text-slate-800 dark:text-white">
                  {selectedTicket.tenant_name || 'General Platform'}
                </span>
              </div>
              <div className="flex items-center space-x-2">
                <span className="text-slate-400 text-[10px] font-bold">Status:</span>
                <select
                  value={selectedTicket.status}
                  onChange={(e) => handleUpdateStatus(e.target.value)}
                  className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 text-xs font-bold text-slate-800 dark:text-slate-200"
                >
                  <option value="OPEN">OPEN</option>
                  <option value="IN_PROGRESS">IN_PROGRESS</option>
                  <option value="RESOLVED">RESOLVED</option>
                  <option value="CLOSED">CLOSED</option>
                </select>
              </div>
            </div>

            {/* Messages Thread Container */}
            <div className="space-y-3 max-h-80 overflow-y-auto p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900">
              {threadLoading ? (
                <div className="py-8 text-center text-slate-400">Loading conversation messages...</div>
              ) : ticketMessages.length === 0 ? (
                <div className="py-8 text-center text-slate-400">No messages in this ticket.</div>
              ) : (
                ticketMessages.map((m) => {
                  const isAdmin = m.sender_type === 'ADMIN';

                  return (
                    <div
                      key={m.id}
                      className={`p-3 rounded-xl border ${
                        m.is_internal
                          ? 'bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800'
                          : isAdmin
                          ? 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700'
                          : 'bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center space-x-1.5 font-bold text-slate-800 dark:text-white">
                          <User className="w-3.5 h-3.5 text-slate-400" />
                          <span>{m.sender_name}</span>
                          {m.is_internal && (
                            <span className="px-1.5 py-0.5 rounded text-[9px] bg-amber-200 text-amber-800 font-bold flex items-center space-x-0.5">
                              <Lock className="w-2.5 h-2.5" />
                              <span>Internal Note</span>
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-slate-400">
                          {new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <p className="text-slate-700 dark:text-slate-300 text-xs leading-relaxed whitespace-pre-wrap">
                        {m.message}
                      </p>
                    </div>
                  );
                })
              )}
            </div>

            {/* Reply Input Form */}
            <form onSubmit={handleSendReply} className="space-y-3">
              <textarea
                rows={3}
                required
                value={replyMessage}
                onChange={(e) => setReplyMessage(e.target.value)}
                placeholder="Type your reply to the customer or internal note..."
                className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500"
              />

              <div className="flex items-center justify-between">
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isInternalNote}
                    onChange={(e) => setIsInternalNote(e.target.checked)}
                    className="rounded border-slate-300 text-amber-600 focus:ring-amber-500"
                  />
                  <span className="text-slate-600 dark:text-slate-400 font-semibold text-[11px]">
                    Internal Note only (Hidden from customer)
                  </span>
                </label>

                <button
                  type="submit"
                  disabled={replying || !replyMessage.trim()}
                  className="px-5 py-2 bg-brand-500 hover:bg-brand-600 text-white font-bold rounded-xl shadow-md transition-all flex items-center space-x-1.5 disabled:opacity-50"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{replying ? 'Posting...' : 'Send Message'}</span>
                </button>
              </div>
            </form>
          </div>
        </Modal>
      )}

      {/* Modal: Create Ticket */}
      <Modal isOpen={isCreateOpen} onClose={() => setIsCreateOpen(false)} title="Create Support Ticket" maxWidth="md">
        <form onSubmit={handleCreateTicket} className="space-y-4 text-xs">
          <div>
            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Target Restaurant</label>
            <select
              value={createForm.tenantId}
              onChange={(e) => setCreateForm({ ...createForm, tenantId: e.target.value })}
              className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-white"
            >
              <option value="">General Platform Issue</option>
              {tenants.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Subject *</label>
            <input
              type="text"
              required
              value={createForm.subject}
              onChange={(e) => setCreateForm({ ...createForm, subject: e.target.value })}
              placeholder="e.g. Thermal printer receipt alignment issue"
              className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-white"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Category</label>
              <select
                value={createForm.category}
                onChange={(e) => setCreateForm({ ...createForm, category: e.target.value as any })}
                className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-white"
              >
                <option value={TicketCategory.TECHNICAL}>Technical</option>
                <option value={TicketCategory.BILLING}>Billing</option>
                <option value={TicketCategory.SUBSCRIPTION}>Subscription</option>
                <option value={TicketCategory.DEVICE}>Device / Hardware</option>
                <option value={TicketCategory.SYNC}>Sync & Network</option>
                <option value={TicketCategory.DATA_RECOVERY}>Data Recovery</option>
                <option value={TicketCategory.FEATURE_REQUEST}>Feature Request</option>
                <option value={TicketCategory.GENERAL}>General</option>
              </select>
            </div>
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Priority</label>
              <select
                value={createForm.priority}
                onChange={(e) => setCreateForm({ ...createForm, priority: e.target.value as any })}
                className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-white"
              >
                <option value={TicketPriority.LOW}>Low</option>
                <option value={TicketPriority.MEDIUM}>Medium</option>
                <option value={TicketPriority.HIGH}>High</option>
                <option value={TicketPriority.URGENT}>Urgent</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Initial Message *</label>
            <textarea
              rows={3}
              required
              value={createForm.message}
              onChange={(e) => setCreateForm({ ...createForm, message: e.target.value })}
              placeholder="Describe the issue reported or assistance needed..."
              className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-white"
            />
          </div>

          <div className="pt-3 flex justify-end space-x-2 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setIsCreateOpen(false)}
              className="px-4 py-2 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 rounded-lg font-semibold"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-brand-500 hover:bg-brand-600 text-white font-bold rounded-lg shadow-md"
            >
              Create Ticket
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
