const mongoose = require('mongoose');
const User = require('../models/User');
const Campaign = require('../models/Campaign');
const mailer = require('../../services/mailer');

const { Types } = mongoose;
const DOCUMENT_STATUSES = ['pending', 'verified', 'rejected'];

function toObjectId(id) {
  if (!id || !Types.ObjectId.isValid(id)) return null;
  return new Types.ObjectId(id);
}

exports.getNgoStats = async (req, res) => {
  try {
    const [total, pending, approved, rejected, activeCampaigns] = await Promise.all([
      User.countDocuments({ role: 'ngo' }),
      User.countDocuments({ role: 'ngo', approvalStatus: 'pending' }),
      User.countDocuments({ role: 'ngo', approvalStatus: 'approved' }),
      User.countDocuments({ role: 'ngo', approvalStatus: 'rejected' }),
      Campaign.countDocuments({ status: 'approved' })
    ]);

    res.json({
      total,
      pending,
      approved,
      rejected,
      activeCampaigns
    });
  } catch (error) {
    console.error('Error fetching NGO stats:', error);
    res.status(500).json({ message: 'Failed to load NGO stats' });
  }
};

exports.listNgos = async (req, res) => {
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

    const query = { role: 'ngo' };

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { 'ngoProfile.registrationNumber': { $regex: search, $options: 'i' } }
      ];
    }

    if (status && ['pending', 'approved', 'rejected'].includes(status)) {
      query.approvalStatus = status;
    }

    const sortMap = {
      newest: { createdAt: -1 },
      oldest: { createdAt: 1 },
      name: { name: 1 }
    };

    const sortStage = sortMap[sort] || sortMap.newest;

    const [total, ngos] = await Promise.all([
      User.countDocuments(query),
      User.find(query)
        .select('-password')
        .sort(sortStage)
        .skip(skip)
        .limit(limitNumber)
        .lean()
    ]);

    res.json({
      data: ngos,
      total,
      page: pageNumber,
      limit: limitNumber,
      totalPages: Math.ceil(total / limitNumber)
    });
  } catch (error) {
    console.error('Error loading NGOs:', error);
    res.status(500).json({ message: 'Failed to load NGOs' });
  }
};

exports.getNgoDetail = async (req, res) => {
  try {
    const { id } = req.params;

    const ngo = await User.findOne({ _id: id, role: 'ngo' })
      .select('-password')
      .lean();

    if (!ngo) {
      return res.status(404).json({ message: 'NGO not found' });
    }

    const campaigns = await Campaign.find({ createdBy: id })
      .select('title status targetAmount createdAt updatedAt')
      .sort({ createdAt: -1 })
      .lean();

    res.json({
      ngo,
      campaigns,
      stats: {
        totalCampaigns: campaigns.length,
        approvedCampaigns: campaigns.filter(c => c.status === 'approved').length,
        pendingCampaigns: campaigns.filter(c => c.status === 'pending').length
      }
    });
  } catch (error) {
    console.error('Error fetching NGO detail:', error);
    res.status(500).json({ message: 'Failed to load NGO profile' });
  }
};

exports.approveNgo = async (req, res) => {
  try {
    const { id } = req.params;

    const ngo = await User.findOneAndUpdate(
      { _id: id, role: 'ngo' },
      {
        approved: true,
        approvalStatus: 'approved'
      },
      { new: true, lean: true }
    );

    if (!ngo) {
      return res.status(404).json({ message: 'NGO not found' });
    }

    try {
      await mailer.sendNgoStatusUpdate(ngo, 'approved');
    } catch (err) {
      console.warn('NGO approval email failed:', err.message);
    }

    res.json({ message: 'NGO approved', ngo });
  } catch (error) {
    console.error('Error approving NGO:', error);
    res.status(500).json({ message: 'Failed to approve NGO' });
  }
};

exports.rejectNgo = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason = '' } = req.body;

    const ngo = await User.findOneAndUpdate(
      { _id: id, role: 'ngo' },
      {
        approved: false,
        approvalStatus: 'rejected',
        'ngoProfile.notes': reason
      },
      { new: true, lean: true }
    );

    if (!ngo) {
      return res.status(404).json({ message: 'NGO not found' });
    }

    try {
      await mailer.sendNgoStatusUpdate(ngo, 'rejected', reason);
    } catch (err) {
      console.warn('NGO rejection email failed:', err.message);
    }

    res.json({ message: 'NGO rejected', ngo });
  } catch (error) {
    console.error('Error rejecting NGO:', error);
    res.status(500).json({ message: 'Failed to reject NGO' });
  }
};

exports.deleteNgo = async (req, res) => {
  try {
    const { id } = req.params;

    const ngo = await User.findOneAndDelete({ _id: id, role: 'ngo' });

    if (!ngo) {
      return res.status(404).json({ message: 'NGO not found' });
    }

    await Campaign.deleteMany({ createdBy: id });

    res.json({ message: 'NGO deleted successfully' });
  } catch (error) {
    console.error('Error deleting NGO:', error);
    res.status(500).json({ message: 'Failed to delete NGO' });
  }
};

exports.updateNgoDocumentStatus = async (req, res) => {
  try {
    const { id, documentId } = req.params;
    const { status } = req.body;

    if (!DOCUMENT_STATUSES.includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }

    const docObjectId = toObjectId(documentId);
    if (!docObjectId) {
      return res.status(400).json({ message: 'Invalid document id' });
    }

    const result = await User.findOneAndUpdate(
      { _id: id, role: 'ngo', 'ngoProfile.documents._id': docObjectId },
      { $set: { 'ngoProfile.documents.$.status': status } },
      { new: true, lean: true }
    );

    if (!result) {
      return res.status(404).json({ message: 'Document not found' });
    }

    res.json({ message: 'Document status updated', ngo: result });
  } catch (error) {
    console.error('Error updating document status:', error);
    res.status(500).json({ message: 'Failed to update document status' });
  }
};

