// frontend/src/App.js

import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import Login from './pages/Login';
import TemplateSelection from './pages/TemplateSelection';
import Confirmation from './pages/Confirmation';
import Dashboard from './pages/Dashboard';
import api from './services/api';
import './App.css';

// Protected route wrapper
const ProtectedRoute = ({ children }) => {
  const [loading, setLoading] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const token = api.getToken();
        if (!token) {
          setAuthenticated(false);
          setLoading(false);
          return;
        }

        await api.getMe();
        setAuthenticated(true);
      } catch (error) {
        api.setToken(null);
        setAuthenticated(false);
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, []);

  if (loading) {
    return <div className="loading-container">Loading...</div>;
  }

  return authenticated ? children : <Navigate to="/login" replace />;
};

// Auth callback handler
const AuthCallback = () => {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const handleCallback = async () => {
      const params = new URLSearchParams(location.search);
      const token = params.get('token');
      const error = params.get('error');

      if (error) {
        navigate(`/login?error=${error}`);
        return;
      }

      if (token) {
        api.setToken(token);
        
        // Check onboarding status
        try {
          const status = await api.getOnboardingStatus();
          if (status.data.isComplete) {
            navigate('/dashboard');
          } else {
            navigate('/templates');
          }
        } catch (err) {
          navigate('/templates');
        }
      } else {
        navigate('/login');
      }
    };

    handleCallback();
  }, [location, navigate]);

  return <div className="loading-container">Completing authentication...</div>;
};

function App() {
  return (
    <Router>
      <div className="App">
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/auth/callback" element={<AuthCallback />} />
          
          <Route
            path="/templates"
            element={
              <ProtectedRoute>
                <TemplateSelection />
              </ProtectedRoute>
            }
          />
          
          <Route
            path="/confirm"
            element={
              <ProtectedRoute>
                <Confirmation />
              </ProtectedRoute>
            }
          />
          
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          />
          
          <Route path="/" element={<Navigate to="/login" replace />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;

