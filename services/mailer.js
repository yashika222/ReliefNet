let nodemailer = null;
try { nodemailer = require('nodemailer'); } catch (e) {
  console.warn('Mailer: nodemailer not installed. Emails will be logged to console.');
}

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;

  // 1. Try strict SMTP config
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_SECURE } = process.env;

  // 2. Try generic EMAIL config (common for Gmail)
  const { EMAIL_SERVICE, EMAIL_USER, EMAIL_PASS } = process.env;

  if (SMTP_HOST && SMTP_USER && SMTP_PASS) {
    transporter = nodemailer && nodemailer.createTransport ? nodemailer.createTransport({
      host: SMTP_HOST,
      port: Number(SMTP_PORT || 587),
      secure: String(SMTP_SECURE || '').toLowerCase() === 'true',
      auth: { user: SMTP_USER, pass: SMTP_PASS },
    }) : null;
  } else if (EMAIL_USER && EMAIL_PASS) {
    // Fallback: Use 'gmail' or specified service if no SMTP host
    console.log('Mailer: Using EMAIL_USER/PASS configuration.');
    transporter = nodemailer && nodemailer.createTransport ? nodemailer.createTransport({
      service: EMAIL_SERVICE || 'gmail',
      auth: { user: EMAIL_USER, pass: EMAIL_PASS },
    }) : null;
  } else {
    console.warn('Mailer: No email credentials found (SMTP_ or EMAIL_). Emails will be logged to console.');
    return null;
  }

  return transporter;
}

async function sendMail({ to, subject, html, text }) {
  const tx = getTransporter();
  if (!tx) {
    console.log('[DEV EMAIL] To:', to, 'Subject:', subject, 'Text:', text, 'HTML:', html);
    return { mocked: true };
  }
  const from = process.env.MAIL_FROM || process.env.SMTP_USER || process.env.EMAIL_FROM || process.env.EMAIL_USER;
  return tx.sendMail({ from, to, subject, text, html });
}

module.exports = {
  sendVolunteerAssignment: async (volunteer, task) => {
    const subject = `New Task Assigned: ${task.title}`;
    const text = `Hello ${volunteer.name},\n\nYou have been assigned a new task: ${task.title}.\n${task.description ? 'Description: ' + task.description + '\n' : ''}${task.deadline ? 'Deadline: ' + new Date(task.deadline).toLocaleString() + '\n' : ''}\nPlease log in to your dashboard to view details.\n\nThank you.`;
    return sendMail({ to: volunteer.email, subject, text });
  },
  sendVolunteerWarning: async (volunteer, tasks) => {
    const subject = `Overdue Task Warning`;
    const lines = tasks.map(t => `- ${t.title}${t.deadline ? ' (deadline: ' + new Date(t.deadline).toLocaleDateString() + ')' : ''}`);
    const text = `Hello ${volunteer.name},\n\nThe following tasks are overdue. Please take immediate action:\n\n${lines.join('\n')}\n\nRegards, Admin`;
    return sendMail({ to: volunteer.email, subject, text });
  },
  sendVolunteerApproval: async (volunteer) => {
    const subject = 'Volunteer Status Approved';
    const text = `Hello ${volunteer.name},\n\nYour volunteer account has been approved. You can now log in and begin accepting assignments.\n\nThank you for supporting our relief efforts.\n\nDisaster Relief Team`;
    return sendMail({ to: volunteer.email, subject, text });
  },
  sendVolunteerRejection: async (volunteer) => {
    const subject = 'Volunteer Application Update';
    const text = `Hello ${volunteer.name},\n\nThank you for applying to volunteer with us. At this time, we are unable to approve your application. If you believe this is a mistake, please contact the admin team for assistance.\n\nRegards,\nDisaster Relief Team`;
    return sendMail({ to: volunteer.email, subject, text });
  },
  sendVolunteerBlocked: async (volunteer) => {
    const subject = 'Volunteer Account Temporarily Blocked';
    const text = `Hello ${volunteer.name},\n\nYour volunteer account has been temporarily blocked by an administrator. Please reach out to the admin team to resolve any outstanding issues.\n\nRegards,\nDisaster Relief Team`;
    return sendMail({ to: volunteer.email, subject, text });
  },
  sendVolunteerUnblocked: async (volunteer) => {
    const subject = 'Volunteer Account Restored';
    const text = `Hello ${volunteer.name},\n\nGreat news—your volunteer account has been unblocked and restored. You can continue working on your assigned tasks immediately.\n\nRegards,\nDisaster Relief Team`;
    return sendMail({ to: volunteer.email, subject, text });
  },
  sendVolunteerPasswordReset: async (volunteer, password) => {
    const subject = 'Temporary Volunteer Password';
    const text = `Hello ${volunteer.name},\n\nA new temporary password has been generated for your account:\n\n${password}\n\nPlease log in using this password and update it immediately. For security reasons this password will expire soon.\n\nRegards,\nDisaster Relief Team`;
    return sendMail({ to: volunteer.email, subject, text });
  },
  sendNgoStatusUpdate: async (ngo, status, notes) => {
    const subject = `NGO Application ${status === 'approved' ? 'Approved' : status === 'rejected' ? 'Rejected' : 'Updated'}`;
    const message = status === 'approved'
      ? `Congratulations ${ngo.name}, your NGO registration has been approved. You now have full access to the NGO dashboard.`
      : status === 'rejected'
        ? `Hello ${ngo.name},\n\nUnfortunately your NGO registration was not approved at this time.${notes ? '\n\nNotes:\n' + notes : ''}\n\nPlease contact support if you have questions.`
        : `Hello ${ngo.name},\n\nYour NGO registration status has been updated to ${status}.`;
    return sendMail({ to: ngo.email, subject, text: message });
  },
  sendCampaignStatusUpdate: async (campaign, status) => {
    const subject = `Campaign "${campaign.title}" ${status === 'approved' ? 'Approved' : status === 'rejected' ? 'Rejected' : 'Updated'}`;
    const ngoName = campaign.createdBy?.name || 'your NGO';
    const message = status === 'approved'
      ? `Hello ${ngoName},\n\nGreat news! Your campaign "${campaign.title}" has been approved and is now live on the platform.`
      : status === 'rejected'
        ? `Hello ${ngoName},\n\nWe are sorry to inform you that your campaign "${campaign.title}" was not approved at this time. Please review the submission and resubmit if appropriate.`
        : `Hello ${ngoName},\n\nYour campaign "${campaign.title}" status changed to ${status}.`;
    const to = campaign.createdBy?.email || campaign.contactEmail;
    if (!to) {
      console.warn('Campaign status update email skipped (no recipient)');
      return { skipped: true };
    }
    return sendMail({ to, subject, text: message });
  },
  sendVolunteerReportToAdmin: async (volunteer, task, report) => {
    const subject = `Volunteer Report Submitted: ${task.title}`;
    const html = `
      <h2>New Volunteer Report Submitted</h2>
      <p><strong>Task:</strong> ${task.title}</p>
      <p><strong>Volunteer:</strong> ${volunteer.name} (${volunteer.email})</p>
      ${task.description ? `<p><strong>Task Description:</strong> ${task.description}</p>` : ''}
      ${task.deadline ? `<p><strong>Deadline:</strong> ${new Date(task.deadline).toLocaleDateString()}</p>` : ''}
      <hr>
      <h3>Report Details</h3>
      <p>${report.description.replace(/\n/g, '<br>')}</p>
      ${report.attachments && report.attachments.length > 0 ? `<p><strong>Attachments:</strong> ${report.attachments.length} file(s) attached</p>` : ''}
      <p><strong>Submitted:</strong> ${new Date(report.submittedAt).toLocaleString()}</p>
      <hr>
      <p><a href="${process.env.APP_URL || 'http://localhost:3000'}/admin/volunteer-reports">View Report in Admin Dashboard</a></p>
    `;
    const text = `A volunteer has submitted a report for task: ${task.title}\n\nVolunteer: ${volunteer.name} (${volunteer.email})\nTask: ${task.title}\n${task.description ? 'Description: ' + task.description + '\n' : ''}${task.deadline ? 'Deadline: ' + new Date(task.deadline).toLocaleDateString() + '\n' : ''}\n\nReport:\n${report.description}\n\n${report.attachments && report.attachments.length > 0 ? 'Attachments: ' + report.attachments.length + ' file(s)\n' : ''}\nSubmitted: ${new Date(report.submittedAt).toLocaleString()}\n\nPlease review the report in the admin dashboard: ${process.env.APP_URL || 'http://localhost:3000'}/admin/volunteer-reports\n\nDisaster Relief System`;

    // Get admin email from environment or find admin user
    const adminEmail = process.env.ADMIN_EMAIL;
    if (adminEmail) {
      return sendMail({ to: adminEmail, subject, text, html });
    }
    // If no admin email in env, try to find admin user
    try {
      const User = require('../src/models/User');
      const admin = await User.findOne({ role: 'admin' }).lean();
      if (admin && admin.email) {
        return sendMail({ to: admin.email, subject, text, html });
      }
    } catch (e) {
      console.warn('Could not find admin for report notification:', e.message);
    }
    return { skipped: true, reason: 'No admin email found' };
  },
  sendDonationReceipt: async (donation) => {
    const subject = 'Donation Receipt - Disaster Relief System';
    const html = `
      <h2>Thank You for Your Donation!</h2>
      <p>Dear ${donation.donorName},</p>
      <p>We confirm receiving your generous donation.</p>
      <table style="width: 100%; border-collapse: collapse; margin-top: 10px;">
        <tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>Amount</strong></td><td style="padding: 8px; border: 1px solid #ddd;">₹${donation.amount}</td></tr>
        <tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>Donation ID</strong></td><td style="padding: 8px; border: 1px solid #ddd;">${donation._id}</td></tr>
        <tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>Status</strong></td><td style="padding: 8px; border: 1px solid #ddd;">${donation.paymentStatus}</td></tr>
        <tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>Date</strong></td><td style="padding: 8px; border: 1px solid #ddd;">${new Date().toLocaleDateString()}</td></tr>
      </table>
      <p>Your support helps us provide critical relief to those in need.</p>
      <p>Best Regards,<br>Disaster Relief Team</p>
    `;
    const text = `Dear ${donation.donorName},\n\nThank you for your donation of ₹${donation.amount}.\nDonation ID: ${donation._id}\nStatus: ${donation.paymentStatus}\n\nYour support is appreciated.\n\nDisaster Relief Team`;

    if (donation.email) {
      return sendMail({ to: donation.email, subject, text, html });
    }
    return { skipped: true, reason: 'No donor email' };
  },
  sendCustom: sendMail,
};
