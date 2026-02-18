const pool = require('../config/db');
const axios = require('axios');

exports.generatePlan = async (req, res) => {
    try {
        const { days } = req.body;
        const userId = req.user.id;

        if (!days || days < 1 || days > 7) {
            return res.status(400).json({ error: 'Days must be between 1 and 7' });
        }

        const [history] = await pool.query(
            `SELECT food_name, calories, food_type, created_at 
             FROM meals WHERE user_id = ? 
             AND created_at > DATE_SUB(NOW(), INTERVAL 30 DAY)
             ORDER BY created_at DESC`,
            [userId]
        );

        let historySummary = 'No meal history available';
        if (history.length > 0) {
            const avgCalories = Math.round(
                history.reduce((sum, m) => sum + m.calories, 0) / history.length
            );
            
            const foodItems = history.slice(0, 10)
                .map(m => `${m.food_name} (${m.calories}kcal)`)
                .join(', ');
            
            historySummary = `Average calories: ${avgCalories}kcal per meal. Recent foods: ${foodItems}`;
        }

        const prompt = `You are a professional Indian nutritionist and diet coach.

User's Recent Eating History (Last 30 Days):
${historySummary}

Task: Create a detailed ${days}-day Indian diet plan.

Requirements:
1. Include traditional Indian meals: Poha, Upma, Idli, Dosa, Dal, Roti, Sabzi, Rice, Paneer, Chicken
2. Structure each day with:
   - Breakfast (7-9 AM)
   - Lunch (12-2 PM)
   - Snack (4-5 PM)
   - Dinner (7-9 PM)
3. Provide calorie estimates for each meal
4. Keep total daily calories around 1800-2000 kcal
5. Make it beginner-friendly and practical
6. Consider user's food preferences from their history

Format your response as:
**Day 1**
🌅 Breakfast (Time): [Meal Name] - [Calories]kcal
   • Description/ingredients

🌞 Lunch (Time): [Meal Name] - [Calories]kcal
   • Description/ingredients

☕ Snack (Time): [Meal Name] - [Calories]kcal
   • Description/ingredients

🌙 Dinner (Time): [Meal Name] - [Calories]kcal
   • Description/ingredients

Repeat for ${days} days.

Add a brief motivational message at the end.`;

        const apiKey = process.env.GEMINI_API_KEY;
        
        if (!apiKey) {
            return res.status(500).json({ 
                error: 'AI service not configured. Please add GEMINI_API_KEY to .env' 
            });
        }

        const response = await axios.post(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${apiKey}`,
            {
                contents: [{
                    parts: [{ text: prompt }]
                }]
            },
            {
                headers: { 'Content-Type': 'application/json' }
            }
        );

        const plan = response.data.candidates[0].content.parts[0].text;

        res.json({ 
            plan: plan,
            daysRequested: days,
            historyCount: history.length
        });

    } catch (error) {
        console.error('AI generation error:', error.message);
        if (error.response) {
            console.error('API Response:', error.response.data);
        }
        res.status(500).json({ 
            error: 'Failed to generate diet plan. Please check your Gemini API key.' 
        });
    }
};

exports.getCoachAdvice = async (req, res) => {
    try {
        const { goal, currentWeight } = req.body;
        const prompt = `User weighs ${currentWeight}kg and wants to ${goal}. Provide a brief beginner-friendly Indian diet advice in 3-4 sentences.`;

        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            return res.status(500).json({ error: 'AI service not configured' });
        }

        const response = await axios.post(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${apiKey}`,
            { contents: [{ parts: [{ text: prompt }] }] }
        );

        res.json({ plan: response.data.candidates[0].content.parts[0].text });
    } catch (error) {
        console.error('Coach advice error:', error.message);
        res.status(500).json({ error: 'AI Coaching error' });
    }
};

// ---Custom Plan ---

// In backend/controllers/aiController.js

exports.generateCustomPlan = async (req, res) => {
    try {
        const userId = req.user.id;
        const { goal, targetWeight, timeline } = req.body;

        // 1. Fetch User's Last 30 Meals
        const [history] = await pool.query(`
            SELECT food_name, calories, food_type 
            FROM meals 
            WHERE user_id = ? 
            ORDER BY created_at DESC LIMIT 30
        `, [userId]);

        // 2. Format the history into a string
        // We do NOT use 'totalCalories' here to avoid errors
        const historyText = history.length > 0 
            ? history.map(h => `- ${h.food_name} (${h.calories} kcal)`).join('\n')
            : "No meals logged yet.";

        // 3. Build the Prompt
        const prompt = `
            Act as an expert Indian Diet Coach.
            
            **User Goal:** ${goal}
            ${targetWeight ? `**Target Weight:** ${targetWeight}kg` : ''}
            ${timeline ? `**Timeline:** ${timeline} weeks` : ''}
            
            **Recent Eating Habits:**
            ${historyText}
            
            **Task:**
            1. Analyze their habits and point out 1 major mistake.
            2. Create a strict, realistic diet plan to reach their goal.
            3. Suggest Indian food alternatives (Roti, Dal, Poha, etc.).
            
            Format with Markdown headers (##) and bold text (**).
        `;

        // 4. Call Gemini API (Using the model that worked in your test)
        const apiKey = process.env.GEMINI_API_KEY;
        const response = await axios.post(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
            { contents: [{ parts: [{ text: prompt }] }] }
        );

        const text = response.data.candidates[0].content.parts[0].text;
        res.json({ plan: text });

    } catch (error) {
        console.error("AI Controller Error:", error.message);
        // This will print the exact variable causing issues to your terminal
        if (error.response) console.error(error.response.data);
        res.status(500).json({ error: error.message });
    }
};