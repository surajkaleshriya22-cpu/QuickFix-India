import React, { useState, useMemo } from 'react';
import { X, MapPin, ExternalLink, Wrench, Zap, Droplets, Wind, Sparkles, Phone, Clock, Star, Search, ShieldCheck } from 'lucide-react';
import { useQuickFix } from '../../context/QuickFixContext';
import { CURATED_HARDWARE_STORES, HardwareStore } from '../../data/hardwareStores';

interface NearbyStoresModalProps {
  onClose: () => void;
}

export const NearbyStoresModal: React.FC<NearbyStoresModalProps> = ({ onClose }) => {
  const { currentCity } = useQuickFix();
  const [selectedCategory, setSelectedCategory] = useState<'all' | 'electrical' | 'plumbing' | 'ac'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Filter stores based on city, category, and search query
  const filteredStores = useMemo(() => {
    return CURATED_HARDWARE_STORES.filter((store) => {
      // City matching
      const matchesCity = store.city.toLowerCase() === currentCity.toLowerCase();
      // Category matching
      const matchesCategory =
        selectedCategory === 'all' ||
        store.category === selectedCategory ||
        store.category === 'all';
      // Search matching
      const query = searchQuery.trim().toLowerCase();
      const matchesSearch =
        !query ||
        store.name.toLowerCase().includes(query) ||
        store.marketArea.toLowerCase().includes(query) ||
        store.specialties.some((s) => s.toLowerCase().includes(query));

      return matchesCity && matchesCategory && matchesSearch;
    });
  }, [currentCity, selectedCategory, searchQuery]);

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-lg bg-white rounded-3xl max-h-[88vh] flex flex-col shadow-2xl overflow-hidden border border-slate-100 font-sans">
        {/* Header */}
        <div className="p-4 bg-gradient-to-r from-blue-700 via-indigo-700 to-blue-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-white/15 backdrop-blur-xs flex items-center justify-center text-white border border-white/20 shadow-xs">
              <Wrench className="w-5 h-5 text-amber-300" />
            </div>
            <div>
              <div className="flex items-center gap-1.5 text-xs text-blue-200">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span>Verified Hardware Hubs</span>
              </div>
              <h2 className="text-base font-bold text-white">
                Spares & Tools Directory ({currentCity})
              </h2>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Search Input Bar */}
        <div className="p-3 bg-slate-50 border-b border-slate-200 shrink-0">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={`Search spares (e.g. MCB, CPVC pipe, R32 gas, Havells wire)...`}
              className="w-full pl-9 pr-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-2xs"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Categories Bar */}
        <div className="px-4 py-2.5 bg-white border-b border-slate-200 flex items-center gap-2 overflow-x-auto shrink-0 no-scrollbar">
          <button
            type="button"
            onClick={() => setSelectedCategory('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors flex items-center gap-1.5 ${
              selectedCategory === 'all'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <Wrench className="w-3.5 h-3.5" />
            <span>All Stores</span>
          </button>

          <button
            type="button"
            onClick={() => setSelectedCategory('electrical')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors flex items-center gap-1.5 ${
              selectedCategory === 'electrical'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <Zap className="w-3.5 h-3.5 text-amber-500" />
            <span>Electrical Supply</span>
          </button>

          <button
            type="button"
            onClick={() => setSelectedCategory('plumbing')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors flex items-center gap-1.5 ${
              selectedCategory === 'plumbing'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <Droplets className="w-3.5 h-3.5 text-cyan-500" />
            <span>Plumbing Spares</span>
          </button>

          <button
            type="button"
            onClick={() => setSelectedCategory('ac')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors flex items-center gap-1.5 ${
              selectedCategory === 'ac'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <Wind className="w-3.5 h-3.5 text-sky-500" />
            <span>AC & Fridge Parts</span>
          </button>
        </div>

        {/* Content Body: Verified Store Cards */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {filteredStores.length === 0 ? (
            <div className="py-12 text-center space-y-2">
              <Wrench className="w-8 h-8 text-slate-300 mx-auto" />
              <p className="text-sm font-semibold text-slate-700">No hardware stores match your search</p>
              <p className="text-xs text-slate-400">Try clearing the search query or switching categories</p>
            </div>
          ) : (
            filteredStores.map((store) => (
              <div
                key={store.id}
                className="p-3.5 bg-slate-50/70 hover:bg-slate-50 border border-slate-200 rounded-2xl transition-all shadow-2xs space-y-2.5"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold text-slate-900">{store.name}</span>
                      <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                        Verified
                      </span>
                    </div>
                    <div className="flex items-center gap-1 text-[11px] text-slate-500 mt-0.5">
                      <MapPin className="w-3 h-3 text-blue-600 shrink-0" />
                      <span>{store.marketArea}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-lg text-amber-900 text-[10px] font-bold shrink-0">
                    <Star className="w-3 h-3 text-amber-500 fill-amber-500" />
                    <span>{store.rating}</span>
                    <span className="text-slate-400 font-normal">({store.reviewsCount})</span>
                  </div>
                </div>

                {/* Specialties Chips */}
                <div className="flex flex-wrap gap-1">
                  {store.specialties.map((spec, idx) => (
                    <span
                      key={idx}
                      className="text-[10px] bg-white border border-slate-200 text-slate-700 px-2 py-0.5 rounded-md font-medium"
                    >
                      {spec}
                    </span>
                  ))}
                </div>

                {/* Address & Hours */}
                <div className="text-[10px] text-slate-500 space-y-0.5 pt-1 border-t border-slate-200/60">
                  <div className="flex items-center gap-1.5">
                    <Clock className="w-3 h-3 text-slate-400" />
                    <span>{store.openHours}</span>
                  </div>
                  <div className="text-slate-400 truncate">{store.address}</div>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center gap-2 pt-1">
                  <a
                    href={`tel:${store.phone.replace(/\s+/g, '')}`}
                    className="flex-1 py-1.5 px-2 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors shadow-2xs"
                  >
                    <Phone className="w-3 h-3 text-blue-600" />
                    <span>Call Store</span>
                  </a>

                  <a
                    href={store.directionsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 py-1.5 px-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors shadow-2xs"
                  >
                    <ExternalLink className="w-3 h-3" />
                    <span>View Directions</span>
                  </a>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="p-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-[11px] text-slate-500 shrink-0">
          <span className="flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span>Curated for {currentCity} Electricians & Plumbers</span>
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-900 text-white text-xs font-semibold rounded-xl transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
