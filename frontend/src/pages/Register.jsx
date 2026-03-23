import React, { useState, useContext } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { API, UserContext } from '@/App';
import { Button } from '@/components/ui/button';
import { Anchor, User, Wrench, AlertCircle } from 'lucide-react';

const Register = () => {
  const navigate = useNavigate();
  const { login } = useContext(UserContext);
  
  const [formData, setFormData] = useState({
    nome: '',
    cognome: '',
    email: '',
    password: '',
    confirmPassword: '',
    role: 'owner',
    specializzazione: '',
    porto_base: '',
    telefono: ''
  });
  
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const specializations = [
    'Dotazioni sicurezza',
    'Motore & Propulsione',
    'Impianto Elettrico',
    'Carena & Antifouling',
    'Navigazione & Elettronica',
    'Rigging & Vele',
    'Idraulica & Impianti',
    'Multidisciplinare'
  ];

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    
    // Validation
    if (!formData.nome || !formData.cognome || !formData.email || !formData.password) {
      setError('Tutti i campi sono obbligatori');
      return;
    }
    
    if (formData.password !== formData.confirmPassword) {
      setError('Le password non corrispondono');
      return;
    }
    
    if (formData.password.length < 6) {
      setError('La password deve contenere almeno 6 caratteri');
      return;
    }
    
    if (formData.role === 'technician' && (!formData.specializzazione || !formData.porto_base || !formData.telefono)) {
      setError('Compila tutti i campi per il tecnico');
      return;
    }

    setLoading(true);
    
    try {
      const payload = {
        nome: formData.nome,
        cognome: formData.cognome,
        email: formData.email,
        password: formData.password,
        role: formData.role,
        ...(formData.role === 'technician' && {
          specializzazione: formData.specializzazione,
          porto_base: formData.porto_base,
          telefono: formData.telefono
        })
      };
      
      const response = await axios.post(`${API}/auth/register`, payload);
      const { user, token } = response.data;
      
      // Store auth data
      login(user, token);
      
      // Redirect based on role
      if (user.role === 'owner') {
        navigate('/owner/dashboard');
      } else {
        navigate('/technician/dashboard');
      }
    } catch (err) {
      setError(err.response?.data?.detail || 'Errore durante la registrazione');
    } finally {
      setLoading(false);
    }
  };

  const handleDemoLogin = async (role) => {
    try {
      const response = await axios.post(`${API}/auth/demo-login`, { role });
      const { user, token } = response.data;
      login(user, token);
      
      if (role === 'owner') {
        navigate('/owner/dashboard');
      } else {
        navigate('/technician/dashboard');
      }
    } catch (error) {
      console.error('Demo login error:', error);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center py-12 px-4">
      <div className="w-full max-w-2xl">
        {/* Logo */}
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="w-12 h-12 bg-[#0A2342] rounded-lg flex items-center justify-center">
            <Anchor className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-[#0A2342]">YachtAssist</h1>
        </div>

        {/* Registration Form */}
        <div className="bg-white rounded-lg shadow-lg border border-slate-200 p-8">
          <h2 className="text-2xl font-bold text-[#0A2342] mb-2">Crea un account</h2>
          <p className="text-slate-600 mb-6">Registrati per accedere alla piattaforma</p>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700">
              <AlertCircle className="w-5 h-5" />
              <span className="text-sm">{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Role Selection */}
            <div>
              <label className="block text-sm font-medium text-[#0A2342] mb-2">Tipo di account</label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, role: 'owner' })}
                  className={`p-4 border-2 rounded-lg flex items-center justify-center gap-2 transition-all ${
                    formData.role === 'owner' 
                      ? 'border-[#0A2342] bg-[#0A2342] text-white' 
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <User className="w-5 h-5" />
                  <span className="font-medium">Owner / Captain</span>
                </button>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, role: 'technician' })}
                  className={`p-4 border-2 rounded-lg flex items-center justify-center gap-2 transition-all ${
                    formData.role === 'technician' 
                      ? 'border-[#1D9E75] bg-[#1D9E75] text-white' 
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <Wrench className="w-5 h-5" />
                  <span className="font-medium">Tecnico</span>
                </button>
              </div>
            </div>

            {/* Name Fields */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-[#0A2342] mb-1">Nome *</label>
                <input
                  type="text"
                  name="nome"
                  value={formData.nome}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1D9E75] focus:border-transparent"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#0A2342] mb-1">Cognome *</label>
                <input
                  type="text"
                  name="cognome"
                  value={formData.cognome}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1D9E75] focus:border-transparent"
                  required
                />
              </div>
            </div>

            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-[#0A2342] mb-1">Email *</label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1D9E75] focus:border-transparent"
                required
              />
            </div>

            {/* Password Fields */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-[#0A2342] mb-1">Password *</label>
                <input
                  type="password"
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1D9E75] focus:border-transparent"
                  required
                  minLength={6}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#0A2342] mb-1">Conferma Password *</label>
                <input
                  type="password"
                  name="confirmPassword"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1D9E75] focus:border-transparent"
                  required
                />
              </div>
            </div>

            {/* Technician-specific fields */}
            {formData.role === 'technician' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-[#0A2342] mb-1">Specializzazione *</label>
                  <select
                    name="specializzazione"
                    value={formData.specializzazione}
                    onChange={handleChange}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1D9E75] focus:border-transparent"
                    required
                  >
                    <option value="">Seleziona specializzazione</option>
                    {specializations.map(spec => (
                      <option key={spec} value={spec}>{spec}</option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-[#0A2342] mb-1">Porto base *</label>
                    <input
                      type="text"
                      name="porto_base"
                      value={formData.porto_base}
                      onChange={handleChange}
                      placeholder="es. Marina di Pisa"
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1D9E75] focus:border-transparent"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[#0A2342] mb-1">Telefono *</label>
                    <input
                      type="tel"
                      name="telefono"
                      value={formData.telefono}
                      onChange={handleChange}
                      placeholder="+39 ..."
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1D9E75] focus:border-transparent"
                      required
                    />
                  </div>
                </div>
              </>
            )}

            {/* Submit Button */}
            <Button
              type="submit"
              disabled={loading}
              className="w-full h-12 bg-[#1D9E75] hover:bg-[#1D9E75]/90 text-white font-medium rounded-lg transition-colors"
            >
              {loading ? 'Registrazione in corso...' : 'Registrati'}
            </Button>
          </form>

          {/* Login Link */}
          <div className="mt-6 text-center">
            <span className="text-slate-600">Hai già un account? </span>
            <Link to="/login" className="text-[#1D9E75] font-medium hover:underline">
              Accedi
            </Link>
          </div>

          {/* Demo Divider */}
          <div className="relative my-8">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-300"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-4 bg-white text-slate-500">oppure accedi alla demo</span>
            </div>
          </div>

          {/* Demo Buttons */}
          <div className="space-y-3">
            <Button
              onClick={() => handleDemoLogin('owner')}
              variant="outline"
              className="w-full h-12 border-slate-300 hover:bg-slate-50 flex items-center justify-center gap-2"
            >
              <User className="w-5 h-5" />
              Demo Owner (Chrystian Gibaldi)
            </Button>
            <Button
              onClick={() => handleDemoLogin('technician')}
              variant="outline"
              className="w-full h-12 border-slate-300 hover:bg-slate-50 flex items-center justify-center gap-2"
            >
              <Wrench className="w-5 h-5" />
              Demo Tecnico (Enrico Gibaldi)
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Register;
