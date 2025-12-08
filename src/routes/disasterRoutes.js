const express = require('express');
const router = express.Router();
const disasterController = require('../controllers/disasterController');

// ✅ Correct route definitions
router.get('/', disasterController.getDisastersPage);
router.get('/data', disasterController.getDisastersData);

module.exports = router;
