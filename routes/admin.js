const express = require('express');
const router = express.Router();

// GET /admin/login
router.get('/login', (req, res) => {
  res.render('admin/login', { title: 'Admin Login | BICEC', error: null });
});

// GET /admin — Dashboard (auth handled client-side via localStorage JWT)
router.get('/', (req, res) => {
  res.render('admin/dashboard', { title: 'Admin Dashboard | BICEC' });
});

module.exports = router;
