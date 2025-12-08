const mongoose = require('mongoose');

const ngoSchema = new mongoose.Schema({
  name: String,
  email: String,
  registrationNumber: String,
  documents: [String],
  status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('NGO', ngoSchema);
