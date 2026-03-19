import React, { useContext, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API, UserContext } from '@/App';
import { Button } from '@/components/ui/button';
import { Anchor, ArrowLeft, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';

const Checklist = () => {
  const navigate = useNavigate();
  const { user } = useContext(UserContext);
  const [yacht, setYacht] = useState(null);
  const [items, setItems] = useState([]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const dashboardRes = await axios.get(`${API}/dashboard/owner?user_id=${user.id}`);
      const yachtData = dashboardRes.data.yacht;
      setYacht(yachtData);
      
      const checklistRes = await axios.get(`${API}/checklist/${yachtData.id}`);
      setItems(checklistRes.data);
    } catch (error) {
      console.error('Error fetching checklist:', error);
    }
  };

  const conformeCount = items.filter(item => item.status === 'conforme').length;
  const totalCount = items.length;
  const percentage = totalCount > 0 ? Math.round((conformeCount / totalCount) * 100) : 0;
  const nonConformeCount = items.filter(item => item.status !== 'conforme').length;

  const getStatusIcon = (status) => {
    if (status === 'conforme') return <CheckCircle className="w-5 h-5 text-green-600" />;
    if (status === 'mancante') return <XCircle className="w-5 h-5 text-red-600" />;
    if (status === 'scaduto') return <AlertTriangle className="w-5 h-5 text-amber-600" />;
  };

  const getStatusText = (status) => {
    if (status === 'conforme') return { text: 'CONFORME', className: 'bg-green-50 text-green-700 border-green-200' };
    if (status === 'mancante') return { text: 'MANCANTE', className: 'bg-red-50 text-red-700 border-red-200' };
    if (status === 'scaduto') return { text: 'SCADUTI mar 2025', className: 'bg-amber-50 text-amber-700 border-amber-200' };
  };

  if (!yacht) {
    return <div className="min-h-screen flex items-center justify-center">Caricamento...</div>;
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10 shadow-sm">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#0A2342] rounded-lg flex items-center justify-center">
              <Anchor className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-[#0A2342]">YachtAssist</h1>
          </div>
          <Button
            data-testid="back-to-dashboard-button"
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
      <main className="max-w-4xl mx-auto px-6 py-8">
        {/* Title */}
        <div className="mb-6">
          <h2 className="text-3xl font-bold text-[#0A2342] mb-2">Checklist Pre-Stagione — {yacht.name}</h2>
          <p className="text-lg text-slate-600">{yacht.model} · {yacht.category} · {yacht.distance}</p>
        </div>

        {/* Progress Bar */}
        <div className="bg-white border border-slate-200 rounded-lg shadow-sm p-6 mb-6">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-slate-700">Progresso conformità</span>
            <span className="text-lg font-bold text-[#0A2342]">{conformeCount}/{totalCount} voci conformi ({percentage}%)</span>
          </div>
          <div className="w-full bg-slate-200 rounded-full h-4">
            <div
              className="h-4 rounded-full transition-all duration-500"
              style={{
                width: `${percentage}%`,
                backgroundColor: percentage >= 80 ? '#1D9E75' : percentage >= 60 ? '#F59E0B' : '#EF4444'
              }}
            ></div>
          </div>
        </div>

        {/* Checklist Items */}
        <div className="space-y-4 mb-8">
          {items.map((item) => {
            const statusInfo = getStatusText(item.status);
            return (
              <div
                key={item.id}
                data-testid={`checklist-item-${item.id}`}
                className="bg-white border border-slate-200 rounded-lg shadow-sm p-6 transition-all duration-200 hover:shadow-md"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4 flex-1">
                    {getStatusIcon(item.status)}
                    <div className="flex-1">
                      <h3 className="text-lg font-medium text-[#0A2342] mb-2">{item.name}</h3>
                      <div className="flex items-center gap-2">
                        <span className={`px-3 py-1 border rounded-full text-xs font-semibold ${statusInfo.className}`}>
                          {item.status === 'conforme' ? '✓ ' : item.status === 'mancante' ? '✗ ' : '⚠ '}
                          {statusInfo.text}
                        </span>
                        {item.is_new_2025 && (
                          <span className="px-3 py-1 bg-red-600 text-white rounded-full text-xs font-semibold">
                            NUOVO 2025
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Generate Ticket Button */}
        {nonConformeCount > 0 && (
          <Button
            data-testid="generate-ticket-button"
            onClick={() => navigate('/owner/ticket/create')}
            className="w-full h-14 bg-red-600 hover:bg-red-700 text-white text-lg font-medium rounded-lg shadow-md hover:shadow-lg transition-all duration-200"
          >
            Genera Ticket per {nonConformeCount} voci non conformi →
          </Button>
        )}
      </main>
    </div>
  );
};

export default Checklist;
