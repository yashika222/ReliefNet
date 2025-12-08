const express = require("express");
const router = express.Router();
const donationController = require("../controllers/donationController");

router.post("/", donationController.createDonation);
router.get("/:id", donationController.getDonationById);
router.put("/:id", donationController.updateDonation);   // ✅ REQUIRED

module.exports = router;
