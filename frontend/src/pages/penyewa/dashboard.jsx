import { useEffect, useState } from 'react';
import api from '../../services/api';

export default function PenyewaDashboard() {
  const [profile, setProfile] = useState(null);
  const [tagihan, setTagihan] = useState([]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const resProfile = await api.get('/penyewa/me');
      setProfile(resProfile.data);

      const resTagihan = await api.get('/tagihan');
      setTagihan(resTagihan.data);
    } catch (err) {
      console.error(err);
    }
  };

  if (!profile) return <div className="p-8">Memuat profil...</div>;

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-5xl mx-auto">
        <header className="flex justify-between items-center bg-white p-4 rounded-xl shadow-sm border mb-6">
          <div>
            <h1 className="text-xl font-bold text-gray-800">Halo, {profile.nama_penyewa}</h1>
            <p className="text-sm text-gray-500">Kamar: {profile.kode_kamar} ({profile.tipe_kamar})</p>
          </div>
          <button className="text-red-500 text-sm font-medium" onClick={() => { localStorage.clear(); window.location.href='/'; }}>Logout</button>
        </header>

        <div className="bg-white rounded-xl shadow-sm border p-6">
          <h2 className="text-lg font-bold mb-4 border-b pb-2">Tagihan Anda</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 text-gray-600 text-sm">
                  <th className="p-3 border-b">Bulan</th>
                  <th className="p-3 border-b">Jatuh Tempo</th>
                  <th className="p-3 border-b">Jumlah</th>
                  <th className="p-3 border-b">Status</th>
                  <th className="p-3 border-b">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {tagihan.map((t) => (
                  <tr key={t.id_tagihan} className="text-sm text-gray-800 border-b hover:bg-gray-50">
                    <td className="p-3">{t.bulan_tagihan}</td>
                    <td className="p-3">{new Date(t.jatuh_tempo).toLocaleDateString('id-ID')}</td>
                    <td className="p-3">Rp {Number(t.jumlah_tagihan).toLocaleString('id-ID')}</td>
                    <td className="p-3">
                      <span className={`px-2 py-1 rounded text-xs font-semibold ${t.status_tagihan === 'lunas' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        {t.status_tagihan.toUpperCase()}
                      </span>
                    </td>
                    <td className="p-3">
                      {t.status_tagihan !== 'lunas' && (
                        <button className="bg-brand-500 text-white px-3 py-1 rounded text-xs hover:bg-brand-600">Bayar</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}