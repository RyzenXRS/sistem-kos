import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom'; 
import { Users, Home, Wallet, Receipt } from 'lucide-react';
import api from '../../services/api';

export default function AdminDashboard() {
  const [stats, setStats] = useState(null);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const { data } = await api.get('/dashboard/stats');
      setStats(data);
    } catch (err) {
      console.error('Gagal mengambil data statistik');
    }
  };

  const formatRupiah = (number) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(number);
  };

  if (!stats) return <div className="p-8 text-center">Memuat dashboard...</div>;

  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* Sidebar Sederhana */}
      <aside className="w-64 bg-brand-900 text-white min-h-screen p-4 hidden md:block">
      <h1 className="text-2xl font-bold mb-8 text-center border-b border-brand-600 pb-4">SIKOSSANKU</h1>
      <nav className="space-y-2">
        {/* Ubah tag <a> menjadi <Link> dan href menjadi to */}
        <Link to="/admin" className="flex items-center space-x-2 bg-brand-600 p-3 rounded-lg">
          <Home size={20}/> <span>Dashboard</span>
        </Link>
        
        <Link to="/admin/penyewa" className="flex items-center space-x-2 hover:bg-brand-600 p-3 rounded-lg transition">
          <Users size={20}/> <span>Data Penyewa</span>
        </Link>
        
        <Link to="/admin/tagihan" className="flex items-center space-x-2 hover:bg-brand-600 p-3 rounded-lg transition">
          <Receipt size={20}/> <span>Tagihan</span>
            </Link>
          </nav>
        </aside>

      {/* Main Content */}
      <main className="flex-1 p-8">
        <header className="flex justify-between items-center mb-8 bg-white p-4 rounded-xl shadow-sm border">
          <h2 className="text-xl font-semibold text-gray-800">Overview Admin</h2>
          <button className="text-red-500 text-sm font-medium hover:underline" onClick={() => { localStorage.clear(); window.location.href='/'; }}>Logout</button>
        </header>

        {/* Card Statistik */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <StatCard title="Total Kamar" value={`${stats.kamar.terisi} / ${stats.kamar.total} Terisi`} icon={<Home className="text-blue-500" />} />
          <StatCard title="Penyewa Aktif" value={stats.penyewa} icon={<Users className="text-green-500" />} />
          <StatCard title="Pendapatan Bulan Ini" value={formatRupiah(stats.pendapatan_bulan)} icon={<Wallet className="text-brand-500" />} />
          <StatCard title="Tagihan Pending" value={stats.tagihan_pending.total} subtitle={formatRupiah(stats.tagihan_pending.nominal)} icon={<Receipt className="text-orange-500" />} />
        </div>

        {/* Tempat Tabel (Bisa dilanjutkan dengan CRUD) */}
        <div className="bg-white rounded-xl shadow-sm border p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Aksi Cepat</h3>
          <p className="text-gray-500 text-sm">Gunakan menu di sidebar untuk mengelola Kamar, Penyewa, dan Laporan.</p>
        </div>
      </main>
    </div>
  );
}

function StatCard({ title, value, subtitle, icon }) {
  return (
    <div className="bg-white p-6 rounded-xl shadow-sm border flex items-center space-x-4">
      <div className="p-3 bg-gray-50 rounded-full">{icon}</div>
      <div>
        <p className="text-sm text-gray-500 font-medium">{title}</p>
        <p className="text-xl font-bold text-gray-800">{value}</p>
        {subtitle && <p className="text-xs text-red-500 mt-1">{subtitle}</p>}
      </div>
    </div>
  );
}