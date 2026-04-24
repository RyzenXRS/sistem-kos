-- ============================================================
-- SISTEM MANAJEMEN KOST - DATABASE SCHEMA
-- MySQL 8.0+
-- ============================================================

CREATE DATABASE IF NOT EXISTS db_kost;
USE db_kost;

-- ============================================================
-- TABEL USERS
-- ============================================================
CREATE TABLE users (
    id_user INT AUTO_INCREMENT PRIMARY KEY,
    nama VARCHAR(100) NOT NULL,
    email VARCHAR(100) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    role ENUM('admin', 'penyewa') NOT NULL DEFAULT 'penyewa',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- ============================================================
-- TABEL KAMAR
-- ============================================================
CREATE TABLE kamar (
    id_kamar INT AUTO_INCREMENT PRIMARY KEY,
    kode_kamar VARCHAR(20) NOT NULL UNIQUE,
    tipe_kamar VARCHAR(50) NOT NULL,
    harga_bulan DECIMAL(12,2) NOT NULL,
    status_kamar ENUM('kosong', 'terisi', 'maintenance') NOT NULL DEFAULT 'kosong',
    fasilitas TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- ============================================================
-- TABEL PENYEWA
-- ============================================================
CREATE TABLE penyewa (
    id_penyewa INT AUTO_INCREMENT PRIMARY KEY,
    id_user INT,
    id_kamar INT,
    nama_penyewa VARCHAR(100) NOT NULL,
    no_hp VARCHAR(20) NOT NULL,
    email VARCHAR(100),
    no_ktp VARCHAR(20),
    tgl_masuk DATE NOT NULL,
    tgl_keluar DATE,
    status_penyewa ENUM('aktif', 'nonaktif') NOT NULL DEFAULT 'aktif',
    foto_ktp VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (id_user) REFERENCES users(id_user) ON DELETE SET NULL,
    FOREIGN KEY (id_kamar) REFERENCES kamar(id_kamar) ON DELETE SET NULL
);

-- ============================================================
-- TABEL TAGIHAN
-- ============================================================
CREATE TABLE tagihan (
    id_tagihan INT AUTO_INCREMENT PRIMARY KEY,
    id_penyewa INT NOT NULL,
    bulan_tagihan VARCHAR(20) NOT NULL,
    jatuh_tempo DATE NOT NULL,
    jumlah_tagihan DECIMAL(12,2) NOT NULL,
    status_tagihan ENUM('belum_bayar', 'lunas', 'jatuh_tempo') NOT NULL DEFAULT 'belum_bayar',
    keterangan TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (id_penyewa) REFERENCES penyewa(id_penyewa) ON DELETE CASCADE
);

-- ============================================================
-- TABEL PEMBAYARAN
-- ============================================================
CREATE TABLE pembayaran (
    id_pembayaran INT AUTO_INCREMENT PRIMARY KEY,
    id_tagihan INT NOT NULL,
    invoice_number VARCHAR(50) NOT NULL UNIQUE,
    tanggal_bayar DATE NOT NULL,
    metode_bayar ENUM('transfer', 'tunai', 'qris') NOT NULL DEFAULT 'transfer',
    jumlah_bayar DECIMAL(12,2) NOT NULL,
    status_bayar ENUM('pending', 'verifikasi', 'lunas') NOT NULL DEFAULT 'pending',
    bukti_bayar VARCHAR(255),
    catatan TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (id_tagihan) REFERENCES tagihan(id_tagihan) ON DELETE CASCADE
);

-- ============================================================
-- TABEL PENGELUARAN
-- ============================================================
CREATE TABLE pengeluaran (
    id_pengeluaran INT AUTO_INCREMENT PRIMARY KEY,
    id_user INT,
    nama_pengeluaran VARCHAR(100) NOT NULL,
    kategori ENUM('listrik', 'air', 'internet', 'kebersihan', 'perbaikan', 'lainnya') NOT NULL DEFAULT 'lainnya',
    keterangan TEXT,
    tanggal DATE NOT NULL,
    jumlah DECIMAL(12,2) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (id_user) REFERENCES users(id_user) ON DELETE SET NULL
);

-- ============================================================
-- TABEL LAPORAN
-- ============================================================
CREATE TABLE laporan (
    id_laporan INT AUTO_INCREMENT PRIMARY KEY,
    id_user INT,
    judul_laporan VARCHAR(150) NOT NULL,
    tipe_laporan ENUM('penyewa', 'tagihan', 'pembayaran', 'pengeluaran') NOT NULL,
    periode VARCHAR(20) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (id_user) REFERENCES users(id_user) ON DELETE SET NULL
);

-- ============================================================
-- INDEX UNTUK PERFORMA
-- ============================================================
CREATE INDEX idx_penyewa_kamar ON penyewa(id_kamar);
CREATE INDEX idx_tagihan_penyewa ON tagihan(id_penyewa);
CREATE INDEX idx_pembayaran_tagihan ON pembayaran(id_tagihan);
CREATE INDEX idx_pengeluaran_tanggal ON pengeluaran(tanggal);

-- ============================================================
-- SAMPLE DATA
-- ============================================================

-- Password untuk semua user adalah: password123
-- Hash bcrypt dari 'password123'
INSERT INTO users (nama, email, password, role) VALUES
('Admin Kost', 'admin@kost.com', '$2b$10$YourHashHere', 'admin'),
('Budi Santoso', 'budi@email.com', '$2b$10$YourHashHere', 'penyewa'),
('Siti Aminah', 'siti@email.com', '$2b$10$YourHashHere', 'penyewa'),
('Rizky Pratama', 'rizky@email.com', '$2b$10$YourHashHere', 'penyewa');

INSERT INTO kamar (kode_kamar, tipe_kamar, harga_bulan, status_kamar, fasilitas) VALUES
('K-101', 'Standard', 800000, 'terisi', 'AC, Kasur, Lemari'),
('K-102', 'Standard', 800000, 'kosong', 'AC, Kasur, Lemari'),
('K-103', 'Deluxe', 1200000, 'terisi', 'AC, Kasur, Lemari, TV, Kamar Mandi Dalam'),
('K-104', 'Deluxe', 1200000, 'kosong', 'AC, Kasur, Lemari, TV, Kamar Mandi Dalam'),
('K-201', 'VIP', 1800000, 'terisi', 'AC, Kasur, Lemari, TV, Kamar Mandi, Dapur Mini'),
('K-202', 'VIP', 1800000, 'maintenance', 'AC, Kasur, Lemari, TV, Kamar Mandi, Dapur Mini');

INSERT INTO penyewa (id_user, id_kamar, nama_penyewa, no_hp, email, no_ktp, tgl_masuk, status_penyewa) VALUES
(2, 1, 'Budi Santoso', '08123456789', 'budi@email.com', '3201234567890001', '2024-01-01', 'aktif'),
(3, 3, 'Siti Aminah', '08234567890', 'siti@email.com', '3201234567890002', '2024-02-01', 'aktif'),
(4, 5, 'Rizky Pratama', '08345678901', 'rizky@email.com', '3201234567890003', '2024-03-01', 'aktif');

INSERT INTO tagihan (id_penyewa, bulan_tagihan, jatuh_tempo, jumlah_tagihan, status_tagihan) VALUES
(1, 'April 2025', '2025-04-10', 800000, 'lunas'),
(1, 'Mei 2025', '2025-05-10', 800000, 'belum_bayar'),
(2, 'April 2025', '2025-04-10', 1200000, 'lunas'),
(2, 'Mei 2025', '2025-05-10', 1200000, 'belum_bayar'),
(3, 'April 2025', '2025-04-10', 1800000, 'jatuh_tempo'),
(3, 'Mei 2025', '2025-05-10', 1800000, 'belum_bayar');

INSERT INTO pembayaran (id_tagihan, invoice_number, tanggal_bayar, metode_bayar, jumlah_bayar, status_bayar) VALUES
(1, 'INV-2025040001', '2025-04-08', 'transfer', 800000, 'lunas'),
(3, 'INV-2025040002', '2025-04-09', 'qris', 1200000, 'lunas');

INSERT INTO pengeluaran (id_user, nama_pengeluaran, kategori, keterangan, tanggal, jumlah) VALUES
(1, 'Tagihan Listrik April', 'listrik', 'PLN bulan April 2025', '2025-04-05', 350000),
(1, 'Tagihan Air April', 'air', 'PDAM bulan April 2025', '2025-04-05', 120000),
(1, 'Biaya WiFi April', 'internet', 'IndiHome 50Mbps', '2025-04-01', 300000),
(1, 'Perbaikan Keran K-201', 'perbaikan', 'Ganti keran bocor', '2025-04-12', 85000);
