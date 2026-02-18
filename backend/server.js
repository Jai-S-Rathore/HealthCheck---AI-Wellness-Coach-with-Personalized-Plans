require("dotenv").config(); 
const express = require("express");
const cors = require("cors");
const app = express();

app.get('/health', (req, res) => {
    res.json({ status: 'Running', timestamp: new Date() });
});

// 1. Updated CORS and Middleware
app.use(cors({ origin: process.env.FRONTEND_URL || '*', credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 2. Database Connection
require('./config/db'); 

// 3. Request Logger
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
    next();
});

// 4. IMPORT ROUTES
// These must match your file names in the 'routes' folder
const authRoutes = require('./routes/authRoutes');
const mealRoutes = require('./routes/mealRoutes');
const foodRoutes = require('./routes/foodRoutes');
const aiRoutes = require('./routes/aiRoutes');
const reportRoutes = require('./routes/reportRoutes');

// 5. MOUNT ROUTES
app.use('/api/auth', authRoutes);
app.use('/api/meals', mealRoutes);
app.use('/api/food', foodRoutes); // This enables your Indian food search
app.use('/api/ai', aiRoutes);     // This enables the AI Diet Coach
app.use('/api/reports', reportRoutes);

// 6. Start Server
const port = process.env.PORT || 3000;
app.listen(port, () => {
    console.log(`🚀 Server running on http://localhost:${port}`);
});