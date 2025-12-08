const mongoose = require('mongoose');

const schema = new mongoose.Schema({
  disasterId: { type: String, required: true, unique: true },

  title: { type: String, required: true },
  type: { type: String, default: 'General' },
  location: { type: String, default: 'Unknown' },

  severity: { type: String, default: 'Moderate' },

  description: { type: String, default: '' },

  date: { type: Date, default: Date.now },

  isActive: { type: Boolean, default: true }

}, { timestamps: true });

module.exports = mongoose.model('Disaster', schema);
