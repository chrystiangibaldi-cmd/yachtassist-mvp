import React, { useState, useContext, useCallback, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { UserContext } from '@/App';
import { Button } from '@/components/ui/button';
import { Anchor, Ship, AlertCircle, CheckCircle } from 'lucide-react';
import { GoogleMap, useLoadScript } from '@react-google-maps/api';
import AdvancedMarker from '@/components/AdvancedMarker';

const BACKEND = "https://yachtassist-mvp-production.up.railway.app/api";

const libraries = ['places', 'marker'];

const mapContainerStyle = {
  width: '100%',
  height: '200px',
  borderRadius: '0.5rem',
};

const PlacesAutocomplete = ({ onSelect, value, onChange }) => {
  const [suggestions, setSuggestions] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const debounceRef = useRef(null);
  const wrapperRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchSuggestions = useCallback(async (input) => {
    if (!input || input.length < 2 || !window.google?.maps?.places?.AutocompleteSuggestion) {
      setSuggestions([]);
      return;
    }
    try {
      const { suggestions: results } = await google.maps.places.AutocompleteSuggestion.fetchAutocompleteSuggestions({
        input,
        includedPrimaryTypes: ['marina'],
      });
      setSuggestions(results || []);
      setShowDropdown((results || []).length > 0);
    } catch (err) {
      console.error('AutocompleteSuggestion error:', err);
      setSuggestions([]);
    }
  }, []);

  const handleInput = (e) => {
    const val = e.target.value;
    onChange(val);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchSuggestions(val), 300);
  };

  const handleSelect = async (suggestion) => {
    const text = suggestion.placePrediction.text.text;
    onChange(text);
    setSuggestions([]);
    setShowDropdown(false);

    try {
      const place = suggestion.placePrediction.toPlace();
      await place.fetchFields({ fields: ['location'] });
      const loc = place.location;
      onSelect({ name: text, lat: loc.lat(), lng: loc.lng() });
    } catch (err) {
      console.error('Error fetching place location:', err);
    }
  };

  return (
    <div className="relative" ref={wrapperRef}>
      <input
        type="text"
        value={value}
        onChange={handleInput}
        onFocus={() => suggestions.length > 0 && setShowDropdown(true)}
        placeholder="es. Marina di Portofino"
        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1D9E75]"
        required
      />
      {showDropdown && suggestions.length > 0 && (
        <ul className="absolute z-50 w-full bg-white border border-slate-200 rounded-lg mt-1 shadow-lg max-h-60 overflow-y-auto">
          {suggestions.map((s, i) => (
            <li
              key={s.placePrediction.placeId || i}
              onClick={() => handleSelect(s)}
              className="px-4 py-2 hover:bg-slate-50 cursor-pointer text-sm text-slate-700 border-b border-slate-100 last:border-b-0"
            >
              {s.placePrediction.text.text}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

const OnboardingYacht = () => {
  const navigate = useNavigate();
  const { user } = useContext(UserContext);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    nome: '',
    modello: '',
    tipo: 'motore',
    anno: '',
    lunghezza: '',
    marina: ''
  });
  const [portCoords, setPortCoords] = useState(null);

  const { isLoaded } = useLoadScript({
    googleMapsApiKey: process.env.REACT_APP_GOOGLE_MAPS_API_KEY || '',
    libraries,
  });

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setError('');
  };

  const handlePlaceSelect = useCallback(({ name, lat, lng }) => {
    setFormData(prev => ({ ...prev, marina: name }));
    setPortCoords({ lat, lng });
    setError('');
  }, []);

  const handleMarinaTextChange = useCallback((value) => {
    setFormData(prev => ({ ...prev, marina: value }));
    setError('');
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.nome || !formData.modello || !formData.marina) {
      setError('Compila i campi obbligatori');
      return;
    }
    setLoading(true);
    try {
      const payload = {
        ...formData,
        ...(portCoords && {
          marina_lat: portCoords.lat,
          marina_lng: portCoords.lng,
        }),
      };
      await axios.post(`${BACKEND}/yachts/create?user_id=${user.id}`, payload);
      navigate('/owner/dashboard');
    } catch (err) {
      setError(err.response?.data?.detail || 'Errore durante il salvataggio');
    } finally {
      setLoading(false);
    }
  };

  const handleSkip = () => {
    navigate('/owner/dashboard');
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center py-12 px-4">
      <div className="w-full max-w-xl">
        {/* Logo */}
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="w-12 h-12 bg-[#0A2342] rounded-lg flex items-center justify-center">
            <Anchor className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-[#0A2342]">YachtAssist</h1>
        </div>

        <div className="bg-white rounded-lg shadow-lg border border-slate-200 p-8">
          {/* Header */}
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-[#1D9E75]/10 rounded-lg flex items-center justify-center">
              <Ship className="w-6 h-6 text-[#1D9E75]" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-[#0A2342]">Aggiungi la tua barca</h2>
              <p className="text-slate-500 text-sm">Benvenuto {user?.name?.split(' ')[0]}! Configura la tua imbarcazione</p>
            </div>
          </div>

          {/* Progress indicator */}
          <div className="flex items-center gap-2 mb-6 mt-4">
            <div className="w-6 h-6 rounded-full bg-[#1D9E75] flex items-center justify-center">
              <CheckCircle className="w-4 h-4 text-white" />
            </div>
            <div className="flex-1 h-1 bg-[#1D9E75] rounded"></div>
            <div className="w-6 h-6 rounded-full bg-[#1D9E75] border-2 border-[#1D9E75] flex items-center justify-center">
              <span className="text-white text-xs font-bold">2</span>
            </div>
            <div className="flex-1 h-1 bg-slate-200 rounded"></div>
            <div className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center">
              <span className="text-slate-400 text-xs font-bold">3</span>
            </div>
          </div>
          <div className="flex justify-between text-xs text-slate-500 mb-6">
            <span>Account</span>
            <span className="text-[#1D9E75] font-medium">Imbarcazione</span>
            <span>Dashboard</span>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700">
              <AlertCircle className="w-5 h-5" />
              <span className="text-sm">{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Tipo barca */}
            <div>
              <label className="block text-sm font-medium text-[#0A2342] mb-2">Tipo imbarcazione</label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, tipo: 'motore' })}
                  className={`p-3 border-2 rounded-lg flex items-center justify-center gap-2 transition-all ${
                    formData.tipo === 'motore'
                      ? 'border-[#0A2342] bg-[#0A2342] text-white'
                      : 'border-slate-200 hover:border-slate-300 text-slate-700'
                  }`}
                >
                  <span>🚤</span>
                  <span className="font-medium">Motore</span>
                </button>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, tipo: 'vela' })}
                  className={`p-3 border-2 rounded-lg flex items-center justify-center gap-2 transition-all ${
                    formData.tipo === 'vela'
                      ? 'border-[#0A2342] bg-[#0A2342] text-white'
                      : 'border-slate-200 hover:border-slate-300 text-slate-700'
                  }`}
                >
                  <span>⛵</span>
                  <span className="font-medium">Vela</span>
                </button>
              </div>
            </div>

            {/* Nome e modello */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-[#0A2342] mb-1">Nome barca *</label>
                <input
                  type="text"
                  name="nome"
                  value={formData.nome}
                  onChange={handleChange}
                  placeholder="es. Suerte"
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1D9E75]"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#0A2342] mb-1">Modello *</label>
                <input
                  type="text"
                  name="modello"
                  value={formData.modello}
                  onChange={handleChange}
                  placeholder="es. Sanlorenzo 50"
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1D9E75]"
                  required
                />
              </div>
            </div>

            {/* Anno e lunghezza */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-[#0A2342] mb-1">Anno costruzione</label>
                <input
                  type="number"
                  name="anno"
                  value={formData.anno}
                  onChange={handleChange}
                  placeholder="es. 2018"
                  min="1950"
                  max="2026"
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1D9E75]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#0A2342] mb-1">Lunghezza (mt)</label>
                <input
                  type="number"
                  name="lunghezza"
                  value={formData.lunghezza}
                  onChange={handleChange}
                  placeholder="es. 15"
                  min="3"
                  max="100"
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1D9E75]"
                />
              </div>
            </div>

            {/* Porto base con Google Places Autocomplete */}
            <div>
              <label className="block text-sm font-medium text-[#0A2342] mb-1">Porto base *</label>
              <PlacesAutocomplete
                value={formData.marina}
                onChange={handleMarinaTextChange}
                onSelect={handlePlaceSelect}
              />
            </div>

            {/* Mappa porto selezionato */}
            {isLoaded && portCoords && (
              <div className="rounded-lg overflow-hidden border border-slate-200">
                <GoogleMap
                  mapContainerStyle={mapContainerStyle}
                  center={portCoords}
                  zoom={14}
                  options={{
                    mapId: 'DEMO_MAP_ID',
                    disableDefaultUI: true,
                    zoomControl: true,
                  }}
                >
                  <AdvancedMarker position={portCoords} />
                </GoogleMap>
              </div>
            )}

            <div className="pt-2">
              <Button
                type="submit"
                disabled={loading}
                className="w-full bg-[#1D9E75] hover:bg-[#1D9E75]/90 text-white font-medium"
              >
                {loading ? 'Salvataggio...' : 'Salva e continua →'}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default OnboardingYacht;
