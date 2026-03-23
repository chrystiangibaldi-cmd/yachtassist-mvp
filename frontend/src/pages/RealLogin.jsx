import React, { useState, useContext } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { API, UserContext } from '@/App';
import { Button } from '@/components/ui/button';
import { Anchor, User, Wrench, AlertCircle } from 'lucide-react';

const RealLogin = () => {
  const navigate = useNavigate();
  const { login } = useContext(UserContext);
  
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    remember: false
  });
  
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setFormData({ ...formData, [e.target.name]: value });
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    
    if (!formData.email || !formData.password) {
      setError('Email e password sono obbligatori');
      return;
    }

    setLoading(true);
    
    try {
      const response = await axios.post(`${API}/auth/login`, {
        email: formData.email,
        password: formData.password
      });
      
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
      setError(err.response?.data?.detail || 'Errore durante il login');
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
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="w-12 h-12 bg-[#0A2342] rounded-lg flex items-center justify-center">
            <Anchor className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-[#0A2342]">YachtAssist</h1>
        </div>

        {/* Login Form */}
        <div className="bg-white rounded-lg shadow-lg border border-slate-200 p-8">
          <h2 className="text-2xl font-bold text-[#0A2342] mb-2">Accedi</h2>
          <p className="text-slate-600 mb-6">Benvenuto, inserisci le tue credenziali</p>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700">
              <AlertCircle className="w-5 h-5" />
              <span className="text-sm">{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-[#0A2342] mb-1">Email</label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1D9E75] focus:border-transparent"
                required
              />
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-medium text-[#0A2342] mb-1">Password</label>
              <input
                type="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1D9E75] focus:border-transparent"
                required
              />
            </div>

            {/* Remember Me & Forgot Password */}
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  name="remember"
                  checked={formData.remember}
                  onChange={handleChange}
                  className="w-4 h-4 text-[#1D9E75] border-slate-300 rounded focus:ring-[#1D9E75]"
                />
                <span className="text-sm text-slate-600">Ricordami</span>
              </label>
              <a href="#" className="text-sm text-[#1D9E75] hover:underline">
                Password dimenticata?
              </a>
            </div>

            {/* Submit Button */}
            <Button
              type="submit"
              disabled={loading}
              className="w-full h-12 bg-[#0A2342] hover:bg-[#0A2342]/90 text-white font-medium rounded-lg transition-colors"
            >
              {loading ? 'Accesso in corso...' : 'Accedi'}
            </Button>
          </form>

          {/* Register Link */}
          <div className="mt-6 text-center">
            <span className="text-slate-600">Non hai un account? </span>
            <Link to="/register" className="text-[#1D9E75] font-medium hover:underline">
              Registrati
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

export default RealLogin;
