import React, { useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API, UserContext } from '@/App';
import { Button } from '@/components/ui/button';
import { Anchor, User, Wrench } from 'lucide-react';

const Login = () => {
  const navigate = useNavigate();
  const { login } = useContext(UserContext);

  const handleLogin = async (role) => {
    try {
      const response = await axios.post(`${API}/auth/login`, { role });
      const { user, token } = response.data;
      login(user, token);
      
      if (role === 'owner') {
        navigate('/owner/dashboard');
      } else {
        navigate('/technician/dashboard');
      }
    } catch (error) {
      console.error('Login error:', error);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left side - Login */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 lg:p-16">
        <div className="w-full max-w-md">
          {/* Logo */}
          <div className="flex items-center gap-3 mb-8">
            <div className="w-12 h-12 bg-[#0A2342] rounded-lg flex items-center justify-center">
              <Anchor className="w-7 h-7 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-[#0A2342]">YachtAssist</h1>
          </div>

          {/* Welcome text */}
          <div className="mb-12">
            <h2 className="text-4xl font-bold text-[#0A2342] mb-3">Benvenuto</h2>
            <p className="text-lg text-slate-600">Seleziona il tuo profilo per accedere alla piattaforma</p>
          </div>

          {/* Login buttons */}
          <div className="space-y-4">
            <Button
              data-testid="login-owner-button"
              onClick={() => handleLogin('owner')}
              className="w-full h-16 bg-[#0A2342] hover:bg-[#0A2342]/90 text-white text-lg font-medium rounded-lg transition-all duration-200 flex items-center justify-center gap-3 shadow-md hover:shadow-lg"
            >
              <User className="w-6 h-6" />
              Accedi come Owner
            </Button>

            <Button
              data-testid="login-technician-button"
              onClick={() => handleLogin('technician')}
              className="w-full h-16 bg-[#1D9E75] hover:bg-[#1D9E75]/90 text-white text-lg font-medium rounded-lg transition-all duration-200 flex items-center justify-center gap-3 shadow-md hover:shadow-lg"
            >
              <Wrench className="w-6 h-6" />
              Accedi come Tecnico
            </Button>
          </div>

          {/* Demo info */}
          <div className="mt-8 p-4 bg-slate-50 border border-slate-200 rounded-lg">
            <p className="text-sm text-slate-600 text-center">
              <span className="font-medium text-[#0A2342]">Demo per investitori</span><br />
              Accesso immediato senza credenziali
            </p>
          </div>
        </div>
      </div>

      {/* Right side - Image */}
      <div className="hidden lg:block lg:w-1/2 relative">
        <img
          src="https://images.unsplash.com/photo-1587059481645-b3a17becd6e0?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA4Mzl8MHwxfHNlYXJjaHwxfHxibHVlJTIwb2NlYW58ZW58MHx8fHwxNzczOTIxNTg3fDA&ixlib=rb-4.1.0&q=85"
          alt="Mediterranean Sea"
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0A2342]/50 to-transparent"></div>
        <div className="absolute bottom-12 left-12 text-white">
          <h3 className="text-3xl font-bold mb-2">Il marketplace</h3>
          <p className="text-xl opacity-90">per la nautica italiana</p>
        </div>
      </div>
    </div>
  );
};

export default Login;
