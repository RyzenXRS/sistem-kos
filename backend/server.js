// ============================================================
// SISTEM MANAJEMEN KOST - BACKEND SERVER
// Node.js + Express + MySQL
// ============================================================

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 5000;

// ============================================================
// MIDDLEWARE
// ============================================================
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Buat folder uploads jika belum ada
if (!fs.existsSync('./uploads')) fs.mkdirSync('./uploads');

// ============================================================
// DATABASE CONNECTION POOL
// ============================================================
const db = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'db_kost',
  waitForConnections: true,
  connectionLimit: 10,
});

// Test koneksi database
async function testDB() {
  try {
    const conn = await db.getConnection();
    console.log('✅ Database terhubung!');
    conn.release();
  } catch (err) {
    console.error('❌ Gagal koneksi database:', err.message);
  }
}
testDB();

// ============================================================
// MULTER - UPLOAD FILE
// ============================================================
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, './uploads/'),
  filename: (req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, unique + path.extname(file.originalname));
  }
});
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });

// ============================================================
// JWT MIDDLEWARE
// ============================================================
function authMiddleware(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'Token tidak ditemukan' });
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'kost_secret');
    req.user = decoded;
    next();
  } catch {
    return res.status(401).json({ message: 'Token tidak valid' });
  }
}

function adminOnly(req, res, next) {
  if (req.user.role !== 'admin') return res.status(403).json({ message: 'Akses admin saja' });
  next();
}

// ============================================================
// HELPER: Generate Invoice Number
// ============================================================
function generateInvoice() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const rand = String(Math.floor(Math.random() * 9999)).padStart(4, '0');
  return `INV-${y}${m}${d}-${rand}`;
}

// ============================================================
// =================== AUTH ROUTES ===========================
// ============================================================

// POST /api/auth/login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ message: 'Email dan password wajib diisi' });

    const [rows] = await db.query('SELECT * FROM users WHERE email = ?', [email]);
    if (rows.length === 0) return res.status(401).json({ message: 'Email atau password salah' });

    const user = rows[0];
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).json({ message: 'Email atau password salah' });

    // Ambil data penyewa jika role penyewa
    let penyewaData = null;
    if (user.role === 'penyewa') {
      const [pRows] = await db.query(`
        SELECT p.*, k.kode_kamar, k.tipe_kamar, k.harga_bulan 
        FROM penyewa p LEFT JOIN kamar k ON p.id_kamar = k.id_kamar
        WHERE p.id_user = ?`, [user.id_user]);
      if (pRows.length > 0) penyewaData = pRows[0];
    }

    const token = jwt.sign(
      { id_user: user.id_user, email: user.email, role: user.role, nama: user.nama },
      process.env.JWT_SECRET || 'kost_secret',
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    res.json({
      message: 'Login berhasil',
      token,
      user: { id_user: user.id_user, nama: user.nama, email: user.email, role: user.role },
      penyewa: penyewaData
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/auth/register
app.post('/api/auth/register', async (req, res) => {
  try {
    const { nama, email, password } = req.body;
    if (!nama || !email || !password) return res.status(400).json({ message: 'Semua field wajib diisi' });

    const [exist] = await db.query('SELECT id_user FROM users WHERE email = ?', [email]);
    if (exist.length > 0) return res.status(409).json({ message: 'Email sudah terdaftar' });

    const hashed = await bcrypt.hash(password, 10);
    const [result] = await db.query(
      'INSERT INTO users (nama, email, password, role) VALUES (?, ?, ?, ?)',
      [nama, email, hashed, 'penyewa']
    );

    res.status(201).json({ message: 'Registrasi berhasil', id_user: result.insertId });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/auth/me
app.get('/api/auth/me', authMiddleware, async (req, res) => {
  try {
    const [rows] = await db.query('SELECT id_user, nama, email, role FROM users WHERE id_user = ?', [req.user.id_user]);
    if (rows.length === 0) return res.status(404).json({ message: 'User tidak ditemukan' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ============================================================
// =================== DASHBOARD STATS =======================
// ============================================================

// GET /api/dashboard/stats
app.get('/api/dashboard/stats', authMiddleware, adminOnly, async (req, res) => {
  try {
    const [[kamar]] = await db.query('SELECT COUNT(*) as total, SUM(status_kamar="terisi") as terisi, SUM(status_kamar="kosong") as kosong FROM kamar');
    const [[penyewa]] = await db.query('SELECT COUNT(*) as total FROM penyewa WHERE status_penyewa="aktif"');
    const [[tagihan_pending]] = await db.query('SELECT COUNT(*) as total, COALESCE(SUM(jumlah_tagihan),0) as nominal FROM tagihan WHERE status_tagihan="belum_bayar"');
    const [[pendapatan_bulan]] = await db.query(`
      SELECT COALESCE(SUM(pb.jumlah_bayar),0) as total 
      FROM pembayaran pb 
      WHERE status_bayar='lunas' AND MONTH(tanggal_bayar)=MONTH(NOW()) AND YEAR(tanggal_bayar)=YEAR(NOW())`);
    const [[pengeluaran_bulan]] = await db.query(`
      SELECT COALESCE(SUM(jumlah),0) as total 
      FROM pengeluaran 
      WHERE MONTH(tanggal)=MONTH(NOW()) AND YEAR(tanggal)=YEAR(NOW())`);

    res.json({
      kamar: { total: kamar.total, terisi: kamar.terisi || 0, kosong: kamar.kosong || 0 },
      penyewa: penyewa.total,
      tagihan_pending: { total: tagihan_pending.total, nominal: tagihan_pending.nominal },
      pendapatan_bulan: pendapatan_bulan.total,
      pengeluaran_bulan: pengeluaran_bulan.total,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/dashboard/tagihan-jatuh-tempo
app.get('/api/dashboard/tagihan-jatuh-tempo', authMiddleware, adminOnly, async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT t.*, p.nama_penyewa, k.kode_kamar
      FROM tagihan t 
      JOIN penyewa p ON t.id_penyewa = p.id_penyewa
      JOIN kamar k ON p.id_kamar = k.id_kamar
      WHERE t.status_tagihan != 'lunas' AND t.jatuh_tempo <= DATE_ADD(NOW(), INTERVAL 5 DAY)
      ORDER BY t.jatuh_tempo ASC LIMIT 5`);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ============================================================
// =================== KAMAR ROUTES ==========================
// ============================================================

// GET /api/kamar
app.get('/api/kamar', authMiddleware, async (req, res) => {
  try {
    const { status } = req.query;
    let query = 'SELECT * FROM kamar';
    const params = [];
    if (status) { query += ' WHERE status_kamar = ?'; params.push(status); }
    query += ' ORDER BY kode_kamar';
    const [rows] = await db.query(query, params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/kamar/:id
app.get('/api/kamar/:id', authMiddleware, async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM kamar WHERE id_kamar = ?', [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ message: 'Kamar tidak ditemukan' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/kamar
app.post('/api/kamar', authMiddleware, adminOnly, async (req, res) => {
  try {
    const { kode_kamar, tipe_kamar, harga_bulan, status_kamar, fasilitas } = req.body;
    if (!kode_kamar || !tipe_kamar || !harga_bulan) return res.status(400).json({ message: 'Field wajib tidak lengkap' });

    const [result] = await db.query(
      'INSERT INTO kamar (kode_kamar, tipe_kamar, harga_bulan, status_kamar, fasilitas) VALUES (?,?,?,?,?)',
      [kode_kamar, tipe_kamar, harga_bulan, status_kamar || 'kosong', fasilitas]
    );
    res.status(201).json({ message: 'Kamar berhasil ditambahkan', id_kamar: result.insertId });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ message: 'Kode kamar sudah ada' });
    res.status(500).json({ message: err.message });
  }
});

// PUT /api/kamar/:id
app.put('/api/kamar/:id', authMiddleware, adminOnly, async (req, res) => {
  try {
    const { kode_kamar, tipe_kamar, harga_bulan, status_kamar, fasilitas } = req.body;
    await db.query(
      'UPDATE kamar SET kode_kamar=?, tipe_kamar=?, harga_bulan=?, status_kamar=?, fasilitas=? WHERE id_kamar=?',
      [kode_kamar, tipe_kamar, harga_bulan, status_kamar, fasilitas, req.params.id]
    );
    res.json({ message: 'Kamar berhasil diupdate' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// DELETE /api/kamar/:id
app.delete('/api/kamar/:id', authMiddleware, adminOnly, async (req, res) => {
  try {
    await db.query('DELETE FROM kamar WHERE id_kamar = ?', [req.params.id]);
    res.json({ message: 'Kamar berhasil dihapus' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ============================================================
// =================== PENYEWA ROUTES ========================
// ============================================================

// GET /api/penyewa
app.get('/api/penyewa', authMiddleware, adminOnly, async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT p.*, k.kode_kamar, k.tipe_kamar, k.harga_bulan
      FROM penyewa p 
      LEFT JOIN kamar k ON p.id_kamar = k.id_kamar
      ORDER BY p.created_at DESC`);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/penyewa/me (untuk penyewa login)
app.get('/api/penyewa/me', authMiddleware, async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT p.*, k.kode_kamar, k.tipe_kamar, k.harga_bulan, k.fasilitas
      FROM penyewa p 
      LEFT JOIN kamar k ON p.id_kamar = k.id_kamar
      WHERE p.id_user = ?`, [req.user.id_user]);
    if (rows.length === 0) return res.status(404).json({ message: 'Data penyewa tidak ditemukan' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/penyewa/:id
app.get('/api/penyewa/:id', authMiddleware, async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT p.*, k.kode_kamar, k.tipe_kamar, k.harga_bulan
      FROM penyewa p LEFT JOIN kamar k ON p.id_kamar = k.id_kamar
      WHERE p.id_penyewa = ?`, [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ message: 'Penyewa tidak ditemukan' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/penyewa
app.post('/api/penyewa', authMiddleware, adminOnly, async (req, res) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const { nama_penyewa, no_hp, email, no_ktp, tgl_masuk, id_kamar } = req.body;

    // Cek kamar tersedia
    const [kamar] = await conn.query('SELECT * FROM kamar WHERE id_kamar = ? AND status_kamar = "kosong"', [id_kamar]);
    if (kamar.length === 0) return res.status(400).json({ message: 'Kamar tidak tersedia' });

    // Buat user jika ada email
    let id_user = null;
    if (email) {
      const hashed = await bcrypt.hash('kost123', 10);
      const [ur] = await conn.query(
        'INSERT INTO users (nama, email, password, role) VALUES (?,?,?,?) ON DUPLICATE KEY UPDATE id_user=LAST_INSERT_ID(id_user)',
        [nama_penyewa, email, hashed, 'penyewa']
      );
      id_user = ur.insertId;
    }

    // Insert penyewa
    const [result] = await conn.query(
      'INSERT INTO penyewa (id_user, id_kamar, nama_penyewa, no_hp, email, no_ktp, tgl_masuk, status_penyewa) VALUES (?,?,?,?,?,?,?,?)',
      [id_user, id_kamar, nama_penyewa, no_hp, email, no_ktp, tgl_masuk, 'aktif']
    );

    // Update status kamar
    await conn.query('UPDATE kamar SET status_kamar = "terisi" WHERE id_kamar = ?', [id_kamar]);

    await conn.commit();
    res.status(201).json({ message: 'Penyewa berhasil ditambahkan', id_penyewa: result.insertId });
  } catch (err) {
    await conn.rollback();
    res.status(500).json({ message: err.message });
  } finally {
    conn.release();
  }
});

// PUT /api/penyewa/:id
app.put('/api/penyewa/:id', authMiddleware, adminOnly, async (req, res) => {
  try {
    const { nama_penyewa, no_hp, email, no_ktp, tgl_masuk, tgl_keluar, status_penyewa, id_kamar } = req.body;
    await db.query(
      'UPDATE penyewa SET nama_penyewa=?, no_hp=?, email=?, no_ktp=?, tgl_masuk=?, tgl_keluar=?, status_penyewa=?, id_kamar=? WHERE id_penyewa=?',
      [nama_penyewa, no_hp, email, no_ktp, tgl_masuk, tgl_keluar, status_penyewa, id_kamar, req.params.id]
    );
    // Update status kamar jika penyewa nonaktif
    if (status_penyewa === 'nonaktif' && id_kamar) {
      await db.query('UPDATE kamar SET status_kamar = "kosong" WHERE id_kamar = ?', [id_kamar]);
    }
    res.json({ message: 'Data penyewa berhasil diupdate' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// DELETE /api/penyewa/:id
app.delete('/api/penyewa/:id', authMiddleware, adminOnly, async (req, res) => {
  try {
    const [rows] = await db.query('SELECT id_kamar FROM penyewa WHERE id_penyewa = ?', [req.params.id]);
    if (rows.length > 0) {
      await db.query('UPDATE kamar SET status_kamar = "kosong" WHERE id_kamar = ?', [rows[0].id_kamar]);
    }
    await db.query('DELETE FROM penyewa WHERE id_penyewa = ?', [req.params.id]);
    res.json({ message: 'Penyewa berhasil dihapus' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ============================================================
// =================== TAGIHAN ROUTES ========================
// ============================================================

// GET /api/tagihan
app.get('/api/tagihan', authMiddleware, async (req, res) => {
  try {
    let query = `
      SELECT t.*, p.nama_penyewa, k.kode_kamar
      FROM tagihan t 
      JOIN penyewa p ON t.id_penyewa = p.id_penyewa
      JOIN kamar k ON p.id_kamar = k.id_kamar`;
    const params = [];

    if (req.user.role === 'penyewa') {
      const [py] = await db.query('SELECT id_penyewa FROM penyewa WHERE id_user = ?', [req.user.id_user]);
      if (py.length === 0) return res.json([]);
      query += ' WHERE t.id_penyewa = ?';
      params.push(py[0].id_penyewa);
    }
    query += ' ORDER BY t.created_at DESC';
    const [rows] = await db.query(query, params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/tagihan
app.post('/api/tagihan', authMiddleware, adminOnly, async (req, res) => {
  try {
    const { id_penyewa, bulan_tagihan, jatuh_tempo, jumlah_tagihan, keterangan } = req.body;
    const [result] = await db.query(
      'INSERT INTO tagihan (id_penyewa, bulan_tagihan, jatuh_tempo, jumlah_tagihan, keterangan) VALUES (?,?,?,?,?)',
      [id_penyewa, bulan_tagihan, jatuh_tempo, jumlah_tagihan, keterangan]
    );
    res.status(201).json({ message: 'Tagihan berhasil dibuat', id_tagihan: result.insertId });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/tagihan/generate-bulk
app.post('/api/tagihan/generate-bulk', authMiddleware, adminOnly, async (req, res) => {
  try {
    const { bulan_tagihan, jatuh_tempo } = req.body;
    const [penyewa] = await db.query(`
      SELECT p.id_penyewa, k.harga_bulan 
      FROM penyewa p JOIN kamar k ON p.id_kamar = k.id_kamar
      WHERE p.status_penyewa = 'aktif'`);

    let inserted = 0;
    for (const p of penyewa) {
      const [exist] = await db.query(
        'SELECT id_tagihan FROM tagihan WHERE id_penyewa = ? AND bulan_tagihan = ?',
        [p.id_penyewa, bulan_tagihan]
      );
      if (exist.length === 0) {
        await db.query(
          'INSERT INTO tagihan (id_penyewa, bulan_tagihan, jatuh_tempo, jumlah_tagihan) VALUES (?,?,?,?)',
          [p.id_penyewa, bulan_tagihan, jatuh_tempo, p.harga_bulan]
        );
        inserted++;
      }
    }
    res.json({ message: `${inserted} tagihan berhasil digenerate` });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PUT /api/tagihan/:id
app.put('/api/tagihan/:id', authMiddleware, adminOnly, async (req, res) => {
  try {
    const { bulan_tagihan, jatuh_tempo, jumlah_tagihan, status_tagihan, keterangan } = req.body;
    await db.query(
      'UPDATE tagihan SET bulan_tagihan=?, jatuh_tempo=?, jumlah_tagihan=?, status_tagihan=?, keterangan=? WHERE id_tagihan=?',
      [bulan_tagihan, jatuh_tempo, jumlah_tagihan, status_tagihan, keterangan, req.params.id]
    );
    res.json({ message: 'Tagihan berhasil diupdate' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// DELETE /api/tagihan/:id
app.delete('/api/tagihan/:id', authMiddleware, adminOnly, async (req, res) => {
  try {
    await db.query('DELETE FROM tagihan WHERE id_tagihan = ?', [req.params.id]);
    res.json({ message: 'Tagihan berhasil dihapus' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ============================================================
// =================== PEMBAYARAN ROUTES =====================
// ============================================================

// GET /api/pembayaran
app.get('/api/pembayaran', authMiddleware, async (req, res) => {
  try {
    let query = `
      SELECT pb.*, t.bulan_tagihan, t.jumlah_tagihan, p.nama_penyewa, k.kode_kamar
      FROM pembayaran pb
      JOIN tagihan t ON pb.id_tagihan = t.id_tagihan
      JOIN penyewa p ON t.id_penyewa = p.id_penyewa
      JOIN kamar k ON p.id_kamar = k.id_kamar`;
    const params = [];

    if (req.user.role === 'penyewa') {
      const [py] = await db.query('SELECT id_penyewa FROM penyewa WHERE id_user = ?', [req.user.id_user]);
      if (py.length === 0) return res.json([]);
      query += ' WHERE t.id_penyewa = ?';
      params.push(py[0].id_penyewa);
    }
    query += ' ORDER BY pb.created_at DESC';
    const [rows] = await db.query(query, params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/pembayaran (penyewa upload bukti)
app.post('/api/pembayaran', authMiddleware, upload.single('bukti_bayar'), async (req, res) => {
  try {
    const { id_tagihan, metode_bayar, jumlah_bayar, catatan } = req.body;
    const invoice_number = generateInvoice();
    const bukti_bayar = req.file ? req.file.filename : null;

    const [result] = await db.query(
      'INSERT INTO pembayaran (id_tagihan, invoice_number, tanggal_bayar, metode_bayar, jumlah_bayar, status_bayar, bukti_bayar, catatan) VALUES (?,?,NOW(),?,?,?,?,?)',
      [id_tagihan, invoice_number, metode_bayar, jumlah_bayar, 'pending', bukti_bayar, catatan]
    );
    res.status(201).json({ message: 'Pembayaran berhasil dikirim, menunggu verifikasi', invoice_number, id_pembayaran: result.insertId });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PUT /api/pembayaran/:id/verifikasi (admin verifikasi)
app.put('/api/pembayaran/:id/verifikasi', authMiddleware, adminOnly, async (req, res) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const { status_bayar } = req.body; // lunas / tolak

    const [pb] = await conn.query('SELECT * FROM pembayaran WHERE id_pembayaran = ?', [req.params.id]);
    if (pb.length === 0) return res.status(404).json({ message: 'Pembayaran tidak ditemukan' });

    await conn.query('UPDATE pembayaran SET status_bayar = ? WHERE id_pembayaran = ?',
      [status_bayar === 'lunas' ? 'lunas' : 'pending', req.params.id]);

    if (status_bayar === 'lunas') {
      await conn.query('UPDATE tagihan SET status_tagihan = "lunas" WHERE id_tagihan = ?', [pb[0].id_tagihan]);
    }

    await conn.commit();
    res.json({ message: `Pembayaran berhasil ${status_bayar === 'lunas' ? 'dikonfirmasi' : 'ditolak'}` });
  } catch (err) {
    await conn.rollback();
    res.status(500).json({ message: err.message });
  } finally {
    conn.release();
  }
});

// ============================================================
// =================== PENGELUARAN ROUTES ====================
// ============================================================

// GET /api/pengeluaran
app.get('/api/pengeluaran', authMiddleware, adminOnly, async (req, res) => {
  try {
    const { bulan, tahun } = req.query;
    let query = 'SELECT * FROM pengeluaran';
    const params = [];
    const conditions = [];

    if (bulan) { conditions.push('MONTH(tanggal) = ?'); params.push(bulan); }
    if (tahun) { conditions.push('YEAR(tanggal) = ?'); params.push(tahun); }
    if (conditions.length > 0) query += ' WHERE ' + conditions.join(' AND ');
    query += ' ORDER BY tanggal DESC';

    const [rows] = await db.query(query, params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/pengeluaran
app.post('/api/pengeluaran', authMiddleware, adminOnly, async (req, res) => {
  try {
    const { nama_pengeluaran, kategori, keterangan, tanggal, jumlah } = req.body;
    const [result] = await db.query(
      'INSERT INTO pengeluaran (id_user, nama_pengeluaran, kategori, keterangan, tanggal, jumlah) VALUES (?,?,?,?,?,?)',
      [req.user.id_user, nama_pengeluaran, kategori, keterangan, tanggal, jumlah]
    );
    res.status(201).json({ message: 'Pengeluaran berhasil dicatat', id_pengeluaran: result.insertId });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PUT /api/pengeluaran/:id
app.put('/api/pengeluaran/:id', authMiddleware, adminOnly, async (req, res) => {
  try {
    const { nama_pengeluaran, kategori, keterangan, tanggal, jumlah } = req.body;
    await db.query(
      'UPDATE pengeluaran SET nama_pengeluaran=?, kategori=?, keterangan=?, tanggal=?, jumlah=? WHERE id_pengeluaran=?',
      [nama_pengeluaran, kategori, keterangan, tanggal, jumlah, req.params.id]
    );
    res.json({ message: 'Pengeluaran berhasil diupdate' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// DELETE /api/pengeluaran/:id
app.delete('/api/pengeluaran/:id', authMiddleware, adminOnly, async (req, res) => {
  try {
    await db.query('DELETE FROM pengeluaran WHERE id_pengeluaran = ?', [req.params.id]);
    res.json({ message: 'Pengeluaran berhasil dihapus' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ============================================================
// =================== LAPORAN ROUTES ========================
// ============================================================

// GET /api/laporan/pemasukan
app.get('/api/laporan/pemasukan', authMiddleware, adminOnly, async (req, res) => {
  try {
    const { bulan, tahun } = req.query;
    let conditions = ["pb.status_bayar = 'lunas'"];
    const params = [];
    if (bulan) { conditions.push('MONTH(pb.tanggal_bayar) = ?'); params.push(bulan); }
    if (tahun) { conditions.push('YEAR(pb.tanggal_bayar) = ?'); params.push(tahun); }

    const [rows] = await db.query(`
      SELECT pb.*, t.bulan_tagihan, p.nama_penyewa, k.kode_kamar
      FROM pembayaran pb
      JOIN tagihan t ON pb.id_tagihan = t.id_tagihan
      JOIN penyewa p ON t.id_penyewa = p.id_penyewa
      JOIN kamar k ON p.id_kamar = k.id_kamar
      WHERE ${conditions.join(' AND ')}
      ORDER BY pb.tanggal_bayar DESC`, params);

    const [[summary]] = await db.query(
      `SELECT COALESCE(SUM(pb.jumlah_bayar),0) as total FROM pembayaran pb WHERE ${conditions.join(' AND ')}`, params);

    res.json({ data: rows, total: summary.total });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/laporan/pengeluaran
app.get('/api/laporan/pengeluaran', authMiddleware, adminOnly, async (req, res) => {
  try {
    const { bulan, tahun } = req.query;
    let conditions = [];
    const params = [];
    if (bulan) { conditions.push('MONTH(tanggal) = ?'); params.push(bulan); }
    if (tahun) { conditions.push('YEAR(tanggal) = ?'); params.push(tahun); }

    const where = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';
    const [rows] = await db.query(`SELECT * FROM pengeluaran ${where} ORDER BY tanggal DESC`, params);
    const [[summary]] = await db.query(`SELECT COALESCE(SUM(jumlah),0) as total FROM pengeluaran ${where}`, params);

    res.json({ data: rows, total: summary.total });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/laporan/penyewa
app.get('/api/laporan/penyewa', authMiddleware, adminOnly, async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT p.*, k.kode_kamar, k.tipe_kamar, k.harga_bulan,
        COUNT(t.id_tagihan) as total_tagihan,
        SUM(t.status_tagihan = 'lunas') as tagihan_lunas,
        SUM(t.status_tagihan != 'lunas') as tagihan_pending
      FROM penyewa p
      LEFT JOIN kamar k ON p.id_kamar = k.id_kamar
      LEFT JOIN tagihan t ON p.id_penyewa = t.id_penyewa
      GROUP BY p.id_penyewa ORDER BY p.nama_penyewa`);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/laporan/grafik-bulanan
app.get('/api/laporan/grafik-bulanan', authMiddleware, adminOnly, async (req, res) => {
  try {
    const { tahun } = req.query;
    const y = tahun || new Date().getFullYear();

    const [pemasukan] = await db.query(`
      SELECT MONTH(tanggal_bayar) as bulan, SUM(jumlah_bayar) as total
      FROM pembayaran WHERE status_bayar='lunas' AND YEAR(tanggal_bayar)=?
      GROUP BY MONTH(tanggal_bayar)`, [y]);

    const [pengeluaran] = await db.query(`
      SELECT MONTH(tanggal) as bulan, SUM(jumlah) as total
      FROM pengeluaran WHERE YEAR(tanggal)=?
      GROUP BY MONTH(tanggal)`, [y]);

    const bulanNames = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];
    const result = bulanNames.map((nama, i) => {
      const bln = i + 1;
      const p = pemasukan.find(x => x.bulan === bln);
      const e = pengeluaran.find(x => x.bulan === bln);
      return { bulan: nama, pemasukan: p ? Number(p.total) : 0, pengeluaran: e ? Number(e.total) : 0 };
    });

    res.json(result);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ============================================================
// START SERVER
// ============================================================
app.listen(PORT, () => {
  console.log(`🚀 Server berjalan di http://localhost:${PORT}`);
  console.log(`📝 API Docs: http://localhost:${PORT}/api`);
});
