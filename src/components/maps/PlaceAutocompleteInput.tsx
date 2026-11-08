import React, { useState, useEffect, useRef, useCallback } from 'react';
import { MapPin, Search, Loader2, X, Mic, MicOff, Check, Sparkles } from 'lucide-react';
import { MP_LOCALITIES, CityLocality } from '../../data/localities';

interface PlaceAutocompleteInputProps {
  initialValue?: string;
  onAddressSelect: (address: string, coords?: { lat: number; lng: number }) => void;
  placeholder?: string;
  cityBias?: string;
}

export const PlaceAutocompleteInput: React.FC<PlaceAutocompleteInputProps> = ({
  initialValue = '',
  onAddressSelect,
  placeholder = 'Search colony, landmark, street, flat...',
  cityBias = 'Indore',
}) => {
  const [inputValue, setInputValue] = useState(initialValue);
  const [suggestions, setSuggestions] = useState<CityLocality[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Update suggestions based on input value and city bias
  useEffect(() => {
    const query = inputValue.trim().toLowerCase();
    const cityMatches = MP_LOCALITIES.filter(
      (loc) => loc.city.toLowerCase() === cityBias.toLowerCase()
    );

    if (!query) {
      // Show top popular localities in this city
      setSuggestions(cityMatches.slice(0, 5));
      return;
    }

    const filtered = cityMatches.filter((loc) => {
      const matchName = loc.name.toLowerCase().includes(query);
      const matchPincode = loc.pincode.includes(query);
      const matchLandmark = loc.popularLandmarks.some((lm) =>
        lm.toLowerCase().includes(query)
      );
      return matchName || matchPincode || matchLandmark;
    });

    // If query matches outside city bias, also check other cities
    if (filtered.length === 0) {
      const allMatches = MP_LOCALITIES.filter((loc) => {
        return (
          loc.name.toLowerCase().includes(query) ||
          loc.city.toLowerCase().includes(query) ||
          loc.popularLandmarks.some((lm) => lm.toLowerCase().includes(query))
        );
      });
      setSuggestions(allMatches.slice(0, 5));
    } else {
      setSuggestions(filtered.slice(0, 5));
    }
  }, [inputValue, cityBias]);

  const handleSelectLocality = useCallback(
    (locality: CityLocality) => {
      const fullAddress = `${locality.name}, ${locality.city} (${locality.pincode})`;
      setInputValue(fullAddress);
      setIsOpen(false);
      onAddressSelect(fullAddress, locality.coords);
    },
    [onAddressSelect]
  );

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setInputValue(val);
    setIsOpen(true);
    onAddressSelect(val);
  };

  // Audio recording for voice address input via Gemini
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        setIsTranscribing(true);

        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = async () => {
          try {
            const base64Data = (reader.result as string).split(',')[1];
            const response = await fetch('/api/audio/transcribe', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ audioBase64: base64Data, mimeType: 'audio/webm' }),
            });
            const data = await response.json();
            if (data.success && data.transcription) {
              const transcribed = data.transcription.trim();
              setInputValue(transcribed);
              onAddressSelect(transcribed);
            }
          } catch (err) {
            console.error('Voice transcription error:', err);
          } finally {
            setIsTranscribing(false);
          }
        };
      };

      mediaRecorder.start();
      setIsListening(true);
    } catch (err) {
      console.warn('Microphone access unavailable:', err);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isListening) {
      mediaRecorderRef.current.stop();
      setIsListening(false);
    }
  };

  // Top quick chips for currently selected city
  const cityChips = MP_LOCALITIES.filter(
    (loc) => loc.city.toLowerCase() === cityBias.toLowerCase()
  ).slice(0, 4);

  return (
    <div className="relative w-full" ref={dropdownRef}>
      <div className="relative flex items-center">
        <MapPin className="absolute left-3 w-4 h-4 text-blue-600 pointer-events-none" />
        <input
          type="text"
          value={inputValue}
          onFocus={() => setIsOpen(true)}
          onChange={handleInputChange}
          placeholder={placeholder}
          className="w-full text-xs pl-9 pr-16 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white shadow-2xs font-medium"
        />

        <div className="absolute right-2 flex items-center gap-1">
          {inputValue && (
            <button
              type="button"
              onClick={() => {
                setInputValue('');
                onAddressSelect('');
                setIsOpen(true);
              }}
              className="p-1 text-slate-400 hover:text-slate-600 rounded-full"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}

          {/* Voice Input with Gemini 3.5 Transcribe */}
          <button
            type="button"
            onClick={isListening ? stopRecording : startRecording}
            disabled={isTranscribing}
            title={isListening ? 'Stop recording' : 'Speak address'}
            className={`p-1.5 rounded-lg text-xs transition-colors ${
              isListening
                ? 'bg-rose-500 text-white animate-pulse'
                : isTranscribing
                ? 'bg-amber-100 text-amber-700'
                : 'bg-slate-100 text-slate-600 hover:bg-blue-50 hover:text-blue-600'
            }`}
          >
            {isTranscribing ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : isListening ? (
              <MicOff className="w-3.5 h-3.5" />
            ) : (
              <Mic className="w-3.5 h-3.5" />
            )}
          </button>
        </div>
      </div>

      {isListening && (
        <div className="mt-1 text-[10px] text-rose-600 font-semibold flex items-center gap-1 px-1">
          <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
          <span>Listening... Tap mic icon to finish and transcribe</span>
        </div>
      )}

      {/* Quick Select Locality Chips */}
      {cityChips.length > 0 && !inputValue && (
        <div className="mt-1.5 flex items-center gap-1.5 overflow-x-auto pb-0.5 no-scrollbar">
          <span className="text-[10px] text-slate-400 font-medium shrink-0 flex items-center gap-0.5">
            <Sparkles className="w-2.5 h-2.5 text-amber-500" />
            <span>Popular:</span>
          </span>
          {cityChips.map((chip, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => handleSelectLocality(chip)}
              className="shrink-0 px-2 py-0.5 rounded-full bg-slate-100 hover:bg-blue-50 hover:text-blue-600 border border-slate-200 text-[10px] text-slate-600 font-medium transition-colors"
            >
              {chip.name.split(' ')[0]}
            </button>
          ))}
        </div>
      )}

      {/* Autocomplete Predictions Dropdown */}
      {isOpen && suggestions.length > 0 && (
        <ul className="absolute top-full left-0 right-0 z-50 mt-1 max-h-56 overflow-y-auto bg-white border border-slate-200 rounded-xl shadow-xl divide-y divide-slate-100">
          <li className="px-3 py-1.5 bg-slate-50 text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center justify-between">
            <span>Verified Localities in {cityBias}</span>
            <span className="text-slate-400">{suggestions.length} available</span>
          </li>
          {suggestions.map((s, idx) => (
            <li
              key={idx}
              onClick={() => handleSelectLocality(s)}
              className="p-2.5 hover:bg-blue-50 cursor-pointer flex items-start gap-2.5 text-xs text-slate-800 transition-colors group"
            >
              <div className="w-6 h-6 rounded-lg bg-blue-50 group-hover:bg-blue-600 group-hover:text-white text-blue-600 flex items-center justify-center shrink-0 mt-0.5 transition-colors">
                <MapPin className="w-3.5 h-3.5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-900 group-hover:text-blue-700 truncate">
                    {s.name}
                  </span>
                  <span className="text-[10px] font-mono text-slate-400 bg-slate-100 px-1.5 py-0.2 rounded shrink-0 ml-1">
                    {s.pincode}
                  </span>
                </div>
                {s.popularLandmarks.length > 0 && (
                  <p className="text-[10px] text-slate-500 truncate mt-0.5">
                    Near {s.popularLandmarks.slice(0, 2).join(', ')}
                  </p>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
