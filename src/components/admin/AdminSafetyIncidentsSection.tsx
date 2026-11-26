import React, { useCallback, useEffect, useState } from 'react';
import { auth } from '../../lib/firebase';

type Incident = { incidentId: string; bookingId: string; reporterRole: string; incidentType: string; status: string; adminSmsStatus: string; createdAt: string | null };
const labels: Record<string,string> = { received_pending_review:'New / समीक्षा बाकी', acknowledged:'Acknowledged / स्वीकार किया', under_review:'Under review / जाँच जारी', resolved:'Resolved / हल', closed:'Closed / बंद' };

export const AdminSafetyIncidentsSection: React.FC = () => {
  const [items,setItems] = useState<Incident[]>([]);
  const [loading,setLoading] = useState(false);
  const [error,setError] = useState('');
  const [notice,setNotice] = useState('');
  const [busy,setBusy] = useState('');
  const load = useCallback(async () => {
    const user=auth.currentUser;
    if(!user){setError('Admin login session is missing.');return;}
    setLoading(true);setError('');
    try{
      const response=await fetch('/api/admin/safety-incidents',{headers:{Authorization:'Bearer '+await user.getIdToken()}});
      const result=await response.json();
      if(!response.ok||!result.success)throw new Error(result.error||'Safety reports could not be loaded.');
      setItems(Array.isArray(result.incidents)?result.incidents:[]);
    }catch(e){setError(e instanceof Error?e.message:'Safety reports unavailable.');}
    finally{setLoading(false);}
  },[]);
  useEffect(()=>{void load();},[load]);
  const update = async (item:Incident,status:string) => {
    const user=auth.currentUser;if(!user)return;
    setBusy(item.incidentId);setError('');setNotice('');
    try{
      const response=await fetch('/api/admin/safety-incidents/'+encodeURIComponent(item.incidentId),{
        method:'PATCH',headers:{Authorization:'Bearer '+await user.getIdToken(),'Content-Type':'application/json'},
        body:JSON.stringify({status})
      });
      const result=await response.json();if(!response.ok||!result.success)throw new Error(result.error||'Status update failed.');
      setNotice('Safety report status updated.');await load();
    }catch(e){setError(e instanceof Error?e.message:'Status update failed.');}
    finally{setBusy('');}
  };
  return <section className="space-y-3 rounded-2xl border border-rose-200 bg-white p-4">
    <div className="flex items-center justify-between gap-2"><div><h3 className="font-bold text-rose-900">Safety / SOS reports</h3><p className="text-xs text-slate-500">Admin review queue · phone numbers and private report text are not shown</p></div><button type="button" onClick={()=>void load()} disabled={loading} className="rounded-lg border px-3 py-2 text-xs font-semibold disabled:opacity-50">{loading?'Loading…':'Refresh'}</button></div>
    {error&&<p role="alert" className="text-xs text-rose-700">{error}</p>}{notice&&<p role="status" className="text-xs text-emerald-700">{notice}</p>}
    {!loading&&items.length===0&&!error&&<p className="text-xs text-slate-500">No SOS reports have been recorded.</p>}
    {items.map(item=><article key={item.incidentId} className="rounded-xl border border-slate-200 p-3 space-y-2">
      <div className="flex flex-wrap justify-between gap-2"><b className="text-xs text-slate-800">{item.incidentType.replace(/_/g,' ')} · {item.reporterRole}</b><span className="text-[10px] font-semibold text-rose-700">{labels[item.status]||item.status}</span></div>
      <p className="text-[11px] text-slate-500">Booking: {item.bookingId} · {item.createdAt?new Date(item.createdAt).toLocaleString():'Time unavailable'}</p>
      <p className="text-[11px] font-semibold text-slate-600">Admin SMS: {item.adminSmsStatus === 'sent' ? 'Twilio accepted request' : item.adminSmsStatus === 'failed' ? 'Failed' : 'Not configured'}</p>
      <div className="flex flex-wrap gap-2">{(['acknowledged','under_review','resolved','closed'] as const).map(status=><button key={status} type="button" disabled={busy===item.incidentId||item.status===status} onClick={()=>void update(item,status)} className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-[10px] font-semibold disabled:opacity-40">{labels[status]}</button>)}</div>
    </article>)}
    <p className="text-[10px] text-amber-800">QuickFix records and reviews reports only. Admin SMS is optional and works only with verified server secrets; “sent” means Twilio accepted the request, not handset delivery. No police/ambulance dispatch. Immediate danger: call 112.</p>
  </section>;
};
