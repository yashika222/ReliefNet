require('dotenv').config();
const mongoose = require('mongoose');
const Disaster = require('../models/Disaster');

async function simulateNewDisaster() {
  const mongoUri = process.env.MONGO_URI;
  if (!mongoUri) {
    console.error('❌ MONGO_URI not found in .env');
    process.exit(1);
  }

  await mongoose.connect(mongoUri);
  console.log('✅ Connected to MongoDB (Simulation Mode)');

  // random disaster generator
  const disasterTypes = ['Flood', 'Cyclone', 'Earthquake', 'Landslide', 'Wildfire'];
  const states = ['Kerala', 'Gujarat', 'Assam', 'Odisha', 'Bihar', 'Tamil Nadu', 'Maharashtra'];
  const severities = ['Low', 'Moderate', 'High', 'Severe'];

  const type = disasterTypes[Math.floor(Math.random() * disasterTypes.length)];
  const state = states[Math.floor(Math.random() * states.length)];
  const severity = severities[Math.floor(Math.random() * severities.length)];

  const newDisaster = new Disaster({
    disasterId: `SIM${Date.now()}`,
    title: `${state} ${type} ${new Date().getFullYear()}`,
    type,
    location: `${state}, India`,
    date: new Date(),
    severity,
    description: `${type} reported in ${state}. Severity level ${severity}.`,
    donationsReceived: Math.floor(Math.random() * 100000),
    isActive: true,
  });

  await newDisaster.save();
  console.log(`🆕 New simulated disaster added: ${newDisaster.title}`);

  await mongoose.disconnect();
  console.log('🚪 MongoDB disconnected');
}

simulateNewDisaster();
