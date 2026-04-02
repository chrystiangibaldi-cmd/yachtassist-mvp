import React, { useState, useContext, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API, UserContext } from '@/App';
import { Button } from '@/components/ui/button';
import { Anchor, Ship, AlertCircle, CheckCircle } from 'lucide-react';
import { GoogleMap, useLoadScript, MarkerF } from '@react-google-maps/api';
import usePlacesAutocomplete, { getGeocode, getLatLng } from 'use-places-autocomplete';

const libraries = ['places'];

const mapContainerStyle = {
  width: '100%',
  height: '200px',
  borderRadius: '0.5rem',
};

const defaultCenter = { lat: 42.0, lng: 12.5 }; // Italy center

const PlacesAutocomplete = ({ onSelect, value, onChange }) => {
  const {
    ready,
    suggestions: { status, data },
    setValue,
    clearSuggestions,
  } = usePlacesAutocomplete({
    requestOptions: {
      types: ['marina', 'harbor'],
      componentRestrictions: { country: [] },
    },
    debounce: 300,
  });

  const handleInput = (e) => {
    setValue(e.target.value);
    onChange(e.target.value);
  };

  const handleSelect = async (description, placeId) => {
    setValue(description, false);
    clearSuggestions();
    onChange(description);

    try {
      const results = await getGeocode({ placeId });
      const { lat, lng } = getLatLng(results[0]);
      onSelect({ name: description, lat, lng });
    } catch (error) {
      console.error('Error getting geocode:', error);
    }
  };

  return (
    <div className="relative">
      <input
        type="text"
        value={value}
        onChange={handleInput}
        disabled={!ready}
        placeholder="es. Marina di Portofino"
        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1D9E75]"
        required
      />
      {status === 'OK' && (
        <ul className="absolute z-50 w-full bg-white border border-slate-200 rounded-lg mt-1 shadow-lg max-h-60 overflow-y-auto">
          {data.map(({ place_id, description }) => (
            <li
              key={place_id}
              onClick={() => handleSelect(description, place_id)}
              className="px-4 py-2 hover:bg-slate-50 cursor-pointer text-sm text-slate-700 border-b border-slate-100 last:border-b-0"
            >
              {description}
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
      await axios.post(`${API}/yachts/create?user_id=${user.id}`, payload);
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
              {isLoaded ? (
                <PlacesAutocomplete
                  value={formData.marina}
                  onChange={handleMarinaTextChange}
                  onSelect={handlePlaceSelect}
                />
              ) : (
                <input
                  type="text"
                  name="marina"
                  value={formData.marina}
                  onChange={handleChange}
                  placeholder="es. Marina di Portofino"
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1D9E75]"
                  required
                />
              )}
            </div>

            {/* Mappa porto selezionato */}
            {isLoaded && portCoords && (
              <div className="rounded-lg overflow-hidden border border-slate-200">
                <GoogleMap
                  mapContainerStyle={mapContainerStyle}
                  center={portCoords}
                  zoom={14}
                  options={{
                    disableDefaultUI: true,
                    zoomControl: true,
                  }}
                >
                  <MarkerF position={portCoords} />
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
