const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { body, validationResult } = require('express-validator');
const { verifyToken, requireRoles } = require('../middleware/auth');
const VolunteerTask = require('../models/VolunteerTask');

const router = express.Router();

const reportUploadDir = path.join(__dirname, '..', '..', 'public', 'uploads', 'task-reports');
fs.mkdirSync(reportUploadDir, { recursive: true });

const reportStorage = multer.diskStorage({
  destination: reportUploadDir,
  filename: (req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${unique}${path.extname(file.originalname).toLowerCase()}`);
  }
});

const reportUpload = multer({
  storage: reportStorage,
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'application/pdf'];
    if (!allowed.includes(file.mimetype)) {
      return cb(new Error('Only JPG, PNG or PDF attachments are allowed.'));
    }
    return cb(null, true);
  }
});

// Admin: list all tasks with volunteer info
router.get('/tasks', verifyToken, async (req, res) => {
  const isAdmin = req.user && req.user.role === 'admin';
  if (isAdmin && req.query.all === '1') {
    const tasks = await VolunteerTask.find({}).sort({ createdAt: -1 }).populate('volunteerId', 'name email').lean();
    return res.json({ tasks: tasks.map(t => ({ ...t, volunteer: t.volunteerId })) });
  }
  // Fallback to volunteer personal tasks (protected below)
  return res.status(403).json({ message: 'Forbidden' });
});

// View assigned tasks
router.get('/my-tasks', verifyToken, requireRoles('volunteer'), async (req, res) => {
  const tasks = await VolunteerTask.find({ volunteerId: req.user.id }).sort({ createdAt: -1 });
  res.json(tasks);
});

// Update task status
router.put('/tasks/:id/status', verifyToken, requireRoles('volunteer'),
  body('status').isIn(['assigned', 'in_progress', 'completed']),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    const task = await VolunteerTask.findOne({ _id: req.params.id, volunteerId: req.user.id });
    if (!task) return res.status(404).json({ message: 'Task not found' });

    const update = { status: req.body.status };
    if (req.body.status === 'in_progress' && !task.acceptedAt) {
      update.acceptedAt = new Date();
    }
    if (req.body.status === 'completed') {
      update.completedAt = new Date();
    }
    task.history = task.history || [];
    task.history.push({ status: req.body.status, note: 'Updated by volunteer' });
    await VolunteerTask.updateOne({ _id: task._id }, { ...update, history: task.history });
    const fresh = await VolunteerTask.findById(task._id);
    res.json(fresh);
  }
);

// Complete task (alias)
router.post('/tasks/:id/complete', verifyToken, requireRoles('volunteer'), async (req, res) => {
  const task = await VolunteerTask.findOneAndUpdate(
    { _id: req.params.id, volunteerId: req.user.id },
    { status: 'completed', completedAt: new Date() },
    { new: true }
  );
  if (!task) return res.status(404).json({ message: 'Task not found' });
  res.json(task);
});

router.post(
  '/tasks/:id/report',
  verifyToken,
  requireRoles('volunteer'),
  reportUpload.array('attachments', 4),
  body('description').trim().isLength({ min: 10 }).withMessage('Report description is required'),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    const task = await VolunteerTask.findOne({ _id: req.params.id, volunteerId: req.user.id });
    if (!task) return res.status(404).json({ message: 'Task not found' });

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
    task.history.push({ status: task.status, note: 'Report submitted' });
    await task.save();

    res.json({ message: 'Report submitted', task });
  }
);

module.exports = router;
