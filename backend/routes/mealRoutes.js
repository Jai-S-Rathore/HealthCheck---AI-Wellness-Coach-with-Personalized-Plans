const express = require('express');
const router = express.Router();
const mealController = require('../controllers/mealController');
const authenticateToken = require('../middleware/auth');

router.get('/today', authenticateToken, mealController.getTodayMeals);
router.post('/add', authenticateToken, mealController.addMeal);
router.get('/daily-stats', authenticateToken, mealController.getDailyStats);
router.get('/weekly-stats', authenticateToken, mealController.getWeeklyStats);
router.get('/history', authenticateToken, mealController.getMealHistory);
router.get('/monthly-stats', authenticateToken, mealController.getMonthlyStats);



module.exports = router;

