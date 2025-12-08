const mongoose = require('mongoose');

const requestSchema = new mongoose.Schema({
  name: { type: String, required: true },
  contact: { type: String },
  alternativeContact: { type: String },
  location: { type: String, required: true },
  description: { type: String },
  photoUrl: { type: String },
  item: { type: String, enum: ['food', 'medicine', 'clothes', 'shelter', 'water', 'rescue', 'transport', 'other'], required: true },
  quantity: { type: Number, required: true, min: 1 },
  urgency: { type: String, enum: ['low', 'medium', 'high', 'critical'], default: 'low' },
  status: { type: String, enum: ['pending', 'approved', 'rejected', 'in_progress', 'completed'], default: 'pending' },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

module.exports = mongoose.model('Request', requestSchema);
