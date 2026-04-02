import React, { useContext, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API, UserContext } from '@/App';
import { Button } from '@/components/ui/button';
import { Anchor, LogOut, FileText, Wrench, Calendar, CheckCircle, AlertTriangle, XCircle } from 'lucide-react';
import { GoogleMap, useLoadScript, MarkerF } from '@react-google-maps/api';

const libraries = ['places'];

const mapContainerStyle = {
  width: '100%',
  height: '180px',
  borderRadius: '0.5rem',
};

const OwnerDashboard = () => {
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
      const response = await axios.get(`${API}/dashboard/owner?user_id=${user.id}`);
      setDashboard(response.data);
    } catch (error) {
      console.error('Error fetching dashboard:', error);
    }
  };

  if (!dashboard) {
    return <div className="min-h-screen flex items-center justify-center">Caricamento...</div>;
  }

  const getComplianceColor = (score) => {
    if (score >= 80) return 'text-[#1D9E75]';
    if (score >= 60) return 'text-amber-500';
    return 'text-red-500';
  };

  const getStatusBadge = (status) => {
    const badges = {
      'aperto': <span className="px-2 py-1 bg-blue-50 text-blue-700 border border-blue-200 rounded-full text-xs font-medium">Aperto</span>,
      'assegnato': <span className="px-2 py-1 bg-amber-50 text-amber-700 border border-amber-200 rounded-full text-xs font-medium">Assegnato</span>,
      'accettato': <span className="px-2 py-1 bg-purple-50 text-purple-700 border border-purple-200 rounded-full text-xs font-medium">Accettato</span>,
      'eseguito': <span className="px-2 py-1 bg-green-50 text-green-700 border border-green-200 rounded-full text-xs font-medium">Eseguito</span>,
      'chiuso': <span className="px-2 py-1 bg-slate-100 text-slate-700 border border-slate-300 rounded-full text-xs font-medium">Chiuso</span>,
    };
    return badges[status] || status;
  };

  const yachtCoords = dashboard.yacht.marina_lat && dashboard.yacht.marina_lng
    ? { lat: dashboard.yacht.marina_lat, lng: dashboard.yacht.marina_lng }
    : null;

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
        {/* Compliance Score Card */}
        <div className="bg-white border border-slate-200 rounded-lg shadow-sm p-8 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <h2 className="text-2xl font-semibold text-[#0A2342] mb-2">{dashboard.yacht.name} — {dashboard.yacht.model}</h2>
              <p className="text-slate-600">{dashboard.yacht.marina} · {dashboard.yacht.category} · {dashboard.yacht.distance}</p>
            </div>
            <div className="flex flex-col items-center">
              <div className="relative w-32 h-32">
                <svg className="w-32 h-32 transform -rotate-90">
                  <circle
                    cx="64"
                    cy="64"
                    r="56"
                    stroke="#E2E8F0"
                    strokeWidth="12"
                    fill="none"
                  />
                  <circle
                    cx="64"
                    cy="64"
                    r="56"
                    stroke={dashboard.yacht.compliance_score >= 80 ? '#1D9E75' : dashboard.yacht.compliance_score >= 60 ? '#F59E0B' : '#EF4444'}
                    strokeWidth="12"
                    fill="none"
                    strokeDasharray={`${2 * Math.PI * 56}`}
                    strokeDashoffset={`${2 * Math.PI * 56 * (1 - dashboard.yacht.compliance_score / 100)}`}
                    strokeLinecap="round"
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className={`text-3xl font-bold ${getComplianceColor(dashboard.yacht.compliance_score)}`}>
                    {dashboard.yacht.compliance_score}%
                  </span>
                </div>
              </div>
              <p className="text-sm text-slate-600 mt-2 font-medium">Conformità D.M. 133/2024</p>
            </div>
          </div>

          {/* Mappa porto base */}
          {isLoaded && yachtCoords && (
            <div className="mt-4 rounded-lg overflow-hidden border border-slate-200">
              <GoogleMap
                mapContainerStyle={mapContainerStyle}
                center={yachtCoords}
                zoom={14}
                options={{
                  disableDefaultUI: true,
                  zoomControl: true,
                }}
              >
                <MarkerF position={yachtCoords} />
              </GoogleMap>
            </div>
          )}
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white border border-slate-200 rounded-lg shadow-sm p-6" data-testid="open-tickets-card">
            <div className="flex items-center gap-3 mb-2">
              <FileText className="w-5 h-5 text-[#1D9E75]" />
              <span className="text-sm text-slate-600 font-medium">Ticket aperti</span>
            </div>
            <p className="text-3xl font-bold text-[#0A2342]">{dashboard.open_tickets}</p>
          </div>

          <div className="bg-white border border-slate-200 rounded-lg shadow-sm p-6" data-testid="active-interventions-card">
            <div className="flex items-center gap-3 mb-2">
              <Wrench className="w-5 h-5 text-[#1D9E75]" />
              <span className="text-sm text-slate-600 font-medium">Interventi in corso</span>
            </div>
            <p className="text-3xl font-bold text-[#0A2342]">{dashboard.active_interventions}</p>
          </div>

          <div className="bg-white border border-slate-200 rounded-lg shadow-sm p-6" data-testid="season-card">
            <div className="flex items-center gap-3 mb-2">
              <Calendar className="w-5 h-5 text-[#1D9E75]" />
              <span className="text-sm text-slate-600 font-medium">Stagione</span>
            </div>
            <p className="text-2xl font-bold text-[#0A2342]">{dashboard.season}</p>
          </div>
        </div>

        {/* CTA Buttons */}
        <div className="mb-8 space-y-3">
          <Button
            data-testid="open-checklist-button"
            onClick={() => navigate('/owner/checklist')}
            className="w-full h-14 bg-[#1D9E75] hover:bg-[#1D9E75]/90 text-white text-lg font-medium rounded-lg shadow-md hover:shadow-lg transition-all duration-200"
          >
            <FileText className="w-5 h-5 mr-2" />
            Apri Checklist Pre-Stagione
          </Button>

          <Button
            data-testid="request-intervention-button"
            onClick={() => navigate('/owner/request')}
            variant="outline"
            className="w-full h-12 border-2 border-[#0A2342] text-[#0A2342] hover:bg-[#0A2342] hover:text-white text-base font-medium rounded-lg transition-all duration-200"
          >
            <Wrench className="w-5 h-5 mr-2" />
            Richiedi Intervento
          </Button>
        </div>

        {/* Recent Tickets */}
        <div className="bg-white border border-slate-200 rounded-lg shadow-sm p-6">
          <h3 className="text-xl font-semibold text-[#0A2342] mb-4">Ticket recenti</h3>
          <div className="space-y-4">
            {dashboard.recent_tickets.map((ticket) => (
              <div
                key={ticket.id}
                data-testid={`ticket-${ticket.id}`}
                className="border border-slate-200 rounded-lg p-4 hover:bg-slate-50 transition-colors cursor-pointer"
                onClick={() => navigate(`/owner/ticket/${ticket.id}`)}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <span className="font-semibold text-[#0A2342]">{ticket.id}</span>
                    {getStatusBadge(ticket.status)}
                    {ticket.urgency === 'alta' && (
                      <span className="px-2 py-1 bg-red-50 text-red-700 border border-red-200 rounded-full text-xs font-medium">URGENZA ALTA</span>
                    )}
                  </div>
                  <span className="text-sm text-slate-600">{ticket.marina}</span>
                </div>
                <div className="text-sm text-slate-600">
                  {ticket.work_items.map((item, idx) => (
                    <div key={idx}>• {item}</div>
                  ))}
                </div>
                {ticket.status !== 'aperto' && ticket.final_price != null && (
                  <div className="mt-2 text-sm font-medium text-[#0A2342]">
                    Totale: €{ticket.final_price}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
};

export default OwnerDashboard;
