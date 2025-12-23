require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./src/models/User');

const email = 'yashikadhanda12@gmail.com';

mongoose.connect(process.env.MONGO_URI)
    .then(async () => {
        console.log(`Checking for user: ${email}`);
        const user = await User.findOne({ email });
        if (user) {
            console.log('User FOUND:');
            console.log(`- ID: ${user._id}`);
            console.log(`- Name: ${user.name}`);
            console.log(`- Email: ${user.email}`);
            console.log(`- Role: ${user.role}`);
            console.log(`- Password Hash: ${user.password ? user.password.substring(0, 20) + '...' : 'MISSING'}`);
        } else {
            console.log('User NOT FOUND in database.');
        }
        process.exit(0);
    })
    .catch(err => {
        console.error('Database connection error:', err);
        process.exit(1);
    });
