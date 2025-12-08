// src/routes/disasters.js
const express = require('express');
const router = express.Router();
const axios = require('axios');
const Disaster = require('../models/Disaster');
const disasterController = require('../controllers/disasterController');
const { requireAuth } = require('../middleware/auth');
const User = require('../models/User');
const { sendDisasterAlert } = require('../services/emailService');

// 🌍 ReliefWeb API endpoint (filters for India)
const API_URL = 'https://api.reliefweb.int/v1/disasters?appname=disastertracker&filter[field]=country&filter[value]=India&limit=10';

// 🧠 Helper: Convert ReliefWeb data to your schema
function mapApiData(apiDisaster) {
  const fields = apiDisaster.fields || {};
  return {
    disasterId: apiDisaster.id,
    title: fields.name || 'Unnamed Disaster',
    type: fields.type?.[0]?.name || 'Unknown',
    location: fields.primary_country?.name || 'India',
    date: fields.date?.created || new Date(),
    severity: fields.status || 'Active',
    description: fields.description || '',
    isActive: true
  };
}

// 🧩 Route 1: Fetch and sync disasters from API (with email notifications for new disasters)
router.get('/sync', async (req, res) => {
  try {
    const { data } = await axios.get(API_URL);
    const disasters = data.data || [];
    const newlyCreated = [];

    for (const item of disasters) {
      const mapped = mapApiData(item);
      const existing = await Disaster.findOne({ disasterId: mapped.disasterId });
      
      if (!existing) {
        // New disaster - create it
        const created = await Disaster.create(mapped);
        newlyCreated.push(created);
      } else {
        // Existing disaster - just update
        await Disaster.updateOne({ _id: existing._id }, { $set: mapped });
      }
    }

    // Send email alerts to all registered users for newly created disasters
    if (newlyCreated.length > 0) {
      try {
        const users = await User.find({}, { email: 1, _id: 0 }).lean();
        const emails = users.map((u) => u.email).filter(Boolean);
        
        if (emails.length > 0) {
          for (const disaster of newlyCreated) {
            await Promise.allSettled(
              emails.map((to) => sendDisasterAlert(to, disaster))
            );
          }
          console.log(`📧 Sent email alerts for ${newlyCreated.length} new disasters to ${emails.length} registered users`);
        }
      } catch (emailErr) {
        console.error('❌ Failed to send email alerts:', emailErr.message);
      }
    }

    res.json({ 
      success: true, 
      count: disasters.length,
      newlyCreated: newlyCreated.length,
      emailsSent: newlyCreated.length > 0 ? 'Yes' : 'No new disasters'
    });
  } catch (err) {
    console.error('API Sync Error:', err.message);
    res.status(500).json({ success: false, error: 'Failed to sync disasters' });
  }
});

// 🧩 Route 2: Get all disasters (used by frontend)
router.get('/data', async (req, res) => {
  try {
    const disasters = await Disaster.find({ isActive: true }).sort({ date: -1 });
    res.json({ data: disasters, lastUpdatedAt: new Date() });
  } catch (err) {
    res.status(500).json({ data: [], error: err.message });
  }
});

// 🧩 Route 2b: Seed demo data (when external API is empty)
router.post('/demo-seed', async (req, res) => {
  try {
    const demos = [
      {
        disasterId: 'DEMO-ODISHA-CYCLONE',
        title: 'Cyclone in Odisha',
        type: 'Cyclone',
        location: 'Odisha, India',
        date: new Date(),
        severity: 'Severe',
        description: 'High winds and heavy rainfall impacting coastal districts.',
        isActive: true
      },
      {
        disasterId: 'DEMO-ASSAM-FLOOD',
        title: 'Floods in Assam',
        type: 'Flood',
        location: 'Assam, India',
        date: new Date(),
        severity: 'Moderate',
        description: 'River overflow causing displacement in multiple villages.',
        isActive: true
      },
      {
        disasterId: 'DEMO-GUJARAT-QUAKE',
        title: 'Earthquake near Kutch',
        type: 'Earthquake',
        location: 'Kutch, Gujarat, India',
        date: new Date(),
        severity: 'Mild',
        description: 'Shallow tremors felt across the region. Minor damages reported.',
        isActive: true
      },
      {
        disasterId: 'DEMO-GUJARAT-QUAKE',
        title: 'Earthquake ',
        type: 'Earthquake',
        location: 'Kutch',
        date: new Date(),
        severity: 'high alert',
        description: 'Shallow tremors felt across the region. Minor damages reported.',
        isActive: true
      }
    ];
    for (const d of demos) {
      await Disaster.updateOne({ disasterId: d.disasterId }, { $set: d }, { upsert: true });
    }
    const items = await Disaster.find({ isActive: true }).sort({ date: -1 });
    res.json({ success: true, count: items.length });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Demo mode: simulate new disasters arriving over time
let demoInterval = null;
let demoQueue = [];

router.post('/demo-start', async (req, res) => {
  try {
    if (demoInterval) {
      return res.json({ success: true, message: 'Demo already running' });
    }
    demoQueue = [
      {
        disasterId: 'DEMO-NEW-1',
        title: 'Severe Cyclone (Demo)',
        type: 'Cyclone',
        location: 'Odisha, India',
        date: new Date(),
        severity: 'Severe',
        description: 'Demo: Cyclone winds and rain',
        isActive: true
      },
      {
        disasterId: 'DEMO-NEW-2',
        title: 'River Flooding (Demo)',
        type: 'Flood',
        location: 'Assam, India',
        date: new Date(Date.now() + 1000 * 60),
        severity: 'Moderate',
        description: 'Demo: Overflowing river banks',
        isActive: true
      },
      {
        disasterId: 'DEMO-NEW-3',
        title: 'Earthquake Tremors (Demo)',
        type: 'Earthquake',
        location: 'Kutch, Gujarat, India',
        date: new Date(Date.now() + 1000 * 120),
        severity: 'Mild',
        description: 'Demo: Tremors observed',
        isActive: true
      },
      {
        disasterId: 'DEMO-NEW-4',
        title: 'Earthquake Tremors ',
        type: 'Earthquake',
        location: 'Kutch',
        date: new Date(Date.now() + 1000 * 120),
        severity: 'high',
        description: 'Demo: Tremors observed',
        isActive: true
      }
    ];
    // Ensure base demo data exists
    for (const d of demoQueue) {
      await Disaster.updateOne({ disasterId: d.disasterId + '-seed' }, { $setOnInsert: { ...d, disasterId: d.disasterId + '-seed' } }, { upsert: true });
    }
    // Start interval to add one new item every 10 seconds
    demoInterval = setInterval(async () => {
      const next = demoQueue.shift();
      if (!next) {
        clearInterval(demoInterval);
        demoInterval = null;
        return;
      }
      const existing = await Disaster.findOne({ disasterId: next.disasterId });
      if (!existing) {
        // Only send emails for truly new disasters
        const created = await Disaster.create(next);
        try {
          const users = await User.find({}, { email: 1, _id: 0 }).lean();
          const emails = users.map((u) => u.email).filter(Boolean);
          if (emails.length > 0) {
            await Promise.allSettled(
              emails.map((to) => sendDisasterAlert(to, created))
            );
            console.log(`📧 Demo: Sent email alerts for ${created.title} to ${emails.length} users`);
          }
        } catch (emailErr) {
          console.error('❌ Demo email alert failed:', emailErr.message);
        }
      } else {
        await Disaster.updateOne({ _id: existing._id }, { $set: next });
      }
    }, 10000);
    return res.json({ success: true, message: 'Demo started', remaining: demoQueue.length });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/demo-stop', (req, res) => {
  if (demoInterval) {
    clearInterval(demoInterval);
    demoInterval = null;
  }
  return res.json({ success: true, message: 'Demo stopped' });
});

router.get('/demo-status', (req, res) => {
  return res.json({ active: Boolean(demoInterval), remaining: demoQueue.length });
});

// 🔁 Trigger sync via controller (includes email notifications for new disasters)
router.post('/sync-and-notify', requireAuth, async (req, res) => {
  try {
    const result = await disasterController.autoSync();
    return res.json({ success: true, result });
  } catch (e) {
    console.error('POST /disasters/sync-and-notify:', e);
    return res.status(500).json({ success: false, message: 'Sync failed' });
  }
});

// 🧩 Route 3: Render EJS page
router.get('/', async (req, res) => {
  try {
    const disasters = await Disaster.find({ isActive: true }).sort({ date: -1 });
    res.render('pages/disasters', { disasters, lastUpdatedAt: new Date() });
  } catch (err) {
    res.render('pages/disasters', { disasters: [], lastUpdatedAt: null });
  }
});

module.exports = router;
