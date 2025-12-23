require('dotenv').config();
const nodemailer = require('nodemailer');

const user = process.env.EMAIL_USER;
const pass = process.env.EMAIL_PASS;

console.log('--- Email Config Test ---');
console.log(`Email User: ${user ? user : 'MISSING'}`);
console.log(`Email Pass: ${pass ? (pass.length + ' chars' + (pass.includes(' ') ? ' (WARNING: contains spaces)' : '')) : 'MISSING'}`);

if (!user || !pass) {
    console.error('❌ Missing credentials in .env file');
    process.exit(1);
}

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: user,
        pass: pass
    }
});

transporter.verify(function (error, success) {
    if (error) {
        console.error('❌ connection error:');
        console.error(error);
        console.log('\n--- Troubleshooting Tips ---');
        console.log('1. Ensure "EMAIL_PASS" is an "App Password", NOT your login password.');
        console.log('   Go to: Google Account > Security > 2-Step Verification > App passwords');
        console.log('2. Check for leading/trailing spaces in .env file.');
        console.log('3. If you just generated the password, wait 1-2 minutes.');
    } else {
        console.log('✅ Connection successful! Credentials are correct.');
    }
});
