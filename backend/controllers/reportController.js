const pool = require('../config/db');

exports.sendReport = async (req, res) => {
    try {
        const userId = req.user.id;

        const [meals] = await pool.query(
            `SELECT * FROM meals WHERE user_id = ? 
             AND created_at > NOW() - INTERVAL 30 DAY
             ORDER BY created_at DESC`,
            [userId]
        );

        if (meals.length === 0) {
            return res.status(400).json({ 
                error: 'No meal data available for the past 30 days' 
            });
        }

        const totalCalories = meals.reduce((sum, m) => sum + m.calories, 0);
        const avgCalories = Math.round(totalCalories / 30);
        const mealsByType = meals.reduce((acc, m) => {
            acc[m.food_type] = (acc[m.food_type] || 0) + 1;
            return acc;
        }, {});

        const report = {
            period: '30 Days',
            totalMeals: meals.length,
            totalCalories: totalCalories,
            avgCaloriesPerDay: avgCalories,
            mealBreakdown: mealsByType,
            recentMeals: meals.slice(0, 10)
        };

        res.json({ 
            message: 'Report generated successfully',
            report: report
        });
    } catch (error) {
        console.error('Report generation error:', error);
        res.status(500).json({ error: 'Failed to generate report' });
    }
};

exports.getMonthlySummary = async (req, res) => {
    try {
        const userId = req.user.id;

        const [dailyTotals] = await pool.query(
            `SELECT DATE(created_at) as date, SUM(calories) as totalCalories, COUNT(*) as mealCount
             FROM meals WHERE user_id = ? 
             AND created_at > NOW() - INTERVAL 30 DAY
             GROUP BY DATE(created_at) ORDER BY date DESC`,
            [userId]
        );

        const [stats] = await pool.query(
            `SELECT COUNT(*) as totalMeals, SUM(calories) as totalCalories,
             AVG(calories) as avgCaloriesPerMeal, food_type, COUNT(*) as typeCount
             FROM meals WHERE user_id = ? 
             AND created_at > NOW() - INTERVAL 30 DAY
             GROUP BY food_type`,
            [userId]
        );

        res.json({ dailyTotals, statistics: stats });
    } catch (error) {
        console.error('Monthly summary error:', error);
        res.status(500).json({ error: 'Failed to get monthly summary' });
    }
};