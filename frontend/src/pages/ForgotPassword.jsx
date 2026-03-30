import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { API } from '@/App';
import { Anchor, ArrowLeft, CheckCircle, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

const ForgotPassword = () => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email) { setError('Inserisci la tua email'); return; }
    setLoading(true);
    setError('');
    try {
      await axios.post(`${API}/auth/forgot-password`, { email });
      setSuccess(true);
    } catch (err) {
      setError('Errore durante l\'invio. Riprova.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center py-12 px-4">
      <div className="w-full max-w-md">
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="w-12 h-12 bg-[#0A2342] rounded-lg flex items-center justify-center">
            <Anchor className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-[#0A2342]">YachtAssist</h1>
        </div>

        <div className="bg-white rounded-lg shadow-lg border border-slate-200 p-8">
          {success ? (
            <div className="text-center">
              <CheckCircle className="w-16 h-16 text-[#1D9E75] mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-[#0A2342] mb-2">Email inviata!</h2>
              <p className="text-slate-600 mb-6">
                Se l'indirizzo è registrato, riceverai un link per reimpostare la password entro qualche minuto.
              </p>
              <p className="text-sm text-slate-400 mb-6">Il link scade tra 1 ora.</p>
              <Link to="/login">
                <Button variant="outline" className="w-full">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Torna al login
                </Button>
              </Link>
            </div>
          ) : (
            <>
              <h2 className="text-2xl font-bold text-[#0A2342] mb-2">Password dimenticata?</h2>
              <p className="text-slate-600 mb-6">
                Inserisci la tua email e ti invieremo un link per reimpostare la password.
              </p>

              {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700">
                  <AlertCircle className="w-5 h-5" />
                  <span className="text-sm">{error}</span>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-[#0A2342] mb-1">Email *</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="la-tua@email.it"
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1D9E75]"
                    required
                  />
                </div>
                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full h-12 bg-[#1D9E75] hover:bg-[#1D9E75]/90 text-white font-medium"
                >
                  {loading ? 'Invio in corso...' : 'Invia link di reset'}
                </Button>
              </form>

              <div className="mt-6 text-center">
                <Link to="/login" className="text-slate-500 hover:text-[#0A2342] flex items-center justify-center gap-1 text-sm">
                  <ArrowLeft className="w-4 h-4" />
                  Torna al login
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ForgotPassword;
