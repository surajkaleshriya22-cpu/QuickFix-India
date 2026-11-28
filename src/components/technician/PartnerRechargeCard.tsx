import React, { useEffect, useState } from 'react';
import { auth } from '../../lib/firebase';
import { CreditCard, RefreshCw, ShieldCheck } from 'lucide-react';

type Package = { id: string; name: string; amountPaise: number; durationDays: number; currency: string };

export const PartnerRechargeCard: React.FC = () => {
  const [packages, setPackages] = useState<Package[]>([]);
  const [trialDays, setTrialDays] = useState(30);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setError(''); setStatus('');
    try {
      const user = auth.currentUser;
      if (!user) throw new Error('Please sign in again to load recharge plans.');
      const token = await user.getIdToken();
      const response = await fetch('/api/partners/recharge/packages', { headers: { Authorization: 'Bearer ' + token } });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.success) throw new Error(result.error || 'Recharge plans are not available.');
      setPackages(Array.isArray(result.packages) ? result.packages : []);
      setTrialDays(Number.isInteger(result.trialDays) ? result.trialDays : 30);
    } catch (e: any) { setError(e?.message || 'Could not load recharge plans.'); }
  };

  useEffect(() => { void load(); }, []);

  const pay = async (pkg: Package) => {
    setBusy(true); setError(''); setStatus('Creating secure payment order…');
    try {
      const user = auth.currentUser;
      if (!user) throw new Error('Please sign in again before payment.');
      const token = await user.getIdToken();
      const orderResponse = await fetch('/api/partners/recharge/orders', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({ packageId: pkg.id })
      });
      const order = await orderResponse.json().catch(() => ({}));
      if (!orderResponse.ok || !order.success || !order.orderId || !order.keyId) throw new Error(order.error || 'Payment order could not be created.');
      if (!(window as any).Razorpay) {
        await new Promise<void>((resolve, reject) => {
          const existing = document.querySelector('script[data-quickfix-razorpay="true"]') as HTMLScriptElement | null;
          if (existing) {
            if ((window as any).Razorpay) { resolve(); return; }
            existing.addEventListener('load', () => resolve(), { once: true });
            existing.addEventListener('error', () => reject(new Error('Razorpay checkout could not load.')), { once: true });
            return;
          }
          const script = document.createElement('script');
          script.src = 'https://checkout.razorpay.com/v1/checkout.js';
          script.async = true; script.dataset.quickfixRazorpay = 'true';
          script.onload = () => resolve(); script.onerror = () => reject(new Error('Razorpay checkout could not load.'));
          document.body.appendChild(script);
        });
      }
      const Checkout = (window as any).Razorpay;
      if (!Checkout) throw new Error('Secure payment window could not be opened.');
      setStatus('Complete payment in the secure Razorpay window.');
      await new Promise<void>((resolve, reject) => {
        let settled = false;
        const finish = (err?: Error) => { if (settled) return; settled = true; err ? reject(err) : resolve(); };
        const checkout = new Checkout({
          key: order.keyId, amount: order.amount, currency: order.currency, order_id: order.orderId,
          name: 'KamXApp', description: pkg.name,
          handler: async (payment: any) => {
            try {
              const verifyResponse = await fetch('/api/partners/recharge/verify', {
                method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
                body: JSON.stringify({ rechargeId: order.rechargeId, orderId: payment.razorpay_order_id, paymentId: payment.razorpay_payment_id, signature: payment.razorpay_signature })
              });
              const verification = await verifyResponse.json().catch(() => ({}));
              if (!verifyResponse.ok || !verification.success || verification.paymentStatus !== 'paid') throw new Error(verification.error || 'Payment is not yet verified. Do not pay again until the payment status is checked.');
              finish();
            } catch (e: any) { finish(new Error(e?.message || 'Payment verification failed.')); }
          },
          modal: { ondismiss: () => finish(new Error('Payment window closed. If money was deducted, refresh recharge status before retrying.')) },
          theme: { color: '#2563eb' }
        });
        checkout.on('payment.failed', (failure: any) => finish(new Error(failure?.error?.description || 'Payment failed.')));
        checkout.open();
      });
      setStatus('Recharge payment verified. Subscription has been activated.');
    } catch (e: any) { setError(e?.message || 'Recharge payment could not be completed.'); setStatus(''); }
    finally { setBusy(false); }
  };

  return <section className="rounded-2xl border border-emerald-800 bg-slate-950 p-4 text-white space-y-3">
    <div className="flex items-center gap-2"><CreditCard className="w-5 h-5 text-emerald-400" /><div><h3 className="font-bold text-sm">Partner Subscription Recharge</h3><p className="text-[10px] text-slate-400">Separate from your service earnings wallet</p></div></div>
    <div className="rounded-xl bg-emerald-950/50 border border-emerald-900 p-3 text-xs text-emerald-200">{trialDays > 0 ? `New partner free trial: ${trialDays} days (set by KamXApp Admin).` : 'No free trial is currently configured.'}</div>
    {packages.length === 0 && !error && <p className="text-xs text-slate-400">No active recharge packages are available yet. Please check again later.</p>}
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">{packages.map(pkg => <div key={pkg.id} className="rounded-xl border border-slate-700 bg-slate-900 p-3 space-y-2">
      <div className="font-bold text-sm">{pkg.name}</div><div className="text-xl font-extrabold">₹{Math.round(pkg.amountPaise / 100).toLocaleString('en-IN')}</div><div className="text-xs text-slate-400">{pkg.durationDays} days validity</div>
      <button type="button" disabled={busy} onClick={() => void pay(pkg)} className="w-full rounded-lg bg-emerald-600 disabled:opacity-50 px-3 py-2 text-xs font-bold">{busy ? 'Please wait…' : 'Recharge securely'}</button>
    </div>)}</div>
    {error && <p role="alert" className="rounded-lg border border-rose-800 bg-rose-950/50 p-2 text-xs text-rose-300">{error}</p>}
    {status && <p role="status" className="rounded-lg border border-slate-700 bg-slate-900 p-2 text-xs text-slate-200 flex items-center gap-2"><ShieldCheck className="w-4 h-4 text-emerald-400" />{status}</p>}
    <button type="button" disabled={busy} onClick={() => void load()} className="text-xs text-blue-300 flex items-center gap-1"><RefreshCw className="w-3 h-3" /> Refresh plans</button>
  </section>;
};
