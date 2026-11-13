import React, { useState } from 'react';
import {
  CreditCard,
  CheckCircle,
  XCircle,
  Lock,
  AlertTriangle,
  Clock,
  Search,
  Filter,
  RefreshCw,
  Send,
  ShieldCheck,
  Check,
  AlertCircle,
  ArrowUpRight,
  ExternalLink,
  Info
} from 'lucide-react';
import { useQuickFix } from '../../context/QuickFixContext';
import { PayoutRecord } from '../../types';

interface PendingPayoutsSectionProps {
  onNotify?: (message: string) => void;
}

export const PendingPayoutsSection: React.FC<PendingPayoutsSectionProps> = ({ onNotify }) => {
  const {
    payouts,
    adminApprovePayout,
    adminHoldPayout,
    adminRejectPayout,
    adminPaymentConfig,
    technicians
  } = useQuickFix();

  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'processing' | 'on_hold' | 'settled' | 'rejected'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [feedbackMsg, setFeedbackMsg] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [isProcessingId, setIsProcessingId] = useState<string | null>(null);

  const showFeedback = (text: string, type: 'success' | 'error' | 'info' = 'success') => {
    setFeedbackMsg({ text, type });
    if (onNotify) onNotify(text);
    setTimeout(() => setFeedbackMsg(null), 5000);
  };

  // Filtered list
  const filteredPayouts = payouts.filter(p => {
    const matchesStatus =
      filterStatus === 'all'
        ? true
        : filterStatus === 'pending'
        ? p.status === 'pending' || (p.adminApprovalStatus === 'pending_approval' && p.status !== 'rejected')
        : p.status === filterStatus;

    const matchesSearch =
      p.technicianName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.upiId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.referenceNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.id.toLowerCase().includes(searchQuery.toLowerCase());

    return matchesStatus && matchesSearch;
  });

  const pendingCount = payouts.filter(p => p.status === 'pending' || p.adminApprovalStatus === 'pending_approval').length;
  const processingCount = payouts.filter(p => p.status === 'processing').length;
  const onHoldCount = payouts.filter(p => p.status === 'on_hold').length;
  const settledCount = payouts.filter(p => p.status === 'settled').length;
  const rejectedCount = payouts.filter(p => p.status === 'rejected').length;

  const totalPendingAmount = payouts
    .filter(p => p.status === 'pending' || p.status === 'processing' || p.status === 'on_hold')
    .reduce((sum, p) => sum + p.amount, 0);

  const totalSettledAmount = payouts
    .filter(p => p.status === 'settled')
    .reduce((sum, p) => sum + p.amount, 0);

  // Handlers with Firestore synchronization
  const handleApprove = (payoutId: string) => {
    setIsProcessingId(payoutId);
    try {
      const res = adminApprovePayout(payoutId);
      showFeedback(res.message, res.success ? 'success' : 'error');
    } finally {
      setIsProcessingId(null);
    }
  };

  const handleHold = (payoutId: string) => {
    const reason = prompt('Reason for placing payout on hold (e.g. audit check, dispute review):', 'Admin review in progress');
    if (!reason) return;
    setIsProcessingId(payoutId);
    try {
      const res = adminHoldPayout(payoutId, reason);
      showFeedback(res.message, res.success ? 'info' : 'error');
    } finally {
      setIsProcessingId(null);
    }
  };

  const handleReject = (payoutId: string, amount: number) => {
    const reason = prompt(
      `Reject payout and restore ₹${amount} to partner wallet?\nEnter rejection reason:`,
      'Policy compliance or duplicate request'
    );
    if (!reason) return;
    setIsProcessingId(payoutId);
    try {
      const res = adminRejectPayout(payoutId, reason);
      showFeedback(res.message, res.success ? 'success' : 'error');
    } finally {
      setIsProcessingId(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* Overview Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
              Pending & In-Escrow
            </span>
            <div className="text-xl font-extrabold font-mono text-amber-400 mt-0.5">
              ₹{totalPendingAmount.toLocaleString('en-IN')}
            </div>
            <span className="text-[11px] text-slate-400">
              {pendingCount} pending review · {processingCount} processing
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-950/60 text-amber-400 flex items-center justify-center border border-amber-800/50">
            <Clock className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
              Settled via Webhooks
            </span>
            <div className="text-xl font-extrabold font-mono text-emerald-400 mt-0.5">
              ₹{totalSettledAmount.toLocaleString('en-IN')}
            </div>
            <span className="text-[11px] text-slate-400">{settledCount} confirmed disbursements</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-950/60 text-emerald-400 flex items-center justify-center border border-emerald-800/50">
            <CheckCircle className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
              Audits & Restorations
            </span>
            <div className="text-xl font-extrabold font-mono text-slate-200 mt-0.5">
              {onHoldCount + rejectedCount} Total
            </div>
            <span className="text-[11px] text-slate-400">
              {onHoldCount} on hold · {rejectedCount} rejected (refunded)
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-slate-900 text-slate-400 flex items-center justify-center border border-slate-800">
            <ShieldCheck className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Safety Notice: Zero Fake Settlement Protocol */}
      <div className="bg-blue-950/40 border border-blue-900/60 rounded-2xl p-3.5 text-xs text-blue-200 space-y-1">
        <div className="flex items-center gap-1.5 font-bold text-blue-100">
          <Info className="w-4 h-4 text-blue-400 shrink-0" />
          <span>Secure Payout Protocol & Webhook Settlement Gate</span>
        </div>
        <p className="text-[11px] text-blue-200 leading-relaxed">
          Admin approval queues requests in <strong>Processing</strong> state. In accordance with zero-fake-settlement security rules, payouts are never marked <strong>Settled</strong> until a verified payment-provider webhook confirmation arrives. Rejection immediately restores the reserved funds to the partner’s wallet.
        </p>
      </div>

      {/* Action Feedback Banner */}
      {feedbackMsg && (
        <div
          className={`p-3 rounded-xl border text-xs font-semibold flex items-center gap-2 animate-in fade-in duration-200 ${
            feedbackMsg.type === 'success'
              ? 'bg-emerald-950 text-emerald-300 border-emerald-800'
              : feedbackMsg.type === 'error'
              ? 'bg-rose-950 text-rose-300 border-rose-800'
              : 'bg-blue-950 text-blue-300 border-blue-800'
          }`}
        >
          {feedbackMsg.type === 'success' ? (
            <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
          ) : feedbackMsg.type === 'error' ? (
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          ) : (
            <Info className="w-4 h-4 text-blue-400 shrink-0" />
          )}
          <span>{feedbackMsg.text}</span>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="bg-slate-950 p-3 rounded-2xl border border-slate-800 flex flex-wrap items-center justify-between gap-2.5">
        {/* Status Filter Buttons */}
        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar text-xs">
          <button
            type="button"
            onClick={() => setFilterStatus('all')}
            className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition-colors ${
              filterStatus === 'all'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-slate-900 text-slate-400 hover:text-white'
            }`}
          >
            All ({payouts.length})
          </button>

          <button
            type="button"
            onClick={() => setFilterStatus('pending')}
            className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition-colors flex items-center gap-1.5 ${
              filterStatus === 'pending'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'bg-slate-900 text-slate-400 hover:text-white'
            }`}
          >
            <span>Pending Review</span>
            {pendingCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-amber-400 text-slate-950 text-[10px] font-extrabold animate-pulse">
                {pendingCount}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setFilterStatus('processing')}
            className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition-colors flex items-center gap-1.5 ${
              filterStatus === 'processing'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-slate-900 text-slate-400 hover:text-white'
            }`}
          >
            <span>Processing</span>
            {processingCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-blue-400 text-slate-950 text-[10px] font-extrabold">
                {processingCount}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setFilterStatus('on_hold')}
            className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition-colors ${
              filterStatus === 'on_hold'
                ? 'bg-orange-600 text-white shadow-xs'
                : 'bg-slate-900 text-slate-400 hover:text-white'
            }`}
          >
            On Hold ({onHoldCount})
          </button>

          <button
            type="button"
            onClick={() => setFilterStatus('settled')}
            className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition-colors ${
              filterStatus === 'settled'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-slate-900 text-slate-400 hover:text-white'
            }`}
          >
            Settled ({settledCount})
          </button>

          <button
            type="button"
            onClick={() => setFilterStatus('rejected')}
            className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition-colors ${
              filterStatus === 'rejected'
                ? 'bg-rose-600 text-white shadow-xs'
                : 'bg-slate-900 text-slate-400 hover:text-white'
            }`}
          >
            Rejected ({rejectedCount})
          </button>
        </div>

        {/* Search */}
        <div className="relative min-w-[200px] flex-1 sm:flex-initial">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search partner, UPI, ref..."
            className="w-full bg-slate-900 text-white text-xs pl-8 pr-3 py-1.5 rounded-xl border border-slate-800 focus:outline-none focus:border-blue-500"
          />
        </div>
      </div>

      {/* Payout Records Table/Cards */}
      <div className="space-y-2.5">
        {filteredPayouts.length === 0 ? (
          <div className="bg-slate-950 p-8 rounded-2xl border border-slate-800 text-center text-slate-400 text-xs">
            No payout requests match the selected criteria.
          </div>
        ) : (
          filteredPayouts.map(p => {
            const isPending = p.status === 'pending' || p.adminApprovalStatus === 'pending_approval';
            const isProcessing = p.status === 'processing';
            const isHeld = p.status === 'on_hold';
            const isSettled = p.status === 'settled';
            const isRejected = p.status === 'rejected';

            const tech = technicians.find(t => t.id === p.technicianId);

            return (
              <div
                key={p.id}
                className={`p-4 bg-slate-950 rounded-2xl border transition-all space-y-3 shadow-xs ${
                  isPending
                    ? 'border-amber-600/70 bg-amber-950/15'
                    : isProcessing
                    ? 'border-blue-600/70 bg-blue-950/15'
                    : isHeld
                    ? 'border-orange-700/70 bg-orange-950/15'
                    : isRejected
                    ? 'border-rose-900/60 bg-rose-950/10'
                    : 'border-slate-800'
                }`}
              >
                {/* Header Row: Technician + Amount */}
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-white text-sm">{p.technicianName}</span>
                      <span className="font-mono text-blue-400 text-xs px-2 py-0.5 rounded-lg bg-blue-950/60 border border-blue-800/50">
                        {p.upiId}
                      </span>
                      {tech?.trades && (
                        <span className="text-[10px] font-semibold text-slate-300 bg-slate-800 px-1.5 py-0.5 rounded capitalize">
                          {tech.trades.join(', ')}
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-400 font-mono mt-1">
                      <span>ID: {p.id}</span>
                      <span>·</span>
                      <span>Ref: {p.referenceNumber}</span>
                      <span>·</span>
                      <span>
                        Requested: {new Date(p.requestedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}{' '}
                        {new Date(p.requestedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>

                    {/* Admin Note / Status explanation */}
                    {p.adminNote && (
                      <p className="text-[11px] text-slate-300 mt-1.5 flex items-center gap-1.5 bg-slate-900/80 px-2.5 py-1 rounded-lg border border-slate-800 w-fit">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                        <span>{p.adminNote}</span>
                      </p>
                    )}

                    {/* Settlement details */}
                    {isSettled && (
                      <div className="text-[11px] text-emerald-400 font-mono mt-1 flex items-center gap-2">
                        <span>Provider Ref: {p.providerEventId || 'CONFIRMED'}</span>
                        {p.settledAt && (
                          <span>
                            · Settled at {new Date(p.settledAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Amount and Status Badge */}
                  <div className="text-right">
                    <span className="font-mono font-extrabold text-emerald-400 text-lg block">
                      ₹{p.amount.toLocaleString('en-IN')}
                    </span>
                    <span
                      className={`text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-full inline-block mt-0.5 ${
                        isSettled
                          ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                          : isProcessing
                          ? 'bg-blue-950 text-blue-300 border border-blue-700 animate-pulse'
                          : isHeld
                          ? 'bg-orange-950 text-orange-400 border border-orange-800'
                          : isRejected
                          ? 'bg-rose-950 text-rose-400 border border-rose-800'
                          : 'bg-amber-950 text-amber-300 border border-amber-800 animate-pulse'
                      }`}
                    >
                      {isSettled
                        ? 'Settled (Webhook Confirmed)'
                        : isProcessing
                        ? 'Processing · Awaiting Webhook'
                        : isHeld
                        ? 'Held in Escrow'
                        : isRejected
                        ? 'Rejected (Funds Restored)'
                        : 'Awaiting Admin Review'}
                    </span>
                  </div>
                </div>

                {/* Action Buttons Toolbar */}
                <div className="pt-2 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-2 text-xs">
                  <span className="text-[11px] text-slate-400">
                    Master Source: <strong className="text-slate-200">{adminPaymentConfig.merchantName}</strong> ({adminPaymentConfig.merchantVpa})
                  </span>

                  <div className="flex items-center gap-2">
                    {/* Approve Button (Visible if pending or on_hold) */}
                    {(isPending || isHeld) && (
                      <button
                        onClick={() => handleApprove(p.id)}
                        disabled={isProcessingId === p.id}
                        className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 transition-colors shadow-xs disabled:opacity-50"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Approve (Move to Processing)</span>
                      </button>
                    )}

                    {/* Hold Button (Visible if pending) */}
                    {isPending && (
                      <button
                        onClick={() => handleHold(p.id)}
                        disabled={isProcessingId === p.id}
                        className="px-3 py-1.5 bg-orange-950 hover:bg-orange-900 text-orange-300 border border-orange-800 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-50"
                      >
                        <Lock className="w-3.5 h-3.5 text-orange-400" />
                        <span>Put on Hold</span>
                      </button>
                    )}

                    {/* Reject Button (Visible if not settled and not already rejected) */}
                    {!isSettled && !isRejected && (
                      <button
                        onClick={() => handleReject(p.id, p.amount)}
                        disabled={isProcessingId === p.id}
                        className="px-3 py-1.5 bg-slate-900 hover:bg-rose-950 text-slate-400 hover:text-rose-300 border border-slate-800 hover:border-rose-800 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-50"
                      >
                        <XCircle className="w-3.5 h-3.5 text-rose-400" />
                        <span>Reject & Restore Funds</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
