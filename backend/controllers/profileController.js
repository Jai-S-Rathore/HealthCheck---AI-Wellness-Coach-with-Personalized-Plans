
const pool = require('../config/db');

exports.updateProfile = async (req, res) => {
    try {
        const userId = req.user.id;
        const { weight, height, age, activity_level } = req.body;

        // Use an UPSERT logic: Update if exists, insert if not
        const [result] = await pool.query(
            `INSERT INTO profiles (user_id, weight, height, age, activity_level) 
             VALUES (?, ?, ?, ?, ?) 
             ON DUPLICATE KEY UPDATE 
             weight = VALUES(weight), 
             height = VALUES(height), 
             age = VALUES(age), 
             activity_level = VALUES(activity_level)`,
            [userId, weight, height, age, activity_level]
        );

        res.json({ message: 'Profile updated successfully!', data: req.body });
    } catch (error) {
        console.error('Update Profile Error:', error);
        res.status(500).json({ error: 'Failed to update profile' });
    }
};

exports.getProfile = async (req, res) => {
    try {
        const userId = req.user.id;
        const [rows] = await pool.query('SELECT * FROM profiles WHERE user_id = ?', [userId]);
        
        if (rows.length > 0) {
            res.json(rows[0]);
        } else {
            res.status(404).json({ message: 'Profile not found' });
        }
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch profile' });
    }
};