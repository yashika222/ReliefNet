const mongoose = require('mongoose');
const crypto = require('crypto');
const User = require('../models/User');
const VolunteerTask = require('../models/VolunteerTask');
const Disaster = require('../models/Disaster');
const mailer = require('../../services/mailer');

const { Types } = mongoose;

// SMS disabled for now (Twilio not required)
const sms = null;

function toObjectId(id) {
  if (!id || !Types.ObjectId.isValid(id)) return null;
  return new Types.ObjectId(id);
}

async function runAutoWarnings() {
  const now = new Date();
  const overdueTasks = await VolunteerTask.find({
    status: { $ne: 'completed' },
    deadline: { $lt: now },
    warned: { $ne: true }
  }).populate('volunteerId', 'name email role');

  if (!overdueTasks.length) {
    return { triggered: false, count: 0 };
}

  const ids = overdueTasks.map(task => task._id);
  await VolunteerTask.updateMany(
    { _id: { $in: ids } },
    { $set: { warned: true, warnedAt: now } }
  );

  const grouped = overdueTasks.reduce((acc, task) => {
    if (!task.volunteerId) return acc;
    const key = task.volunteerId._id.toString();
    if (!acc.has(key)) acc.set(key, { volunteer: task.volunteerId, tasks: [] });
    acc.get(key).tasks.push(task);
    return acc;
  }, new Map());

  await Promise.all(Array.from(grouped.values()).map(async ({ volunteer, tasks }) => {
    try {
      await mailer.sendVolunteerWarning(volunteer, tasks);
      if (sms && sms.sendVolunteerWarning) {
        await sms.sendVolunteerWarning(volunteer, tasks);
      }
    } catch (err) {
      console.warn('Auto warning notification failed:', err.message);
    }
  }));

  return { triggered: true, count: overdueTasks.length };
}

async function updateVolunteerTaskStats(volunteerId) {
  const volunteerObjectId = toObjectId(volunteerId);
  if (!volunteerObjectId) return;

  const agg = await VolunteerTask.aggregate([
    { $match: { volunteerId: volunteerObjectId } },
    {
      $group: {
        _id: '$volunteerId',
        totalAssigned: { $sum: 1 },
        totalCompleted: {
          $sum: {
            $cond: [{ $eq: ['$status', 'completed'] }, 1, 0]
          }
        },
        lastAssignmentAt: { $max: '$createdAt' }
      }
    }
  ]);

  const stats = agg[0] || null;
  if (!stats) {
    await User.findByIdAndUpdate(volunteerObjectId, {
      $set: {
        'volunteerProfile.totalTasksAssigned': 0,
        'volunteerProfile.totalTasksCompleted': 0,
        'volunteerProfile.lastAssignmentAt': null
      }
    }).lean();
    return;
  }

  await User.findByIdAndUpdate(volunteerObjectId, {
    $set: {
      'volunteerProfile.totalTasksAssigned': stats.totalAssigned,
      'volunteerProfile.totalTasksCompleted': stats.totalCompleted,
      'volunteerProfile.lastAssignmentAt': stats.lastAssignmentAt
    }
  }).lean();
}

// Get volunteer summary statistics
exports.getVolunteerSummary = async (req, res) => {
  try {
    const now = new Date();
    const [totalVolunteers, activeVolunteers, pendingVolunteers, rejectedVolunteers, blockedVolunteers, taskAgg, overdueCount, warnedCount, autoWarningStatus] = await Promise.all([
      User.countDocuments({ role: 'volunteer' }),
      User.countDocuments({ role: 'volunteer', approved: true, blocked: { $ne: true } }),
      User.countDocuments({ role: 'volunteer', approvalStatus: 'pending' }),
      User.countDocuments({ role: 'volunteer', approvalStatus: 'rejected' }),
      User.countDocuments({ role: 'volunteer', blocked: true }),
      VolunteerTask.aggregate([
        {
          $group: {
            _id: null,
            totalTasks: { $sum: 1 },
            completedTasks: {
              $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
            },
            inProgressTasks: {
              $sum: { $cond: [{ $eq: ['$status', 'in_progress'] }, 1, 0] }
            },
            warnedTasks: {
              $sum: { $cond: [{ $eq: ['$warned', true] }, 1, 0] }
            }
          }
        }
      ]),
      VolunteerTask.countDocuments({ status: { $ne: 'completed' }, deadline: { $lt: now } }),
      VolunteerTask.countDocuments({ warned: true }),
      runAutoWarnings()
    ]);

    const taskStats = taskAgg[0] || {
      totalTasks: 0,
      completedTasks: 0,
      inProgressTasks: 0,
      warnedTasks: 0
    };

    res.json({
      totalVolunteers,
      activeVolunteers,
      pendingApprovals: pendingVolunteers,
      rejectedVolunteers,
      blockedVolunteers,
      totalTasksAssigned: taskStats.totalTasks,
      tasksCompleted: taskStats.completedTasks,
      tasksInProgress: taskStats.inProgressTasks,
      tasksOverdue: overdueCount,
      tasksWarned: warnedCount,
      autoWarningTriggered: autoWarningStatus.triggered,
      autoWarningCount: autoWarningStatus.count
    });
  } catch (error) {
    console.error('Error fetching volunteer summary:', error);
    res.status(500).json({ message: 'Error fetching volunteer summary' });
  }
};

// Get paginated list of volunteers with filters
exports.getVolunteers = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search = '',
      status,
      sort = 'newest',
      blocked
    } = req.query;

    const pageNumber = Math.max(parseInt(page, 10) || 1, 1);
    const limitNumber = Math.min(Math.max(parseInt(limit, 10) || 10, 1), 100);
    const skip = (pageNumber - 1) * limitNumber;

    const query = { role: 'volunteer' };

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }

    if (status === 'approved') {
      query.approvalStatus = 'approved';
    } else if (status === 'pending') {
      query.approvalStatus = 'pending';
    } else if (status === 'rejected') {
      query.approvalStatus = 'rejected';
    }

    if (blocked === 'true') query.blocked = true;
    if (blocked === 'false') query.blocked = { $ne: true };

    const sortMap = {
      newest: { createdAt: -1 },
      oldest: { createdAt: 1 },
      name: { name: 1 },
      tasks: { 'metrics.tasksAssigned': -1 }
    };

    const sortStage = sortMap[sort] || sortMap.newest;
    const now = new Date();

    const [total, volunteers] = await Promise.all([
      User.countDocuments(query),
      User.aggregate([
        { $match: query },
        {
          $lookup: {
            from: 'volunteertasks',
            localField: '_id',
            foreignField: 'volunteerId',
            as: 'tasks'
          }
        },
        {
          $addFields: {
            metrics: {
              tasksAssigned: { $size: '$tasks' },
              tasksCompleted: {
                $size: {
                  $filter: {
                    input: '$tasks',
                    as: 'task',
                    cond: { $eq: ['$$task.status', 'completed'] }
                  }
                }
              },
              tasksOverdue: {
                $size: {
                  $filter: {
                    input: '$tasks',
                    as: 'task',
                    cond: {
                      $and: [
                        { $ne: ['$$task.status', 'completed'] },
                        { $lt: ['$$task.deadline', now] }
                      ]
                    }
                  }
                }
              },
              tasksWarned: {
                $size: {
                  $filter: {
                    input: '$tasks',
                    as: 'task',
                    cond: { $eq: ['$$task.warned', true] }
                  }
                }
              },
              tasksActive: {
                $size: {
                  $filter: {
                    input: '$tasks',
                    as: 'task',
                    cond: { $ne: ['$$task.status', 'completed'] }
                  }
                }
              }
            },
            recentTasks: {
              $slice: [
                {
                  $map: {
                    input: {
                      $slice: [
                        {
                          $filter: {
                            input: '$tasks',
                            as: 'task',
                            cond: { $eq: ['$$task.status', 'completed'] }
                          }
                        },
                        -5
                      ]
                    },
                    as: 't',
                    in: {
                      _id: '$$t._id',
                      title: '$$t.title',
                      status: '$$t.status',
                      deadline: '$$t.deadline',
                      warned: '$$t.warned'
                    }
                  }
                },
                5
              ]
            },
            activeLocation: {
              $ifNull: ['$volunteerProfile.currentLocation', '$address.state']
            }
          }
        },
        {
          $project: {
            password: 0,
            tasks: 0
          }
        },
        { $sort: sortStage },
        { $skip: skip },
        { $limit: limitNumber }
      ])
    ]);

    res.json({
      data: volunteers,
      total,
      page: pageNumber,
      limit: limitNumber,
      totalPages: Math.ceil(total / limitNumber)
    });
  } catch (error) {
    console.error('Error fetching volunteers:', error);
    res.status(500).json({ message: 'Error fetching volunteers' });
  }
};

// Approve a volunteer
exports.approveVolunteer = async (req, res) => {
  try {
    const { id } = req.params;

    if (req.user.id === id) {
      return res.status(400).json({ message: 'You cannot approve your own account' });
    }

    const volunteer = await User.findOneAndUpdate(
      { _id: id, role: 'volunteer' },
      {
        approved: true,
        approvalStatus: 'approved',
        blocked: false
      },
      { new: true, lean: true }
    );

    if (!volunteer) {
      return res.status(404).json({ message: 'Volunteer not found' });
    }

    try {
      await mailer.sendVolunteerApproval(volunteer);
    } catch (err) {
      console.warn('Volunteer approval email failed:', err.message);
    }

    res.json({ message: 'Volunteer approved successfully', volunteer });
  } catch (error) {
    console.error('Error approving volunteer:', error);
    res.status(500).json({ message: 'Error approving volunteer' });
  }
};

// Reject a volunteer
exports.rejectVolunteer = async (req, res) => {
  try {
    const { id } = req.params;

    if (req.user.id === id) {
      return res.status(400).json({ message: 'You cannot reject your own account' });
    }

    const volunteer = await User.findOneAndUpdate(
      { _id: id, role: 'volunteer' },
      {
        approved: false,
        approvalStatus: 'rejected'
      },
      { new: true, lean: true }
    );

    if (!volunteer) {
      return res.status(404).json({ message: 'Volunteer not found' });
    }

    try {
      await mailer.sendVolunteerRejection(volunteer);
    } catch (err) {
      console.warn('Volunteer rejection email failed:', err.message);
    }

    res.json({ message: 'Volunteer rejected', volunteer });
  } catch (error) {
    console.error('Error rejecting volunteer:', error);
    res.status(500).json({ message: 'Error rejecting volunteer' });
  }
};

// Delete a volunteer
exports.deleteVolunteer = async (req, res) => {
  try {
    const { id } = req.params;

    if (req.user.id === id) {
      return res.status(400).json({ message: 'You cannot delete your own account' });
    }

    const volunteer = await User.findOneAndDelete({ _id: id, role: 'volunteer' });

    if (!volunteer) {
      return res.status(404).json({ message: 'Volunteer not found' });
    }

    await VolunteerTask.deleteMany({ volunteerId: id });

    res.json({ message: 'Volunteer deleted successfully' });
  } catch (error) {
    console.error('Error deleting volunteer:', error);
    res.status(500).json({ message: 'Error deleting volunteer' });
  }
};

// Assign a task to a volunteer
exports.assignTask = async (req, res) => {
  try {
    const { id } = req.params;
    let { title, description, relatedRequest, deadline, disasterId, priority = 'medium' } = req.body;

    const allowedPriorities = ['low', 'medium', 'high', 'critical'];
    if (!allowedPriorities.includes(priority)) {
      priority = 'medium';
    }

    const volunteer = await User.findOne({ _id: id, role: 'volunteer', approved: true, blocked: { $ne: true } });
    if (!volunteer) {
      return res.status(404).json({ message: 'Approved volunteer not found' });
    }

    const task = new VolunteerTask({
      title,
      description,
      volunteerId: id,
      relatedRequest: relatedRequest ? toObjectId(relatedRequest) : null,
      disaster: disasterId ? toObjectId(disasterId) : null,
      status: 'assigned',
      deadline: deadline ? new Date(deadline) : null,
      priority,
      assignedBy: req.user ? req.user.id : null
    });

    await task.save();
    await updateVolunteerTaskStats(id);

    try {
      await mailer.sendVolunteerAssignment(volunteer, task);
      if (sms && sms.sendVolunteerAssignment) {
        await sms.sendVolunteerAssignment(volunteer, task);
      }
    } catch (err) {
      console.warn('Volunteer assignment notification failed:', err.message);
    }

    res.status(201).json({ message: 'Task assigned successfully', task });
  } catch (error) {
    console.error('Error assigning task:', error);
    res.status(500).json({ message: 'Error assigning task' });
  }
};

// Warn a volunteer for overdue tasks
exports.warnVolunteer = async (req, res) => {
  try {
    const { id } = req.params;
    const now = new Date();
    const overdueTasks = await VolunteerTask.find({
      volunteerId: id,
      status: { $ne: 'completed' },
      deadline: { $lt: now }
    });

    if (!overdueTasks.length) {
      return res.status(200).json({ message: 'No overdue tasks to warn' });
    }

    await VolunteerTask.updateMany(
      { _id: { $in: overdueTasks.map(task => task._id) } },
      { $set: { warned: true, warnedAt: now } }
    );

    try {
      const volunteer = await User.findById(id).lean();
      if (volunteer) {
        await mailer.sendVolunteerWarning(volunteer, overdueTasks);
        if (sms && sms.sendVolunteerWarning) {
          await sms.sendVolunteerWarning(volunteer, overdueTasks);
        }
      }
    } catch (err) {
      console.warn('Warn volunteer notification failed:', err.message);
    }

    res.json({ message: 'Volunteer warned for overdue tasks', count: overdueTasks.length });
  } catch (error) {
    console.error('Error warning volunteer:', error);
    res.status(500).json({ message: 'Error warning volunteer' });
  }
};

// Admin send a custom email to volunteer
exports.emailVolunteer = async (req, res) => {
  try {
    const { id } = req.params;
    const { subject, message } = req.body;

    if (!subject || !message) {
      return res.status(400).json({ message: 'Subject and message are required' });
    }

    const volunteer = await User.findOne({ _id: id, role: 'volunteer' }).lean();
    if (!volunteer) {
      return res.status(404).json({ message: 'Volunteer not found' });
    }

    await mailer.sendCustom({
      to: volunteer.email,
      subject,
      text: message,
      html: undefined
    });

    res.json({ message: 'Email sent' });
  } catch (error) {
    console.error('Error sending email to volunteer:', error);
    res.status(500).json({ message: 'Failed to send email' });
  }
};

// Block volunteer
exports.blockVolunteer = async (req, res) => {
  try {
    const { id } = req.params;
    const volunteer = await User.findOneAndUpdate(
      { _id: id, role: 'volunteer' },
      { blocked: true },
      { new: true, lean: true }
    );

    if (!volunteer) {
      return res.status(404).json({ message: 'Volunteer not found' });
    }

    try {
      await mailer.sendVolunteerBlocked(volunteer);
    } catch (err) {
      console.warn('Block notification failed:', err.message);
    }

    res.json({ message: 'Volunteer blocked', volunteer });
  } catch (error) {
    console.error('Error blocking volunteer:', error);
    // src/controllers/volunteerController.js
const mongoose = require('mongoose');
const crypto = require('crypto');
const User = require('../models/User');
const VolunteerTask = require('../models/VolunteerTask');
const Disaster = require('../models/Disaster');
const mailer = require('../../services/mailer'); // optional - ensure exists
const logger = require('../config/logger') || console;

const { Types } = mongoose;

// helper
function toObjectId(id) {
  if (!id || !Types.ObjectId.isValid(id)) return null;
  return Types.ObjectId(id);
}

// SMS disabled for now (Twilio not required)
const sms = null;

/* -------------------------
   Utility: run auto warnings
   ------------------------- */
async function runAutoWarnings() {
  const now = new Date();
  const overdueTasks = await VolunteerTask.find({
    status: { $ne: 'completed' },
    deadline: { $lt: now },
    warned: { $ne: true }
  }).populate('volunteerId', 'name email role');

  if (!overdueTasks.length) {
    return { triggered: false, count: 0 };
  }

  const ids = overdueTasks.map(t => t._id);
  await VolunteerTask.updateMany({ _id: { $in: ids } }, { $set: { warned: true, warnedAt: now } });

  const grouped = overdueTasks.reduce((acc, t) => {
    if (!t.volunteerId) return acc;
    const key = t.volunteerId._id.toString();
    if (!acc.has(key)) acc.set(key, { volunteer: t.volunteerId, tasks: [] });
    acc.get(key).tasks.push(t);
    return acc;
  }, new Map());

  await Promise.all(Array.from(grouped.values()).map(async ({ volunteer, tasks }) => {
    try {
      if (mailer && mailer.sendVolunteerWarning) await mailer.sendVolunteerWarning(volunteer, tasks);
      if (sms && sms.sendVolunteerWarning) await sms.sendVolunteerWarning(volunteer, tasks);
    } catch (err) {
      logger.warn && logger.warn('Auto warning notification failed:', err.message);
    }
  }));

  return { triggered: true, count: overdueTasks.length };
}

/* -------------------------
   Update volunteer metrics stored on User doc (best-effort)
   ------------------------- */
async function updateVolunteerTaskStats(volunteerId) {
  const vid = toObjectId(volunteerId);
  if (!vid) return;

  const agg = await VolunteerTask.aggregate([
    { $match: { volunteerId: vid } },
    {
      $group: {
        _id: '$volunteerId',
        totalAssigned: { $sum: 1 },
        totalCompleted: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } },
        lastAssignmentAt: { $max: '$createdAt' }
      }
    }
  ]);

  const stats = agg[0] || null;
  if (!stats) {
    await User.findByIdAndUpdate(vid, {
      $set: {
        'volunteerProfile.totalTasksAssigned': 0,
        'volunteerProfile.totalTasksCompleted': 0,
        'volunteerProfile.lastAssignmentAt': null
      }
    }).lean();
    return;
  }

  await User.findByIdAndUpdate(vid, {
    $set: {
      'volunteerProfile.totalTasksAssigned': stats.totalAssigned,
      'volunteerProfile.totalTasksCompleted': stats.totalCompleted,
      'volunteerProfile.lastAssignmentAt': stats.lastAssignmentAt
    }
  }).lean();
}

/* -------------------------
   Get volunteer summary (for admin UI)
   ------------------------- */
exports.getVolunteerSummary = async (req, res) => {
  try {
    const now = new Date();
    const [
      totalVolunteers,
      activeVolunteers,
      pendingVolunteers,
      rejectedVolunteers,
      blockedVolunteers,
      taskAgg,
      overdueCount,
      warnedCount,
      autoWarningStatus
    ] = await Promise.all([
      User.countDocuments({ role: 'volunteer' }),
      User.countDocuments({ role: 'volunteer', approved: true, blocked: { $ne: true } }),
      User.countDocuments({ role: 'volunteer', approvalStatus: 'pending' }),
      User.countDocuments({ role: 'volunteer', approvalStatus: 'rejected' }),
      User.countDocuments({ role: 'volunteer', blocked: true }),
      VolunteerTask.aggregate([
        {
          $group: {
            _id: null,
            totalTasks: { $sum: 1 },
            completedTasks: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } },
            inProgressTasks: { $sum: { $cond: [{ $eq: ['$status', 'in_progress'] }, 1, 0] } },
            warnedTasks: { $sum: { $cond: [{ $eq: ['$warned', true] }, 1, 0] } }
          }
        }
      ]),
      VolunteerTask.countDocuments({ status: { $ne: 'completed' }, deadline: { $lt: now } }),
      VolunteerTask.countDocuments({ warned: true }),
      runAutoWarnings()
    ]);

    const taskStats = taskAgg[0] || {
      totalTasks: 0,
      completedTasks: 0,
      inProgressTasks: 0,
      warnedTasks: 0
    };

    res.json({
      totalVolunteers,
      activeVolunteers,
      pendingApprovals: pendingVolunteers,
      rejectedVolunteers,
      blockedVolunteers,
      totalTasksAssigned: taskStats.totalTasks,
      tasksCompleted: taskStats.completedTasks,
      tasksInProgress: taskStats.inProgressTasks,
      tasksOverdue: overdueCount,
      tasksWarned: warnedCount,
      autoWarningTriggered: autoWarningStatus.triggered,
      autoWarningCount: autoWarningStatus.count
    });
  } catch (error) {
    logger.error && logger.error('Error fetching volunteer summary:', error);
    res.status(500).json({ message: 'Error fetching volunteer summary' });
  }
};

/* -------------------------
   Get paginated volunteers list
   ------------------------- */
exports.getVolunteers = async (req, res) => {
  try {
    const { page = 1, limit = 10, search = '', status, sort = 'newest', blocked } = req.query;
    const pageNumber = Math.max(parseInt(page, 10) || 1, 1);
    const limitNumber = Math.min(Math.max(parseInt(limit, 10) || 10, 1), 200);
    const skip = (pageNumber - 1) * limitNumber;

    const query = { role: 'volunteer' };
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }

    if (status === 'approved') query.approvalStatus = 'approved';
    if (status === 'pending') query.approvalStatus = 'pending';
    if (status === 'rejected') query.approvalStatus = 'rejected';

    if (blocked === 'true') query.blocked = true;
    if (blocked === 'false') query.blocked = { $ne: true };

    const sortMap = {
      newest: { createdAt: -1 },
      oldest: { createdAt: 1 },
      name: { name: 1 },
      tasks: { 'metrics.tasksAssigned': -1 }
    };

    const sortStage = sortMap[sort] || sortMap.newest;
    const now = new Date();

    const [total, volunteers] = await Promise.all([
      User.countDocuments(query),
      User.aggregate([
        { $match: query },
        {
          $lookup: {
            from: 'volunteertasks',
            localField: '_id',
            foreignField: 'volunteerId',
            as: 'tasks'
          }
        },
        {
          $addFields: {
            metrics: {
              tasksAssigned: { $size: '$tasks' },
              tasksCompleted: {
                $size: {
                  $filter: { input: '$tasks', as: 'task', cond: { $eq: ['$$task.status', 'completed'] } }
                }
              },
              tasksOverdue: {
                $size: {
                  $filter: {
                    input: '$tasks',
                    as: 'task',
                    cond: { $and: [{ $ne: ['$$task.status', 'completed'] }, { $lt: ['$$task.deadline', now] }] }
                  }
                }
              },
              tasksWarned: { $size: { $filter: { input: '$tasks', as: 'task', cond: { $eq: ['$$task.warned', true] } } } },
              tasksActive: { $size: { $filter: { input: '$tasks', as: 'task', cond: { $ne: ['$$task.status', 'completed'] } } } }
            },
            recentTasks: {
              $slice: [
                {
                  $map: {
                    input: {
                      $slice: [
                        { $filter: { input: '$tasks', as: 'task', cond: { $eq: ['$$task.status', 'completed'] } } },
                        -5
                      ]
                    },
                    as: 't',
                    in: { _id: '$$t._id', title: '$$t.title', status: '$$t.status', deadline: '$$t.deadline', warned: '$$t.warned' }
                  }
                },
                5
              ]
            },
            activeLocation: { $ifNull: ['$volunteerProfile.currentLocation', '$address.state'] }
          }
        },
        { $project: { password: 0, tasks: 0 } },
        { $sort: sortStage },
        { $skip: skip },
        { $limit: limitNumber }
      ])
    ]);

    res.json({ data: volunteers, total, page: pageNumber, limit: limitNumber, totalPages: Math.ceil(total / limitNumber) });
  } catch (error) {
    logger.error && logger.error('Error fetching volunteers:', error);
    res.status(500).json({ message: 'Error fetching volunteers' });
  }
};

/* -------------------------
   Approve / Reject / Delete / Block / Unblock / Reset Password
   ------------------------- */
exports.approveVolunteer = async (req, res) => {
  try {
    const { id } = req.params;
    if (req.user && req.user.id === id) return res.status(400).json({ message: 'You cannot approve your own account' });

    const volunteer = await User.findOneAndUpdate({ _id: id, role: 'volunteer' }, { approved: true, approvalStatus: 'approved', blocked: false }, { new: true, lean: true });
    if (!volunteer) return res.status(404).json({ message: 'Volunteer not found' });

    try { if (mailer && mailer.sendVolunteerApproval) await mailer.sendVolunteerApproval(volunteer); } catch (e) { logger.warn('Volunteer approval email failed', e.message); }
    res.json({ message: 'Volunteer approved successfully', volunteer });
  } catch (error) {
    logger.error && logger.error('Error approving volunteer:', error);
    res.status(500).json({ message: 'Error approving volunteer' });
  }
};

exports.rejectVolunteer = async (req, res) => {
  try {
    const { id } = req.params;
    if (req.user && req.user.id === id) return res.status(400).json({ message: 'You cannot reject your own account' });

    const volunteer = await User.findOneAndUpdate({ _id: id, role: 'volunteer' }, { approved: false, approvalStatus: 'rejected' }, { new: true, lean: true });
    if (!volunteer) return res.status(404).json({ message: 'Volunteer not found' });

    try { if (mailer && mailer.sendVolunteerRejection) await mailer.sendVolunteerRejection(volunteer); } catch (e) { logger.warn('Volunteer rejection email failed', e.message); }
    res.json({ message: 'Volunteer rejected', volunteer });
  } catch (error) {
    logger.error && logger.error('Error rejecting volunteer:', error);
    res.status(500).json({ message: 'Error rejecting volunteer' });
  }
};

exports.deleteVolunteer = async (req, res) => {
  try {
    const { id } = req.params;
    if (req.user && req.user.id === id) return res.status(400).json({ message: 'You cannot delete your own account' });

    const volunteer = await User.findOneAndDelete({ _id: id, role: 'volunteer' });
    if (!volunteer) return res.status(404).json({ message: 'Volunteer not found' });

    await VolunteerTask.deleteMany({ volunteerId: id });
    res.json({ message: 'Volunteer deleted successfully' });
  } catch (error) {
    logger.error && logger.error('Error deleting volunteer:', error);
    res.status(500).json({ message: 'Error deleting volunteer' });
  }
};

/* -------------------------
   Assign Task
   ------------------------- */
exports.assignTask = async (req, res) => {
  try {
    const { id } = req.params;
    let { title, description, relatedRequest, deadline, disasterId, priority = 'medium' } = req.body;
    const allowedPriorities = ['low', 'medium', 'high', 'critical'];
    if (!allowedPriorities.includes(priority)) priority = 'medium';

    const volunteer = await User.findOne({ _id: id, role: 'volunteer', approved: true, blocked: { $ne: true } });
    if (!volunteer) return res.status(404).json({ message: 'Approved volunteer not found' });

    const task = new VolunteerTask({
      title,
      description,
      volunteerId: id,
      relatedRequest: relatedRequest ? toObjectId(relatedRequest) : null,
      disaster: disasterId ? toObjectId(disasterId) : null,
      status: 'assigned',
      deadline: deadline ? new Date(deadline) : null,
      priority,
      assignedBy: req.user ? req.user.id : null
    });

    await task.save();
    await updateVolunteerTaskStats(id);

    try {
      if (mailer && mailer.sendVolunteerAssignment) await mailer.sendVolunteerAssignment(volunteer, task);
      if (sms && sms.sendVolunteerAssignment) await sms.sendVolunteerAssignment(volunteer, task);
    } catch (err) { logger.warn('Volunteer assignment notification failed:', err.message); }

    res.status(201).json({ message: 'Task assigned successfully', task });
  } catch (error) {
    logger.error && logger.error('Error assigning task:', error);
    res.status(500).json({ message: 'Error assigning task' });
  }
};

/* -------------------------
   Warn volunteer
   ------------------------- */
exports.warnVolunteer = async (req, res) => {
  try {
    const { id } = req.params;
    const now = new Date();
    const overdueTasks = await VolunteerTask.find({ volunteerId: id, status: { $ne: 'completed' }, deadline: { $lt: now } });
    if (!overdueTasks.length) return res.status(200).json({ message: 'No overdue tasks to warn' });

    await VolunteerTask.updateMany({ _id: { $in: overdueTasks.map(t => t._id) } }, { $set: { warned: true, warnedAt: now } });

    try {
      const volunteer = await User.findById(id).lean();
      if (volunteer) {
        if (mailer && mailer.sendVolunteerWarning) await mailer.sendVolunteerWarning(volunteer, overdueTasks);
        if (sms && sms.sendVolunteerWarning) await sms.sendVolunteerWarning(volunteer, overdueTasks);
      }
    } catch (err) { logger.warn('Warn volunteer notification failed:', err.message); }

    res.json({ message: 'Volunteer warned for overdue tasks', count: overdueTasks.length });
  } catch (error) {
    logger.error && logger.error('Error warning volunteer:', error);
    res.status(500).json({ message: 'Error warning volunteer' });
  }
};

/* -------------------------
   Email volunteer
   ------------------------- */
exports.emailVolunteer = async (req, res) => {
  try {
    const { id } = req.params;
    const { subject, message } = req.body;
    if (!subject || !message) return res.status(400).json({ message: 'Subject and message are required' });

    const volunteer = await User.findOne({ _id: id, role: 'volunteer' }).lean();
    if (!volunteer) return res.status(404).json({ message: 'Volunteer not found' });

    if (mailer && mailer.sendCustom) {
      await mailer.sendCustom({ to: volunteer.email, subject, text: message, html: undefined });
    }
    res.json({ message: 'Email sent' });
  } catch (e) {
    logger.error && logger.error('Error sending email to volunteer:', e);
    res.status(500).json({ message: 'Failed to send email' });
  }
};

/* -------------------------
   Block / Unblock / Reset password
   ------------------------- */
exports.blockVolunteer = async (req, res) => {
  try {
    const { id } = req.params;
    const volunteer = await User.findOneAndUpdate({ _id: id, role: 'volunteer' }, { blocked: true }, { new: true, lean: true });
    if (!volunteer) return res.status(404).json({ message: 'Volunteer not found' });

    try { if (mailer && mailer.sendVolunteerBlocked) await mailer.sendVolunteerBlocked(volunteer); } catch (e) { logger.warn('Block notification failed:', e.message); }
    res.json({ message: 'Volunteer blocked', volunteer });
  } catch (error) {
    logger.error && logger.error('Error blocking volunteer:', error);
    res.status(500).json({ message: 'Error blocking volunteer' });
  }
};

exports.unblockVolunteer = async (req, res) => {
  try {
    const { id } = req.params;
    const volunteer = await User.findOneAndUpdate({ _id: id, role: 'volunteer' }, { blocked: false }, { new: true, lean: true });
    if (!volunteer) return res.status(404).json({ message: 'Volunteer not found' });

    try { if (mailer && mailer.sendVolunteerUnblocked) await mailer.sendVolunteerUnblocked(volunteer); } catch (e) { logger.warn('Unblock notification failed:', e.message); }
    res.json({ message: 'Volunteer unblocked', volunteer });
  } catch (error) {
    logger.error && logger.error('Error unblocking volunteer:', error);
    res.status(500).json({ message: 'Error unblocking volunteer' });
  }
};

exports.resetVolunteerPassword = async (req, res) => {
  try {
    const { id } = req.params;
    const volunteer = await User.findOne({ _id: id, role: 'volunteer' });
    if (!volunteer) return res.status(404).json({ message: 'Volunteer not found' });

    const tempPassword = crypto.randomBytes(8).toString('base64').replace(/[^a-zA-Z0-9]/g, '').slice(0, 10) || crypto.randomUUID().replace(/-/g, '').slice(0, 10);
    volunteer.password = tempPassword;
    volunteer.forcePasswordReset = true;
    await volunteer.save();

    try { if (mailer && mailer.sendVolunteerPasswordReset) await mailer.sendVolunteerPasswordReset(volunteer, tempPassword); } catch (e) { logger.warn('Password reset notification failed:', e.message); }

    res.json({ message: 'Temporary password generated and emailed' });
  } catch (error) {
    logger.error && logger.error('Error resetting volunteer password:', error);
    res.status(500).json({ message: 'Error resetting volunteer password' });
  }
};

/* -------------------------
   Volunteer detail & tasks list
   ------------------------- */
exports.getVolunteerDetail = async (req, res) => {
  try {
    const { id } = req.params;
    const volunteer = await User.findOne({ _id: id, role: 'volunteer' }).select('-password').lean();
    if (!volunteer) return res.status(404).json({ message: 'Volunteer not found' });

    const tasks = await VolunteerTask.find({ volunteerId: id }).populate('disaster', 'title type location isActive').sort({ createdAt: -1 }).limit(50).lean();
    const activeTasks = tasks.filter(t => t.status !== 'completed');
    const stats = {
      totalTasks: tasks.length,
      completedTasks: tasks.filter(t => t.status === 'completed').length,
      overdueTasks: tasks.filter(t => t.status !== 'completed' && t.deadline && t.deadline < new Date()).length
    };

    res.json({ volunteer, stats, activeTasks, recentTasks: tasks.slice(0, 10) });
  } catch (error) {
    logger.error && logger.error('Error fetching volunteer detail:', error);
    res.status(500).json({ message: 'Error fetching volunteer detail' });
  }
};

exports.listVolunteerTasks = async (req, res) => {
  try {
    const { id } = req.params;
    const tasks = await VolunteerTask.find({ volunteerId: id }).sort({ createdAt: -1 }).populate('disaster', 'title type location isActive').lean();
    res.json({ data: tasks });
  } catch (error) {
    logger.error && logger.error('Error listing volunteer tasks:', error);
    res.status(500).json({ message: 'Failed to load tasks' });
  }
};

/* -------------------------
   Active disasters for assignment
   ------------------------- */
exports.getActiveDisasters = async (req, res) => {
  try {
    const disasters = await Disaster.find({ isActive: true }).select('_id disasterId title type location severity').sort({ updatedAt: -1 }).lean();
    res.json({ data: disasters });
  } catch (error) {
    logger.error && logger.error('Error loading disasters:', error);
    res.status(500).json({ message: 'Failed to load disasters' });
  }
};
res.status(500).json({ message: 'Error blocking volunteer' });
  }
};

// Unblock volunteer
exports.unblockVolunteer = async (req, res) => {
  try {
    const { id } = req.params;
    const volunteer = await User.findOneAndUpdate(
      { _id: id, role: 'volunteer' },
      { blocked: false },
      { new: true, lean: true }
    );

    if (!volunteer) {
      return res.status(404).json({ message: 'Volunteer not found' });
    }

    try {
      await mailer.sendVolunteerUnblocked(volunteer);
    } catch (err) {
      console.warn('Unblock notification failed:', err.message);
    }

    res.json({ message: 'Volunteer unblocked', volunteer });
  } catch (error) {
    console.error('Error unblocking volunteer:', error);
    res.status(500).json({ message: 'Error unblocking volunteer' });
  }
};

// Reset volunteer password
exports.resetVolunteerPassword = async (req, res) => {
  try {
    const { id } = req.params;

    const volunteer = await User.findOne({ _id: id, role: 'volunteer' });
    if (!volunteer) {
      return res.status(404).json({ message: 'Volunteer not found' });
    }

    const tempPassword = crypto.randomBytes(8).toString('base64').replace(/[^a-zA-Z0-9]/g, '').slice(0, 10) || crypto.randomUUID().replace(/-/g, '').slice(0, 10);
    volunteer.password = tempPassword;
    volunteer.forcePasswordReset = true;
    await volunteer.save();

    try {
      await mailer.sendVolunteerPasswordReset(volunteer, tempPassword);
    } catch (err) {
      console.warn('Password reset notification failed:', err.message);
    }

    res.json({ message: 'Temporary password generated and emailed' });
  } catch (error) {
    console.error('Error resetting volunteer password:', error);
    res.status(500).json({ message: 'Error resetting volunteer password' });
  }
};

// Get volunteer detail profile
exports.getVolunteerDetail = async (req, res) => {
  try {
    const { id } = req.params;
    const volunteer = await User.findOne({ _id: id, role: 'volunteer' })
      .select('-password')
      .lean();

    if (!volunteer) {
      return res.status(404).json({ message: 'Volunteer not found' });
    }

    const tasks = await VolunteerTask.find({ volunteerId: id })
      .populate('disaster', 'title type location isActive')
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    const activeTasks = tasks.filter(task => task.status !== 'completed');

    const stats = {
      totalTasks: tasks.length,
      completedTasks: tasks.filter(task => task.status === 'completed').length,
      overdueTasks: tasks.filter(task => task.status !== 'completed' && task.deadline && task.deadline < new Date()).length
    };

    res.json({
      volunteer,
      stats,
      activeTasks,
      recentTasks: tasks.slice(0, 10)
    });
  } catch (error) {
    console.error('Error fetching volunteer detail:', error);
    res.status(500).json({ message: 'Error fetching volunteer detail' });
  }
};

// List tasks for a specific volunteer (admin usage)
exports.listVolunteerTasks = async (req, res) => {
  try {
    const { id } = req.params;
    const tasks = await VolunteerTask.find({ volunteerId: id })
      .sort({ createdAt: -1 })
      .populate('disaster', 'title type location isActive')
      .lean();

    res.json({ data: tasks });
  } catch (error) {
    console.error('Error listing volunteer tasks:', error);
    res.status(500).json({ message: 'Failed to load tasks' });
  }
};

// List active disasters for task assignment
exports.getActiveDisasters = async (req, res) => {
  try {
    const disasters = await Disaster.find({ isActive: true })
      .select('_id disasterId title type location severity')
      .sort({ updatedAt: -1 })
      .lean();

    res.json({ data: disasters });
  } catch (error) {
    console.error('Error loading disasters:', error);
    res.status(500).json({ message: 'Failed to load disasters' });
  }
};
