import React, { useEffect, useState, useMemo } from 'react';
import { Navigation, MapPin, Compass, ShieldCheck, Zap, ZoomIn, ZoomOut, RotateCcw, Phone } from 'lucide-react';

interface TechnicianRouteMapProps {
  originAddress?: string;
  originCoords?: { lat: number; lng: number };
  destinationAddress: string;
  destinationCoords?: { lat: number; lng: number };
  technicianName?: string;
  onRouteCalculated?: (distanceKm: number, durationMins: number) => void;
  height?: string;
}

// Utility: Haversine distance in KM
function calculateDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const crowFlies = R * c;
  // Apply urban road curvature factor (~1.35x in Indian city grid)
  return Math.max(0.6, Number((crowFlies * 1.35).toFixed(1)));
}

export const TechnicianRouteMap: React.FC<TechnicianRouteMapProps> = ({
  originCoords = { lat: 22.723, lng: 75.864 },
  originAddress = 'Technician Hub, Service Station',
  destinationCoords = { lat: 22.715, lng: 75.879 },
  destinationAddress,
  technicianName = 'Technician',
  onRouteCalculated,
  height = '190px',
}) => {
  const [zoomLevel, setZoomLevel] = useState(1);
  const [pulsePhase, setPulsePhase] = useState(0);

  // Calculate distance & ETA duration
  const routeMetrics = useMemo(() => {
    const lat1 = originCoords?.lat ?? 22.723;
    const lon1 = originCoords?.lng ?? 75.864;
    const lat2 = destinationCoords?.lat ?? 22.715;
    const lon2 = destinationCoords?.lng ?? 75.879;

    const distKm = calculateDistanceKm(lat1, lon1, lat2, lon2);
    // Average urban two-wheeler speed: ~22-25 km/h + 2 min buffer
    const durationMins = Math.max(4, Math.round((distKm / 22) * 60) + 2);

    return { distKm, durationMins };
  }, [originCoords, destinationCoords]);

  // Report route calculations to parent
  useEffect(() => {
    if (onRouteCalculated) {
      onRouteCalculated(routeMetrics.distKm, routeMetrics.durationMins);
    }
  }, [routeMetrics, onRouteCalculated]);

  // Simulated technician progress animation
  useEffect(() => {
    const interval = setInterval(() => {
      setPulsePhase((prev) => (prev + 1) % 100);
    }, 150);
    return () => clearInterval(interval);
  }, []);

  // Compute SVG canvas coordinate mapping
  // We represent the route on a 400x200 SVG canvas with curved spline
  const startX = 65;
  const startY = 140;
  const endX = 335;
  const endY = 55;
  const ctrlX1 = 140;
  const ctrlY1 = 175;
  const ctrlX2 = 240;
  const ctrlY2 = 45;

  // Position of technician vehicle along route based on pulsePhase (oscillates between 25% and 45% en route)
  const t = 0.32 + Math.sin(pulsePhase * 0.05) * 0.08;
  const techX =
    Math.pow(1 - t, 3) * startX +
    3 * Math.pow(1 - t, 2) * t * ctrlX1 +
    3 * (1 - t) * Math.pow(t, 2) * ctrlX2 +
    Math.pow(t, 3) * endX;
  const techY =
    Math.pow(1 - t, 3) * startY +
    3 * Math.pow(1 - t, 2) * t * ctrlY1 +
    3 * (1 - t) * Math.pow(t, 2) * ctrlY2 +
    Math.pow(t, 3) * endY;

  return (
    <div
      style={{ height }}
      className="w-full relative rounded-2xl overflow-hidden border border-slate-700/60 shadow-inner bg-slate-950 select-none group font-sans"
    >
      {/* Background Interactive Navigation Canvas */}
      <div
        className="w-full h-full relative transition-transform duration-300 origin-center"
        style={{ transform: `scale(${zoomLevel})` }}
      >
        <svg
          viewBox="0 0 400 200"
          className="w-full h-full block"
          preserveAspectRatio="xMidYMid slice"
        >
          <defs>
            {/* Grid Pattern */}
            <pattern
              id="nav-grid"
              width="24"
              height="24"
              patternUnits="userSpaceOnUse"
            >
              <path
                d="M 24 0 L 0 0 0 24"
                fill="none"
                stroke="rgba(255, 255, 255, 0.04)"
                strokeWidth="1"
              />
            </pattern>

            {/* Glowing route line gradients */}
            <linearGradient id="routeGrad" x1="0%" y1="100%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#3b82f6" />
              <stop offset="50%" stopColor="#60a5fa" />
              <stop offset="100%" stopColor="#10b981" />
            </linearGradient>

            <filter id="routeGlow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          {/* Grid background */}
          <rect width="100%" height="100%" fill="#090d16" />
          <rect width="100%" height="100%" fill="url(#nav-grid)" />

          {/* Stylized Secondary City Roads & Avenues */}
          <g stroke="rgba(255,255,255,0.07)" strokeWidth="2.5" fill="none">
            <path d="M 0 100 Q 150 90 400 120" />
            <path d="M 120 0 Q 130 110 160 200" />
            <path d="M 280 0 Q 270 90 290 200" />
            <path d="M 0 40 L 400 40" strokeWidth="1.5" strokeDasharray="4 4" />
            <path d="M 0 160 L 400 160" strokeWidth="1.5" strokeDasharray="4 4" />
          </g>

          {/* Arterial Road Shadow */}
          <path
            d={`M ${startX} ${startY} C ${ctrlX1} ${ctrlY1}, ${ctrlX2} ${ctrlY2}, ${endX} ${endY}`}
            fill="none"
            stroke="#1e293b"
            strokeWidth="12"
            strokeLinecap="round"
          />

          {/* Active Navigation Primary Route (Glow + Line) */}
          <path
            d={`M ${startX} ${startY} C ${ctrlX1} ${ctrlY1}, ${ctrlX2} ${ctrlY2}, ${endX} ${endY}`}
            fill="none"
            stroke="url(#routeGrad)"
            strokeWidth="4.5"
            strokeLinecap="round"
            filter="url(#routeGlow)"
          />

          {/* Animated Directional Dash Array */}
          <path
            d={`M ${startX} ${startY} C ${ctrlX1} ${ctrlY1}, ${ctrlX2} ${ctrlY2}, ${endX} ${endY}`}
            fill="none"
            stroke="#ffffff"
            strokeWidth="1.8"
            strokeDasharray="6 12"
            strokeDashoffset={-pulsePhase * 2}
            strokeLinecap="round"
            opacity="0.85"
          />

          {/* Origin Station Marker (Technician Depot) */}
          <circle cx={startX} cy={startY} r="8" fill="#1e3a8a" stroke="#3b82f6" strokeWidth="2" />
          <circle cx={startX} cy={startY} r="3.5" fill="#93c5fd" />

          {/* Customer Destination Marker */}
          <g transform={`translate(${endX}, ${endY})`}>
            {/* Pulse beacon ring */}
            <circle cx="0" cy="0" r="16" fill="none" stroke="#10b981" strokeWidth="1.5" opacity="0.4">
              <animate attributeName="r" values="8;22" dur="2s" repeatCount="indefinite" />
              <animate attributeName="opacity" values="0.8;0" dur="2s" repeatCount="indefinite" />
            </circle>
            <circle cx="0" cy="0" r="10" fill="#065f46" stroke="#34d399" strokeWidth="2.5" />
            <circle cx="0" cy="0" r="4.5" fill="#a7f3d0" />
          </g>

          {/* Live Moving Technician Vehicle Pin */}
          <g transform={`translate(${techX}, ${techY})`}>
            {/* Radar wave */}
            <circle cx="0" cy="0" r="18" fill="none" stroke="#60a5fa" strokeWidth="1.5" opacity="0.6">
              <animate attributeName="r" values="8;24" dur="1.8s" repeatCount="indefinite" />
              <animate attributeName="opacity" values="0.7;0" dur="1.8s" repeatCount="indefinite" />
            </circle>
            {/* Vehicle body */}
            <circle
              cx="0"
              cy="0"
              r="12"
              fill="#2563eb"
              stroke="#ffffff"
              strokeWidth="2"
              style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.5))' }}
            />
            {/* Direction Arrow */}
            <path
              d="M -3 4 L 0 -5 L 3 4 L 0 2 Z"
              fill="#ffffff"
              transform="rotate(62)"
            />
          </g>
        </svg>

        {/* Floating Start Marker Label */}
        <div
          className="absolute text-[9px] font-bold text-slate-400 bg-slate-900/90 border border-slate-700/80 px-1.5 py-0.5 rounded shadow-sm pointer-events-none whitespace-nowrap"
          style={{ left: '35px', top: '150px' }}
        >
          Depot
        </div>

        {/* Floating Moving Technician Label */}
        <div
          className="absolute text-[10px] font-bold text-white bg-blue-600/95 border border-blue-400/80 px-2 py-0.5 rounded-full shadow-lg pointer-events-none whitespace-nowrap transform -translate-x-1/2 -translate-y-8 flex items-center gap-1"
          style={{ left: `${(techX / 400) * 100}%`, top: `${(techY / 200) * 100}%` }}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
          <span>{technicianName.split(' ')[0]} (En Route)</span>
        </div>

        {/* Floating Destination Label */}
        <div
          className="absolute text-[9px] font-bold text-emerald-300 bg-emerald-950/90 border border-emerald-600 px-2 py-0.5 rounded shadow-sm pointer-events-none whitespace-nowrap flex items-center gap-1"
          style={{ left: '72%', top: '25px' }}
        >
          <MapPin className="w-2.5 h-2.5 text-emerald-400" />
          <span>Customer Location</span>
        </div>
      </div>

      {/* Top Left Navigation HUD */}
      <div className="absolute top-2.5 left-2.5 z-10 flex items-center gap-1.5">
        <div className="bg-slate-900/90 backdrop-blur-md border border-slate-700 px-2.5 py-1 rounded-xl text-white shadow-lg flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <div className="flex flex-col">
            <span className="text-[11px] font-bold text-white flex items-center gap-1">
              <span>{routeMetrics.distKm} km away</span>
              <span className="text-slate-400">·</span>
              <span className="text-emerald-400">ETA ~{routeMetrics.durationMins} mins</span>
            </span>
          </div>
        </div>
      </div>

      {/* Top Right Zoom & View Controls */}
      <div className="absolute top-2.5 right-2.5 z-10 flex items-center gap-1">
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
          title="Reset View"
          className="w-7 h-7 rounded-lg bg-slate-900/85 hover:bg-slate-800 text-slate-200 border border-slate-700/80 flex items-center justify-center transition-colors shadow-sm"
        >
          <RotateCcw className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Bottom Route Status Bar */}
      <div className="absolute bottom-2 left-2 right-2 z-10 flex items-center justify-between pointer-events-none">
        <div className="bg-slate-950/85 backdrop-blur-md px-2.5 py-1 rounded-lg border border-slate-800/80 text-[10px] text-slate-300 flex items-center gap-1.5 shadow-md pointer-events-auto">
          <Navigation className="w-3 h-3 text-blue-400" />
          <span className="truncate max-w-[200px]">
            {destinationAddress ? `To: ${destinationAddress.split(',')[0]}` : 'Direct Service Route'}
          </span>
        </div>

        <div className="bg-slate-950/85 backdrop-blur-md px-2 py-1 rounded-lg border border-slate-800/80 text-[10px] text-emerald-400 font-semibold flex items-center gap-1 shadow-md pointer-events-auto">
          <ShieldCheck className="w-3 h-3" />
          <span>Live GPS Navigation</span>
        </div>
      </div>
    </div>
  );
};
