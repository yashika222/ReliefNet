const express = require('express');
const router = express.Router();

// Example public API route
router.get('/status', (req, res) => {
  res.json({ message: 'API is running successfully!' });
});

module.exports = router;
