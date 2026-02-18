const express = require('express');
const router = express.Router();
const aiController = require('../controllers/aiController');
const authenticateToken = require('../middleware/auth');

router.post('/generate-plan', authenticateToken, aiController.generatePlan);
router.post('/coach', authenticateToken, aiController.getCoachAdvice);
router.post('/generate-custom-plan', authenticateToken, aiController.generateCustomPlan);

module.exports = router;