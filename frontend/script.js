
const API_BASE = process.env.BACKEND_URL; 
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

// ── Supabase client (auth only) ──────────────────────────────
const { createClient } = supabase;
const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ── State ─────────────────────────────────────────────────────
let TOOLS = [];
let activeFilter = 'all';
let savedIds = JSON.parse(localStorage.getItem('orbit-saved') || '[]');
let currentUser = null;
let isAuthMode = 'signin'; // 'signin' | 'signup'

// ═══════════════════════════════════════════════════════════
//  AUTH
// ═══════════════════════════════════════════════════════════
async function initAuth() {
  const { data: { session } } = await sb.auth.getSession();
  if (session) setUser(session.user, session.access_token);

  sb.auth.onAuthStateChange((_event, session) => {
    if (session) setUser(session.user, session.access_token);
    else clearUser();
  });
}

function setUser(user, token) {
  currentUser = { ...user, token };
  const email = user.email || '';
  const isAdmin = user.user_metadata?.role === 'admin';
  document.getElementById('user-display').textContent = email.split('@')[0];
  document.getElementById('loginBtn').style.display = 'none';
  document.getElementById('logoutBtn').style.display = '';
  document.getElementById('adminNavBtn').style.display = isAdmin ? '' : 'none';
}

function clearUser() {
  currentUser = null;
  document.getElementById('user-display').textContent = '';
  document.getElementById('loginBtn').style.display = '';
  document.getElementById('logoutBtn').style.display = 'none';
  document.getElementById('adminNavBtn').style.display = 'none';
}

function openAuth() { document.getElementById('auth-modal').classList.add('open'); }
function closeAuth() { document.getElementById('auth-modal').classList.remove('open'); }

function toggleAuthMode() {
  isAuthMode = isAuthMode === 'signin' ? 'signup' : 'signin';
  const isSignIn = isAuthMode === 'signin';
  document.getElementById('auth-title').textContent = isSignIn ? 'Sign In to ORBIT' : 'Create Account';
  document.getElementById('auth-subtitle').textContent = isSignIn ? 'Bookmark tools, get changelog alerts.' : 'Join the ORBIT community.';
  document.getElementById('auth-submit-btn').textContent = isSignIn ? 'Sign In' : 'Create Account';
  document.getElementById('auth-switch-text').textContent = isSignIn ? 'No account?' : 'Have an account?';
  document.querySelector('.auth-switch a').textContent = isSignIn ? 'Sign up free' : 'Sign in';
  document.getElementById('auth-error').classList.remove('show');
}

async function handleAuth() {
  const email = document.getElementById('auth-email').value.trim();
  const password = document.getElementById('auth-password').value;
  const errEl = document.getElementById('auth-error');
  errEl.classList.remove('show');

  if (!email || !password) {
    errEl.textContent = 'Email and password are required.';
    errEl.classList.add('show');
    return;
  }

  const btn = document.getElementById('auth-submit-btn');
  btn.textContent = 'Please wait…'; btn.disabled = true;

  try {
    let result;
    if (isAuthMode === 'signup') {
      result = await sb.auth.signUp({ email, password });
      if (!result.error) {
        showToast('Check your email to confirm your account!');
        closeAuth();
      }
    } else {
      result = await sb.auth.signInWithPassword({ email, password });
      if (!result.error) {
        showToast('Welcome back!');
        closeAuth();
      }
    }
    if (result.error) {
      errEl.textContent = result.error.message;
      errEl.classList.add('show');
    }
  } finally {
    btn.textContent = isAuthMode === 'signin' ? 'Sign In' : 'Create Account';
    btn.disabled = false;
  }
}

async function handleLogout() {
  await sb.auth.signOut();
  showToast('Signed out');
  if (document.querySelector('.tab.active')?.textContent === 'Admin ⚙') switchTab('tools');
}

// ═══════════════════════════════════════════════════════════
//  TOOLS
// ═══════════════════════════════════════════════════════════
async function loadTools() {
  const grid = document.getElementById('grid');
  // Show skeletons
  grid.innerHTML = Array(6).fill('<div class="skeleton"></div>').join('');
  document.getElementById('showing-count').textContent = 'loading…';

  try {
    const res = await fetch(`${API_BASE}/tools`);
    const { tools } = await res.json();
    TOOLS = tools || [];
    document.getElementById('total-count').textContent = TOOLS.length;
    render();
  } catch {
    grid.innerHTML = '<div class="empty">// failed to load tools — is the backend running?</div>';
  }
}

function render() {
  const q = document.getElementById('search').value.toLowerCase();
  const grid = document.getElementById('grid');

  const filtered = TOOLS.filter(t => {
    const matchCat = activeFilter === 'all' || t.category === activeFilter;
    const matchQ = !q || t.name.toLowerCase().includes(q) ||
      (t.description || '').toLowerCase().includes(q) ||
      (t.tags || []).some(g => g.toLowerCase().includes(q));
    return matchCat && matchQ && t.status === 'published';
  });

  document.getElementById('showing-count').textContent = `${filtered.length} tool${filtered.length !== 1 ? 's' : ''}`;

  if (!filtered.length) {
    grid.innerHTML = '<div class="empty">// no tools found — try a different search</div>';
    return;
  }

  grid.innerHTML = filtered.map((t, i) => {
    const linkUrl = t.affiliate_url || t.url;
    let domain = '';
    try { domain = new URL(t.url).hostname; } catch {}
    const hasAffiliate = !!t.affiliate_url;

    return `
    <div class="card" style="--card-accent:${t.accent_color || '#7b5cf0'};animation-delay:${i * 28}ms" data-id="${t.id}">
      <div class="card-top">
        <div class="card-icon">${t.icon || '🔧'}</div>
        <span class="badge badge-${t.pricing}">${t.pricing}${t.is_new ? '<span class="new-badge">NEW</span>' : ''}</span>
      </div>
      <div class="card-title">${t.name}</div>
      <div class="card-desc">${t.description || ''}</div>
      <div class="card-tags">${(t.tags || []).map(g => `<span class="tag">${g}</span>`).join('')}</div>
      <div class="card-footer">
        <a class="card-link" href="${linkUrl}" target="_blank" rel="noopener noreferrer" onclick="event.stopPropagation()">
          <svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
          ${domain}${hasAffiliate ? '<span class="affiliate-tag">aff</span>' : ''}
        </a>
        <button class="bookmark-btn ${savedIds.includes(t.id) ? 'saved' : ''}" onclick="toggleBookmark(event,'${t.id}')" title="Bookmark">
          ${savedIds.includes(t.id) ? '★' : '☆'}
        </button>
      </div>
    </div>`;
  }).join('');

  grid.querySelectorAll('.card').forEach(c => {
    c.addEventListener('click', () => openModal(c.dataset.id));
  });
}

// ═══════════════════════════════════════════════════════════
//  MODAL
// ═══════════════════════════════════════════════════════════
function openModal(id) {
  const t = TOOLS.find(x => x.id === id);
  if (!t) return;
  document.getElementById('mIcon').textContent = t.icon || '🔧';
  document.getElementById('mName').textContent = t.name;
  document.getElementById('mCat').textContent = `${t.category} · ${t.pricing}`;
  document.getElementById('mDesc').textContent = t.description || '';
  document.getElementById('mTags').innerHTML = (t.tags || []).map(g => `<span class="tag">${g}</span>`).join('');
  document.getElementById('mLink').href = t.url;

  const affLink = document.getElementById('mAffLink');
  if (t.affiliate_url) {
    affLink.href = t.affiliate_url;
    affLink.style.display = '';
  } else {
    affLink.style.display = 'none';
  }

  const bm = document.getElementById('mBookmark');
  bm.textContent = savedIds.includes(t.id) ? '★ Bookmarked' : '☆ Bookmark';
  bm.onclick = () => { toggleBookmark({ stopPropagation: () => {} }, t.id); bm.textContent = savedIds.includes(t.id) ? '★ Bookmarked' : '☆ Bookmark'; };
  document.getElementById('modal').classList.add('open');
}

document.getElementById('modalClose').addEventListener('click', () => document.getElementById('modal').classList.remove('open'));
document.getElementById('modal').addEventListener('click', e => { if (e.target.id === 'modal') document.getElementById('modal').classList.remove('open'); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') { document.getElementById('modal').classList.remove('open'); closeAuth(); } });

// ═══════════════════════════════════════════════════════════
//  BOOKMARK
// ═══════════════════════════════════════════════════════════
function toggleBookmark(e, id) {
  e.stopPropagation();
  if (savedIds.includes(id)) {
    savedIds = savedIds.filter(x => x !== id);
    showToast('Removed from bookmarks');
  } else {
    savedIds.push(id);
    showToast('★ Bookmarked!');
  }
  localStorage.setItem('orbit-saved', JSON.stringify(savedIds));
  render();
}

// ═══════════════════════════════════════════════════════════
//  CHANGELOG
// ═══════════════════════════════════════════════════════════
async function loadChangelog() {
  const el = document.getElementById('changelog-content');
  try {
    const res = await fetch(`${API_BASE}/changelog?limit=12`);
    const { entries } = await res.json();

    if (!entries || !entries.length) {
      el.innerHTML = '<div style="font-family:\'Space Mono\',monospace;font-size:12px;color:var(--muted);padding:40px 0">No changelog entries yet.</div>';
      return;
    }

    el.innerHTML = entries.map(e => {
      const date = new Date(e.week_of).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
      const addedHtml = e.added?.length ? `<div class="cl-label added">+ Added</div><div class="cl-pills">${e.added.map(n => `<span class="cl-pill added">${n}</span>`).join('')}</div>` : '';
      const updatedHtml = e.updated?.length ? `<div class="cl-label updated">~ Updated</div><div class="cl-pills">${e.updated.map(n => `<span class="cl-pill updated">${n}</span>`).join('')}</div>` : '';
      const removedHtml = e.removed?.length ? `<div class="cl-label removed">- Removed</div><div class="cl-pills">${e.removed.map(n => `<span class="cl-pill removed">${n}</span>`).join('')}</div>` : '';

      return `
        <div class="cl-entry">
          <div class="cl-week">// ${date}</div>
          <div class="cl-title">${e.title}</div>
          ${e.summary ? `<div class="cl-summary">${e.summary}</div>` : ''}
          ${addedHtml}${updatedHtml}${removedHtml}
        </div>`;
    }).join('');
  } catch {
    el.innerHTML = '<div style="font-family:\'Space Mono\',monospace;font-size:12px;color:var(--muted);padding:40px 0">// failed to load changelog</div>';
  }
}

// ═══════════════════════════════════════════════════════════
//  SUBMIT
// ═══════════════════════════════════════════════════════════
async function submitTool() {
  const name = document.getElementById('sub-name').value.trim();
  const url = document.getElementById('sub-url').value.trim();
  const category = document.getElementById('sub-category').value;
  const pricing = document.getElementById('sub-pricing').value;
  const description = document.getElementById('sub-desc').value.trim();
  const submitter_email = document.getElementById('sub-email').value.trim();

  if (!name || !url) { showToast('Name and URL are required'); return; }

  const btn = document.getElementById('submitToolBtn');
  btn.textContent = 'Submitting…'; btn.disabled = true;

  try {
    const res = await fetch(`${API_BASE}/submissions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, url, category, pricing, description, submitter_email })
    });
    const data = await res.json();

    if (res.ok) {
      document.getElementById('submit-success').classList.add('show');
      document.getElementById('submit-form-wrap').style.opacity = '0.3';
      document.getElementById('submit-form-wrap').style.pointerEvents = 'none';
    } else {
      showToast(data.error || 'Submission failed');
    }
  } catch {
    showToast('Network error — is the backend running?');
  } finally {
    btn.textContent = 'Submit Tool →'; btn.disabled = false;
  }
}

// ═══════════════════════════════════════════════════════════
//  ADMIN
// ═══════════════════════════════════════════════════════════
async function loadAdmin() {
  if (!currentUser || currentUser.user_metadata?.role !== 'admin') {
    document.getElementById('admin-table-wrap').innerHTML =
      '<p style="font-family:\'Space Mono\',monospace;font-size:12px;color:var(--muted)">Admin access required.</p>';
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/submissions?status=pending`, {
      headers: { Authorization: `Bearer ${currentUser.token}` }
    });
    const { submissions } = await res.json();

    if (!submissions?.length) {
      document.getElementById('admin-table-wrap').innerHTML =
        '<p class="admin-empty">// no pending submissions 🎉</p>';
      return;
    }

    document.getElementById('admin-table-wrap').innerHTML = `
      <table class="admin-table">
        <thead><tr>
          <th>Name</th><th>URL</th><th>Category</th><th>Pricing</th><th>Submitted</th><th>Action</th>
        </tr></thead>
        <tbody>${submissions.map(s => `
          <tr>
            <td><strong>${s.name}</strong></td>
            <td><a href="${s.url}" target="_blank" rel="noopener" style="color:var(--accent2);text-decoration:none;font-family:'Space Mono',monospace;font-size:11px">${s.url.slice(0,40)}…</a></td>
            <td><span class="tag">${s.category}</span></td>
            <td><span class="badge badge-${s.pricing}">${s.pricing}</span></td>
            <td style="font-family:'Space Mono',monospace;font-size:11px;color:var(--muted)">${new Date(s.created_at).toLocaleDateString()}</td>
            <td style="display:flex;gap:8px">
              <button class="action-btn approve" onclick="reviewSubmission('${s.id}','approve')">Approve</button>
              <button class="action-btn reject" onclick="reviewSubmission('${s.id}','reject')">Reject</button>
            </td>
          </tr>`).join('')}
        </tbody>
      </table>`;
  } catch {
    document.getElementById('admin-table-wrap').innerHTML =
      '<p class="admin-empty">// failed to load submissions</p>';
  }
}

async function reviewSubmission(id, action) {
  try {
    const res = await fetch(`${API_BASE}/submissions/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${currentUser.token}` },
      body: JSON.stringify({ action })
    });
    const data = await res.json();
    showToast(data.message || `${action}d`);
    loadAdmin();
    if (action === 'approve') loadTools();
  } catch {
    showToast('Action failed');
  }
}

// ═══════════════════════════════════════════════════════════
//  TABS
// ═══════════════════════════════════════════════════════════
const panels = { tools: null, changelog: null, submit: null, admin: null };
function switchTab(name) {
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  const panel = document.getElementById(`panel-${name}`);
  if (panel) panel.classList.add('active');
  document.querySelectorAll('.tab').forEach(t => { if (t.textContent.toLowerCase().includes(name)) t.classList.add('active'); });

  if (name === 'changelog' && !panels.changelog) { panels.changelog = true; loadChangelog(); }
  if (name === 'admin') loadAdmin();
}

// ═══════════════════════════════════════════════════════════
//  CONTROLS
// ═══════════════════════════════════════════════════════════
document.getElementById('filters').addEventListener('click', e => {
  if (!e.target.dataset.cat) return;
  activeFilter = e.target.dataset.cat;
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.toggle('active', b === e.target));
  render();
});

document.getElementById('search').addEventListener('input', render);

document.getElementById('gridBtn').addEventListener('click', () => {
  document.getElementById('grid').classList.remove('list-view');
  document.getElementById('gridBtn').classList.add('active');
  document.getElementById('listBtn').classList.remove('active');
});
document.getElementById('listBtn').addEventListener('click', () => {
  document.getElementById('grid').classList.add('list-view');
  document.getElementById('listBtn').classList.add('active');
  document.getElementById('gridBtn').classList.remove('active');
});

// ═══════════════════════════════════════════════════════════
//  TOAST
// ═══════════════════════════════════════════════════════════
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg; t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2500);
}

// ═══════════════════════════════════════════════════════════
//  INIT
// ═══════════════════════════════════════════════════════════
initAuth();
loadTools();