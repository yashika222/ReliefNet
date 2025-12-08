const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Middleware to check if user is authenticated (for web pages)
function requireAuth(req, res, next) {
  const token = req.cookies.token || req.headers.authorization?.replace('Bearer ', '');
  
  if (!token) {
    return res.redirect('/login');
  }
  
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = payload;
    next();
  } catch (err) {
    res.clearCookie('token');
    return res.redirect('/login');
  }
}

// Middleware to check if user is authenticated (for API routes)
function verifyToken(req, res, next) {
  const authHeader = req.headers.authorization || '';
  let token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  // Fallback to cookie token for same-origin browser requests
  if (!token && req.cookies && req.cookies.token) {
    token = req.cookies.token;
  }
  if (!token) return res.status(401).json({ message: 'No token provided' });
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = payload;
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Invalid token' });
  }
}

// Middleware to check if user is authenticated but allow access to login/signup
function optionalAuth(req, res, next) {
  const token = req.cookies.token || req.headers.authorization?.replace('Bearer ', '');
  
  if (token) {
    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET);
      req.user = payload;
    } catch (err) {
      res.clearCookie('token');
    }
  }
  next();
}

function requireRoles(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ message: 'Unauthorized' });
    if (!roles.includes(req.user.role)) {
      if (req.accepts('html')) {
        return res.status(403).send('Access Denied');
      }
      return res.status(403).json({ message: 'Forbidden' });
    }
    next();
  };
}

function ensureRole(role) {
  return (req, res, next) => {
    if (!req.user) {
      if (req.accepts('html')) {
        return res.redirect('/login');
      }
      return res.status(401).json({ message: 'Unauthorized' });
    }

    if (req.user.role !== role) {
      const acceptsJson = req.headers.accept?.includes('application/json') || req.originalUrl?.includes('/api');
      if (acceptsJson) {
        return res.status(403).json({ message: 'Forbidden' });
      }
      return res.status(403).send('Access Denied');
    }

    return next();
  };
}

// Middleware to redirect authenticated users away from login/signup
function redirectIfAuthenticated(req, res, next) {
  if (req.user) {
    // Redirect to role-specific dashboard instead of generic dashboard
    if (req.user.role === 'admin') return res.redirect('/admin/dashboard');
    if (req.user.role === 'ngo') return res.redirect('/ngo/dashboard');
    if (req.user.role === 'volunteer') return res.redirect('/volunteer/dashboard');
    if (req.user.role === 'donor') return res.redirect('/donor/home');
    return res.redirect('/dashboard');
  }
  next();
}

module.exports = { 
  requireAuth, 
  verifyToken, 
  optionalAuth, 
  requireRoles, 
  ensureRole,
  redirectIfAuthenticated 
};
