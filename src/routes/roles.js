const express = require('express');
const { requireAuth, requireRoles } = require('../middleware/auth');
const VolunteerTask = require('../models/VolunteerTask');
const Campaign = require('../models/Campaign');

const router = express.Router();

// NGO dashboard
router.get('/ngo/dashboard', requireAuth, requireRoles('ngo'), async (req, res) => {
    const campaigns = await Campaign.find({ createdBy: req.user.id }).sort({ createdAt: -1 }).lean();
    res.render('pages/ngo/dashboard', { title: 'NGO Dashboard', user: req.user, campaigns });
});

// NGO create campaign
router.post('/ngo/campaigns', requireAuth, requireRoles('ngo'), async (req, res) => {
  const { title, description, targetAmount, startDate, endDate } = req.body;
  if (!title) return res.status(400).json({ message: 'Title is required' });
  const campaign = await Campaign.create({
    title,
    description,
    targetAmount: targetAmount ? Number(targetAmount) : 0,
    startDate: startDate ? new Date(startDate) : undefined,
    endDate: endDate ? new Date(endDate) : undefined,
    createdBy: req.user.id,
    status: 'pending'
  });
  res.status(201).json({ message: 'Campaign submitted for approval', data: campaign });
});

// NGO list own campaigns
router.get('/ngo/campaigns', requireAuth, requireRoles('ngo'), async (req, res) => {
  const campaigns = await Campaign.find({ createdBy: req.user.id }).sort({ createdAt: -1 }).lean();
  res.json({ data: campaigns });
});

// Volunteer tasks page
router.get('/volunteer/tasks', requireAuth, requireRoles('volunteer'), async (req, res) => {
	const tasks = await VolunteerTask.find({ volunteerId: req.user.id }).sort({ createdAt: -1 }).lean();
	res.render('pages/volunteer/dashboard', { title: 'Volunteer Tasks', user: req.user, tasks });
});

// Donor home
router.get('/donor/home', requireAuth, requireRoles('donor'), async (req, res) => {
    res.render('pages/donor/home', { title: 'Donor Home', user: req.user });
});

module.exports = router;
