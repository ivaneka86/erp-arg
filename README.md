# MyARG ERP System
**PT Amanda Retailindo Group**

Sudah dimigrasi dari SQLite lokal ke **PostgreSQL (Neon)** + siap deploy gratis ke **Render.com**, supaya data tidak hilang saat server restart/redeploy.

---

## 🚀 Deploy ke Hosting Gratis (Render + Neon)

### Bagian 1 — Buat Database Postgres Gratis (Neon)

1. Daftar gratis di **https://neon.tech** (bisa login dengan GitHub/Google)
2. Buat project baru, beri nama misal `myarg-db`
3. Di dashboard project, buka **Connection string** — copy nilai yang formatnya:
   ```
   postgresql://user:password@host/dbname?sslmode=require
   ```
4. Simpan string ini, akan dipakai sebagai `DATABASE_URL` di langkah berikut.

> Neon free tier: 0.5 GB storage, cukup untuk ERP skala kecil-menengah. Database tidak akan terhapus walau aplikasi sleep.

### Bagian 2 — Upload Project ke GitHub

1. Buat repository baru di GitHub (bisa **private**, supaya tidak terlihat publik)
2. Upload semua file di folder ini (kecuali `node_modules`, sudah di-`.gitignore`)

### Bagian 3 — Deploy ke Render

1. Daftar gratis di **https://render.com** (bisa login dengan GitHub)
2. Klik **New +** → **Web Service**
3. Hubungkan ke repository GitHub yang sudah dibuat
4. Isi konfigurasi:
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Instance Type**: Free
5. Di bagian **Environment Variables**, tambahkan:

   | Key | Value |
   |---|---|
   | `DATABASE_URL` | connection string dari Neon (Bagian 1) |
   | `JWT_SECRET` | string acak panjang — generate dengan perintah di bawah |
   | `ADMIN_PASSWORD` | password admin yang kuat (HANYA untuk seed user pertama) |
   | `IVANEKA_PASSWORD` | password ivaneka yang kuat (HANYA untuk seed user pertama) |

   Generate `JWT_SECRET` di komputer lokal:
   ```
   node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
   ```

6. Klik **Create Web Service** dan tunggu proses deploy selesai (±2-5 menit)
7. Render akan memberi URL publik seperti `https://myarg-app.onrender.com`

> ⚠️ **Catatan free tier Render**: server akan "sleep" otomatis setelah ~15 menit tidak ada traffic, dan butuh ~30-50 detik untuk "bangun" lagi saat ada request pertama. Ini normal di free tier — data di Postgres (Neon) tetap aman meski server sleep, karena database-nya terpisah dari server.

### Bagian 4 — Hapus Environment Variable Password Setelah User Pertama Dibuat

Setelah login pertama kali berhasil dengan `admin` / password yang kamu set, **hapus** `ADMIN_PASSWORD` dan `IVANEKA_PASSWORD` dari Environment Variables di Render (tidak perlu lagi, dan demi keamanan). Server tidak akan terganggu — variable itu hanya dipakai sekali saat tabel users masih kosong.

---

## 👤 Setelah Pertama Kali Login

Segera ganti password dari halaman profil/setting (jika tersedia), atau update langsung lewat database Neon (gunakan SQL Editor di dashboard Neon) dengan password yang sudah di-hash bcrypt.

---

## 💻 Development Lokal

1. Salin `.env.example` jadi `.env`, isi semua nilainya (pakai `DATABASE_URL` dari Neon juga, atau Postgres lokal jika ada)
2. Install dependencies:
   ```
   npm install
   ```
3. Jalankan:
   ```
   npm start
   ```
4. Buka browser ke `http://localhost:3000`

---

## 📁 Struktur File

```
myarg-app/
├── server.js          ← Backend Express + Postgres
├── .env.example       ← Template environment variable (copy jadi .env)
├── .gitignore
├── package.json
└── public/
    ├── login.html
    └── index.html
```

---

## 🔐 API Endpoints

| Method | URL                   | Keterangan            |
|--------|-----------------------|-----------------------|
| POST   | /api/login            | Login, dapat token    |
| GET    | /api/me               | Cek user aktif        |
| POST   | /api/logout           | Logout                |
| POST   | /api/forgot-password  | Request reset password|

---

## ⚠️ Catatan Keamanan Penting

- `JWT_SECRET` **wajib** diset sebagai environment variable, jangan pernah hardcode di kode atau commit ke git
- Jangan jadikan repository GitHub **public** jika berisi data/konfigurasi internal perusahaan
- Fitur `/api/forgot-password` saat ini hanya simulasi (belum kirim email sungguhan) — perlu integrasi layanan email (misal Resend, SendGrid) untuk production sungguhan
- Pertimbangkan menambah rate-limiting pada `/api/login` agar tidak rentan brute-force (misal pakai `express-rate-limit`)
