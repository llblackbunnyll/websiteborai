require('dotenv').config();
const express = require('express');
const session = require('express-session');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// ─── View Engine ───────────────────────────────────────────────────────────────
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// ─── Middleware ─────────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
  secret: process.env.SESSION_SECRET || 'bicec-super-secret-key-2026',
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false, maxAge: 24 * 60 * 60 * 1000 } // 24 hours
}));

// ─── Routes ─────────────────────────────────────────────────────────────────────
const indexRouter = require('./routes/index');
const adminRouter = require('./routes/admin');
const apiRouter = require('./routes/api');

app.use('/', indexRouter);
app.use('/admin', adminRouter);
app.use('/api', apiRouter);

// ─── 404 Handler ────────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).render('404', { title: 'Page Not Found' });
});

// ─── Error Handler ───────────────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('[Error]', err.stack);
  res.status(500).json({ message: 'Internal server error' });
});

// ─── Start ───────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🚀 Server running at http://localhost:${PORT}`);
  console.log(`📋 Admin Panel: http://localhost:${PORT}/admin`);
  console.log(`🔌 API: http://localhost:${PORT}/api`);
});
