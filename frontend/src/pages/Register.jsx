import React, { useState, useContext, useCallback, useRef, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { UserContext } from '@/App';
import { Button } from '@/components/ui/button';
import { Anchor, User, Wrench, AlertCircle } from 'lucide-react';
import { GoogleMap, useLoadScript, MarkerF } from '@react-google-maps/api';

const BACKEND = "https://yachtassist-mvp-production.up.railway.app/api";

const libraries = ['places'];

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
        placeholder="es. Marina di Pisa"
        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1D9E75] focus:border-transparent"
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

const Register = () => {
  const navigate = useNavigate();
  const { login } = useContext(UserContext);
  
  const [formData, setFormData] = useState({
    nome: '',
    cognome: '',
    email: '',
    password: '',
    confirmPassword: '',
    role: 'owner',
    specializzazione: '',
    porto_base: '',
    telefono: ''
  });
  
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [portCoords, setPortCoords] = useState(null);

  const { isLoaded } = useLoadScript({
    googleMapsApiKey: process.env.REACT_APP_GOOGLE_MAPS_API_KEY || '',
    libraries,
  });

  const handlePlaceSelect = useCallback(({ name, lat, lng }) => {
    setFormData(prev => ({ ...prev, porto_base: name }));
    setPortCoords({ lat, lng });
    setError('');
  }, []);

  const handlePortoBaseTextChange = useCallback((value) => {
    setFormData(prev => ({ ...prev, porto_base: value }));
    setPortCoords(null);
    setError('');
  }, []);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    
    // Validation
    if (!formData.nome || !formData.cognome || !formData.email || !formData.password) {
      setError('Tutti i campi sono obbligatori');
      return;
    }
    
    if (formData.password !== formData.confirmPassword) {
      setError('Le password non corrispondono');
      return;
    }
    
    if (formData.password.length < 6) {
      setError('La password deve contenere almeno 6 caratteri');
      return;
    }
    
    if (formData.role === 'technician' && (!formData.specializzazioni?.length || !formData.porto_base || !formData.telefono)) {
      setError('Seleziona almeno una specializzazione e compila tutti i campi');
      return;
    }

    setLoading(true);
    
    try {
      const payload = {
        nome: formData.nome,
        cognome: formData.cognome,
        email: formData.email,
        password: formData.password,
        role: formData.role,
        ...(formData.role === 'technician' && {
          specializzazioni: formData.specializzazioni,
          porto_base: formData.porto_base,
          telefono: formData.telefono,
          ...(portCoords && {
            marina_lat: portCoords.lat,
            marina_lng: portCoords.lng,
          })
        })
      };
      
      const response = await axios.post(`${BACKEND}/auth/register`, payload);
      const { user, token } = response.data;
      
      // Store auth data
      login(user, token);
      
      // Redirect based on role
      if (user.role === 'owner') {
        navigate('/owner/onboarding');
      } else {
        navigate('/technician/dashboard');
      }
    } catch (err) {
      setError(err.response?.data?.detail || 'Errore durante la registrazione');
    } finally {
      setLoading(false);
    }
  };

  const handleDemoLogin = async (role) => {
    try {
      const response = await axios.post(`${BACKEND}/auth/demo-login`, { role });
      const { user, token } = response.data;
      login(user, token);
      
      if (role === 'owner') {
        navigate('/owner/dashboard');
      } else {
        navigate('/technician/dashboard');
      }
    } catch (error) {
      console.error('Demo login error:', error);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center py-12 px-4">
      <div className="w-full max-w-2xl">
        {/* Logo */}
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="w-12 h-12 bg-[#0A2342] rounded-lg flex items-center justify-center">
            <Anchor className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-[#0A2342]">YachtAssist</h1>
        </div>

        {/* Registration Form */}
        <div className="bg-white rounded-lg shadow-lg border border-slate-200 p-8">
          <h2 className="text-2xl font-bold text-[#0A2342] mb-2">Crea un account</h2>
          <p className="text-slate-600 mb-6">Registrati per accedere alla piattaforma</p>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700">
              <AlertCircle className="w-5 h-5" />
              <span className="text-sm">{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Role Selection */}
            <div>
              <label className="block text-sm font-medium text-[#0A2342] mb-2">Tipo di account</label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, role: 'owner' })}
                  className={`p-4 border-2 rounded-lg flex items-center justify-center gap-2 transition-all ${
                    formData.role === 'owner' 
                      ? 'border-[#0A2342] bg-[#0A2342] text-white' 
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <User className="w-5 h-5" />
                  <span className="font-medium">Owner / Captain</span>
                </button>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, role: 'technician' })}
                  className={`p-4 border-2 rounded-lg flex items-center justify-center gap-2 transition-all ${
                    formData.role === 'technician' 
                      ? 'border-[#1D9E75] bg-[#1D9E75] text-white' 
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <Wrench className="w-5 h-5" />
                  <span className="font-medium">Tecnico</span>
                </button>
              </div>
            </div>

            {/* Name Fields */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-[#0A2342] mb-1">Nome *</label>
                <input
                  type="text"
                  name="nome"
                  value={formData.nome}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1D9E75] focus:border-transparent"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#0A2342] mb-1">Cognome *</label>
                <input
                  type="text"
                  name="cognome"
                  value={formData.cognome}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1D9E75] focus:border-transparent"
                  required
                />
              </div>
            </div>

            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-[#0A2342] mb-1">Email *</label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1D9E75] focus:border-transparent"
                required
              />
            </div>

            {/* Password Fields */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-[#0A2342] mb-1">Password *</label>
                <input
                  type="password"
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1D9E75] focus:border-transparent"
                  required
                  minLength={6}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#0A2342] mb-1">Conferma Password *</label>
                <input
                  type="password"
                  name="confirmPassword"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1D9E75] focus:border-transparent"
                  required
                />
              </div>
            </div>

            {/* Technician-specific fields */}
            {formData.role === 'technician' && (
              <>
                                <div>
                  <label className="block text-sm font-medium text-[#0A2342] mb-2">
                    Specializzazioni *
                    <span className="text-xs text-slate-400 ml-2 font-normal">
                      Seleziona tutte le aree in cui operi
                    </span>
                  </label>
                  <div className="grid grid-cols-2 gap-2 max-h-64 overflow-y-auto border border-slate-200 rounded-lg p-3">
                    {[
  { id: 'motore',            label: '⚙️ Motore & Propulsione' },
  { id: 'elettrico',         label: '⚡ Elettrico & Elettronico' },
  { id: 'oleodinamica',      label: '🔩 Oleodinamica' },
  { id: 'aria_condizionata', label: '❄️ Aria Condizionata' },
  { id: 'scafo',             label: '🛥️ Scafo & Struttura' },
  { id: 'coperta',           label: '⚓ Coperta & Attrezzatura' },
  { id: 'impianti',          label: '🔩 Impianti di Bordo' },
  { id: 'navigazione',       label: '🧭 Navigazione & Strumentazione' },
  { id: 'elettrodomestici',  label: '🍳 Elettrodomestici di Bordo' },
  { id: 'stabilizzatori',    label: '⚖️ Stabilizzatori' },
  { id: 'tappezzeria', label: '🧵 Tappezzeria & Tessuti' },
  { id: 'lavaggi',           label: '🧼 Lavaggi & Pulizia' },
  { id: 'vetri',       label: '🔍 Vetri & Vetrate' },
  { id: 'wrapping',          label: '🎨 Wrapping & Pellicole' },
  { id: 'spurghi',           label: '💧 Spurghi & Alta Pressione' },
  { id: 'falegname', label: '🛠️ Falegname & Carpentiere' },
  { id: 'idraulico',         label: '🔧 Idraulico & Tubista' },
  { id: 'verniciatore',      label: '🖌️ Verniciatore & Lucidatore' },
  { id: 'lavanderia',        label: '👕 Lavanderia' },
].map(cat => (
  <label key={cat.id} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-slate-50 rounded p-1">
    <input
      type="checkbox"
      value={cat.id}
      checked={formData.specializzazioni?.includes(cat.id) || false}
      onChange={(e) => {
        const current = formData.specializzazioni || [];
        const updated = e.target.checked
          ? [...current, cat.id]
          : current.filter(s => s !== cat.id);
        setFormData({ ...formData, specializzazioni: updated });
      }}
      className="rounded border-slate-300 text-[#1D9E75]"
    />
    {cat.label}
  </label>
))}
                  </div>
                  {formData.specializzazioni?.length === 0 && (
                    <p className="text-xs text-amber-600 mt-1">Seleziona almeno una specializzazione</p>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-[#0A2342] mb-1">Porto base *</label>
                    {isLoaded ? (
                      <PlacesAutocomplete
                        value={formData.porto_base}
                        onChange={handlePortoBaseTextChange}
                        onSelect={handlePlaceSelect}
                      />
                    ) : (
                      <input
                        type="text"
                        name="porto_base"
                        value={formData.porto_base}
                        onChange={handleChange}
                        placeholder="es. Marina di Pisa"
                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1D9E75] focus:border-transparent"
                        required
                      />
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[#0A2342] mb-1">Telefono *</label>
                    <input
                      type="tel"
                      name="telefono"
                      value={formData.telefono}
                      onChange={handleChange}
                      placeholder="+39 ..."
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1D9E75] focus:border-transparent"
                      required
                    />
                  </div>
                </div>
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
              </>
            )}

            {/* Submit Button */}
            <Button
              type="submit"
              disabled={loading}
              className="w-full h-12 bg-[#1D9E75] hover:bg-[#1D9E75]/90 text-white font-medium rounded-lg transition-colors"
            >
              {loading ? 'Registrazione in corso...' : 'Registrati'}
            </Button>
          </form>

          {/* Login Link */}
          <div className="mt-6 text-center">
            <span className="text-slate-600">Hai già un account? </span>
            <Link to="/login" className="text-[#1D9E75] font-medium hover:underline">
              Accedi
            </Link>
          </div>

          {/* Demo Divider */}
          <div className="relative my-8">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-300"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-4 bg-white text-slate-500">oppure accedi alla demo</span>
            </div>
          </div>

          {/* Demo Buttons */}
          <div className="space-y-3">
            <Button
              onClick={() => handleDemoLogin('owner')}
              variant="outline"
              className="w-full h-12 border-slate-300 hover:bg-slate-50 flex items-center justify-center gap-2"
            >
              <User className="w-5 h-5" />
              Demo Owner (Chrystian Gibaldi)
            </Button>
            <Button
              onClick={() => handleDemoLogin('technician')}
              variant="outline"
              className="w-full h-12 border-slate-300 hover:bg-slate-50 flex items-center justify-center gap-2"
            >
              <Wrench className="w-5 h-5" />
              Demo Tecnico (Enrico Gibaldi)
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Register;
