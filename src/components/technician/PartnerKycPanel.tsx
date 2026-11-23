import React, { useCallback, useEffect, useState } from 'react';
import { FileCheck, UploadCloud, ShieldCheck, AlertCircle, RefreshCw } from 'lucide-react';
import { ref, uploadBytes } from 'firebase/storage';
import { auth, isFirebaseConfigured, storage } from '../../lib/firebase';

type KycDocumentType = 'identity_proof' | 'address_proof' | 'qualification_certificate' | 'profile_photo';
type KycConfig = {
  privacyNoticeVersion: string;
  retentionDays: number;
  maxFileBytes: number;
  allowedContentTypes: string[];
  documentTypes: KycDocumentType[];
};
type KycSubmission = {
  submissionId: string;
  documentType: KycDocumentType;
  status: string;
  submittedAt: string | null;
  reviewedAt: string | null;
  reviewReason: string | null;
};

const DOCUMENT_LABELS: Record<KycDocumentType, string> = {
  identity_proof: 'Identity proof',
  address_proof: 'Address proof',
  qualification_certificate: 'Trade / qualification certificate',
  profile_photo: 'Profile photo'
};

const formatDate = (value: string | null) => value ? new Date(value).toLocaleString() : '—';

export const PartnerKycPanel: React.FC = () => {
  const [config, setConfig] = useState<KycConfig | null>(null);
  const [submissions, setSubmissions] = useState<KycSubmission[]>([]);
  const [documentType, setDocumentType] = useState<KycDocumentType>('identity_proof');
  const [file, setFile] = useState<File | null>(null);
  const [consentAccepted, setConsentAccepted] = useState(false);
  const [retentionAccepted, setRetentionAccepted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [configUnavailable, setConfigUnavailable] = useState(false);

  const loadKyc = useCallback(async () => {
    const user = auth.currentUser;
    if (!isFirebaseConfigured || !user) {
      setConfigUnavailable(true);
      setError('Secure KYC requires an active QuickFix Firebase sign-in.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const token = await user.getIdToken();
      const headers = { Authorization: `Bearer ${token}` };
      const [configResponse, statusResponse] = await Promise.all([
        fetch('/api/partners/kyc-config', { headers }),
        fetch('/api/partners/kyc-status', { headers })
      ]);
      const configResult = await configResponse.json();
      const statusResult = await statusResponse.json();
      if (!configResponse.ok || !configResult.success) {
        setConfig(null);
        setConfigUnavailable(true);
        throw new Error(configResult.error || 'Secure KYC is not configured on the server.');
      }
      if (!statusResponse.ok || !statusResult.success || !Array.isArray(statusResult.submissions)) {
        throw new Error(statusResult.error || 'KYC status could not be loaded.');
      }
      setConfig(configResult as KycConfig);
      setConfigUnavailable(false);
      setSubmissions(statusResult.submissions as KycSubmission[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'KYC details could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadKyc(); }, [loadKyc]);

  const handleUpload = async () => {
    setError('');
    setMessage('');
    const user = auth.currentUser;
    if (!user || !config || !storage || !isFirebaseConfigured) {
      setError('Secure KYC upload is not configured. No document was submitted.');
      return;
    }
    if (!file) {
      setError('Please choose a document first.');
      return;
    }
    if (!config.documentTypes.includes(documentType)) {
      setError('This document type is not enabled by QuickFix.');
      return;
    }
    if (!config.allowedContentTypes.includes(file.type) || file.size <= 0 || file.size > config.maxFileBytes) {
      setError('Choose a JPG, PNG or PDF file within the displayed size limit.');
      return;
    }
    if (!consentAccepted || !retentionAccepted) {
      setError('Please read and accept both privacy and retention acknowledgements.');
      return;
    }

    setUploading(true);
    try {
      const submissionId = crypto.randomUUID();
      const extension = file.type === 'image/jpeg' ? 'jpg' : file.type === 'image/png' ? 'png' : 'pdf';
      const objectPath = `partner-kyc/${user.uid}/${submissionId}_${documentType}.${extension}`;
      const token = await user.getIdToken();

      // Upload only to the private partner-kyc path. Never create a public download URL.
      await uploadBytes(ref(storage, objectPath), file, { contentType: file.type });
      const response = await fetch('/api/partners/kyc-submissions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          submissionId,
          documentType,
          objectPath,
          privacyNoticeVersion: config.privacyNoticeVersion,
          consentAccepted: true,
          retentionNoticeAccepted: true
        })
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.error || 'The document upload could not be submitted for review.');
      }
      setMessage(result.message || 'Document received securely and queued for review.');
      setFile(null);
      setConsentAccepted(false);
      setRetentionAccepted(false);
      const input = document.getElementById('partner-kyc-file') as HTMLInputElement | null;
      if (input) input.value = '';
      await loadKyc();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed. Please retry.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <section className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm space-y-3">
      <div className="flex items-center gap-2">
        <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center"><ShieldCheck className="w-5 h-5" /></div>
        <div>
          <h3 className="text-sm font-bold text-slate-900">Secure KYC Document Submission</h3>
          <p className="text-[11px] text-slate-500">Private upload · Admin review · No public document links</p>
        </div>
      </div>

      {loading ? (
        <div className="text-xs text-slate-500 flex items-center gap-2"><RefreshCw className="w-4 h-4 animate-spin" /> Loading secure KYC policy…</div>
      ) : configUnavailable ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 flex gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <div><strong>Secure upload is currently disabled.</strong><p className="mt-1">{error || 'QuickFix server privacy policy and private Storage configuration are not ready. Do not send documents on WhatsApp or to anyone personally.'}</p></div>
        </div>
      ) : config ? (
        <>
          <div className="rounded-xl bg-blue-50 border border-blue-100 p-3 text-xs text-blue-950">
            Upload your required documents for admin verification. Files are stored in a private folder and are not made public. QuickFix's configured retention period is <strong>{config.retentionDays} days</strong>.
          </div>
          <div>
            <label htmlFor="partner-kyc-type" className="block text-xs font-semibold text-slate-700 mb-1">Document type</label>
            <select id="partner-kyc-type" value={documentType} onChange={e => setDocumentType(e.target.value as KycDocumentType)} className="w-full rounded-xl border border-slate-300 bg-white p-2.5 text-sm">
              {config.documentTypes.map(type => <option key={type} value={type}>{DOCUMENT_LABELS[type]}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="partner-kyc-file" className="block text-xs font-semibold text-slate-700 mb-1">Choose document (JPG, PNG or PDF)</label>
            <input id="partner-kyc-file" type="file" accept="image/jpeg,image/png,application/pdf" onChange={e => setFile(e.target.files?.[0] || null)} className="block w-full text-xs file:mr-3 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-xs file:font-semibold" />
            <p className="text-[10px] text-slate-500 mt-1">Maximum size: {Math.floor(config.maxFileBytes / (1024 * 1024))} MB. Do not upload unrelated documents.</p>
          </div>
          <label className="flex items-start gap-2 text-xs text-slate-700"><input type="checkbox" checked={consentAccepted} onChange={e => setConsentAccepted(e.target.checked)} className="mt-0.5" /><span>I consent to QuickFix processing this document for identity, address or qualification verification under privacy notice {config.privacyNoticeVersion}.</span></label>
          <label className="flex items-start gap-2 text-xs text-slate-700"><input type="checkbox" checked={retentionAccepted} onChange={e => setRetentionAccepted(e.target.checked)} className="mt-0.5" /><span>I understand the document is scheduled for retention for up to {config.retentionDays} days under the configured policy.</span></label>
          <button type="button" onClick={() => void handleUpload()} disabled={uploading || !file || !consentAccepted || !retentionAccepted} className="w-full rounded-xl bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 disabled:text-slate-500 text-white font-bold text-sm py-3 flex items-center justify-center gap-2">
            <UploadCloud className="w-4 h-4" />{uploading ? 'Uploading securely…' : 'Upload & Submit for Review'}
          </button>
        </>
      ) : null}

      {error && !configUnavailable && <div role="alert" className="rounded-lg bg-rose-50 border border-rose-200 p-2.5 text-xs text-rose-800">{error}</div>}
      {message && <div role="status" className="rounded-lg bg-emerald-50 border border-emerald-200 p-2.5 text-xs text-emerald-800 flex gap-2"><FileCheck className="w-4 h-4 shrink-0" />{message}</div>}

      <div className="border-t border-slate-100 pt-3 space-y-2">
        <div className="flex items-center justify-between"><h4 className="text-xs font-bold text-slate-800">My KYC submissions</h4><button type="button" onClick={() => void loadKyc()} className="text-[11px] font-semibold text-blue-700">Refresh</button></div>
        {submissions.length === 0 ? <p className="text-[11px] text-slate-500">No submitted documents found.</p> : submissions.map(item => (
          <div key={item.submissionId} className="rounded-lg border border-slate-200 p-2.5 text-xs">
            <div className="flex items-center justify-between gap-2"><strong className="text-slate-800">{DOCUMENT_LABELS[item.documentType] || item.documentType}</strong><span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-bold capitalize text-slate-700">{item.status.replace(/_/g, ' ')}</span></div>
            <p className="text-[10px] text-slate-500 mt-1">Submitted: {formatDate(item.submittedAt)} · Reviewed: {formatDate(item.reviewedAt)}</p>
            {item.reviewReason && <p className="mt-1 text-[11px] text-amber-800">Admin note: {item.reviewReason}</p>}
          </div>
        ))}
      </div>
      <p className="text-[10px] text-slate-500">KYC approval is a document review only. It does not automatically activate your partner account or authorize duty.</p>
    </section>
  );
};
