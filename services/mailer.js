let nodemailer = null;
try { nodemailer = require('nodemailer'); } catch (e) {
  console.warn('Mailer: nodemailer not installed. Emails will be logged to console.');
}

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_SECURE } = process.env;
  if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASS) {
    console.warn('Mailer: SMTP env not fully configured; emails will be logged to console.');
    return null;
  }
  transporter = nodemailer && nodemailer.createTransport ? nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT),
    secure: String(SMTP_SECURE || '').toLowerCase() === 'true',
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  }) : null;
  return transporter;
}

async function sendMail({ to, subject, html, text }) {
  const tx = getTransporter();
  if (!tx) {
    console.log('[DEV EMAIL] To:', to, 'Subject:', subject, 'Text:', text, 'HTML:', html);
    return { mocked: true };
  }
  const from = process.env.MAIL_FROM || process.env.SMTP_USER;
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
  sendCustom: sendMail,
};
