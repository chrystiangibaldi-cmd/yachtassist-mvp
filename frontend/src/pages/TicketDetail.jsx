import React, { useContext, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';
import { API, UserContext } from '@/App';
import { Button } from '@/components/ui/button';
import { Anchor, ArrowLeft, CheckCircle, FileText, MapPin, Calendar, User, Award, Star } from 'lucide-react';

const TicketDetail = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const { user } = useContext(UserContext);
  const [ticket, setTicket] = useState(null);
  const [yacht, setYacht] = useState(null);
  const [technician, setTechnician] = useState(null);

  useEffect(() => {
    fetchData();
  }, [id]);

  const fetchData = async () => {
    try {
      const ticketRes = await axios.get(`${API}/tickets/${id}`);
      const ticketData = ticketRes.data;
      setTicket(ticketData);

      const dashboardRes = await axios.get(`${API}/dashboard/owner?user_id=${ticketData.owner_id}`);
      setYacht(dashboardRes.data.yacht);

      if (ticketData.technician_id) {
        const techsRes = await axios.get(`${API}/technicians/available`);
        const tech = techsRes.data.find(t => t.id === ticketData.technician_id);
        setTechnician(tech);
      }
    } catch (error) {
      console.error('Error fetching ticket:', error);
    }
  };

  const handleClose = async () => {
    try {
      await axios.post(`${API}/tickets/${id}/close`, {
        documents: ['Fattura.pdf', 'Foto_zattera.jpg', 'Cert_omologazione.pdf']
      });
      await fetchData();
      if (user.role === 'owner') {
        navigate('/owner/dashboard');
      }
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
            data-testid="back-to-dashboard-button"
            onClick={() => navigate(user.role === 'owner' ? '/owner/dashboard' : '/technician/dashboard')}
            variant="outline"
            className="border-slate-200 hover:bg-slate-50"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Dashboard
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-5xl mx-auto px-6 py-8">
        {/* Title */}
        <div className="mb-6">
          <h2 className="text-3xl font-bold text-[#0A2342] mb-2">Ticket {ticket.id}</h2>
          <p className="text-lg text-slate-600">{yacht.name} ({yacht.model})</p>
        </div>

        {/* Status Timeline */}
        <div className="bg-white border border-slate-200 rounded-lg shadow-sm p-8 mb-6">
          <h3 className="text-lg font-semibold text-[#0A2342] mb-6">Stato ticket</h3>
          <div className="flex items-center justify-between">
            {statusSteps.map((step, idx) => (
              <React.Fragment key={step.name}>
                <div className="flex flex-col items-center">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold transition-all ${
                      step.completed
                        ? 'bg-[#1D9E75] text-white'
                        : 'bg-slate-200 text-slate-400'
                    }`}
                  >
                    {step.completed ? '✓' : '○'}
                  </div>
                  <span className={`text-xs mt-2 font-medium ${
                    step.completed ? 'text-[#0A2342]' : 'text-slate-400'
                  }`}>
                    {step.name}
                  </span>
                </div>
                {idx < statusSteps.length - 1 && (
                  <div className={`flex-1 h-1 mx-2 rounded ${
                    step.completed ? 'bg-[#1D9E75]' : 'bg-slate-200'
                  }`}></div>
                )}
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* Ticket Info */}
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

        {/* Financial Section */}
        {ticket.final_price && (
          <div className="bg-slate-50 border border-slate-200 rounded-lg shadow-sm p-6 mb-6">
            <h3 className="text-lg font-semibold text-[#0A2342] mb-4">Riepilogo finanziario</h3>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-slate-700">
                <span>Importo intervento:</span>
                <span className="font-semibold">€{ticket.final_price}</span>
              </div>
              
              {/* Show commission and payment breakdown only to technician */}
              {user.role === 'technician' && (
                <>
                  <div className="flex items-center justify-between text-slate-600 text-sm">
                    <span>Commissione YachtAssist (15%):</span>
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

        {/* Documents Section */}
        {ticket.documents && ticket.documents.length > 0 && (
          <div className="bg-white border border-slate-200 rounded-lg shadow-sm p-6 mb-6">
            <h3 className="text-lg font-semibold text-[#0A2342] mb-4">Documenti</h3>
            <div className="space-y-2">
              {ticket.documents.map((doc, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-3 p-3 bg-slate-50 border border-slate-200 rounded-lg hover:bg-slate-100 transition-colors"
                >
                  <FileText className="w-5 h-5 text-[#1D9E75]" />
                  <span className="text-slate-700">{doc}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        {ticket.status === 'assegnato' && user.role === 'owner' && (
          <Button
            data-testid="close-ticket-button"
            onClick={handleClose}
            className="w-full h-14 bg-[#1D9E75] hover:bg-[#1D9E75]/90 text-white text-lg font-medium rounded-lg shadow-md hover:shadow-lg transition-all duration-200"
          >
            <CheckCircle className="w-5 h-5 mr-2" />
            Conferma e Chiudi Ticket
          </Button>
        )}

        {ticket.status === 'assegnato' && user.role === 'technician' && (
          <Button
            data-testid="close-intervention-button"
            onClick={handleClose}
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
            <p className="text-green-700 mt-2">Intervento completato e documentato</p>
          </div>
        )}
      </main>
    </div>
  );
};

export default TicketDetail;
