import React, { useCallback, useEffect, useState } from 'react';
import { auth } from '../../lib/firebase';
import { FileText, RefreshCw, ShieldCheck, AlertTriangle, ExternalLink, CheckCircle, XCircle } from 'lucide-react';

type KycItem = {
  submissionId: string;
  partnerUid: string;
  documentType: string;
  contentType: string;
  sizeBytes: number;
  submittedAt: string | null;
};

const labels: Record<string, string> = {
  identity_proof: 'Identity proof',
  address_proof: 'Address proof',
  qualification_certificate: 'Trade / qualification certificate',
  profile_photo: 'Profile photo'
};

export const AdminKycReviewSection: React.FC = () => {
  const [items, setItems] = useState<KycItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [authorized, setAuthorized] = useState<boolean | null>(null);

  const request = useCallback(async (path: string, init: RequestInit = {}) => {
    const user = auth.currentUser;
    if (!user) throw new Error('Admin Firebase session is missing. Please sign in again.');
    const token = await user.getIdToken();
    const response = await fetch(path, {
      ...init,
      headers: { Authorization: `Bearer ${token}`, ...(init.body ? { 'Content-Type': 'application/json' } : {}), ...init.headers }
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.success) throw new Error(data.error || 'Admin KYC request failed.');
    return data;
  }, []);

  const loadQueue = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await request('/api/admin/kyc-submissions');
      setItems(Array.isArray(data.submissions) ? data.submissions : []);
      setAuthorized(true);
    } catch (e) {
      const message = e instanceof Error ? e.message : 'KYC queue could not be loaded.';
      setError(message);
      setAuthorized(!/admin|authori[sz]|permission|forbidden|403/i.test(message) ? null : false);
    } finally {
      setLoading(false);
    }
  }, [request]);

  useEffect(() => { void loadQueue(); }, [loadQueue]);

  const openDocument = async (item: KycItem) => {
    setBusyId(item.submissionId);
    setError('');
    try {
      const data = await request(`/api/admin/kyc-submissions/${encodeURIComponent(item.submissionId)}/document-url`);
      if (typeof data.url !== 'string' || !data.url.startsWith('https://')) throw new Error('Server returned an invalid document link.');
      window.open(data.url, '_blank', 'noopener,noreferrer');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Document could not be opened.');
    } finally {
      setBusyId(null);
    }
  };

  const decide = async (item: KycItem, decision: 'approved' | 'rejected' | 'needs_resubmission') => {
    const reason = (reasons[item.submissionId] || '').trim();
    if (decision !== 'approved' && reason.length < 5) {
      setError('Reject या resubmission के लिए कम-से-कम 5 अक्षरों का कारण लिखें।');
      return;
    }
    const confirmText = decision === 'approved'
      ? 'इस document को approve करें? इससे partner account अपने-आप active नहीं होगा।'
      : decision === 'rejected' ? 'इस KYC document को reject करें?' : 'Partner से document दोबारा मंगाएँ?';
    if (!window.confirm(confirmText)) return;
    setBusyId(item.submissionId);
    setError('');
    setNotice('');
    try {
      await request(`/api/admin/kyc-submissions/${encodeURIComponent(item.submissionId)}/decision`, {
        method: 'POST',
        body: JSON.stringify({ decision, ...(reason ? { reason } : {}) })
      });
      setNotice(decision === 'approved' ? 'KYC document review approved. Partner activation is still separate.' : 'KYC review decision saved.');
      await loadQueue();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Review decision could not be saved.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2"><ShieldCheck className="w-5 h-5 text-blue-700" /> Channel Partner KYC Review</h2>
          <p className="text-xs text-slate-500 mt-1">Server-authorized queue · Private documents · Every decision is audited</p>
        </div>
        <button type="button" onClick={() => void loadQueue()} disabled={loading} className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 disabled:opacity-50"><RefreshCw className={`inline w-3.5 h-3.5 mr-1 ${loading ? 'animate-spin' : ''}`} />Refresh</button>
      </div>

      {error && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800 flex gap-2"><AlertTriangle className="w-4 h-4 shrink-0" />{error}</div>}
      {notice && <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800">{notice}</div>}
      {authorized === false && <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">इस Firebase account को server-side admin permission नहीं मिली। Admin custom claim और server authorization जाँचें।</div>}

      {loading ? <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500"><RefreshCw className="inline w-4 h-4 animate-spin mr-2" />KYC review queue लोड हो रही है…</div>
        : items.length === 0 ? <div className="rounded-xl border border-slate-200 bg-white p-8 text-center"><FileText className="w-8 h-8 mx-auto text-slate-300" /><p className="text-sm font-semibold text-slate-700 mt-2">कोई pending KYC submission नहीं है</p><p className="text-xs text-slate-500 mt-1">नई submissions आने पर यहाँ दिखाई देंगी।</p></div>
        : <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">{items.map(item => (
          <article key={item.submissionId} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div><h3 className="text-sm font-bold text-slate-900">{labels[item.documentType] || item.documentType}</h3><p className="text-[10px] text-slate-500 mt-1 break-all">Partner UID: {item.partnerUid}</p></div>
              <span className="rounded-full bg-amber-100 px-2 py-1 text-[10px] font-bold text-amber-800">Pending review</span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-600">
              <div className="rounded-lg bg-slate-50 p-2">File: <strong>{item.contentType || 'Unknown'}</strong></div>
              <div className="rounded-lg bg-slate-50 p-2">Size: <strong>{(item.sizeBytes / (1024 * 1024)).toFixed(2)} MB</strong></div>
              <div className="col-span-2 rounded-lg bg-slate-50 p-2">Submitted: <strong>{item.submittedAt ? new Date(item.submittedAt).toLocaleString() : '—'}</strong></div>
            </div>
            <button type="button" onClick={() => void openDocument(item)} disabled={busyId === item.submissionId} className="w-full rounded-lg border border-blue-200 bg-blue-50 py-2.5 text-xs font-bold text-blue-800 disabled:opacity-50"><ExternalLink className="inline w-4 h-4 mr-1" />{busyId === item.submissionId ? 'Please wait…' : 'Open private document (5-minute link)'}</button>
            <label className="block text-[11px] font-semibold text-slate-700">Review note (rejection / resubmission के लिए आवश्यक)
              <textarea value={reasons[item.submissionId] || ''} onChange={e => setReasons(old => ({ ...old, [item.submissionId]: e.target.value }))} maxLength={500} rows={2} className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-xs font-normal" placeholder="कारण लिखें…" />
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button type="button" onClick={() => void decide(item, 'approved')} disabled={busyId === item.submissionId} className="rounded-lg bg-emerald-600 px-2 py-2 text-[11px] font-bold text-white disabled:opacity-50"><CheckCircle className="inline w-3.5 h-3.5 mr-1" />Approve</button>
              <button type="button" onClick={() => void decide(item, 'needs_resubmission')} disabled={busyId === item.submissionId} className="rounded-lg bg-amber-500 px-2 py-2 text-[11px] font-bold text-white disabled:opacity-50">Resubmit</button>
              <button type="button" onClick={() => void decide(item, 'rejected')} disabled={busyId === item.submissionId} className="rounded-lg bg-rose-600 px-2 py-2 text-[11px] font-bold text-white disabled:opacity-50"><XCircle className="inline w-3.5 h-3.5 mr-1" />Reject</button>
            </div>
          </article>
        ))}</div>}
      <p className="text-[10px] text-slate-500">Security: documents are opened only through a short-lived server-signed URL. KYC approval does not set partner isVerified or activate duty.</p>
    </section>
  );
};
