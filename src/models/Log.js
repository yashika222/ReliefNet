const mongoose = require('mongoose');

const logSchema = new mongoose.Schema({
  level: { type: String, default: 'info' },
  message: String,
  meta: Object,
}, { timestamps: true });

module.exports = mongoose.model('Log', logSchema);
