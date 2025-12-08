const mongoose = require('mongoose');

const donationSchema = new mongoose.Schema(
  {
    donorName: { type: String, required: true },
    email: { type: String },

    // ✅ Dashboard uses this for all charts
    amount: { type: Number, required: true, default: 0 },

    // ✅ Required for state-wise charts
    state: { type: String, default: "Unknown" },

    // ✅ Disaster linking
    disaster: { type: mongoose.Schema.Types.ObjectId, ref: "Disaster", default: null },
    disasterId: { type: String, default: "Unspecified" },

    // ✅ donate.js expects paymentStatus to update later
    paymentStatus: {
      type: String,
      enum: ["pending", "success", "failed"],
      default: "pending",
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Donation", donationSchema);
