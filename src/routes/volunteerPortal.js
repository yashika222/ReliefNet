const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { body, validationResult } = require('express-validator');
const { optionalAuth, requireAuth, requireRoles } = require('../middleware/auth');
const User = require('../models/User');
const VolunteerTask = require('../models/VolunteerTask');

const router = express.Router();

const idProofDir = path.join(__dirname, '..', '..', 'public', 'uploads', 'id-proofs');
fs.mkdirSync(idProofDir, { recursive: true });

const proofStorage = multer.diskStorage({
  destination: idProofDir,
  filename: (req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${unique}${path.extname(file.originalname).toLowerCase()}`);
  }
});

const proofUpload = multer({
  storage: proofStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'application/pdf'];
    if (!allowed.includes(file.mimetype)) {
      return cb(new Error('Only PDF, JPG, or PNG files are allowed.'));
    }
    return cb(null, true);
  }
});

router.get('/register', optionalAuth, (req, res) => {
  res.render('pages/volunteer/register', {
    title: 'Volunteer Registration',
    user: req.user || null,
    success: null,
    error: null
  });
});

router.post(
  '/register',
  proofUpload.single('idProof'),
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('email').isEmail().withMessage('Enter a valid email'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('phone').trim().notEmpty().withMessage('Phone number is required'),
  body('city').trim().notEmpty().withMessage('City is required'),
  body('state').trim().notEmpty().withMessage('State is required'),
  body('availability').isIn(['full_time', 'part_time', 'weekends', 'ad_hoc']).withMessage('Select availability'),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).render('pages/volunteer/register', {
        title: 'Volunteer Registration',
        user: req.user || null,
        success: null,
        error: errors.array()[0].msg,
        form: req.body
      });
    }

    try {
      const { name, email, password, phone, city, state, skills, availability } = req.body;
      const lowerEmail = email.toLowerCase();
      const exists = await User.findOne({ email: lowerEmail });
      if (exists) {
        return res.status(400).render('pages/volunteer/register', {
          title: 'Volunteer Registration',
          user: req.user || null,
          success: null,
          error: 'Email already registered. Please login or use a different email.',
          form: req.body
        });
      }

      const skillList = (skills || '')
        .split(',')
        .map((skill) => skill.trim())
        .filter(Boolean);

      let idProof = null;
      if (req.file) {
        idProof = {
          filename: req.file.filename,
          originalName: req.file.originalname,
          mimeType: req.file.mimetype,
          size: req.file.size,
          url: `/public/uploads/id-proofs/${req.file.filename}`,
          uploadedAt: new Date()
        };
      }

      await User.create({
        name,
        email: lowerEmail,
        password,
        role: 'volunteer',
        approved: false,
        approvalStatus: 'pending',
        contact: { phone },
        volunteerProfile: {
          city,
          state,
          currentLocation: `${city}, ${state}`,
          availability,
          skills: skillList,
          idProof
        }
      });

      return res.render('pages/volunteer/register', {
        title: 'Volunteer Registration',
        user: req.user || null,
        success: 'Registration submitted successfully! Our admin team will review and notify you via email.',
        error: null,
        form: null
      });
    } catch (error) {
      console.error('Volunteer registration error', error);
      return res.status(500).render('pages/volunteer/register', {
        title: 'Volunteer Registration',
        user: req.user || null,
        success: null,
        error: 'Failed to submit registration. Please try again later.',
        form: req.body
      });
    }
  }
);

router.get('/volunteer/tasks', requireAuth, requireRoles('volunteer'), (req, res) => {
  res.redirect('/volunteer/dashboard');
});


router.post(
  '/tasks/:id/status',
  requireAuth,
  requireRoles('volunteer'),
  body('status').isIn(['assigned', 'in_progress', 'completed']),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.redirect('/volunteer/dashboard?error=Invalid status update');
    }
    try {
      const task = await VolunteerTask.findOne({ _id: req.params.id, volunteerId: req.user.id });
      if (!task) {
        return res.redirect('/volunteer/dashboard?error=Task not found');
      }
      const status = req.body.status;
      if (status === 'in_progress' && task.status === 'completed') {
        return res.redirect('/volunteer/dashboard?error=Task already completed');
      }
      task.status = status;
      if (status === 'in_progress' && !task.acceptedAt) {
        task.acceptedAt = new Date();
      }
      if (status === 'completed') {
        task.completedAt = new Date();
      }
      task.history = task.history || [];
      task.history.push({ status, note: 'Volunteer portal update' });
      await task.save();
      // Redirect to completed tasks page if task was completed
      if (status === 'completed') {
        return res.redirect('/volunteer/tasks/completed?success=Task marked as completed');
      }
      return res.redirect('/volunteer/dashboard?success=Task updated');
    } catch (error) {
      console.error('Volunteer task status error', error);
      return res.redirect('/volunteer/dashboard?error=Unable to update task');
    }
  }
);

const reportUpload = multer({
  storage: multer.diskStorage({
    destination: path.join(__dirname, '..', '..', 'public', 'uploads', 'task-reports'),
    filename: (req, file, cb) => {
      const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
      cb(null, `${unique}${path.extname(file.originalname).toLowerCase()}`);
    }
  }),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'application/pdf'];
    if (!allowed.includes(file.mimetype)) {
      return cb(new Error('Only JPG, PNG or PDF attachments are allowed.'));
    }
    return cb(null, true);
  }
});

router.post(
  '/tasks/:id/report',
  requireAuth,
  requireRoles('volunteer'),
  reportUpload.array('attachments', 4),
  body('description').trim().isLength({ min: 10 }).withMessage('Report description is required'),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.redirect('/volunteer/dashboard?error=Report description required');
    }
    try {
      const task = await VolunteerTask.findOne({ _id: req.params.id, volunteerId: req.user.id });
      if (!task) return res.redirect('/volunteer/dashboard?error=Task not found');

      const attachments = (req.files || []).map((file) => ({
        filename: file.filename,
        originalName: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
        url: `/public/uploads/task-reports/${file.filename}`,
        uploadedAt: new Date()
      }));

      task.report = {
        description: req.body.description,
        submittedAt: new Date(),
        attachments
      };
      task.history = task.history || [];
      task.history.push({ status: task.status, note: 'Report submitted via portal' });
      await task.save();

      // Send email notification to admin
      try {
        const volunteer = await User.findById(req.user.id).lean();
        const mailer = require('../../services/mailer');
        if (mailer && mailer.sendVolunteerReportToAdmin) {
          await mailer.sendVolunteerReportToAdmin(volunteer, task, task.report);
        }
      } catch (err) {
        console.warn('Failed to send report notification to admin:', err.message);
        // Don't fail the request if email fails
      }

      return res.redirect('/volunteer/dashboard?success=Report submitted');
    } catch (error) {
      console.error('Volunteer report error', error);
      return res.redirect('/volunteer/dashboard?error=Unable to submit report');
    }
  }
);

module.exports = router;

