const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const profileController = require('../controllers/profileController'); 
const { authenticateToken } = require('../middleware/authMiddleware'); 

router.post('/register', authController.register);
router.post('/login', authController.login);


router.post('/update-profile', authenticateToken, profileController.updateProfile);
router.get('/profile', authenticateToken, profileController.getProfile);

module.exports = router;