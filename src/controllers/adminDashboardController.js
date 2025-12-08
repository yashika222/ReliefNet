const Donation = require('../models/Donation');
const VolunteerTask = require('../models/VolunteerTask');
const Disaster = require('../models/Disaster');
const User = require('../models/User');
const logger = require('../config/logger');

function handleError(res, error, message = 'Failed to fetch analytics data') {
  logger.error(message, { error: error.message });
  return res.status(500).json({ message });
}

function formatCurrency(amount) {
  return amount || amount === 0 ? amount : 0;
}

function toStartOfDay(date) {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function toStartOfWeek(date, weekStartsOn = 1) {
  const copy = new Date(date);
  const day = copy.getDay();
  const diff = (day < weekStartsOn ? 7 : 0) + day - weekStartsOn;
  copy.setDate(copy.getDate() - diff);
  return toStartOfDay(copy);
}

function toStartOfMonth(date) {
  const copy = new Date(date);
  copy.setDate(1);
  return toStartOfDay(copy);
}

function toStartOfYear(date) {
  const copy = new Date(date);
  copy.setMonth(0, 1);
  return toStartOfDay(copy);
}

function subtractDays(date, amount) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() - amount);
  return copy;
}

async function renderDashboard(req, res) {
  return res.render('pages/admin-dashboard', {
    title: 'Admin Dashboard',
    user: req.user,
    activePage: 'dashboard',
    layout: 'admin-layout',
  });
}

async function getDonationsToday(req, res) {
  try {
    const start = toStartOfDay(new Date());
    const [today] = await Donation.aggregate([
      {
        $match: {
          createdAt: { $gte: start },
          paymentStatus: { $ne: 'failed' },
        },
      },
      {
        $group: {
          _id: null,
          totalAmount: { $sum: '$amount' },
          totalCount: { $sum: 1 },
        },
      },
    ]);

    return res.json({
      amount: formatCurrency(today?.totalAmount || 0),
      count: today?.totalCount || 0,
    });
  } catch (error) {
    return handleError(res, error, 'Failed to fetch today donation stats');
  }
}

async function getDonationsWeek(req, res) {
  try {
    const start = toStartOfWeek(new Date(), 1);
    const [week] = await Donation.aggregate([
      {
        $match: {
          createdAt: { $gte: start },
          paymentStatus: { $ne: 'failed' },
        },
      },
      {
        $group: {
          _id: null,
          totalAmount: { $sum: '$amount' },
          totalCount: { $sum: 1 },
        },
      },
    ]);

    return res.json({
      amount: formatCurrency(week?.totalAmount || 0),
      count: week?.totalCount || 0,
    });
  } catch (error) {
    return handleError(res, error, 'Failed to fetch weekly donation stats');
  }
}

async function getDonationsMonth(req, res) {
  try {
    const start = toStartOfMonth(new Date());
    const [month] = await Donation.aggregate([
      {
        $match: {
          createdAt: { $gte: start },
          paymentStatus: { $ne: 'failed' },
        },
      },
      {
        $group: {
          _id: null,
          totalAmount: { $sum: '$amount' },
          totalCount: { $sum: 1 },
        },
      },
    ]);

    return res.json({
      amount: formatCurrency(month?.totalAmount || 0),
      count: month?.totalCount || 0,
    });
  } catch (error) {
    return handleError(res, error, 'Failed to fetch monthly donation stats');
  }
}

async function getDonationsTotal(req, res) {
  try {
    const [totals] = await Donation.aggregate([
      {
        $match: {
          paymentStatus: { $ne: 'failed' },
        },
      },
      {
        $group: {
          _id: null,
          totalAmount: { $sum: '$amount' },
          totalCount: { $sum: 1 },
        },
      },
    ]);

    return res.json({
      amount: formatCurrency(totals?.totalAmount || 0),
      count: totals?.totalCount || 0,
    });
  } catch (error) {
    return handleError(res, error, 'Failed to fetch total donation stats');
  }
}

async function getRecentDonations(req, res) {
  try {
    const recent = await Donation.aggregate([
      { $match: { paymentStatus: { $ne: 'failed' } } },
      { $sort: { createdAt: -1 } },
      { $limit: 5 },
      {
        $lookup: {
          from: 'disasters',
          localField: 'disaster',
          foreignField: '_id',
          as: 'disasterDoc',
        },
      },
      {
        $unwind: {
          path: '$disasterDoc',
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $project: {
          donorName: 1,
          amount: 1,
          disaster: {
            $ifNull: ['$disasterDoc.title', '$disasterId'],
          },
          createdAt: 1,
        },
      },
    ]);

    return res.json(recent.map((item) => ({
      donorName: item.donorName || 'Anonymous',
      amount: formatCurrency(item.amount || 0),
      disaster: item.disaster || 'N/A',
      createdAt: item.createdAt,
    })));
  } catch (error) {
    return handleError(res, error, 'Failed to fetch recent donations');
  }
}

async function getDonationTrend(req, res) {
  try {
    const since = subtractDays(new Date(), 29);
    since.setHours(0, 0, 0, 0);

    const trend = await Donation.aggregate([
      {
        $match: {
          createdAt: { $gte: since },
          paymentStatus: { $ne: 'failed' },
        },
      },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          totalAmount: { $sum: '$amount' },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    const startYear = toStartOfMonth(new Date());
    startYear.setMonth(startYear.getMonth() - 11);
    const monthly = await Donation.aggregate([
      {
        $match: {
          createdAt: { $gte: startYear },
          paymentStatus: { $ne: 'failed' },
        },
      },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m', date: '$createdAt' } },
          totalAmount: { $sum: '$amount' },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    const monthlyLabels = monthly.map((item) => item._id);
    const cumulative = [];
    monthly.reduce((acc, item, index) => {
      const next = acc + (item.totalAmount || 0);
      cumulative[index] = next;
      return next;
    }, 0);

    return res.json({
      daily: {
        labels: trend.map((item) => item._id),
        values: trend.map((item) => formatCurrency(item.totalAmount || 0)),
      },
      monthlyCumulative: {
        labels: monthlyLabels,
        values: cumulative.map((value) => formatCurrency(value)),
      },
    });
  } catch (error) {
    return handleError(res, error, 'Failed to fetch donation trend data');
  }
}

async function getDonationsByState(req, res) {
  try {
    const byState = await Donation.aggregate([
      {
        $match: {
          paymentStatus: { $ne: 'failed' },
        },
      },
      {
        $group: {
          _id: '$state',
          totalAmount: { $sum: '$amount' },
        },
      },
      { $sort: { totalAmount: -1 } },
    ]);

    return res.json({
      labels: byState.map((item) => item._id || 'Unknown'),
      values: byState.map((item) => formatCurrency(item.totalAmount || 0)),
    });
  } catch (error) {
    return handleError(res, error, 'Failed to fetch donation by state data');
  }
}

async function getDonationsByDisaster(req, res) {
  try {
    const byDisaster = await Donation.aggregate([
      {
        $match: {
          paymentStatus: { $ne: 'failed' },
        },
      },
      {
        $group: {
          _id: '$disaster',
          totalAmount: { $sum: '$amount' },
          disasterId: { $first: '$disasterId' },
        },
      },
      {
        $lookup: {
          from: 'disasters',
          localField: '_id',
          foreignField: '_id',
          as: 'disasterDoc',
        },
      },
      {
        $unwind: {
          path: '$disasterDoc',
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $project: {
          name: {
            $cond: [
              { $ne: ['$_id', null] },
              { $ifNull: ['$disasterDoc.title', 'Unspecified'] },
              { $ifNull: ['$disasterId', 'Unspecified'] },
            ],
          },
          totalAmount: 1,
        },
      },
      { $sort: { totalAmount: -1 } },
    ]);

    return res.json({
      labels: byDisaster.map((item) => item.name),
      values: byDisaster.map((item) => formatCurrency(item.totalAmount || 0)),
    });
  } catch (error) {
    return handleError(res, error, 'Failed to fetch donation by disaster data');
  }
}

async function getVolunteerSummary(req, res) {
  try {
    const [totalVolunteers, activeVolunteers, volunteerTaskStats, volunteers] = await Promise.all([
      User.countDocuments({ role: 'volunteer' }),
      User.countDocuments({ role: 'volunteer', approved: true }),
      VolunteerTask.aggregate([
      {
        $group: {
          _id: '$volunteerId',
          completed: {
            $sum: {
              $cond: [{ $eq: ['$status', 'completed'] }, 1, 0],
            },
          },
          total: { $sum: 1 },
        },
      },
      ]),
      User.find({ role: 'volunteer' })
        .select('name email approved')
        .lean(),
    ]);

    const volunteerTaskMap = volunteerTaskStats.reduce((acc, item) => {
      acc[item._id?.toString() || 'unknown'] = {
        completed: item.completed || 0,
        total: item.total || 0,
      };
      return acc;
    }, {});

    const tasksAssigned = volunteerTaskStats.reduce((acc, item) => acc + (item.total || 0), 0);
    const tasksCompleted = volunteerTaskStats.reduce((acc, item) => acc + (item.completed || 0), 0);

    const volunteerRows = volunteers.map((volunteer) => {
      const stats = volunteerTaskMap[volunteer._id.toString()] || { completed: 0, total: 0 };
      return {
        id: volunteer._id,
        name: volunteer.name,
        email: volunteer.email,
        completedTasks: stats.completed,
        totalTasks: stats.total,
        isActive: Boolean(volunteer.approved),
      };
    });

    return res.json({
      totalVolunteers,
      activeVolunteers,
      tasksAssigned,
      tasksCompleted,
      volunteers: volunteerRows,
    });
  } catch (error) {
    return handleError(res, error, 'Failed to fetch volunteer summary');
  }
}

async function getVolunteerRanking(req, res) {
  try {
    const ranking = await VolunteerTask.aggregate([
      {
        $group: {
          _id: '$volunteerId',
          completed: {
            $sum: {
              $cond: [{ $eq: ['$status', 'completed'] }, 1, 0],
            },
          },
        },
      },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'volunteer',
        },
      },
      {
        $unwind: {
          path: '$volunteer',
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $project: {
          name: { $ifNull: ['$volunteer.name', 'Unknown Volunteer'] },
          completed: 1,
        },
      },
      { $sort: { completed: -1 } },
      { $limit: 10 },
    ]);

    return res.json({
      labels: ranking.map((item) => item.name),
      values: ranking.map((item) => item.completed || 0),
    });
  } catch (error) {
    return handleError(res, error, 'Failed to fetch volunteer ranking');
  }
}

async function getDisasterSummary(req, res) {
  try {
    const [activeDisasters, closedDisasters, totalDisasters] = await Promise.all([
      Disaster.countDocuments({ isActive: true }),
      Disaster.countDocuments({ isActive: false }),
      Disaster.countDocuments(),
    ]);

    return res.json({
      activeDisasters,
      closedDisasters,
      totalDisasters,
    });
  } catch (error) {
    return handleError(res, error, 'Failed to fetch disaster summary');
  }
}

async function getRecentDisasters(req, res) {
  try {
    const disasters = await Disaster.find()
      .sort({ updatedAt: -1 })
      .limit(5)
      .select('title severity isActive createdAt updatedAt')
      .lean();

    return res.json(
      disasters.map((item) => ({
        title: item.title || 'Untitled Disaster',
        severity: item.severity || 'Unknown',
        createdAt: item.createdAt,
        status: item.isActive ? 'Active' : 'Closed',
      })),
    );
  } catch (error) {
    return handleError(res, error, 'Failed to fetch recent disasters');
  }
}

async function getSeverityDistribution(req, res) {
  try {
    const distribution = await Disaster.aggregate([
      {
        $group: {
          _id: { $ifNull: ['$severity', 'Unknown'] },
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
    ]);

    return res.json({
      labels: distribution.map((item) => item._id),
      values: distribution.map((item) => item.count),
    });
  } catch (error) {
    return handleError(res, error, 'Failed to fetch disaster severity distribution');
  }
}

module.exports = {
  renderDashboard,
  getDonationsToday,
  getDonationsWeek,
  getDonationsMonth,
  getDonationsTotal,
  getRecentDonations,
  getDonationTrend,
  getDonationsByState,
  getDonationsByDisaster,
  getVolunteerSummary,
  getVolunteerRanking,
  getDisasterSummary,
  getRecentDisasters,
  getSeverityDistribution,
};

