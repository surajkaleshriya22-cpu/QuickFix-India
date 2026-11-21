import React, { useState } from 'react';
import { auth } from '../../lib/firebase';

type Props = { bookingId?: string };

export const PartnerSafetyPanel: React.FC<Props> = ({ bookingId }) => {
  const [name,setName]=useState('');
  const [phone,setPhone]=useState('');
  const [consent,setConsent]=useState(false);
  const [busy,setBusy]=useState(false);
  const [feedback,setFeedback]=useState('');
  const [error,setError]=useState('');
  const saveContact=async()=>{
    setBusy(true);setError('');setFeedback('');
    try{
      const user=auth.currentUser;if(!user)throw new Error('पहले अपने verified partner account से login करें।');
      const token=await user.getIdToken();
      const response=await fetch('/api/partners/safety/emergency-contact',{method:'PUT',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({name,phone,consentConfirmed:consent})});
      const result=await response.json();if(!response.ok||!result.success)throw new Error(result.error||'Emergency contact save नहीं हुआ।');
      setFeedback('Emergency contact सुरक्षित रूप से सेव हो गया। SOS पर SMS तभी भेजा जा सकता है जब provider और emergency contact सेट हों।');
    }catch(e){setError(e instanceof Error?e.message:'Contact save नहीं हुआ।');}finally{setBusy(false);}
  };
  const sendSos=async()=>{
    if(!bookingId){setError('SOS दर्ज करने के लिए आपकी active assigned booking उपलब्ध नहीं है। तत्काल खतरे में स्थानीय emergency services/police को सीधे कॉल करें।');return;}
    if(!window.confirm('क्या आप इस active booking के लिए SOS दर्ज करना चाहते हैं? यदि emergency contact और SMS provider सेट हैं, तो उन्हें SMS भेजने की कोशिश होगी। यह पुलिस या emergency services को कॉल नहीं करता।'))return;
    setBusy(true);setError('');setFeedback('');
    try{
      const user=auth.currentUser;if(!user)throw new Error('Partner login session नहीं मिला।');
      const token=await user.getIdToken();
      const response=await fetch('/api/partners/safety/sos',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({bookingId,message:'Partner requested urgent safety assistance.'})});
      const result=await response.json();if(!response.ok||!result.success)throw new Error(result.error||'SOS incident दर्ज नहीं हुआ।');
      setFeedback(result.message||'Safety incident QuickFix dashboard में दर्ज हुआ।');
    }catch(e){setError(e instanceof Error?e.message:'SOS दर्ज नहीं हुआ।');}finally{setBusy(false);}
  };
  return <section className="rounded-2xl border border-rose-200 bg-white p-4 space-y-3">
    <div><h3 className="font-bold text-rose-800">Partner Safety / पार्टनर सुरक्षा</h3><p className="text-xs text-slate-600 mt-1">असुरक्षित जगह, धमकी या जबरदस्ती होने पर काम रोककर सुरक्षित जगह जाएँ। तत्काल खतरे में स्थानीय emergency services/police को सीधे कॉल करें।</p></div>
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
      <input className="rounded-lg border p-2 text-sm" value={name} onChange={e=>setName(e.target.value)} placeholder="Emergency contact name"/>
      <input className="rounded-lg border p-2 text-sm" value={phone} onChange={e=>setPhone(e.target.value)} placeholder="Phone with country code"/>
    </div>
    <label className="flex items-start gap-2 text-xs text-slate-600"><input type="checkbox" checked={consent} onChange={e=>setConsent(e.target.checked)} className="mt-0.5"/>मैं पुष्टि करता/करती हूँ कि इस emergency contact ने अपना नंबर सेव करने की अनुमति दी है।</label>
    <button disabled={busy||!name.trim()||!phone.trim()||!consent} onClick={()=>void saveContact()} className="rounded-lg bg-slate-800 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">{busy?'Please wait…':'Save emergency contact'}</button>
    <div className="border-t pt-3 flex flex-wrap items-center gap-3"><button disabled={busy} onClick={()=>void sendSos()} className="rounded-lg bg-rose-700 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">SOS / सुरक्षा सहायता दर्ज करें</button><span className="text-xs text-slate-500">{bookingId?'Active booking linked':'Active booking not available'}</span></div>
    {feedback&&<p role="status" className="text-xs text-emerald-700">{feedback}</p>}{error&&<p role="alert" className="text-xs text-rose-700">{error}</p>}
    <p className="text-[10px] text-amber-800 bg-amber-50 rounded-lg p-2">महत्वपूर्ण: यह बटन incident को QuickFix के safety dashboard में दर्ज करता है। SMS, फोन कॉल, पुलिस dispatch या live location sharing अभी connected नहीं है।</p>
  </section>;
};
