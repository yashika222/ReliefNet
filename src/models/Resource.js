const mongoose = require('mongoose');

const resourceSchema = new mongoose.Schema({
  provider: { type: String },
  contact: { type: String },
  resourceType: { type: String, enum: ['food', 'medicine', 'shelter', 'clothes', 'water', 'other'], required: true },
  quantity: { type: Number, required: true, min: 0 },
  location: { type: String, required: true },
  availableFrom: { type: Date },
  notes: { type: String },
  addedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

module.exports = mongoose.model('Resource', resourceSchema);
