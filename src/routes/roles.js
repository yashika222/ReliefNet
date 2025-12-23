const express = require('express');
const { requireAuth, requireRoles } = require('../middleware/auth');
const VolunteerTask = require('../models/VolunteerTask');
const Campaign = require('../models/Campaign');
const User = require('../models/User');

const router = express.Router();

// NGO dashboard - shows active campaigns
router.get('/ngo/dashboard', requireAuth, requireRoles('ngo'), async (req, res) => {
    const now = new Date();
    // Active campaigns: pending or approved, and not ended
    const activeCampaigns = await Campaign.find({ 
      createdBy: req.user.id,
      status: { $in: ['pending', 'approved'] },
      $or: [
        { endDate: { $exists: false } },
        { endDate: null },
        { endDate: { $gte: now } }
      ]
    }).sort({ createdAt: -1 }).lean();
    
    res.render('pages/ngo/dashboard', { 
      title: 'NGO Dashboard', 
      user: req.user, 
      campaigns: activeCampaigns 
    });
});

// NGO old campaigns page
router.get('/ngo/campaigns/old', requireAuth, requireRoles('ngo'), async (req, res) => {
    const now = new Date();
    // Old campaigns: rejected, completed, or ended
    const oldCampaigns = await Campaign.find({
      createdBy: req.user.id,
      $or: [
        { status: { $in: ['rejected', 'completed'] } },
        { endDate: { $lt: now } }
      ]
    }).sort({ createdAt: -1 }).lean();
    
    res.render('pages/ngo/old-campaigns', {
      title: 'Old Campaigns',
      user: req.user,
      campaigns: oldCampaigns
    });
});

// NGO upload proof page
router.get('/ngo/upload-proof', requireAuth, requireRoles('ngo'), async (req, res) => {
    const ngo = await User.findById(req.user.id).lean();
    res.render('pages/ngo/upload-proof', {
      title: 'Upload Proof Documents',
      user: req.user,
      ngo,
      alerts: {
        success: req.query.success || null,
        error: req.query.error || null
      }
    });
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

// NGO upload proof POST handler
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const ngoProofDir = path.join(__dirname, '..', '..', 'public', 'uploads', 'ngo-proofs');
fs.mkdirSync(ngoProofDir, { recursive: true });

const ngoProofStorage = multer.diskStorage({
  destination: ngoProofDir,
  filename: (req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${unique}${path.extname(file.originalname).toLowerCase()}`);
  }
});

const ngoProofUpload = multer({
  storage: ngoProofStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'application/pdf'];
    if (!allowed.includes(file.mimetype)) {
      return cb(new Error('Only PDF, JPG, or PNG files are allowed.'));
    }
    return cb(null, true);
  }
});

router.post('/ngo/upload-proof', requireAuth, requireRoles('ngo'), ngoProofUpload.single('document'), async (req, res) => {
  try {
    const { documentName, documentType, description } = req.body;
    
    if (!req.file) {
      return res.redirect('/ngo/upload-proof?error=Please select a file to upload');
    }
    
    if (!documentName || !documentType) {
      return res.redirect('/ngo/upload-proof?error=Document name and type are required');
    }
    
    const ngo = await User.findById(req.user.id);
    if (!ngo) {
      return res.redirect('/ngo/upload-proof?error=NGO profile not found');
    }
    
    // Initialize ngoProfile.documents if it doesn't exist
    if (!ngo.ngoProfile) {
      ngo.ngoProfile = { documents: [] };
    }
    if (!ngo.ngoProfile.documents) {
      ngo.ngoProfile.documents = [];
    }
    
    // Add new document
    const newDocument = {
      name: documentName,
      type: documentType,
      url: `/public/uploads/ngo-proofs/${req.file.filename}`,
      filename: req.file.filename,
      originalName: req.file.originalname,
      mimeType: req.file.mimetype,
      size: req.file.size,
      description: description || '',
      status: 'pending',
      uploadedAt: new Date()
    };
    
    ngo.ngoProfile.documents.push(newDocument);
    await ngo.save();
    
    return res.redirect('/ngo/upload-proof?success=Document uploaded successfully. Admin will review it soon.');
  } catch (error) {
    console.error('NGO proof upload error', error);
    return res.redirect('/ngo/upload-proof?error=Failed to upload document. Please try again.');
  }
});

// Volunteer dashboard - shows active tasks
router.get('/volunteer/dashboard', requireAuth, requireRoles('volunteer'), async (req, res) => {
  try {
    const volunteer = await User.findById(req.user.id).lean();
    
    // Get only active tasks (not completed)
    const activeTasks = await VolunteerTask.find({ 
      volunteerId: req.user.id,
      status: { $ne: 'completed' }
    })
      .populate('disaster', 'title type location severity')
      .sort({ createdAt: -1 })
      .lean();

    // Get all tasks for stats
    const allTasks = await VolunteerTask.find({ volunteerId: req.user.id }).lean();

    const stats = {
      assigned: allTasks.length,
      inProgress: allTasks.filter(t => t.status === 'in_progress').length,
      completed: allTasks.filter(t => t.status === 'completed').length,
      overdue: allTasks.filter(
        t => t.status !== 'completed' && t.deadline && t.deadline < new Date()
      ).length
    };

    res.render('pages/volunteer/dashboard', {
      title: 'Volunteer Dashboard',
      user: req.user,
      volunteer,
      tasks: activeTasks,
      stats,
      alerts: {
        success: req.query.success || null,
        error: req.query.error || null
      }
    });
  } catch (err) {
    console.error('Volunteer dashboard error', err);
    res.status(500).send('Failed to load volunteer dashboard');
  }
});

// Volunteer tasks page (redirects to dashboard)
router.get('/volunteer/tasks', requireAuth, requireRoles('volunteer'), async (req, res) => {
  res.redirect('/volunteer/dashboard');
});

// Completed tasks page
router.get('/volunteer/tasks/completed', requireAuth, requireRoles('volunteer'), async (req, res) => {
  try {
    const volunteer = await User.findById(req.user.id).lean();
    
    const completedTasks = await VolunteerTask.find({ 
      volunteerId: req.user.id,
      status: 'completed'
    })
      .populate('disaster', 'title type location severity')
      .sort({ completedAt: -1 })
      .lean();

    res.render('pages/volunteer/completed-tasks', {
      title: 'Completed Tasks',
      user: req.user,
      volunteer,
      tasks: completedTasks,
      alerts: {
        success: req.query.success || null,
        error: req.query.error || null
      }
    });
  } catch (err) {
    console.error('Completed tasks error', err);
    res.status(500).send('Failed to load completed tasks');
  }
});


// Donor home
router.get('/donor/home', requireAuth, requireRoles('donor'), async (req, res) => {
    res.render('pages/donor/home', { title: 'Donor Home', user: req.user });
});

module.exports = router;
