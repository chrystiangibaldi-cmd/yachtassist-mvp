// v3.0 - 20 categories
import React, { useState, useContext, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { UserContext } from '@/App';
import { Button } from '@/components/ui/button';
import { Anchor, ArrowLeft, ArrowRight, CheckCircle, Upload, MapPin, Star, AlertCircle, Sparkles } from 'lucide-react';

const BACKEND = "https://yachtassist-mvp-production.up.railway.app/api";

const RequestIntervention = () => {
  const navigate = useNavigate();
  const { user } = useContext(UserContext);
  
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    category: '',
    description: '',
    photos: [],
    urgency: 'normale',
    marina: 'Marina di Pisa',
    selectedTechnician: null
  });
  const [technicians, setTechnicians] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState(null);
  const [expandedCategory, setExpandedCategory] = useState(null);
  const [selectedSubcategories, setSelectedSubcategories] = useState([]);

  const categories = [
    { id: 'motore', icon: '⚙️', name: 'Motore & Propulsione', subcategories: ['Guasto/Avaria Motore - EB', 'Guasto/Avaria Motore - FB', 'Guasto/Avaria Motore - EFB', 'Guasto/Avaria Motore - IPS', 'Guasto/Avaria Motore - POD', 'Pezzi di ricambio', 'Tagliando Motore - ORD', 'Tagliando Motore - STR', 'Avaria/Guasto Generatore', 'Tagliando Generatore', 'Elica e asse', 'Piede poppiero', 'Fuoribordo'] },
    { id: 'elettrico', icon: '⚡', name: 'Elettrico & Elettronico', subcategories: ['Impianto elettrico - 12V', 'Impianto elettrico - 24V', 'Impianto elettrico - 220V', 'Impianto elettrico - 380V', 'Quadri elettrici', 'Test isolamento', 'Batterie e caricabatterie', 'Pannelli solari', 'Generatore', 'Luci di navigazione', 'Sostituzione batterie'] },
    { id: 'oleodinamica', icon: '🔩', name: 'Oleodinamica', subcategories: ['Passerella', 'Portelloni', 'Gru', 'Porte automatiche'] },
    { id: 'aria_condizionata', icon: '❄️', name: 'Aria Condizionata', subcategories: ['Compressori', 'Chiller', 'Fan coil', 'Coibentazione', 'Pompe acqua mare', 'Assistenza', 'Vendita', 'Installazione'] },
    { id: 'scafo', icon: '🛥️', name: 'Scafo & Struttura', subcategories: ['Riparazione vetroresina', 'Osmosi', 'Carena', 'Antivegetativa', 'Zinchi anodici', 'Siliconature/Sigillature', 'Smontaggi e rimontaggi', 'Tientibene / Mano rail'] },
    { id: 'coperta', icon: '⚓', name: 'Coperta & Attrezzatura', subcategories: ['Winch e manovre', 'Albero e sartiame', 'Vela e armo', 'Ancora e catena', 'Verricello', 'Bozzelli e carrelli', 'Registrazione portelli'] },
    { id: 'impianti', icon: '🔩', name: 'Impianti di Bordo', subcategories: ['Impianto idrico', 'Impianto gas', 'Impianto acque nere', 'Cucina / fornello', 'Frigorifero / congelatore', 'Riscaldamento', 'Dissalatore', 'WC marino', 'Autoclave'] },
    { id: 'navigazione', icon: '🧭', name: 'Navigazione & Strumentazione', subcategories: ['Chart plotter', 'Radar', 'Autopilota', 'Antenne', 'Dome', 'Starlink', 'GPS', 'VHF', 'AIS', 'EPIRB / MOB'] },
    { id: 'elettrodomestici', icon: '🍳', name: 'Elettrodomestici di Bordo', subcategories: ['Piano cottura', 'Forno', 'Lavastoviglie', 'Frigorifero', 'Fridger', 'Icemaker'] },
    { id: 'stabilizzatori', icon: '⚖️', name: 'Stabilizzatori', subcategories: ['Giroscopici Smartgyro', 'Giroscopici Seakeeper', 'Pinne CMC', 'Pinne Humphree'] },
    { id: 'tappezzeria', icon: '🧵', name: 'Tappezzeria & Tessuti', subcategories: ['Cuscini e cuscinerie', 'Rivestimenti interni', 'Moquette', 'Tendalini e capotte', 'Tende esterne', 'Biancheria bordo', 'Materassi', 'Riparazioni e cuciture'] },
    { id: 'lavaggi', icon: '🧼', name: 'Lavaggi & Pulizia', subcategories: ['Lavaggio esterno', 'Pulizia interna', 'Igienizzazione interna', 'Pulizia sentina', 'Lavaggio teak'] },
    { id: 'vetri', icon: '🔍', name: 'Vetri & Vetrate', subcategories: ['Sostituzione vetri', 'Riparazione vetri', 'Lucidatura vetri', 'Siliconatura / incollaggio', 'Sostituzione parabrezza', 'Realizzazione custom'] },
    { id: 'wrapping', icon: '🎨', name: 'Wrapping & Pellicole', subcategories: ['Wrapping esterno', 'Wrapping interno', 'Pellicola protettiva', 'Nano tecnologie', 'Pellicole vetri / oscuranti', 'Serigrafie'] },
    { id: 'spurghi', icon: '💧', name: 'Spurghi & Alta Pressione', subcategories: ['Spurghi e recupero acque nere', 'Lavaggio casse AN/AG', 'Flussaggio gasolio', 'Lavaggio alta pressione'] },
    { id: 'falegname', icon: '🛠️', name: 'Falegname & Carpentiere', subcategories: ['Lavorazioni teak', 'Lavorazioni interne in legno', 'Manufatti su misura', 'Installazione imbonaggi', 'Calafatura coperta', 'Pavimentazioni interne', 'Supporti alla tappezzeria'] },
    { id: 'idraulico', icon: '🔧', name: 'Idraulico & Tubista', subcategories: ['Ombrinali', 'Pompe alta e bassa pressione', 'Pressfitting', 'Cunipress', 'Multistrato', 'Prese a mare', 'Seacest / cestelli', 'Boiler', 'Autoclave', 'Coibentazione tubi'] },
    { id: 'verniciatore', icon: '🖌️', name: 'Verniciatore & Lucidatore', subcategories: ['Verniciatura gelcoat', 'Verniciatura smalto', 'Verniciatura vetroresina', 'Verniciatura metalli', 'Lucidatura gelcoat', 'Touch-up e ritocchi', 'Verniciatura interna legno', 'Pittore nome nave', 'Nano tecnologie'] },
    { id: 'lavanderia', icon: '👕', name: 'Lavanderia', subcategories: ['Pick-up biancheria', 'Roll-in / Roll-out', 'Lavaggio tappezzerie', 'Lavaggio moquettes'] },
    { id: 'emergenza', icon: '🚨', name: 'EMERGENZA', isEmergency: true, subcategories: [] },
];

  useEffect(() => {
    if (step === 4) {
      fetchTechnicians();
    }
  }, [step]);

  const fetchTechnicians = async () => {
    try {
      const categoryId = categories.find(c => c.name === formData.category)?.id;
      const url = categoryId
        ? `${BACKEND}/technicians/available?category=${categoryId}`
        : `${BACKEND}/technicians/available`;
      const response = await axios.get(url);
      setTechnicians(response.data);
    } catch (err) {
      console.error('Error fetching technicians:', err);
    }
  };

  const handleCategorySelect = (category) => {
    if (category.isEmergency) {
      setFormData(prev => ({ ...prev, category: category.name, urgency: 'emergenza' }));
      setStep(2);
      return;
    }
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
    setFormData(prev => ({ ...prev, category: expandedCategory.name + subLabel }));
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
        photos: formData.photos
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

  const selectedCategory = categories.find(c => c.name === formData.category);
  const isEmergency = selectedCategory?.isEmergency;
  const filteredTechnicians = isEmergency
    ? technicians
    : technicians; // ordinamento già fatto dal backend (specializzati prima, altri in fondo)

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
        <div key={cat.id} className={`${cat.isEmergency ? 'col-span-2' : ''} ${expandedCategory?.id === cat.id ? 'col-span-2' : ''}`}>
          <button
            onClick={() => handleCategorySelect(cat)}
            className={`w-full p-6 rounded-lg border-2 transition-all text-left ${
              cat.isEmergency
                ? 'border-red-600 bg-red-50 hover:bg-red-100 animate-pulse'
                : expandedCategory?.id === cat.id
                ? 'border-[#1D9E75] bg-[#1D9E75]/5'
                : 'border-slate-200 hover:border-[#1D9E75] hover:bg-slate-50'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <span className="text-4xl">{cat.icon}</span>
                <h3 className={`text-lg font-semibold ${cat.isEmergency ? 'text-red-700' : 'text-[#0A2342]'}`}>
                  {cat.name}
                </h3>
              </div>
              {!cat.isEmergency && (
                <span className="text-slate-400 text-xl">
                  {expandedCategory?.id === cat.id ? '▲' : '▼'}
                </span>
              )}
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

              {!isEmergency && (
                <div>
                  <label className="block text-sm font-medium text-[#0A2342] mb-3">Urgenza</label>
                  <div className="grid grid-cols-2 gap-4">
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
                  </div>
                </div>
              )}
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
                <input
                  type="text"
                  value={formData.marina}
                  onChange={(e) => setFormData({ ...formData, marina: e.target.value })}
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1D9E75]"
                />
              </div>
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
              {isEmergency ? 'Tecnici disponibili' : 'Seleziona un tecnico'}
            </h2>
            <p className="text-lg text-slate-600 mb-8">
              {isEmergency ? '🚨 Il primo tecnico che accetta prende il lavoro' : `Tecnici specializzati in ${formData.category}`}
            </p>
            <div className="space-y-4">
              {filteredTechnicians.map((tech) => (
                <div
                  key={tech.id}
                  className={`bg-white border-2 rounded-lg p-6 transition-all duration-200 ${
                    isEmergency ? 'border-red-600' :
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
                          <span className="font-medium">{tech.specialization}</span>
                          <span className="flex items-center gap-1">
                            <MapPin className="w-4 h-4" />
                            {tech.location} {tech.distance}
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
                    {isEmergency ? (
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
