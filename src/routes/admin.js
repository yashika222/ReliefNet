// src/routes/admin.js
const express = require('express');
const { body, validationResult } = require('express-validator');
const {
  verifyToken,
  requireAuth,
  ensureRole,
} = require('../middleware/auth');
const User = require('../models/User');
const Request = require('../models/Request');
const VolunteerTask = require('../models/VolunteerTask');
const Donation = require('../models/Donation');
const Campaign = require('../models/Campaign');

const dashboardCtrl = require('../controllers/adminDashboardController');

// volunteer controller (required — assumed present)
const volunteerCtrl = require('../controllers/volunteerController');

// Try to require optional controllers and fallback to empty object if missing
let ngoCtrl = {};
let campaignCtrl = {};
try { ngoCtrl = require('../controllers/ngoController'); } catch (e) { /* not present -> safe */ }
try { campaignCtrl = require('../controllers/campaignController'); } catch (e) { /* not present -> safe */ }

const router = express.Router();
const apiRouter = express.Router();

// Utility: wrap optional controller functions to avoid runtime errors if missing
function safeHandler(name, fn) {
  return function (req, res, next) {
    if (typeof fn === 'function') return fn(req, res, next);
    return res.status(501).json({ message: `Not implemented: ${name}` });
  };
}

/* --------------------
   Dashboard / analytics
   Use dashboardCtrl for analytics functions
   -------------------- */
apiRouter.get('/donations/today', safeHandler('getDonationsToday', dashboardCtrl.getDonationsToday));
apiRouter.get('/donations/week', safeHandler('getDonationsWeek', dashboardCtrl.getDonationsWeek));
apiRouter.get('/donations/month', safeHandler('getDonationsMonth', dashboardCtrl.getDonationsMonth));
apiRouter.get('/donations/total', safeHandler('getDonationsTotal', dashboardCtrl.getDonationsTotal));
apiRouter.get('/donations/recent', safeHandler('getRecentDonations', dashboardCtrl.getRecentDonations));
apiRouter.get('/donations/trend', safeHandler('getDonationTrend', dashboardCtrl.getDonationTrend));
apiRouter.get('/donations/by-state', safeHandler('getDonationsByState', dashboardCtrl.getDonationsByState));
apiRouter.get('/donations/by-disaster', safeHandler('getDonationsByDisaster', dashboardCtrl.getDonationsByDisaster));

apiRouter.get('/disasters/summary', safeHandler('getDisasterSummary', dashboardCtrl.getDisasterSummary));
apiRouter.get('/disasters/recent', safeHandler('getRecentDisasters', dashboardCtrl.getRecentDisasters));
apiRouter.get('/disasters/severity-distribution', safeHandler('getSeverityDistribution', dashboardCtrl.getSeverityDistribution));

/* --------------------
   Volunteer management endpoints
   Use volunteerCtrl for volunteer CRUD/actions
   -------------------- */
apiRouter.get('/volunteers/summary', safeHandler('getVolunteerSummary', volunteerCtrl.getVolunteerSummary));
apiRouter.get('/volunteers/ranking', safeHandler('getVolunteerRanking', dashboardCtrl.getVolunteerRanking)); // analytics ranking from dashboard
apiRouter.get('/volunteers/disasters/active', safeHandler('getActiveDisasters', volunteerCtrl.getActiveDisasters));
apiRouter.get('/volunteers', safeHandler('getVolunteers', volunteerCtrl.getVolunteers));
apiRouter.get('/volunteers/:id', safeHandler('getVolunteerDetail', volunteerCtrl.getVolunteerDetail));
apiRouter.put('/volunteers/:id/approve', safeHandler('approveVolunteer', volunteerCtrl.approveVolunteer));
apiRouter.put('/volunteers/:id/reject', safeHandler('rejectVolunteer', volunteerCtrl.rejectVolunteer));
apiRouter.put('/volunteers/:id/block', safeHandler('blockVolunteer', volunteerCtrl.blockVolunteer));
apiRouter.put('/volunteers/:id/unblock', safeHandler('unblockVolunteer', volunteerCtrl.unblockVolunteer));
apiRouter.post('/volunteers/:id/reset-password', safeHandler('resetVolunteerPassword', volunteerCtrl.resetVolunteerPassword));
apiRouter.delete('/volunteers/:id', safeHandler('deleteVolunteer', volunteerCtrl.deleteVolunteer));
apiRouter.post('/volunteers/:id/assign-task',
  body('title').notEmpty().withMessage('Title is required'),
  safeHandler('assignTask', volunteerCtrl.assignTask)
);
apiRouter.put('/volunteers/:id/warn', safeHandler('warnVolunteer', volunteerCtrl.warnVolunteer));
apiRouter.post('/volunteers/:id/email',
  body('subject').notEmpty(),
  body('message').notEmpty(),
  safeHandler('emailVolunteer', volunteerCtrl.emailVolunteer)
);
apiRouter.get('/volunteers/:id/tasks', safeHandler('listVolunteerTasks', volunteerCtrl.listVolunteerTasks));

/* --------------------
   NGO / Campaign routes (optional controllers loaded safely)
   -------------------- */
apiRouter.get('/ngos/stats', safeHandler('getNgoStats', ngoCtrl.getNgoStats));
apiRouter.get('/ngos', safeHandler('listNgos', ngoCtrl.listNgos));
apiRouter.get('/ngos/:id', safeHandler('getNgoDetail', ngoCtrl.getNgoDetail));
apiRouter.put('/ngos/:id/approve', safeHandler('approveNgo', ngoCtrl.approveNgo));
apiRouter.put('/ngos/:id/reject', safeHandler('rejectNgo', ngoCtrl.rejectNgo));
apiRouter.delete('/ngos/:id', safeHandler('deleteNgo', ngoCtrl.deleteNgo));
apiRouter.put('/ngos/:id/documents/:documentId', safeHandler('updateNgoDocumentStatus', ngoCtrl.updateNgoDocumentStatus));

apiRouter.get('/campaigns/stats', safeHandler('getCampaignStats', campaignCtrl.getCampaignStats));
apiRouter.get('/campaigns', safeHandler('listCampaigns', campaignCtrl.listCampaigns));
apiRouter.get('/campaigns/:id', safeHandler('getCampaignDetail', campaignCtrl.getCampaignDetail));
apiRouter.put('/campaigns/:id/approve', safeHandler('approveCampaign', campaignCtrl.approveCampaign));
apiRouter.put('/campaigns/:id/reject', safeHandler('rejectCampaign', campaignCtrl.rejectCampaign));
apiRouter.delete('/campaigns/:id', safeHandler('deleteCampaign', campaignCtrl.deleteCampaign));
apiRouter.put('/campaigns/bulk-status', safeHandler('bulkUpdateStatus', campaignCtrl.bulkUpdateStatus));

/* --------------------
   General user management
   -------------------- */
apiRouter.put('/manage-users/:id/approve', async (req, res) => {
  try {
    const { id } = req.params;
    if (req.user.id === id) {
      return res.status(400).json({ success: false, message: 'You cannot approve your own account.' });
    }

    const user = await User.findByIdAndUpdate(
      id,
      { approved: true, approvalStatus: 'approved', blocked: false },
      { new: true, lean: true }
    );

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    res.json({ success: true, message: 'User approved successfully.', user });
  } catch (error) {
    console.error('Approve user error', error);
    res.status(500).json({ success: false, message: 'Failed to approve user.' });
  }
});

/* --------------------
   Admin page routes (EJS) and classic admin endpoints
   -------------------- */
// Admin pages (EJS rendering)
router.get('/dashboard', requireAuth, ensureRole('admin'), dashboardCtrl.renderDashboard);

router.get('/manage-volunteers', requireAuth, ensureRole('admin'), (req, res) => {
  res.render('admin/manage-volunteers', {
    title: 'Manage Volunteers',
    user: req.user,
    activePage: 'manage-volunteers',
    layout: 'layouts/admin-layout'  // ✅ Correct layout path
  });
});

router.get('/manage-users', requireAuth, ensureRole('admin'), async (req, res, next) => {
  try {
    const [users, totals] = await Promise.all([
      User.find({}, 'name email role approvalStatus approved blocked createdAt')
        .sort({ createdAt: -1 })
        .limit(50)
        .lean(),
      Promise.all([
        User.countDocuments({}),
        User.countDocuments({ approvalStatus: 'approved' }),
        User.countDocuments({ approvalStatus: 'pending' }),
        User.countDocuments({ approvalStatus: 'rejected' }),
        User.countDocuments({ blocked: true })
      ])
    ]);

    const [total, approved, pending, rejected, blocked] = totals;

    res.render('admin/manage-users', {
      title: 'Manage Users',
      user: req.user,
      activePage: 'manage-users',
      layout: 'layouts/admin-layout',
      users,
      stats: { total, approved, pending, rejected, blocked }
    });
  } catch (error) {
    next(error);
  }
});

router.get('/approvals', requireAuth, ensureRole('admin'), (req, res) => {
  res.render('admin/approvals', {
    title: 'Approvals',
    user: req.user,
    activePage: 'approvals',
    layout: 'layouts/admin-layout'  // ✅ Added missing layout here too
  });
});

// Volunteer Reports page
router.get('/volunteer-reports', requireAuth, ensureRole('admin'), async (req, res) => {
  try {
    const { page = 1, limit = 20, search = '', volunteerId = '', status = '' } = req.query;
    const pageNumber = Math.max(parseInt(page, 10) || 1, 1);
    const limitNumber = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);
    const skip = (pageNumber - 1) * limitNumber;

    const query = { 'report.submittedAt': { $exists: true, $ne: null } };
    
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { 'report.description': { $regex: search, $options: 'i' } }
      ];
    }
    
    if (volunteerId) {
      query.volunteerId = volunteerId;
    }
    
    if (status) {
      query.status = status;
    }

    const [reports, total] = await Promise.all([
      VolunteerTask.find(query)
        .populate('volunteerId', 'name email')
        .populate('disaster', 'title location')
        .sort({ 'report.submittedAt': -1 })
        .skip(skip)
        .limit(limitNumber)
        .lean(),
      VolunteerTask.countDocuments(query)
    ]);

    // Get all volunteers for filter dropdown
    const volunteers = await User.find({ role: 'volunteer' })
      .select('name email')
      .sort({ name: 1 })
      .lean();

    res.render('admin/volunteer-reports', {
      title: 'Volunteer Reports',
      user: req.user,
      activePage: 'volunteer-reports',
      layout: 'layouts/admin-layout',
      reports,
      volunteers,
      pagination: {
        page: pageNumber,
        limit: limitNumber,
        total,
        totalPages: Math.ceil(total / limitNumber)
      },
      filters: {
        search: search || '',
        volunteerId: volunteerId || '',
        status: status || ''
      }
    });
  } catch (error) {
    console.error('Error loading volunteer reports:', error);
    res.status(500).render('admin/volunteer-reports', {
      title: 'Volunteer Reports',
      user: req.user,
      activePage: 'volunteer-reports',
      layout: 'layouts/admin-layout',
      reports: [],
      volunteers: [],
      pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
      filters: { search: '', volunteerId: '', status: '' },
      error: 'Failed to load reports'
    });
  }
});


// Approve single user (generic)
router.put('/users/:id/approve', verifyToken, ensureRole('admin'), async (req, res) => {
  const user = await User.findByIdAndUpdate(req.params.id, { approved: true }, { new: true });
  if (!user) return res.status(404).json({ message: 'User not found' });
  res.json(user);
});

// Request status update
router.put('/requests/:id/status', verifyToken, ensureRole('admin'),
  body('status').isIn(['approved', 'rejected', 'in_progress', 'completed']),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    const item = await Request.findByIdAndUpdate(req.params.id, { status: req.body.status }, { new: true });
    if (!item) return res.status(404).json({ message: 'Request not found' });
    res.json(item);
  }
);

// Classic assign-task endpoint (for forms)
router.post('/tasks', verifyToken, ensureRole('admin'),
  body('title').notEmpty(),
  body('volunteerId').isMongoId(),
  body('description').optional().isString(),
  body('relatedRequest').optional().isMongoId(),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    const task = await VolunteerTask.create({
      title: req.body.title,
      description: req.body.description,
      volunteerId: req.body.volunteerId,
      relatedRequest: req.body.relatedRequest
    });
    res.status(201).json(task);
  }
);

// Simple admin volunteers list (legacy)
router.get('/volunteers', verifyToken, ensureRole('admin'), async (req, res) => {
  const volunteers = await User.find({ role: 'volunteer' }).select('_id name email').lean();
  res.json({ volunteers });
});

// Reports (CSV export)
router.get('/reports/donations.csv', verifyToken, ensureRole('admin'), async (req, res) => {
  const items = await Donation.find().lean();
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="donations.csv"');
  const header = 'donorName,itemType,quantity,location,status,createdAt\n';
  const rows = items.map(i => [i.donorName, i.itemType, i.quantity, i.location, i.status, i.createdAt?.toISOString()].join(','));
  res.send(header + rows.join('\n'));
});

router.use('/api', requireAuth, ensureRole('admin'), apiRouter);

module.exports = router;
