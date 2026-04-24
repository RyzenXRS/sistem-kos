const bcrypt = require('bcryptjs');
const mysql = require('mysql2/promise');
require('dotenv').config();

async function fix() {
  try {
    // Koneksi ke database
    const db = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'db_kost',
    });

    // Membuat hash dari kata "password123"
    const hashedPassword = await bcrypt.hash('password123', 10);

    // Mengupdate semua user dengan password baru
    await db.execute('UPDATE users SET password = ?', [hashedPassword]);

    console.log('✅ Berhasil! Semua password user sekarang adalah: password123');
    process.exit();
  } catch (err) {
    console.error('❌ Gagal mengupdate password:', err.message);
    process.exit(1);
  }
}

fix();