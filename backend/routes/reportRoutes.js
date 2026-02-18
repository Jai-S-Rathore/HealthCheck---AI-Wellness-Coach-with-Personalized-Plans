const express = require('express');
const router = express.Router();
const reportController = require('../controllers/reportController');
const authenticateToken = require('../middleware/auth');

router.get('/send', authenticateToken, reportController.sendReport);
router.get('/monthly-summary', authenticateToken, reportController.getMonthlySummary);

module.exports = router;