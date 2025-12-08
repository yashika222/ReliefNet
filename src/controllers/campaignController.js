const Campaign = require('../models/Campaign');
const User = require('../models/User');
const mailer = require('../../services/mailer');

exports.getCampaignStats = async (req, res) => {
  try {
    const [total, pending, approved, rejected] = await Promise.all([
      Campaign.countDocuments({}),
      Campaign.countDocuments({ status: 'pending' }),
      Campaign.countDocuments({ status: 'approved' }),
      Campaign.countDocuments({ status: 'rejected' })
    ]);

    res.json({
      total,
      pending,
      approved,
      rejected
    });
  } catch (error) {
    console.error('Error fetching campaign stats:', error);
    res.status(500).json({ message: 'Failed to load campaign statistics' });
  }
};

exports.listCampaigns = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search = '',
      status,
      sort = 'newest'
    } = req.query;

    const pageNumber = Math.max(parseInt(page, 10) || 1, 1);
    const limitNumber = Math.min(Math.max(parseInt(limit, 10) || 10, 1), 100);
    const skip = (pageNumber - 1) * limitNumber;

    const query = {};

    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    if (status && ['pending', 'approved', 'rejected'].includes(status)) {
      query.status = status;
    }

    const sortMap = {
      newest: { createdAt: -1 },
      oldest: { createdAt: 1 },
      title: { title: 1 }
    };

    const sortStage = sortMap[sort] || sortMap.newest;

    const [total, campaigns] = await Promise.all([
      Campaign.countDocuments(query),
      Campaign.find(query)
        .populate('createdBy', 'name email')
        .sort(sortStage)
        .skip(skip)
        .limit(limitNumber)
        .lean()
    ]);

    res.json({
      data: campaigns,
      total,
      page: pageNumber,
      limit: limitNumber,
      totalPages: Math.ceil(total / limitNumber)
    });
  } catch (error) {
    console.error('Error loading campaigns:', error);
    res.status(500).json({ message: 'Failed to load campaigns' });
  }
};

exports.getCampaignDetail = async (req, res) => {
  try {
    const { id } = req.params;
    const campaign = await Campaign.findById(id)
      .populate('createdBy', 'name email ngoProfile')
      .lean();

    if (!campaign) {
      return res.status(404).json({ message: 'Campaign not found' });
    }

    res.json({ campaign });
  } catch (error) {
    console.error('Error loading campaign detail:', error);
    res.status(500).json({ message: 'Failed to load campaign detail' });
  }
};

async function updateCampaignStatus(id, status) {
  const campaign = await Campaign.findByIdAndUpdate(
    id,
    { status },
    { new: true }
  ).populate('createdBy', 'name email');
  return campaign;
}

exports.approveCampaign = async (req, res) => {
  try {
    const { id } = req.params;
    const campaign = await updateCampaignStatus(id, 'approved');
    if (!campaign) {
      return res.status(404).json({ message: 'Campaign not found' });
    }

    try {
      await mailer.sendCampaignStatusUpdate(campaign, 'approved');
    } catch (err) {
      console.warn('Campaign approval email failed:', err.message);
    }

    res.json({ message: 'Campaign approved', campaign });
  } catch (error) {
    console.error('Error approving campaign:', error);
    res.status(500).json({ message: 'Failed to approve campaign' });
  }
};

exports.rejectCampaign = async (req, res) => {
  try {
    const { id } = req.params;
    const campaign = await updateCampaignStatus(id, 'rejected');
    if (!campaign) {
      return res.status(404).json({ message: 'Campaign not found' });
    }

    try {
      await mailer.sendCampaignStatusUpdate(campaign, 'rejected');
    } catch (err) {
      console.warn('Campaign rejection email failed:', err.message);
    }

    res.json({ message: 'Campaign rejected', campaign });
  } catch (error) {
    console.error('Error rejecting campaign:', error);
    res.status(500).json({ message: 'Failed to reject campaign' });
  }
};

exports.deleteCampaign = async (req, res) => {
  try {
    const { id } = req.params;
    const campaign = await Campaign.findByIdAndDelete(id);
    if (!campaign) {
      return res.status(404).json({ message: 'Campaign not found' });
    }
    res.json({ message: 'Campaign deleted' });
  } catch (error) {
    console.error('Error deleting campaign:', error);
    res.status(500).json({ message: 'Failed to delete campaign' });
  }
};

exports.bulkUpdateStatus = async (req, res) => {
  try {
    const { ids = [], status } = req.body;
    if (!Array.isArray(ids) || !ids.length) {
      return res.status(400).json({ message: 'No campaigns specified' });
    }
    if (!['pending', 'approved', 'rejected'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status supplied' });
    }

    const result = await Campaign.updateMany(
      { _id: { $in: ids } },
      { $set: { status } }
    );

    res.json({ message: 'Campaign statuses updated', modified: result.modifiedCount });
  } catch (error) {
    console.error('Error updating campaign statuses:', error);
    res.status(500).json({ message: 'Failed to update campaigns' });
  }
};

