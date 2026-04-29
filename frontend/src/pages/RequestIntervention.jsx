// v3.1 - 21 categories
import React, { useState, useContext, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { UserContext } from '@/App';
import { Button } from '@/components/ui/button';
import { Anchor, ArrowLeft, ArrowRight, CheckCircle, Upload, MapPin, Star, AlertCircle, Sparkles } from 'lucide-react';
import { GoogleMap, useLoadScript } from '@react-google-maps/api';
import AdvancedMarker from '@/components/AdvancedMarker';
import { CATEGORIES as categories, getCategoryLabel } from '@/lib/categories';

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
        placeholder="es. Marina di Pisa"
        className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1D9E75]"
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

const RequestIntervention = () => {
  const navigate = useNavigate();
  const { user } = useContext(UserContext);
  
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    category: '',
    categoryId: '',
    description: '',
    photos: [],
    urgency: 'normale',
    marina: '',
    marina_lat: null,
    marina_lng: null,
    selectedTechnician: null
  });
  const [technicians, setTechnicians] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState(null);
  const [expandedCategory, setExpandedCategory] = useState(null);
  const [selectedSubcategories, setSelectedSubcategories] = useState([]);
  const [marinaCoords, setMarinaCoords] = useState(null);
  const [yachts, setYachts] = useState([]);
  const [selectedYachtId, setSelectedYachtId] = useState(null);
  const [showYachtSwitcher, setShowYachtSwitcher] = useState(false);

  const { isLoaded } = useLoadScript({
    googleMapsApiKey: process.env.REACT_APP_GOOGLE_MAPS_API_KEY || '',
    libraries,
  });

  const handleMarinaPlaceSelect = useCallback(({ name, lat, lng }) => {
    setFormData(prev => ({ ...prev, marina: name, marina_lat: lat, marina_lng: lng }));
    setMarinaCoords({ lat, lng });
  }, []);

  const handleMarinaTextChange = useCallback((value) => {
    setFormData(prev => ({ ...prev, marina: value, marina_lat: null, marina_lng: null }));
    setMarinaCoords(null);
  }, []);

  const handleYachtSwitch = (yachtId) => {
    setSelectedYachtId(yachtId);
    setShowYachtSwitcher(false);
    // Pre-fill marina del nuovo yacht solo se utente non ha già digitato manualmente
    const newYacht = yachts.find(y => y.id === yachtId);
    if (newYacht && newYacht.marina) {
      setFormData(prev => {
        if (prev.marina !== '' && prev.marina !== prev.marina) return prev; // rispetta scelta utente custom
        if (newYacht.marina_lat != null && newYacht.marina_lng != null) {
          setMarinaCoords({ lat: newYacht.marina_lat, lng: newYacht.marina_lng });
        }
        return {
          ...prev,
          marina: newYacht.marina,
          marina_lat: newYacht.marina_lat ?? null,
          marina_lng: newYacht.marina_lng ?? null,
        };
      });
    }
  };

  useEffect(() => {
    if (!user?.id) return;
    axios.get(`${BACKEND}/dashboard/owner?user_id=${user.id}`)
      .then(res => {
        // Multi-boat: legge la lista yachts (nuova) e fallback a yacht (singolare retrocompat)
        const yachtList = res.data?.yachts && res.data.yachts.length > 0
          ? res.data.yachts
          : (res.data?.yacht ? [res.data.yacht] : []);
        setYachts(yachtList);

        // Inizializza selectedYachtId al primo yacht
        const firstYacht = yachtList[0];
        if (firstYacht) {
          setSelectedYachtId(firstYacht.id);

          // Pre-fill marina solo se vuota (rispetta logica esistente)
          if (firstYacht.marina) {
            setFormData(prev => {
              if (prev.marina !== '') return prev;
              if (firstYacht.marina_lat != null && firstYacht.marina_lng != null) {
                setMarinaCoords({ lat: firstYacht.marina_lat, lng: firstYacht.marina_lng });
              }
              return {
                ...prev,
                marina: firstYacht.marina,
                marina_lat: firstYacht.marina_lat ?? null,
                marina_lng: firstYacht.marina_lng ?? null,
              };
            });
          }
        }
      })
      .catch(err => console.error('Dashboard fetch for pre-pop failed:', err));
  }, [user?.id]);

  useEffect(() => {
    if (step === 4) {
      fetchTechnicians();
    }
  }, [step]);

  const fetchTechnicians = async () => {
    try {
      const params = new URLSearchParams();
      if (formData.categoryId) params.set('category', formData.categoryId);
      if (formData.marina_lat != null) params.set('marina_lat', formData.marina_lat);
      if (formData.marina_lng != null) params.set('marina_lng', formData.marina_lng);
      const qs = params.toString();
      const url = qs ? `${BACKEND}/technicians/available?${qs}` : `${BACKEND}/technicians/available`;
      const response = await axios.get(url);
      setTechnicians(response.data);
    } catch (err) {
      console.error('Error fetching technicians:', err);
    }
  };

  const handleCategorySelect = (category) => {
    if (expandedCategory?.id === category.id) {
      setExpandedCategory(null);
    } else {
      setExpandedCategory(category);
      setSelectedSubcategories([]);
    }
};

const handleSubcategoryConfirm = () => {
    const subLabel = selectedSubcategories.length > 0
      ? ` — ${selectedSubcategories.join(', ')}`
      : '';
    setFormData(prev => ({ ...prev, category: expandedCategory.name + subLabel, categoryId: expandedCategory.id }));
    setStep(2);
  };

  const handleAnalyzeWithAI = async () => {
    if (!formData.description || formData.description.length < 10) {
      setError('Scrivi almeno una breve descrizione prima di analizzare');
      return;
    }
    setError('');
    setAiLoading(true);
    setAiResult(null);
    try {
      const response = await fetch(`${BACKEND}/ai/diagnose`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description: formData.description,
          category: formData.category
        })
      });
      const data = await response.json();
      setAiResult(data);
      if (data.urgency && data.urgency !== 'emergenza') {
        setFormData(prev => ({ ...prev, urgency: data.urgency }));
      }
    } catch (err) {
      setError('Errore AI. Riprova tra qualche secondo.');
    } finally {
      setAiLoading(false);
    }
  };

  const handleNext = () => {
    if (step === 2) {
      if (!formData.description || formData.description.length < 20) {
        setError('La descrizione deve contenere almeno 20 caratteri');
        return;
      }
    }
    setError('');
    setStep(step + 1);
  };

  const handleBack = () => {
    setError('');
    setAiResult(null);
    setStep(step - 1);
  };

  const handleCreateTicket = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await axios.post(`${BACKEND}/tickets/create?user_id=${user.id}`, {
        category: formData.category,
        description: formData.description,
        urgency: formData.urgency,
        marina: formData.marina,
        marina_lat: formData.marina_lat,
        marina_lng: formData.marina_lng,
        photos: formData.photos,
        yacht_id: selectedYachtId
      });
      const ticket = response.data.ticket;
      if (formData.selectedTechnician) {
        await axios.post(`${BACKEND}/tickets/${ticket.id}/assign`, {
          technician_id: formData.selectedTechnician
        });
      }
      navigate(`/owner/ticket/${ticket.id}`);
    } catch (err) {
      setError(err.response?.data?.detail || 'Errore durante la creazione del ticket');
    } finally {
      setLoading(false);
    }
  };

  const filteredTechnicians = technicians; // ordinamento già fatto dal backend (specializzati prima, altri in fondo)

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10 shadow-sm">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#0A2342] rounded-lg flex items-center justify-center">
              <Anchor className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-[#0A2342]">YachtAssist</h1>
          </div>
          <Button onClick={() => navigate('/owner/dashboard')} variant="outline" className="border-slate-200 hover:bg-slate-50">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Dashboard
          </Button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8">
        {/* Multi-boat: banner selettore yacht persistente */}
        {yachts.length >= 2 && selectedYachtId && (
          <div className="mb-6 bg-white border border-slate-200 rounded-lg shadow-sm p-4">
            {!showYachtSwitcher ? (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-[#0A2342] rounded-lg flex items-center justify-center flex-shrink-0">
                    <Anchor className="w-5 h-5 text-[#1D9E75]" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 mb-0.5">Stai richiedendo intervento per</p>
                    <p className="font-semibold text-[#0A2342]">
                      {(yachts.find(y => y.id === selectedYachtId) || {}).name || '—'}
                      <span className="text-slate-500 font-normal text-sm ml-2">
                        · {(yachts.find(y => y.id === selectedYachtId) || {}).model || ''}
                      </span>
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  data-testid="change-yacht-button"
                  onClick={() => setShowYachtSwitcher(true)}
                  className="text-sm text-[#1D9E75] hover:text-[#1D9E75]/80 font-medium px-3 py-1 rounded transition-colors"
                >
                  Cambia
                </button>
              </div>
            ) : (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-semibold text-[#0A2342]">Seleziona barca</p>
                  <button
                    type="button"
                    onClick={() => setShowYachtSwitcher(false)}
                    className="text-xs text-slate-500 hover:text-slate-700"
                  >
                    Annulla
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {yachts.map(y => {
                    const isSelected = y.id === selectedYachtId;
                    return (
                      <button
                        key={y.id}
                        type="button"
                        data-testid={`yacht-switcher-${y.id}`}
                        onClick={() => handleYachtSwitch(y.id)}
                        className={`text-left px-3 py-2 rounded-lg border transition-all ${
                          isSelected
                            ? 'bg-[#0A2342] text-white border-[#1D9E75]'
                            : 'bg-white text-[#0A2342] border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <div className="font-semibold text-sm">{y.name}</div>
                        <div className={`text-xs ${isSelected ? 'opacity-85' : 'text-slate-500'}`}>
                          {y.model} · {y.marina || '—'}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Progress */}
        <div className="flex items-center justify-center mb-8">
          {[1, 2, 3, 4, 5].map((s, idx) => (
            <React.Fragment key={s}>
              <div className={`flex items-center justify-center w-10 h-10 rounded-full font-semibold ${
                s <= step ? 'bg-[#1D9E75] text-white' : 'bg-slate-200 text-slate-400'
              }`}>{s}</div>
              {idx < 4 && <div className={`w-16 h-1 mx-2 ${s < step ? 'bg-[#1D9E75]' : 'bg-slate-200'}`}></div>}
            </React.Fragment>
          ))}
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700">
            <AlertCircle className="w-5 h-5" />
            <span>{error}</span>
          </div>
        )}

        {/* Step 1 */}
       {step === 1 && (
  <div>
    <h2 className="text-3xl font-bold text-[#0A2342] mb-3">Seleziona la categoria</h2>
    <p className="text-lg text-slate-600 mb-8">Che tipo di intervento ti serve?</p>
    <div className="grid grid-cols-2 gap-4">
      {categories.map((cat) => (
        <div key={cat.id} className={expandedCategory?.id === cat.id ? 'col-span-2' : ''}>
          <button
            onClick={() => handleCategorySelect(cat)}
            className={`w-full p-6 rounded-lg border-2 transition-all text-left ${
              expandedCategory?.id === cat.id
                ? 'border-[#1D9E75] bg-[#1D9E75]/5'
                : 'border-slate-200 hover:border-[#1D9E75] hover:bg-slate-50'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <span className="text-4xl">{cat.icon}</span>
                <h3 className="text-lg font-semibold text-[#0A2342]">
                  {cat.name}
                </h3>
              </div>
              <span className="text-slate-400 text-xl">
                {expandedCategory?.id === cat.id ? '▲' : '▼'}
              </span>
            </div>
          </button>

          {/* Accordion subcategorie */}
          {expandedCategory?.id === cat.id && cat.subcategories?.length > 0 && (
            <div className="border-2 border-t-0 border-[#1D9E75] rounded-b-lg bg-white p-4">
              <p className="text-sm text-slate-500 mb-3">Seleziona il tipo di intervento (opzionale):</p>
              <div className="grid grid-cols-2 gap-2 mb-4">
                {cat.subcategories.map((sub) => (
                  <label key={sub} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-slate-50 rounded p-1">
                    <input
                      type="checkbox"
                      checked={selectedSubcategories.includes(sub)}
                      onChange={(e) => {
                        setSelectedSubcategories(prev =>
                          e.target.checked ? [...prev, sub] : prev.filter(s => s !== sub)
                        );
                      }}
                      className="rounded border-slate-300 text-[#1D9E75]"
                    />
                    <span className="text-slate-700">{sub}</span>
                  </label>
                ))}
              </div>
              <button
                onClick={handleSubcategoryConfirm}
                className="w-full py-2 bg-[#1D9E75] text-white rounded-lg font-medium hover:bg-[#1D9E75]/90 transition-colors"
              >
                Continua →
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  </div>
)}

        {/* Step 2 */}
        {step === 2 && (
          <div>
            <h2 className="text-3xl font-bold text-[#0A2342] mb-3">Descrivi il problema</h2>
            <p className="text-lg text-slate-600 mb-6">Categoria: <span className="font-semibold">{formData.category}</span></p>

            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-[#0A2342] mb-2">Descrizione del problema *</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => { setFormData({ ...formData, description: e.target.value }); setAiResult(null); }}
                  placeholder="Descrivi in dettaglio il problema o l'intervento richiesto..."
                  className="w-full h-40 px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1D9E75] resize-none"
                />
                <div className="flex items-center justify-between mt-1">
                  <p className="text-sm text-slate-500">{formData.description.length}/20 caratteri minimi</p>
                </div>
              </div>

              <Button
                onClick={handleAnalyzeWithAI}
                disabled={aiLoading || formData.description.length < 10}
                className="w-full h-12 bg-[#0A2342] hover:bg-[#0A2342]/90 text-white font-medium rounded-lg flex items-center justify-center gap-2"
              >
                <Sparkles className="w-4 h-4" />
                {aiLoading ? 'Analisi AI in corso...' : 'Analizza con AI'}
              </Button>

              {aiResult && (
                <div className="bg-[#0A2342]/5 border-2 border-[#0A2342]/20 rounded-lg p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <Sparkles className="w-4 h-4 text-[#0A2342]" />
                    <h4 className="font-semibold text-[#0A2342]">Diagnosi AI</h4>
                  </div>
                  <div className="space-y-2 text-sm">
                    {aiResult.causa && (
                      <div className="flex gap-2">
                        <span className="text-slate-500 w-32 shrink-0">Possibile causa:</span>
                        <span className="text-[#0A2342] font-medium">{aiResult.causa}</span>
                      </div>
                    )}
                    {aiResult.urgency && (
                      <div className="flex gap-2">
                        <span className="text-slate-500 w-32 shrink-0">Urgenza suggerita:</span>
                        <span className={`font-medium ${aiResult.urgency === 'urgente' ? 'text-amber-600' : 'text-green-700'}`}>
                          {aiResult.urgency === 'urgente' ? '⚡ Urgente (4h)' : '✓ Normale (48h)'}
                        </span>
                      </div>
                    )}
                    {aiResult.note && (
                      <div className="pt-2 border-t border-[#0A2342]/10">
                        <p className="text-slate-600 italic">{aiResult.note}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-[#0A2342] mb-2">
                  Allegati (opzionale)
                  <span className="text-xs text-slate-400 ml-2 font-normal">JPG, PNG, PDF — max 2MB cad., fino a 5 file</span>
                </label>
                <div
                  onClick={() => document.getElementById('file-upload-input').click()}
                  className="border-2 border-dashed border-slate-300 rounded-lg p-8 text-center hover:border-[#1D9E75] transition-colors cursor-pointer"
                >
                  <Upload className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                  <p className="text-slate-600">Clicca per caricare foto o documenti</p>
                  <p className="text-sm text-slate-400 mt-1">JPG, PNG, PDF — max 2MB per file</p>
                </div>
                <input
                  id="file-upload-input"
                  type="file"
                  multiple
                  accept="image/jpeg,image/png,application/pdf"
                  className="hidden"
                  onChange={async (e) => {
                    const files = Array.from(e.target.files);
                    if (formData.photos.length + files.length > 5) {
                      setError('Puoi caricare massimo 5 file per ticket');
                      return;
                    }
                    const tooBig = files.filter(f => f.size > 2 * 1024 * 1024);
                    if (tooBig.length > 0) {
                      setError(`File troppo grandi (max 2MB): ${tooBig.map(f => f.name).join(', ')}`);
                      return;
                    }
                    setError('');
                    const base64files = await Promise.all(files.map(file => new Promise((resolve) => {
                      const reader = new FileReader();
                      reader.onload = () => resolve({
                        name: file.name,
                        type: file.type,
                        data: reader.result
                      });
                      reader.readAsDataURL(file);
                    })));
                    setFormData(prev => ({ ...prev, photos: [...prev.photos, ...base64files] }));
                  }}
                />
                {formData.photos.length > 0 && (
                  <div className="mt-3 space-y-2">
                    {formData.photos.map((file, idx) => (
                      <div key={idx} className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
                        <div className="flex items-center gap-2 text-sm text-slate-700">
                          {file.type === 'application/pdf'
                            ? <span>📄</span>
                            : <img src={file.data} alt={file.name} className="w-8 h-8 object-cover rounded" />
                          }
                          <span className="truncate max-w-[200px]">{file.name}</span>
                        </div>
                        <button
                          onClick={() => setFormData(prev => ({ ...prev, photos: prev.photos.filter((_, i) => i !== idx) }))}
                          className="text-red-400 hover:text-red-600 text-xs font-medium ml-2"
                        >
                          Rimuovi
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-[#0A2342] mb-3">Urgenza</label>
                <div className="grid grid-cols-3 gap-4">
                  <button
                    onClick={() => setFormData({ ...formData, urgency: 'normale' })}
                    className={`p-4 rounded-lg border-2 transition-all ${
                      formData.urgency === 'normale' ? 'border-[#1D9E75] bg-[#1D9E75]/10' : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <h4 className="font-semibold text-[#0A2342]">Normale (48h)</h4>
                    <p className="text-sm text-slate-600 mt-1">Intervento programmabile</p>
                  </button>
                  <button
                    onClick={() => setFormData({ ...formData, urgency: 'urgente' })}
                    className={`p-4 rounded-lg border-2 transition-all ${
                      formData.urgency === 'urgente' ? 'border-amber-500 bg-amber-50' : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <h4 className="font-semibold text-[#0A2342]">Urgente (4h)</h4>
                    <p className="text-sm text-slate-600 mt-1">Richiede attenzione rapida</p>
                  </button>
                  <button
                    onClick={() => setFormData({ ...formData, urgency: 'emergenza' })}
                    className={`p-4 rounded-lg border-2 transition-all ${
                      formData.urgency === 'emergenza' ? 'border-red-500 bg-red-50' : 'border-slate-200 hover:border-red-300'
                    }`}
                  >
                    <h4 className="font-semibold text-red-700">EMERGENZA</h4>
                    <p className="text-sm text-slate-600 mt-1">Massima priorità</p>
                  </button>
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-8">
              <Button onClick={handleBack} variant="outline" className="flex-1">
                <ArrowLeft className="w-4 h-4 mr-2" />Indietro
              </Button>
              <Button onClick={handleNext} className="flex-1 bg-[#1D9E75] hover:bg-[#1D9E75]/90">
                Avanti<ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </div>
        )}

        {/* Step 3 */}
        {step === 3 && (
          <div>
            <h2 className="text-3xl font-bold text-[#0A2342] mb-3">Conferma la località</h2>
            <p className="text-lg text-slate-600 mb-8">Dove si trova l'imbarcazione?</p>
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-[#0A2342] mb-2">Porto / Marina</label>
                {isLoaded ? (
                  <PlacesAutocomplete
                    value={formData.marina}
                    onChange={handleMarinaTextChange}
                    onSelect={handleMarinaPlaceSelect}
                  />
                ) : (
                  <input
                    type="text"
                    value={formData.marina}
                    onChange={(e) => handleMarinaTextChange(e.target.value)}
                    className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1D9E75]"
                  />
                )}
                {!formData.marina_lat && formData.marina && (
                  <p className="text-xs text-amber-600 mt-1">Seleziona dalla lista per abilitare il calcolo distanza tecnici</p>
                )}
              </div>
              {isLoaded && marinaCoords && (
                <div className="rounded-lg overflow-hidden border border-slate-200">
                  <GoogleMap
                    mapContainerStyle={mapContainerStyle}
                    center={marinaCoords}
                    zoom={14}
                    options={{
                      mapId: 'DEMO_MAP_ID',
                      disableDefaultUI: true,
                      zoomControl: true,
                    }}
                  >
                    <AdvancedMarker position={marinaCoords} />
                  </GoogleMap>
                </div>
              )}
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-6">
                <h3 className="font-semibold text-[#0A2342] mb-4">Riepilogo richiesta</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-600">Categoria:</span>
                    <span className="font-medium text-[#0A2342]">{formData.category}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">Urgenza:</span>
                    <span className={`font-medium ${
                      formData.urgency === 'emergenza' ? 'text-red-600' :
                      formData.urgency === 'urgente' ? 'text-amber-600' : 'text-[#0A2342]'
                    }`}>
                      {formData.urgency === 'emergenza' ? 'EMERGENZA' :
                       formData.urgency === 'urgente' ? 'Urgente (4h)' : 'Normale (48h)'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">Località:</span>
                    <span className="font-medium text-[#0A2342]">{formData.marina}</span>
                  </div>
                  <div className="pt-2 border-t border-slate-300">
                    <span className="text-slate-600">Descrizione:</span>
                    <p className="text-[#0A2342] mt-1">{formData.description}</p>
                  </div>
                </div>
              </div>
            </div>
            <div className="flex gap-3 mt-8">
              <Button onClick={handleBack} variant="outline" className="flex-1">
                <ArrowLeft className="w-4 h-4 mr-2" />Indietro
              </Button>
              <Button onClick={handleNext} className="flex-1 bg-[#1D9E75] hover:bg-[#1D9E75]/90">
                Avanti<ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </div>
        )}

        {/* Step 4 */}
        {step === 4 && (
          <div>
            <h2 className="text-3xl font-bold text-[#0A2342] mb-3">
              {formData.urgency === 'emergenza' ? 'Tecnici disponibili' : 'Seleziona un tecnico'}
            </h2>
            <p className="text-lg text-slate-600 mb-8">
              {formData.urgency === 'emergenza' ? '🚨 Il primo tecnico che accetta prende il lavoro' : `Tecnici specializzati in ${formData.category}`}
            </p>
            <div className="space-y-4">
              {filteredTechnicians.length === 0 && (
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-8 text-center">
                  <p className="text-slate-600">Al momento nessun tecnico certificato in questa zona</p>
                  <p className="text-sm text-slate-500 mt-1">Stiamo ampliando la nostra rete di professionisti. Lascia la tua richiesta in coda — ti contatteremo non appena un tecnico sarà disponibile per questa categoria, oppure contatta il nostro supporto per assistenza diretta.</p>
                </div>
              )}
              {filteredTechnicians.map((tech) => (
                <div
                  key={tech.id}
                  className={`bg-white border-2 rounded-lg p-6 transition-all duration-200 ${
                    formData.urgency === 'emergenza' ? 'border-red-600' :
                    formData.selectedTechnician === tech.id ? 'border-[#1D9E75] bg-[#1D9E75]/5 shadow-md' : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-16 h-16 rounded-full flex items-center justify-center border-2 border-slate-200 overflow-hidden bg-[#0A2342] shrink-0">
                        {tech.avatar_url
                          ? <img src={tech.avatar_url} alt={tech.name} className="w-full h-full object-cover" />
                          : <span className="text-white text-xl font-bold">{tech.name.charAt(0)}</span>
                        }
                      </div>
                      <div>
                        <h3 className="text-xl font-semibold text-[#0A2342]">{tech.name}</h3>
                        <div className="flex items-center gap-3 text-sm text-slate-600 mt-1 flex-wrap">
                          <span className="font-medium">
                            {(() => {
                              const matchedSpec = tech.specializations?.find(
                                s => s === formData.categoryId
                              );
                              if (matchedSpec) return getCategoryLabel(matchedSpec);
                              return getCategoryLabel(tech.specialization);
                            })()}
                          </span>
                          <span className="flex items-center gap-1">
                            <MapPin className="w-4 h-4" />
                            {tech.location}{tech.distance_km != null ? ` · ${tech.distance_km} km` : ''}
                          </span>
                          {tech.rating > 0 && (
                            <span className="flex items-center gap-1 font-medium text-amber-600">
                              <Star className="w-4 h-4 fill-amber-400" />
                              {tech.rating}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    {formData.urgency === 'emergenza' ? (
                      <Button onClick={() => setFormData({ ...formData, selectedTechnician: tech.id })} className="bg-red-600 hover:bg-red-700 text-white px-6 h-11 animate-pulse">
                        DISPONIBILE ORA?
                      </Button>
                    ) : (
                      <Button
                        onClick={() => setFormData({ ...formData, selectedTechnician: tech.id })}
                        className={`px-6 h-11 font-medium transition-all ${
                          formData.selectedTechnician === tech.id
                            ? 'bg-[#1D9E75] hover:bg-[#1D9E75]/90 text-white'
                            : 'bg-white border-2 border-[#1D9E75] text-[#1D9E75] hover:bg-[#1D9E75]/10'
                        }`}
                      >
                        {formData.selectedTechnician === tech.id ? <><CheckCircle className="w-4 h-4 mr-2" />Selezionato</> : 'Seleziona'}
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <div className="flex gap-3 mt-8">
              <Button onClick={handleBack} variant="outline" className="flex-1">
                <ArrowLeft className="w-4 h-4 mr-2" />Indietro
              </Button>
              <Button 
                onClick={() => setStep(5)} 
                disabled={!formData.selectedTechnician} 
                className="flex-1 bg-[#168966] hover:bg-[#137557] text-white disabled:opacity-50"
              >
                Avanti<ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </div>
        )}

        {/* Step 5 */}
        {step === 5 && (
          <div className="text-center">
            <div className="w-20 h-20 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle className="w-12 h-12 text-green-600" />
            </div>
            <h2 className="text-3xl font-bold text-[#0A2342] mb-3">Conferma richiesta</h2>
            <p className="text-lg text-slate-600 mb-8">Sei pronto a creare il ticket?</p>
            <div className="bg-white border border-slate-200 rounded-lg p-8 mb-8">
              <div className="space-y-4 text-left">
                <div><span className="text-sm text-slate-600">Categoria</span><p className="font-semibold text-[#0A2342]">{formData.category}</p></div>
                <div><span className="text-sm text-slate-600">Tecnico selezionato</span><p className="font-semibold text-[#0A2342]">{technicians.find(t => t.id === formData.selectedTechnician)?.name}</p></div>
                <div><span className="text-sm text-slate-600">Località</span><p className="font-semibold text-[#0A2342]">{formData.marina}</p></div>
                <div>
                  <span className="text-sm text-slate-600">Urgenza</span>
                  <p className={`font-semibold ${formData.urgency === 'emergenza' ? 'text-red-600' : 'text-[#0A2342]'}`}>
                    {formData.urgency === 'emergenza' ? 'EMERGENZA' : formData.urgency === 'urgente' ? 'Urgente (4h)' : 'Normale (48h)'}
                  </p>
                </div>
              </div>
            </div>
            <div className="flex gap-3">
              <Button onClick={handleBack} variant="outline" className="flex-1">
                <ArrowLeft className="w-4 h-4 mr-2" />Indietro
              </Button>
              <Button onClick={handleCreateTicket} disabled={loading} className="flex-1 bg-[#1D9E75] hover:bg-[#1D9E75]/90 text-lg h-14">
                {loading ? 'Creazione in corso...' : 'Crea Ticket'}
              </Button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default RequestIntervention;
