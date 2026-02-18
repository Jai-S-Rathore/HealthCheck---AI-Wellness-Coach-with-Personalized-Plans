const API_URL = 'http://localhost:3000/api';

async function runTests() {
    console.log('\n🧪 Starting Health Tracker API Tests...\n');

    let token = null;
    const testEmail = `test${Date.now()}@example.com`;

    try {
        console.log('1️⃣  Testing Registration...');
        const regRes = await fetch(`${API_URL}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: 'Test User',
                email: testEmail,
                password: 'password123'
            })
        });
        
        console.log(regRes.ok ? '✅ Registration successful' : '❌ Registration failed');

        console.log('\n2️⃣  Testing Login...');
        const loginRes = await fetch(`${API_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: testEmail,
                password: 'password123'
            })
        });

        const loginData = await loginRes.json();
        token = loginData.token;
        console.log(loginRes.ok ? '✅ Login successful' : '❌ Login failed');

        if (!token) {
            console.log('\n❌ Cannot continue tests without token');
            return;
        }

        console.log('\n3️⃣  Testing Add Meal...');
        const mealRes = await fetch(`${API_URL}/meals/add`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                food_type: 'lunch',
                food_name: 'Paneer Tikka',
                calories: 450
            })
        });

        console.log(mealRes.ok ? '✅ Meal added successfully' : '❌ Meal add failed');

        console.log('\n4️⃣  Testing Daily Stats...');
        const statsRes = await fetch(`${API_URL}/meals/daily-stats`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        const statsData = await statsRes.json();
        console.log(statsRes.ok ? '✅ Daily stats retrieved' : '❌ Stats retrieval failed');
        if (statsRes.ok) console.log('   Total Calories:', statsData.totalConsumed);

        console.log('\n✅ All tests completed!\n');

    } catch (error) {
        console.log('\n❌ Test failed with error:', error.message);
    }
}

runTests();
