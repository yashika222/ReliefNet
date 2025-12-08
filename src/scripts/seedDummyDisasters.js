require('dotenv').config();
const mongoose = require('mongoose');
const Disaster = require('../models/Disaster');

async function seedDummyData() {
  const mongoUri = process.env.MONGO_URI;
  if (!mongoUri) {
    console.error('❌ MONGO_URI not found in .env');
    process.exit(1);
  }

  await mongoose.connect(mongoUri);
  console.log('✅ Connected to MongoDB');

  await Disaster.deleteMany({}); // clear old data

  const disasters = [
    {
      disasterId: 'FLD2025KER',
      title: 'Kerala Floods 2025',
      type: 'Flood',
      location: 'Kerala, India',
      date: new Date('2025-10-20'),
      severity: 'Severe',
      description: 'Heavy rainfall caused flooding in multiple districts of Kerala.',
      donationsReceived: 250000,
      isActive: true,
    },
    {
      disasterId: 'CYC2025GUJ',
      title: 'Gujarat Cyclone 2025',
      type: 'Cyclone',
      location: 'Gujarat, India',
      date: new Date('2025-09-15'),
      severity: 'High',
      description: 'Cyclone hit coastal Gujarat leading to property damage and power cuts.',
      donationsReceived: 180000,
      isActive: true,
    },
    {
      disasterId: 'EQK2025NEP',
      title: 'Nepal Earthquake 2025',
      type: 'Earthquake',
      location: 'Nepal-India Border Region',
      date: new Date('2025-07-11'),
      severity: 'Moderate',
      description: 'Moderate intensity earthquake felt in northern India and Nepal.',
      donationsReceived: 90000,
      isActive: true,
    },
  ];

  await Disaster.insertMany(disasters);
  console.log('🌍 Dummy disasters added successfully!');

  await mongoose.disconnect();
  console.log('🚪 Database connection closed.');
}

seedDummyData().catch((err) => {
  console.error('❌ Error seeding data:', err);
  mongoose.disconnect();
});
