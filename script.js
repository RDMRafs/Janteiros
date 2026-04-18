document.addEventListener('DOMContentLoaded', () => {
    // Tab Switching Logic
    const navBtns = document.querySelectorAll('.nav-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    navBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const tabId = btn.getAttribute('data-tab');
            navBtns.forEach(b => b.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active'));
            btn.classList.add('active');
            document.getElementById(`${tabId}-tab`).classList.add('active');
            if(tabId === 'history') loadHistory();
        });
    });

    // Planner Logic
    const form = document.getElementById('planner-form');
    const generateBtn = document.getElementById('generate-btn');
    const outputPanel = document.getElementById('output-panel');
    const inputPanel = document.getElementById('input-panel');
    const agentStatus = document.getElementById('agent-status');
    const resultsContent = document.getElementById('results-content');
    const progressFill = document.querySelector('.progress-fill');
    const statusText = document.querySelector('.status-text');
    const scheduleContainer = document.getElementById('schedule-container');
    const rationaleText = document.getElementById('rationale-text');
    const alternativesList = document.getElementById('alternatives-list');
    const resetBtn = document.getElementById('reset-btn');
    const acceptPlanBtn = document.getElementById('accept-plan-btn');
    const followupBtn = document.getElementById('followup-btn');
    const followupPrompt = document.getElementById('followup-prompt');

    let currentSchedule = [];

    // File upload visual feedback
    const fileInput = document.getElementById('handbook');
    const uploadText = document.querySelector('.upload-text');
    const uploadIcon = document.querySelector('.upload-icon');

    fileInput.addEventListener('change', () => {
        if (fileInput.files.length > 0) {
            uploadText.textContent = fileInput.files[0].name;
            uploadIcon.textContent = '✅';
        }
    });

    // Load history on startup
    loadHistory();

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        startPlanning(document.getElementById('prompt').value);
    });

    followupBtn.addEventListener('click', () => {
        startPlanning(followupPrompt.value);
    });

    async function startPlanning(userPrompt) {
        if (!fileInput.files[0]) {
            alert("Please upload a handbook PDF first.");
            return;
        }

        generateBtn.disabled = true;
        generateBtn.classList.add('loading');
        followupBtn.disabled = true;
        
        outputPanel.classList.remove('hidden');
        resultsContent.classList.add('hidden');
        agentStatus.classList.remove('hidden');

        updateProgress(20, "Analyzing handbook PDF...");

        const formData = new FormData();
        formData.append('prompt', userPrompt);
        formData.append('handbook', fileInput.files[0]);

        try {
            updateProgress(50, "Fetching live TUM schedules & resolving conflicts...");
            const response = await fetch('http://localhost:8000/plan', {
                method: 'POST',
                body: formData
            });

            const data = await response.json();
            
            if (data.error) {
                alert("AI Error: " + data.error);
                resetAgentState();
                return;
            }

            updateProgress(100, "Finalizing plan...");
            setTimeout(() => renderOutput(data), 500);
        } catch (error) {
            console.error(error);
            alert("Error connecting to backend. Make sure it is running.");
            resetAgentState();
        }
    }

    function renderOutput(data) {
        agentStatus.classList.add('hidden');
        resultsContent.classList.remove('hidden');
        inputPanel.classList.add('hidden');
        outputPanel.classList.add('full-width');
        
        scheduleContainer.innerHTML = '';
        currentSchedule = data.schedule || [];
        
        currentSchedule.forEach(item => {
            const card = document.createElement('div');
            card.className = `schedule-card ${item.type || 'mandatory'}`;
            card.innerHTML = `
                <h4>${item.course}</h4>
                <p>${item.time_slot}</p>
                <span class="badge">${item.type || 'Course'}</span>
            `;
            scheduleContainer.appendChild(card);
        });

        rationaleText.innerHTML = data.rationale || "Plan generated successfully.";
        
        alternativesList.innerHTML = '';
        if (data.alternatives && data.alternatives.length > 0) {
            data.alternatives.forEach(alt => {
                const li = document.createElement('li');
                li.textContent = alt;
                alternativesList.appendChild(li);
            });
        } else {
            alternativesList.innerHTML = '<li>No alternatives provided.</li>';
        }

        generateBtn.classList.remove('loading');
        generateBtn.disabled = false;
        followupBtn.disabled = false;
        outputPanel.scrollIntoView({ behavior: 'smooth' });
    }

    function updateProgress(percent, text) {
        progressFill.style.width = `${percent}%`;
        statusText.textContent = text;
    }

    function resetAgentState() {
        outputPanel.classList.add('hidden');
        outputPanel.classList.remove('full-width');
        inputPanel.classList.remove('hidden');
        generateBtn.classList.remove('loading');
        generateBtn.disabled = false;
    }

    resetBtn.addEventListener('click', () => {
        form.reset();
        resetAgentState();
        uploadText.textContent = 'Upload Handbook PDF';
        uploadIcon.textContent = '📄';
    });

    acceptPlanBtn.addEventListener('click', async () => {
        if (currentSchedule.length === 0) return;

        acceptPlanBtn.disabled = true;
        acceptPlanBtn.textContent = "Saving to History...";
        
        try {
            for (const item of currentSchedule) {
                const fd = new FormData();
                fd.append('course', item.course);
                await fetch('http://localhost:8000/history/add', { method: 'POST', body: fd });
            }
            alert("Success! All modules from this plan have been saved to your Course History.");
            loadHistory(); // Refresh history list
            // Switch to history tab
            navBtns[2].click(); 
        } catch (e) {
            alert("Error saving history.");
        } finally {
            acceptPlanBtn.textContent = "Accept & Save to History";
            acceptPlanBtn.disabled = false;
        }
    });

    // THESIS FINDER LOGIC
    const searchThesesBtn = document.getElementById('search-theses-btn');
    const thesisQueryInput = document.getElementById('thesis-query');
    const thesisResults = document.getElementById('thesis-results');

    const searchJobsBtn = document.getElementById('search-jobs-btn');
    const jobQueryInput = document.getElementById('job-query');
    const jobResults = document.getElementById('job-results');

    searchJobsBtn.addEventListener('click', async () => {
        const query = jobQueryInput.value.trim();
        if (!query) return;
        searchJobsBtn.disabled = true;
        searchJobsBtn.textContent = "Searching HiWi Roles...";
        jobResults.innerHTML = '<p class="status-text">Scanning Department Research Boards...</p>';
        try {
            const response = await fetch(`http://localhost:8000/jobs?query=${encodeURIComponent(query)}`);
            const data = await response.json();
            jobResults.innerHTML = `<div class="thesis-recommendations glass-panel" style="margin-top:20px;">${data.recommendations}</div>`;
        } catch (e) {
            jobResults.innerHTML = '<p>Error fetching jobs.</p>';
        } finally {
            searchJobsBtn.disabled = false;
            searchJobsBtn.textContent = "Search HiWi Opportunities";
        }
    });

    searchThesesBtn.addEventListener('click', async () => {
        const query = thesisQueryInput.value.trim();
        if (!query) return;

        searchThesesBtn.disabled = true;
        searchThesesBtn.textContent = "Matching with AI...";
        thesisResults.innerHTML = '<p class="status-text">Searching TUM NAT API and analyzing relevance...</p>';

        try {
            const response = await fetch(`http://localhost:8000/theses?query=${encodeURIComponent(query)}`);
            const data = await response.json();
            thesisResults.innerHTML = `<div class="thesis-recommendations glass-panel" style="margin-top:20px;">${data.recommendations}</div>`;
        } catch (e) {
            thesisResults.innerHTML = '<p>Error fetching theses.</p>';
        } finally {
            searchThesesBtn.disabled = false;
            searchThesesBtn.textContent = "Search Available Theses";
        }
    });

    // HISTORY LOGIC
    const addHistoryBtn = document.getElementById('add-history-btn');
    const newCourseInput = document.getElementById('new-history-course');
    const historyList = document.getElementById('history-list');

    async function loadHistory() {
        try {
            const resp = await fetch('http://localhost:8000/history');
            const data = await resp.json();
            renderHistory(data.completed_courses || []);
        } catch (e) {
            console.error("Failed to load history");
        }
    }

    function renderHistory(courses) {
        historyList.innerHTML = '';
        if (courses.length === 0) {
            historyList.innerHTML = '<p style="padding: 20px; color: var(--text-dim);">No courses completed yet.</p>';
            return;
        }
        courses.forEach(c => {
            const li = document.createElement('li');
            li.className = 'history-item';
            li.innerHTML = `<span>${c}</span> <span class="badge completed">Completed</span>`;
            historyList.appendChild(li);
        });
    }

    addHistoryBtn.addEventListener('click', async () => {
        const course = newCourseInput.value.trim();
        if(!course) return;
        
        const fd = new FormData();
        fd.append('course', course);
        try {
            await fetch('http://localhost:8000/history/add', { method: 'POST', body: fd });
            newCourseInput.value = '';
            loadHistory();
        } catch (e) {
            alert("Error adding to history");
        }
    });
});
