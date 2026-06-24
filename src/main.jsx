import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import App from './App.jsx';
import AdminDashboard from './pages/AdminDashboard.jsx';
import Login from './pages/Login.jsx';
import './index.css';

const ProtectedRoute = ({ children, allowedRoles }) => {
  const token = localStorage.getItem('token');
  const role = localStorage.getItem('user_role');

  if (!token) return <Navigate to="/login" replace />;
  if (allowedRoles && !allowedRoles.includes(role)) return <Navigate to="/" replace />;
  return children;
};

// Responsive layout wrapper: mobile card-like, desktop wide centered
const MobileLayout = ({ children }) => (
  <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex justify-center">
    <div className="w-full max-w-lg lg:max-w-[1400px] mx-auto p-4 pt-6">{children}</div>
  </div>
);

// Full-width wrapper
const FullWidthLayout = ({ children }) => (
  <div className="min-h-screen bg-slate-50 dark:bg-slate-950 w-full">{children}</div>
);

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={
          <ProtectedRoute allowedRoles={['sales', 'supervisor', 'admin']}>
            <MobileLayout>
              <App />
            </MobileLayout>
          </ProtectedRoute>
        } />
        <Route path="/admin" element={
          <ProtectedRoute allowedRoles={['admin']}>
            <FullWidthLayout>
              <AdminDashboard />
            </FullWidthLayout>
          </ProtectedRoute>
        } />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
);