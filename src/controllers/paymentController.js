const Razorpay = require('razorpay');
const crypto = require('crypto');
const Donation = require('../models/Donation');
const mailer = require('../../services/mailer');

// Initialize Razorpay
// NOTE: Make sure RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET are in .env
// Initialize Razorpay conditionally
let razorpay = null;
if (process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET) {
  try {
    razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET
    });
  } catch (err) {
    console.error('[Payment] Failed to initialize Razorpay:', err.message);
  }
} else {
  console.warn('[Payment] Razorpay keys missing. Payment features will be disabled.');
}

const createOrder = async (req, res) => {
  try {
    const { amount, donationId } = req.body;

    console.log(`[Payment] Creating order for Donation ID: ${donationId}, Amount: ${amount}`);

    if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
      console.error('[Payment] Missing Razorpay Keys in Environment');
      return res.status(500).json({ error: 'Server configuration error: Missing Payment Keys' });
    }

    if (!amount || !donationId) {
      return res.status(400).json({ error: 'Amount and Donation ID are required' });
    }

    // Amount validation
    if (isNaN(amount) || Number(amount) <= 0) {
      return res.status(400).json({ error: 'Invalid amount' });
    }

    const options = {
      amount: Math.round(Number(amount) * 100), // amount in paise
      currency: "INR",
      receipt: donationId ? donationId.toString() : undefined,
      payment_capture: 1
    };

    console.log('[Payment] Razorpay Options:', options);

    const order = await razorpay.orders.create(options);
    console.log('[Payment] Order Created Successfully:', order.id);

    res.json({
      success: true,
      order_id: order.id,
      amount: options.amount,
      key_id: process.env.RAZORPAY_KEY_ID,
      donationId: donationId
    });

  } catch (error) {
    console.error('Razorpay Order Creation Error:', error);
    // Send more specific error if available
    const statusCode = error.statusCode || 500;
    const message = error.error && error.error.description ? error.error.description : 'Something went wrong';
    res.status(statusCode).json({ error: message, details: error });
  }
};

const verifyPayment = async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, donationId } = req.body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !donationId) {
      return res.status(400).json({ success: false, message: "Missing required parameters" });
    }

    const body = razorpay_order_id + "|" + razorpay_payment_id;

    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(body.toString())
      .digest('hex');

    const isAuthentic = expectedSignature === razorpay_signature;

    if (isAuthentic) {
      // Payment successful, update database
      const updatedDonation = await Donation.findByIdAndUpdate(donationId, {
        paymentStatus: 'success',
        // Start date / time could be updated here if needed
      }, { new: true });

      // Send Receipt Email
      if (updatedDonation) {
        try {
          await mailer.sendDonationReceipt(updatedDonation);
          console.log(`[Payment] Receipt sent to ${updatedDonation.email}`);
        } catch (emailErr) {
          console.error('[Payment] Failed to send receipt:', emailErr.message);
        }
      }

      res.status(200).json({
        success: true,
        message: "Payment verified successfully"
      });
    } else {
      await Donation.findByIdAndUpdate(donationId, {
        paymentStatus: 'failed'
      });

      res.status(400).json({
        success: false,
        message: "Invalid signature"
      });
    }
  } catch (error) {
    console.error('Payment Verification Error:', error);
    res.status(500).json({ success: false, message: "Server Error", error: error.message });
  }
};

module.exports = {
  createOrder,
  verifyPayment
};
