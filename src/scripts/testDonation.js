require('dotenv').config();
const mongoose = require('mongoose');
const Donation = require('../models/Donation');
const Disaster = require('../models/Disaster');

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log("✅ Connected");

  const disaster = await Disaster.findOne(); // pick any existing disaster
  console.log("Using disaster:", disaster.title);

  await Donation.create({
    donorName: "Seed User",
    email: "seed@example.com",
    amount: 1500,
    state: "Kerala",
    disaster: disaster._id,
    paymentStatus: "success"
  });

  console.log("✅ Donation inserted successfully");
  await mongoose.disconnect();
}

run();
