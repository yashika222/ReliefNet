const mongoose = require('mongoose');

const taskSchema = new mongoose.Schema({
  title: String,
  description: String,
  volunteerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Volunteer' },
  deadline: Date,
  status: { type: String, enum: ['pending', 'completed', 'overdue'], default: 'pending' },
  relatedRequest: String,
});

module.exports = mongoose.model('Task', taskSchema);
