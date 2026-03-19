import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import axios from 'axios';
import '@/App.css';
import Login from '@/pages/Login';
import OwnerDashboard from '@/pages/OwnerDashboard';
import TechnicianDashboard from '@/pages/TechnicianDashboard';
import Checklist from '@/pages/Checklist';
import CreateTicket from '@/pages/CreateTicket';
import TicketDetail from '@/pages/TicketDetail';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND_URL}/api`;

export const UserContext = React.createContext();

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
          <Route path="/" element={<Login />} />
          <Route path="/owner/dashboard" element={user?.role === 'owner' ? <OwnerDashboard /> : <Navigate to="/" />} />
          <Route path="/owner/checklist" element={user?.role === 'owner' ? <Checklist /> : <Navigate to="/" />} />
          <Route path="/owner/ticket/create" element={user?.role === 'owner' ? <CreateTicket /> : <Navigate to="/" />} />
          <Route path="/owner/ticket/:id" element={user?.role === 'owner' ? <TicketDetail /> : <Navigate to="/" />} />
          <Route path="/technician/dashboard" element={user?.role === 'technician' ? <TechnicianDashboard /> : <Navigate to="/" />} />
          <Route path="/technician/ticket/:id" element={user?.role === 'technician' ? <TicketDetail /> : <Navigate to="/" />} />
        </Routes>
      </BrowserRouter>
    </UserContext.Provider>
  );
}

export default App;
