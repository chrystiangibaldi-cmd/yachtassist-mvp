import React, { useContext, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API, UserContext } from '@/App';
import { Button } from '@/components/ui/button';
import { Anchor, ArrowLeft, MapPin, Star, Award } from 'lucide-react';

const CreateTicket = () => {
  const navigate = useNavigate();
  const { user } = useContext(UserContext);
  const [ticket, setTicket] = useState(null);
  const [yacht, setYacht] = useState(null);
  const [technicians, setTechnicians] = useState([]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const dashboardRes = await axios.get(`${API}/dashboard/owner?user_id=${user.id}`);
      const yachtData = dashboardRes.data.yacht;
      setYacht(yachtData);

      const openTicket = dashboardRes.data.recent_tickets.find(
        t => t.status === 'aperto' || t.status === 'assegnato'
      );
      
      if (!openTicket) {
        // Nessun ticket aperto — vai al flusso di creazione
        navigate('/owner/request');
        return;
      }
      
      setTicket(openTicket);

      const techRes = await axios.get(`${API}/technicians/available`);
      setTechnicians(techRes.data);
    } catch (error) {
      console.error('Error fetching data:', error);
    }
  };
  const handleAssign = async (technicianId) => {
    try {
      await axios.post(`${API}/tickets/${ticket.id}/assign`, { technician_id: technicianId });
      navigate(`/owner/ticket/${ticket.id}`);
    } catch (error) {
      console.error('Error assigning technician:', error);
    }
  };

  if (!ticket || !yacht) {
    return <div className="min-h-screen flex items-center justify-center">Caricamento...</div>;
  }

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
            data-testid="back-button"
            onClick={() => navigate('/owner/dashboard')}
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
        {/* Ticket Card */}
        <div className="bg-white border-2 border-[#0A2342] rounded-lg shadow-lg p-8 mb-8">
          <div className="flex items-start justify-between mb-6">
            <div>
              <h2 className="text-2xl font-bold text-[#0A2342] mb-2">Ticket {ticket.id}</h2>
              <div className="text-slate-600">
                <p className="font-medium">Unità: {yacht.name} ({yacht.model}) — {user.name}</p>
                <p>Porto: {ticket.marina}</p>
              </div>
            </div>
            <span className="px-4 py-2 bg-red-50 text-red-700 border-2 border-red-600 rounded-lg text-sm font-bold">
              URGENZA {ticket.urgency.toUpperCase()}
            </span>
          </div>

          <div className="border-t border-slate-200 pt-6">
            <h3 className="text-lg font-semibold text-[#0A2342] mb-3">Lavori richiesti:</h3>
            <ul className="space-y-2">
              {ticket.work_items.map((item, idx) => (
                <li key={idx} className="flex items-start gap-2 text-slate-700">
                  <span className="text-[#1D9E75] font-bold">•</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Technicians Section */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-[#0A2342] mb-6">Tecnici disponibili nella zona</h2>
          <div className="space-y-4">
            {technicians.map((tech) => (
              <div
                key={tech.id}
                data-testid={`technician-${tech.id}`}
                className="bg-white border border-slate-200 rounded-lg shadow-sm p-6 hover:shadow-md transition-all duration-200"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <img
                      {tech.avatar_url ? (
  <img src={tech.avatar_url} alt={tech.name} className="w-16 h-16 rounded-full object-cover border-2 border-slate-200" />
) : (
  <div className="w-16 h-16 rounded-full bg-[#0A2342] flex items-center justify-center border-2 border-slate-200">
    <span className="text-white text-xl font-bold">{tech.name.charAt(0)}</span>
  </div>
)}
                      alt={tech.name}
                      className="w-16 h-16 rounded-full object-cover border-2 border-slate-200"
                    />
                    <div>
                      <h3 className="text-xl font-semibold text-[#0A2342] mb-1">{tech.name}</h3>
                      <div className="flex items-center gap-3 text-sm text-slate-600">
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
                        {tech.eco_certified && (
                          <span className="flex items-center gap-1 px-2 py-0.5 bg-green-50 text-green-700 border border-green-200 rounded-md font-medium">
                            <Award className="w-3 h-3" />
                            Eco Certified
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <Button
                    data-testid={`assign-button-${tech.id}`}
                    onClick={() => handleAssign(tech.id)}
                    className="bg-[#1D9E75] hover:bg-[#1D9E75]/90 text-white px-6 h-11 rounded-md font-medium transition-colors"
                  >
                    Assegna
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
};

export default CreateTicket;
