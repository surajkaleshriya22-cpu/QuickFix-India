import React, { useEffect, useState } from 'react';
import { CalendarDays, Clock, IndianRupee, ShieldCheck } from 'lucide-react';
import { auth } from '../../lib/firebase';

type RechargeStatus = {
  status: 'free_trial' | 'recharge_due' | 'activation_date_unavailable';
  freeTrialDays: number;
  currentRechargeAmount: number;
  availablePlans?: { id: string; durationDays: number; amount: number }[];
  trialEndsAt: string | null;
  daysRemaining?: number;
  paymentEnabled: false;
  message?: string;
};

export const PartnerRechargeStatusCard: React.FC = () => {
  const [status, setStatus] = useState<RechargeStatus | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const user = auth.currentUser;
        if (!user) return;
        const token = await user.getIdToken();
        const response = await fetch('/api/partner/recharge-status', { headers: { Authorization: `Bearer ${token}` } });
        const result = await response.json().catch(() => ({}));
        if (!response.ok || !result.success) throw new Error(result.error || 'Recharge status unavailable.');
        if (active) setStatus(result);
      } catch (reason) {
        if (active) setError(reason instanceof Error ? reason.message : 'Recharge status unavailable.');
      }
    };
    void load();
    return () => { active = false; };
  }, []);

  if (error) return <div className="rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-500">Free trial details could not be loaded. {error}</div>;
  if (!status) return <div className="rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-500">Loading free trial details…</div>;

  const free = status.status === 'free_trial';
  return (
    <section className={`rounded-2xl border p-4 space-y-2 ${free ? 'border-emerald-200 bg-emerald-50' : 'border-amber-200 bg-amber-50'}`}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
          {free ? <ShieldCheck className="h-4 w-4 text-emerald-700" /> : <Clock className="h-4 w-4 text-amber-700" />}
          <span>{free ? 'Your free launch period is active' : status.status === 'recharge_due' ? 'Free period completed' : 'Trial date pending verification'}</span>
        </div>
        <span className="rounded-full bg-white/80 px-2 py-1 text-[10px] font-bold text-slate-700">{status.freeTrialDays} days free</span>
      </div>
      {status.trialEndsAt && (
        <div className="flex items-center gap-1.5 text-xs text-slate-700">
          <CalendarDays className="h-3.5 w-3.5" />
          <span>Free period ends: {new Date(status.trialEndsAt).toLocaleDateString('en-IN')}</span>
        </div>
      )}
      {free && typeof status.daysRemaining === 'number' && <p className="text-xs font-semibold text-emerald-800">{status.daysRemaining} days remaining</p>}
      <div className="flex items-center gap-1.5 text-xs text-slate-700">
        <IndianRupee className="h-3.5 w-3.5" />
        <span>Recharge after free period: ₹{status.currentRechargeAmount.toLocaleString('en-IN')}</span>
      </div>
      {status.availablePlans && status.availablePlans.length > 0 && (
        <div className="grid grid-cols-3 gap-2 pt-1">
          {status.availablePlans.map((plan) => (
            <div key={plan.id} className="rounded-lg border border-slate-200 bg-white/80 p-2 text-center">
              <div className="text-[10px] font-semibold text-slate-500">{plan.durationDays} days</div>
              <div className="text-sm font-extrabold text-slate-900">₹{plan.amount.toLocaleString('en-IN')}</div>
            </div>
          ))}
        </div>
      )}
      <p className="text-[11px] text-slate-600">{status.message || 'Recharge is not yet being collected.'}</p>
      <p className="text-[10px] font-semibold text-slate-500">No payment has been taken. Payment activation will happen only after secure payment setup.</p>
    </section>
  );
};
