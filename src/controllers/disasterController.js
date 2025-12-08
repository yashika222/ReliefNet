// src/controllers/disasterController.js
const Disaster = require('../models/Disaster');
const axios = require('axios');
const User = require('../models/User');
const { sendDisasterAlert } = require('../services/emailService');

/* ------------------------------------------------------------
 ✅ Utility: Normalize missing fields
------------------------------------------------------------- */
function safe(value, fallback = 'Unknown') {
  return value && value !== '' ? value : fallback;
}

/* ------------------------------------------------------------
 ✅ Fetch latest disaster data from ReliefWeb API
------------------------------------------------------------- */
async function fetchDisasterAPI() {
  try {
    const res = await axios.get(
      'https://api.reliefweb.int/v1/disasters?appname=reliefweb&limit=20&sort[]=date:desc'
    );

    return res.data.data.map((item) => {
      const fields = item.fields;

      return {
        disasterId: item.id,

        title: safe(fields.name),
        type: safe(
          Array.isArray(fields.type) && fields.type.length
            ? fields.type[0].name
            : 'General'
        ),
        location: safe(
          Array.isArray(fields.country) && fields.country.length
            ? fields.country[0].name
            : 'Unknown'
        ),

        severity: safe(fields.severity, 'Moderate'),

        date: fields.date?.created ? new Date(fields.date.created) : new Date(),

        description: safe(fields.description, 'No description available.'),

        isActive: true
      };
    });
  } catch (err) {
    console.error('❌ FAILED to fetch ReliefWeb API:', err.message);
    return [];
  }
}

/* ------------------------------------------------------------
 ✅ Sync disasters with MongoDB (avoids duplicates)
------------------------------------------------------------- */
async function syncDisasters() {
  const apiData = await fetchDisasterAPI();
  if (!apiData.length) return { synced: 0, new: 0 };

  let newCount = 0;
  const newDisasters = [];

  for (const d of apiData) {
    const exists = await Disaster.findOne({ disasterId: d.disasterId });

    if (!exists) {
      const created = await Disaster.create(d);
      newDisasters.push(created);
      newCount++;
    } else {
      await Disaster.updateOne({ disasterId: d.disasterId }, { $set: d });
    }
  }

  console.log(`✅ Disasters synced: ${apiData.length} | New: ${newCount}`);

  // 📩 Send email alerts for newly created disasters
  if (newDisasters.length > 0) {
    await notifyUsersAboutNewDisasters(newDisasters);
  }

  return { synced: apiData.length, new: newCount };
}

/* ------------------------------------------------------------
 ✅ Email alert handler (safe parallel batching)
------------------------------------------------------------- */
async function notifyUsersAboutNewDisasters(docs) {
  try {
    const users = await User.find({}, { email: 1 }).lean();
    const emails = users.map((u) => u.email).filter(Boolean);
    if (!emails.length) return;

    console.log(`📩 Sending alerts to ${emails.length} users...`);

    for (const d of docs) {
      await Promise.allSettled(
        emails.map((email) => sendDisasterAlert(email, d))
      );
    }

    console.log('✅ Email alerts sent successfully.');
  } catch (err) {
    console.error('❌ Failed sending disaster alerts:', err.message);
  }
}

/* ------------------------------------------------------------
 ✅ GET /disasters (renders UI)
------------------------------------------------------------- */
exports.getDisastersPage = async (req, res) => {
  try {
    const disasters = await Disaster.find({ isActive: true })
      .sort({ date: -1 })
      .limit(20);

    res.render('disasters/disasters', {
      title: 'Live Disasters',
      disasters,
      lastUpdatedAt: new Date()
    });
  } catch (err) {
    console.error('❌ Page render failed:', err);
    res.status(500).render('error', {
      title: 'Error',
      message: 'Failed to load disasters'
    });
  }
};

/* ------------------------------------------------------------
 ✅ GET /disasters/data (returns JSON)
------------------------------------------------------------- */
exports.getDisastersData = async (req, res) => {
  try {
    const disasters = await Disaster.find({ isActive: true })
      .sort({ date: -1 })
      .limit(20);

    res.json({ data: disasters, lastUpdatedAt: new Date() });
  } catch (err) {
    console.error('❌ API /disasters/data failed:', err);
    res.status(500).json({ data: [], error: 'Failed to fetch data' });
  }
};

/* ------------------------------------------------------------
 ✅ Auto sync task (cron compatible)
------------------------------------------------------------- */
exports.autoSync = async () => {
  console.log('🔄 Auto syncing disasters...');
  return syncDisasters();
};

/* ------------------------------------------------------------
 ✅ Expose notifier for manual disaster creation
------------------------------------------------------------- */
exports.notifyUsersOfNewDisaster = notifyUsersAboutNewDisasters;
