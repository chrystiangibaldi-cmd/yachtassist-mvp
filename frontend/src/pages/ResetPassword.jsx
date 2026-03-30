import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import axios from 'axios';
import { API } from '@/App';
import { Anchor, AlertCircle, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

const ResetPassword = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) setError('Link non valido. Richiedi un nuovo link di reset.');
  }, [token]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (password.length < 6) { setError('La password deve contenere almeno 6 caratteri'); return; }
    if (password !== confirmPassword) { setError('Le password non corrispondono'); return; }
    setLoading(true);
    setError('');
    try {
      await axios.post(`${API}/auth/reset-password`, { token, new_password: password });
      setSuccess(true);
      setTimeout(() => navigate('/login'), 3000);
    } catch (err) {
      setError(err.response?.data?.detail || 'Errore durante il reset. Il link potrebbe essere scaduto.');
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
              <h2 className="text-2xl font-bold text-[#0A2342] mb-2">Password aggiornata!</h2>
              <p className="text-slate-600 mb-2">La tua password è stata reimpostata con successo.</p>
              <p className="text-sm text-slate-400">Verrai reindirizzato al login tra pochi secondi...</p>
            </div>
          ) : (
            <>
              <h2 className="text-2xl font-bold text-[#0A2342] mb-2">Nuova password</h2>
              <p className="text-slate-600 mb-6">Scegli una nuova password per il tuo account.</p>

              {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700">
                  <AlertCircle className="w-5 h-5" />
                  <span className="text-sm">{error}</span>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-[#0A2342] mb-1">Nuova password *</label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Minimo 6 caratteri"
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1D9E75]"
                    required
                    minLength={6}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#0A2342] mb-1">Conferma password *</label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Ripeti la password"
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1D9E75]"
                    required
                  />
                </div>
                <Button
                  type="submit"
                  disabled={loading || !token}
                  className="w-full h-12 bg-[#1D9E75] hover:bg-[#1D9E75]/90 text-white font-medium"
                >
                  {loading ? 'Aggiornamento...' : 'Reimposta password'}
                </Button>
              </form>

              <div className="mt-6 text-center">
                <Link to="/forgot-password" className="text-sm text-[#1D9E75] hover:underline">
                  Richiedi un nuovo link
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ResetPassword;
