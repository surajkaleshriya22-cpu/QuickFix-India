import React from 'react';
import { Download, ShieldCheck, UserRound } from 'lucide-react';
import { AppUser, Technician } from '../../types';

interface PartnerIdentityCardProps {
  user: AppUser;
  technician: Technician;
  language: 'en' | 'hi';
}

const formatDesignation = (trades: string[] = []) => trades
  .map(value => value.replaceAll('_', ' ').replace(/\b\w/g, letter => letter.toUpperCase()))
  .join(' • ') || 'Channel Partner';

export const PartnerIdentityCard: React.FC<PartnerIdentityCardProps> = ({ user, technician, language }) => {
  const verified = technician.isVerified === true && technician.approvalStatus === 'approved';
  const photo = technician.avatar?.trim();

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-extrabold text-slate-900">{language === 'hi' ? 'डिजिटल पहचान पत्र' : 'Digital Identity Card'}</h2>
          <p className="text-[11px] text-slate-500">{language === 'hi' ? 'ग्राहक को अपनी पहचान दिखाएँ' : 'Show this card to customers before starting a service'}</p>
        </div>
        <button type="button" onClick={() => window.print()} className="inline-flex items-center gap-1.5 rounded-lg bg-blue-700 px-3 py-2 text-[11px] font-bold text-white shadow-sm hover:bg-blue-800">
          <Download className="h-3.5 w-3.5" />
          {language === 'hi' ? 'डाउनलोड / PDF' : 'Download / PDF'}
        </button>
      </div>

      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          #quickfix-partner-id-card, #quickfix-partner-id-card * { visibility: visible !important; }
          #quickfix-partner-id-card { position: absolute !important; left: 0 !important; top: 0 !important; width: 3.375in !important; margin: 0 !important; box-shadow: none !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          @page { size: 3.375in 2.125in; margin: 0.12in; }
          .quickfix-id-actions { display: none !important; }
        }
      `}</style>

      <div id="quickfix-partner-id-card" className="mx-auto w-full max-w-[430px] overflow-hidden rounded-2xl border border-slate-300 bg-white shadow-lg">
        <div className="flex items-center justify-between bg-gradient-to-r from-blue-950 via-blue-800 to-cyan-700 px-4 py-3 text-white">
          <div>
            <div className="text-[17px] font-black tracking-[0.12em] leading-none">QUICKFIX INDIA</div>
            <div className="mt-1 text-[8px] font-semibold uppercase tracking-[0.2em] text-blue-100">Channel Partner Identity Card</div>
          </div>
          <div className="rounded-lg border border-white/30 bg-white/10 px-2 py-1 text-[8px] font-bold tracking-wider">OFFICIAL ID</div>
        </div>

        <div className="flex gap-3 p-3.5">
          <div className="h-[116px] w-[91px] shrink-0 overflow-hidden rounded-lg border-2 border-blue-100 bg-slate-100">
            {photo ? <img src={photo} alt="Channel Partner profile" className="h-full w-full object-cover" /> : (
              <div className="flex h-full flex-col items-center justify-center gap-1 text-slate-400">
                <UserRound className="h-9 w-9" />
                <span className="px-1 text-center text-[8px] font-semibold">{language === 'hi' ? 'फोटो उपलब्ध नहीं' : 'Photo not available'}</span>
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1 space-y-1.5">
            <div className="text-[8px] font-bold uppercase tracking-widest text-slate-400">Name</div>
            <div className="truncate text-[15px] font-extrabold leading-tight text-slate-950">{user.displayName || technician.name}</div>
            <div className="text-[8px] font-bold uppercase tracking-widest text-slate-400">Partner ID</div>
            <div className="font-mono text-[12px] font-black tracking-wide text-blue-900">{user.quickFixId || technician.id || 'Pending ID'}</div>
            <div className="text-[8px] font-bold uppercase tracking-widest text-slate-400">Designation</div>
            <div className="line-clamp-2 text-[10px] font-bold leading-snug text-slate-800">{formatDesignation(technician.trades)}</div>
            <div className="text-[8px] font-bold uppercase tracking-widest text-slate-400">Address</div>
            <div className="line-clamp-2 text-[9px] leading-snug text-slate-700">{[user.address, user.city, user.pincode].filter(Boolean).join(', ') || technician.city || 'Address not provided'}</div>
          </div>
        </div>

        <div className={`flex items-center justify-between border-t px-3.5 py-2 ${verified ? 'border-emerald-200 bg-emerald-50' : 'border-amber-200 bg-amber-50'}`}>
          <div className={`flex items-center gap-1.5 text-[9px] font-extrabold uppercase tracking-wide ${verified ? 'text-emerald-800' : 'text-amber-800'}`}>
            <ShieldCheck className="h-3.5 w-3.5" />
            {verified ? 'Verified Channel Partner' : 'Verification Pending'}
          </div>
          <span className="text-[8px] font-semibold text-slate-500">quickfix-india.onrender.com</span>
        </div>
      </div>
      <p className="quickfix-id-actions text-[10px] text-slate-500">{language === 'hi' ? 'डाउनलोड पर Print विकल्प में “Save as PDF” चुनें। फोटो उपलब्ध न होने पर प्रोफ़ाइल फोटो पहले जोड़नी होगी।' : 'In the print dialog, choose “Save as PDF”. A profile photo must be available in the partner profile to appear on the card.'}</p>
    </section>
  );
};
