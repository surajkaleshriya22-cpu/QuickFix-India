import React, { useState } from 'react';
import { ServiceZone } from '../../types';
import { ShieldCheck, MapPin, AlertTriangle, Navigation, Building2, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';

interface GeofenceRadiusMapProps {
  technicianCoords: { lat: number; lng: number };
  zone: ServiceZone;
  isInside: boolean;
  distanceKm: number;
  height?: string;
}

export const GeofenceRadiusMap: React.FC<GeofenceRadiusMapProps> = ({
  technicianCoords,
  zone,
  isInside,
  distanceKm,
  height = '260px',
}) => {
  const [zoomLevel, setZoomLevel] = useState(1);

  // SVG coordinate calculations (center at 160, 130 in a 320x260 viewBox)
  const cx = 160;
  const cy = 130;
  const maxRadiusPx = 95; // Represents zone.radiusKm

  // Calculate technician relative position in SVG pixels
  // 1 degree lat is ~111 km. 1 degree lng at lat ~22 is ~103 km.
  const dLat = (technicianCoords.lat - zone.center.lat) * 111;
  const dLng = (technicianCoords.lng - zone.center.lng) * 103;

  // Scale relative to zone.radiusKm
  const scale = maxRadiusPx / Math.max(zone.radiusKm, 1);
  // SVG Y goes down, so lat positive goes UP (subtract)
  const rawTechX = cx + dLng * scale;
  const rawTechY = cy - dLat * scale;

  // Clamp within canvas bounds with margin
  const techX = Math.max(25, Math.min(295, rawTechX));
  const techY = Math.max(25, Math.min(235, rawTechY));

  // Range rings: 25%, 50%, 75%, 100% of zone.radiusKm
  const ring1 = maxRadiusPx * 0.33;
  const ring2 = maxRadiusPx * 0.66;
  const ring3 = maxRadiusPx;

  return (
    <div
      style={{ height }}
      className="relative w-full rounded-2xl overflow-hidden border border-slate-700/80 shadow-md bg-slate-950 select-none font-sans"
    >
      {/* Zoom Container */}
      <div
        className="w-full h-full relative transition-transform duration-300 origin-center"
        style={{ transform: `scale(${zoomLevel})` }}
      >
        <svg
          viewBox="0 0 320 260"
          className="w-full h-full block"
          preserveAspectRatio="xMidYMid meet"
        >
          <defs>
            {/* Radar Grid Pattern */}
            <radialGradient id="geofenceZoneFill" cx="50%" cy="50%" r="50%">
              <stop
                offset="0%"
                stopColor={isInside ? '#10b981' : '#f59e0b'}
                stopOpacity="0.25"
              />
              <stop
                offset="80%"
                stopColor={isInside ? '#10b981' : '#f59e0b'}
                stopOpacity="0.12"
              />
              <stop
                offset="100%"
                stopColor={isInside ? '#059669' : '#d97706'}
                stopOpacity="0.02"
              />
            </radialGradient>

            <filter id="radarGlow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="2.5" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          {/* Deep Navy / Dark Radar Canvas */}
          <rect width="100%" height="100%" fill="#0a0f1d" />

          {/* Radar Radial Crosshairs */}
          <line x1={cx} y1="15" x2={cx} y2="245" stroke="rgba(255,255,255,0.08)" strokeWidth="1" strokeDasharray="3 3" />
          <line x1="20" y1={cy} x2="300" y2={cy} stroke="rgba(255,255,255,0.08)" strokeWidth="1" strokeDasharray="3 3" />
          <line x1={cx - 75} y1={cy - 75} x2={cx + 75} y2={cy + 75} stroke="rgba(255,255,255,0.04)" strokeWidth="1" strokeDasharray="4 4" />
          <line x1={cx - 75} y1={cy + 75} x2={cx + 75} y2={cy - 75} stroke="rgba(255,255,255,0.04)" strokeWidth="1" strokeDasharray="4 4" />

          {/* Concentric Range Rings */}
          <circle cx={cx} cy={cy} r={ring1} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="1" strokeDasharray="2 4" />
          <circle cx={cx} cy={cy} r={ring2} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="1" strokeDasharray="3 3" />

          {/* Geofence Perimeter Zone Circle (Full Radius) */}
          <circle
            cx={cx}
            cy={cy}
            r={ring3}
            fill="url(#geofenceZoneFill)"
            stroke={isInside ? '#10b981' : '#f59e0b'}
            strokeWidth="2"
            strokeDasharray={isInside ? 'none' : '4 4'}
            filter="url(#radarGlow)"
          />

          {/* Connector Line between Hub Center and Technician */}
          <line
            x1={cx}
            y1={cy}
            x2={techX}
            y2={techY}
            stroke={isInside ? '#34d399' : '#f87171'}
            strokeWidth="2"
            strokeDasharray="4 3"
          />

          {/* Distance Tag on Connector Line */}
          <g transform={`translate(${(cx + techX) / 2}, ${(cy + techY) / 2 - 8})`}>
            <rect
              x="-24"
              y="-8"
              width="48"
              height="16"
              rx="4"
              fill="#0f172a"
              stroke={isInside ? '#059669' : '#dc2626'}
              strokeWidth="1"
            />
            <text
              x="0"
              y="3"
              fill={isInside ? '#6ee7b7' : '#fca5a5'}
              fontSize="9"
              fontWeight="bold"
              textAnchor="middle"
              fontFamily="monospace"
            >
              {distanceKm} km
            </text>
          </g>

          {/* Outer Ring Distance Label */}
          <text
            x={cx + ring3 - 6}
            y={cy - 6}
            fill="#94a3b8"
            fontSize="8"
            fontWeight="bold"
            fontFamily="monospace"
          >
            {zone.radiusKm}km Limit
          </text>

          {/* Zone Center Operations Hub Pin */}
          <g transform={`translate(${cx}, ${cy})`}>
            <circle cx="0" cy="0" r="14" fill="none" stroke="#3b82f6" strokeWidth="1.5" opacity="0.6">
              <animate attributeName="r" values="8;18" dur="2.4s" repeatCount="indefinite" />
              <animate attributeName="opacity" values="0.8;0" dur="2.4s" repeatCount="indefinite" />
            </circle>
            <circle cx="0" cy="0" r="9" fill="#1e3a8a" stroke="#60a5fa" strokeWidth="2" />
            <circle cx="0" cy="0" r="3.5" fill="#ffffff" />
          </g>

          {/* Technician Location Pin */}
          <g transform={`translate(${techX}, ${techY})`}>
            <circle
              cx="0"
              cy="0"
              r="16"
              fill="none"
              stroke={isInside ? '#10b981' : '#ef4444'}
              strokeWidth="2"
              opacity="0.8"
            >
              <animate
                attributeName="r"
                values="9;22"
                dur="1.6s"
                repeatCount="indefinite"
              />
              <animate
                attributeName="opacity"
                values="0.9;0"
                dur="1.6s"
                repeatCount="indefinite"
              />
            </circle>
            <circle
              cx="0"
              cy="0"
              r="11"
              fill={isInside ? '#059669' : '#dc2626'}
              stroke="#ffffff"
              strokeWidth="2"
            />
            {/* Arrow */}
            <path
              d="M -3 3 L 0 -5 L 3 3 L 0 1 Z"
              fill="#ffffff"
              transform="rotate(45)"
            />
          </g>
        </svg>

        {/* Center Hub Overlay Tag */}
        <div
          className="absolute transform -translate-x-1/2 -translate-y-8 pointer-events-none"
          style={{ left: `${(cx / 320) * 100}%`, top: `${(cy / 260) * 100}%` }}
        >
          <div className="flex items-center gap-1 px-2 py-0.5 rounded bg-slate-900/90 text-slate-200 border border-slate-700 text-[9px] font-bold shadow-md whitespace-nowrap">
            <Building2 className="w-2.5 h-2.5 text-blue-400" />
            <span>{zone.city} Hub ({zone.radiusKm}km)</span>
          </div>
        </div>

        {/* Technician Pin Overlay Tag */}
        <div
          className="absolute transform -translate-x-1/2 translate-y-3 pointer-events-none"
          style={{ left: `${(techX / 320) * 100}%`, top: `${(techY / 260) * 100}%` }}
        >
          <div
            className={`px-2 py-0.5 rounded-full text-[9px] font-bold border shadow-lg whitespace-nowrap flex items-center gap-1 ${
              isInside
                ? 'bg-emerald-950/95 text-emerald-300 border-emerald-500'
                : 'bg-rose-950/95 text-rose-300 border-rose-500 animate-pulse'
            }`}
          >
            <Navigation className="w-2.5 h-2.5 transform rotate-45" />
            <span>{isInside ? 'Inside Zone' : 'Out of Bounds'}</span>
          </div>
        </div>
      </div>

      {/* Floating Top Status Banner */}
      <div className="absolute top-2.5 left-2.5 right-2.5 flex items-center justify-between gap-2 pointer-events-none z-10">
        <div
          className={`px-3 py-1.5 rounded-xl border backdrop-blur-md shadow-md flex items-center gap-1.5 text-xs font-bold pointer-events-auto ${
            isInside
              ? 'bg-emerald-950/90 text-emerald-300 border-emerald-700/80'
              : 'bg-rose-950/90 text-rose-300 border-rose-700/80'
          }`}
        >
          {isInside ? (
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
          ) : (
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
          )}
          <span className="truncate">
            {isInside
              ? `Within Geo-fence (${distanceKm} km from hub)`
              : `Out of Bounds (${distanceKm} km away · Limit: ${zone.radiusKm} km)`}
          </span>
        </div>

        <div className="px-2.5 py-1.5 rounded-xl bg-slate-900/90 border border-slate-700 text-[11px] font-mono text-slate-300 backdrop-blur-md shadow-md pointer-events-auto shrink-0">
          {zone.name}
        </div>
      </div>

      {/* Floating Bottom Navigation & Zoom Controls */}
      <div className="absolute bottom-2.5 right-2.5 flex items-center gap-1 z-10">
        <button
          type="button"
          onClick={() => setZoomLevel((z) => Math.min(z + 0.15, 1.45))}
          title="Zoom In"
          className="w-7 h-7 rounded-lg bg-slate-900/85 hover:bg-slate-800 text-slate-200 border border-slate-700/80 flex items-center justify-center transition-colors shadow-sm"
        >
          <ZoomIn className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={() => setZoomLevel((z) => Math.max(z - 0.15, 0.85))}
          title="Zoom Out"
          className="w-7 h-7 rounded-lg bg-slate-900/85 hover:bg-slate-800 text-slate-200 border border-slate-700/80 flex items-center justify-center transition-colors shadow-sm"
        >
          <ZoomOut className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={() => setZoomLevel(1)}
          title="Reset Zoom"
          className="w-7 h-7 rounded-lg bg-slate-900/85 hover:bg-slate-800 text-slate-200 border border-slate-700/80 flex items-center justify-center transition-colors shadow-sm"
        >
          <RotateCcw className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Bottom Left Coordinate Indicator */}
      <div className="absolute bottom-2.5 left-2.5 z-10 bg-slate-950/80 px-2 py-0.5 rounded border border-slate-800 text-[9px] font-mono text-slate-400">
        GPS: {technicianCoords.lat.toFixed(4)}, {technicianCoords.lng.toFixed(4)}
      </div>
    </div>
  );
};
