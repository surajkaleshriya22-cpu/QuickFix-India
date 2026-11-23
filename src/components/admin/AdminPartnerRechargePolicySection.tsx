import React, { useCallback, useEffect, useState } from 'react';
import { auth } from '../../lib/firebase';

type RechargePolicy = {
  freeTrialDays: number;
  currentRechargeAmount: number;
  rolloutAmounts: number[];
  effectiveAt: string | null;
  enabled: boolean;
};

const DEFAULT_POLICY: RechargePolicy = {
  freeTrialDays: 30,
  currentRechargeAmount: 500,
  rolloutAmounts: [500, 1000, 2000],
  effectiveAt: null,
  enabled: true
};

export const AdminPartnerRechargePolicySection: React.FC = () => {
  const [policy, setPolicy] = useState<RechargePolicy>(DEFAULT_POLICY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const request = useCallback(async (method: 'GET' | 'PUT', body?: RechargePolicy) => {
    const user = auth.currentUser;
    if (!user) throw new Error('Admin Firebase session is missing. Please sign in again.');
    const token = await user.getIdToken();
    const response = await fetch('/api/admin/partner-recharge-policy', {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(body ? { 'Content-Type': 'application/json' } : {})
      },
      ...(body ? { body: JSON.stringify(body) } : {})
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result.success) throw new Error(result.error || 'Recharge policy request failed.');
    return result.policy as RechargePolicy;
  }, []);

  useEffect(() => {
    let active = true;
    request('GET')
      .then((loaded) => { if (active) setPolicy({ ...DEFAULT_POLICY, ...loaded }); })
      .catch((reason: Error) => { if (active) setError(reason.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [request]);

  const updateStage = (index: number, value: string) => {
    const amounts = [...policy.rolloutAmounts];
    amounts[index] = value === '' ? 0 : Number(value);
    setPolicy((current) => ({ ...current, rolloutAmounts: amounts }));
  };

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const saved = await request('PUT', policy);
      setPolicy({ ...DEFAULT_POLICY, ...saved });
      setMessage('Recharge policy saved securely. Existing paid periods are not changed retroactively.');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Recharge policy could not be saved.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4 text-sm text-slate-300">Loading partner recharge policy…</div>;

  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-950 p-4 space-y-4">
      <div>
        <h3 className="text-base font-bold text-white">Channel Partner Free Trial & Recharge</h3>
        <p className="mt-1 text-xs text-slate-400">Set the launch offer and change the required recharge amount up or down. Changes are stored by the trusted admin server.</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="rounded-xl border border-emerald-800 bg-emerald-950/30 p-3">
          <div className="text-xs text-emerald-300">Launch offer</div>
          <div className="text-2xl font-extrabold text-white">30 days free</div>
          <div className="text-[11px] text-slate-400">Default for newly activated partners</div>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-3">
          <div className="text-xs text-slate-400">Current recharge</div>
          <div className="text-2xl font-extrabold text-white">₹{policy.currentRechargeAmount.toLocaleString('en-IN')}</div>
          <div className="text-[11px] text-slate-400">Editable below; no automatic payment is taken</div>
        </div>
      </div>
      <form onSubmit={save} className="space-y-3">
        <label className="block space-y-1">
          <span className="text-xs font-semibold text-slate-300">Free trial duration (days)</span>
          <input type="number" min="0" max="365" step="1" value={policy.freeTrialDays} onChange={(e) => setPolicy((p) => ({ ...p, freeTrialDays: Number(e.target.value) }))} className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-white" required />
        </label>
        <label className="block space-y-1">
          <span className="text-xs font-semibold text-slate-300">Currently required recharge (₹)</span>
          <input type="number" min="0" max="100000" step="1" value={policy.currentRechargeAmount} onChange={(e) => setPolicy((p) => ({ ...p, currentRechargeAmount: Number(e.target.value) }))} className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-white" required />
        </label>
        <div>
          <div className="mb-2 text-xs font-semibold text-slate-300">Planned rollout stages (editable)</div>
          <div className="grid grid-cols-3 gap-2">
            {policy.rolloutAmounts.map((amount, index) => (
              <label key={index} className="space-y-1">
                <span className="text-[11px] text-slate-400">Stage {index + 1} (₹)</span>
                <input type="number" min="0" max="100000" step="1" value={amount} onChange={(e) => updateStage(index, e.target.value)} className="w-full min-w-0 rounded-lg border border-slate-700 bg-slate-900 px-2 py-2 text-white" required />
              </label>
            ))}
          </div>
        </div>
        <label className="block space-y-1">
          <span className="text-xs font-semibold text-slate-300">Policy effective date (optional)</span>
          <input type="date" value={policy.effectiveAt || ''} onChange={(e) => setPolicy((p) => ({ ...p, effectiveAt: e.target.value || null }))} className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-white" />
        </label>
        <label className="flex items-center gap-2 text-xs text-slate-300">
          <input type="checkbox" checked={policy.enabled} onChange={(e) => setPolicy((p) => ({ ...p, enabled: e.target.checked }))} />
          Enable partner recharge policy (does not activate payment collection by itself)
        </label>
        <div className="rounded-xl border border-amber-800 bg-amber-950/30 p-3 text-xs text-amber-200">
          Payment collection and partner duty gating remain disabled until a real payment provider, verified webhook, and server-side activation checks are deployed. This setting does not take money or lock wallet funds.
        </div>
        {error && <p role="alert" className="text-xs text-rose-300">{error}</p>}
        {message && <p role="status" className="text-xs text-emerald-300">{message}</p>}
        <button type="submit" disabled={saving} className="w-full rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">{saving ? 'Saving securely…' : 'Save Recharge Policy'}</button>
      </form>
    </section>
  );
};
