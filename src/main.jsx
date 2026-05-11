import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import App from './App.jsx';
import AdminDashboard from './pages/AdminDashboard.jsx';
import './index.css';

const ProtectedRoute = ({ children, allowedRoles }) => {
  const [role, setRole] = useState(localStorage.getItem('user_role') || 'sales');

  useEffect(() => {
    localStorage.setItem('user_role', role);
  }, [role]);

  if (!allowedRoles.includes(role)) {
    return (
      <div className="flex flex-col items-center justify-center h-screen gap-4 bg-slate-50 dark:bg-slate-950">
        <p className="text-red-500 font-bold">Access Denied: Current role is "{role}"</p>
        <select
          value={role}
          onChange={(e) => setRole(e.target.value)}
          className="px-3 py-2 border rounded bg-white dark:bg-slate-800 dark:text-white"
        >
          <option value="sales">Sales</option>
          <option value="supervisor">Supervisor</option>
          <option value="admin">Admin</option>
        </select>
        <p className="text-xs text-slate-400">Change role to bypass guard</p>
      </div>
    );
  }
  return children;
};

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<App />} />
        <Route path="/admin" element={
          <ProtectedRoute allowedRoles={['admin']}>
            <AdminDashboard />
          </ProtectedRoute>
        } />
        <Route path="/supervisor" element={
          <ProtectedRoute allowedRoles={['supervisor', 'admin']}>
            <div className="p-10 text-center text-slate-500">Supervisor Analytics Route (Extend as needed)</div>
          </ProtectedRoute>
        } />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
);