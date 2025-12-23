require('dotenv').config();
const Razorpay = require('razorpay');

// Keys from .env
const key_id = process.env.RAZORPAY_KEY_ID;
const key_secret = process.env.RAZORPAY_KEY_SECRET;

console.log('Testing Razorpay Keys...');
console.log(`Key ID: ${key_id}`);
// Hide secret in logs for security, just show length
console.log(`Key Secret Length: ${key_secret ? key_secret.length : 'MISSING'}`);

const razorpay = new Razorpay({
    key_id: key_id,
    key_secret: key_secret
});

async function testConnection() {
    try {
        // Try to fetch all orders (limit 1) just to test auth
        const orders = await razorpay.orders.all({ limit: 1 });
        console.log('✅ Connection Successful!');
        console.log('Fetched orders:', orders);
    } catch (error) {
        console.error('❌ Connection Failed!');
        console.error('Error Code:', error.statusCode);
        console.error('Error Description:', error.error ? error.error.description : error.message);
    }
}

testConnection();
