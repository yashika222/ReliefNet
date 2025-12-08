const mongoose = require('mongoose');

const volunteerSchema = new mongoose.Schema({
  name: String,
  email: String,
  status: { type: String, enum: ['approved', 'pending', 'rejected'], default: 'pending' },
  tasksAssigned: { type: Number, default: 0 },
  tasksCompleted: { type: Number, default: 0 },
  tasksOverdue: { type: Number, default: 0 },
  warned: { type: Number, default: 0 },
  isBlocked: { type: Boolean, default: false },
});

module.exports = mongoose.model('Volunteer', volunteerSchema);
