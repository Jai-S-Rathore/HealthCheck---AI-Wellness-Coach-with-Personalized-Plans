const pool = require('../config/db');

exports.addMeal = async (req, res) => {
    try {
        const { food_type, food_name, calories } = req.body;
        const userId = req.user.id;

        if (!food_type || !food_name || !calories) {
            return res.status(400).json({ error: 'All fields are required' });
        }

        const validTypes = ['breakfast', 'lunch', 'dinner', 'snack'];
        if (!validTypes.includes(food_type)) {
            return res.status(400).json({ error: 'Invalid food type' });
        }

        if (calories < 0 || calories > 10000) {
            return res.status(400).json({ error: 'Calories must be between 0 and 10000' });
        }

        await pool.query(
            'INSERT INTO meals (user_id, food_type, food_name, calories) VALUES (?, ?, ?, ?)',
            [userId, food_type, food_name, calories]
        );

        res.status(201).json({ message: 'Meal added successfully!' });
    } catch (error) {
        console.error('Add meal error:', error);
        res.status(500).json({ error: 'Server error while saving meal' });
    }
};

exports.getTodayMeals = async (req, res) => {
    try {
        const userId = req.user.id; // From your auth middleware
        const [meals] = await pool.query(
            `SELECT id, food_name, calories, food_type, created_at 
             FROM meals 
             WHERE user_id = ? AND DATE(created_at) = CURDATE() 
             ORDER BY created_at DESC`,
            [userId]
        );
        res.json(meals);
    } catch (error) {
        console.error("Fetch meals error:", error);
        res.status(500).json({ error: "Could not load today's meals" });
    }
};

exports.getDailyStats = async (req, res) => {
    try {
        const userId = req.user.id;

        const [rows] = await pool.query(
            `SELECT SUM(calories) as total FROM meals 
             WHERE user_id = ? AND DATE(created_at) = CURDATE()`,
            [userId]
        );

        const [breakdown] = await pool.query(
            `SELECT food_type, SUM(calories) as calories, COUNT(*) as count
             FROM meals WHERE user_id = ? AND DATE(created_at) = CURDATE()
             GROUP BY food_type`,
            [userId]
        );

        res.json({
            totalConsumed: rows[0].total || 0,
            breakdown: breakdown
        });
    } catch (error) {
        console.error('Get stats error:', error);
        res.status(500).json({ error: 'Server error fetching statistics' });
    }
};

exports.getWeeklyStats = async (req, res) => {
    try {
        const userId = req.user.id;

        const [rows] = await pool.query(
            `SELECT DATE(created_at) as date, SUM(calories) as total 
             FROM meals WHERE user_id = ? 
             AND created_at >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
             GROUP BY DATE(created_at) ORDER BY date`,
            [userId]
        );

        res.json(rows);
    } catch (error) {
        console.error('Get weekly stats error:', error);
        res.status(500).json({ error: 'Server error fetching weekly statistics' });
    }
};

exports.getMealHistory = async (req, res) => {
    try {
        const userId = req.user.id;
        const limit = parseInt(req.query.limit) || 50;

        const [meals] = await pool.query(
            `SELECT * FROM meals WHERE user_id = ? 
             ORDER BY created_at DESC LIMIT ?`,
            [userId, limit]
        );

        res.json(meals);
    } catch (error) {
        console.error('Get meal history error:', error);
        res.status(500).json({ error: 'Server error fetching meal history' });
    }
};


exports.getMonthlyStats = async (req, res) => {
    try {
        const userId = req.user.id;
        
        // SQL: Group calories by date for the last 30 days
        const [rows] = await pool.query(
            `SELECT DATE(created_at) as date, SUM(calories) as total 
             FROM meals 
             WHERE user_id = ? 
             AND created_at >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
             GROUP BY DATE(created_at) 
             ORDER BY date ASC`,
            [userId]
        );

        res.json(rows);
    } catch (error) {
        console.error('Monthly stats error:', error);
        res.status(500).json({ error: 'Failed to fetch stats' });
    }
};
