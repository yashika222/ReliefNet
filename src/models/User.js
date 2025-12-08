const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const USER_ROLES = ['admin', 'donor', 'ngo', 'volunteer'];

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true, lowercase: true },
  password: { type: String, required: true },
  role: { type: String, enum: USER_ROLES, default: 'donor' },
  approved: { type: Boolean, default: false }, // legacy flag for NGO/Volunteer approval
  approvalStatus: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending'
  },
  blocked: { type: Boolean, default: false },
  contact: { phone: String, address: String },
  address: {
    state: { type: String }
  },
  volunteerProfile: {
    currentLocation: { type: String, default: '' },
    city: { type: String, default: '' },
    state: { type: String, default: '' },
    availability: { type: String, enum: ['full_time', 'part_time', 'weekends', 'ad_hoc', ''], default: '' },
    skills: { type: [String], default: [] },
    totalTasksCompleted: { type: Number, default: 0 },
    totalTasksAssigned: { type: Number, default: 0 },
    hoursServed: { type: Number, default: 0 },
    lastAssignmentAt: { type: Date },
    notes: { type: String, default: '' },
    badge: { type: String, default: 'rookie' },
    idProof: {
      filename: String,
      originalName: String,
      mimeType: String,
      size: Number,
      url: String,
      uploadedAt: { type: Date }
    }
  },
  ngoProfile: {
    registrationNumber: { type: String, default: '' },
    focusAreas: { type: [String], default: [] },
    contactPerson: { type: String, default: '' },
    contactPhone: { type: String, default: '' },
    website: { type: String, default: '' },
    documents: {
      type: [
        {
          name: String,
          url: String,
          status: { type: String, enum: ['pending', 'verified', 'rejected'], default: 'pending' }
        }
      ],
      default: []
    },
    address: {
      line1: { type: String, default: '' },
      line2: { type: String, default: '' },
      city: { type: String, default: '' },
      state: { type: String, default: '' },
      postalCode: { type: String, default: '' }
    },
    notes: { type: String, default: '' }
  },
  lastLoginAt: { type: Date },
  forcePasswordReset: { type: Boolean, default: false },
}, { timestamps: true });

userSchema.pre('save', async function (next) {
  if (this.isModified('approved') && !this.isModified('approvalStatus')) {
    this.approvalStatus = this.approved
      ? 'approved'
      : (this.approvalStatus === 'rejected' ? 'rejected' : 'pending');
  }

  if (!this.isModified('password')) return next();

  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (err) {
    next(err);
  }
});

userSchema.methods.comparePassword = function (candidate) {
  return bcrypt.compare(candidate, this.password);
};

module.exports = mongoose.model('User', userSchema);
module.exports.USER_ROLES = USER_ROLES;
