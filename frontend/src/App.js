import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import axios from 'axios';
import '@/App.css';
import Login from '@/pages/Login';
import RealLogin from '@/pages/RealLogin';
import Register from '@/pages/Register';
import OwnerDashboard from '@/pages/OwnerDashboard';
import TechnicianDashboard from '@/pages/TechnicianDashboard';
import Checklist from '@/pages/Checklist';
import CreateTicket from '@/pages/CreateTicket';
import TicketDetail from '@/pages/TicketDetail';
import RequestIntervention from '@/pages/RequestIntervention';
import OnboardingYacht from '@/pages/OnboardingYacht';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND_URL}/api`;

export const UserContext = React.createContext();

const ResetDemo = () => {
  const navigate = useNavigate();
  
  useEffect(() => {
    const resetData = async () => {
      try {
        await axios.post(`${API}/reset-demo`);
        localStorage.removeItem('yacht_user');
        localStorage.removeItem('yacht_token');
        setTimeout(() => {
          navigate('/login');
        }, 500);
      } catch (error) {
        console.error('Reset error:', error);
        navigate('/login');
      }
    };
    resetData();
  }, [navigate]);
  
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC]">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-[#0A2342] mb-2">Resetting demo data...</h2>
        <p className="text-slate-600">Redirecting to login...</p>
      </div>
    </div>
  );
};

function App() {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);

  const login = (userData, userToken) => {
    setUser(userData);
    setToken(userToken);
    localStorage.setItem('yacht_user', JSON.stringify(userData));
    localStorage.setItem('yacht_token', userToken);
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('yacht_user');
    localStorage.removeItem('yacht_token');
  };

  useEffect(() => {
    const savedUser = localStorage.getItem('yacht_user');
    const savedToken = localStorage.getItem('yacht_token');
    if (savedUser && savedToken) {
      setUser(JSON.parse(savedUser));
      setToken(savedToken);
    }
  }, []);

  return (
    <UserContext.Provider value={{ user, token, login, logout }}>
      <BrowserRouter>
        <Routes>
          {/* Redirect root to login */}
          <Route path="/" element={<Navigate to="/login" replace />} />
          
          {/* Auth routes */}
          <Route path="/login" element={<RealLogin />} />
          <Route path="/register" element={<Register />} />
          <Route path="/demo" element={<Login />} />
          <Route path="/reset-demo" element={<ResetDemo />} />
          
          {/* Protected Owner routes */}
          <Route path="/owner/dashboard" element={user?.role === 'owner' ? <OwnerDashboard /> : <Navigate to="/login" />} />
          <Route path="/owner/checklist" element={user?.role === 'owner' ? <Checklist /> : <Navigate to="/login" />} />
          <Route path="/owner/request" element={user?.role === 'owner' ? <RequestIntervention /> : <Navigate to="/login" />} />
          <Route path="/owner/onboarding" element={user?.role === 'owner' ? <OnboardingYacht /> : <Navigate to="/login" />} />
          <Route path="/owner/ticket/create" element={user?.role === 'owner' ? <CreateTicket /> : <Navigate to="/login" />} />
          <Route path="/owner/ticket/:id" element={user?.role === 'owner' ? <TicketDetail /> : <Navigate to="/login" />} />
          
          {/* Protected Technician routes */}
          <Route path="/technician/dashboard" element={user?.role === 'technician' ? <TechnicianDashboard /> : <Navigate to="/login" />} />
          <Route path="/technician/ticket/:id" element={user?.role === 'technician' ? <TicketDetail /> : <Navigate to="/login" />} />
        </Routes>
      </BrowserRouter>
    </UserContext.Provider>
  );
}

export default App;
