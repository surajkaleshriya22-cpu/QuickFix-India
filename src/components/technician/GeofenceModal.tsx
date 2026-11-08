import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  AlertTriangle,
  X,
  MapPin,
  Navigation,
  Compass,
  RefreshCw,
  Building2,
  CheckCircle2,
  Clock,
  Radio,
  ExternalLink
} from 'lucide-react';
import { ServiceZone, GeofenceValidationResult } from '../../types';
import { GeofenceRadiusMap } from '../maps/GeofenceRadiusMap';
import { validateTechnicianGeofence, calculateHaversineDistanceKm } from '../../services/geofenceService';

interface GeofenceModalProps {
  isOpen: boolean;
  onClose: () => void;
  technicianCity: string;
  serviceZones: ServiceZone[];
  currentLocation?: { lat: number; lng: number };
  onConfirmOnline: (coords: { lat: number; lng: number; zoneId: string; zoneName: string; distanceToCenterKm: number }) => void;
}

export const GeofenceModal: React.FC<GeofenceModalProps> = ({
  isOpen,
  onClose,
  technicianCity,
  serviceZones,
  currentLocation,
  onConfirmOnline,
}) => {
  // Default coordinates based on city or provided location
  const defaultCoords = currentLocation || { lat: 22.7196, lng: 75.8577 }; // Indore center fallback
  const [selectedCoords, setSelectedCoords] = useState<{ lat: number; lng: number }>(defaultCoords);
  const [locationSource, setLocationSource] = useState<'device' | 'preset'>('preset');
  const [activeZone, setActiveZone] = useState<ServiceZone>(
    serviceZones.find(z => z.city.toLowerCase() === technicianCity.toLowerCase()) || serviceZones[0]
  );
  const [validation, setValidation] = useState<GeofenceValidationResult | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [gpsError, setGpsError] = useState<string | null>(null);

  // Re-run validation whenever coords or zones change
  useEffect(() => {
    if (!isOpen) return;
    runValidation(selectedCoords);
  }, [isOpen, selectedCoords, serviceZones]);

  const runValidation = async (coords: { lat: number; lng: number }) => {
    setIsValidating(true);
    setGpsError(null);
    try {
      const res = await validateTechnicianGeofence(coords, technicianCity, serviceZones);
      setValidation(res);
      if (res.insideZone) {
        setActiveZone(res.insideZone);
      } else if (res.nearestZone) {
        setActiveZone(res.nearestZone);
      }
    } catch (err: any) {
      console.warn('Geofence validation notice:', err);
    } finally {
      setIsValidating(false);
    }
  };

  // HTML5 Live Device GPS Detection
  const handleDetectDeviceGps = () => {
    setGpsError(null);
    if (!navigator.geolocation) {
      setGpsError('Geolocation is not supported by your browser.');
      return;
    }

    setIsValidating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const coords = {
          lat: Number(position.coords.latitude.toFixed(6)),
          lng: Number(position.coords.longitude.toFixed(6)),
        };
        setSelectedCoords(coords);
        setLocationSource('device');
        runValidation(coords);
      },
      (err) => {
        setIsValidating(false);
        setGpsError(`GPS permission warning: ${err.message}. Using high-precision preset simulation below.`);
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
    );
  };

  if (!isOpen) return null;

  // Preset location options for instant testing & verifying boundaries
  const presets = [
    {
      label: 'Indore City Hub (Palasia)',
      coords: { lat: 22.7244, lng: 75.8839 },
      desc: 'Inside Indore Perimeter (~2.8 km from center)',
    },
    {
      label: 'Indore Silicon City / Rau',
      coords: { lat: 22.6518, lng: 75.8306 },
      desc: 'Inside Service Radius (~8.1 km from center)',
    },
    {
      label: 'Bhopal MP Nagar (Zone 1)',
      coords: { lat: 23.2332, lng: 77.4334 },
      desc: 'Inside Bhopal Perimeter (~3.4 km from center)',
    },
    {
      label: 'Ujjain Mahakal Corridor',
      coords: { lat: 23.1827, lng: 75.7682 },
      desc: 'Inside Ujjain Perimeter (~2.2 km from center)',
    },
    {
      label: 'Rural Highway (45 km Out of Bounds)',
      coords: { lat: 22.3500, lng: 76.2500 },
      desc: 'Strictly Out of Bounds (~55 km away from all hubs)',
    },
  ];

  const isAllowed = validation?.allowed ?? false;
  const currentDistance = validation?.distanceKm ?? 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-xl w-full max-h-[92vh] overflow-y-auto no-scrollbar shadow-2xl flex flex-col">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between sticky top-0 bg-slate-900/95 backdrop-blur-md z-10">
          <div className="flex items-center gap-2.5">
            <div
              className={`p-2 rounded-xl flex items-center justify-center text-white ${
                isAllowed ? 'bg-emerald-600 ring-2 ring-emerald-400/30' : 'bg-amber-600 ring-2 ring-amber-400/30'
              }`}
            >
              <Navigation className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <span>Geo-fence Duty Verification</span>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                    isAllowed
                      ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                      : 'bg-rose-950 text-rose-300 border border-rose-800'
                  }`}
                >
                  {isAllowed ? 'Perimeter Cleared' : 'Out of Bounds'}
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                QuickFix partners must be within registered service radius zones to guarantee our 1-Hour SLA.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-5 space-y-4">
          {/* Status Result Card */}
          <div
            className={`p-3.5 rounded-2xl border text-xs leading-relaxed space-y-1.5 ${
              isAllowed
                ? 'bg-emerald-950/30 border-emerald-800/80 text-emerald-200'
                : 'bg-rose-950/30 border-rose-800/80 text-rose-200'
            }`}
          >
            <div className="flex items-start gap-2">
              {isAllowed ? (
                <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
              ) : (
                <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
              )}
              <div>
                <span className="font-bold text-sm block text-white">
                  {isAllowed ? 'Service Radius Verified' : 'Status Update Restricted'}
                </span>
                <p className="mt-0.5 text-xs">
                  {validation?.reason || 'Validating current GPS position against Firestore service zones...'}
                </p>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-800/60 flex flex-wrap items-center justify-between text-[11px] font-mono text-slate-300">
              <span>Operating Zone: <strong className="text-white">{activeZone.name}</strong></span>
              <span>Radius Limit: <strong className="text-white">{activeZone.radiusKm} km</strong></span>
              <span>Current Distance: <strong className={isAllowed ? 'text-emerald-400' : 'text-rose-400'}>{currentDistance} km</strong></span>
            </div>
          </div>

          {/* Google Maps Visual Radius Overlay */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-blue-400" />
                <span>Live Operating Radius Map</span>
              </span>
              <span className="text-[10px] text-slate-400 font-mono">
                {selectedCoords.lat.toFixed(4)}, {selectedCoords.lng.toFixed(4)}
              </span>
            </div>

            <GeofenceRadiusMap
              technicianCoords={selectedCoords}
              zone={activeZone}
              isInside={isAllowed}
              distanceKm={currentDistance}
              height="240px"
            />
          </div>

          {/* GPS Detection & Preset Simulation Bar */}
          <div className="space-y-2 pt-1">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wider">
                Select GPS Location Source
              </span>
              <button
                type="button"
                onClick={handleDetectDeviceGps}
                disabled={isValidating}
                className="text-[11px] font-bold text-blue-400 hover:text-blue-300 flex items-center gap-1 transition-colors"
              >
                <RefreshCw className={`w-3 h-3 ${isValidating ? 'animate-spin' : ''}`} />
                <span>Fetch Device GPS</span>
              </button>
            </div>

            {gpsError && (
              <p className="text-[10px] text-amber-300 bg-amber-950/40 p-2 rounded-lg border border-amber-800/60">
                {gpsError}
              </p>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              {presets.map((preset, idx) => {
                const isSelected =
                  locationSource === 'preset' &&
                  selectedCoords.lat === preset.coords.lat &&
                  selectedCoords.lng === preset.coords.lng;

                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      setSelectedCoords(preset.coords);
                      setLocationSource('preset');
                      runValidation(preset.coords);
                    }}
                    className={`p-2.5 rounded-xl border text-left transition-all ${
                      isSelected
                        ? 'bg-blue-950/60 border-blue-600 ring-2 ring-blue-500/30 text-white'
                        : 'bg-slate-950/60 border-slate-800 text-slate-300 hover:bg-slate-800/50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs">{preset.label}</span>
                      {isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-blue-400" />}
                    </div>
                    <p className="text-[10px] text-slate-400 mt-0.5 leading-tight">{preset.desc}</p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Operating SLA Policy Callout */}
          <div className="p-3 bg-slate-950 rounded-2xl border border-slate-800 text-[11px] text-slate-400 leading-relaxed flex items-start gap-2">
            <Clock className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <strong className="text-white block">Why Geo-fencing is Enforced:</strong>
              QuickFix provides an automated <strong>1-Hour Service Delivery SLA</strong>. When a customer confirms a booking, the assigned partner must arrive within 60 minutes. Technicians located beyond the service perimeter cannot meet arrival commitments.
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 sm:p-5 border-t border-slate-800 bg-slate-900/90 backdrop-blur-md flex flex-wrap items-center justify-between gap-3 mt-auto">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl border border-slate-700 text-slate-300 hover:bg-slate-800 text-xs font-bold transition-colors"
          >
            Cancel
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={!isAllowed || isValidating}
              onClick={() => {
                if (isAllowed && activeZone) {
                  onConfirmOnline({
                    lat: selectedCoords.lat,
                    lng: selectedCoords.lng,
                    zoneId: activeZone.id,
                    zoneName: activeZone.name,
                    distanceToCenterKm: currentDistance,
                  });
                  onClose();
                }
              }}
              className={`px-5 py-2.5 rounded-xl text-xs font-extrabold flex items-center gap-2 transition-all shadow-md ${
                isAllowed
                  ? 'bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer active:scale-98 ring-2 ring-emerald-400/30'
                  : 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed opacity-70'
              }`}
            >
              <ShieldCheck className="w-4 h-4" />
              <span>{isAllowed ? 'Verify Geo-fence & Go Online' : 'Blocked: Move Inside Service Radius'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
