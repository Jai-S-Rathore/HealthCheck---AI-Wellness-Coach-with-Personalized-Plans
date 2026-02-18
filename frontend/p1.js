

let calorieChart;
let trendChartInstance;
const API_BASE = "http://localhost:3000/api";
let selectedFood = null;
let userCalorieGoal = 2000;

// CACHE for search results to avoid repeated API calls
const searchCache = new Map();
let lastSearchTime = 0;
const MIN_SEARCH_INTERVAL = 1000; // 1 second between searches

// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', () => {
    const token = localStorage.getItem('token');
    
    if (!token) {
        window.location.href = 'login.html';
        return;
    }

    loadCalorieGoal();
    const userName = localStorage.getItem('userName') || 'User';
    const nameDisplay = document.getElementById('user-name');
    if (nameDisplay) nameDisplay.innerText = userName;

    initChart();
    initTrendChart();
    checkWorkoutAccess();
    updateDashboard();
    setupEventListeners();
});

// --- CALORIE GOAL MANAGEMENT ---
function loadCalorieGoal() {
    const savedGoal = localStorage.getItem('calorieGoal');
    if (savedGoal) {
        userCalorieGoal = parseInt(savedGoal);
    } else {
        userCalorieGoal = 2000;
        localStorage.setItem('calorieGoal', userCalorieGoal);
    }
    updateGoalDisplay();
}

function updateGoalDisplay() {
    const goalElements = document.querySelectorAll('.goal-value');
    goalElements.forEach(el => {
        el.innerText = userCalorieGoal;
    });
    
    const goalInput = document.getElementById('new-goal-input');
    if (goalInput) {
        goalInput.value = userCalorieGoal;
    }
}

function flipToGoalSetter() {
    const card = document.getElementById('progress-card');
    if (card) {
        card.classList.add('flipped');
    }
}

function flipToProgress() {
    const card = document.getElementById('progress-card');
    if (card) {
        card.classList.remove('flipped');
    }
}

function saveNewGoal() {
    const input = document.getElementById('new-goal-input');
    const newGoal = parseInt(input.value);
    
    if (isNaN(newGoal) || newGoal < 1000 || newGoal > 5000) {
        showToast('Please enter a goal between 1000-5000 kcal', 'error');
        return;
    }
    
    userCalorieGoal = newGoal;
    localStorage.setItem('calorieGoal', userCalorieGoal);
    
    updateGoalDisplay();
    updateDashboard();
    flipToProgress();
    
    showToast(`Goal updated to ${userCalorieGoal} kcal! 🎯`, 'success');
}

function setQuickGoal(goal) {
    const input = document.getElementById('new-goal-input');
    if (input) {
        input.value = goal;
    }
}

function setupEventListeners() {
    const searchInput = document.getElementById('search-input');
    const addItemBtn = document.getElementById('add-item-btn');

    // Increased debounce to reduce API calls
    if (searchInput) {
        searchInput.addEventListener('input', debounce(handleSearch, 800));
    }

    if (addItemBtn) {
        addItemBtn.addEventListener('click', saveMeal);
    }

    document.addEventListener('click', (e) => {
        const searchInput = document.getElementById('search-input');
        const resultsDiv = document.getElementById('search-results');
        
        if (searchInput && resultsDiv && !searchInput.contains(e.target) && !resultsDiv.contains(e.target)) {
            resultsDiv.classList.add('hidden');
        }
    });
}

// --- DASHBOARD & CHART LOGIC ---
function initChart() {
    const ctx = document.getElementById('calorieChart');
    if (!ctx) return;

    calorieChart = new Chart(ctx.getContext('2d'), {
        type: 'doughnut',
        data: {
            labels: ['Consumed', 'Remaining'],
            datasets: [{
                data: [0, userCalorieGoal],
                backgroundColor: ['rgba(16, 185, 129, 0.8)', 'rgba(30, 41, 59, 0.5)'],
                borderWidth: 0,
                hoverOffset: 10
            }]
        },
        options: {
            cutout: '75%',
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return context.label + ': ' + context.parsed + ' kcal';
                        }
                    }
                }
            }
        }
    });
}

async function updateDashboard() {
    const token = localStorage.getItem('token');
    showLoading(true);

    try {
        const response = await fetch(`${API_BASE}/meals/daily-stats`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (response.status === 401) {
            logout();
            return;
        }

        if (!response.ok) {
            throw new Error('Failed to fetch stats');
        }

        const data = await response.json();
        const consumed = data.totalConsumed || 0;
        const goal = userCalorieGoal;
        const remaining = Math.max(0, goal - consumed);
        const percentage = Math.min(100, Math.round((consumed / goal) * 100));

        const elements = {
            'calories-consumed': consumed,
            'consumed-val': consumed,
            'daily-progress': percentage + '%',
            'calories-left': remaining
        };

        //new fetch for mealshowing in dashboard
        fetchRecentMeals();

        Object.entries(elements).forEach(([id, value]) => {
            const element = document.getElementById(id);
            if (element) element.innerText = value;
        });

        const goalDisplays = document.querySelectorAll('.goal-value');
        goalDisplays.forEach(el => {
            el.innerText = goal;
        });

        const progressBar = document.getElementById('progress-bar');
        if (progressBar) {
            progressBar.style.width = percentage + '%';
        }

        if (calorieChart) {
            calorieChart.data.datasets[0].data = [consumed, remaining];
            calorieChart.update();
        }

    } catch (err) {
        console.error("Dashboard update failed:", err);
        showToast('Failed to load dashboard data', 'error');
    } finally {
        showLoading(false);
    }
}

// --- RATE LIMITED FOOD SEARCH WITH CACHING ---
async function handleSearch(e) {
    const query = e.target.value.trim();
    const resultsDiv = document.getElementById('search-results');
    
    if (query.length < 2) {
        resultsDiv.innerHTML = '';
        resultsDiv.classList.add('hidden');
        searchCache.clear(); // Clear cache when search is cleared
        return;
    }
    
    // CHECK CACHE FIRST
    if (searchCache.has(query.toLowerCase())) {
        console.log('Using cached results for:', query);
        displayResults(searchCache.get(query.toLowerCase()), resultsDiv);
        return;
    }
    
    // RATE LIMIT CHECK - Wait at least 1 second between searches
    const now = Date.now();
    const timeSinceLastSearch = now - lastSearchTime;
    
    if (timeSinceLastSearch < MIN_SEARCH_INTERVAL) {
        const waitTime = MIN_SEARCH_INTERVAL - timeSinceLastSearch;
        resultsDiv.innerHTML = `
            <div class="p-4 text-center text-yellow-400">
                <i class="fas fa-clock mr-2"></i>Please wait ${Math.ceil(waitTime / 1000)} second(s)...
            </div>
        `;
        resultsDiv.classList.remove('hidden');
        return;
    }
    
    lastSearchTime = now;
    
    const token = localStorage.getItem('token');
    
    resultsDiv.innerHTML = `
        <div class="p-4 text-center text-gray-400">
            <i class="fas fa-spinner fa-spin mr-2"></i>Searching...
        </div>
    `;
    resultsDiv.classList.remove('hidden');

    try {
        console.log('API Search for:', query);
        
        const response = await fetch(`${API_BASE}/food/search?query=${encodeURIComponent(query)}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        console.log('Response status:', response.status);

        if (response.status === 429) {
            // RATE LIMIT ERROR
            resultsDiv.innerHTML = `
                <div class="p-4 text-center text-red-400">
                    <i class="fas fa-exclamation-triangle text-2xl mb-2"></i>
                    <p class="font-bold">Too Many Requests</p>
                    <p class="text-sm mt-2">Edamam free tier limit: 10 requests/minute</p>
                    <p class="text-xs mt-2 text-gray-400">Please wait 1 minute, then try again</p>
                    <p class="text-xs mt-1 text-emerald-400">Tip: Type slower to reduce API calls</p>
                </div>
            `;
            resultsDiv.classList.remove('hidden');
            return;
        }

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Search failed');
        }

        const results = await response.json();
        console.log('Results:', results.length, 'items');
        
        // CACHE THE RESULTS
        searchCache.set(query.toLowerCase(), results);
        
        displayResults(results, resultsDiv);

    } catch (err) {
        console.error("Search failed:", err);
        
        if (err.message.includes('429') || err.message.includes('Too many')) {
            resultsDiv.innerHTML = `
                <div class="p-4 text-center text-red-400">
                    <i class="fas fa-exclamation-triangle text-2xl mb-2"></i>
                    <p class="font-bold">Rate Limit Exceeded</p>
                    <p class="text-sm mt-2">Please wait 60 seconds</p>
                    <p class="text-xs mt-2 text-gray-400">Free tier: 10 searches per minute</p>
                </div>
            `;
        } else {
            resultsDiv.innerHTML = `
                <div class="p-4 text-center text-red-400">
                    <i class="fas fa-exclamation-triangle mb-2"></i>
                    <p class="font-semibold">${escapeHtml(err.message)}</p>
                    <p class="text-xs mt-2">Check: Backend running? API keys in .env?</p>
                </div>
            `;
        }
        resultsDiv.classList.remove('hidden');
    }
}

function displayResults(results, resultsDiv) {
    resultsDiv.innerHTML = '';
    
    if (results.length === 0) {
        resultsDiv.innerHTML = `
            <div class="p-4 text-center text-gray-400">
                <i class="fas fa-search mb-2"></i>
                <p>No results found</p>
                <p class="text-xs mt-1">Try a different search term</p>
            </div>
        `;
        resultsDiv.classList.remove('hidden');
        return;
    }

    resultsDiv.classList.remove('hidden');

    results.forEach(item => {
        const div = document.createElement('div');
        div.className = "p-4 hover:bg-slate-700/50 cursor-pointer border-b border-slate-700 last:border-b-0 transition";
    
        div.innerHTML = `
            <div class="flex justify-between items-center">
                <div class="flex-1">
                    <div class="font-semibold text-white">${escapeHtml(item.label)}</div>
                    <div class="text-xs text-gray-400 mt-1">
                        <span class="mr-3"><i class="fas fa-tag mr-1"></i>${escapeHtml(item.brand)}</span>
                        ${item.protein ? `<span class="mr-3">P: ${item.protein}g</span>` : ''}
                        ${item.carbs ? `<span class="mr-3">C: ${item.carbs}g</span>` : ''}
                        ${item.fat ? `<span>F: ${item.fat}g</span>` : ''}
                    </div>
                </div>
                <div class="text-right ml-4">
                    <span class="text-emerald-400 font-bold text-lg">${item.calories}</span>
                    <span class="text-gray-400 text-sm ml-1">kcal</span>
                </div>
            </div>
        `;
    
        div.onclick = () => selectFood(item, resultsDiv);
        resultsDiv.appendChild(div);
    });
}

function selectFood(item, resultsDiv) {
    selectedFood = item;
    
    document.getElementById('selected-food-name').innerText = item.label;
    document.getElementById('selected-food-calories').innerText = `${item.calories}`;
    
    const brandElement = document.getElementById('selected-food-brand');
    if (brandElement) {
        brandElement.innerText = item.brand;
    }
    
    resultsDiv.classList.add('hidden');
    
    const searchInput = document.getElementById('search-input');
    if (searchInput) searchInput.value = '';
    
    showToast(`Selected: ${item.label}`, 'success');
}

async function saveMeal() {
    const foodName = document.getElementById('selected-food-name').innerText;
    const caloriesText = document.getElementById('selected-food-calories').innerText;
    const calories = parseInt(caloriesText);
    const mealType = document.getElementById('food-type-select').value;
    const token = localStorage.getItem('token');

    if (foodName === "Nothing selected" || isNaN(calories)) {
        showToast("Please search and select a food item first", 'error');
        return;
    }

    if (!mealType) {
        showToast("Please select a meal type", 'error');
        return;
    }

    showLoading(true);

    try {
        const response = await fetch(`${API_BASE}/meals/add`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ 
                food_type: mealType, 
                food_name: foodName, 
                calories: calories 
            })
        });

        const data = await response.json();

        if (response.ok) {
            showToast("Meal added successfully! 🎉", 'success');
            
            selectedFood = null;
            document.getElementById('selected-food-name').innerText = "Nothing selected";
            document.getElementById('selected-food-calories').innerText = "0";
            
            const brandElement = document.getElementById('selected-food-brand');
            if (brandElement) brandElement.innerText = '';
            
            document.getElementById('food-type-select').value = "";
            
            await updateDashboard();
            await fetchRecentMeals();
        } else {
            throw new Error(data.error || 'Failed to save meal');
        }
    } catch (err) {
        console.error("Save failed:", err);
        showToast(err.message || "Failed to save meal", 'error');
    } finally {
        showLoading(false);
    }
}

// --- AI FEATURES ---
async function fetchAIDietPlan() {
    const output = document.getElementById('ai-plan-output');
    if (!output) return;
    
    output.innerText = "✨ AI is analyzing your profile and history...";
    
    const token = localStorage.getItem('token');
    try {
        const response = await fetch(`${API_BASE}/ai/get-diet-plan`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (!response.ok) throw new Error('Failed to fetch plan');
        
        const data = await response.json();
        output.innerText = data.plan;
    } catch (err) {
        output.innerText = "Error fetching plan.";
        console.error('AI Diet Plan error:', err);
    }
}

async function getMyWorkout() {
    const output = document.getElementById('ai-plan-output');
    if (!output) return;
    
    output.innerText = "🏋️ Fetching your night workout plan...";
    
    const token = localStorage.getItem('token');
    try {
        const response = await fetch(`${API_BASE}/ai/get-workout-plan`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        const data = await response.json();
        
        if (response.ok) {
            output.innerText = data.workout;
        } else {
            showToast(data.message || 'Workout not available', 'error');
        }
    } catch (err) {
        console.error("Workout fetch error:", err);
        showToast('Failed to fetch workout plan', 'error');
    }
}

// --- UTILITIES ---
function checkWorkoutAccess() {
    const hour = new Date().getHours();
    const btn = document.getElementById('fetch-workout-btn');
    const msg = document.getElementById('lock-status-msg');

    if (hour >= 22 || hour < 5) {
        if (btn) {
            btn.disabled = false;
            btn.classList.remove('cursor-not-allowed', 'opacity-30');
        }
        if (msg) msg.innerHTML = "✅ Night Access Unlocked";
    } else {
        if (btn) {
            btn.disabled = true;
            btn.classList.add('cursor-not-allowed', 'opacity-30');
        }
        if (msg) msg.innerHTML = "🔒 Unlocks at 10 PM";
    }
}

async function requestMonthlyReport() {
    const btn = document.getElementById('report-btn');
    if (!btn) return;
    
    const token = localStorage.getItem('token');
    
    btn.innerText = "Sending PDF...";
    btn.disabled = true;

    try {
        const response = await fetch(`${API_BASE}/reports/send`, {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        const data = await response.json();
        
        if (response.ok) {
            showToast(data.message || 'Report sent successfully!', 'success');
        } else {
            throw new Error(data.error || 'Failed to send report');
        }
    } catch (err) {
        console.error('Report error:', err);
        showToast(err.message || "Failed to send report", 'error');
    } finally {
        btn.innerText = "Monthly Report";
        btn.disabled = false;
    }
}

function changeQty(amount) {
    const qtyInput = document.getElementById('food-quantity');
    if (!qtyInput) return;
    
    let currentQty = parseInt(qtyInput.value) || 1;
    currentQty += amount;
    if (currentQty < 1) currentQty = 1;
    qtyInput.value = currentQty;
}

function debounce(func, timeout = 300) {
    let timer;
    return (...args) => {
        clearTimeout(timer);
        timer = setTimeout(() => func.apply(this, args), timeout);
    };
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function showLoading(show) {
    const overlay = document.getElementById('loading-overlay');
    if (overlay) overlay.classList.toggle('hidden', !show);
}

function showToast(message, type = 'info') {
    const existing = document.querySelectorAll('.toast-notification');
    existing.forEach(el => el.remove());

    const toast = document.createElement('div');
    toast.className = 'toast-notification fixed top-4 right-4 z-50 p-4 rounded-xl shadow-2xl max-w-md';

    const colors = {
        success: 'bg-emerald-500 text-white',
        error: 'bg-red-500 text-white',
        info: 'bg-blue-500 text-white'
    };

    const icons = {
        success: 'fa-check-circle',
        error: 'fa-exclamation-circle',
        info: 'fa-info-circle'
    };

    toast.className += ' ' + colors[type];
    toast.innerHTML = `
        <div class="flex items-center gap-3">
            <i class="fas ${icons[type]} text-xl"></i>
            <span class="flex-1">${escapeHtml(message)}</span>
            <button onclick="this.parentElement.parentElement.remove()" class="text-white/70 hover:text-white">
                <i class="fas fa-times"></i>
            </button>
        </div>
    `;

    document.body.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(100%)';
        setTimeout(() => toast.remove(), 300);
    }, 5000);
}

function logout() {
    if (confirm('Are you sure you want to logout?')) {
        localStorage.removeItem('token');
        localStorage.removeItem('userName');
        localStorage.removeItem('userEmail');
        searchCache.clear(); // Clear search cache on logout
        window.location.href = 'login.html';
    }
}

// Add this at the very bottom of p1.js
async function fetchRecentMeals() {
    const token = localStorage.getItem('token');
    const tableBody = document.getElementById('meal-log-table');
    
    try {
        const response = await fetch(`${API_BASE}/meals/today`, {
            headers: { 
                'Authorization': `Bearer ${token}` // THIS LINE IS CRITICAL
            }
        });
        
        if (!response.ok) throw new Error('Failed to fetch');
        
        const meals = await response.json();
        const tableBody = document.getElementById('meal-log-table');
        
        if (tableBody) {
            tableBody.innerHTML = meals.map(meal => `
                <tr class="border-b border-slate-700/50 text-sm">
                    <td class="py-3 text-emerald-400 font-bold uppercase text-[10px]">${meal.food_type}</td>
                    <td class="py-3">${meal.food_name}</td>
                    <td class="py-3 font-bold">${meal.calories} kcal</td>
                    <td class="py-3 text-gray-500">${new Date(meal.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</td>
                </tr>
            `).join('');
        }
    } catch (err) {
        console.error("Meal table error:", err);
    }
}
// --- TREND CHART & HEALTH GRADE LOGIC ---

function initTrendChart() {
    const ctx = document.getElementById('trendChart');
    if (!ctx) return; // Prevention if HTML isn't added yet

    // Create the Chart with a Cyberpunk/Neon style
    trendChartInstance = new Chart(ctx.getContext('2d'), {
        type: 'line',
        data: {
            labels: [],
            datasets: [{
                label: 'Calories',
                data: [],
                borderColor: '#10b981', // Emerald-500 (Neon Green)
                backgroundColor: (context) => {
                    const ctx = context.chart.ctx;
                    const gradient = ctx.createLinearGradient(0, 0, 0, 400);
                    gradient.addColorStop(0, 'rgba(16, 185, 129, 0.4)');
                    gradient.addColorStop(1, 'rgba(16, 185, 129, 0.0)');
                    return gradient;
                },
                borderWidth: 3,
                tension: 0.4, // Smooth curves
                fill: true,
                pointBackgroundColor: '#064e3b', // Dark green points
                pointBorderColor: '#34d399',     // Light green border
                pointRadius: 4,
                pointHoverRadius: 6
            }, {
                label: 'Goal Limit',
                data: [],
                borderColor: '#64748b', // Slate-500
                borderDash: [6, 6],     // Dashed line
                borderWidth: 2,
                pointRadius: 0,
                fill: false,
                tension: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                mode: 'index',
                intersect: false,
            },
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: 'rgba(15, 23, 42, 0.9)', // Slate-900
                    titleColor: '#e2e8f0',
                    bodyColor: '#34d399',
                    borderColor: '#334155',
                    borderWidth: 1,
                    padding: 10,
                    displayColors: false,
                    callbacks: {
                        label: function(context) {
                            return context.parsed.y + ' kcal';
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: { color: '#334155', drawBorder: false }, // Slate-700
                    ticks: { color: '#94a3b8', font: { size: 10 } }
                },
                x: {
                    grid: { display: false },
                    ticks: { color: '#94a3b8', font: { size: 10 }, maxTicksLimit: 7 }
                }
            }
        }
    });

    // Load the data immediately
    fetchTrendData();
}

async function fetchTrendData() {
    const token = localStorage.getItem('token');
    try {
        // Ensure this route exists in your backend!
        const response = await fetch(`${API_BASE}/meals/monthly-stats`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (!response.ok) return; // Fail silently if endpoint isn't ready
        
        const history = await response.json();
        
        // 1. Update the Chart
        renderTrendChart(history);
        
        // 2. Calculate the Student Grade
        calculateHealthGrade(history);
        
    } catch (err) {
        console.error("Trend error:", err);
    }
}

function renderTrendChart(history) {
    if (!trendChartInstance) return;

    // Format dates (e.g., "Feb 14")
    const labels = history.map(h => new Date(h.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }));
    const data = history.map(h => h.total);
    // Create a flat line for the goal
    const goalLine = history.map(() => userCalorieGoal); 

    trendChartInstance.data.labels = labels;
    trendChartInstance.data.datasets[0].data = data;
    trendChartInstance.data.datasets[1].data = goalLine;
    
    // Dynamic Color: If a point is WAY over goal, make that specific point red
    const pointColors = data.map(val => val > userCalorieGoal * 1.3 ? '#ef4444' : '#34d399');
    trendChartInstance.data.datasets[0].pointBorderColor = pointColors;
    
    trendChartInstance.update();
}

function calculateHealthGrade(history) {
    if (!history || history.length === 0) return;

    let goodDays = 0;
    let skippedDays = 0;
    
    history.forEach(day => {
        const cal = day.total;
        // Good = ±20% of goal
        if (cal >= userCalorieGoal * 0.8 && cal <= userCalorieGoal * 1.2) goodDays++;
        // Skipped = < 50% of goal
        if (cal < userCalorieGoal * 0.5) skippedDays++;
    });

    // Score Calculation: % of good days minus penalty for skipping
    let score = (goodDays / history.length) * 100;
    score -= (skippedDays * 5); // Heavy penalty for skipping meals!

    let grade = 'F';
    let colorClass = 'text-red-500';
    let msg = "Critical: You're skipping too many meals!";

    if (score >= 90) { grade = 'A+'; colorClass = 'text-emerald-400'; msg = "Perfect consistency! 🏆"; }
    else if (score >= 80) { grade = 'A'; colorClass = 'text-emerald-500'; msg = "Great job, keep it up!"; }
    else if (score >= 70) { grade = 'B'; colorClass = 'text-blue-400'; msg = "Good, but try to be more regular."; }
    else if (score >= 50) { grade = 'C'; colorClass = 'text-yellow-400'; msg = "Inconsistent. Don't starve & binge."; }
    else { grade = 'D'; colorClass = 'text-orange-500'; msg = "Warning: Your eating habits are erratic."; }

    // Update UI Elements
    const badge = document.getElementById('health-grade-badge');
    const feedback = document.getElementById('consistency-feedback');

    if (badge) {
        badge.innerText = grade;
        // Reset classes and add new ones
        badge.className = `text-4xl font-black bg-slate-800/80 backdrop-blur-md px-5 py-2 rounded-2xl border border-slate-700 shadow-inner transition-all duration-300 transform hover:scale-110 ${colorClass}`;
    }

    if (feedback) {
        feedback.innerText = msg;
        feedback.className = `text-center text-sm font-medium bg-slate-800/50 py-3 px-4 rounded-xl border border-slate-700/50 italic ${colorClass}`;
    }
}