import React, { useMemo, useState } from 'react';
import { MapPin, Navigation, LocateFixed, AlertCircle, ExternalLink } from 'lucide-react';

interface TechnicianRouteMapProps {
  destinationAddress: string;
  technicianName?: string;
  height?: string;
}

type CurrentLocation = {
  latitude: number;
  longitude: number;
  accuracy: number;
};

export const TechnicianRouteMap: React.FC<TechnicianRouteMapProps> = ({
  destinationAddress,
  technicianName = 'Channel Partner',
  height = '170px',
}) => {
  const [currentLocation, setCurrentLocation] = useState<CurrentLocation | null>(null);
  const [locationStatus, setLocationStatus] = useState('Current location has not been shared.');
  const [isLocating, setIsLocating] = useState(false);

  const mapsUrl = useMemo(() => {
    const destination = destinationAddress.trim();
    if (!destination) return null;

    const params = new URLSearchParams({
      api: '1',
      destination: currentLocation
        ? `${currentLocation.latitude},${currentLocation.longitude}`
        : destination,
      travelmode: 'driving',
    });

    // Google Maps directions accepts an origin only when the partner has
    // explicitly shared a real device location. Never use demo coordinates.
    if (currentLocation) {
      params.set('origin', `${currentLocation.latitude},${currentLocation.longitude}`);
      params.set('destination', destination);
    } else {
      params.delete('destination');
      params.set('destination', destination);
    }

    return `https://www.google.com/maps/dir/?${params.toString()}`;
  }, [currentLocation, destinationAddress]);

  const requestCurrentLocation = () => {
    if (!navigator.geolocation) {
      setLocationStatus('This browser does not support device location. Open the destination in Maps instead.');
      return;
    }

    setIsLocating(true);
    setLocationStatus('Waiting for device location permission…');
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCurrentLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
        });
        setLocationStatus('Your device location is available for route planning.');
        setIsLocating(false);
      },
      (error) => {
        const message = error.code === error.PERMISSION_DENIED
          ? 'Location permission was denied. You can still open the customer address in Maps.'
          : error.code === error.POSITION_UNAVAILABLE
            ? 'Device location is unavailable. You can still open the customer address in Maps.'
            : 'Location request timed out. Please try again or open the customer address in Maps.';
        setLocationStatus(message);
        setIsLocating(false);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 }
    );
  };

  return (
    <section
      className="w-full rounded-2xl border border-slate-200 bg-white p-3 shadow-sm"
      style={{ minHeight: height }}
      aria-label="Route navigation"
    >
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
          <Navigation className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-slate-900">Route to customer</p>
          <p className="mt-1 flex items-start gap-1.5 text-xs text-slate-600">
            <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span className="break-words">{destinationAddress || 'Customer address not available'}</span>
          </p>
          <p className="mt-2 text-xs text-slate-500" role="status">{locationStatus}</p>
          {currentLocation && (
            <p className="mt-1 text-[11px] text-slate-500">
              Device GPS accuracy: approximately {Math.round(currentLocation.accuracy)} m
            </p>
          )}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={requestCurrentLocation}
          disabled={isLocating}
          className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-800 disabled:cursor-wait disabled:opacity-60"
        >
          <LocateFixed className="h-4 w-4" />
          {isLocating ? 'Getting location…' : currentLocation ? 'Refresh my location' : 'Use my current location'}
        </button>
        {mapsUrl && (
          <a
            href={mapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-blue-700 px-3 py-2 text-xs font-semibold text-white"
          >
            <ExternalLink className="h-4 w-4" />
            Open route in Google Maps
          </a>
        )}
      </div>

      {!currentLocation && (
        <p className="mt-2 flex items-start gap-1.5 text-[11px] text-amber-700">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          No live partner position or ETA is shown until the device shares a real location.
        </p>
      )}
      <p className="mt-2 text-[10px] text-slate-400">
        {technicianName} · Route and traffic estimates are provided by Google Maps.
      </p>
    </section>
  );
};
