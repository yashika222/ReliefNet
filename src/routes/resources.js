const express = require('express');
const { body, validationResult } = require('express-validator');
const { requireAuth, ensureRole } = require('../middleware/auth');
const Resource = require('../models/Resource');

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const items = await Resource.find().sort({ createdAt: -1 }).limit(500);
    return res.json({ success:true, data: items });
  } catch (err) {
    console.error('GET /api/resources error', err);
    return res.status(500).json({ success:false, message:'Server error' });
  }
});

router.post('/', async (req, res) => {
  try {
    const { provider, contact, resourceType, type, quantity, location, availableFrom, notes } = req.body;
    const rType = resourceType || type;
    if (!rType || quantity == null || !location) {
      return res.status(400).json({ success:false, message:'Missing required fields' });
    }
    const q = Number(quantity);
    if (isNaN(q) || q < 0) return res.status(400).json({ success:false, message:'Quantity must be >= 0' });
    const doc = await Resource.create({
      provider,
      contact,
      resourceType: rType,
      quantity: q,
      location,
      availableFrom: availableFrom ? new Date(availableFrom) : undefined,
      notes
    });
    console.log('Saved Resource id=', doc._id);
    return res.status(201).json({ success:true, data: doc });
  } catch (err) {
    console.error('POST /api/resources error', err);
    return res.status(500).json({ success:false, message:'Server error' });
  }
});

// Admin-only: summary stats for resources
router.get('/summary', requireAuth, ensureRole('admin'), async (req, res) => {
  try {
    const totalCount = await Resource.countDocuments({});
    const byType = await Resource.aggregate([
      { $group: { _id: '$resourceType', count: { $sum: '$quantity' }, items: { $sum: 1 } } }
    ]);
    const summary = {
      totalItems: totalCount,
      totalsByType: byType.reduce((acc, cur) => {
        acc[cur._id || 'other'] = { quantity: cur.count, items: cur.items };
        return acc;
      }, {})
    };
    return res.json({ success: true, data: summary });
  } catch (err) {
    console.error('GET /api/resources/summary error', err);
    return res.status(500).json({ success:false, message:'Server error' });
  }
});

module.exports = router;
