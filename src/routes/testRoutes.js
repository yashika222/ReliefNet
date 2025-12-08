const express = require('express');
const router = express.Router();
const Disaster = require('../models/Disaster');
const User = require('../models/User');
const { sendDisasterAlert } = require('../services/emailService');

/**
 * Test route to create a dummy disaster and send emails to all registered users
 * GET /test-email
 * 
 * Usage: Visit http://localhost:3001/test-email in browser or use curl
 */
router.get('/test-email', async (req, res) => {
  try {
    // Create a test disaster
    const disaster = await Disaster.create({
      disasterId: `TEST-${Date.now()}`,
      title: 'Cyclone in Odisha',
      type: 'Cyclone',
      location: 'Odisha, India',
      severity: 'Severe',
      description: 'Cyclone warning issued – relief operations underway. Immediate assistance needed for affected coastal regions.',
      date: new Date(),
      isActive: true,
    });

    console.log(`✅ Test disaster created: ${disaster.title}`);

    // Fetch all registered users
    const users = await User.find({}, 'email name').lean();
    
    if (!users || users.length === 0) {
      return res.status(400).send(`
        <h2>❌ No Registered Users Found</h2>
        <p>Please register at least one user at <a href="/auth/signup">/auth/signup</a> before testing emails.</p>
        <p>Users in database: ${users.length}</p>
      `);
    }

    // Send emails to all users
    const emailResults = [];
    for (const user of users) {
      if (user.email) {
        try {
          await sendDisasterAlert(user.email, disaster);
          console.log(`📧 Email sent to ${user.email}`);
          emailResults.push({ email: user.email, status: 'success' });
        } catch (err) {
          console.error(`❌ Failed to send email to ${user.email}:`, err.message);
          emailResults.push({ email: user.email, status: 'failed', error: err.message });
        }
      }
    }

    const successCount = emailResults.filter(r => r.status === 'success').length;
    const failCount = emailResults.filter(r => r.status === 'failed').length;

    // Return HTML response for browser testing
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Email Test Results</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; max-width: 800px; margin: 0 auto; }
          .success { color: #28a745; }
          .error { color: #dc3545; }
          .info { background: #e7f3ff; padding: 15px; border-radius: 5px; margin: 10px 0; }
          table { width: 100%; border-collapse: collapse; margin: 20px 0; }
          th, td { padding: 10px; text-align: left; border-bottom: 1px solid #ddd; }
          th { background: #f8f9fa; }
        </style>
      </head>
      <body>
        <h1>✅ Email Test Results</h1>
        
        <div class="info">
          <strong>Test Disaster Created:</strong><br>
          Title: ${disaster.title}<br>
          Location: ${disaster.location}<br>
          Severity: ${disaster.severity}<br>
          Disaster ID: ${disaster.disasterId || disaster._id}
        </div>

        <div class="info">
          <strong>Summary:</strong><br>
          Total Users: ${users.length}<br>
          <span class="success">✅ Emails Sent: ${successCount}</span><br>
          ${failCount > 0 ? `<span class="error">❌ Failed: ${failCount}</span>` : ''}
        </div>

        <h2>Email Status Details:</h2>
        <table>
          <thead>
            <tr>
              <th>Email</th>
              <th>Status</th>
              <th>Message</th>
            </tr>
          </thead>
          <tbody>
            ${emailResults.map(r => `
              <tr>
                <td>${r.email}</td>
                <td class="${r.status === 'success' ? 'success' : 'error'}">
                  ${r.status === 'success' ? '✅ Sent' : '❌ Failed'}
                </td>
                <td>${r.error || 'Success'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <div style="margin-top: 30px; padding: 15px; background: #f8f9fa; border-radius: 5px;">
          <h3>Next Steps:</h3>
          <ul>
            <li>Check the inbox of each user email above</li>
            <li>Click the "Donate Now" button in the email</li>
            <li>Verify it redirects to: <code>${process.env.BASE_URL || 'http://localhost:3001'}/donate?disasterId=${disaster.disasterId || disaster._id}</code></li>
          </ul>
        </div>

        <p style="margin-top: 20px;">
          <a href="/disasters">View All Disasters</a> | 
          <a href="/donate">Go to Donation Page</a>
        </p>
      </body>
      </html>
    `);
  } catch (error) {
    console.error('❌ Test email route error:', error);
    res.status(500).send(`
      <h2>❌ Error Sending Emails</h2>
      <p>${error.message}</p>
      <p>Check your .env configuration and ensure:</p>
      <ul>
        <li>EMAIL_USER and EMAIL_PASS are set correctly</li>
        <li>You're using a Gmail App Password (not regular password)</li>
        <li>MongoDB connection is working</li>
      </ul>
    `);
  }
});

module.exports = router;

