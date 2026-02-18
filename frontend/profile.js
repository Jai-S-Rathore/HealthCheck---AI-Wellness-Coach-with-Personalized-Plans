const API_BASE = 'http://localhost:3000/api';

document.addEventListener('DOMContentLoaded', () => {
    loadUserProfile(); // Fetch existing data on login
});

async function loadUserProfile() {
    const token = localStorage.getItem('token');
    try {
        const response = await fetch(`${API_BASE}/profile`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (response.ok) {
            const data = await response.json();
            // Pre-fill the inputs so they are the same every time you log in
            document.getElementById('weight').value = data.weight || '';
            document.getElementById('height').value = data.height || '';
            document.getElementById('age').value = data.age || '';
            document.getElementById('activity').value = data.activity_level || 'Sedentary (No exercise)';
        }
    } catch (err) {
        console.error("Load error:", err);
    }
}


exports.updateProfile = async (req, res) => {
    try {
        const userId = req.user.id;
        const { weight, height, age, activity_level } = req.body;

        // This SQL ensures the profile is saved or updated for the specific user
        await pool.query(
            `INSERT INTO profiles (user_id, weight, height, age, activity_level) 
             VALUES (?, ?, ?, ?, ?) 
             ON DUPLICATE KEY UPDATE 
             weight = VALUES(weight), 
             height = VALUES(height), 
             age = VALUES(age), 
             activity_level = VALUES(activity_level)`,
            [userId, weight, height, age, activity_level]
        );

        res.json({ message: 'Profile updated successfully' });
    } catch (error) {
        res.status(500).json({ error: 'Database error' });
    }
};