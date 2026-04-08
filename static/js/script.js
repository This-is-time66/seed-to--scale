const API = "";

// ======================== STATE ========================
let authToken = localStorage.getItem('sts_token') || null;
let userEmail  = localStorage.getItem('sts_email')  || null;
let userName   = localStorage.getItem('sts_name')   || null;
let currentTab = 'login';
let timerInterval = null;
let confirmAction = null;

let historyList = [];
let currentlyLoadedHistoryId = null;

// ======================== INIT ========================
window.addEventListener('load', () => {
    if (authToken && userEmail) showApp();
    else showAuth();
});

function showAuth() {
    document.getElementById('auth-overlay').style.display = 'flex';
    document.getElementById('main-app').style.display = 'none';
    const btn = document.getElementById('auth-submit-btn');
    btn.disabled = false;
    btn.textContent = currentTab === 'login' ? 'Sign In' : 'Create Account';
    const msgEl = document.getElementById('auth-msg');
    msgEl.textContent = '';
    msgEl.className = 'auth-msg';
}

function showApp() {
    document.getElementById('auth-overlay').style.display = 'none';
    document.getElementById('main-app').style.display = 'block';
    const initials = (userName || userEmail || '?').substring(0, 2).toUpperCase();
    document.getElementById('user-avatar-btn').textContent = initials;
}

// ======================== AUTH ========================
function switchTab(tab) {
    currentTab = tab;
    document.getElementById('tab-login').classList.toggle('active', tab === 'login');
    document.getElementById('tab-signup').classList.toggle('active', tab === 'signup');
    document.getElementById('auth-submit-btn').textContent = tab === 'login' ? 'Sign In' : 'Create Account';
    document.getElementById('name-group').style.display = tab === 'signup' ? 'block' : 'none';
    document.getElementById('auth-heading').textContent = tab === 'login' ? 'Welcome back' : 'Create your account';
    document.getElementById('auth-subheading').textContent = tab === 'login' ? 'Sign in to continue' : 'Get started for free';
    const m = document.getElementById('auth-msg');
    m.textContent = ''; m.className = 'auth-msg';
}

async function handleAuth() {
    const name     = document.getElementById('auth-name').value.trim();
    const email    = document.getElementById('auth-email').value.trim();
    const password = document.getElementById('auth-password').value;
    const msgEl    = document.getElementById('auth-msg');
    const btn      = document.getElementById('auth-submit-btn');

    if (!email || !password) { msgEl.textContent = 'Please fill in all fields.'; msgEl.className = 'auth-msg error'; return; }
    if (currentTab === 'signup' && !name) { msgEl.textContent = 'Please enter your full name.'; msgEl.className = 'auth-msg error'; return; }

    btn.disabled = true; btn.textContent = 'Please wait…';
    msgEl.textContent = ''; msgEl.className = 'auth-msg';

    const endpoint = currentTab === 'login' ? '/login' : '/signup';
    try {
        const res = await fetch(API + endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password, name })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.detail || 'Something went wrong');
        if (currentTab === 'signup') {
            msgEl.textContent = '✓ Account created! Please sign in.'; msgEl.className = 'auth-msg success';
            setTimeout(() => { switchTab('login'); btn.disabled = false; btn.textContent = 'Sign In'; }, 1500);
        } else {
            authToken = data.access_token; userEmail = data.email; userName = data.name;
            localStorage.setItem('sts_token', authToken);
            localStorage.setItem('sts_email', userEmail);
            localStorage.setItem('sts_name',  userName);
            showApp();
        }
    } catch (err) {
        msgEl.textContent = '✗ ' + err.message; msgEl.className = 'auth-msg error';
        btn.disabled = false; btn.textContent = currentTab === 'login' ? 'Sign In' : 'Create Account';
    }
}

function logout() {
    authToken = userEmail = userName = null;
    ['sts_token','sts_email','sts_name'].forEach(k => localStorage.removeItem(k));
    currentlyLoadedHistoryId = null;
    historyList = [];
    document.getElementById('idea-input').value = '';
    document.getElementById('output-empty').style.display = 'flex';
    document.getElementById('output-body').classList.remove('visible');
    document.getElementById('log-body').innerHTML = `
        <div class="log-placeholder">
            <div class="log-placeholder-icon">🤖</div>
            <div class="log-placeholder-text">Awaiting input…</div>
        </div>`;
    document.getElementById('timer').textContent = '0.0s';
    setStatus('');
    closeProfile();
    showAuth();
}

document.addEventListener('keydown', e => {
    if (e.key === 'Enter' && document.getElementById('auth-overlay').style.display !== 'none') handleAuth();
    if (e.key === 'Enter' && document.getElementById('main-app').style.display !== 'none') {
        if (document.activeElement === document.getElementById('idea-input')) runPipeline();
    }
});

// ======================== STATUS ========================
function setStatus(state) {
    const dot = document.getElementById('status-dot');
    const label = document.getElementById('status-text');
    dot.className = 'status-dot' + (state ? ' ' + state : '');
    label.textContent = { '': 'Ready', running: 'Running', error: 'Error' }[state] || 'Ready';
}

// ======================== NEW ANALYSIS ========================
function newAnalysis() {
    currentlyLoadedHistoryId = null;
    document.getElementById('idea-input').value = '';
    document.getElementById('idea-input').focus();
    document.getElementById('output-empty').style.display = 'flex';
    document.getElementById('output-body').classList.remove('visible');
    document.getElementById('log-body').innerHTML = `
        <div class="log-placeholder">
            <div class="log-placeholder-icon">🤖</div>
            <div class="log-placeholder-text">Awaiting input…</div>
        </div>`;
    document.getElementById('timer').textContent = '0.0s';
    setStatus('');
}

// ======================== PIPELINE ========================
function addLog(agent, msg, type) {
    const lb = document.getElementById('log-body');
    if (lb.querySelector('.log-placeholder')) lb.innerHTML = '';
    const el = document.createElement('div');
    el.className = `log-entry ${type}`;
    el.innerHTML = `<div class="log-agent">${agent}</div><div class="log-msg">${msg}</div>`;
    lb.appendChild(el);
    lb.scrollTop = lb.scrollHeight;
}

function startTimer() {
    const start = Date.now();
    timerInterval = setInterval(() => {
        document.getElementById('timer').textContent = ((Date.now()-start)/1000).toFixed(1) + 's';
    }, 100);
}

function stopTimer() { clearInterval(timerInterval); }

async function runPipeline() {
    const idea = document.getElementById('idea-input').value.trim();
    if (!idea) return;

    document.getElementById('log-body').innerHTML = '';
    document.getElementById('output-empty').style.display = 'flex';
    document.getElementById('output-body').classList.remove('visible');
    document.getElementById('run-btn').disabled = true;
    document.getElementById('timer').textContent = '0.0s';
    setStatus('running');
    startTimer();

    addLog('System', 'Pipeline initiated. Starting agent chain…', 'working');
    addLog('Researcher', 'Mapping market landscape and competitors…', 'working');

    try {
        const res = await fetch(API + '/run', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + authToken
            },
            body: JSON.stringify({ concept: idea })
        });

        if (res.status === 401) { logout(); return; }
        if (!res.ok) throw new Error(`Server error: ${res.status}`);

        const data = await res.json();

        addLog('Researcher', 'Market analysis complete ✓', 'success');
        addLog('Visionary', `Pivot crafted: "${data.visionary_plan.pivot_title}"`, 'success');

        if (data.iteration_count > 1) {
            addLog('Auditor', 'Plan rejected — hardware-heavy. Requesting software pivot.', 'error');
            addLog('Visionary', 'Re-architecting as software-only…', 'working');
            addLog('Auditor', `Revised plan approved after ${data.iteration_count} iterations ✓`, 'success');
        } else {
            addLog('Auditor', 'Plan approved — capital-efficient ✓', 'success');
        }

        addLog('Investor', 'Generating investor-grade brief…', 'working');
        addLog('System', 'Analysis complete. Saved to your history ✓', 'system');

        stopTimer();
        setStatus('');
        renderOutput(idea, data);
        showToast('Analysis complete!', 'success');

    } catch (err) {
        stopTimer();
        setStatus('error');
        addLog('System', `ERROR: ${err.message}`, 'error');
        showToast('Pipeline failed. Try again.', 'error');
    }

    document.getElementById('run-btn').disabled = false;
}

// ======================== RENDER OUTPUT ========================
function renderOutput(title, data) {
    document.getElementById('output-empty').style.display = 'none';
    document.getElementById('output-body').classList.add('visible');

    const num = Math.floor(Math.random() * 9000) + 1000;
    document.getElementById('out-number').textContent = `Analysis #${num}`;
    document.getElementById('out-title').textContent = title;

    const auditPassed = data.iteration_count <= 1;
    document.getElementById('out-badges').innerHTML = `
        <span class="badge ${auditPassed ? 'badge-pass' : 'badge-retry'}">
            ${auditPassed ? '✓ First pass' : `↻ ${data.iteration_count} iterations`}
        </span>
        <span class="badge badge-iter">Software-First</span>`;

    const research = data.research_data || {};
    const plan = data.visionary_plan || {};
    document.getElementById('met-market').textContent = research.market_size ? extractMarketShort(research.market_size) : '—';
    document.getElementById('met-mvp').textContent = plan.time_to_mvp_weeks || '8';
    document.getElementById('met-iter').textContent = data.iteration_count || '1';

    document.getElementById('out-pivot-title').textContent = plan.pivot_title || '—';
    document.getElementById('out-pivot-hook').textContent = plan.technical_hook || '—';

    const tagsEl = document.getElementById('out-tech-tags');
    tagsEl.innerHTML = (plan.tech_stack && Array.isArray(plan.tech_stack))
        ? plan.tech_stack.map(t => `<span class="tech-tag">${t}</span>`).join('')
        : '';

    const rg = document.getElementById('research-grid');
    rg.innerHTML = '';
    if (research.market_gap)      rg.innerHTML += card('Market Gap', research.market_gap);
    if (research.key_insight)     rg.innerHTML += card('Key Insight', research.key_insight);
    if (research.target_customer) rg.innerHTML += card('Target Customer', research.target_customer);
    if (plan.moat)                rg.innerHTML += card('Competitive Moat', plan.moat);
    if (research.competitors && research.competitors.length > 0) {
        rg.innerHTML += `<div class="research-card" style="grid-column: span 2">
            <div class="research-card-label">Competitors</div>
            <div class="competitors-list">${research.competitors.map(c =>
                `<div class="competitor-item">
                    <span class="competitor-name">${c.name || c}</span>
                    ${c.weakness ? `<span class="competitor-weakness">↘ ${c.weakness}</span>` : ''}
                </div>`
            ).join('')}</div>
        </div>`;
    }

    document.getElementById('out-manifesto').innerHTML = formatManifesto(data.final_manifesto || '');
}

function card(label, value) {
    return `<div class="research-card">
        <div class="research-card-label">${label}</div>
        <div class="research-card-value">${value}</div>
    </div>`;
}

function extractMarketShort(str) {
    const match = str.match(/\$[\d.]+[BMK]?/i);
    return match ? match[0] : str.substring(0, 12);
}

function formatManifesto(raw) {
    return raw
        .replace(/^## (.+)$/gm, '<div class="m-section-title">$1</div>')
        .replace(/\*\*Q(\d) \(([^)]+)\):\*\*/g, '<span class="quarter-label">Q$1</span><strong>$2:</strong>')
        .replace(/\*\*Risk (\d+):\*\* ([^→]+)→ \*\*Mitigation:\*\* (.+)/g,
            '<div style="padding:8px 0;border-bottom:1px solid var(--border);"><strong style="color:var(--rose)">Risk $1:</strong> $2<br><span style="color:var(--emerald)">→ Mitigation:</span> $3</div>')
        .replace(/^- (.+)$/gm, '<li>$1</li>')
        .replace(/(<li>.*<\/li>)+/gs, m => `<ul>${m}</ul>`)
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/\n{3,}/g, '\n\n')
        .replace(/\n/g, '<br>');
}

// ======================== HISTORY ========================
async function openHistory() {
    document.getElementById('drawer-overlay').classList.add('open');
    document.getElementById('drawer-body').innerHTML = `
        <div class="drawer-empty">
            <div class="drawer-empty-icon">⏳</div>
            <div class="drawer-empty-text">Loading history…</div>
        </div>`;
    await fetchAndRenderHistory();
}

async function fetchAndRenderHistory() {
    try {
        const res = await fetch(API + '/history', {
            headers: { 'Authorization': 'Bearer ' + authToken }
        });
        if (res.status === 401) { logout(); return; }
        const data = await res.json();
        historyList = data.history || [];
        renderHistoryList(historyList);
    } catch {
        document.getElementById('drawer-body').innerHTML = `
            <div class="drawer-empty">
                <div class="drawer-empty-icon">⚠️</div>
                <div class="drawer-empty-text">Failed to load history</div>
            </div>`;
    }
}

function renderHistoryList(items) {
    const body = document.getElementById('drawer-body');
    if (!items || items.length === 0) {
        body.innerHTML = `<div class="drawer-empty">
            <div class="drawer-empty-icon">📂</div>
            <div class="drawer-empty-text">No analyses yet.<br>Run your first pipeline above!</div>
        </div>`;
        return;
    }

    body.innerHTML = items.map(item => {
        const date = new Date(item.created_at).toLocaleDateString('en-IN', {
            day: 'numeric', month: 'short', year: 'numeric'
        });
        const passed = item.iteration_count <= 1;
        return `<div class="history-item" onclick="loadHistoryItem('${item.id}')">
            <div class="history-item-top">
                <div class="history-concept">${escapeHtml(item.concept)}</div>
                <button class="history-delete-btn" onclick="deleteHistoryItem(event, '${item.id}')" title="Delete">🗑</button>
            </div>
            <div class="history-item-bottom">
                <span class="history-date">${date}</span>
                <div class="history-badges">
                    <span class="badge ${passed ? 'badge-pass' : 'badge-retry'}">${passed ? '✓ 1st pass' : `↻ ${item.iteration_count} iter`}</span>
                </div>
            </div>
        </div>`;
    }).join('');
}

function loadHistoryItem(id) {
    const item = historyList.find(i => i.id === id);
    if (!item) return;

    closeHistory();
    currentlyLoadedHistoryId = id;
    document.getElementById('idea-input').value = item.concept;

    const data = {
        visionary_plan:  item.visionary_plan,
        iteration_count: item.iteration_count,
        final_manifesto: item.final_manifesto,
        research_data:   item.research_data,
        audit_feedback:  item.audit_feedback
    };
    renderOutput(item.concept, data);

    document.getElementById('log-body').innerHTML = '';
    addLog('System', 'Loaded from history', 'system');
    addLog('Result', `"${item.concept}"`, 'success');
    document.getElementById('timer').textContent = '—';
    showToast('History item loaded');
}

async function deleteHistoryItem(e, id) {
    e.stopPropagation();
    try {
        const res = await fetch(`${API}/history/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': 'Bearer ' + authToken }
        });
        if (!res.ok) throw new Error();
        showToast('Item deleted', 'success');

        if (currentlyLoadedHistoryId === id) {
            currentlyLoadedHistoryId = null;
            document.getElementById('idea-input').value = '';
            document.getElementById('output-empty').style.display = 'flex';
            document.getElementById('output-body').classList.remove('visible');
            document.getElementById('log-body').innerHTML = `
                <div class="log-placeholder">
                    <div class="log-placeholder-icon">🤖</div>
                    <div class="log-placeholder-text">Awaiting input…</div>
                </div>`;
            document.getElementById('timer').textContent = '0.0s';
            setStatus('');
        }

        await fetchAndRenderHistory();
    } catch {
        showToast('Failed to delete item', 'error');
    }
}

function closeHistory() {
    document.getElementById('drawer-overlay').classList.remove('open');
}

function handleDrawerOverlayClick(e) {
    if (e.target === document.getElementById('drawer-overlay')) closeHistory();
}

// ======================== PROFILE ========================
async function openProfile() {
    document.getElementById('profile-overlay').classList.add('open');
    const initials = (userName || userEmail || '?').substring(0, 2).toUpperCase();
    document.getElementById('profile-avatar-lg').textContent = initials;
    document.getElementById('profile-name-lg').textContent = userName || 'User';
    document.getElementById('profile-email-lg').textContent = userEmail || '';
    try {
        const res = await fetch(API + '/profile', { headers: { 'Authorization': 'Bearer ' + authToken } });
        if (!res.ok) return;
        const data = await res.json();
        document.getElementById('profile-stat-analyses').textContent = data.analysis_count || '0';
        if (data.member_since) {
            document.getElementById('profile-stat-joined').textContent = new Date(data.member_since).getFullYear();
        }
    } catch {}
}

function closeProfile() { document.getElementById('profile-overlay').classList.remove('open'); }
function handleProfileOverlayClick(e) { if (e.target === document.getElementById('profile-overlay')) closeProfile(); }

// ======================== CONFIRM ACTIONS ========================
function confirmDeleteAccount() {
    closeProfile();
    showConfirm('⚠️', 'Delete Your Account?',
        'This will permanently delete your account, all analyses, and all data. This cannot be undone.',
        async () => {
            try {
                const res = await fetch(API + '/account', {
                    method: 'DELETE',
                    headers: { 'Authorization': 'Bearer ' + authToken }
                });
                const data = await res.json().catch(() => ({}));
                if (res.ok) {
                    showToast('Account fully deleted ✓', 'success');
                    setTimeout(logout, 1200);
                } else if (res.status === 500 && data.detail && data.detail.includes('Data deleted')) {
                    showToast('Data cleared. Add SUPABASE_SERVICE_ROLE_KEY to backend.', 'error');
                    setTimeout(logout, 2500);
                } else {
                    showToast((data.detail || 'Delete failed').substring(0, 80), 'error');
                }
            } catch {
                showToast('Network error — is the backend running?', 'error');
            }
        }
    );
}

function showConfirm(icon, title, desc, action) {
    document.getElementById('confirm-icon').textContent  = icon;
    document.getElementById('confirm-title').textContent = title;
    document.getElementById('confirm-desc').textContent  = desc;
    confirmAction = action;
    document.getElementById('confirm-overlay').classList.add('open');
}

function closeConfirm() {
    document.getElementById('confirm-overlay').classList.remove('open');
    confirmAction = null;
}

async function executeConfirmAction() {
    const action = confirmAction;
    closeConfirm();
    if (action) await action();
}

// ======================== TOAST ========================
function showToast(msg, type = '') {
    const tc = document.getElementById('toast-container');
    const t = document.createElement('div');
    t.className = `toast${type ? ' '+type : ''}`;
    t.textContent = msg;
    tc.appendChild(t);
    setTimeout(() => { t.style.animation = 'toastOut 0.3s ease forwards'; setTimeout(() => t.remove(), 300); }, 2500);
}

// ======================== UTILS ========================
function escapeHtml(str) {
    return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}