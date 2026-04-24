import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { KeyRound, Mail } from 'lucide-react';
import api from '../services/api';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      const response = await api.post('/auth/login', { email, password });
      
      // Simpan token & user data
      localStorage.setItem('token', response.data.token);
      localStorage.setItem('user', JSON.stringify(response.data.user));

      // Redirect berdasarkan role
      if (response.data.user.role === 'admin') {
        navigate('/admin');
      } else {
        navigate('/penyewa');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Terjadi kesalahan');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="bg-white p-8 rounded-xl shadow-lg w-full max-w-md border-t-4 border-brand-500">
        <h2 className="text-3xl font-bold text-center text-gray-800 mb-2">SIKOSSANKU</h2>
        <p className="text-center text-gray-500 mb-8">Sistem Manajemen Kost Modern</p>
        
        {error && <div className="bg-red-100 text-red-600 p-3 rounded mb-4 text-sm">{error}</div>}

        <form onSubmit={handleLogin} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Mail className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="email"
                className="pl-10 w-full border border-gray-300 rounded-lg p-2.5 focus:ring-brand-500 focus:border-brand-500"
                placeholder="admin@kost.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <KeyRound className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="password"
                className="pl-10 w-full border border-gray-300 rounded-lg p-2.5 focus:ring-brand-500 focus:border-brand-500"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
          </div>
          <button
            type="submit"
            className="w-full bg-brand-600 text-white font-semibold rounded-lg p-3 hover:bg-brand-900 transition duration-200"
          >
            Masuk
          </button>
        </form>
      </div>
    </div>
  );
}