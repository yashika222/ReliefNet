const Donation = require("../models/Donation");
const mongoose = require("mongoose");

// ✅ CREATE DONATION (POST /api/donations)
exports.createDonation = async (req, res) => {
  try {
    const { donorName, email, amount, state, disasterId } = req.body;

    // ✅ Convert disasterId to ObjectId only if valid
    let disasterObjectId = null;
    if (disasterId && mongoose.Types.ObjectId.isValid(disasterId)) {
      disasterObjectId = disasterId;
    }

    const donation = await Donation.create({
      donorName,
      email,
      amount: Number(amount) || 0,
      state: state || "Unknown",

      disaster: disasterObjectId,       // ✅ ObjectId reference
      disasterId: disasterId || "Unspecified",   // ✅ string fallback

      paymentStatus: "pending",         // ✅ donate.js updates it later
    });

    return res.json({
      success: true,
      donationId: donation._id,
    });
  } catch (e) {
    console.error("Donation Create Error:", e.message);
    return res.status(500).json({ error: e.message });
  }
};

// ✅ GET DONATION BY ID  (GET /api/donations/:id)
exports.getDonationById = async (req, res) => {
  try {
    const donation = await Donation.findById(req.params.id);

    if (!donation) {
      return res.status(404).json({ error: "Donation not found" });
    }

    return res.json(donation);
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};

// ✅ UPDATE DONATION PAYMENT STATUS (PUT /api/donations/:id)
exports.updateDonation = async (req, res) => {
  try {
    const { paymentStatus } = req.body;

    const donation = await Donation.findByIdAndUpdate(
      req.params.id,
      { paymentStatus },
      { new: true }
    );

    if (!donation) {
      return res.status(404).json({ error: "Donation not found" });
    }

    return res.json({
      success: true,
      donation,
    });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};
