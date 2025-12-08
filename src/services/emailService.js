const nodemailer = require('nodemailer');
const logger = require('../config/logger');

const {
  EMAIL_SERVICE,
  EMAIL_HOST,
  EMAIL_PORT,
  EMAIL_SECURE,
  EMAIL_USER,
  EMAIL_PASS,
  EMAIL_FROM,
  BASE_URL,
  APP_NAME,
} = process.env;

function createTransporter() {
  // Prefer explicit host/port if provided; otherwise use service (e.g., 'gmail')
  if (EMAIL_HOST) {
    return nodemailer.createTransport({
      host: EMAIL_HOST,
      port: EMAIL_PORT ? Number(EMAIL_PORT) : 587,
      secure: EMAIL_SECURE === 'true',
      auth: EMAIL_USER && EMAIL_PASS ? { user: EMAIL_USER, pass: EMAIL_PASS } : undefined,
    });
  }
  return nodemailer.createTransport({
    service: EMAIL_SERVICE || 'gmail',
    auth: {
      user: EMAIL_USER,
      pass: EMAIL_PASS,
    },
  });
}

const transporter = createTransporter();

function buildDisasterHtml(disaster) {
  const appName = APP_NAME || 'Disaster Relief Platform';
  // Use disasterId if available, otherwise use _id (MongoDB ObjectId)
  const disasterId = disaster.disasterId || disaster._id || '';
  const donateUrl = `${BASE_URL || 'http://localhost:3001'}/donate?disasterId=${encodeURIComponent(disasterId)}`;
  const severityBadgeColor =
    (disaster.severity || '').toLowerCase() === 'severe'
      ? '#dc2626'
      : (disaster.severity || '').toLowerCase() === 'high'
      ? '#f59e0b'
      : '#2563eb';

  return `
  <div style="font-family: Arial, Helvetica, sans-serif; background:#f6f9fc; padding:24px;">
    <div style="max-width:640px; margin:0 auto; background:#ffffff; border-radius:10px; overflow:hidden; box-shadow:0 10px 25px rgba(0,0,0,0.06);">
      <div style="background:linear-gradient(135deg, #0ea5e9, #2563eb); color:#fff; padding:20px 24px;">
        <h1 style="margin:0; font-size:22px; letter-spacing:0.3px;">${appName}</h1>
        <p style="margin:6px 0 0; opacity:0.9;">Real-time Disaster Alert</p>
      </div>
      <div style="padding:24px; color:#111827;">
        <h2 style="margin:0 0 8px; font-size:20px;">${disaster.title || 'New Disaster Reported'}</h2>
        <p style="margin:0 0 10px; color:#374151;">
          <strong>Location:</strong> ${disaster.location || 'Unknown'}
          &nbsp;•&nbsp;
          <strong>Type:</strong> ${disaster.type || 'Unknown'}
          &nbsp;•&nbsp;
          <strong>Severity:</strong>
          <span style="display:inline-block; background:${severityBadgeColor}; color:#fff; padding:2px 8px; border-radius:999px; font-size:12px;">
            ${disaster.severity || 'Moderate'}
          </span>
        </p>
        <p style="margin:12px 0 18px; color:#4b5563; line-height:1.55;">
          ${disaster.description || 'A new disaster has been reported. Your help can make a difference.'}
        </p>

        <div style="text-align:center; margin:24px 0;">
          <a href="${donateUrl}" target="_blank" style="background:#0ea5e9; color:#fff; text-decoration:none; padding:12px 20px; border-radius:8px; display:inline-block; font-weight:600;">
            Donate Now
          </a>
        </div>

        <hr style="border:none; border-top:1px solid #e5e7eb; margin:24px 0;" />
        <p style="margin:0; color:#6b7280; font-size:12px;">
          You are receiving this email because you registered on ${appName}. If you didn't expect this, you can ignore it.
        </p>
      </div>
    </div>
  </div>`;
}

async function sendEmail({ to, subject, html }) {
  const from = EMAIL_FROM || EMAIL_USER;
  if (!from) throw new Error('Email FROM/USER not configured');
  return transporter.sendMail({ from, to, subject, html });
}

async function sendDisasterAlert(toEmail, disaster) {
  const subject = `Urgent: ${disaster.title || 'New Disaster'} — ${disaster.location || ''}`;
  const html = buildDisasterHtml(disaster);
  return sendEmail({ to: toEmail, subject, html });
}

module.exports = {
  sendDisasterAlert,
  buildDisasterHtml,
};


