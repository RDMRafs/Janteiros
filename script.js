document.addEventListener('DOMContentLoaded', () => {
    const ACTION_CENTER_STORAGE_KEY = 'academicaiActionCenterState';
    const FEATURE_STATE_STORAGE_KEY = 'academicaiFeatureOutputs';

    const homeScreen = document.getElementById('home-screen');
    const homeTrigger = document.getElementById('home-trigger');
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

    const actionSummaryGrid = document.getElementById('action-summary-grid');
    const actionEmptyState = document.getElementById('action-empty-state');
    const actionList = document.getElementById('action-list');
    const rouletteTrigger = document.getElementById('roulette-trigger');
    const rouletteModal = document.getElementById('roulette-modal');
    const rouletteBackdrop = document.getElementById('roulette-backdrop');
    const rouletteClose = document.getElementById('roulette-close');
    const rouletteWheel = document.getElementById('roulette-wheel');
    const rouletteStart = document.getElementById('roulette-start');
    const rouletteRetry = document.getElementById('roulette-retry');
    const rouletteResult = document.getElementById('roulette-result');

    let currentPlanData = '';
    let currentCvProfile = null;
    let plannerSessionId = localStorage.getItem('academicaiPlannerSessionId') || `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    let plannerState = null;
    let currentHistory = [];
    let actionDataRevision = 0;
    let dismissedActionRevision = {};
    let rouletteRotation = 0;
    let rouletteSpinning = false;

    const ROULETTE_SIZE = 320;
    const ROULETTE_CENTER = ROULETTE_SIZE / 2;
    const ROULETTE_RADIUS = 132;
    const SAFE_ARC_DEGREES = 18;
    const SAFE_HALF_ARC = SAFE_ARC_DEGREES / 2;

    const storedFeatureState = loadStoredJson(FEATURE_STATE_STORAGE_KEY) || {};
    let latestCvAnalysis = storedFeatureState.cvAnalysis || null;
    let latestThesisResults = storedFeatureState.theses || { query: '', items: [] };
    let latestJobResults = storedFeatureState.jobs || { query: '', items: [] };
    let actionStatusState = loadStoredJson(ACTION_CENTER_STORAGE_KEY) || {};
    Object.keys(actionStatusState).forEach((actionId) => {
        if (actionStatusState[actionId] === 'dismissed') {
            delete actionStatusState[actionId];
        }
    });
    saveStoredJson(ACTION_CENTER_STORAGE_KEY, actionStatusState);

    localStorage.setItem('academicaiPlannerSessionId', plannerSessionId);

    function loadStoredJson(key) {
        try {
            const raw = localStorage.getItem(key);
            return raw ? JSON.parse(raw) : null;
        } catch (error) {
            return null;
        }
    }

    function saveStoredJson(key, value) {
        localStorage.setItem(key, JSON.stringify(value));
    }

    function openRouletteModal() {
        rouletteModal?.classList.remove('hidden');
        rouletteModal?.classList.add('active');
        rouletteModal?.setAttribute('aria-hidden', 'false');
    }

    function closeRouletteModal() {
        rouletteModal?.classList.remove('active');
        rouletteModal?.classList.add('hidden');
        rouletteModal?.setAttribute('aria-hidden', 'true');
    }

    function resetRouletteMessage() {
        if (!rouletteResult) return;
        rouletteResult.textContent = 'Press start and let fate be emotionally corrected.';
        rouletteResult.classList.remove('roulette-win');
    }

    function resetRouletteWheelPosition(randomize = true) {
        if (!rouletteWheel || rouletteSpinning) return;
        if (randomize) {
            rouletteRotation = Math.random() * 360;
        }
        rouletteWheel.style.transition = 'none';
        rouletteWheel.style.transform = `rotate(${rouletteRotation}deg)`;
        window.requestAnimationFrame(() => {
            if (rouletteWheel) {
                rouletteWheel.style.transition = '';
            }
        });
        resetRouletteMessage();
    }

    function degreesToRadians(degrees) {
        return ((degrees - 90) * Math.PI) / 180;
    }

    function polarToCartesian(centerX, centerY, radius, angleDegrees) {
        const angleRadians = degreesToRadians(angleDegrees);
        return {
            x: centerX + radius * Math.cos(angleRadians),
            y: centerY + radius * Math.sin(angleRadians),
        };
    }

    function buildSlicePath(startAngle, endAngle, radius = ROULETTE_RADIUS) {
        const normalizedStart = ((startAngle % 360) + 360) % 360;
        let normalizedEnd = ((endAngle % 360) + 360) % 360;
        if (normalizedEnd <= normalizedStart) {
            normalizedEnd += 360;
        }

        const start = polarToCartesian(ROULETTE_CENTER, ROULETTE_CENTER, radius, normalizedStart);
        const end = polarToCartesian(ROULETTE_CENTER, ROULETTE_CENTER, radius, normalizedEnd);
        const largeArcFlag = normalizedEnd - normalizedStart > 180 ? 1 : 0;

        return [
            `M ${ROULETTE_CENTER} ${ROULETTE_CENTER}`,
            `L ${start.x} ${start.y}`,
            `A ${radius} ${radius} 0 ${largeArcFlag} 1 ${end.x} ${end.y}`,
            'Z',
        ].join(' ');
    }

    function createSvgNode(tagName, attributes = {}) {
        const node = document.createElementNS('http://www.w3.org/2000/svg', tagName);
        Object.entries(attributes).forEach(([key, value]) => {
            node.setAttribute(key, String(value));
        });
        return node;
    }

    function createRouletteLabel(text, angle, radius, className, rotationAngle = angle) {
        const point = polarToCartesian(ROULETTE_CENTER, ROULETTE_CENTER, radius, angle);
        const label = createSvgNode('text', {
            x: point.x,
            y: point.y,
            class: className,
            'text-anchor': 'middle',
            'dominant-baseline': 'middle',
            transform: `rotate(${rotationAngle}, ${point.x}, ${point.y})`,
        });
        label.textContent = text;
        return label;
    }

    function renderRouletteWheel() {
        if (!rouletteWheel) return;

        rouletteWheel.innerHTML = '';

        const outerRing = createSvgNode('circle', {
            cx: ROULETTE_CENTER,
            cy: ROULETTE_CENTER,
            r: 148,
            class: 'roulette-wheel-ring',
        });

        const dangerSlice = createSvgNode('path', {
            d: buildSlicePath(SAFE_HALF_ARC, 360 - SAFE_HALF_ARC),
            class: 'roulette-slice roulette-slice-danger',
        });

        const safeSlice = createSvgNode('path', {
            d: buildSlicePath(360 - SAFE_HALF_ARC, 360 + SAFE_HALF_ARC),
            class: 'roulette-slice roulette-slice-safe',
        });

        const dangerLabel = createRouletteLabel(
            'Exmatrikulieren',
            180,
            68,
            'roulette-svg-label roulette-svg-label-danger',
            0,
        );

        const safeLabel = createRouletteLabel(
            'Safe!',
            0,
            108,
            'roulette-svg-label roulette-svg-label-safe',
        );

        const centerCap = createSvgNode('circle', {
            cx: ROULETTE_CENTER,
            cy: ROULETTE_CENTER,
            r: 30,
            class: 'roulette-wheel-cap',
        });

        rouletteWheel.appendChild(outerRing);
        rouletteWheel.appendChild(dangerSlice);
        rouletteWheel.appendChild(safeSlice);
        rouletteWheel.appendChild(dangerLabel);
        rouletteWheel.appendChild(safeLabel);
        rouletteWheel.appendChild(centerCap);
    }

    function spinRoulette() {
        if (!rouletteWheel || !rouletteStart || !rouletteRetry || !rouletteResult || rouletteSpinning) return;

        rouletteSpinning = true;
        rouletteStart.disabled = true;
        rouletteRetry.disabled = true;
        resetRouletteMessage();
        rouletteResult.textContent = 'Spinning through statistically unnecessary despair...';

        const extraSpins = 6 + Math.floor(Math.random() * 3);
        const currentNormalized = ((rouletteRotation % 360) + 360) % 360;
        const targetNormalized = ((Math.random() * ((SAFE_HALF_ARC - 1) * 2)) - (SAFE_HALF_ARC - 1) + 360) % 360;
        let delta = extraSpins * 360 + targetNormalized - currentNormalized;
        if (delta < extraSpins * 360) {
            delta += 360;
        }
        rouletteRotation += delta;

        rouletteWheel.style.transition = 'transform 4.8s cubic-bezier(0.08, 0.82, 0.18, 1)';
        rouletteWheel.style.transform = `rotate(${rouletteRotation}deg)`;

        window.setTimeout(() => {
            rouletteSpinning = false;
            rouletteStart.disabled = false;
            rouletteRetry.disabled = false;
            rouletteResult.innerHTML = `
                <strong>You can survive this!</strong><br>
                <span>Against all odds. Statistically impossible. Emotionally necessary.</span>
            `;
            rouletteResult.classList.add('roulette-win');
        }, 4900);
    }

    function persistFeatureState() {
        saveStoredJson(FEATURE_STATE_STORAGE_KEY, {
            cvAnalysis: latestCvAnalysis,
            theses: latestThesisResults,
            jobs: latestJobResults,
        });
    }

    function bumpActionDataRevision() {
        actionDataRevision += 1;
        dismissedActionRevision = {};
    }

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
        bumpActionDataRevision();
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
        renderActionCenter();
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
            } else {
                renderActionCenter();
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
        bumpActionDataRevision();

        if (!profile) {
            cvProfileBadge.textContent = 'No CV loaded';
            cvFileCard.classList.add('hidden');
            cvProfileSummary.className = 'cv-profile-summary empty-state';
            cvProfileSummary.innerHTML = 'Upload a CV to extract sections like education, projects, skills, and technologies.';
            renderActionCenter();
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
        renderActionCenter();
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
        currentHistory = data.completed_courses || [];
        bumpActionDataRevision();
        historyList.innerHTML = '';

        let total = 0;
        let count = 0;

        currentHistory.forEach((item) => {
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
        renderActionCenter();

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
        if (tabId === 'action-center') renderActionCenter();
    }

    function priorityWeight(priority) {
        return { high: 3, medium: 2, low: 1 }[priority] || 0;
    }

    function makeActionId(parts = []) {
        return parts.map((part) => String(part || '').toLowerCase().replace(/[^a-z0-9]+/g, '-')).join('-');
    }

    function createAction(action) {
        const id = action.id || makeActionId([action.source, action.type, action.title]);
        return {
            id,
            type: action.type || 'navigation',
            title: action.title || 'Untitled action',
            description: action.description || '',
            priority: action.priority || 'medium',
            status: actionStatusState[id] || action.status || 'open',
            source: action.source || 'AcademicAI',
            relatedFeature: action.relatedFeature || '',
            cta: action.cta || 'Review',
            url: action.url || '',
            metadata: action.metadata || {},
            createdAt: action.createdAt || new Date().toISOString(),
        };
    }

    function generateAcademicActions(history = []) {
        const actions = [];
        if (!history.length) {
            actions.push(createAction({
                id: 'academic-profile-seed',
                type: 'academic',
                title: 'Add your completed modules to build a stronger profile',
                description: 'Your academic profile is still sparse. Adding completed lectures, ECTS, and grades unlocks better planner and career guidance.',
                priority: 'medium',
                source: 'Academic Profile',
                relatedFeature: 'history',
                cta: 'Open profile',
                metadata: { internalTab: 'history' },
            }));
            return actions;
        }

        const missingGrades = history.filter((item) => !item.grade || Number(item.grade) <= 0);
        if (missingGrades.length) {
            actions.push(createAction({
                id: 'academic-missing-grades',
                type: 'academic',
                title: 'Complete missing grade information',
                description: `${missingGrades.length} modules still have no grade saved. Filling them in improves profile strength signals and opportunity matching.`,
                priority: 'medium',
                source: 'Academic Profile',
                relatedFeature: 'history',
                cta: 'Update grades',
                metadata: { internalTab: 'history' },
            }));
        }

        const missingEcts = history.filter((item) => !item.ects);
        if (missingEcts.length >= 2) {
            actions.push(createAction({
                id: 'academic-missing-ects',
                type: 'handbook',
                title: 'Add ECTS values for your tracked modules',
                description: 'ECTS is missing for several courses, which makes next-semester planning and workload balancing less accurate.',
                priority: 'low',
                source: 'Academic Profile',
                relatedFeature: 'history',
                cta: 'Open profile',
                metadata: { internalTab: 'history' },
            }));
        }
        return actions;
    }

    function generatePlannerActions(state) {
        if (!state?.hasHandbook) {
            return [
                createAction({
                    id: 'planner-upload-handbook',
                    type: 'handbook',
                    title: 'Upload your handbook to activate semester planning',
                    description: 'The planner needs your handbook once so it can answer follow-up questions and recommend semester paths consistently.',
                    priority: 'high',
                    source: 'Semester Planner',
                    relatedFeature: 'planner',
                    cta: 'Open planner',
                    metadata: { internalTab: 'planner' },
                }),
            ];
        }

        const actions = [];
        const latestSchedule = state.lastPlan?.schedule || [];
        const selectedCourses = state.academicProfile?.selectedCourses || [];
        const mandatoryModules = state.handbookProfile?.mandatoryModules || [];
        const savedPlans = Object.keys(state.academicProfile?.semesterRecommendations || {});

        if (latestSchedule.length) {
            actions.push(createAction({
                id: 'planner-review-latest',
                type: 'study-plan',
                title: 'Review your latest semester recommendation',
                description: `${latestSchedule.length} courses are currently recommended. Confirm what to keep, replace, or save into your academic profile.`,
                priority: selectedCourses.length ? 'medium' : 'high',
                source: 'Semester Planner',
                relatedFeature: 'planner',
                cta: 'Review plan',
                metadata: { internalTab: 'planner' },
            }));
        }

        if (savedPlans.length) {
            actions.push(createAction({
                id: 'planner-saved-plans',
                type: 'academic',
                title: 'Check your saved semester plans before registration',
                description: `You already have ${savedPlans.length} saved semester plan${savedPlans.length > 1 ? 's' : ''}. Compare them with handbook requirements before finalizing modules.`,
                priority: 'medium',
                source: 'Semester Planner',
                relatedFeature: 'planner',
                cta: 'Open planner',
                metadata: { internalTab: 'planner' },
            }));
        }

        if (mandatoryModules.length) {
            actions.push(createAction({
                id: 'planner-review-mandatory',
                type: 'academic',
                title: 'Review handbook mandatory modules for your next semester',
                description: 'Your handbook cache includes mandatory module information. Use it to verify upcoming semester choices before registration.',
                priority: 'high',
                source: 'Handbook Analysis',
                relatedFeature: 'planner',
                cta: 'Open planner',
                metadata: { internalTab: 'planner' },
            }));
        }
        return actions;
    }

    function generateOpportunityActions(resultSet, sourceLabel, internalTab) {
        const items = resultSet?.items || [];
        const query = resultSet?.query || '';
        if (!items.length) return [];

        const actions = [];
        const topItem = items[0];
        actions.push(createAction({
            id: makeActionId([sourceLabel, 'top', topItem.title]),
            type: 'opportunity',
            title: `Strong ${sourceLabel.toLowerCase()} match: ${topItem.title}`,
            description: `Your recent topic query${query ? ` "${query}"` : ''} produced a strong match at ${topItem.chair || 'the relevant chair'}.`,
            priority: topItem.semanticScore > 0.45 ? 'high' : 'medium',
            source: sourceLabel,
            relatedFeature: internalTab,
            cta: topItem.url ? 'Open posting' : 'Review results',
            url: topItem.url || '',
            metadata: { internalTab },
        }));

        if (items.length > 1) {
            actions.push(createAction({
                id: makeActionId([sourceLabel, 'review', query || 'results']),
                type: 'application',
                title: `Review ${items.length} ranked ${sourceLabel.toLowerCase()} opportunities`,
                description: 'There are multiple relevant matches waiting. Compare requirements and shortlist the most promising ones.',
                priority: 'medium',
                source: sourceLabel,
                relatedFeature: internalTab,
                cta: 'See results',
                metadata: { internalTab },
            }));
        }
        return actions;
    }

    function generateCvActions(cvProfile, cvAnalysis) {
        if (!cvProfile) {
            return [
                createAction({
                    id: 'cv-upload-first',
                    type: 'cv-improvement',
                    title: 'Upload your CV to unlock application actions',
                    description: 'CV Intelligence can highlight missing evidence, skills, and career directions once a CV is uploaded.',
                    priority: 'medium',
                    source: 'CV Intelligence',
                    relatedFeature: 'cv-intelligence',
                    cta: 'Open CV Intelligence',
                    metadata: { internalTab: 'cv-intelligence' },
                }),
            ];
        }

        const actions = [];
        const missing = cvAnalysis?.comparison?.missingHighlights || [];
        const improvementIdeas = cvAnalysis?.analysis?.improvementIdeas || [];
        const careerDirections = cvAnalysis?.comparison?.careerDirections || [];

        if (missing.length) {
            const topGap = missing[0];
            actions.push(createAction({
                id: makeActionId(['cv-gap', topGap.area || topGap.title]),
                type: 'cv-improvement',
                title: `Address a CV gap: ${topGap.area || topGap.title}`,
                description: topGap.reason || topGap.detail || 'One of your study-backed strengths is underrepresented on the CV.',
                priority: 'high',
                source: 'CV Intelligence',
                relatedFeature: 'cv-intelligence',
                cta: 'Review CV suggestions',
                metadata: { internalTab: 'cv-intelligence' },
            }));
        }

        if (improvementIdeas.length) {
            actions.push(createAction({
                id: 'cv-improvement-ideas',
                type: 'cv-improvement',
                title: 'Turn coursework into stronger CV evidence',
                description: improvementIdeas[0],
                priority: 'medium',
                source: 'CV Intelligence',
                relatedFeature: 'cv-intelligence',
                cta: 'Open CV Intelligence',
                metadata: { internalTab: 'cv-intelligence' },
            }));
        }

        if (careerDirections.length) {
            actions.push(createAction({
                id: 'cv-career-direction',
                type: 'application',
                title: `Explore a fitting direction: ${careerDirections[0].role}`,
                description: careerDirections[0].why,
                priority: 'medium',
                source: 'CV Intelligence',
                relatedFeature: 'cv-intelligence',
                cta: 'See career fit',
                metadata: { internalTab: 'cv-intelligence' },
            }));
        }
        return actions;
    }

    function collectAllActions() {
        const generated = [
            ...generatePlannerActions(plannerState),
            ...generateAcademicActions(currentHistory),
            ...generateCvActions(currentCvProfile, latestCvAnalysis),
            ...generateOpportunityActions(latestThesisResults, 'Thesis Finder', 'theses'),
            ...generateOpportunityActions(latestJobResults, 'Research & HiWi', 'jobs'),
        ];

        return generated
            .map((action) => ({ ...action, status: actionStatusState[action.id] || action.status || 'open' }))
            .sort((left, right) => {
                const leftClosed = ['done', 'dismissed'].includes(left.status);
                const rightClosed = ['done', 'dismissed'].includes(right.status);
                if (leftClosed !== rightClosed) return leftClosed ? 1 : -1;
                return priorityWeight(right.priority) - priorityWeight(left.priority);
            });
    }

    function getActionStatusCounts(actions) {
        return {
            open: actions.filter((action) => action.status === 'open').length,
            high: actions.filter((action) => action.priority === 'high' && !['done', 'dismissed'].includes(action.status)).length,
            opportunities: actions.filter((action) => ['opportunity', 'application'].includes(action.type) && action.status !== 'dismissed').length,
            completed: actions.filter((action) => action.status === 'done').length,
        };
    }

    function setActionStatus(actionId, status) {
        if (status === 'dismissed') {
            delete actionStatusState[actionId];
            dismissedActionRevision[actionId] = actionDataRevision;
        } else {
            delete dismissedActionRevision[actionId];
            actionStatusState[actionId] = status;
        }
        saveStoredJson(ACTION_CENTER_STORAGE_KEY, actionStatusState);
        renderActionCenter();
    }

    function handleActionCta(action) {
        if (!action) return;
        if (action.url) {
            window.open(action.url, '_blank', 'noopener,noreferrer');
            return;
        }
        if (action.metadata?.internalTab) {
            openFeature(action.metadata.internalTab);
        }
    }

    // Thin action-generation layer: consume existing module outputs and map them into actionable dashboard items.
    function renderActionCenter() {
        if (!actionSummaryGrid || !actionList || !actionEmptyState) return;

        const actions = collectAllActions();
        const visibleActions = actions.filter(
            (action) => dismissedActionRevision[action.id] !== actionDataRevision
        );
        const counts = getActionStatusCounts(visibleActions);

        actionSummaryGrid.innerHTML = `
            <div class="glass-panel action-summary-card">
                <span>Open Actions</span>
                <strong>${counts.open}</strong>
            </div>
            <div class="glass-panel action-summary-card">
                <span>High Priority</span>
                <strong>${counts.high}</strong>
            </div>
            <div class="glass-panel action-summary-card">
                <span>Opportunities</span>
                <strong>${counts.opportunities}</strong>
            </div>
            <div class="glass-panel action-summary-card">
                <span>Completed</span>
                <strong>${counts.completed}</strong>
            </div>
        `;

        if (!visibleActions.length) {
            actionEmptyState.classList.remove('hidden');
            actionList.innerHTML = '';
            return;
        }

        actionEmptyState.classList.add('hidden');
        actionList.innerHTML = visibleActions
            .map((action) => `
                <article class="glass-panel action-card action-status-${escapeHtml(action.status)}">
                    <div class="action-card-top">
                        <div class="action-main-copy">
                            <div class="action-badges">
                                <span class="status-chip ${escapeHtml(action.priority)}">${escapeHtml(action.priority)}</span>
                                <span class="status-chip">${escapeHtml(action.source)}</span>
                                <span class="status-chip">${escapeHtml(action.status)}</span>
                            </div>
                            <h3>${escapeHtml(action.title)}</h3>
                            <p>${escapeHtml(action.description)}</p>
                        </div>
                        <button class="btn-primary inline-btn action-cta-btn" data-action-id="${escapeHtml(action.id)}">${escapeHtml(action.cta)}</button>
                    </div>
                    <div class="action-controls">
                        <button class="btn-secondary inline-btn action-status-btn" data-action-id="${escapeHtml(action.id)}" data-status="open">Open</button>
                        <button class="btn-secondary inline-btn action-status-btn" data-action-id="${escapeHtml(action.id)}" data-status="saved">Save</button>
                        <button class="btn-secondary inline-btn action-status-btn" data-action-id="${escapeHtml(action.id)}" data-status="done">Done</button>
                        <button class="btn-secondary inline-btn action-status-btn" data-action-id="${escapeHtml(action.id)}" data-status="dismissed">Dismiss</button>
                    </div>
                </article>
            `)
            .join('');

        const actionMap = new Map(visibleActions.map((action) => [action.id, action]));
        actionList.querySelectorAll('.action-status-btn').forEach((button) => {
            button.addEventListener('click', () => {
                setActionStatus(button.getAttribute('data-action-id'), button.getAttribute('data-status'));
            });
        });
        actionList.querySelectorAll('.action-cta-btn').forEach((button) => {
            button.addEventListener('click', () => {
                handleActionCta(actionMap.get(button.getAttribute('data-action-id')));
            });
        });
    }

    navBtns.forEach((btn) => {
        const tabId = btn.getAttribute('data-tab');
        if (!tabId) return;
        btn.addEventListener('click', () => openFeature(tabId));
    });

    featureLaunchBtns.forEach((btn) => {
        btn.addEventListener('click', () => openFeature(btn.getAttribute('data-target-tab')));
    });

    renderRouletteWheel();
    homeTrigger?.addEventListener('click', showHome);
    rouletteTrigger?.addEventListener('click', openRouletteModal);
    rouletteBackdrop?.addEventListener('click', closeRouletteModal);
    rouletteClose?.addEventListener('click', closeRouletteModal);
    rouletteStart?.addEventListener('click', spinRoulette);
    rouletteRetry?.addEventListener('click', () => resetRouletteWheelPosition(true));
    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && rouletteModal && !rouletteModal.classList.contains('hidden')) {
            closeRouletteModal();
        }
    });

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
        latestCvAnalysis = null;
        persistFeatureState();
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
            latestCvAnalysis = data;
            persistFeatureState();
            renderCvAnalysis(data);
            renderActionCenter();
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
            if (url === '/theses') {
                latestThesisResults = { query, items: data.items || [] };
            } else if (url === '/jobs') {
                latestJobResults = { query, items: data.items || [] };
            }
            persistFeatureState();
            renderActionCenter();
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
    renderActionCenter();
    resetRouletteWheelPosition(true);
    showHome();
});
