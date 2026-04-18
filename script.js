document.addEventListener('DOMContentLoaded', () => {
    // Selectors
    const navBtns = document.querySelectorAll('.nav-btn');
    const tabContents = document.querySelectorAll('.tab-content');
    
    const plannerForm = document.getElementById('planner-form');
    const handbookInput = document.getElementById('handbook');
    const promptInput = document.getElementById('prompt');
    const generateBtn = document.getElementById('generate-btn');
    const outputPanel = document.getElementById('output-panel');
    const inputPanel = document.getElementById('input-panel');
    const agentStatus = document.getElementById('agent-status');
    const resultsContent = document.getElementById('results-content');
    const scheduleContainer = document.getElementById('schedule-container');
    const rationaleText = document.getElementById('rationale-text');
    const resetBtn = document.getElementById('reset-btn');
    const acceptPlanBtn = document.getElementById('accept-plan-btn');

    const followupBtn = document.getElementById('followup-btn');
    const followupInput = document.getElementById('followup-input');
    const followupResponse = document.getElementById('followup-response');

    const searchThesesBtn = document.getElementById('search-theses-btn');
    const thesisQueryInput = document.getElementById('thesis-query');
    const thesisResults = document.getElementById('thesis-results');

    const searchJobsBtn = document.getElementById('search-jobs-btn');
    const jobQueryInput = document.getElementById('job-query');
    const jobResults = document.getElementById('job-results');

    const addHistoryBtn = document.getElementById('add-history-btn');
    const newCourseInput = document.getElementById('new-history-course');
    const historyList = document.getElementById('history-list');
    const gpaValue = document.getElementById('gpa-value');

    const dropZone = document.getElementById('drop-zone');
    const selectedFileName = document.getElementById('selected-file-name');
    const statusIcon = document.getElementById('status-icon');
    const statusTextDisplay = document.getElementById('status-text-display');

    let currentPlanData = ""; // Store for followup context

    // Tab Switching
    navBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const tabId = btn.getAttribute('data-tab');
            navBtns.forEach(b => b.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active'));
            btn.classList.add('active');
            const targetTab = document.getElementById(`${tabId}-tab`);
            if (targetTab) targetTab.classList.add('active');
            if(tabId === 'history') loadHistory();
        });
    });

    // File Upload Feedback
    dropZone?.addEventListener('click', () => handbookInput?.click());
    handbookInput?.addEventListener('change', () => {
        if (handbookInput.files.length > 0) {
            selectedFileName.textContent = `Selected: ${handbookInput.files[0].name}`;
            statusIcon.textContent = "✅";
            statusTextDisplay.textContent = "Handbook loaded!";
            dropZone.style.borderColor = "var(--primary)";
        }
    });

    // Planner Execution
    plannerForm?.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!handbookInput.files[0]) return alert("Please upload a handbook!");
        
        generateBtn.disabled = true;
        outputPanel.classList.remove('hidden');
        resultsContent.classList.add('hidden');
        agentStatus.classList.remove('hidden');

        const formData = new FormData();
        formData.append('prompt', promptInput.value);
        formData.append('handbook', handbookInput.files[0]);

        try {
            const resp = await fetch('/plan', { method: 'POST', body: formData });
            const data = await resp.json();
            
            agentStatus.classList.add('hidden');
            resultsContent.classList.remove('hidden');
            inputPanel.classList.add('hidden');
            outputPanel.classList.add('full-width');
            
            currentPlanData = JSON.stringify(data.schedule);
            scheduleContainer.innerHTML = '';
            (data.schedule || []).forEach(item => {
                const div = document.createElement('div');
                div.className = `schedule-card ${item.type || 'mandatory'}`;
                div.innerHTML = `
                    <h4 style="color: white; font-size: 1.1rem; margin-bottom: 5px; font-weight: 700;">${item.course}</h4>
                    <p style="color: var(--text-dim); font-size: 0.85rem;">${item.time_slot}</p>
                    <span style="font-size: 0.7rem; text-transform: uppercase; letter-spacing: 1px; color: ${item.type === 'mandatory' ? 'var(--primary)' : 'var(--elective)'}">${item.type}</span>
                `;
                scheduleContainer.appendChild(div);
            });
            rationaleText.innerHTML = data.rationale || "";
        } catch (e) {
            alert("Error generating plan.");
            resetAgentState();
        } finally {
            generateBtn.disabled = false;
        }
    });

    // Follow-up Logic
    followupBtn?.addEventListener('click', async () => {
        const question = followupInput.value.trim();
        if (!question) return;

        followupBtn.disabled = true;
        followupResponse.innerHTML = "<p style='color: var(--text-dim);'>AI is thinking...</p>";

        const fd = new FormData();
        fd.append('question', question);
        fd.append('current_plan', currentPlanData);

        try {
            const resp = await fetch('/plan/followup', { method: 'POST', body: fd });
            const data = await resp.json();
            followupResponse.innerHTML = data.answer || "No response.";
        } catch (e) {
            followupResponse.innerHTML = "Error connecting to AI.";
        } finally {
            followupBtn.disabled = false;
            followupInput.value = "";
        }
    });

    // History Logic
    async function loadHistory() {
        const resp = await fetch('/history');
        const data = await resp.json();
        historyList.innerHTML = '';
        let total = 0, count = 0;

        (data.completed_courses || []).forEach(item => {
            const li = document.createElement('li');
            li.className = 'history-item glass-panel';
            li.style = "display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; padding: 15px;";
            li.innerHTML = `
                <div style="flex: 2;"><strong style="color: white;">${item.course}</strong></div>
                <div style="display: flex; align-items: center; gap: 15px;">
                    <input type="number" class="grade-edit" data-course="${item.course}" value="${item.grade || ''}" 
                        step="0.1" min="1.0" max="5.0" placeholder="Note" 
                        style="width: 70px; background: rgba(0,0,0,0.5); border: 1px solid var(--glass-border); color: var(--primary); text-align: center; border-radius: 8px;">
                    <button class="btn-delete" data-course="${item.course}" style="background: rgba(255,68,68,0.1); border: 1px solid rgba(255,68,68,0.2); color: #ff4444; padding: 6px 12px; border-radius: 8px; cursor: pointer;">Delete</button>
                </div>
            `;
            historyList.appendChild(li);
            if (item.grade && parseFloat(item.grade) > 0) { total += parseFloat(item.grade); count++; }
        });
        gpaValue.textContent = count > 0 ? (total / count).toFixed(2) : "0.00";

        document.querySelectorAll('.grade-edit').forEach(inp => {
            inp.addEventListener('change', async () => {
                const fd = new FormData();
                fd.append('course', inp.getAttribute('data-course'));
                fd.append('grade', parseFloat(inp.value) || 0);
                await fetch('/history/update_grade', { method: 'POST', body: fd });
                loadHistory();
            });
        });

        document.querySelectorAll('.btn-delete').forEach(btn => {
            btn.addEventListener('click', async () => {
                const fd = new FormData();
                fd.append('course', btn.getAttribute('data-course'));
                await fetch('/history/delete', { method: 'POST', body: fd });
                loadHistory();
            });
        });
    }

    addHistoryBtn?.addEventListener('click', async () => {
        if (!newCourseInput.value.trim()) return;
        const fd = new FormData();
        fd.append('course', newCourseInput.value);
        fd.append('grade', 0.0);
        await fetch('/history/add', { method: 'POST', body: fd });
        newCourseInput.value = '';
        loadHistory();
    });

    acceptPlanBtn?.addEventListener('click', async () => {
        const cards = document.querySelectorAll('.schedule-card h4');
        for (let h4 of cards) {
            const fd = new FormData();
            fd.append('course', h4.textContent);
            fd.append('grade', 0.0);
            await fetch('/history/add', { method: 'POST', body: fd });
        }
        alert("Plan saved! Check History tab to add grades.");
        loadHistory();
    });

    // Opportunities Search
    const handleSearch = async (btn, input, results, url) => {
        const query = input.value.trim();
        btn.disabled = true; btn.textContent = "Searching...";
        results.innerHTML = '<p style="text-align: center; color: var(--text-dim);">Scanning live TUM data...</p>';
        try {
            const resp = await fetch(`${url}?query=${encodeURIComponent(query)}`);
            const data = await resp.json();
            results.innerHTML = data.recommendations || "No matches.";
        } catch (e) { results.innerHTML = "<p>Error.</p>"; }
        finally { btn.disabled = false; btn.textContent = btn.id.includes('theses') ? "Find Thesis Topics" : "Search HiWi Opportunities"; }
    };

    searchThesesBtn?.addEventListener('click', () => handleSearch(searchThesesBtn, thesisQueryInput, thesisResults, '/theses'));
    searchJobsBtn?.addEventListener('click', () => handleSearch(searchJobsBtn, jobQueryInput, jobResults, '/jobs'));

    function resetAgentState() {
        outputPanel.classList.add('hidden');
        inputPanel.classList.remove('hidden');
        outputPanel.classList.remove('full-width');
    }
    resetBtn?.addEventListener('click', resetAgentState);
});
