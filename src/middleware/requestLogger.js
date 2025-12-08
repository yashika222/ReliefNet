const Log = require('../models/Log');

async function requestLogger(req, res, next) {
  res.on('finish', () => {
    try {
      Log.create({
        level: 'info',
        message: `${req.method} ${req.originalUrl} ${res.statusCode}`,
        meta: {
          ip: req.ip,
          user: req.user || null,
        },
      });
    } catch {}
  });
  next();
}

module.exports = requestLogger;
