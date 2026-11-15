import React, { useEffect, useMemo, useState } from 'react';

type LgdRow = { code: string; name: string };
type ApiResponse = { success: boolean; data?: LgdRow[]; error?: { message?: string } };
export type IndiaLocation = { state: string; district: string; tehsil: string; stateCode: string; districtCode: string; tehsilCode: string };

const API_BASE = 'https://india-lgd-index-api.vercel.app/v1';
const cache = new Map<string, LgdRow[]>();

async function loadRows(key: string, path: string): Promise<LgdRow[]> {
  if (cache.has(key)) return cache.get(key)!;
  const response = await fetch(`${API_BASE}${path}`, { headers: { Accept: 'application/json' } });
  if (!response.ok) throw new Error(`Location directory unavailable (${response.status})`);
  const payload = await response.json() as ApiResponse;
  if (!payload.success || !Array.isArray(payload.data)) throw new Error(payload.error?.message || 'Location list could not be loaded.');
  const rows = payload.data.filter(row => row && typeof row.code === 'string' && typeof row.name === 'string')
    .sort((a, b) => a.name.localeCompare(b.name));
  cache.set(key, rows);
  return rows;
}

const STORAGE_KEY = 'quickfix.india.location.v1';

export const IndiaLocationSelector: React.FC<{
  onLocationChange: (location: IndiaLocation) => void;
  compact?: boolean;
}> = ({ onLocationChange, compact = false }) => {
  const [states, setStates] = useState<LgdRow[]>([]);
  const [districts, setDistricts] = useState<LgdRow[]>([]);
  const [tehsils, setTehsils] = useState<LgdRow[]>([]);
  const [stateCode, setStateCode] = useState('');
  const [districtCode, setDistrictCode] = useState('');
  const [tehsilCode, setTehsilCode] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    loadRows('states', '/states')
      .then(rows => {
        if (!active) return;
        setStates(rows);
        setLoading(false);
        try {
          const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null') as IndiaLocation | null;
          if (saved?.stateCode && saved?.districtCode && saved?.tehsilCode) {
            setStateCode(saved.stateCode);
            setDistrictCode(saved.districtCode);
            setTehsilCode(saved.tehsilCode);
          }
        } catch { /* Ignore invalid saved location. */ }
      })
      .catch(err => { if (active) { setError(err instanceof Error ? err.message : 'Location list could not be loaded.'); setLoading(false); } });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!stateCode) { setDistricts([]); return; }
    let active = true;
    setDistricts([]); setDistrictCode(''); setTehsils([]); setTehsilCode('');
    loadRows(`districts:${stateCode}`, `/districts?state=${encodeURIComponent(stateCode)}`)
      .then(rows => { if (active) setDistricts(rows); })
      .catch(err => { if (active) setError(err instanceof Error ? err.message : 'Districts could not be loaded.'); });
    return () => { active = false; };
  }, [stateCode]);

  useEffect(() => {
    if (!districtCode) { setTehsils([]); return; }
    let active = true;
    setTehsils([]); setTehsilCode('');
    loadRows(`tehsils:${districtCode}`, `/subdistricts?district=${encodeURIComponent(districtCode)}`)
      .then(rows => { if (active) setTehsils(rows); })
      .catch(err => { if (active) setError(err instanceof Error ? err.message : 'Tehsils could not be loaded.'); });
    return () => { active = false; };
  }, [districtCode]);

  const selectedState = useMemo(() => states.find(row => row.code === stateCode), [states, stateCode]);
  const selectedDistrict = useMemo(() => districts.find(row => row.code === districtCode), [districts, districtCode]);
  const selectedTehsil = useMemo(() => tehsils.find(row => row.code === tehsilCode), [tehsils, tehsilCode]);

  useEffect(() => {
    if (!selectedState || !selectedDistrict || !selectedTehsil) return;
    const location: IndiaLocation = {
      state: selectedState.name, district: selectedDistrict.name, tehsil: selectedTehsil.name,
      stateCode: selectedState.code, districtCode: selectedDistrict.code, tehsilCode: selectedTehsil.code
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(location));
    onLocationChange(location);
  }, [selectedState, selectedDistrict, selectedTehsil, onLocationChange]);

  const selectClass = 'w-full min-w-0 text-xs p-2.5 rounded-xl border border-slate-300 bg-slate-50 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50';
  const labelClass = 'block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1';

  return (
    <div className={compact ? 'grid grid-cols-1 gap-1.5 min-w-[150px]' : 'grid grid-cols-1 gap-2'}>
      <label className={labelClass}>State / UT
        <select aria-label="State or Union Territory" className={selectClass} value={stateCode} disabled={loading || !!error} onChange={e => setStateCode(e.target.value)}>
          <option value="">{loading ? 'Loading states…' : 'Select State / UT'}</option>
          {states.map(row => <option key={row.code} value={row.code}>{row.name}</option>)}
        </select>
      </label>
      <label className={labelClass}>District
        <select aria-label="District" className={selectClass} value={districtCode} disabled={!stateCode || !districts.length} onChange={e => setDistrictCode(e.target.value)}>
          <option value="">Select District</option>
          {districts.map(row => <option key={row.code} value={row.code}>{row.name}</option>)}
        </select>
      </label>
      <label className={labelClass}>Tehsil / Taluk / Mandal
        <select aria-label="Tehsil, Taluk or Mandal" className={selectClass} value={tehsilCode} disabled={!districtCode || !tehsils.length} onChange={e => setTehsilCode(e.target.value)}>
          <option value="">Select Tehsil</option>
          {tehsils.map(row => <option key={row.code} value={row.code}>{row.name}</option>)}
        </select>
      </label>
      {error && <p role="alert" className="text-[11px] text-rose-600">{error} Please retry after checking your internet connection.</p>}
      <p className="text-[9px] text-slate-400">Location directory: Government of India LGD data.</p>
    </div>
  );
};
