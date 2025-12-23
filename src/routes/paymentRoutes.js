const express = require('express');
const router = express.Router();
const { createOrder, verifyPayment } = require('../controllers/paymentController');
const { requireAuth } = require('../middleware/auth'); // Check auth if needed, assuming donors might be logged in

// POST /api/payment/create-order
router.post('/create-order', createOrder);

// POST /api/payment/verify
router.post('/verify', verifyPayment);

module.exports = router;
