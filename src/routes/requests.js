const express = require('express');
const { body, validationResult, oneOf } = require('express-validator');
const Request = require('../models/Request');

const router = express.Router();

// List requests (public) - standardized response
router.get('/', async (req, res) => {
  try {
    const items = await Request.find().sort({ createdAt: -1 }).limit(500);
    return res.json({ success: true, data: items });
  } catch (err) {
    console.error('GET /api/requests error', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Get single request by ID
router.get('/:id', async (req, res) => {
  try {
    const item = await Request.findById(req.params.id);
    if (!item) return res.status(404).json({ success: false, message: 'Request not found' });
    return res.json({ success: true, data: item });
  } catch (err) {
    console.error('GET /api/requests/:id error', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Create a help request - standardized response and flexible field names
router.post('/', async (req, res) => {
  try {
    const { name, phone, contact, location, item, helpType, quantity, urgency, notes, description } = req.body;
    const resolvedItem = (item || helpType || '').toString().toLowerCase();
    const resolvedUrgency = (urgency || '').toString().toLowerCase();
    if (!name || !location || !resolvedItem) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }
    const q = Number(quantity || 1);
    if (isNaN(q) || q < 1) return res.status(400).json({ success:false, message:'Quantity must be >= 1' });
    const doc = await Request.create({
      name,
      contact: phone || contact || undefined,
      location,
      item: resolvedItem,
      quantity: q,
      urgency: resolvedUrgency || 'low',
      description: notes || description
    });
    console.log('Saved Request id=', doc._id);
    return res.status(201).json({ success: true, data: doc });
  } catch (err) {
    console.error('POST /api/requests error', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Update status (minimal; would be protected in real app)
router.put('/:id/status',
  body('status').isIn(['pending', 'approved', 'rejected', 'in_progress', 'completed']),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    const item = await Request.findByIdAndUpdate(req.params.id, { status: req.body.status }, { new: true });
    if (!item) return res.status(404).json({ message: 'Not found' });
    res.json(item);
  }
);

module.exports = router;
