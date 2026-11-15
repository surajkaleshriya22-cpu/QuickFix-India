import React, { useEffect, useMemo, useRef, useState } from 'react';

type LgdRow = { code: string; name: string };
type ApiResponse = { success: boolean; data?: LgdRow[]; error?: { message?: string } };
export type IndiaLocation = { state: string; district: string; tehsil: string; stateCode: string; districtCode: string; tehsilCode: string };

const API_BASE = 'https://india-lgd-index-api.vercel.app/v1';
const cache = new Map<string, LgdRow[]>();
const CACHE_PREFIX = 'quickfix.india.lgd-cache.v1.';
const CACHE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

type CachedRows = { savedAt: number; rows: LgdRow[] };

function readPersistentCache(key: string): LgdRow[] | null {
  try {
    const raw = localStorage.getItem(`${CACHE_PREFIX}${key}`);
    if (!raw) return null;
    const cached = JSON.parse(raw) as CachedRows;
    if (!cached || !Number.isFinite(cached.savedAt) || Date.now() - cached.savedAt > CACHE_MAX_AGE_MS || !Array.isArray(cached.rows)) return null;
    const rows = cached.rows.filter(row => row && typeof row.code === 'string' && typeof row.name === 'string');
    return rows.length ? rows : null;
  } catch {
    return null;
  }
}

async function loadRows(key: string, path: string): Promise<LgdRow[]> {
  if (cache.has(key)) return cache.get(key)!;
  const savedRows = readPersistentCache(key);
  try {
    const response = await fetch(`${API_BASE}${path}`, { headers: { Accept: 'application/json' } });
    if (!response.ok) throw new Error(`Location directory unavailable (${response.status})`);
    const payload = await response.json() as ApiResponse;
    if (!payload.success || !Array.isArray(payload.data)) throw new Error(payload.error?.message || 'Location list could not be loaded.');
    const rows = payload.data.filter(row => row && typeof row.code === 'string' && typeof row.name === 'string')
      .sort((a, b) => a.name.localeCompare(b.name));
    if (!rows.length) throw new Error('Location directory returned no valid entries.');
    cache.set(key, rows);
    try { localStorage.setItem(`${CACHE_PREFIX}${key}`, JSON.stringify({ savedAt: Date.now(), rows } satisfies CachedRows)); } catch { /* Continue with in-memory cache when storage is unavailable. */ }
    return rows;
  } catch (error) {
    if (savedRows) {
      cache.set(key, savedRows);
      return savedRows;
    }
    throw error;
  }
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
  const [savedLocation, setSavedLocation] = useState<IndiaLocation | null>(null);
  const onLocationChangeRef = useRef(onLocationChange);
  onLocationChangeRef.current = onLocationChange;

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
            setSavedLocation(saved);
            setStateCode(saved.stateCode);
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
      .then(rows => {
        if (!active) return;
        setDistricts(rows);
        if (savedLocation?.stateCode === stateCode && savedLocation.districtCode) setDistrictCode(savedLocation.districtCode);
      })
      .catch(err => { if (active) setError(err instanceof Error ? err.message : 'Districts could not be loaded.'); });
    return () => { active = false; };
  }, [stateCode]);

  useEffect(() => {
    if (!districtCode) { setTehsils([]); return; }
    let active = true;
    setTehsils([]); setTehsilCode('');
    loadRows(`tehsils:${districtCode}`, `/subdistricts?district=${encodeURIComponent(districtCode)}`)
      .then(rows => {
        if (!active) return;
        setTehsils(rows);
        if (savedLocation?.districtCode === districtCode && savedLocation.tehsilCode) setTehsilCode(savedLocation.tehsilCode);
      })
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
    onLocationChangeRef.current(location);
  }, [selectedState, selectedDistrict, selectedTehsil]);

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
