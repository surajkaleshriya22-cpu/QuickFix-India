import React, { useEffect, useState } from 'react';
import { auth } from '../../lib/firebase';
import { getIdToken } from 'firebase/auth';

type WalletAuditData = {
  accounts: Array<{ partnerUid: string; availableBalance: number; lockedReserve: number; reserveRequired: number; reserveStatus: string; withdrawalsEnabled: boolean }>;
  ledger: Array<{ id: string; partnerUid: string; type: string; amount: number; availableBalanceAfter: number; lockedReserveAfter: number; createdAt: string | null; note: string }>;
  notice: string;
};

export const AdminWalletAuditSection: React.FC = () => {
  const [data, setData] = useState<WalletAuditData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const user = auth.currentUser;
      if (!user) throw new Error('Admin Firebase session expired. Please sign in again.');
      const token = await getIdToken(user);
      const response = await fetch('/api/admin/wallet-audit', { headers: { Authorization: 'Bearer ' + token } });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || payload.success !== true || !Array.isArray(payload.accounts) || !Array.isArray(payload.ledger)) {
        throw new Error(typeof payload.error === 'string' ? payload.error : 'Wallet audit could not be loaded.');
      }
      setData({ accounts: payload.accounts, ledger: payload.ledger, notice: String(payload.notice || '') });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Wallet audit could not be loaded.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  return <section className="space-y-4">
    <div className="rounded-2xl border border-amber-800/70 bg-amber-950/30 p-4 text-sm text-amber-200">
      <div className="font-bold mb-1">Read-only financial audit</div>
      {data?.notice || 'Only server-owned wallet records are shown. This screen cannot move funds.'}
    </div>
    <div className="flex justify-end"><button onClick={() => void load()} disabled={loading} className="px-3 py-2 rounded-lg bg-slate-800 text-white text-xs disabled:opacity-50">{loading ? 'Loading…' : 'Refresh audit'}</button></div>
    {loading && <p className="text-sm text-slate-400">Loading server wallet records…</p>}
    {error && <p className="text-sm text-red-300">{error}</p>}
    {data && <>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="rounded-xl bg-slate-950 border border-slate-800 p-4"><div className="text-xs text-slate-400">Accounts loaded (max 200)</div><div className="text-2xl font-bold text-white">{data.accounts.length}</div></div>
        <div className="rounded-xl bg-slate-950 border border-slate-800 p-4"><div className="text-xs text-slate-400">Available balance total</div><div className="text-2xl font-bold text-white">₹{data.accounts.reduce((sum, x) => sum + x.availableBalance, 0).toLocaleString('en-IN')}</div></div>
        <div className="rounded-xl bg-slate-950 border border-slate-800 p-4"><div className="text-xs text-slate-400">Locked reserve total</div><div className="text-2xl font-bold text-white">₹{data.accounts.reduce((sum, x) => sum + x.lockedReserve, 0).toLocaleString('en-IN')}</div></div>
      </div>
      <div className="rounded-2xl border border-slate-800 overflow-x-auto">
        <h3 className="p-3 font-bold text-white bg-slate-950">Partner wallet accounts</h3>
        <table className="w-full text-xs text-left"><thead className="text-slate-400 bg-slate-900"><tr><th className="p-3">Partner UID</th><th className="p-3">Available</th><th className="p-3">Locked</th><th className="p-3">Reserve</th><th className="p-3">Withdrawals</th></tr></thead><tbody>
          {data.accounts.map(x => <tr key={x.partnerUid} className="border-t border-slate-800 text-slate-200"><td className="p-3 font-mono">{x.partnerUid}</td><td className="p-3">₹{x.availableBalance.toLocaleString('en-IN')}</td><td className="p-3">₹{x.lockedReserve.toLocaleString('en-IN')}</td><td className="p-3">{x.reserveStatus}</td><td className="p-3">{x.withdrawalsEnabled ? 'Enabled' : 'Disabled'}</td></tr>)}
          {!data.accounts.length && <tr><td className="p-3 text-slate-400" colSpan={5}>No wallet accounts found.</td></tr>}
        </tbody></table>
      </div>
      <div className="rounded-2xl border border-slate-800 overflow-x-auto">
        <h3 className="p-3 font-bold text-white bg-slate-950">Ledger events (max 300)</h3>
        <table className="w-full text-xs text-left"><thead className="text-slate-400 bg-slate-900"><tr><th className="p-3">Date</th><th className="p-3">Partner UID</th><th className="p-3">Event</th><th className="p-3">Amount</th><th className="p-3">Balance after</th><th className="p-3">Note</th></tr></thead><tbody>
          {data.ledger.map(x => <tr key={x.id} className="border-t border-slate-800 text-slate-200"><td className="p-3 whitespace-nowrap">{x.createdAt ? new Date(x.createdAt).toLocaleString('en-IN') : '—'}</td><td className="p-3 font-mono">{x.partnerUid}</td><td className="p-3">{x.type}</td><td className="p-3">₹{x.amount.toLocaleString('en-IN')}</td><td className="p-3">₹{x.availableBalanceAfter.toLocaleString('en-IN')}</td><td className="p-3 min-w-[180px]">{x.note}</td></tr>)}
          {!data.ledger.length && <tr><td className="p-3 text-slate-400" colSpan={6}>No ledger entries found.</td></tr>}
        </tbody></table>
      </div>
    </>}
  </section>;
};
