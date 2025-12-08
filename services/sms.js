let twilio = null;
try { twilio = require('twilio'); } catch (e) {
  console.warn('SMS: twilio not installed. SMS will be logged to console.');
}

let client = null;
function getClient() {
  if (client) return client;
  const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN } = process.env;
  if (!twilio || !TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) return null;
  client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
  return client;
}

async function sendSMS({ to, body }) {
  const c = getClient();
  const from = process.env.TWILIO_FROM;
  if (!c || !from) {
    console.log('[DEV SMS] To:', to, 'From:', from, 'Body:', body);
    return { mocked: true };
  }
  return c.messages.create({ to, from, body });
}

module.exports = {
  async sendVolunteerAssignment(volunteer, task) {
    const body = `New task assigned: ${task.title}${task.deadline ? ' (deadline ' + new Date(task.deadline).toLocaleDateString() + ')' : ''}`;
    // volunteer.contact?.phone expected; fallback no-op
    const to = volunteer.contact?.phone;
    if (!to) return { skipped: 'no-phone' };
    return sendSMS({ to, body });
  },
  async sendVolunteerWarning(volunteer, tasks) {
    const overdueCount = tasks.length;
    const body = `You have ${overdueCount} overdue task(s). Please update status.`;
    const to = volunteer.contact?.phone;
    if (!to) return { skipped: 'no-phone' };
    return sendSMS({ to, body });
  },
  async sendCustom(to, body) {
    return sendSMS({ to, body });
  }
};
