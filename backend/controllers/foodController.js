const axios = require('axios');

exports.searchFood = async (req, res) => {
    try {
        const query = req.query.query;
        
        if (!query || query.trim().length < 2) {
            return res.status(400).json({ error: 'Query must be at least 2 characters' });
        }

        const response = await axios.get('https://api.edamam.com/api/food-database/v2/parser', {
            params: {
                app_id: process.env.FOOD_API_ID,
                app_key: process.env.FOOD_API_KEY,
                ingr: query,
                'nutrition-type': 'logging'
                
            }
        });

        const results = response.data.hints.slice(0, 8).map(h => {
            const measure = h.measures.find(m => 
                m.label === 'Gram' || m.label === 'Serving' || m.label === 'Piece' || m.label === 'Bowl'
            ) || h.measures[0];

            const qty = measure ? measure.label : 'serving';

            return {
                label: `${h.food.label} (per ${qty})`,
                calories: Math.round(h.food.nutrients.ENERC_KCAL || 0),
                protein: Math.round(h.food.nutrients.PROCNT || 0),
                carbs: Math.round(h.food.nutrients.CHOCDF || 0),
                fat: Math.round(h.food.nutrients.FAT || 0),
                brand: h.food.brand || 'Indian Cuisine'
            };
        });

        res.json(results);
    } catch (error) {
        if (error.response && error.response.status === 429) {
            return res.status(429).json({ error: "Too many requests. Please wait a moment." });
        }
        console.error("Food Search Error:", error);
        res.status(500).json({ error: 'Failed to search food' });
    }
};