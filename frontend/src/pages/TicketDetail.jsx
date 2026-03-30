import React, { useContext, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';
import { API, UserContext } from '@/App';
import { Button } from '@/components/ui/button';
import { Anchor, ArrowLeft, CheckCircle, FileText, Calendar, Star, Award, CreditCard, Lock, Upload, Paperclip } from 'lucide-react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';

const stripePromise = loadStripe('pk_test_51RtUo8Cq3C8e7g9xhNW8lANL74jpfwhANr6YDUwGfv96NzCoJwFYhwAXBOtot4rESSM4Mmhq4qlELP72FocRjs5K00tNGeqaBI');

const PaymentForm = ({ ticket, onSuccess, onCancel }) => {
  const stripe = useStripe();
  const elements = useElements();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [clientSecret, setClientSecret] = useState(null);
  const [paymentData, setPaymentData] = useState(null);

  useEffect(() => {
    const createIntent = async () => {
      try {
        const res = await axios.post(
          `${process.env.REACT_APP_BACKEND_URL}/payments/create-intent?ticket_id=${ticket.id}`
        );
        setClientSecret(res.data.client_secret);
        setPaymentData(res.data);
      } catch (err) {
        setError('Errore nella creazione del pagamento. Riprova.');
      }
    };
    createIntent();
  }, [ticket.id]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!stripe || !elements || !clientSecret) return;

    setLoading(true);
    setError(null);

    const { error: stripeError, paymentIntent } = await stripe.confirmCardPayment(clientSecret, {
      payment_method: {
        card: elements.getElement(CardElement),
      },
    });

    if (stripeError) {
      setError(stripeError.message);
      setLoading(false);
    } else if (paymentIntent.status === 'succeeded') {
      onSuccess();
    }
  };

  const cardStyle = {
    style: {
      base: {
        fontSize: '16px',
        color: '#0A2342',
        fontFamily: 'Inter, sans-serif',
        '::placeholder': { color: '#94a3b8' },
      },
      invalid: { color: '#ef4444' },
    },
  };

  return (
    <div className="bg-white border-2 border-[#1D9E75] rounded-lg shadow-sm p-6 mb-6">
      <div className="flex items-center gap-2 mb-4">
        <CreditCard className="w-5 h-5 text-[#1D9E75]" />
        <h3 className="text-lg font-semibold text-[#0A2342]">Pagamento intervento</h3>
      </div>

      {paymentData && (
        <div className="bg-slate-50 rounded-lg p-4 mb-4 space-y-1">
          <div className="flex justify-between text-sm text-slate-600">
            <span>Importo totale:</span>
            <span className="font-semibold text-[#0A2342]">€{paymentData.amount}</span>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="border border-slate-200 rounded-lg p-4 mb-4 bg-slate-50">
          {clientSecret ? (
            <CardElement options={cardStyle} />
          ) : (
            <p className="text-slate-400 text-sm">Caricamento...</p>
          )}
        </div>

        <p className="text-xs text-slate-400 mb-4 flex items-center gap-1">
          <Lock className="w-3 h-3" />
          Pagamento sicuro via Stripe · Carta test: 4242 4242 4242 4242
        </p>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
            <p className="text-red-600 text-sm">{error}</p>
          </div>
        )}

        <div className="flex gap-3">
          <Button
            type="button"
            onClick={onCancel}
            variant="outline"
            className="flex-1 border-slate-200"
            disabled={loading}
          >
            Annulla
          </Button>
          <Button
            type="submit"
            disabled={!stripe || !clientSecret || loading}
            className="flex-1 bg-[#1D9E75] hover:bg-[#1D9E75]/90 text-white"
          >
            {loading ? 'Elaborazione...' : `Paga €${paymentData?.amount || ''}`}
          </Button>
        </div>
      </form>
    </div>
  );
};

const TicketDetail = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const { user } = useContext(UserContext);
  const [ticket, setTicket] = useState(null);
  const [yacht, setYacht] = useState(null);
  const [technician, setTechnician] = useState(null);
  const [showPayment, setShowPayment] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [uploading, setUploading] = useState(false);
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
          const dashboardRes = await axios.get(`${API}/dashboard/owner?user_id=${ticketData.owner_id}`);
          setYacht(dashboardRes.data.yacht);
        }
      } else {
        const dashboardRes = await axios.get(`${API}/dashboard/owner?user_id=${ticketData.owner_id}`);
        setYacht(dashboardRes.data.yacht);
      }

      if (ticketData.technician_id) {
        const techsRes = await axios.get(`${API}/technicians/available`);
        const tech = techsRes.data.find(t => t.id === ticketData.technician_id);
        setTechnician(tech);
      }
    } catch (error) {
      console.error('Error fetching ticket:', error);
    }
  };

  const handlePaymentSuccess = async () => {
    setShowPayment(false);
    await new Promise(r => setTimeout(r, 1500));
    await fetchData();
    navigate('/owner/dashboard');
  };
const handleAddAttachments = async (files) => {
    const tooBig = files.filter(f => f.size > 2 * 1024 * 1024);
    if (tooBig.length > 0) {
      setUploadError(`File troppo grandi (max 2MB): ${tooBig.map(f => f.name).join(', ')}`);
      return;
    }
    const currentPhotos = ticket.photos || [];
    if (currentPhotos.length + files.length > 5) {
      setUploadError('Puoi caricare massimo 5 allegati per ticket');
      return;
    }
    setUploadError('');
    setUploading(true);
    try {
      const base64files = await Promise.all(files.map(file => new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve({ name: file.name, type: file.type, data: reader.result });
        reader.readAsDataURL(file);
      })));
      await axios.post(`${API}/tickets/${id}/add-photos`, {
        photos: base64files
      });
      await fetchData();
    } catch (err) {
      setUploadError('Errore durante il caricamento. Riprova.');
    } finally {
      setUploading(false);
    }
  };
  const handleCloseTechnician = async () => {
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

  if (!ticket || !yacht) {
    return <div className="min-h-screen flex items-center justify-center">Caricamento...</div>;
  }

  const getStatusSteps = () => {
    const steps = ['aperto', 'assegnato', 'accettato', 'eseguito', 'chiuso'];
    const currentIndex = steps.indexOf(ticket.status);
    return steps.map((step, idx) => ({
      name: step.charAt(0).toUpperCase() + step.slice(1),
      completed: idx <= currentIndex
    }));
  };

  const statusSteps = getStatusSteps();

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10 shadow-sm">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#0A2342] rounded-lg flex items-center justify-center">
              <Anchor className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-[#0A2342]">YachtAssist</h1>
          </div>
          <Button
            onClick={() => navigate(user.role === 'owner' ? '/owner/dashboard' : '/technician/dashboard')}
            variant="outline"
            className="border-slate-200 hover:bg-slate-50"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Dashboard
          </Button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8">
        <div className="mb-6">
          <h2 className="text-3xl font-bold text-[#0A2342] mb-2">Ticket {ticket.id}</h2>
          <p className="text-lg text-slate-600">{yacht.name} ({yacht.model})</p>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg shadow-sm p-8 mb-6">
          <h3 className="text-lg font-semibold text-[#0A2342] mb-6">Stato ticket</h3>
          <div className="flex items-center justify-between">
            {statusSteps.map((step, idx) => (
              <React.Fragment key={step.name}>
                <div className="flex flex-col items-center">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold transition-all ${step.completed ? 'bg-[#1D9E75] text-white' : 'bg-slate-200 text-slate-400'}`}>
                    {step.completed ? '✓' : '○'}
                  </div>
                  <span className={`text-xs mt-2 font-medium ${step.completed ? 'text-[#0A2342]' : 'text-slate-400'}`}>
                    {step.name}
                  </span>
                </div>
                {idx < statusSteps.length - 1 && (
                  <div className={`flex-1 h-1 mx-2 rounded ${step.completed ? 'bg-[#1D9E75]' : 'bg-slate-200'}`}></div>
                )}
              </React.Fragment>
            ))}
          </div>
        </div>

        {ticket.technician_id && technician && (
          <div className="bg-white border border-slate-200 rounded-lg shadow-sm p-6 mb-6">
            <h3 className="text-lg font-semibold text-[#0A2342] mb-4">Informazioni intervento</h3>
            <div className="flex items-center gap-4 mb-6 pb-6 border-b border-slate-200">
              <img
                src={technician.avatar_url || 'https://via.placeholder.com/60'}
                alt={technician.name}
                className="w-16 h-16 rounded-full object-cover border-2 border-slate-200"
              />
              <div>
                <h4 className="text-xl font-semibold text-[#0A2342] mb-1">{technician.name}</h4>
                <div className="flex items-center gap-3 text-sm text-slate-600">
                  <span className="flex items-center gap-1 font-medium text-amber-600">
                    <Star className="w-4 h-4 fill-amber-400" />
                    {technician.rating}
                  </span>
                  {technician.eco_certified && (
                    <span className="flex items-center gap-1 px-2 py-0.5 bg-green-50 text-green-700 border border-green-200 rounded-md font-medium text-xs">
                      <Award className="w-3 h-3" />
                      Eco Certified
                    </span>
                  )}
                </div>
              </div>
            </div>
            {ticket.appointment && (
              <div className="flex items-center gap-2 mb-4 text-slate-700">
                <Calendar className="w-5 h-5 text-[#1D9E75]" />
                <span className="font-medium">Appuntamento:</span>
                <span>{ticket.appointment}</span>
              </div>
            )}
            <div className="mb-4">
              <h4 className="text-sm font-semibold text-[#0A2342] mb-2">Lavori:</h4>
              <div className="space-y-2">
                {ticket.work_items.map((item, idx) => (
                  <div key={idx} className="flex items-center gap-2 text-slate-700">
                    {ticket.status === 'chiuso' ? (
                      <CheckCircle className="w-5 h-5 text-green-600" />
                    ) : (
                      <span className="w-5 h-5 rounded-full border-2 border-slate-300"></span>
                    )}
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {ticket.quote_items && ticket.quote_items.length > 0 ? (
          <div className="bg-white border border-slate-200 rounded-lg shadow-sm p-6 mb-6">
            <h3 className="text-lg font-semibold text-[#0A2342] mb-4">Dettaglio preventivo</h3>
            <table className="w-full">
              <thead>
                <tr className="border-b-2 border-slate-300">
                  <th className="text-left py-3 px-2 text-sm font-semibold text-[#0A2342]">Voce</th>
                  <th className="text-right py-3 px-2 text-sm font-semibold text-[#0A2342]">Importo</th>
                </tr>
              </thead>
              <tbody>
                {ticket.quote_items.map((item, idx) => (
                  <tr key={idx} className="border-b border-slate-100">
                    <td className="py-3 px-2 text-sm text-slate-700">{item.voce}</td>
                    <td className="py-3 px-2 text-sm text-slate-700 text-right font-medium">€{item.importo}</td>
                  </tr>
                ))}
                <tr className="border-t-2 border-[#0A2342]">
                  <td className="py-4 px-2 text-lg font-bold text-[#0A2342]">Totale</td>
                  <td className="py-4 px-2 text-lg font-bold text-[#0A2342] text-right">€{ticket.final_price}</td>
                </tr>
              </tbody>
            </table>
          </div>
        ) : (
          <div className="bg-amber-50 border border-amber-200 rounded-lg shadow-sm p-6 mb-6">
            <h3 className="text-lg font-semibold text-[#0A2342] mb-2">Dettaglio preventivo</h3>
            <p className="text-amber-700 text-sm">In attesa del preventivo del tecnico</p>
          </div>
        )}

        {ticket.final_price && (
          <div className="bg-slate-50 border border-slate-200 rounded-lg shadow-sm p-6 mb-6">
            <h3 className="text-lg font-semibold text-[#0A2342] mb-4">Riepilogo finanziario</h3>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-slate-700">
                <span>Importo intervento:</span>
                <span className="font-semibold">€{ticket.final_price}</span>
              </div>
              {user.role === 'technician' && (
                <>
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
                </>
              )}
            </div>
          </div>
        )}
{/* Allegati ticket */}
        <div className="bg-white border border-slate-200 rounded-lg shadow-sm p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-[#0A2342] flex items-center gap-2">
              <Paperclip className="w-5 h-5" />
              Allegati
            </h3>
            {ticket.status !== 'chiuso' && (
              <label className="flex items-center gap-2 text-sm text-[#1D9E75] font-medium cursor-pointer hover:text-[#1D9E75]/80">
                <Upload className="w-4 h-4" />
                Aggiungi file
                <input
                  type="file"
                  multiple
                  accept="image/jpeg,image/png,application/pdf"
                  className="hidden"
                  onChange={(e) => handleAddAttachments(Array.from(e.target.files))}
                />
              </label>
            )}
          </div>

          {uploadError && (
            <p className="text-red-500 text-sm mb-3">{uploadError}</p>
          )}
          {uploading && (
            <p className="text-slate-400 text-sm mb-3">Caricamento in corso...</p>
          )}

          {ticket.photos && ticket.photos.length > 0 ? (
            <div className="space-y-2">
              {ticket.photos.map((file, idx) => (
                <div key={idx} className="flex items-center gap-3 p-3 bg-slate-50 border border-slate-200 rounded-lg">
                  {file.type === 'application/pdf' ? (
                    <FileText className="w-8 h-8 text-[#1D9E75] shrink-0" />
                  ) : (
                    <img src={file.data} alt={file.name} className="w-10 h-10 object-cover rounded border border-slate-200 shrink-0" />
                  )}
                  <span className="text-sm text-slate-700 truncate">{file.name}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-slate-400 text-sm">Nessun allegato caricato</p>
          )}
        </div>
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

        {ticket.status === 'assegnato' && user.role === 'owner' && showPayment && (
          <Elements stripe={stripePromise}>
            <PaymentForm
              ticket={ticket}
              onSuccess={handlePaymentSuccess}
              onCancel={() => setShowPayment(false)}
            />
          </Elements>
        )}
{ticket.status === 'assegnato' && user.role === 'owner' && !showPayment && (
  <div className="bg-amber-50 border border-amber-300 rounded-lg p-4 mb-4 flex items-center gap-3">
    <span className="text-2xl">🧪</span>
    <div>
      <p className="text-amber-800 font-semibold text-sm">Modalità test attiva</p>
      <p className="text-amber-700 text-sm">Nessun addebito reale. Usa carta test: <span className="font-mono font-bold">4242 4242 4242 4242</span></p>
    </div>
  </div>
)}
        {ticket.status === 'assegnato' && user.role === 'owner' && !showPayment && (
          <Button
            data-testid="close-ticket-button"
            onClick={() => setShowPayment(true)}
            className="w-full h-14 bg-[#1D9E75] hover:bg-[#1D9E75]/90 text-white text-lg font-medium rounded-lg shadow-md hover:shadow-lg transition-all duration-200"
          >
            <CreditCard className="w-5 h-5 mr-2" />
            Paga e Chiudi Ticket · €{ticket.final_price}
          </Button>
        )}

        {ticket.status === 'assegnato' && user.role === 'technician' && (
          <Button
            data-testid="close-intervention-button"
            onClick={handleCloseTechnician}
            className="w-full h-14 bg-[#1D9E75] hover:bg-[#1D9E75]/90 text-white text-lg font-medium rounded-lg shadow-md hover:shadow-lg transition-all duration-200"
          >
            <CheckCircle className="w-5 h-5 mr-2" />
            Chiudi Intervento
          </Button>
        )}

        {ticket.status === 'chiuso' && (
          <div className="bg-green-50 border-2 border-green-500 rounded-lg p-6 text-center">
            <CheckCircle className="w-12 h-12 text-green-600 mx-auto mb-3" />
            <h3 className="text-xl font-semibold text-green-800">Ticket chiuso con successo</h3>
            <p className="text-green-700 mt-2">Intervento completato e pagamento ricevuto</p>
          </div>
        )}
      </main>
    </div>
  );
};

export default TicketDetail;
