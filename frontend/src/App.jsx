import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import AdminDashboard from './pages/admin/Dashboard';
import PenyewaDashboard from './pages/penyewa/Dashboard';

function PrivateRoute({ children, roleRequired }) {
  const token = localStorage.getItem('token');
  const user = JSON.parse(localStorage.getItem('user') || '{}');

  if (!token) return <Navigate to="/" />;
  if (roleRequired && user.role !== roleRequired) return <Navigate to="/" />;
  
  return children;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Login />} />
        
        {/* Rute Admin */}
        <Route path="/admin/*" element={
          <PrivateRoute roleRequired="admin">
            <AdminDashboard />
          </PrivateRoute>
        } />

        {/* Rute Penyewa */}
        <Route path="/penyewa/*" element={
          <PrivateRoute roleRequired="penyewa">
            <PenyewaDashboard />
          </PrivateRoute>
        } />
      </Routes>
    </BrowserRouter>
  );
}