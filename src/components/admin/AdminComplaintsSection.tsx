import React, { useCallback, useEffect, useState } from 'react';
import { auth } from '../../lib/firebase';

export const AdminComplaintsSection: React.FC = () => {
  const [items,setItems]=useState<any[]>([]);
  const [status,setStatus]=useState('under_review');
  const [decision,setDecision]=useState('no_action');
  const [note,setNote]=useState('');
  const [selected,setSelected]=useState('');
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [message,setMessage]=useState('');
  const load=useCallback(async()=>{
    const user=auth.currentUser;
    if(!user) throw new Error('Admin Firebase session is missing.');
    const token=await user.getIdToken();
    const response=await fetch('/api/admin/complaints',{headers:{Authorization:'Bearer '+token}});
    const result=await response.json();
    if(!response.ok||!result.success) throw new Error(result.error||'Admin access denied or complaint list unavailable.');
    setItems(Array.isArray(result.complaints)?result.complaints:[]);
  },[]);
  useEffect(()=>{void load().catch(e=>setError(e instanceof Error?e.message:'Unable to load complaints.'));},[load]);
  const review=async(e:React.FormEvent)=>{
    e.preventDefault(); if(!selected)return;
    setBusy(true);setError('');setMessage('');
    try{
      const user=auth.currentUser;if(!user)throw new Error('Admin Firebase session is missing.');
      const token=await user.getIdToken();
      const response=await fetch('/api/admin/complaints/'+encodeURIComponent(selected)+'/review',{
        method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},
        body:JSON.stringify({status,decision,adminNote:note.trim()})
      });
      const result=await response.json();if(!response.ok||!result.success)throw new Error(result.error||'Review could not be saved.');
      setMessage('Review saved for case '+selected);setNote('');await load();
    }catch(e){setError(e instanceof Error?e.message:'Review failed.');}
    finally{setBusy(false);}
  };
  return <section className="p-4 space-y-4">
    <div><h2 className="text-lg font-bold text-slate-900">Customer & Partner Complaints</h2><p className="text-xs text-slate-500">Server-authorized case queue · no automatic penalties or wallet deductions</p></div>
    {error&&<p role="alert" className="text-sm text-red-700 bg-red-50 p-3 rounded-xl">{error}</p>}
    {message&&<p role="status" className="text-sm text-emerald-700 bg-emerald-50 p-3 rounded-xl">{message}</p>}
    <button onClick={()=>void load().catch(e=>setError(e.message))} className="px-3 py-2 rounded-lg bg-slate-100 text-sm font-semibold">Refresh cases</button>
    {items.length===0?<p className="text-sm text-slate-500">No complaint cases found, or the secure admin API is not available.</p>:<div className="space-y-2">{items.map(item=><button key={item.id} onClick={()=>setSelected(item.id)} className={'w-full text-left border rounded-xl p-3 '+(selected===item.id?'border-blue-500 bg-blue-50':'border-slate-200 bg-white')}><div className="flex justify-between gap-2 text-xs"><b>Case {item.id}</b><span className="font-bold text-blue-700">{item.status}</span></div><p className="text-xs mt-1">{item.category} · Booking {item.bookingId}</p><p className="text-xs text-slate-600 mt-1">{item.description}</p><p className="text-[10px] text-slate-500 mt-1">Reported by {item.actorRole} · {item.actorUid}</p></button>)}</div>}
    {selected&&<form onSubmit={review} className="border rounded-xl p-3 space-y-2"><h3 className="font-bold text-sm">Review selected case</h3>
      <label className="block text-xs font-semibold">Case status</label><select value={status} onChange={e=>setStatus(e.target.value)} className="w-full border rounded-lg p-2 text-sm"><option value="under_review">Under review</option><option value="resolved">Resolved</option><option value="dismissed">Dismissed</option></select>
      <label className="block text-xs font-semibold">Decision / action</label><select value={decision} onChange={e=>setDecision(e.target.value)} className="w-full border rounded-lg p-2 text-sm"><option value="no_action">No action</option><option value="warning_recommended">Warning recommended</option><option value="payment_follow_up">Payment follow-up</option><option value="account_restriction_recommended">Account restriction recommended</option><option value="refund_review">Refund review</option></select>
      <label className="block text-xs font-semibold">Reason and review note (5–2000 characters)</label><textarea required minLength={5} maxLength={2000} rows={3} value={note} onChange={e=>setNote(e.target.value)} className="w-full border rounded-lg p-2 text-sm" placeholder="Evidence reviewed, findings, next step…"/>
      <button disabled={busy} className="w-full bg-blue-700 text-white rounded-lg p-2.5 text-sm font-bold disabled:opacity-50">{busy?'Saving…':'Save review'}</button>
    </form>}
  </section>;
};
