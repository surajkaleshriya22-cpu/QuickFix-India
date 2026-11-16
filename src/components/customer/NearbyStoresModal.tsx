import React, { useState } from 'react';
import { X, MapPin, ExternalLink, Wrench, Zap, Droplets, Wind, ShieldAlert } from 'lucide-react';
import { useQuickFix } from '../../context/QuickFixContext';
import { getHardwareMapsSearchUrl, type HardwareCategory } from '../../data/hardwareStores';

interface NearbyStoresModalProps {
  onClose: () => void;
}

export const NearbyStoresModal: React.FC<NearbyStoresModalProps> = ({ onClose }) => {
  const { currentCity } = useQuickFix();
  const [selectedCategory, setSelectedCategory] = useState<HardwareCategory>('all');
  const mapsUrl = getHardwareMapsSearchUrl(currentCity, selectedCategory);

  const categories: { id: HardwareCategory; label: string; Icon: typeof Wrench }[] = [
    { id: 'all', label: 'All shops', Icon: Wrench },
    { id: 'electrical', label: 'Electrical', Icon: Zap },
    { id: 'plumbing', label: 'Plumbing', Icon: Droplets },
    { id: 'ac', label: 'AC & fridge', Icon: Wind },
  ];

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="w-full max-w-lg bg-white rounded-3xl max-h-[88vh] flex flex-col shadow-2xl overflow-hidden border border-slate-100 font-sans">
        <div className="p-4 bg-gradient-to-r from-blue-700 via-indigo-700 to-blue-900 text-white flex items-center justify-between">
          <div>
            <p className="text-xs text-blue-200 flex items-center gap-1"><MapPin className="w-3 h-3" /> Local shop search</p>
            <h2 className="text-base font-bold">Hardware & Spares near {currentCity}</h2>
          </div>
          <button onClick={onClose} aria-label="Close" className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          <div className="grid grid-cols-2 gap-2">
            {categories.map(({ id, label, Icon }) => (
              <button key={id} type="button" onClick={() => setSelectedCategory(id)}
                className={`px-3 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-2 border ${selectedCategory === id ? 'bg-blue-600 text-white border-blue-600' : 'bg-slate-50 text-slate-700 border-slate-200'}`}>
                <Icon className="w-4 h-4" /> {label}
              </button>
            ))}
          </div>

          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 space-y-2">
            <div className="flex items-center gap-2 text-amber-900 font-bold text-sm">
              <ShieldAlert className="w-4 h-4" /> Please verify shop details
            </div>
            <p className="text-xs leading-relaxed text-amber-900">
              QuickFix does not currently maintain a verified shop directory. These are live Google Maps search results, not shops verified by QuickFix. Confirm the shop name, phone number, address, stock and opening hours before visiting or paying.
            </p>
          </div>

          <a href={mapsUrl} target="_blank" rel="noopener noreferrer"
            className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-bold flex items-center justify-center gap-2">
            <ExternalLink className="w-4 h-4" /> Search shops on Google Maps
          </a>
        </div>

        <div className="mt-auto p-3 bg-slate-50 border-t border-slate-200 flex justify-end">
          <button onClick={onClose} className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white text-xs font-semibold rounded-xl">Close</button>
        </div>
      </div>
    </div>
  );
};
