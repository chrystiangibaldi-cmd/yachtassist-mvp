import React, { useContext, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';
import { UserContext, API } from '@/App';
import { Button } from '@/components/ui/button';
import { Anchor, ArrowLeft, CheckCircle, FileText, Calendar, Euro, MapPin, Send, Plus, Trash2, Upload, X } from 'lucide-react';

const TechnicianTicketDetail = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const { user } = useContext(UserContext);
  const [ticket, setTicket] = useState(null);
  const [yacht, setYacht] = useState(null);

  // Preventivo form state
  const [quoteRows, setQuoteRows] = useState([{ voce: '', descrizione: '', importo: '' }]);
  const [quoteNotes, setQuoteNotes] = useState('');
  const [submittingQuote, setSubmittingQuote] = useState(false);
  const [quoteError, setQuoteError] = useState('');
  const [quoteSuccess, setQuoteSuccess] = useState(false);
  const [quotePdf, setQuotePdf] = useState(null); // { name, data (base64) }

  useEffect(() => {
    fetchData();
  }, [id]);

  const fetchData = async () => {
    try {
      const ticketRes = await axios.get(`${API}/tickets/${id}`);
      const ticketData = ticketRes.data;
      setTicket(ticketData);

      if (ticketData.yacht_id && ticketData.yacht_id !== 'pending') {
        try {
          const yachtRes = await axios.get(`${API}/yachts/${ticketData.yacht_id}`);
          setYacht(yachtRes.data);
        } catch {
          setYacht(null);
        }
      }
    } catch (error) {
      console.error('Error fetching ticket:', error);
    }
  };

  const getStatusBadge = (status) => {
    const badges = {
      'aperto': 'bg-blue-50 text-blue-700 border-blue-200',
      'assegnato': 'bg-amber-50 text-amber-700 border-amber-200',
      'accettato': 'bg-purple-50 text-purple-700 border-purple-200',
      'eseguito': 'bg-green-50 text-green-700 border-green-200',
      'chiuso': 'bg-slate-100 text-slate-700 border-slate-300',
    };
    return (
      <span className={`px-3 py-1 border rounded-full text-sm font-medium ${badges[status] || ''}`}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  // Quote row handlers
  const addQuoteRow = () => {
    setQuoteRows([...quoteRows, { voce: '', descrizione: '', importo: '' }]);
  };

  const removeQuoteRow = (idx) => {
    if (quoteRows.length === 1) return;
    setQuoteRows(quoteRows.filter((_, i) => i !== idx));
  };

  const updateQuoteRow = (idx, field, value) => {
    const updated = [...quoteRows];
    updated[idx] = { ...updated[idx], [field]: value };
    setQuoteRows(updated);
  };

  const quoteTotal = quoteRows.reduce((sum, row) => sum + (parseFloat(row.importo) || 0), 0);

  const handlePdfChange = (e) => {
    setQuoteError('');
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type !== 'application/pdf') {
      setQuoteError('Il file deve essere in formato PDF');
      e.target.value = '';
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setQuoteError('Il PDF non può superare i 5 MB');
      e.target.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setQuotePdf({ name: file.name, data: reader.result });
    };
    reader.onerror = () => {
      setQuoteError('Errore nella lettura del file');
    };
    reader.readAsDataURL(file);
  };

  const removePdf = () => {
    setQuotePdf(null);
  };

  const handleSubmitQuote = async () => {
    setQuoteError('');
    const validRows = quoteRows.filter(r => r.voce.trim() && r.importo);
    if (validRows.length === 0) {
      setQuoteError('Inserisci almeno una voce con importo');
      return;
    }
    for (const row of validRows) {
      if (parseFloat(row.importo) <= 0) {
        setQuoteError('Tutti gli importi devono essere maggiori di zero');
        return;
      }
    }

    setSubmittingQuote(true);
    try {
      await axios.post(`${API}/tickets/${id}/preventivo`, {
        items: validRows.map(r => ({
          voce: r.voce.trim(),
          descrizione: r.descrizione.trim(),
          importo: Math.round(parseFloat(r.importo))
        })),
        note: quoteNotes.trim() || null,
        preventivo_pdf: quotePdf ? { name: quotePdf.name, data: quotePdf.data } : null
      });
      setQuoteSuccess(true);
      await fetchData();
    } catch (err) {
      setQuoteError(err.response?.data?.detail || 'Errore nell\'invio del preventivo');
    } finally {
      setSubmittingQuote(false);
    }
  };

  const handleCloseIntervention = async () => {
    try {
      await axios.post(`${API}/tickets/${id}/close`, {
        documents: ['Fattura.pdf', 'Foto_intervento.jpg', 'Cert_omologazione.pdf']
      });
      await fetchData();
      navigate('/technician/dashboard');
    } catch (error) {
      console.error('Error closing ticket:', error);
    }
  };

  if (!ticket) {
    return <div className="min-h-screen flex items-center justify-center">Caricamento...</div>;
  }

  const hasQuote = ticket.quote_items && ticket.quote_items.length > 0;

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10 shadow-sm">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#0A2342] rounded-lg flex items-center justify-center">
              <Anchor className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-[#0A2342]">YachtAssist</h1>
          </div>
          <Button
            onClick={() => navigate('/technician/dashboard')}
            variant="outline"
            className="border-slate-200 hover:bg-slate-50"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Dashboard
          </Button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8">
        {/* Title + Status */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-3xl font-bold text-[#0A2342] mb-1">Ticket {ticket.id}</h2>
            {yacht && <p className="text-lg text-slate-600">{yacht.name} ({yacht.model})</p>}
          </div>
          {getStatusBadge(ticket.status)}
        </div>

        {/* Dettagli ticket */}
        <div className="bg-white border border-slate-200 rounded-lg shadow-sm p-6 mb-6">
          <h3 className="text-lg font-semibold text-[#0A2342] mb-4">Dettagli intervento</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {ticket.category && (
              <div>
                <span className="text-sm text-slate-500 font-medium">Categoria</span>
                <p className="text-[#0A2342] font-medium">{ticket.category}</p>
              </div>
            )}
            {ticket.urgency && (
              <div>
                <span className="text-sm text-slate-500 font-medium">Urgenza</span>
                <p className={`font-medium ${ticket.urgency === 'alta' || ticket.urgency === 'emergenza' ? 'text-red-600' : 'text-[#0A2342]'}`}>
                  {ticket.urgency.charAt(0).toUpperCase() + ticket.urgency.slice(1)}
                  {ticket.urgency === 'alta' && ' ⚠️'}
                  {ticket.urgency === 'emergenza' && ' 🚨'}
                </p>
              </div>
            )}
            <div>
              <span className="text-sm text-slate-500 font-medium flex items-center gap-1">
                <MapPin className="w-3 h-3" /> Porto
              </span>
              <p className="text-[#0A2342] font-medium">{ticket.marina}</p>
            </div>
            {ticket.appointment && (
              <div>
                <span className="text-sm text-slate-500 font-medium flex items-center gap-1">
                  <Calendar className="w-3 h-3" /> Appuntamento
                </span>
                <p className="text-[#0A2342] font-medium">{ticket.appointment}</p>
              </div>
            )}
          </div>
          {ticket.description && (
            <div className="mt-4 pt-4 border-t border-slate-100">
              <span className="text-sm text-slate-500 font-medium">Descrizione</span>
              <p className="text-slate-700 mt-1">{ticket.description}</p>
            </div>
          )}
          {ticket.work_items && ticket.work_items.length > 0 && (
            <div className="mt-4 pt-4 border-t border-slate-100">
              <span className="text-sm text-slate-500 font-medium">Lavori richiesti</span>
              <div className="mt-2 space-y-1">
                {ticket.work_items.map((item, idx) => (
                  <div key={idx} className="flex items-center gap-2 text-slate-700">
                    <span className="w-1.5 h-1.5 bg-[#1D9E75] rounded-full shrink-0" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {yacht && (
            <div className="mt-4 pt-4 border-t border-slate-100">
              <span className="text-sm text-slate-500 font-medium">Imbarcazione</span>
              <p className="text-[#0A2342] font-medium">{yacht.name} &mdash; {yacht.model}</p>
            </div>
          )}
        </div>

        {/* Preventivo esistente */}
        {hasQuote && (
          <div className="bg-white border border-slate-200 rounded-lg shadow-sm p-6 mb-6">
            <h3 className="text-lg font-semibold text-[#0A2342] mb-4 flex items-center gap-2">
              <Euro className="w-5 h-5 text-[#1D9E75]" />
              Preventivo inviato
            </h3>
            <table className="w-full">
              <thead>
                <tr className="border-b-2 border-slate-300">
                  <th className="text-left py-3 px-2 text-sm font-semibold text-[#0A2342]">Voce</th>
                  <th className="text-left py-3 px-2 text-sm font-semibold text-[#0A2342]">Descrizione</th>
                  <th className="text-right py-3 px-2 text-sm font-semibold text-[#0A2342]">Importo</th>
                </tr>
              </thead>
              <tbody>
                {ticket.quote_items.map((item, idx) => (
                  <tr key={idx} className="border-b border-slate-100">
                    <td className="py-3 px-2 text-sm text-slate-700 font-medium">{item.voce}</td>
                    <td className="py-3 px-2 text-sm text-slate-600">{item.descrizione}</td>
                    <td className="py-3 px-2 text-sm text-slate-700 text-right font-medium">€{item.importo}</td>
                  </tr>
                ))}
                <tr className="border-t-2 border-[#0A2342]">
                  <td colSpan={2} className="py-4 px-2 text-lg font-bold text-[#0A2342]">Totale</td>
                  <td className="py-4 px-2 text-lg font-bold text-[#0A2342] text-right">
                    €{ticket.quote_items.reduce((s, i) => s + i.importo, 0)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}

        {/* Form preventivo (solo se non ancora inviato e ticket assegnato) */}
        {!hasQuote && !quoteSuccess && ticket.status === 'assegnato' && (
          <div className="bg-white border-2 border-[#1D9E75] rounded-lg shadow-sm p-6 mb-6">
            <h3 className="text-lg font-semibold text-[#0A2342] mb-4 flex items-center gap-2">
              <Euro className="w-5 h-5 text-[#1D9E75]" />
              Inserisci preventivo
            </h3>

            <div className="space-y-3 mb-4">
              {quoteRows.map((row, idx) => (
                <div key={idx} className="flex gap-3 items-start">
                  <div className="flex-1">
                    <label className="block text-xs font-medium text-slate-500 mb-1">
                      Voce {idx + 1}
                    </label>
                    <input
                      type="text"
                      value={row.voce}
                      onChange={(e) => updateQuoteRow(idx, 'voce', e.target.value)}
                      placeholder="es. Sostituzione filtro olio"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1D9E75]"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="block text-xs font-medium text-slate-500 mb-1">Descrizione</label>
                    <input
                      type="text"
                      value={row.descrizione}
                      onChange={(e) => updateQuoteRow(idx, 'descrizione', e.target.value)}
                      placeholder="Dettagli opzionali"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1D9E75]"
                    />
                  </div>
                  <div className="w-28">
                    <label className="block text-xs font-medium text-slate-500 mb-1">Importo (€)</label>
                    <input
                      type="number"
                      min="0"
                      value={row.importo}
                      onChange={(e) => updateQuoteRow(idx, 'importo', e.target.value)}
                      placeholder="0"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1D9E75]"
                    />
                  </div>
                  <button
                    onClick={() => removeQuoteRow(idx)}
                    disabled={quoteRows.length === 1}
                    className="mt-5 p-2 text-slate-400 hover:text-red-500 disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>

            <button
              onClick={addQuoteRow}
              className="flex items-center gap-1 text-sm text-[#1D9E75] font-medium hover:text-[#1D9E75]/80 mb-4"
            >
              <Plus className="w-4 h-4" /> Aggiungi voce
            </button>

            <div className="bg-slate-50 rounded-lg p-3 mb-4 flex justify-between items-center">
              <span className="text-sm font-medium text-slate-600">Totale preventivo</span>
              <span className="text-xl font-bold text-[#0A2342]">€{quoteTotal}</span>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-500 mb-1">Note (opzionale)</label>
              <textarea
                value={quoteNotes}
                onChange={(e) => setQuoteNotes(e.target.value)}
                placeholder="Note aggiuntive per l'armatore..."
                rows={2}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1D9E75] resize-none"
              />
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-500 mb-1">
                Allega preventivo in PDF (opzionale, max 5MB)
              </label>
              {!quotePdf ? (
                <label className="flex items-center gap-2 px-4 py-3 border-2 border-dashed border-slate-300 rounded-lg text-sm text-slate-600 cursor-pointer hover:border-[#1D9E75] hover:text-[#1D9E75] transition-colors">
                  <Upload className="w-4 h-4" />
                  <span>Seleziona un file PDF</span>
                  <input
                    type="file"
                    accept="application/pdf"
                    onChange={handlePdfChange}
                    className="hidden"
                  />
                </label>
              ) : (
                <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border border-slate-200 rounded-lg">
                  <div className="flex items-center gap-2 min-w-0">
                    <FileText className="w-4 h-4 text-[#1D9E75] shrink-0" />
                    <span className="text-sm text-slate-700 truncate">{quotePdf.name}</span>
                  </div>
                  <button
                    type="button"
                    onClick={removePdf}
                    className="p-1 text-slate-400 hover:text-red-500 shrink-0"
                    aria-label="Rimuovi PDF"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>

            {quoteError && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
                <p className="text-red-600 text-sm">{quoteError}</p>
              </div>
            )}

            <Button
              onClick={handleSubmitQuote}
              disabled={submittingQuote}
              className="w-full bg-[#1D9E75] hover:bg-[#1D9E75]/90 text-white font-medium h-12"
            >
              {submittingQuote ? (
                'Invio in corso...'
              ) : (
                <>
                  <Send className="w-4 h-4 mr-2" />
                  Invia Preventivo
                </>
              )}
            </Button>
          </div>
        )}

        {/* Success message after quote submission */}
        {quoteSuccess && !hasQuote && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-6 mb-6 text-center">
            <CheckCircle className="w-10 h-10 text-green-600 mx-auto mb-2" />
            <p className="text-green-800 font-semibold">Preventivo inviato con successo!</p>
            <p className="text-green-600 text-sm mt-1">L'armatore riceverà una notifica via email.</p>
          </div>
        )}

        {/* Riepilogo finanziario */}
        {ticket.final_price && (
          <div className="bg-slate-50 border border-slate-200 rounded-lg shadow-sm p-6 mb-6">
            <h3 className="text-lg font-semibold text-[#0A2342] mb-4">Riepilogo finanziario</h3>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-slate-700">
                <span>Importo intervento:</span>
                <span className="font-semibold">€{ticket.final_price}</span>
              </div>
              <div className="flex items-center justify-between text-slate-600 text-sm">
                <span>Commissione YachtAssist ({ticket.final_price ? Math.round((ticket.commission / ticket.final_price) * 100) : 0}%):</span>
                <span>€{ticket.commission}</span>
              </div>
              <div className="border-t border-slate-300 pt-2 mt-2">
                <div className="flex items-center justify-between text-[#1D9E75] font-bold text-lg">
                  <span>Pagamento a te:</span>
                  <span>€{ticket.technician_payment}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Documenti */}
        {ticket.documents && ticket.documents.length > 0 && (
          <div className="bg-white border border-slate-200 rounded-lg shadow-sm p-6 mb-6">
            <h3 className="text-lg font-semibold text-[#0A2342] mb-4">Documenti</h3>
            <div className="space-y-2">
              {ticket.documents.map((doc, idx) => (
                <div key={idx} className="flex items-center gap-3 p-3 bg-slate-50 border border-slate-200 rounded-lg">
                  <FileText className="w-5 h-5 text-[#1D9E75]" />
                  <span className="text-slate-700">{doc}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Chiudi Intervento */}
        {ticket.status === 'assegnato' && (
          <Button
            data-testid="close-intervention-button"
            onClick={handleCloseIntervention}
            className="w-full h-14 bg-[#0A2342] hover:bg-[#0A2342]/90 text-white text-lg font-medium rounded-lg shadow-md hover:shadow-lg transition-all duration-200"
          >
            <CheckCircle className="w-5 h-5 mr-2" />
            Chiudi Intervento
          </Button>
        )}

        {/* Ticket chiuso */}
        {ticket.status === 'chiuso' && (
          <div className="bg-green-50 border-2 border-green-500 rounded-lg p-6 text-center">
            <CheckCircle className="w-12 h-12 text-green-600 mx-auto mb-3" />
            <h3 className="text-xl font-semibold text-green-800">Intervento completato</h3>
            <p className="text-green-700 mt-2">Ticket chiuso con successo</p>
          </div>
        )}
      </main>
    </div>
  );
};

export default TechnicianTicketDetail;
