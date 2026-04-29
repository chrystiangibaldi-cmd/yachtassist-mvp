import React, { useContext, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { UserContext } from '@/App';
import { Button } from '@/components/ui/button';
import { Anchor, LogOut, FileText, Wrench, Calendar, CheckCircle, AlertTriangle, XCircle } from 'lucide-react';
import { GoogleMap, useLoadScript } from '@react-google-maps/api';
import AdvancedMarker from '@/components/AdvancedMarker';
import AiChatWidget from '@/components/AiChatWidget';
import { getUrgencyLabel } from '@/lib/urgencyLabels';

const BACKEND = "https://yachtassist-mvp-production.up.railway.app/api";

const libraries = ['places', 'marker'];

const mapContainerStyle = {
  width: '100%',
  height: '180px',
  borderRadius: '0.5rem',
};

const OwnerDashboard = () => {
  const navigate = useNavigate();
  const { user, logout } = useContext(UserContext);
  const [dashboard, setDashboard] = useState(null);
  const [closedOffset, setClosedOffset] = useState(0);
  const [showClosed, setShowClosed] = useState(false);
  const [accumulatedClosed, setAccumulatedClosed] = useState([]);
  const [selectedYachtId, setSelectedYachtId] = useState(null);

  const { isLoaded } = useLoadScript({
    googleMapsApiKey: process.env.REACT_APP_GOOGLE_MAPS_API_KEY || '',
    libraries,
  });

  useEffect(() => {
    fetchDashboard();
  }, [closedOffset]);

  const fetchDashboard = async () => {
    try {
      const response = await axios.get(`${BACKEND}/dashboard/owner?user_id=${user.id}&closed_offset=${closedOffset}`);
      setDashboard(response.data);
      // Multi-boat: inizializza selectedYachtId al primo yacht se non ancora settato
      if (!selectedYachtId && response.data.yachts && response.data.yachts.length > 0) {
        setSelectedYachtId(response.data.yachts[0].id);
      }
      if (closedOffset === 0) {
        setAccumulatedClosed(response.data.closed_tickets);
      } else {
        setAccumulatedClosed(prev => [...prev, ...response.data.closed_tickets]);
      }
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
      'pagato': <span className="px-2 py-1 bg-purple-50 text-purple-700 border border-purple-200 rounded-full text-xs font-medium">Pagato</span>,
      'confermato': <span className="px-2 py-1 bg-teal-50 text-teal-700 border border-teal-200 rounded-full text-xs font-medium">Confermato</span>,
      'chiuso': <span className="px-2 py-1 bg-slate-100 text-slate-700 border border-slate-300 rounded-full text-xs font-medium">Chiuso</span>,
    };
    return badges[status] || status;
  };

  const renderTicketCard = (ticket) => (
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
      {ticket.status !== 'aperto' && ticket.final_price != null && (
        <div className="mt-2 text-sm font-medium text-[#0A2342]">
          Totale: €{ticket.final_price}
        </div>
      )}
    </div>
  );

  // Multi-boat: deriva yacht selezionato dalla lista yachts
  // Fallback retrocompat: se yachts vuoto, usa dashboard.yacht (deprecated singolare backend)
  const yachts = dashboard.yachts && dashboard.yachts.length > 0 ? dashboard.yachts : [];
  const selectedYacht = yachts.find(y => y.id === selectedYachtId) || yachts[0] || dashboard.yacht;

  const yachtCoords = selectedYacht && selectedYacht.marina_lat && selectedYacht.marina_lng
    ? { lat: selectedYacht.marina_lat, lng: selectedYacht.marina_lng }
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
        {/* Multi-boat: Le mie barche */}
        {yachts.length > 0 && (
          <div className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-slate-600">Le mie barche</h3>
              {yachts.length > 1 && (
                <span className="text-xs text-slate-400">Tap per selezionare</span>
              )}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {yachts.map(y => {
                const isSelected = y.id === selectedYachtId;
                return (
                  <div
                    key={y.id}
                    data-testid={`yacht-card-${y.id}`}
                    onClick={() => setSelectedYachtId(y.id)}
                    className={`cursor-pointer rounded-lg p-4 transition-all ${
                      isSelected
                        ? 'bg-[#0A2342] text-white border-2 border-[#1D9E75]'
                        : 'bg-white text-[#0A2342] border border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="font-semibold text-sm mb-1">{y.name}</div>
                    <div className={`text-xs mb-2 ${isSelected ? 'opacity-85' : 'text-slate-600'}`}>
                      {y.model}
                    </div>
                    <div className={`text-xs ${isSelected ? 'opacity-70' : 'text-slate-400'}`}>
                      {y.marina}
                    </div>
                  </div>
                );
              })}
              {/* Card Aggiungi barca */}
              <div
                data-testid="add-yacht-card"
                onClick={() => navigate('/owner/onboarding')}
                className="cursor-pointer rounded-lg p-4 bg-white border border-dashed border-slate-300 hover:border-[#0A2342] flex flex-col items-center justify-center text-slate-400 hover:text-[#0A2342] transition-colors min-h-[88px]"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mb-1">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                <span className="text-xs font-semibold">Aggiungi barca</span>
              </div>
            </div>
          </div>
        )}

        {/* Compliance Score Card */}
        <div className="bg-white border border-slate-200 rounded-lg shadow-sm p-8 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <h2 className="text-2xl font-semibold text-[#0A2342] mb-2">{selectedYacht.name} — {selectedYacht.model}</h2>
              <p className="text-slate-600">{selectedYacht.marina} · {selectedYacht.category} · {selectedYacht.distance}</p>
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
                    stroke={selectedYacht.compliance_score >= 80 ? '#1D9E75' : selectedYacht.compliance_score >= 60 ? '#F59E0B' : '#EF4444'}
                    strokeWidth="12"
                    fill="none"
                    strokeDasharray={`${2 * Math.PI * 56}`}
                    strokeDashoffset={`${2 * Math.PI * 56 * (1 - selectedYacht.compliance_score / 100)}`}
                    strokeLinecap="round"
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className={`text-3xl font-bold ${getComplianceColor(selectedYacht.compliance_score)}`}>
                    {selectedYacht.compliance_score}%
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
                  mapId: 'DEMO_MAP_ID',
                  disableDefaultUI: true,
                  zoomControl: true,
                }}
              >
                <AdvancedMarker position={yachtCoords} />
              </GoogleMap>
            </div>
          )}
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <div className="bg-white border border-slate-200 rounded-lg shadow-sm p-6" data-testid="active-tickets-card">
            <div className="flex items-center gap-3 mb-2">
              <FileText className="w-5 h-5 text-[#1D9E75]" />
              <span className="text-sm text-slate-600 font-medium">Ticket attivi</span>
            </div>
            <p className="text-3xl font-bold text-[#0A2342]">{dashboard.active_tickets_count}</p>
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

        {/* Active Tickets */}
        <div className="bg-white border border-slate-200 rounded-lg shadow-sm p-6 mb-6">
          <h3 className="text-xl font-semibold text-[#0A2342] mb-4">
            {selectedYacht && yachts.length > 1 ? `Ticket attivi · ${selectedYacht.name}` : 'Ticket attivi'}
          </h3>
          {(() => {
            const filteredActive = selectedYachtId
              ? dashboard.active_tickets.filter(t => t.yacht_id === selectedYachtId)
              : dashboard.active_tickets;
            return filteredActive.length === 0 ? (
              <p className="text-slate-500 text-sm">
                {selectedYacht ? `Nessun ticket attivo per ${selectedYacht.name}.` : 'Nessun ticket attivo al momento.'}
              </p>
            ) : (
              <div className="space-y-4">
                {filteredActive.map(renderTicketCard)}
              </div>
            );
          })()}
        </div>

        {/* Closed Tickets History (collapsible) */}
        {dashboard.closed_tickets_total > 0 && (
          <div className="bg-white border border-slate-200 rounded-lg shadow-sm">
            <div
              data-testid="toggle-closed-tickets"
              className="flex items-center justify-between p-6 hover:bg-slate-50 cursor-pointer transition-colors"
              onClick={() => setShowClosed(!showClosed)}
            >
              <div className="flex items-center gap-2">
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 14 14"
                  className={`transition-transform ${showClosed ? 'rotate-90' : ''}`}
                >
                  <path
                    d="M5 3 L9 7 L5 11"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                <h3 className="text-xl font-semibold text-[#0A2342]">Storico ticket</h3>
              </div>
              <span className="text-sm text-slate-500">· {dashboard.closed_tickets_total} chiusi</span>
            </div>
            {showClosed && (
              <div className="px-6 pb-6 space-y-4">
                {(selectedYachtId
                  ? accumulatedClosed.filter(t => t.yacht_id === selectedYachtId)
                  : accumulatedClosed
                ).map(renderTicketCard)}
                {accumulatedClosed.length < dashboard.closed_tickets_total && (
                  <Button
                    data-testid="load-more-closed-button"
                    variant="outline"
                    onClick={() => setClosedOffset(prev => prev + 5)}
                    className="w-full mt-2"
                  >
                    Mostra altri 5
                  </Button>
                )}
              </div>
            )}
          </div>
        )}
      </main>
      <AiChatWidget />
    </div>
  );
};

export default OwnerDashboard;
