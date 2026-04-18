document.addEventListener('DOMContentLoaded', () => {
    const homeScreen = document.getElementById('home-screen');
    const homeTrigger = document.getElementById('home-trigger');
    const homeNavBtn = document.getElementById('home-nav-btn');
    const featureLaunchBtns = document.querySelectorAll('.feature-launch');
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
    const resetPlannerSessionBtn = document.getElementById('reset-planner-session-btn');
    const acceptPlanBtn = document.getElementById('accept-plan-btn');
    const followupBtn = document.getElementById('followup-btn');
    const followupInput = document.getElementById('followup-input');
    const followupResponse = document.getElementById('followup-response');
    const dropZone = document.getElementById('drop-zone');
    const selectedFileName = document.getElementById('selected-file-name');
    const statusIcon = document.getElementById('status-icon');
    const statusTextDisplay = document.getElementById('status-text-display');
    const plannerSessionCard = document.getElementById('planner-session-card');
    const plannerMemoryBanner = document.getElementById('planner-memory-banner');
    const plannerChatHistory = document.getElementById('planner-chat-history');

    const searchThesesBtn = document.getElementById('search-theses-btn');
    const thesisQueryInput = document.getElementById('thesis-query');
    const thesisResults = document.getElementById('thesis-results');
    const searchJobsBtn = document.getElementById('search-jobs-btn');
    const jobQueryInput = document.getElementById('job-query');
    const jobResults = document.getElementById('job-results');

    const addHistoryBtn = document.getElementById('add-history-btn');
    const newCourseInput = document.getElementById('new-history-course');
    const newGradeInput = document.getElementById('new-history-grade');
    const newEctsInput = document.getElementById('new-history-ects');
    const newSemesterInput = document.getElementById('new-history-semester');
    const newCategoryInput = document.getElementById('new-history-category');
    const historyList = document.getElementById('history-list');
    const gpaValue = document.getElementById('gpa-value');

    const cvDropZone = document.getElementById('cv-drop-zone');
    const cvFileInput = document.getElementById('cv-file');
    const cvStatusIcon = document.getElementById('cv-status-icon');
    const cvStatusText = document.getElementById('cv-status-text');
    const cvSelectedFileName = document.getElementById('cv-selected-file-name');
    const uploadCvBtn = document.getElementById('upload-cv-btn');
    const deleteCvBtn = document.getElementById('delete-cv-btn');
    const cvFileCard = document.getElementById('cv-file-card');
    const cvProfileBadge = document.getElementById('cv-profile-badge');
    const cvProfileSummary = document.getElementById('cv-profile-summary');
    const cvQuestionInput = document.getElementById('cv-question');
    const academicNotesInput = document.getElementById('academic-notes');
    const cvHandbookFileInput = document.getElementById('cv-handbook-file');
    const cvTranscriptFileInput = document.getElementById('cv-transcript-file');
    const runCvAnalysisBtn = document.getElementById('run-cv-analysis-btn');
    const cvAnalysisStatus = document.getElementById('cv-analysis-status');
    const cvAnalysisResults = document.getElementById('cv-analysis-results');

    let currentPlanData = '';
    let currentCvProfile = null;
    let plannerSessionId = localStorage.getItem('academicaiPlannerSessionId') || `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    let plannerState = null;

    localStorage.setItem('academicaiPlannerSessionId', plannerSessionId);

    function escapeHtml(value = '') {
        return value
            .replaceAll('&', '&amp;')
            .replaceAll('<', '&lt;')
            .replaceAll('>', '&gt;')
            .replaceAll('"', '&quot;')
            .replaceAll("'", '&#39;');
    }

    function renderTagList(items = []) {
        if (!items.length) return '<span class="empty-copy">Not detected</span>';
        return items.map((item) => `<span class="pill">${escapeHtml(item)}</span>`).join('');
    }

    function updatePlannerUploadState() {
        if (handbookInput.files.length > 0) {
            selectedFileName.textContent = `Selected: ${handbookInput.files[0].name}`;
            statusIcon.textContent = '✅';
            statusTextDisplay.textContent = 'Handbook loaded!';
            dropZone.style.borderColor = 'var(--primary)';
        }
    }

    function renderPlannerChatHistory(conversation = []) {
        if (!conversation.length) {
            plannerChatHistory.innerHTML = '';
            plannerChatHistory.classList.add('hidden');
            return;
        }

        plannerChatHistory.classList.remove('hidden');
        plannerChatHistory.innerHTML = conversation
            .slice(-8)
            .map((turn) => `
                <div class="chat-bubble ${turn.role === 'assistant' ? 'assistant' : 'user'}">
                    <span class="chat-role">${escapeHtml(turn.role === 'assistant' ? 'AcademicAI' : 'You')}</span>
                    <p>${escapeHtml(turn.message || '')}</p>
                </div>
            `)
            .join('');
    }

    function renderPlannerState(state) {
        plannerState = state;
        if (!state) {
            plannerSessionCard.classList.add('hidden');
            plannerMemoryBanner.classList.add('hidden');
            renderPlannerChatHistory([]);
            return;
        }

        const handbookProfile = state.handbookProfile || {};
        const academicProfile = state.academicProfile || {};
        const hasHandbook = Boolean(state.hasHandbook);

        if (hasHandbook) {
            plannerSessionCard.classList.remove('hidden');
            plannerSessionCard.innerHTML = `
                <strong>${escapeHtml(state.handbookFileName || 'Handbook cached')}</strong>
                <span>${escapeHtml(handbookProfile.programName || academicProfile.programName || 'Program context remembered')}</span>
            `;
            plannerMemoryBanner.classList.remove('hidden');
            plannerMemoryBanner.innerHTML = `
                Session memory active: ${escapeHtml(handbookProfile.degreeType || academicProfile.degreeType || 'Program')} ${escapeHtml(handbookProfile.programName || academicProfile.programName || '')}
                ${academicProfile.conversationSummary ? `• ${escapeHtml(academicProfile.conversationSummary.slice(0, 180))}` : ''}
            `;
            statusIcon.textContent = '✅';
            statusTextDisplay.textContent = 'Handbook cached for this planner session';
            selectedFileName.textContent = state.handbookFileName ? `Cached: ${state.handbookFileName}` : selectedFileName.textContent;
            dropZone.style.borderColor = 'var(--primary)';
        } else {
            plannerSessionCard.classList.add('hidden');
            plannerMemoryBanner.classList.add('hidden');
        }

        renderPlannerChatHistory(state.conversation || []);
    }

    function renderPlanResult(data, appendFollowup = false) {
        agentStatus.classList.add('hidden');
        resultsContent.classList.remove('hidden');
        inputPanel.classList.add('hidden');
        outputPanel.classList.add('full-width');
        outputPanel.classList.remove('hidden');

        currentPlanData = JSON.stringify(data.schedule || []);
        scheduleContainer.innerHTML = '';
        (data.schedule || []).forEach((item) => {
            const div = document.createElement('div');
            div.className = `schedule-card ${item.type || 'mandatory'}`;
            div.innerHTML = `
                <h4>${escapeHtml(item.course || '')}</h4>
                <p>${escapeHtml(item.time_slot || '')}</p>
                <span>${escapeHtml(item.type || 'mandatory')}</span>
            `;
            scheduleContainer.appendChild(div);
        });
        rationaleText.innerHTML = data.rationale || data.answer || '';
        if (appendFollowup) {
            followupResponse.innerHTML = data.answer || data.rationale || '';
        }
        renderPlannerState(data.plannerState || plannerState);
    }

    async function loadPlannerSession() {
        try {
            const response = await fetch(`/planner/session?sessionId=${encodeURIComponent(plannerSessionId)}`);
            const data = await response.json();
            renderPlannerState(data);
            if (data.lastPlan?.schedule?.length || data.lastPlan?.rationale) {
                renderPlanResult({
                    schedule: data.lastPlan.schedule || [],
                    rationale: data.lastPlan.rationale || '',
                    plannerState: data,
                });
            }
        } catch (error) {
            renderPlannerState(null);
        }
    }

    function updateCvUploadState() {
        if (cvFileInput.files.length > 0) {
            cvSelectedFileName.textContent = `Selected: ${cvFileInput.files[0].name}`;
            cvStatusIcon.textContent = '✅';
            cvStatusText.textContent = 'CV ready to parse';
            cvDropZone.style.borderColor = 'var(--primary)';
        }
    }

    function setCvProfile(profile) {
        currentCvProfile = profile;

        if (!profile) {
            cvProfileBadge.textContent = 'No CV loaded';
            cvFileCard.classList.add('hidden');
            cvProfileSummary.className = 'cv-profile-summary empty-state';
            cvProfileSummary.innerHTML = 'Upload a CV to extract sections like education, projects, skills, and technologies.';
            return;
        }

        const structured = profile.structuredProfile || {};
        cvProfileBadge.textContent = 'CV parsed';
        cvFileCard.classList.remove('hidden');
        cvFileCard.innerHTML = `
            <strong>${escapeHtml(profile.fileName || 'Uploaded CV')}</strong>
            <span>${(profile.rawText || '').length} characters extracted</span>
        `;

        cvProfileSummary.className = 'cv-profile-summary';
        cvProfileSummary.innerHTML = `
            <div class="summary-block">
                <h4>${escapeHtml(structured.name || 'Unnamed candidate')}</h4>
                <p class="muted-copy">Education</p>
                <div class="pill-row">${renderTagList(structured.education || [])}</div>
            </div>
            <div class="summary-block">
                <p class="muted-copy">Projects</p>
                <div class="pill-row">${renderTagList(structured.projects || [])}</div>
            </div>
            <div class="summary-block">
                <p class="muted-copy">Skills</p>
                <div class="pill-row">${renderTagList([...(structured.skills || []), ...(structured.toolsAndTechnologies || [])].slice(0, 18))}</div>
            </div>
            <div class="summary-block">
                <p class="muted-copy">Languages & certifications</p>
                <div class="pill-row">${renderTagList([...(structured.languages || []), ...(structured.certifications || [])].slice(0, 12))}</div>
            </div>
        `;
    }

    function renderAcademicSignals(academicProfile = []) {
        if (!academicProfile.length) {
            return '<div class="empty-state inline-empty">Add some modules or academic notes to unlock skill-area inference.</div>';
        }

        return academicProfile
            .slice(0, 6)
            .map((signal) => `
                <div class="insight-card">
                    <div class="insight-head">
                        <strong>${escapeHtml(signal.area)}</strong>
                        <span class="status-chip ${signal.confidence}">${escapeHtml(signal.confidence)}</span>
                    </div>
                    <p>${escapeHtml((signal.evidence || []).map((entry) => entry.courseName).filter(Boolean).join(', ') || 'Document evidence')}</p>
                </div>
            `)
            .join('');
    }

    function renderComparisonItems(items = [], key = 'reason') {
        if (!items.length) {
            return '<div class="empty-state inline-empty">Nothing significant to show here yet.</div>';
        }

        return items
            .map((item) => `
                <div class="insight-card">
                    <div class="insight-head">
                        <strong>${escapeHtml(item.area || item.role || item.title || 'Insight')}</strong>
                        ${item.confidence ? `<span class="status-chip ${escapeHtml(item.confidence)}">${escapeHtml(item.confidence)}</span>` : ''}
                    </div>
                    <p>${escapeHtml(item[key] || item.why || item.detail || '')}</p>
                    ${item.suggestedKeywords?.length ? `<div class="pill-row">${renderTagList(item.suggestedKeywords)}</div>` : ''}
                </div>
            `)
            .join('');
    }

    function renderCvAnalysis(data) {
        const analysis = data.analysis || {};
        const comparison = data.comparison || {};

        cvAnalysisResults.className = 'cv-analysis-results';
        cvAnalysisResults.innerHTML = `
            <div class="analysis-html">${data.summaryHtml || ''}</div>
            <div class="analysis-grid">
                <div class="analysis-column">
                    <h4>Academic strength signals</h4>
                    ${renderAcademicSignals(data.academicProfile || [])}
                </div>
                <div class="analysis-column">
                    <h4>Already reflected in the CV</h4>
                    ${renderComparisonItems(comparison.alignedStrengths || [])}
                </div>
                <div class="analysis-column">
                    <h4>Missing or underrepresented</h4>
                    ${renderComparisonItems(comparison.missingHighlights || [])}
                </div>
                <div class="analysis-column">
                    <h4>Career directions</h4>
                    ${renderComparisonItems(comparison.careerDirections || [], 'why')}
                </div>
            </div>
            <div class="analysis-column full-span">
                <h4>Improvement ideas</h4>
                <div class="bullet-panel">
                    ${(analysis.improvementIdeas || []).map((idea) => `<div class="bullet-item">${escapeHtml(idea)}</div>`).join('') || '<div class="empty-state inline-empty">No improvement ideas returned.</div>'}
                </div>
            </div>
        `;
    }

    async function loadCvProfile() {
        try {
            const response = await fetch('/cv/profile');
            const data = await response.json();
            setCvProfile(data.cvProfile || null);
        } catch (error) {
            setCvProfile(null);
        }
    }

    async function loadHistory() {
        const response = await fetch('/history');
        const data = await response.json();
        historyList.innerHTML = '';

        let total = 0;
        let count = 0;

        (data.completed_courses || []).forEach((item) => {
            const li = document.createElement('li');
            li.className = 'history-item glass-panel';
            li.innerHTML = `
                <div class="history-grid">
                    <input type="text" class="history-edit" data-field="courseName" data-course="${escapeHtml(item.courseName)}" value="${escapeHtml(item.courseName || '')}">
                    <input type="number" class="history-edit" data-field="grade" data-course="${escapeHtml(item.courseName)}" value="${item.grade ?? ''}" step="0.1" min="1.0" max="5.0" placeholder="Grade">
                    <input type="number" class="history-edit" data-field="ects" data-course="${escapeHtml(item.courseName)}" value="${item.ects ?? ''}" step="0.5" min="0" placeholder="ECTS">
                    <input type="text" class="history-edit" data-field="semesterCompleted" data-course="${escapeHtml(item.courseName)}" value="${escapeHtml(item.semesterCompleted || '')}" placeholder="Semester">
                    <input type="text" class="history-edit" data-field="category" data-course="${escapeHtml(item.courseName)}" value="${escapeHtml(item.category || '')}" placeholder="Category">
                    <button class="btn-delete" data-course="${escapeHtml(item.courseName)}">Delete</button>
                </div>
            `;
            historyList.appendChild(li);

            if (item.grade && Number(item.grade) > 0) {
                total += Number(item.grade);
                count += 1;
            }
        });

        gpaValue.textContent = count > 0 ? (total / count).toFixed(2) : '0.00';

        document.querySelectorAll('.history-edit').forEach((input) => {
            input.addEventListener('change', async () => {
                const originalCourseName = input.getAttribute('data-course');
                const parent = input.closest('.history-grid');
                const fields = {};

                parent.querySelectorAll('.history-edit').forEach((field) => {
                    fields[field.getAttribute('data-field')] = field.value.trim();
                });

                const fd = new FormData();
                fd.append('originalCourseName', originalCourseName);
                fd.append('courseName', fields.courseName || originalCourseName);
                fd.append('grade', fields.grade);
                fd.append('ects', fields.ects);
                fd.append('semesterCompleted', fields.semesterCompleted);
                fd.append('category', fields.category);
                await fetch('/history/update', { method: 'POST', body: fd });
                loadHistory();
            });
        });

        document.querySelectorAll('.btn-delete').forEach((btn) => {
            btn.addEventListener('click', async () => {
                const fd = new FormData();
                fd.append('course', btn.getAttribute('data-course'));
                await fetch('/history/delete', { method: 'POST', body: fd });
                loadHistory();
            });
        });
    }

    function showHome() {
        homeScreen?.classList.add('active');
        tabContents.forEach((content) => content.classList.remove('active'));
        navBtns.forEach((button) => button.classList.remove('active'));
        homeNavBtn?.classList.add('active');
    }

    function openFeature(tabId) {
        if (!tabId) return;
        homeScreen?.classList.remove('active');
        navBtns.forEach((button) => button.classList.remove('active'));
        tabContents.forEach((content) => content.classList.remove('active'));
        document.querySelector(`.nav-btn[data-tab="${tabId}"]`)?.classList.add('active');
        document.getElementById(`${tabId}-tab`)?.classList.add('active');

        if (tabId === 'history') loadHistory();
        if (tabId === 'cv-intelligence') loadCvProfile();
    }

    navBtns.forEach((btn) => {
        const tabId = btn.getAttribute('data-tab');
        if (!tabId) return;
        btn.addEventListener('click', () => openFeature(tabId));
    });

    featureLaunchBtns.forEach((btn) => {
        btn.addEventListener('click', () => openFeature(btn.getAttribute('data-target-tab')));
    });

    homeNavBtn?.addEventListener('click', showHome);
    homeTrigger?.addEventListener('click', showHome);

    dropZone?.addEventListener('click', () => handbookInput?.click());
    handbookInput?.addEventListener('change', updatePlannerUploadState);

        plannerForm?.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!handbookInput.files[0] && !(plannerState && plannerState.hasHandbook)) {
            alert('Please upload a handbook to start the planner session.');
            return;
        }

        generateBtn.disabled = true;
        outputPanel.classList.remove('hidden');
        resultsContent.classList.add('hidden');
        agentStatus.classList.remove('hidden');

        const formData = new FormData();
        formData.append('prompt', promptInput.value);
        formData.append('sessionId', plannerSessionId);
        if (handbookInput.files[0]) {
            formData.append('handbook', handbookInput.files[0]);
        }

        try {
            const resp = await fetch('/plan', { method: 'POST', body: formData });
            const data = await resp.json();
            if (data.error) throw new Error(data.error);
            if (data.sessionId) {
                plannerSessionId = data.sessionId;
                localStorage.setItem('academicaiPlannerSessionId', plannerSessionId);
            }
            renderPlanResult(data);
        } catch (error) {
            alert(error.message || 'Error generating plan.');
            resetAgentState();
        } finally {
            generateBtn.disabled = false;
        }
    });

    followupBtn?.addEventListener('click', async () => {
        const question = followupInput.value.trim();
        if (!question) return;

        followupBtn.disabled = true;
        followupResponse.innerHTML = "<p class='muted-copy'>AI is thinking...</p>";

        const fd = new FormData();
        fd.append('question', question);
        fd.append('sessionId', plannerSessionId);

        try {
            const resp = await fetch('/plan/followup', { method: 'POST', body: fd });
            const data = await resp.json();
            if (data.error) throw new Error(data.error);
            renderPlanResult(data, true);
        } catch (error) {
            followupResponse.innerHTML = error.message || 'Error connecting to AI.';
        } finally {
            followupBtn.disabled = false;
            followupInput.value = '';
        }
    });

    addHistoryBtn?.addEventListener('click', async () => {
        const courseName = newCourseInput.value.trim();
        if (!courseName) return;

        const fd = new FormData();
        fd.append('course', courseName);
        fd.append('grade', newGradeInput.value);
        fd.append('ects', newEctsInput.value);
        fd.append('semesterCompleted', newSemesterInput.value);
        fd.append('category', newCategoryInput.value);

        await fetch('/history/add', { method: 'POST', body: fd });
        newCourseInput.value = '';
        newGradeInput.value = '';
        newEctsInput.value = '';
        newSemesterInput.value = '';
        newCategoryInput.value = '';
        loadHistory();
    });

    acceptPlanBtn?.addEventListener('click', async () => {
        const cards = document.querySelectorAll('.schedule-card h4');
        for (const heading of cards) {
            const fd = new FormData();
            fd.append('course', heading.textContent);
            await fetch('/history/add', { method: 'POST', body: fd });
        }
        const plannerFd = new FormData();
        plannerFd.append('sessionId', plannerSessionId);
        await fetch('/plan/accept', { method: 'POST', body: plannerFd });
        alert('Plan saved. You can enrich modules with grades and ECTS in Academic Profile.');
        loadHistory();
        loadPlannerSession();
    });

    resetPlannerSessionBtn?.addEventListener('click', async () => {
        plannerSessionId = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
        localStorage.setItem('academicaiPlannerSessionId', plannerSessionId);
        await fetch(`/planner/session?sessionId=${encodeURIComponent(plannerSessionId)}`, { method: 'DELETE' });
        promptInput.value = '';
        handbookInput.value = '';
        selectedFileName.textContent = '';
        followupResponse.innerHTML = '';
        currentPlanData = '';
        statusIcon.textContent = '📄';
        statusTextDisplay.textContent = 'Drop course handbook (PDF) or click to browse';
        dropZone.style.borderColor = 'var(--glass-border)';
        resetAgentState();
        loadPlannerSession();
    });

    cvDropZone?.addEventListener('click', () => cvFileInput?.click());
    cvFileInput?.addEventListener('change', updateCvUploadState);

    uploadCvBtn?.addEventListener('click', async () => {
        if (!cvFileInput.files[0]) {
            alert('Please choose a CV file first.');
            return;
        }

        uploadCvBtn.disabled = true;
        cvStatusText.textContent = 'Parsing CV...';
        cvStatusIcon.textContent = '⏳';

        const fd = new FormData();
        fd.append('cv', cvFileInput.files[0]);

        try {
            const response = await fetch('/cv/upload', { method: 'POST', body: fd });
            const data = await response.json();
            if (data.error) throw new Error(data.error);
            setCvProfile(data.cvProfile);
            cvStatusText.textContent = 'CV parsed and ready';
            cvStatusIcon.textContent = '✅';
        } catch (error) {
            cvStatusText.textContent = 'Parsing failed';
            cvStatusIcon.textContent = '⚠️';
            alert(error.message || 'Could not parse CV.');
        } finally {
            uploadCvBtn.disabled = false;
        }
    });

    deleteCvBtn?.addEventListener('click', async () => {
        await fetch('/cv/profile', { method: 'DELETE' });
        cvFileInput.value = '';
        cvSelectedFileName.textContent = '';
        cvStatusIcon.textContent = '📄';
        cvStatusText.textContent = 'Upload CV or résumé (PDF, TXT, DOCX)';
        cvDropZone.style.borderColor = 'var(--glass-border)';
        cvAnalysisResults.className = 'cv-analysis-results empty-state';
        cvAnalysisResults.innerHTML = 'Add your CV and coursework, then ask what strengths, gaps, and internship directions appear.';
        setCvProfile(null);
    });

    runCvAnalysisBtn?.addEventListener('click', async () => {
        cvAnalysisStatus.classList.remove('hidden');
        cvAnalysisResults.className = 'cv-analysis-results empty-state';
        cvAnalysisResults.textContent = 'Building your study-to-career comparison...';
        runCvAnalysisBtn.disabled = true;

        const fd = new FormData();
        fd.append('question', cvQuestionInput.value.trim() || 'Can you evaluate my CV based on my lectures?');
        fd.append('academicNotes', academicNotesInput.value.trim());
        if (cvHandbookFileInput.files[0]) fd.append('handbook', cvHandbookFileInput.files[0]);
        if (cvTranscriptFileInput.files[0]) fd.append('transcript', cvTranscriptFileInput.files[0]);

        try {
            const response = await fetch('/cv/intelligence', { method: 'POST', body: fd });
            const data = await response.json();
            if (data.error) throw new Error(data.error);
            renderCvAnalysis(data);
        } catch (error) {
            cvAnalysisResults.className = 'cv-analysis-results empty-state';
            cvAnalysisResults.textContent = error.message || 'Could not run CV Intelligence.';
        } finally {
            cvAnalysisStatus.classList.add('hidden');
            runCvAnalysisBtn.disabled = false;
        }
    });

    const handleSearch = async (btn, input, results, url) => {
        const query = input.value.trim();
        btn.disabled = true;
        btn.textContent = 'Searching...';
        results.innerHTML = '<p class="muted-copy centered-copy">Scanning live TUM data...</p>';

        try {
            const resp = await fetch(`${url}?query=${encodeURIComponent(query)}`);
            const data = await resp.json();
            results.innerHTML = data.recommendations || 'No matches.';
        } catch (error) {
            results.innerHTML = '<p>Error.</p>';
        } finally {
            btn.disabled = false;
            btn.textContent = btn.id.includes('theses') ? 'Find Thesis Topics' : 'Search HiWi Opportunities';
        }
    };

    searchThesesBtn?.addEventListener('click', () => handleSearch(searchThesesBtn, thesisQueryInput, thesisResults, '/theses'));
    searchJobsBtn?.addEventListener('click', () => handleSearch(searchJobsBtn, jobQueryInput, jobResults, '/jobs'));

    function resetAgentState() {
        outputPanel.classList.add('hidden');
        inputPanel.classList.remove('hidden');
        outputPanel.classList.remove('full-width');
    }

    resetBtn?.addEventListener('click', resetAgentState);

    loadHistory();
    loadCvProfile();
    loadPlannerSession();
    showHome();
});
