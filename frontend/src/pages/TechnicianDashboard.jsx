import React, { useContext, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { UserContext } from '@/App';
import { Button } from '@/components/ui/button';
import { Anchor, LogOut, FileText, Euro, CheckCircle, MapPin } from 'lucide-react';
import { GoogleMap, useLoadScript } from '@react-google-maps/api';
import AdvancedMarker from '@/components/AdvancedMarker';
import { formatAppointment } from '@/utils/appointment';
import { getUrgencyLabel } from '@/lib/urgencyLabels';

const BACKEND = "https://yachtassist-mvp-production.up.railway.app/api";

const libraries = ['places', 'marker'];

const mapContainerStyle = {
  width: '100%',
  height: '180px',
  borderRadius: '0.5rem',
};

const TechnicianDashboard = () => {
  const navigate = useNavigate();
  const { user, logout } = useContext(UserContext);
  const [dashboard, setDashboard] = useState(null);

  const { isLoaded } = useLoadScript({
    googleMapsApiKey: process.env.REACT_APP_GOOGLE_MAPS_API_KEY || '',
    libraries,
  });

  useEffect(() => {
    fetchDashboard();
  }, []);

  const fetchDashboard = async () => {
    try {
      const response = await axios.get(`${BACKEND}/dashboard/technician?user_id=${user.id}`);
      setDashboard(response.data);
    } catch (error) {
      console.error('Error fetching dashboard:', error);
    }
  };

  if (!dashboard) {
    return <div className="min-h-screen flex items-center justify-center">Caricamento...</div>;
  }

  const getStatusBadge = (status) => {
    const badges = {
      'aperto': <span className="px-2 py-1 bg-blue-50 text-blue-700 border border-blue-200 rounded-full text-xs font-medium">Aperto</span>,
      'assegnato': <span className="px-2 py-1 bg-amber-50 text-amber-700 border border-amber-200 rounded-full text-xs font-medium">Assegnato</span>,
      'pagato': <span className="px-2 py-1 bg-purple-50 text-purple-700 border border-purple-200 rounded-full text-xs font-medium">Pagato</span>,
      'confermato': <span className="px-2 py-1 bg-teal-50 text-teal-700 border border-teal-200 rounded-full text-xs font-medium">Confermato</span>,
      'chiuso': <span className="px-2 py-1 bg-slate-100 text-slate-700 border border-slate-300 rounded-full text-xs font-medium">Chiuso</span>,
    };
    return badges[status] || status;
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#0A2342] rounded-lg flex items-center justify-center">
              <Anchor className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-[#0A2342]">YachtAssist</h1>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-[#0A2342] font-medium">Ciao {user.name.split(' ')[0]}</span>
            <Button
              data-testid="logout-button"
              onClick={logout}
              variant="outline"
              className="border-slate-200 hover:bg-slate-50"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Esci
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Welcome Section */}
        <div className="bg-gradient-to-r from-[#0A2342] to-[#1D9E75] text-white rounded-lg shadow-lg p-8 mb-8">
          <h2 className="text-3xl font-bold mb-2">Benvenuto, {user.name}!</h2>
          <p className="text-lg opacity-90">Pannello tecnico YachtAssist</p>
        </div>

        {/* Porto base */}
        {(dashboard.user.porto_base || dashboard.user.marina) && (
          <div className="bg-white border border-slate-200 rounded-lg shadow-sm p-6 mb-8">
            <h3 className="text-lg font-semibold text-[#0A2342] mb-4 flex items-center gap-2">
              <MapPin className="w-5 h-5 text-[#1D9E75]" />
              Porto base
            </h3>
            <p className="text-slate-700 font-medium mb-3">{dashboard.user.porto_base || dashboard.user.marina}</p>
            {isLoaded && dashboard.user.marina_lat && dashboard.user.marina_lng && (
              <div className="rounded-lg overflow-hidden border border-slate-200">
                <GoogleMap
                  mapContainerStyle={mapContainerStyle}
                  center={{ lat: dashboard.user.marina_lat, lng: dashboard.user.marina_lng }}
                  zoom={14}
                  options={{
                    mapId: 'DEMO_MAP_ID',
                    disableDefaultUI: true,
                    zoomControl: true,
                  }}
                >
                  <AdvancedMarker position={{ lat: dashboard.user.marina_lat, lng: dashboard.user.marina_lng }} />
                </GoogleMap>
              </div>
            )}
          </div>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white border border-slate-200 rounded-lg shadow-sm p-6" data-testid="assigned-tickets-card">
            <div className="flex items-center gap-3 mb-2">
              <FileText className="w-5 h-5 text-[#1D9E75]" />
              <span className="text-sm text-slate-600 font-medium">Ticket assegnati</span>
            </div>
            <p className="text-3xl font-bold text-[#0A2342]">{dashboard.assigned_tickets.length}</p>
          </div>

          <div className="bg-white border border-slate-200 rounded-lg shadow-sm p-6" data-testid="pending-earnings-card">
            <div className="flex items-center gap-3 mb-2">
              <Euro className="w-5 h-5 text-amber-500" />
              <span className="text-sm text-slate-600 font-medium">Guadagni in attesa</span>
            </div>
            <p className="text-3xl font-bold text-[#0A2342]">€{dashboard.pending_earnings}</p>
          </div>

          <div className="bg-white border border-slate-200 rounded-lg shadow-sm p-6" data-testid="total-earnings-card">
            <div className="flex items-center gap-3 mb-2">
              <CheckCircle className="w-5 h-5 text-[#1D9E75]" />
              <span className="text-sm text-slate-600 font-medium">Guadagni totali</span>
            </div>
            <p className="text-3xl font-bold text-[#0A2342]">€{dashboard.total_earnings}</p>
          </div>
        </div>

        {/* Assigned Tickets */}
        <div className="bg-white border border-slate-200 rounded-lg shadow-sm p-6">
          <h3 className="text-xl font-semibold text-[#0A2342] mb-4">Ticket assegnati</h3>
          {dashboard.assigned_tickets.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>Nessun ticket assegnato al momento</p>
            </div>
          ) : (
            <div className="space-y-4">
              {dashboard.assigned_tickets.map((ticket) => (
                <div
                  key={ticket.id}
                  data-testid={`ticket-${ticket.id}`}
                  className="border border-slate-200 rounded-lg p-4 hover:bg-slate-50 transition-colors cursor-pointer"
                  onClick={() => navigate(`/technician/ticket/${ticket.id}`)}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <span className="font-semibold text-[#0A2342]">{ticket.id}</span>
                      {getStatusBadge(ticket.status)}
                      {(ticket.urgency === 'alta' || ticket.urgency === 'emergenza') && (
                        <span className="px-2 py-1 bg-red-50 text-red-700 border border-red-200 rounded-full text-xs font-medium">{getUrgencyLabel(ticket.urgency)}</span>
                      )}
                    </div>
                    <span className="text-sm text-slate-600">{ticket.marina}</span>
                  </div>
                  <div className="text-sm text-slate-600">
                    {ticket.work_items.map((item, idx) => (
                      <div key={idx}>• {item}</div>
                    ))}
                  </div>
                  {ticket.technician_payment && (
                    <div className="mt-2 text-sm font-medium text-[#1D9E75]">
                      Pagamento: €{ticket.technician_payment}
                      {ticket.status !== 'chiuso' && <span className="text-slate-500 ml-2">(in attesa)</span>}
                    </div>
                  )}
                  {ticket.appointment && (
                    <div className="mt-2 text-sm text-slate-600">
                      📅 {formatAppointment(ticket.appointment)}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default TechnicianDashboard;
