
// ═══════════════════════════════════════════════════
//  CONFIG — injected at build time or set manually
//  In production, replace these with your real values.
//  For Netlify: use a _redirects or build plugin to
//  inject window.ENV, or just set the values directly.
// ═══════════════════════════════════════════════════
const CFG = {
  API_BASE: (window.ENV && window.ENV.API_BASE) || 'http://localhost:4000/api',
  SB_URL:   (window.ENV && window.ENV.SUPABASE_URL)      || 'https://YOUR_PROJECT.supabase.co',
  SB_ANON:  (window.ENV && window.ENV.SUPABASE_ANON_KEY) || 'YOUR_ANON_KEY_HERE'
};

// ── Supabase (auth only) ─────────────────────────────────────
const sb = supabase.createClient(CFG.SB_URL, CFG.SB_ANON);

// ── State ────────────────────────────────────────────────────
let TOOLS       = [];
let activeCat   = 'all';
let activePrices= new Set();
let activeUC    = null;
let activeInts  = new Set();
let activeMat   = null;
let savedIds    = JSON.parse(localStorage.getItem('orbit-saved') || '[]');
let compareIds  = [];
let currentUser = null;
let authMode    = 'signin';

// ═══════════════════════════════════════════════════
//  AUTH
// ═══════════════════════════════════════════════════
(async () => {
  const { data: { session } } = await sb.auth.getSession();
  if (session) applyUser(session.user, session.access_token);
  sb.auth.onAuthStateChange((_, sess) => {
    sess ? applyUser(sess.user, sess.access_token) : clearUser();
  });
})();

function applyUser(u, tok) {
  currentUser = { ...u, token: tok };
  document.getElementById('uname').textContent = u.email.split('@')[0];
  document.getElementById('loginBtn').style.display = 'none';
  document.getElementById('logoutBtn').style.display = '';
  document.getElementById('adminBtn').style.display =
    u.user_metadata?.role === 'admin' ? '' : 'none';
}
function clearUser() {
  currentUser = null;
  document.getElementById('uname').textContent = '';
  document.getElementById('loginBtn').style.display = '';
  document.getElementById('logoutBtn').style.display = 'none';
  document.getElementById('adminBtn').style.display = 'none';
}
function openAuth() { document.getElementById('auth-bg').classList.add('open'); }
function closeAuth() { document.getElementById('auth-bg').classList.remove('open'); }
function toggleAuthMode() {
  authMode = authMode === 'signin' ? 'signup' : 'signin';
  const si = authMode === 'signin';
  document.getElementById('auth-title').textContent = si ? 'Sign In to ORBIT' : 'Create Account';
  document.getElementById('auth-sub').textContent = si ? 'Save bookmarks, get weekly digest.' : 'Join the ORBIT community.';
  document.getElementById('a-btn').textContent = si ? 'Sign In' : 'Create Account';
  document.getElementById('a-sw-txt').textContent = si ? 'No account?' : 'Have an account?';
  document.querySelector('#auth-bg .auth-switch a').textContent = si ? 'Sign up free' : 'Sign in';
  document.getElementById('auth-err').classList.remove('show');
}
async function doAuth() {
  const e = document.getElementById('a-email').value.trim();
  const p = document.getElementById('a-pw').value;
  const errEl = document.getElementById('auth-err');
  errEl.classList.remove('show');
  if (!e || !p) { errEl.textContent = 'Email and password required.'; errEl.classList.add('show'); return; }
  const btn = document.getElementById('a-btn');
  btn.textContent = '…'; btn.disabled = true;
  try {
    const fn = authMode === 'signup'
      ? sb.auth.signUp({ email: e, password: p })
      : sb.auth.signInWithPassword({ email: e, password: p });
    const { error } = await fn;
    if (error) { errEl.textContent = error.message; errEl.classList.add('show'); }
    else { closeAuth(); toast(authMode === 'signup' ? 'Check your email to confirm!' : 'Welcome back!'); }
  } finally {
    btn.textContent = authMode === 'signin' ? 'Sign In' : 'Create Account';
    btn.disabled = false;
  }
}
async function doLogout() { await sb.auth.signOut(); toast('Signed out'); }

// ═══════════════════════════════════════════════════
//  LOAD TOOLS
// ═══════════════════════════════════════════════════
async function loadTools() {
  const grid = document.getElementById('grid');
  grid.innerHTML = Array(6).fill('<div class="skel"></div>').join('');
  document.getElementById('result-line').textContent = 'loading…';
  try {
    const r = await fetch(`${CFG.API_BASE}/tools`);
    const { tools } = await r.json();
    TOOLS = tools || [];
    document.getElementById('total-count').textContent = TOOLS.length;
    buildSidebarFilters();
    renderNewLaunches();
    render();
    renderWTUF();
    loadCollections();
  } catch {
    grid.innerHTML = '<div class="empty-state">// failed to load tools — check the backend URL in CFG</div>';
  }
}

// ═══════════════════════════════════════════════════
//  SIDEBAR BUILDER
// ═══════════════════════════════════════════════════
const CATS = [
  {v:'all',l:'All Tools'},{v:'writing',l:'Writing'},{v:'image',l:'Image'},
  {v:'code',l:'Code'},{v:'audio',l:'Audio'},{v:'research',l:'Research'},
  {v:'productivity',l:'Productivity'},{v:'video',l:'Video'},{v:'data',l:'Data'}
];
const ALL_UCS = ['copywriting','email','blogging','seo','social media','coding',
  'testing','ui design','research','academic','meetings','automation','notes',
  'summarization','audio','music','podcast','video','marketing'];

function buildSidebarFilters() {
  // categories
  const catEl = document.getElementById('cat-filters');
  const counts = {};
  TOOLS.forEach(t => { counts[t.category] = (counts[t.category]||0)+1; });
  catEl.innerHTML = CATS.map(c => {
    const n = c.v === 'all' ? TOOLS.length : (counts[c.v]||0);
    if (c.v !== 'all' && !n) return '';
    return `<div class="filter-chip${c.v===activeCat?' active':''}" onclick="setCat('${c.v}')" data-cat="${c.v}">
      ${c.l} <span class="fc-count">${n}</span>
    </div>`;
  }).join('');

  // use cases
  const ucEl = document.getElementById('uc-filters');
  ucEl.innerHTML = ALL_UCS.map(u =>
    `<button class="uc-btn${activeUC===u?' active':''}" onclick="toggleUC('${u}')">${u}</button>`
  ).join('');

  // integrations (collect unique ones)
  const allInts = [...new Set(TOOLS.flatMap(t => t.integrations||[]))].sort();
  const intEl = document.getElementById('int-tags');
  intEl.innerHTML = allInts.slice(0,20).map(i =>
    `<span class="int-tag${activeInts.has(i)?' active':''}" onclick="toggleInt('${i}')">${i}</span>`
  ).join('');
}

function filterIntegrations(q) {
  const allInts = [...new Set(TOOLS.flatMap(t => t.integrations||[]))].sort();
  const filtered = q ? allInts.filter(i => i.toLowerCase().includes(q.toLowerCase())) : allInts.slice(0,20);
  document.getElementById('int-tags').innerHTML = filtered.map(i =>
    `<span class="int-tag${activeInts.has(i)?' active':''}" onclick="toggleInt('${i}')">${i}</span>`
  ).join('');
}

// ═══════════════════════════════════════════════════
//  FILTER CONTROLS
// ═══════════════════════════════════════════════════
function setCat(v) {
  activeCat = v;
  document.querySelectorAll('.filter-chip[data-cat]').forEach(el => {
    el.classList.toggle('active', el.dataset.cat === v);
  });
  render();
}
function togglePrice(cb) {
  cb.checked ? activePrices.add(cb.value) : activePrices.delete(cb.value);
  cb.closest('.price-check').classList.toggle('checked', cb.checked);
  render();
}
function toggleUC(u) {
  activeUC = activeUC === u ? null : u;
  document.querySelectorAll('.uc-btn').forEach(b => b.classList.toggle('active', b.textContent === u && activeUC === u));
  render();
}
function toggleInt(i) {
  activeInts.has(i) ? activeInts.delete(i) : activeInts.add(i);
  document.querySelectorAll('.int-tag').forEach(el => el.classList.toggle('active', activeInts.has(el.textContent)));
  render();
}
function toggleMaturity(btn) {
  const v = btn.dataset.mat;
  activeMat = activeMat === v ? null : v;
  document.querySelectorAll('.mat-btn').forEach(b => b.classList.toggle('active', b.dataset.mat === activeMat));
  render();
}
function clearFilters() {
  activeCat = 'all'; activePrices.clear(); activeUC = null; activeInts.clear(); activeMat = null;
  document.getElementById('search').value = '';
  document.getElementById('int-search').value = '';
  buildSidebarFilters();
  document.querySelectorAll('.price-check input').forEach(cb => { cb.checked = false; });
  document.querySelectorAll('.price-check').forEach(el => el.classList.remove('checked'));
  render();
}

// ═══════════════════════════════════════════════════
//  RENDER
// ═══════════════════════════════════════════════════
function render() {
  const q = document.getElementById('search').value.toLowerCase();
  const sort = document.getElementById('sort-by').value;

  let filtered = TOOLS.filter(t => {
    if (t.status !== 'published') return false;
    if (activeCat !== 'all' && t.category !== activeCat) return false;
    if (activePrices.size && !activePrices.has(t.pricing)) return false;
    if (activeUC && !(t.use_cases||[]).includes(activeUC)) return false;
    if (activeInts.size) {
      const ints = t.integrations || [];
      if (![...activeInts].every(i => ints.includes(i))) return false;
    }
    if (activeMat && t.maturity !== activeMat) return false;
    if (q) {
      const hay = [t.name,t.description,t.why_choose,...(t.tags||[]),...(t.integrations||[]),...(t.use_cases||[])].join(' ').toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  if (sort === 'newest') filtered.sort((a,b) => new Date(b.launched_at||b.created_at) - new Date(a.launched_at||a.created_at));
  else if (sort === 'alpha') filtered.sort((a,b) => a.name.localeCompare(b.name));
  else if (sort === 'price') filtered.sort((a,b) => {
    const o = {free:0,open:1,freemium:2,paid:3};
    return (o[a.pricing]||2) - (o[b.pricing]||2);
  });

  const grid = document.getElementById('grid');
  const rl = document.getElementById('result-line');
  rl.innerHTML = `Showing <b>${filtered.length}</b> of <b>${TOOLS.length}</b> tools`;

  if (!filtered.length) {
    grid.innerHTML = '<div class="empty-state">// no tools match — try adjusting your filters</div>';
    return;
  }

  grid.innerHTML = filtered.map((t, i) => {
    const linkUrl = t.affiliate_url || t.url;
    let domain = '';
    try { domain = new URL(t.url).hostname.replace('www.',''); } catch {}
    const inCmp = compareIds.includes(t.id);
    const isSaved = savedIds.includes(t.id);
    const ints = (t.integrations||[]).slice(0,3);
    return `<div class="card${inCmp?' in-compare':''}" style="--card-accent:${t.accent_color||'#7b5cf0'};animation-delay:${Math.min(i,8)*25}ms" data-id="${t.id}">
      <div class="card-top">
        <div class="card-icon">${t.icon||'🔧'}</div>
        <span class="badge b-${t.pricing}">${t.pricing}${t.is_new?'<span class="new-pill">NEW</span>':''}</span>
      </div>
      <div class="card-name">${t.name}</div>
      ${t.why_choose?`<div class="card-why">${t.why_choose}</div>`:''}
      <div class="card-desc">${t.description||''}</div>
      ${ints.length?`<div class="card-tags">${ints.map(i=>`<span class="int-chip">${i}</span>`).join('')}</div>`:''}
      <div class="card-tags">${(t.tags||[]).slice(0,4).map(g=>`<span class="tag">${g}</span>`).join('')}</div>
      <div class="card-footer">
        <a class="card-link" href="${linkUrl}" target="_blank" rel="noopener" onclick="event.stopPropagation()">↗ ${domain}${t.affiliate_url?'<span class="aff-tag">aff</span>':''}</a>
        <div class="card-actions">
          <button class="icon-btn${isSaved?' saved':''}" title="Bookmark" onclick="event.stopPropagation();toggleBookmark('${t.id}')">${isSaved?'★':'☆'}</button>
          <button class="icon-btn${inCmp?' compare-on':''}" title="Add to compare" onclick="event.stopPropagation();addToCompare('${t.id}')">⊞</button>
        </div>
      </div>
    </div>`;
  }).join('');

  grid.querySelectorAll('.card').forEach(c => {
    c.addEventListener('click', () => openModal(c.dataset.id));
  });

  // update new count
  const newCount = TOOLS.filter(t => t.is_new).length;
  document.getElementById('new-count').textContent = newCount;
}

// ═══════════════════════════════════════════════════
//  NEW LAUNCHES BANNER
// ═══════════════════════════════════════════════════
function renderNewLaunches() {
  const newTools = TOOLS.filter(t => t.is_new).slice(0,8);
  const el = document.getElementById('launches-inner');
  const chips = newTools.map(t => `
    <div class="launch-chip" onclick="openModal('${t.id}')">
      <span class="icon">${t.icon}</span>
      <span class="lname">${t.name}</span>
      <span class="lprice">${t.pricing}</span>
    </div>`).join('');
  el.innerHTML = `<span class="launch-label">🚀 New This Week</span>${chips}`;
}

// ═══════════════════════════════════════════════════
//  TOOL MODAL
// ═══════════════════════════════════════════════════
function openModal(id) {
  const t = TOOLS.find(x => x.id === id);
  if (!t) return;
  document.getElementById('m-icon').textContent = t.icon||'🔧';
  document.getElementById('m-name').textContent = t.name;
  document.getElementById('m-meta').innerHTML =
    `<span class="badge b-${t.pricing}">${t.pricing}</span> ${t.category} · <span style="color:var(--${t.maturity==='beta'?'a3':t.maturity==='stable'?'success':'a2'})">${t.maturity}</span>`;
  document.getElementById('m-why').textContent = t.why_choose||'';
  document.getElementById('m-why').style.display = t.why_choose ? '' : 'none';
  document.getElementById('m-desc').textContent = t.description||'';
  document.getElementById('m-price').textContent = t.price_detail || t.pricing;
  document.getElementById('m-solves').innerHTML = (t.solves||[]).map(s=>`<div class="solve-item">${s}</div>`).join('');
  document.getElementById('m-solves-wrap').style.display = (t.solves||[]).length ? '' : 'none';
  document.getElementById('m-ints').innerHTML = (t.integrations||[]).map(i=>`<span class="int-chip">${i}</span>`).join('');
  document.getElementById('m-int-wrap').style.display = (t.integrations||[]).length ? '' : 'none';
  document.getElementById('m-tags').innerHTML = (t.tags||[]).map(g=>`<span class="tag">${g}</span>`).join('');
  document.getElementById('m-link').href = t.url;
  const aff = document.getElementById('m-aff');
  aff.href = t.affiliate_url||'#'; aff.style.display = t.affiliate_url ? '' : 'none';
  const bm = document.getElementById('m-bm');
  bm.textContent = savedIds.includes(id) ? '★ Bookmarked' : '☆ Bookmark';
  bm.onclick = () => { toggleBookmark(id); bm.textContent = savedIds.includes(id) ? '★ Bookmarked' : '☆ Bookmark'; };
  const cmp = document.getElementById('m-cmp');
  cmp.textContent = compareIds.includes(id) ? '✓ In compare' : '+ Compare';
  cmp.onclick = () => { addToCompare(id); cmp.textContent = compareIds.includes(id) ? '✓ In compare' : '+ Compare'; };
  document.getElementById('modal').classList.add('open');
}
document.getElementById('modal-x').onclick = () => document.getElementById('modal').classList.remove('open');
document.getElementById('modal').addEventListener('click', e => { if (e.target.id==='modal') document.getElementById('modal').classList.remove('open'); });

// ═══════════════════════════════════════════════════
//  BOOKMARK
// ═══════════════════════════════════════════════════
function toggleBookmark(id) {
  savedIds.includes(id) ? (savedIds = savedIds.filter(x=>x!==id), toast('Removed from bookmarks'))
    : (savedIds.push(id), toast('★ Bookmarked!'));
  localStorage.setItem('orbit-saved', JSON.stringify(savedIds));
  render();
}

// ═══════════════════════════════════════════════════
//  COMPARE
// ═══════════════════════════════════════════════════
function addToCompare(id) {
  if (compareIds.includes(id)) {
    compareIds = compareIds.filter(x=>x!==id);
    toast('Removed from comparison');
  } else if (compareIds.length >= 3) {
    toast('Max 3 tools at once'); return;
  } else {
    compareIds.push(id);
    toast('Added to comparison');
  }
  updateCompareBar();
  render();
}
function updateCompareBar() {
  const bar = document.getElementById('compare-bar');
  bar.classList.toggle('visible', compareIds.length > 0);
  document.getElementById('compareNavBtn').style.display = compareIds.length ? '' : 'none';
  document.getElementById('compare-count').textContent = compareIds.length;
  for (let i=0;i<3;i++) {
    const slot = document.getElementById(`cslot-${i}`);
    const t = TOOLS.find(x=>x.id===compareIds[i]);
    if (t) {
      slot.className = 'cslot filled';
      slot.innerHTML = `${t.icon} ${t.name} <button class="cslot-remove" onclick="addToCompare('${t.id}')">✕</button>`;
    } else {
      slot.className = 'cslot';
      slot.textContent = i === 2 ? '+ optional third tool' : 'Select a tool to compare…';
    }
  }
}
function clearCompare() { compareIds = []; updateCompareBar(); render(); }
function runCompare() {
  if (compareIds.length < 2) { toast('Select at least 2 tools to compare'); return; }
  renderCompare();
  switchTab('compare');
}
function renderCompare() {
  const tools = compareIds.map(id => TOOLS.find(x=>x.id===id)).filter(Boolean);
  const n = tools.length;
  // determine "winner" per-dimension (simple: most integrations wins, etc.)
  const mostInts = tools.reduce((a,b) => (a.integrations||[]).length >= (b.integrations||[]).length ? a : b);
  const cheapest = tools.reduce((a,b) => {
    const o={free:0,open:1,freemium:2,paid:3}; return (o[a.pricing]||2)<=(o[b.pricing]||2)?a:b;
  });

  const content = document.getElementById('compare-content');
  content.innerHTML = `
    <div class="compare-grid n${n}">
      ${tools.map(t => `
        <div class="ccard${t===cheapest?' winner':''}">
          <div class="ccard-name">
            ${t.icon} ${t.name}
            ${t===cheapest?'<span class="winner-badge">BEST PRICE</span>':''}
            ${t===mostInts?'<span class="winner-badge" style="background:var(--a2)">MOST INTEGRATIONS</span>':''}
          </div>
          <div class="badge b-${t.pricing}">${t.pricing}</div>
          <div class="ccard-why">${t.why_choose||''}</div>
          ${t.price_detail?`<div class="ccard-price">💰 ${t.price_detail}</div>`:''}
          <div class="ccard-row">
            <div class="ccard-row-title">What it solves</div>
            ${(t.solves||[]).length
              ? (t.solves||[]).map(s=>`<div class="ccard-solve">${s}</div>`).join('')
              : '<div class="no-solve">Not specified</div>'}
          </div>
          <div class="ccard-row">
            <div class="ccard-row-title">Integrations (${(t.integrations||[]).length})</div>
            <div style="display:flex;flex-wrap:wrap;gap:4px">
              ${(t.integrations||[]).map(i=>`<span class="int-chip">${i}</span>`).join('') || '<span style="font-size:12px;color:var(--muted);font-style:italic">None listed</span>'}
            </div>
          </div>
          <div class="ccard-row">
            <div class="ccard-row-title">Best for</div>
            <div style="display:flex;flex-wrap:wrap;gap:4px">
              ${(t.use_cases||[]).map(u=>`<span class="tag">${u}</span>`).join('') || '<span style="font-size:12px;color:var(--muted);font-style:italic">General use</span>'}
            </div>
          </div>
          <div class="ccard-row">
            <div class="ccard-row-title">Maturity</div>
            <span class="badge b-${t.maturity==='stable'||t.maturity==='mature'?'free':'freemium'}">${t.maturity}</span>
          </div>
          <div style="margin-top:8px">
            <a href="${t.url}" target="_blank" rel="noopener" class="mbtn primary" style="font-size:12px;padding:8px 14px">Visit ↗</a>
          </div>
        </div>`).join('')}
    </div>
    <div style="font-family:'Space Mono',monospace;font-size:11px;color:var(--muted);padding:8px 0">
      // Click any card's "Visit" to open the tool. Use ⊞ on tool cards to adjust your comparison.
    </div>`;
}

// ═══════════════════════════════════════════════════
//  WHAT TO USE FOR
// ═══════════════════════════════════════════════════
const USE_CASES_DATA = [
  { emoji:'✍️', title:'Copywriting & ads',       uc:'copywriting',    subtitle:'Write landing pages, ad copy, product descriptions, and emails that convert.' },
  { emoji:'📧', title:'Email writing',            uc:'email',          subtitle:'Draft professional emails, cold outreach, follow-ups, and newsletters.' },
  { emoji:'📝', title:'Blogging & SEO content',  uc:'blogging',       subtitle:'Research, outline, draft, and optimize long-form blog posts.' },
  { emoji:'💻', title:'Writing code',             uc:'coding',         subtitle:'Autocomplete, explain, refactor, test, and debug code in any language.' },
  { emoji:'🎨', title:'Creating images',          uc:'social media',   subtitle:'Generate product shots, social graphics, thumbnails, and posters.' },
  { emoji:'🔬', title:'Research & fact-checking', uc:'research',       subtitle:'Find sources, summarize papers, extract key insights from documents.' },
  { emoji:'📋', title:'Meeting notes',            uc:'meetings',       subtitle:'Transcribe, summarize, and extract action items from calls.' },
  { emoji:'⚡', title:'Automating workflows',     uc:'automation',     subtitle:'Connect apps, automate repetitive tasks, trigger AI mid-flow.' },
  { emoji:'🎙️', title:'Voice & audio',            uc:'audio',          subtitle:'Generate voiceovers, clean up recordings, clone voices, make music.' },
  { emoji:'📚', title:'Academic research',        uc:'academic',       subtitle:'Literature reviews, paper summaries, citation management.' },
  { emoji:'🗒️', title:'Taking smart notes',       uc:'notes',          subtitle:'Capture, organize, and query your personal knowledge base.' },
  { emoji:'📱', title:'Social media content',     uc:'social media',   subtitle:'Captions, thumbnails, short-form video scripts, and post copy.' },
];

function renderWTUF() {
  const grid = document.getElementById('uc-grid');
  grid.innerHTML = USE_CASES_DATA.map(uc => {
    const picks = TOOLS
      .filter(t => (t.use_cases||[]).includes(uc.uc))
      .sort((a,b) => {
        const o={free:0,open:1,freemium:2,paid:3};
        return (o[a.pricing]||2)-(o[b.pricing]||2);
      })
      .slice(0,3);
    return `<div class="uc-card" onclick="setCatFromUC('${uc.uc}')">
      <div class="uc-card-top">
        <span class="uc-emoji">${uc.emoji}</span>
        <span class="uc-title">${uc.title}</span>
      </div>
      <div class="uc-subtitle">${uc.subtitle}</div>
      <div class="uc-top-picks">
        ${picks.map((t,i)=>`<div class="uc-pick">
          <span style="font-family:'Space Mono',monospace;font-size:10px;color:var(--muted)">#${i+1}</span>
          <span class="uc-pick-name">${t.name}</span>
          <span class="badge b-${t.pricing}">${t.pricing}</span>
        </div>`).join('')}
        ${!picks.length?'<div style="font-size:12px;color:var(--muted);font-style:italic">More coming soon…</div>':''}
      </div>
    </div>`;
  }).join('');
}

function filterUseCases(q) {
  document.querySelectorAll('.uc-card').forEach((el, i) => {
    const uc = USE_CASES_DATA[i];
    const match = !q || uc.title.toLowerCase().includes(q.toLowerCase()) || uc.subtitle.toLowerCase().includes(q.toLowerCase());
    el.style.display = match ? '' : 'none';
  });
}

function setCatFromUC(uc) {
  activeUC = uc;
  switchTab('tools');
  setTimeout(() => {
    document.querySelectorAll('.uc-btn').forEach(b => b.classList.toggle('active', b.textContent === uc));
    render();
  }, 50);
}

// ═══════════════════════════════════════════════════
//  COLLECTIONS
// ═══════════════════════════════════════════════════
async function loadCollections() {
  try {
    const r = await fetch(`${CFG.API_BASE}/collections`);
    const { collections } = await r.json();
    const grid = document.getElementById('coll-grid');
    if (!collections?.length) { grid.innerHTML = '<p style="font-family:\'Space Mono\',monospace;font-size:12px;color:var(--muted)">No collections yet.</p>'; return; }
    grid.innerHTML = collections.map(c => {
      const toolNames = (c.collection_tools||[])
        .sort((a,b)=>a.sort_order-b.sort_order)
        .map(ct => ct.tools?.name).filter(Boolean).slice(0,5);
      return `<div class="coll-card" onclick="openCollection('${c.slug}')">
        <div class="coll-emoji">${c.emoji||'📦'}</div>
        <div class="coll-title">${c.title}</div>
        <div class="coll-desc">${c.description||''}</div>
        <div class="coll-tool-chips">${toolNames.map(n=>`<span class="coll-chip">${n}</span>`).join('')}</div>
      </div>`;
    }).join('');
  } catch { /* silently skip */ }
}

function openCollection(slug) {
  if (slug === 'new-launches') {
    activeCat='all'; activeUC=null;
    document.getElementById('sort-by').value = 'newest';
    switchTab('tools');
    setTimeout(render, 50);
  } else if (slug === 'free-only') {
    activePrices = new Set(['free','open']);
    document.querySelectorAll('.price-check input').forEach(cb => {
      cb.checked = ['free','open'].includes(cb.value);
      cb.closest('.price-check').classList.toggle('checked', cb.checked);
    });
    switchTab('tools');
    setTimeout(render, 50);
  } else {
    // map slug to use case
    const map = { copywriting:'copywriting', developers:'coding', content:'podcast' };
    if (map[slug]) setCatFromUC(map[slug]);
  }
}

// ═══════════════════════════════════════════════════
//  CHANGELOG
// ═══════════════════════════════════════════════════
let changelogLoaded = false;
async function loadChangelog() {
  if (changelogLoaded) return;
  changelogLoaded = true;
  const el = document.getElementById('cl-content');
  try {
    const r = await fetch(`${CFG.API_BASE}/changelog?limit=12`);
    const { entries } = await r.json();
    if (!entries?.length) { el.innerHTML = '<p style="font-family:\'Space Mono\',monospace;font-size:11px;color:var(--muted)">No entries yet.</p>'; return; }
    el.innerHTML = entries.map(e => {
      const d = new Date(e.week_of).toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'});
      const pills = (arr, cls) => arr?.length
        ? `<div class="cl-pills">${arr.map(n=>`<span class="cl-pill ${cls}">${n}</span>`).join('')}</div>` : '';
      return `<div class="cl-entry">
        <div class="cl-week">// ${d}</div>
        <div class="cl-title">${e.title}</div>
        ${e.summary?`<div class="cl-summary">${e.summary}</div>`:''}
        ${e.added?.length?`<div class="cl-label added">+ Added</div>${pills(e.added,'added')}`:''}
        ${e.updated?.length?`<div class="cl-label updated">~ Updated</div>${pills(e.updated,'updated')}`:''}
        ${e.removed?.length?`<div class="cl-label removed">- Removed</div>${pills(e.removed,'removed')}`:''}
      </div>`;
    }).join('');
  } catch { el.innerHTML = '<p style="font-family:\'Space Mono\',monospace;font-size:11px;color:var(--muted)">// failed to load changelog</p>'; }
}

// ═══════════════════════════════════════════════════
//  SUBMIT
// ═══════════════════════════════════════════════════
async function submitTool() {
  const name = document.getElementById('sub-name').value.trim();
  const url  = document.getElementById('sub-url').value.trim();
  if (!name || !url) { toast('Name and URL are required'); return; }
  const btn = document.getElementById('sub-btn');
  btn.textContent = 'Submitting…'; btn.disabled = true;
  try {
    const r = await fetch(`${CFG.API_BASE}/submissions`, {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify({
        name, url,
        category: document.getElementById('sub-cat').value,
        pricing: document.getElementById('sub-price').value,
        description: document.getElementById('sub-desc').value.trim(),
        submitter_email: document.getElementById('sub-email').value.trim()
      })
    });
    const d = await r.json();
    if (r.ok) {
      document.getElementById('sub-success').classList.add('show');
      document.getElementById('sub-form').style.opacity = '.3';
      document.getElementById('sub-form').style.pointerEvents = 'none';
    } else { toast(d.error||'Submission failed'); }
  } catch { toast('Network error — check backend'); }
  finally { btn.textContent='Submit Tool →'; btn.disabled=false; }
}

// ═══════════════════════════════════════════════════
//  ADMIN
// ═══════════════════════════════════════════════════
async function loadAdmin() {
  if (!currentUser || currentUser.user_metadata?.role !== 'admin') {
    document.getElementById('admin-content').innerHTML = '<p style="font-family:\'Space Mono\',monospace;font-size:11px;color:var(--muted)">Admin access required.</p>';
    return;
  }
  try {
    const r = await fetch(`${CFG.API_BASE}/submissions?status=pending`,{headers:{Authorization:`Bearer ${currentUser.token}`}});
    const { submissions } = await r.json();
    if (!submissions?.length) { document.getElementById('admin-content').innerHTML='<p style="font-family:\'Space Mono\',monospace;font-size:11px;color:var(--muted)">// no pending submissions 🎉</p>'; return; }
    document.getElementById('admin-content').innerHTML = `<table class="atbl"><thead><tr><th>Name</th><th>URL</th><th>Category</th><th>Price</th><th>Date</th><th>Action</th></tr></thead><tbody>
      ${submissions.map(s=>`<tr>
        <td><strong>${s.name}</strong></td>
        <td><a href="${s.url}" target="_blank" style="color:var(--a2);font-family:'Space Mono',monospace;font-size:10px">${s.url.slice(0,40)}…</a></td>
        <td><span class="tag">${s.category}</span></td>
        <td><span class="badge b-${s.pricing}">${s.pricing}</span></td>
        <td style="font-family:'Space Mono',monospace;font-size:10px;color:var(--muted)">${new Date(s.created_at).toLocaleDateString()}</td>
        <td style="display:flex;gap:6px">
          <button class="abtn ok" onclick="reviewSub('${s.id}','approve')">Approve</button>
          <button class="abtn no" onclick="reviewSub('${s.id}','reject')">Reject</button>
        </td>
      </tr>`).join('')}
    </tbody></table>`;
  } catch { document.getElementById('admin-content').innerHTML='<p style="font-family:\'Space Mono\',monospace;font-size:11px;color:var(--muted)">// failed to load</p>'; }
}

async function reviewSub(id, action) {
  try {
    const r = await fetch(`${CFG.API_BASE}/submissions/${id}`,{method:'PATCH',headers:{'Content-Type':'application/json',Authorization:`Bearer ${currentUser.token}`},body:JSON.stringify({action})});
    const d = await r.json();
    toast(d.message||action);
    loadAdmin();
    if (action==='approve') loadTools();
  } catch { toast('Action failed'); }
}

// ═══════════════════════════════════════════════════
//  TABS
// ═══════════════════════════════════════════════════
function switchTab(name) {
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  const panel = document.getElementById(`panel-${name}`);
  if (panel) panel.classList.add('active');
  document.querySelectorAll('.tab').forEach(t => { if (t.dataset.tab === name) t.classList.add('active'); });
  if (name === 'changelog') loadChangelog();
  if (name === 'admin') loadAdmin();
  if (name === 'compare') renderCompare();
  window.scrollTo(0,0);
}
document.querySelectorAll('.tab').forEach(t => t.addEventListener('click', () => switchTab(t.dataset.tab)));

// ═══════════════════════════════════════════════════
//  VIEW TOGGLE
// ═══════════════════════════════════════════════════
document.getElementById('gridBtn').onclick = () => {
  document.getElementById('grid').classList.remove('list-view');
  document.getElementById('gridBtn').classList.add('active');
  document.getElementById('listBtn').classList.remove('active');
};
document.getElementById('listBtn').onclick = () => {
  document.getElementById('grid').classList.add('list-view');
  document.getElementById('listBtn').classList.add('active');
  document.getElementById('gridBtn').classList.remove('active');
};

// ═══════════════════════════════════════════════════
//  MISC
// ═══════════════════════════════════════════════════
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    document.getElementById('modal').classList.remove('open');
    closeAuth();
  }
});
document.getElementById('auth-bg').addEventListener('click', e => {
  if (e.target.id === 'auth-bg') closeAuth();
});

function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg; t.classList.add('show');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => t.classList.remove('show'), 2400);
}

// ═══════════════════════════════════════════════════
//  INIT
// ═══════════════════════════════════════════════════
loadTools();
initAuth();