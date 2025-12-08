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
        'https://cdn.jsdelivr.net',
        'https://cdnjs.cloudflare.com',
        'https://maps.googleapis.com',
        'https://maps.gstatic.com',
        'https://unpkg.com'
      ],
      scriptSrcAttr: ["'none'"],
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
        'https://maps.gstatic.com'
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
      frameSrc: ["'self'"],
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

// Health route
app.get('/health', (req, res) => res.json({ ok: true }));

// ✅ Routes
app.use('/', indexRoutes);
app.use('/', testRoutes);
app.use('/auth', authRoutes);
app.use('/volunteer', volunteerPortalRoutes);

app.use('/api/resources', optionalAuth, resourceRoutes);
app.use('/api/requests', optionalAuth, requestRoutes);

// ✅ FIXED — NO optionalAuth
app.use('/api/donations', donationRoutes);

app.use('/admin', adminRoutes);
app.use('/api/volunteers', volunteerRoutes);
app.use('/', roleRoutes);
app.use('/disasters', disasterRoutes);

// 404
app.use((req, res) => {
  return res.status(404).render('pages/404', { title: 'Not Found' });
});

// Error handler
app.use((err, req, res, next) => {
  logger.error('Unhandled error', { error: err.message, stack: err.stack });
  if (req.accepts('html')) {
    return res.status(500).render('pages/500', { title: 'Server Error' });
  }
  res.status(500).json({ message: 'Internal Server Error' });
});

module.exports = app;
