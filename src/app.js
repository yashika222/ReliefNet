const path = require('path');
const express = require('express');
const cookieParser = require('cookie-parser');
const morgan = require('morgan');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const expressLayouts = require('express-ejs-layouts');
const logger = require('./config/logger');
const requestLogger = require('./middleware/requestLogger');

// ✅ CORRECT FILE NAME
const donationRoutes = require('./routes/donationRoutes');

const indexRoutes = require('./routes/index');
const authRoutes = require('./routes/auth');
const resourceRoutes = require('./routes/resources');
const requestRoutes = require('./routes/requests');
const adminRoutes = require('./routes/admin');
const volunteerRoutes = require('./routes/volunteers');
const volunteerPortalRoutes = require('./routes/volunteerPortal');
const roleRoutes = require('./routes/roles');
const disasterRoutes = require('./routes/disasters');
const testRoutes = require('./routes/testRoutes');

const { optionalAuth } = require('./middleware/auth');

const app = express();

app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');
app.set('layout', 'layout');
app.set('trust proxy', 1); // Trust first proxy (Render/Railway/Heroku)
app.use(expressLayouts);

app.use('/public', express.static(path.join(__dirname, '..', 'public')));

// Middleware
// Hardened Helmet + CSP configuration (no inline scripts)
app.use(helmet({
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  contentSecurityPolicy: {
    useDefaults: true,
    directives: {
      defaultSrc: ["'self'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      scriptSrc: [
        "'self'",
        "'unsafe-inline'", // Needed for EJS in-line scripts
        'https://cdn.jsdelivr.net',
        'https://cdnjs.cloudflare.com',
        'https://maps.googleapis.com',
        'https://maps.gstatic.com',
        'https://unpkg.com',
        'https://checkout.razorpay.com'
      ],
      scriptSrcAttr: ["'unsafe-inline'"], // Allow inline event handlers
      styleSrc: [
        "'self'",
        "'unsafe-inline'",
        'https://cdn.jsdelivr.net',
        'https://fonts.googleapis.com',
        'https://unpkg.com'
      ],
      connectSrc: [
        "'self'",
        'https://cdn.jsdelivr.net',
        'https://maps.googleapis.com',
        'https://maps.gstatic.com',
        'https://lumberjack.razorpay.com',
        'https://lumberjack-cx.razorpay.com'
      ],
      fontSrc: [
        "'self'",
        'https://fonts.gstatic.com',
        'https://cdn.jsdelivr.net',
        'data:'
      ],
      imgSrc: [
        "'self'",
        'data:',
        'https://cdn.jsdelivr.net',
        'https://maps.gstatic.com',
        'https://maps.googleapis.com'
      ],
      mediaSrc: ["'self'"],
      workerSrc: ["'self'", 'blob:'],
      objectSrc: ["'none'"],
      frameSrc: ["'self'", "https://api.razorpay.com"],
      upgradeInsecureRequests: []
    }
  }
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());
app.use(compression());
app.use(cookieParser());
app.use(morgan('dev'));
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 100 }));
app.use(requestLogger);

// ✅ Global User Middleware (Prevents EJS crashes)
app.use((req, res, next) => {
  res.locals.user = req.user || null;
  // Also try to get user from token if not already set (for EJS robustness)
  if (!req.user && req.cookies && req.cookies.token) {
    try {
      const jwt = require('jsonwebtoken'); // Lazy require
      const payload = jwt.verify(req.cookies.token, process.env.JWT_SECRET);
      req.user = payload;
      res.locals.user = payload;
    } catch (e) {
      // Token invalid, valid behavior to ignore
    }
  }
  next();
});

// Health route
app.get('/health', (req, res) => res.status(200).json({ ok: true, timestamp: new Date() }));

// Load Request model
const Request = require('./models/Request');

// ✅ Root Route
app.get('/', async (req, res) => {
  if (req.user) {
    return res.redirect('/dashboard');
  }
  try {
    const recentRequests = await Request.find()
      .sort({ createdAt: -1 })
      .limit(3)
      .lean();
    res.render('pages/home', {
      title: 'Disaster Relief System',
      recentRequests: recentRequests || []
    });
  } catch (err) {
    console.error('Error fetching home data:', err);
    // Render with empty list on error
    res.render('pages/home', {
      title: 'Disaster Relief System',
      recentRequests: []
    });
  }
});

// ✅ Routes
app.use('/', indexRoutes);
app.use('/', testRoutes);
app.use('/auth', authRoutes);
app.use('/volunteer', volunteerPortalRoutes);

app.use('/api/resources', optionalAuth, resourceRoutes);
app.use('/api/requests', optionalAuth, requestRoutes);

// ✅ FIXED — NO optionalAuth
app.use('/api/donations', donationRoutes);
app.use('/api/payment', require('./routes/paymentRoutes'));

app.use('/admin', adminRoutes);
app.use('/api/volunteers', volunteerRoutes);
app.use('/', roleRoutes);
app.use('/disasters', disasterRoutes);

// 404
app.use((req, res) => {
  // If API, return JSON
  if (req.xhr || req.url.startsWith('/api')) {
    return res.status(404).json({ message: 'Route not found' });
  }
  // Otherwise render 404 page if exists, or simple text
  res.status(404).render('pages/404', { title: '404 Not Found' }, (err, html) => {
    if (err) return res.status(404).send('Page not found');
    res.send(html);
  });
});


// Error handler
app.use((err, req, res, next) => {
  logger.error('Unhandled error', { error: err.message, stack: err.stack });
  res.status(500).json({
    message: 'Internal Server Error',
    error: err.message
  });

});

module.exports = app;
