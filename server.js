require('dotenv').config();
const express  = require('express');
const { Pool } = require('pg');
const bcrypt   = require('bcryptjs');
const jwt      = require('jsonwebtoken');
const cors     = require('cors');
const path     = require('path');

const app    = express();
const PORT   = process.env.PORT || 3000;
const SECRET = process.env.JWT_SECRET;

if (!SECRET) {
  console.error('❌ JWT_SECRET belum diset di environment variable. Server dihentikan.');
  process.exit(1);
}
if (!process.env.DATABASE_URL) {
  console.error('❌ DATABASE_URL belum diset di environment variable. Server dihentikan.');
  process.exit(1);
}

// ── Middleware ──
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ── Database Postgres (Neon/Supabase) ──
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false } // dibutuhkan untuk Neon/Supabase
});

async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id         SERIAL PRIMARY KEY,
      username   TEXT UNIQUE NOT NULL,
      password   TEXT NOT NULL,
      full_name  TEXT NOT NULL,
      role       TEXT DEFAULT 'user',
      entity     TEXT DEFAULT 'ARG',
      site       TEXT DEFAULT 'AHO',
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);

  const { rows } = await pool.query('SELECT COUNT(*)::int AS cnt FROM users');
  if (rows[0].cnt === 0) {
    // Seed user awal — password diambil dari env var, BUKAN hardcoded.
    // Set ADMIN_PASSWORD dan IVANEKA_PASSWORD di environment sebelum first run.
    const adminPass   = process.env.ADMIN_PASSWORD;
    const ivanekaPass = process.env.IVANEKA_PASSWORD;

    if (!adminPass || !ivanekaPass) {
      console.warn('⚠️  Tabel users kosong tapi ADMIN_PASSWORD / IVANEKA_PASSWORD tidak diset.');
      console.warn('⚠️  Set environment variable tersebut lalu restart server untuk membuat user awal.');
      return;
    }

    const hashedAdmin = bcrypt.hashSync(adminPass, 10);
    await pool.query(
      `INSERT INTO users (username, password, full_name, role, entity, site)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      ['admin', hashedAdmin, 'Administrator', 'admin', 'ARG', 'AHO']
    );

    const hashedIvaneka = bcrypt.hashSync(ivanekaPass, 10);
    await pool.query(
      `INSERT INTO users (username, password, full_name, role, entity, site)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      ['ivaneka', hashedIvaneka, 'IVANEKA', 'user', 'ARG', 'AHO']
    );

    console.log('✅ User awal berhasil dibuat (admin, ivaneka). Password dari environment variable.');
  }
}

// ── Middleware: verifikasi JWT ──
function authMiddleware(req, res, next) {
  const auth = req.headers['authorization'];
  if (!auth) return res.status(401).json({ message: 'Token tidak ditemukan' });
  const token = auth.split(' ')[1];
  try {
    req.user = jwt.verify(token, SECRET);
    next();
  } catch {
    res.status(401).json({ message: 'Token tidak valid atau sudah expired' });
  }
}

// ── ROUTES ──

app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password)
      return res.status(400).json({ message: 'Username dan password wajib diisi' });

    const { rows } = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
    const user = rows[0];
    if (!user)
      return res.status(401).json({ message: 'Username atau password salah' });

    const valid = bcrypt.compareSync(password, user.password);
    if (!valid)
      return res.status(401).json({ message: 'Username atau password salah' });

    const token = jwt.sign(
      { id: user.id, username: user.username, full_name: user.full_name,
        role: user.role, entity: user.entity, site: user.site },
      SECRET,
      { expiresIn: '8h' }
    );

    res.json({
      token,
      user: {
        id:        user.id,
        username:  user.username,
        full_name: user.full_name,
        role:      user.role,
        entity:    user.entity,
        site:      user.site
      }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ message: 'Terjadi kesalahan pada server' });
  }
});

app.post('/api/logout', authMiddleware, (req, res) => {
  res.json({ message: 'Logout berhasil' });
});

app.get('/api/me', authMiddleware, (req, res) => {
  res.json({ user: req.user });
});

app.post('/api/forgot-password', async (req, res) => {
  try {
    const { username } = req.body;
    const { rows } = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
    if (!rows[0])
      return res.status(404).json({ message: 'Username tidak ditemukan' });
    // Di production: kirim email reset password sungguhan
    res.json({ message: `Link reset password telah dikirim ke email terdaftar untuk user: ${username}` });
  } catch (err) {
    console.error('Forgot-password error:', err);
    res.status(500).json({ message: 'Terjadi kesalahan pada server' });
  }
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.get('/dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

initDb()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`\n🚀 MyARG Server berjalan di port ${PORT}`);
    });
  })
  .catch(err => {
    console.error('❌ Gagal inisialisasi database:', err);
    process.exit(1);
  });
