const mongoose = require('mongoose');

const VolunteerTaskSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: String,
  volunteerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  relatedRequest: { type: mongoose.Schema.Types.ObjectId, ref: 'Request', default: null },
  disaster: { type: mongoose.Schema.Types.ObjectId, ref: 'Disaster', default: null },
  status: { type: String, enum: ['assigned', 'in_progress', 'completed'], default: 'assigned' },
  deadline: { type: Date },
  warned: { type: Boolean, default: false },
  warnedAt: { type: Date },
  acceptedAt: { type: Date },
  completedAt: { type: Date },
  assignedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  priority: { type: String, enum: ['low', 'medium', 'high', 'critical'], default: 'medium' },
  report: {
    description: { type: String, default: '' },
    submittedAt: { type: Date },
    attachments: [{
      filename: String,
      originalName: String,
      mimeType: String,
      size: Number,
      url: String,
      uploadedAt: { type: Date }
    }]
  },
  history: [{
    status: { type: String },
    note: String,
    at: { type: Date, default: Date.now }
  }]
}, { timestamps: true });

module.exports = mongoose.model('VolunteerTask', VolunteerTaskSchema);
