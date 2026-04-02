const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret';

/**
 * Middleware: verify JWT from Authorization header (for API routes)
 */
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return res.status(401).json({ message: 'Access denied. No token provided.' });

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ message: 'Invalid or expired token.' });
    req.user = user;
    next();
  });
};

/**
 * Middleware: verify JWT from cookie or Authorization header (for admin web pages)
 */
const requireAdminPage = (req, res, next) => {
  const token = req.cookies?.adminToken || 
                (req.headers['authorization'] && req.headers['authorization'].split(' ')[1]);

  if (!token) return res.redirect('/admin/login');

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.redirect('/admin/login');
    req.user = user;
    next();
  });
};

module.exports = { authenticateToken, requireAdminPage };
