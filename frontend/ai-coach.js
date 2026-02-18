

const API_BASE = 'http://localhost:3000/api';

document.addEventListener('DOMContentLoaded', () => {
    // 1. Check Login
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = 'login.html';
        return;
    }

    // 2. Display User Name
    const userName = localStorage.getItem('userName') || 'User';
    const nameDisplay = document.getElementById('user-name');
    if (nameDisplay) nameDisplay.innerText = userName;
});

// --- GOAL SELECTION UI ---
function selectGoal(goal, btn) {
    // 1. Reset all buttons to default style
    document.querySelectorAll('.goal-btn').forEach(b => {
        b.classList.remove('ring-2', 'ring-emerald-500', 'bg-slate-700');
        b.classList.add('bg-slate-800');
    });

    // 2. Highlight the clicked button
    if (btn) {
        btn.classList.remove('bg-slate-800');
        btn.classList.add('bg-slate-700', 'ring-2', 'ring-emerald-500');
    }

    // 3. Store the value in the hidden input
    const hiddenInput = document.getElementById('selected-goal');
    if (hiddenInput) hiddenInput.value = goal;

    // 4. Show "Target Weight" inputs ONLY for Loss/Gain
    const details = document.getElementById('goal-details-section');
    if (details) {
        if (goal === 'loss' || goal === 'gain') {
            details.classList.remove('hidden');
        } else {
            details.classList.add('hidden');
        }
    }
}

// --- GENERATE PLAN FUNCTION ---
async function generateCustomPlan() {
    console.log("👆 Button Clicked! Starting generation...");

    const goalInput = document.getElementById('selected-goal');
    const targetInput = document.getElementById('target-weight');
    const timelineInput = document.getElementById('timeline');
    const resultDiv = document.getElementById('ai-plan-result');
    const contentDiv = document.getElementById('ai-content');

    const goal = goalInput ? goalInput.value : null;
    const targetWeight = targetInput ? targetInput.value : null;
    const timeline = timelineInput ? timelineInput.value : null;

    if (!goal) {
        alert("Please select a goal first!"); 
        return;
    }

    // 1. Show Loading Animation
    if (resultDiv) resultDiv.classList.remove('hidden');
    if (contentDiv) {
        contentDiv.innerHTML = `
            <div class="flex flex-col items-center justify-center py-12 text-emerald-400">
                <i class="fas fa-circle-notch fa-spin text-4xl mb-4"></i>
                <p class="font-bold">Contacting AI Coach...</p>
                <p class="text-xs text-slate-500 mt-2">Analyzing your last 30 days of meals...</p>
            </div>
        `;
    }

    try {
        const token = localStorage.getItem('token');
        
        // 2. Call the Backend
        const response = await fetch(`${API_BASE}/ai/generate-custom-plan`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ 
                goal: goal, 
                targetWeight: targetWeight, 
                timeline: timeline 
            })
        });

        const data = await response.json();
        
        // 3. Display Result
        if (response.ok) {
            let formatted = data.plan
                .replace(/## (.*)/g, '<h3 class="text-xl font-bold text-white mt-6 mb-2 border-b border-slate-800 pb-2">$1</h3>')
                .replace(/\*\*(.*?)\*\*/g, '<strong class="text-emerald-400">$1</strong>')
                .replace(/- (.*)/g, '<li class="ml-4 text-slate-300 mb-1">$1</li>');
                
            if (contentDiv) contentDiv.innerHTML = formatted;
        } else {
            console.error("Backend Error:", data);
            if (contentDiv) contentDiv.innerHTML = `<div class="text-red-400 p-4 border border-red-500/20 rounded-xl">Error: ${data.error}</div>`;
        }

    } catch (err) {
        console.error("Fetch Error:", err);
        if (contentDiv) contentDiv.innerHTML = `<div class="text-red-400">Failed to connect to server. Is it running?</div>`;
    }
}

function downloadPlanPDF() {
    const element = document.getElementById('pdf-content');
    const userName = localStorage.getItem('userName') || 'User';
    
    // PDF Configuration
    const opt = {
        margin:       10,
        filename:     `${userName}_Diet_Plan.pdf`,
        image:        { type: 'jpeg', quality: 0.98 },
        html2canvas:  { 
            scale: 2, 
            backgroundColor: '#020617', // Matches slate-950
            useCORS: true 
        },
        jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    // New logic: Temporary style adjustment for PDF clarity
    const originalColor = element.style.color;
    element.style.color = '#ffffff'; // Ensure text is bright white in PDF

    html2pdf().set(opt).from(element).save().then(() => {
        element.style.color = originalColor; // Restore original look
    });
}