/**
 * CAT Quant · main app
 * Single-page app, hash-based routing.
 */
(function () {

/* ============================================================
   DATA + ICONS
   ============================================================ */
let DATA = null;          // loaded from data/questions.json
const SOL_CACHE = {};     // testId -> {qNum: {answer, solution}}

// Map subtopic display name -> URL slug. Covers all 15 subtopics from the
// hierarchical schema. Older flat-bank names kept for backwards compat.
const TOPIC_IDS = {
  // Arithmetic
  'Percentages & Profit-Loss':         'percentages',
  'Ratios & Partnerships':             'ratios',
  'SI & CI':                           'sici',
  'Time, Speed & Distance':            'tsd',
  'Time & Work':                       'tw',
  'Averages & Alligations':            'averages',
  // Algebra
  'Basics of Algebra & Inequalities':  'basics',
  'Modulus':                           'modulus',
  'Logarithms':                        'logs',
  'Sequences & Series':                'sequences',
  'Quadratic & Higher Degree':         'quadratic',
  'Functions & Graphs':                'functions',
  'Linear & Special Equations':        'linear',
  'Indices & Surds':                   'indices',
  // Numbers, Geometry
  'Numbers':                           'numbers',
  'Geometry':                          'geometry',
  // Legacy (older flat schema)
  'Algebra':                           'algebra',
  'Ratio & Proportion':                'ratio',
};

// Map section display name -> a single icon slug. Used by the dashboard.
const SECTION_ICON = {
  'Arithmetic': 'averages',
  'Algebra':    'algebra',
  'Numbers':    'numbers',
  'Geometry':   'tsd',
};

const ICONS = {
  algebra:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7l5 5-5 5"/><path d="M14 17h6"/></svg>',
  averages:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><circle cx="6" cy="6" r="3"/><circle cx="18" cy="6" r="3"/><path d="M6 18h12M9 21l3-3 3 3"/></svg>',
  tsd:       '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
  numbers:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><path d="M5 9h14M5 15h14M9 5l-2 14M17 5l-2 14"/></svg>',
  ratio:     '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><circle cx="6" cy="6" r="2"/><circle cx="18" cy="18" r="2"/><path d="M6 8v10M18 6H8"/></svg>',
  pp:        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><path d="M19 5L5 19"/><circle cx="7.5" cy="7.5" r="2.5"/><circle cx="16.5" cy="16.5" r="2.5"/></svg>',
  sici:      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><path d="M3 17l4-4 4 4 6-8 4 4"/></svg>',
  back:      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>',
  bookmark:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>',
  info:      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>',
  copy:      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>',
  pause:     '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>',
  play:      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>',
  close:     '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
  retake:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5"/></svg>',
};

/* ============================================================
   STATE
   ============================================================ */
let state = {
  view: 'dashboard',
  topicId: null,
  testId: null,
  currentQ: 1,
  answers: {},
  marked: new Set(),
  timerSeconds: 30 * 60,
  timerInterval: null,
  paused: false,
  untimed: false,
  modalQ: null,
  completionPrompt: null,    // {attempted, total, skipped} while the submit-confirm overlay is open
  qTime: {},
  qStartedAt: null,
  // For bookmark practice mode
  bookmarkSet: null,   // [{test_id, qNum}] when practicing bookmarks
};

/* ============================================================
   UTIL
   ============================================================ */
const $app = document.getElementById('app');

// In CAT, TITA questions have NO negative marking. The bank stores 1 for
// historical reasons; this helper returns the correct effective penalty.
function effectiveNegative(q) {
  return q.type === 'tita' ? 0 : (q.marks_negative || 0);
}

function fmtSec(sec) {
  if (sec == null) return '—';
  if (sec < 60) return Math.round(sec) + 's';
  return Math.floor(sec / 60) + 'm ' + (Math.round(sec) % 60).toString().padStart(2, '0') + 's';
}
function topicIdOf(name) { return TOPIC_IDS[name] || name.toLowerCase().replace(/\s+/g, '-'); }
function escapeHtml(s) {
  return (s || '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
function toast(msg) {
  const existing = document.querySelector('.toast');
  if (existing) existing.remove();
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 1800);
}
// Render a compact preview of a question's stem for use in list rows.
// - if there's text, truncate to `maxChars`
// - if there's no text but there's an image, render a small inline thumb
// - if neither, show a muted [image question] fallback
function renderStemPreview(q, maxChars = 100) {
  const text = (q && q.stem_text) || '';
  if (text) {
    const truncated = text.length > maxChars ? text.substring(0, maxChars) + '…' : text;
    return escapeHtml(truncated);
  }
  const imgs = (q && q.stem_images) || [];
  if (imgs.length) {
    return `<img src="${imgs[0]}" alt="" class="stem-thumb">`;
  }
  return '<em style="color:var(--text-muted)">[image question]</em>';
}

function shortTitle(t) {
  if (!t) return '';
  let s = t;
  // Clean HTML-test variant: "AIM 99+ IN CAT 2025 | ACE FOO BAR" -> "FOO BAR"
  s = s.replace(/AIM\s*99\+?\s*IN\s*CAT\s*202\d\s*\|\s*ACE\s*/i, '');
  // OCR-derived variant: "in cat 2024 i ace geometry 1" — the | got read as I,
  // wordsegment split with stray spaces. Strip the leading garbage.
  s = s.replace(/^\s*i?n?\s*cat\s*202\d\s*[i|]?\s*ace\s+/i, '');
  // Any stray "AIM99+" left over.
  s = s.replace(/AIM\s*\d+\s*\+?\s*/i, '');
  // Collapse multi-spaces, trim.
  s = s.replace(/\s{2,}/g, ' ').trim();
  if (!s) return t;
  // Capitalize the first letter (OCR titles end up all lowercase)
  return s.charAt(0).toUpperCase() + s.slice(1);
}
function getTestById(testId) {
  for (const tests of Object.values(DATA.topics)) {
    const t = tests.find(x => x.test_id === testId);
    if (t) return t;
  }
  return null;
}
async function loadSolutions(testId) {
  if (SOL_CACHE[testId] !== undefined) return SOL_CACHE[testId];
  try {
    const r = await fetch(`data/solutions/${encodeURIComponent(testId)}.json`);
    if (!r.ok) throw new Error('not found');
    const data = await r.json();
    SOL_CACHE[testId] = data;
    return data;
  } catch {
    SOL_CACHE[testId] = null;
    return null;
  }
}

/* ============================================================
   ROUTING (hash-based)
   ============================================================ */
function parseHash() {
  const h = location.hash.replace(/^#\/?/, '');
  if (!h) return { view: 'dashboard' };
  const parts = h.split('/').map(decodeURIComponent);
  if (parts[0] === 'topic')     return { view: 'topic', topicId: parts[1] };
  if (parts[0] === 'test')      return { view: 'runner', testId: parts[1], untimed: parts[2] === 'untimed' };
  if (parts[0] === 'results')   return { view: 'results', testId: parts[1] };
  if (parts[0] === 'bookmarks') return { view: 'bookmarks' };
  if (parts[0] === 'analytics') return { view: 'analytics' };
  if (parts[0] === 'profile')   return { view: 'profile' };
  return { view: 'dashboard' };
}
function applyRoute() {
  const r = parseHash();
  state.view = r.view;
  if (r.topicId) state.topicId = r.topicId;
  if (r.testId)  state.testId = r.testId;

  // Clean up runner state when leaving runner
  if (r.view !== 'runner') {
    stopTimer();
  }

  // Resume in-progress attempt when entering runner
  if (r.view === 'runner') {
    initRunner(r.testId, !!r.untimed);
  }

  render();
}
function navigate(hash) {
  if (location.hash !== hash) location.hash = hash;
  else applyRoute();
}

/* ============================================================
   RUNNER STATE INIT
   ============================================================ */
function initRunner(testId, untimed) {
  const test = getTestById(testId);
  if (!test) return;
  const saved = Storage.getAttempt(testId);
  if (saved && !saved.completed_at) {
    state.testId = testId;
    state.currentQ = saved.currentQ || 1;
    state.answers = saved.answers || {};
    state.marked = new Set(saved.marked || []);
    state.qTime = saved.qTime || {};
    state.timerSeconds = saved.timerLeft != null ? saved.timerLeft : (test.timer_min * 60);
    state.untimed = !!saved.untimed || untimed;
  } else {
    state.testId = testId;
    state.currentQ = 1;
    state.answers = {};
    state.marked = new Set();
    state.qTime = {};
    state.timerSeconds = test.timer_min * 60;
    state.untimed = untimed;
  }
  state.paused = false;
  state.completionPrompt = null;
  state.qStartedAt = Date.now();
  if (!state.untimed) startTimer();
}

function persistAttempt(extra = {}) {
  if (!state.testId) return;
  Storage.saveAttempt(state.testId, {
    currentQ: state.currentQ,
    answers: state.answers,
    marked: Array.from(state.marked),
    qTime: state.qTime,
    timerLeft: state.timerSeconds,
    untimed: state.untimed,
    ...extra,
  });
}

/* ============================================================
   RENDER
   ============================================================ */
function render() {
  let html;
  switch (state.view) {
    case 'dashboard': html = renderDashboard(); break;
    case 'topic':     html = renderTopic(); break;
    case 'runner':    html = renderRunner(); break;
    case 'results':   html = renderResults(); break;
    case 'bookmarks': html = renderBookmarks(); break;
    case 'analytics': html = renderAnalytics(); break;
    case 'profile':   html = renderProfile(); break;
    default:          html = renderDashboard();
  }
  if (state.modalQ != null) html += renderQuestionModal(state.modalQ);
  if (state.paused && state.view === 'runner') html += renderPauseOverlay();
  if (state.completionPrompt && state.view === 'runner') html += renderCompletionPrompt();

  $app.innerHTML = `<div class="fade-in">${html}</div>`;
  document.querySelectorAll('.nav-tab').forEach(b => {
    const dashViews = ['dashboard','topic','runner','results'];
    b.classList.toggle('active',
      b.dataset.view === state.view ||
      (b.dataset.view === 'dashboard' && dashViews.includes(state.view)));
  });
  updateProfileChip();
  attachHandlers();
}

/* -------- DASHBOARD -------- */
function renderDashboard() {
  const allTests = Object.values(DATA.topics).flat();
  const totalQuestions = allTests.reduce((a, t) => a + t.questions.length, 0);
  const stats = Storage.aggregateStats(allTests);
  const attempted = stats.attempted;
  const correct = stats.correct;
  const acc = attempted ? Math.round(correct / attempted * 100) : 0;
  const totalMin = stats.timeMin;

  // Section-grouped subtopic cards. Falls back gracefully if .sections is missing.
  const progressMap = Storage.allProgress();
  const sectionsSource = DATA.sections || { 'Topics': DATA.topics };

  function renderSubtopicCard(name, tests) {
    const id = topicIdOf(name);
    const totalQ = tests.reduce((a, t) => a + t.questions.length, 0);
    const completedTests = tests.filter(t => progressMap[t.test_id] === 'completed').length;
    const pctTests = tests.length ? Math.round(completedTests / tests.length * 100) : 0;
    return `
      <button class="topic-card" data-action="open-topic" data-topic="${id}">
        <div>
          <div class="topic-name">${escapeHtml(name)}</div>
          <div class="topic-count">${tests.length} tests · ${totalQ} questions</div>
        </div>
        <div class="progress-row">
          <div class="progress-bar"><div class="progress-fill" style="width:${pctTests}%"></div></div>
          <div class="progress-num">${completedTests}/${tests.length}</div>
        </div>
      </button>
    `;
  }

  const sectionsHtml = Object.entries(sectionsSource).map(([sectionName, subtopics]) => {
    const cards = Object.entries(subtopics).map(([n, t]) => renderSubtopicCard(n, t)).join('');
    const sectionTotalTests = Object.values(subtopics).reduce((a, t) => a + t.length, 0);
    const sectionTotalQs = Object.values(subtopics).reduce((a, t) => a + t.reduce((b, x) => b + x.questions.length, 0), 0);
    const iconKey = SECTION_ICON[sectionName] || 'numbers';
    return `
      <div class="section-block">
        <div class="section-block-head">
          <div class="section-block-title">
            <span class="section-block-icon">${ICONS[iconKey] || ICONS.numbers}</span>
            <h3>${escapeHtml(sectionName)}</h3>
          </div>
          <span class="meta">${Object.keys(subtopics).length} subtopics · ${sectionTotalTests} tests · ${sectionTotalQs} questions</span>
        </div>
        <div class="topic-grid">${cards}</div>
      </div>
    `;
  }).join('');

  const history = Storage.getHistory().slice(0, 4);
  const recentRows = history.length ? history.map(h => {
    const t = getTestById(h.test_id);
    const date = new Date(h.completed_at);
    const ago = relTime(date);
    return `
      <div class="recent-row">
        <div>
          <div class="recent-name">${escapeHtml(shortTitle(t ? t.title : h.test_id))}</div>
          <div class="recent-meta">${ago}</div>
        </div>
        <div class="recent-score">${h.score} / ${h.max}</div>
        <div class="recent-score">${fmtSec(h.time_used)}</div>
        <div><span class="tag pos">Completed</span></div>
      </div>`;
  }).join('') : `
    <div class="recent-row" style="grid-template-columns:1fr;color:var(--text-muted);font-style:italic">
      No tests completed yet. Pick a topic above to start.
    </div>
  `;

  return `
    <div class="eyebrow">CAT 2025 · Quant Practice</div>
    <h1 class="h1">Practice</h1>
    <p class="lede">${allTests.length} timed tests · ${totalQuestions} questions · ${Object.keys(DATA.topics).length} topics. Take them in order — each test follows a specific lecture.</p>

    <div class="stats-row">
      <div class="stat">
        <div class="stat-label">Attempted</div>
        <div class="stat-value">${attempted}<span style="color:var(--text-faint);font-size:16px">/${totalQuestions}</span></div>
        <div class="stat-sub">${Math.round(attempted/totalQuestions*100)}% of bank</div>
      </div>
      <div class="stat">
        <div class="stat-label">Accuracy</div>
        <div class="stat-value">${acc}<span style="color:var(--text-faint);font-size:16px">%</span></div>
        <div class="stat-sub">${correct} correct</div>
      </div>
      <div class="stat">
        <div class="stat-label">Time spent</div>
        <div class="stat-value">${Math.floor(totalMin/60)}<span style="color:var(--text-faint);font-size:16px">h ${totalMin%60}m</span></div>
        <div class="stat-sub">${attempted ? Math.round(totalMin/attempted*10)/10 : 0} min/q avg</div>
      </div>
      <div class="stat">
        <div class="stat-label">Tests done</div>
        <div class="stat-value">${history.length}<span style="color:var(--text-faint);font-size:16px">/${allTests.length}</span></div>
        <div class="stat-sub">${Storage.getHistory().length} attempts logged</div>
      </div>
    </div>

    <div class="section-head">
      <h3>Sections</h3>
      <span class="meta">Pick a subtopic to see its tests</span>
    </div>
    ${sectionsHtml}

    <div class="section-head" style="margin-top:40px">
      <h3>Recent activity</h3>
      <span class="meta">Last ${history.length || 'none'}</span>
    </div>
    <div class="recent-list">
      <div class="recent-row head"><div>Test</div><div>Score</div><div>Time</div><div>Status</div></div>
      ${recentRows}
    </div>
  `;
}
function relTime(d) {
  const diff = Math.floor((Date.now() - d.getTime()) / 1000);
  if (diff < 60) return 'just now';
  if (diff < 3600) return Math.floor(diff/60) + 'm ago';
  if (diff < 86400) return Math.floor(diff/3600) + 'h ago';
  if (diff < 86400*7) return Math.floor(diff/86400) + 'd ago';
  return d.toLocaleDateString();
}

/* -------- TOPIC -------- */
function renderTopic() {
  const tid = state.topicId;
  const topicName = Object.keys(DATA.topics).find(n => topicIdOf(n) === tid);
  if (!topicName) return `<p>Topic not found. <button class="btn" data-action="goto-dashboard">Back to topics</button></p>`;
  const tests = DATA.topics[topicName];
  const totalQ = tests.reduce((a,t)=>a+t.questions.length,0);
  const progress = Storage.allProgress();

  const rows = tests.map((test, i) => {
    const status = progress[test.test_id] || 'untouched';
    const attempt = Storage.getAttempt(test.test_id);
    let cta = 'Start', tag = '<span class="tag">Untouched</span>';
    if (status === 'completed' && attempt && attempt.completed_at) {
      cta = 'Retake';
      tag = `<span class="tag pos">${attempt.score}/${attempt.max}</span>`;
    } else if (attempt && !attempt.completed_at) {
      cta = 'Resume';
      tag = `<span class="tag" style="background:var(--warn-soft);color:var(--warn)">In progress</span>`;
    }
    const nMcq = test.questions.filter(q => q.type === 'mcq').length;
    const nTita = test.questions.length - nMcq;
    const totalPos = test.questions.reduce((acc, q) => acc + (q.marks_correct || 3), 0);
    const totalNeg = test.questions.reduce((acc, q) => acc + effectiveNegative(q), 0);
    return `
      <button class="test-row" data-action="open-test" data-test="${escapeHtml(test.test_id)}">
        <div class="test-num">${String(i+1).padStart(2,'0')}</div>
        <div>
          <div class="test-title">${escapeHtml(shortTitle(test.title))}</div>
          <div class="test-sub">${test.questions.length} questions · ${nMcq} MCQ + ${nTita} TITA · ${test.timer_min} min</div>
        </div>
        <div class="test-stat">${tag}</div>
        <div class="test-stat">+${totalPos}/-${totalNeg}</div>
        <span class="test-cta">${cta}</span>
      </button>
    `;
  }).join('');

  return `
    <button class="back-link" data-action="goto-dashboard">${ICONS.back} Back to topics</button>
    <div class="eyebrow">Topic</div>
    <h1 class="h1" style="margin-bottom:14px">${escapeHtml(topicName)}</h1>
    <p class="lede">${tests.length} tests · ${totalQ} questions · take them in order</p>
    <div class="test-list">${rows}</div>
  `;
}

/* -------- RUNNER -------- */
function renderRunner() {
  const test = getTestById(state.testId);
  if (!test) return `<p>Test not found.</p>`;
  const q = test.questions[state.currentQ - 1];
  const totalQs = test.questions.length;
  const ans = state.answers[q.n];

  const m = Math.floor(state.timerSeconds / 60).toString().padStart(2, '0');
  const s = (state.timerSeconds % 60).toString().padStart(2, '0');
  const warn = state.timerSeconds < 5 * 60;

  // Palette
  const cells = [];
  for (let i = 1; i <= totalQs; i++) {
    let cls = 'pcell';
    if (i === state.currentQ) cls += ' current';
    else if (state.marked.has(i)) cls += ' review';
    else if (state.answers[i] && state.answers[i].value !== '' && state.answers[i].value != null) cls += ' answered';
    cells.push(`<button class="${cls}" data-action="goto-q" data-q="${i}">${i}</button>`);
  }

  // Stem (text + images)
  let stemHTML = '';
  if (q.stem_text) stemHTML += `<p>${escapeHtml(q.stem_text)}</p>`;
  for (const src of (q.stem_images || [])) {
    stemHTML += `<p><img src="${src}" alt=""></p>`;
  }

  // Options or TITA
  let optionsHTML;
  if (q.type === 'tita') {
    optionsHTML = `
      <input class="tita-input" id="titaInput" placeholder="Type your answer…" value="${ans ? escapeHtml(ans.value || '') : ''}" />
      <div class="tita-hint">Numeric answer. No options — type-in-the-answer.</div>
    `;
  } else {
    optionsHTML = `<div class="q-options">
      ${q.options.map((o, i) => {
        const letter = String.fromCharCode(65 + i);
        const sel = ans && ans.value === i;
        let body = '';
        if (o.text) body += `<span>${escapeHtml(o.text)}</span>`;
        for (const src of (o.images || [])) body += `<img src="${src}" alt="">`;
        return `
          <button class="opt ${sel ? 'selected' : ''}" data-action="pick-opt" data-i="${i}">
            <span class="opt-letter">${letter}</span>
            <span>${body}</span>
          </button>`;
      }).join('')}
    </div>`;
  }

  const isBookmarked = Storage.isBookmarked(state.testId, q.n);
  const subtitle = state.untimed
    ? `Practice mode · untimed`
    : `Question ${state.currentQ} of ${totalQs}`;

  return `
    <button class="back-link" data-action="exit-test">${ICONS.back} Exit test</button>

    <div class="runner">
      <div class="runner-main">
        <div class="runner-bar">
          <div>
            <div class="runner-title">${escapeHtml(shortTitle(test.title))}</div>
            <div class="runner-title-sub">${subtitle}</div>
          </div>
          <span style="flex:1"></span>
          ${state.untimed ? '' : `
            <button class="icon-btn" data-action="pause" title="Pause">${ICONS.pause}</button>
            <div class="timer ${warn ? 'warn' : ''}">
              <span class="timer-dot"></span>
              ${m}:${s}
            </div>
          `}
        </div>

        <div class="q-card">
          <div class="q-meta-row">
            <span class="q-num-big">Q${q.n}</span>
            <span class="q-type ${q.type==='tita'?'tita':''}">${q.type === 'tita' ? 'TITA' : 'MCQ'}</span>
            <span class="q-marks">
              <span class="pos-c">+${q.marks_correct}</span> · <span class="neg-c">−${effectiveNegative(q)}</span>
            </span>
            <button class="icon-btn" data-action="copy-q" title="Copy question" style="margin-left:8px;width:28px;height:28px">${ICONS.copy}</button>
            <button class="icon-btn" data-action="bookmark-toggle" title="${isBookmarked?'Remove bookmark':'Bookmark'}" style="width:28px;height:28px;${isBookmarked?'color:var(--accent-text);border-color:var(--accent)':''}">${ICONS.bookmark}</button>
          </div>

          <div class="q-stem serif">${stemHTML}</div>
          ${optionsHTML}

          <div class="q-actions">
            <button class="btn" data-action="prev-q" ${state.currentQ === 1 ? 'disabled' : ''}>← Previous</button>
            <button class="btn-ghost btn" data-action="mark">${state.marked.has(state.currentQ) ? 'Unmark' : 'Mark for review'}</button>
            <span style="flex:1"></span>
            ${state.currentQ === totalQs
              ? `<button class="btn btn-primary" data-action="submit-test">Submit test</button>`
              : `<button class="btn btn-primary" data-action="next-q">Next →</button>`}
          </div>
        </div>
      </div>

      <aside class="runner-side">
        <div class="palette">
          <h4>Question palette</h4>
          <div class="palette-grid">${cells.join('')}</div>
          <div class="palette-legend">
            <span><span class="dot answered"></span> Answered</span>
            <span><span class="dot review"></span> Marked</span>
            <span><span class="dot current"></span> Current</span>
            <span><span class="dot"></span> Not visited</span>
          </div>
          <div class="palette-submit">
            <button class="btn btn-primary" data-action="submit-test">Submit test</button>
          </div>
        </div>
      </aside>
    </div>
  `;
}

/* -------- RESULTS -------- */
function renderResults() {
  const test = getTestById(state.testId);
  if (!test) return `<p>Test not found.</p>`;
  const attempt = Storage.getAttempt(state.testId);
  if (!attempt || !attempt.completed_at) return `<p>No completed attempt for this test.</p>`;

  const r = attempt;
  const acc = (r.correct + r.wrong) ? Math.round(r.correct / (r.correct + r.wrong) * 100) : 0;
  const tMin = Math.floor(r.time_used / 60);
  const tSec = r.time_used % 60;

  // Solutions cached?
  const sols = SOL_CACHE[state.testId] || null;

  const reviewRows = test.questions.map(q => {
    const a = r.answers ? r.answers[q.n] : null;
    const sol = sols && sols[q.n];
    let st = 'skipped', delta = '0';
    if (a && a.value !== '' && a.value != null) {
      if (sol && checkCorrect(q, a.value, sol.answer)) { st = 'correct'; delta = '+'+q.marks_correct; }
      else if (sol) {
        st = 'wrong';
        const neg = effectiveNegative(q);
        delta = neg > 0 ? '−'+neg : '0';
      }
      else { st = 'pending'; delta = '?'; }
    }
    const mark = st === 'correct' ? '✓' : st === 'wrong' ? '✕' : st === 'pending' ? '?' : '–';
    const t = (r.qTime && r.qTime[q.n]) || null;
    const isBookmarked = Storage.isBookmarked(state.testId, q.n);
    const negDisplay = q.type === 'tita' ? '0' : q.marks_negative;
    return `
      <button class="test-row" data-action="open-review" data-q="${q.n}">
        <div class="review-q-mark ${st}">${mark}</div>
        <div>
          <div class="test-title">Q${q.n}: ${renderStemPreview(q, 90)}</div>
          <div class="test-sub">${q.type === 'tita' ? 'TITA' : 'MCQ'} · +${q.marks_correct}/-${negDisplay}${isBookmarked ? ' · ★ bookmarked' : ''}</div>
        </div>
        <div class="test-stat mono" title="Time on this question">${fmtSec(t)}</div>
        <div class="test-stat">${delta}</div>
      </button>
    `;
  }).join('');

  const nextTest = findNextTest(test);
  const nextHref = nextTest ? `#/test/${encodeURIComponent(nextTest.test_id)}` : null;

  return `
    <button class="back-link" data-action="goto-dashboard">${ICONS.back} Back to topics</button>
    <div class="results-hero">
      <div class="eyebrow">Test complete · ${escapeHtml(shortTitle(test.title))}</div>
      <div class="score-big">${r.score}<span style="color:var(--text-faint)"> / ${r.max}</span></div>
      <div class="score-sub">Accuracy ${acc}% · ${tMin}m ${tSec}s used of ${test.timer_min}m</div>
      <div style="display:flex; gap:8px; margin-top:22px; flex-wrap:wrap">
        <button class="btn btn-primary" data-action="retake-test">${ICONS.retake} Retake test</button>
        ${nextTest ? `<a class="btn" href="${nextHref}">Next test in topic →</a>` : ''}
        <button class="btn btn-ghost" data-action="goto-dashboard">Back to topics</button>
      </div>
    </div>

    <div class="results-grid">
      <div class="stat"><div class="stat-label">Correct</div><div class="stat-value" style="color:var(--pos)">${r.correct}</div></div>
      <div class="stat"><div class="stat-label">Wrong</div><div class="stat-value" style="color:var(--neg)">${r.wrong}</div></div>
      <div class="stat"><div class="stat-label">Skipped</div><div class="stat-value">${r.skipped}</div></div>
      <div class="stat"><div class="stat-label">Avg time / q</div><div class="stat-value">${(r.correct+r.wrong) ? Math.round(r.time_used / (r.correct+r.wrong)) : 0}<span style="color:var(--text-faint);font-size:16px">s</span></div></div>
    </div>

    <div class="section-head">
      <h3>Question-by-question review</h3>
      <span class="meta">${sols ? 'Solutions are AI-generated · flag wrong ones' : 'Solutions still loading — click any row'}</span>
    </div>
    <p style="font-size:13px;color:var(--text-muted);margin:-12px 0 12px">Click any row to see the solution.</p>
    <div class="test-list review-list">${reviewRows}</div>
  `;
}
function checkCorrect(q, userVal, correctAns) {
  if (correctAns == null) return false;
  if (q.type === 'mcq') {
    // correctAns might be 'A','B','C','D' or 0..3
    if (typeof correctAns === 'string') return userVal === (correctAns.toUpperCase().charCodeAt(0) - 65);
    return userVal === correctAns;
  }
  // TITA: numeric/string compare with tolerance
  const u = String(userVal).trim();
  const c = String(correctAns).trim();
  if (u === c) return true;
  const un = parseFloat(u), cn = parseFloat(c);
  if (!isNaN(un) && !isNaN(cn) && Math.abs(un - cn) < 0.01) return true;
  return false;
}
function findNextTest(test) {
  const tests = Object.values(DATA.topics).flat();
  const idx = tests.findIndex(t => t.test_id === test.test_id);
  return idx >= 0 && idx + 1 < tests.length ? tests[idx + 1] : null;
}

/* -------- BOOKMARKS -------- */
function renderBookmarks() {
  const all = Storage.allBookmarks();
  const items = Object.values(all).map(b => {
    const test = getTestById(b.test_id);
    const q = test ? test.questions.find(x => x.n === b.q) : null;
    if (!q) return null;
    const topic = Object.keys(DATA.topics).find(n => DATA.topics[n].includes(test));
    return { test, q, topic };
  }).filter(Boolean);
  const groups = {};
  for (const it of items) {
    if (!groups[it.topic]) groups[it.topic] = [];
    groups[it.topic].push(it);
  }
  const total = items.length;
  if (total === 0) {
    return `
      <div class="eyebrow">Saved for later</div>
      <h1 class="h1">Bookmarks</h1>
      <p class="lede">Nothing bookmarked yet. While taking a test, click the bookmark icon next to any question to save it for later review.</p>
      <button class="btn btn-primary" data-action="goto-dashboard">${ICONS.back} Browse topics</button>
    `;
  }
  return `
    <div class="eyebrow">Saved for later</div>
    <h1 class="h1">Bookmarks</h1>
    <p class="lede">${total} questions across ${Object.keys(groups).length} topics. Practice them as an untimed set.</p>
    <div style="display:flex;gap:8px;margin-bottom:32px;flex-wrap:wrap">
      <button class="btn btn-primary" data-action="practice-bookmarks" data-topic="all">${ICONS.play} Practice all ${total} · untimed</button>
      <button class="btn" data-action="goto-dashboard">Browse topics</button>
    </div>
    ${Object.entries(groups).map(([topic, list]) => `
      <div class="section-head" style="margin-top:32px">
        <h3>${escapeHtml(topic)} <span style="color:var(--text-faint);font-weight:500;font-size:14px">· ${list.length}</span></h3>
        <button class="btn btn-sm" data-action="practice-bookmarks" data-topic="${topicIdOf(topic)}">${ICONS.play} Practice these</button>
      </div>
      <div class="test-list">
        ${list.map((it, i) => `
          <button class="test-row" data-action="open-bookmark" data-test="${escapeHtml(it.test.test_id)}" data-q="${it.q.n}">
            <div class="test-num">${String(i+1).padStart(2,'0')}</div>
            <div>
              <div class="test-title">${renderStemPreview(it.q, 100)}</div>
              <div class="test-sub">${escapeHtml(shortTitle(it.test.title))} · Q${it.q.n} · ${it.q.type.toUpperCase()}</div>
            </div>
            <div class="test-stat"><span class="tag">${it.q.type.toUpperCase()}</span></div>
            <div class="test-stat"></div>
            <span class="test-cta">Open</span>
          </button>
        `).join('')}
      </div>
    `).join('')}
  `;
}

/* -------- ANALYTICS -------- */
function renderAnalytics() {
  const history = Storage.getHistory();
  if (!history.length) {
    return `
      <div class="eyebrow">Your performance</div>
      <h1 class="h1">Analytics</h1>
      <p class="lede">Take a few tests and your stats will show up here — accuracy by topic, pacing, weak spots.</p>
    `;
  }
  // Aggregate per topic
  const perTopic = {};
  for (const [topic, tests] of Object.entries(DATA.topics)) {
    const ids = new Set(tests.map(t => t.test_id));
    const taken = history.filter(h => ids.has(h.test_id));
    let attempted = 0, correct = 0, time = 0;
    for (const h of taken) {
      attempted += (h.correct || 0) + (h.wrong || 0);
      correct += h.correct || 0;
      time += h.time_used || 0;
    }
    perTopic[topic] = { attempted, correct, time, tests: tests.length, totalQ: tests.reduce((a,t)=>a+t.questions.length,0) };
  }
  const sorted = Object.entries(perTopic).sort((a,b) => b[1].attempted - a[1].attempted);
  return `
    <div class="eyebrow">Your performance</div>
    <h1 class="h1">Analytics</h1>
    <p class="lede">Drill into accuracy and pacing across topics.</p>
    <div class="section-head"><h3>Accuracy by topic</h3></div>
    <div class="test-list">
      ${sorted.map(([name, p]) => {
        const acc = p.attempted ? Math.round(p.correct/p.attempted * 100) : 0;
        const id = topicIdOf(name);
        return `
          <div class="test-row">
            <div class="test-num">${ICONS[id] || ''}</div>
            <div>
              <div class="test-title">${escapeHtml(name)}</div>
              <div class="test-sub">${p.attempted}/${p.totalQ} attempted · ${p.correct} correct</div>
            </div>
            <div class="test-stat" style="min-width:120px">
              <div class="progress-bar"><div class="progress-fill" style="width:${acc}%"></div></div>
            </div>
            <div class="test-stat" style="min-width:50px">${acc}%</div>
            <div class="test-stat">${p.attempted ? Math.round(p.time/p.attempted) + 's' : '—'}</div>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

/* -------- PROFILE -------- */
function renderProfile() {
  const active = Storage.getActiveProfile();
  const profiles = Storage.getProfiles();
  const cards = profiles.map(p => {
    const s = Storage.profileStats(p.name);
    const acc = s.attempted ? Math.round(s.correct / s.attempted * 100) : 0;
    const initial = p.name.slice(0, 1).toUpperCase();
    const isActive = p.name === active;
    return `
      <div class="profile-card ${isActive ? 'active' : ''}">
        <div class="profile-card-row">
          <div class="profile-card-avatar">${escapeHtml(initial)}</div>
          <div class="profile-card-info">
            <div class="profile-card-name">
              ${escapeHtml(p.name)}
              ${isActive ? '<span class="tag pos" style="font-size:10px">Active</span>' : ''}
            </div>
            <div class="profile-card-meta">
              ${s.tests_completed} tests completed · ${s.correct}/${s.attempted} correct (${acc}%)
            </div>
          </div>
          <div class="profile-card-actions">
            ${isActive
              ? `<button class="btn btn-sm" data-action="profile-rename" data-name="${escapeHtml(p.name)}">Rename</button>
                 <button class="btn btn-sm danger" data-action="profile-reset" data-name="${escapeHtml(p.name)}">Reset progress</button>`
              : `<button class="btn btn-sm btn-primary" data-action="profile-switch" data-name="${escapeHtml(p.name)}">Switch to</button>
                 <button class="btn btn-sm danger" data-action="profile-delete" data-name="${escapeHtml(p.name)}">Delete</button>`}
          </div>
        </div>
      </div>
    `;
  }).join('');

  return `
    <button class="back-link" data-action="goto-dashboard">${ICONS.back} Back</button>
    <div class="eyebrow">Account</div>
    <h1 class="h1">Profiles</h1>
    <p class="lede">Each profile keeps its own progress, attempts, bookmarks, and history. Switch between them to try the site with different states or to share the browser with someone else.</p>

    ${cards}

    <div class="profile-add">
      <input type="text" id="newProfileName" placeholder="New profile name (e.g. 'Friend', 'Test run')" maxlength="40" />
      <button class="btn btn-primary" data-action="profile-add">Add profile</button>
    </div>
    <p style="font-size:12px;color:var(--text-muted);margin-top:8px">
      All data is stored locally in this browser. Profiles are not synced across devices.
    </p>
  `;
}

/* -------- MODAL -------- */
function renderQuestionModal(qNum) {
  // testId may differ if opened from bookmarks
  const testId = state.modalTestId || state.testId;
  const test = getTestById(testId);
  if (!test) return '';
  const q = test.questions.find(x => x.n === qNum);
  if (!q) return '';
  const attempt = Storage.getAttempt(testId);
  const a = attempt && attempt.answers && attempt.answers[qNum];
  const sols = SOL_CACHE[testId];
  const sol = sols && sols[qNum];
  const isBookmarked = Storage.isBookmarked(testId, qNum);

  let resultTag = '<span class="modal-tag">unattempted</span>';
  let userPick = null, correct = null;
  if (a && a.value !== '' && a.value != null) {
    if (q.type === 'mcq') {
      userPick = a.value;
      correct = sol ? (typeof sol.answer === 'string' ? sol.answer.toUpperCase().charCodeAt(0) - 65 : sol.answer) : null;
      if (sol == null) resultTag = '<span class="modal-tag">solution loading…</span>';
      else if (userPick === correct) resultTag = '<span class="modal-tag correct">correct</span>';
      else resultTag = '<span class="modal-tag wrong">wrong</span>';
    } else {
      if (sol == null) resultTag = '<span class="modal-tag">solution loading…</span>';
      else if (checkCorrect(q, a.value, sol.answer)) resultTag = '<span class="modal-tag correct">correct</span>';
      else resultTag = '<span class="modal-tag wrong">wrong</span>';
    }
  } else {
    resultTag = '<span class="modal-tag">skipped</span>';
  }

  let stemHTML = '';
  if (q.stem_text) stemHTML += `<p>${escapeHtml(q.stem_text)}</p>`;
  for (const src of (q.stem_images || [])) stemHTML += `<p><img src="${src}" alt=""></p>`;

  let optsHTML = '';
  if (q.type === 'mcq') {
    optsHTML = '<div class="modal-options">' + q.options.map((o, i) => {
      const letter = String.fromCharCode(65 + i);
      let cls = 'modal-opt', flag = '';
      if (correct != null && i === correct) { cls += ' correct'; flag = '<span class="modal-opt-flag">✓ correct</span>'; }
      if (userPick != null && i === userPick && userPick !== correct) { cls += ' user-wrong'; flag = '<span class="modal-opt-flag">your answer</span>'; }
      let body = '';
      if (o.text) body += `<span>${escapeHtml(o.text)}</span>`;
      for (const src of (o.images || [])) body += `<img src="${src}" alt="" style="max-height:60px">`;
      return `<div class="${cls}"><span class="modal-opt-letter">${letter}</span><span>${body}</span>${flag}</div>`;
    }).join('') + '</div>';
  } else {
    const correctAns = sol ? sol.answer : null;
    const userAns = a ? a.value : '';
    const userOk = sol && checkCorrect(q, userAns, correctAns);
    optsHTML = `
      <div style="font-size:11px;letter-spacing:0.06em;color:var(--text-muted);margin:18px 0 8px;text-transform:uppercase;font-weight:600">Your answer</div>
      <div class="modal-opt ${userAns ? (userOk ? 'correct' : (sol ? 'user-wrong' : '')) : ''}">
        <span class="mono">${userAns ? escapeHtml(String(userAns)) : '— skipped —'}</span>
      </div>
      ${sol ? `
        <div style="font-size:11px;letter-spacing:0.06em;color:var(--text-muted);margin:14px 0 8px;text-transform:uppercase;font-weight:600">Correct answer</div>
        <div class="modal-opt correct">
          <span class="mono">${escapeHtml(String(correctAns))}</span>
          <span class="modal-opt-flag">✓</span>
        </div>
      ` : ''}
    `;
  }

  let solHTML;
  if (sol && sol.solution) {
    solHTML = `
      <div class="modal-solution">
        <div class="eyebrow">Solution</div>
        <div class="modal-solution-text">${escapeHtml(sol.solution).replace(/\n/g,'<br>')}</div>
        <div class="ai-disclaimer" style="margin-top:10px">${ICONS.info} AI-generated · <a href="#" data-action="flag-wrong">flag if wrong</a></div>
      </div>
    `;
  } else {
    solHTML = `
      <div class="modal-solution placeholder">
        <div class="eyebrow">Solution</div>
        <div class="modal-solution-text" style="color:var(--text-muted)">Solution for this test hasn't been generated yet. The build pass solves all questions in batches; check back soon, or refresh after a while.</div>
      </div>
    `;
    // Trigger lazy load
    loadSolutions(testId).then(() => {
      if (state.modalQ === qNum) render();
    });
  }

  const t = (attempt && attempt.qTime && attempt.qTime[qNum]) || null;

  return `
    <div class="modal-backdrop" data-action="close-modal" data-target="self">
      <div class="modal">
        <div class="modal-head">
          <span class="q-num-big mono">Q.${qNum}</span>
          <span class="modal-tag" style="text-transform:uppercase">${q.type === 'tita' ? 'TITA' : 'MCQ'}</span>
          ${resultTag}
          <span style="font-size:12px;color:var(--text-muted);margin-left:6px;font-family:'IBM Plex Mono',monospace">+${q.marks_correct} / −${effectiveNegative(q)}</span>
          ${t ? `<span style="font-size:12px;color:var(--text-muted);font-family:'IBM Plex Mono',monospace" title="Time spent">⏱ ${fmtSec(t)}</span>` : ''}
          <div class="modal-actions">
            <button class="icon-btn" data-action="bookmark-modal" data-q="${qNum}" title="${isBookmarked?'Remove bookmark':'Bookmark'}" style="${isBookmarked?'color:var(--accent-text);border-color:var(--accent)':''}">${ICONS.bookmark}</button>
            <button class="icon-btn" data-action="copy-modal" data-q="${qNum}" title="Copy question">${ICONS.copy}</button>
            <button class="icon-btn" data-action="close-modal" title="Close">${ICONS.close}</button>
          </div>
        </div>
        <div class="modal-body">
          <div class="modal-stem">${stemHTML}</div>
          ${optsHTML}
          ${solHTML}
        </div>
      </div>
    </div>
  `;
}

/* -------- SUBMIT CONFIRMATION -------- */
function renderCompletionPrompt() {
  const p = state.completionPrompt;
  if (!p) return '';
  const used = (currentTest().timer_min * 60) - state.timerSeconds;
  const m = Math.floor(used / 60);
  const s = used % 60;
  return `
    <div class="pause-overlay">
      <div class="pause-card">
        <div class="topic-icon" style="margin:0 auto 14px;width:42px;height:42px;background:var(--warn-soft);color:var(--warn);font-family:'IBM Plex Mono',monospace;font-size:22px;font-weight:600">!</div>
        <h2>Submit now?</h2>
        <p>You've answered <strong>${p.attempted}</strong> of ${p.total} questions.
          ${p.skipped} unanswered will be marked as skipped.</p>
        <div class="pause-time mono" title="Time used / total">
          ${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')} <span style="color:var(--text-faint);font-size:18px"> of ${String(currentTest().timer_min).padStart(2,'0')}:00</span>
        </div>
        <div class="pause-actions">
          <button class="btn" data-action="continue-solving">${ICONS.back} Continue solving</button>
          <button class="btn btn-primary" data-action="submit-anyway">See results & solutions</button>
        </div>
      </div>
    </div>
  `;
}

/* -------- PAUSE -------- */
function renderPauseOverlay() {
  const m = Math.floor(state.timerSeconds / 60).toString().padStart(2, '0');
  const s = (state.timerSeconds % 60).toString().padStart(2, '0');
  return `
    <div class="pause-overlay">
      <div class="pause-card">
        <div class="topic-icon" style="margin:0 auto 14px;width:42px;height:42px">${ICONS.pause}</div>
        <h2>Test paused</h2>
        <p>Take a breath. Timer is held.</p>
        <div class="pause-time mono">${m}:${s}</div>
        <div class="pause-actions">
          <button class="btn btn-primary" data-action="resume">${ICONS.play} Resume</button>
          <button class="btn" data-action="exit-test">Save & exit</button>
        </div>
      </div>
    </div>
  `;
}

/* ============================================================
   EVENTS
   ============================================================ */
function attachHandlers() {
  document.querySelectorAll('[data-action]').forEach(el => {
    if (el.dataset._wired) return;
    el.dataset._wired = '1';
    el.addEventListener('click', handleAction);
  });
  document.querySelectorAll('.nav-tab').forEach(b => {
    if (b.dataset._wired) return;
    b.dataset._wired = '1';
    b.addEventListener('click', () => {
      if (b.dataset.view === 'dashboard') navigate('#/');
      else navigate('#/' + b.dataset.view);
    });
  });
}

function handleAction(e) {
  const el = e.currentTarget;
  const a = el.dataset.action;
  if (a === 'close-modal' && el.dataset.target === 'self' && e.target !== el) return;
  if (a !== 'flag-wrong' && el.tagName === 'A') {
    // Allow normal anchor navigation
    return;
  }

  if (a === 'goto-dashboard') { navigate('#/'); return; }
  if (a === 'open-topic')     { navigate('#/topic/' + el.dataset.topic); return; }
  if (a === 'open-test')      { navigate('#/test/' + encodeURIComponent(el.dataset.test)); return; }

  if (a === 'next-q') { saveCurrentQ(); state.currentQ = Math.min(state.currentQ + 1, currentTest().questions.length); persistAttempt(); render(); return; }
  if (a === 'prev-q') { saveCurrentQ(); state.currentQ = Math.max(state.currentQ - 1, 1); persistAttempt(); render(); return; }
  if (a === 'goto-q') { saveCurrentQ(); state.currentQ = parseInt(el.dataset.q); persistAttempt(); render(); return; }

  if (a === 'pick-opt') {
    const i = parseInt(el.dataset.i);
    state.answers[state.currentQ] = { value: i };
    persistAttempt(); render(); return;
  }
  if (a === 'mark') {
    if (state.marked.has(state.currentQ)) state.marked.delete(state.currentQ);
    else state.marked.add(state.currentQ);
    persistAttempt(); render(); return;
  }

  if (a === 'submit-test') { submitTest(); return; }
  if (a === 'continue-solving') {
    state.completionPrompt = null;
    if (!state.untimed && state.timerSeconds > 0) startTimer();
    render();
    return;
  }
  if (a === 'submit-anyway') {
    state.completionPrompt = null;
    submitTest({ confirmed: true });
    return;
  }
  if (a === 'open-review') { state.modalQ = parseInt(el.dataset.q); state.modalTestId = state.testId; render(); return; }
  if (a === 'open-bookmark') { state.modalTestId = el.dataset.test; state.modalQ = parseInt(el.dataset.q); render(); return; }
  if (a === 'close-modal') { state.modalQ = null; state.modalTestId = null; render(); return; }
  if (a === 'pause') { state.paused = true; stopTimer(); render(); return; }
  if (a === 'resume') { state.paused = false; startTimer(); render(); return; }
  if (a === 'exit-test') {
    saveCurrentQ();
    persistAttempt();
    state.paused = false;
    stopTimer();
    if (state.testId) {
      const test = getTestById(state.testId);
      const topic = Object.keys(DATA.topics).find(n => DATA.topics[n].includes(test));
      navigate('#/topic/' + topicIdOf(topic));
    } else navigate('#/');
    return;
  }
  if (a === 'retake-test') {
    Storage.clearAttempt(state.testId);
    Storage.setProgress(state.testId, 'untouched');
    navigate('#/test/' + encodeURIComponent(state.testId));
    toast('Starting fresh attempt');
    return;
  }
  if (a === 'practice-bookmarks') {
    toast('Bookmark practice mode coming in next update');
    return;
  }
  if (a === 'bookmark-toggle') {
    const isNow = Storage.toggleBookmark(state.testId, state.currentQ);
    toast(isNow ? 'Bookmarked' : 'Bookmark removed');
    render(); return;
  }
  if (a === 'bookmark-modal') {
    const tid = state.modalTestId || state.testId;
    const isNow = Storage.toggleBookmark(tid, parseInt(el.dataset.q));
    toast(isNow ? 'Bookmarked' : 'Bookmark removed');
    render(); return;
  }
  if (a === 'copy-q') { copyQuestion(state.testId, state.currentQ); return; }
  if (a === 'copy-modal') { copyQuestion(state.modalTestId || state.testId, parseInt(el.dataset.q)); return; }
  if (a === 'flag-wrong') { e.preventDefault(); toast('Flagged · thank you'); return; }

  /* ----- profiles ----- */
  if (a === 'profile-switch') {
    const name = el.dataset.name;
    Storage.switchProfile(name);
    toast(`Switched to ${name}`);
    updateProfileChip();
    SOL_CACHE_CLEAR();
    navigate('#/');
    return;
  }
  if (a === 'profile-add') {
    const inp = document.getElementById('newProfileName');
    const name = inp ? inp.value : '';
    const r = Storage.addProfile(name);
    if (!r.ok) { toast(r.error); return; }
    toast(`Profile "${name}" added`);
    if (inp) inp.value = '';
    render();
    return;
  }
  if (a === 'profile-delete') {
    const name = el.dataset.name;
    if (!confirm(`Delete profile "${name}"? All its progress, bookmarks, and history will be erased. This cannot be undone.`)) return;
    const r = Storage.deleteProfile(name);
    if (!r.ok) { toast(r.error); return; }
    toast(`Profile "${name}" deleted`);
    render();
    return;
  }
  if (a === 'profile-rename') {
    const oldName = el.dataset.name;
    const newName = prompt('Rename profile to:', oldName);
    if (newName == null) return;
    const r = Storage.renameProfile(oldName, newName);
    if (!r.ok) { toast(r.error); return; }
    toast(`Renamed to "${newName}"`);
    updateProfileChip();
    render();
    return;
  }
  if (a === 'profile-reset') {
    const name = el.dataset.name;
    if (!confirm(`Reset all progress for "${name}"? Attempts, bookmarks, and history will be cleared. The profile itself stays.`)) return;
    Storage.clearProfileData(name);
    toast('Progress reset');
    SOL_CACHE_CLEAR();
    render();
    return;
  }
}

/* Reset the in-memory solutions cache (used after profile switch). */
function SOL_CACHE_CLEAR() {
  for (const k in SOL_CACHE) delete SOL_CACHE[k];
}

/* Refresh the topbar profile chip whenever the active profile may have changed. */
function updateProfileChip() {
  const name = Storage.getActiveProfile();
  const avatar = document.getElementById('profileAvatar');
  const label = document.getElementById('profileName');
  if (avatar) avatar.textContent = name.slice(0, 1).toUpperCase();
  if (label) label.textContent = name;
}
function currentTest() { return getTestById(state.testId); }

function saveCurrentQ() {
  const inp = document.getElementById('titaInput');
  if (inp) state.answers[state.currentQ] = { value: inp.value };
  if (state.qStartedAt) {
    const elapsed = Math.round((Date.now() - state.qStartedAt) / 1000);
    state.qTime[state.currentQ] = (state.qTime[state.currentQ] || 0) + elapsed;
    state.qStartedAt = Date.now();
  }
}

// Count how many questions in `test` have a non-empty answer in `answers`.
function countAttempted(test, answers) {
  let n = 0;
  for (const q of test.questions) {
    const a = answers && answers[q.n];
    if (a && a.value !== '' && a.value != null) n++;
  }
  return n;
}

function submitTest(opts = {}) {
  saveCurrentQ();
  const test = currentTest();
  if (!test) return;

  // If user clicked submit (not auto-timeout) and some questions are unanswered,
  // show a confirmation prompt before finalising. The user can go back and keep
  // working, or commit to submitting with skipped questions.
  const isAuto = !!opts.auto;
  const attempted = countAttempted(test, state.answers);
  const skipped = test.questions.length - attempted;
  if (!isAuto && !state.untimed && skipped > 0 && !opts.confirmed) {
    state.completionPrompt = { attempted, total: test.questions.length, skipped };
    // Hold the timer while the prompt is open
    stopTimer();
    render();
    return;
  }

  stopTimer();

  // Score against any solutions we have
  loadSolutions(state.testId).then(sols => {
    let correct = 0, wrong = 0, skipped = 0, score = 0;
    let max = 0;
    for (const q of test.questions) {
      max += q.marks_correct;
      const a = state.answers[q.n];
      if (!a || a.value === '' || a.value == null) { skipped++; continue; }
      if (sols && sols[q.n]) {
        if (checkCorrect(q, a.value, sols[q.n].answer)) { correct++; score += q.marks_correct; }
        else { wrong++; score -= effectiveNegative(q); }   // TITA penalty = 0
      } else {
        // No solution available — count as attempted but not scored
        skipped++; // treat as unscored for now
      }
    }
    const totalUsed = (test.timer_min * 60) - state.timerSeconds;
    const completed = {
      currentQ: state.currentQ,
      answers: state.answers,
      marked: Array.from(state.marked),
      qTime: state.qTime,
      timerLeft: state.timerSeconds,
      time_used: totalUsed,
      correct, wrong, skipped, score, max,
      attempted: correct + wrong,
      completed_at: Date.now(),
    };
    Storage.saveAttempt(state.testId, completed);
    Storage.setProgress(state.testId, 'completed');
    Storage.addHistory({
      test_id: state.testId,
      score, max, time_used: totalUsed,
      correct, wrong, skipped,
      completed_at: Date.now(),
    });
    state.view = 'results';
    location.hash = '#/results/' + encodeURIComponent(state.testId);
  });
}

function copyQuestion(testId, qNum) {
  const test = getTestById(testId);
  if (!test) return;
  const q = test.questions.find(x => x.n === qNum);
  if (!q) return;
  let txt = `Q${q.n} [${q.type.toUpperCase()}] +${q.marks_correct}/-${q.marks_negative}\n\n${q.stem_text || '[image-based question]'}\n`;
  if (q.type === 'mcq') {
    q.options.forEach((o, i) => {
      txt += `\n(${String.fromCharCode(65+i)}) ${o.text || '[image option]'}`;
    });
  } else {
    txt += `\n[Type-in answer]`;
  }
  navigator.clipboard.writeText(txt).then(() => toast('Copied to clipboard')).catch(() => toast('Copy failed'));
}

/* ============================================================
   TIMER
   ============================================================ */
function startTimer() {
  if (state.timerInterval) return;
  state.timerInterval = setInterval(() => {
    if (state.paused || state.untimed) return;
    state.timerSeconds = Math.max(0, state.timerSeconds - 1);
    if (state.timerSeconds === 0) {
      // Auto-submit — bypass the "are you sure" prompt; we're out of time
      submitTest({ auto: true });
      return;
    }
    if (state.view === 'runner') {
      const t = document.querySelector('.timer');
      if (t) {
        const m = Math.floor(state.timerSeconds / 60).toString().padStart(2, '0');
        const s = (state.timerSeconds % 60).toString().padStart(2, '0');
        t.lastChild.textContent = ` ${m}:${s} `;
        if (state.timerSeconds < 5 * 60) t.classList.add('warn');
      }
    }
    // Persist every 30 seconds
    if (state.timerSeconds % 30 === 0) persistAttempt();
  }, 1000);
}
function stopTimer() {
  if (state.timerInterval) clearInterval(state.timerInterval);
  state.timerInterval = null;
}

/* ============================================================
   THEME
   ============================================================ */
const themeBtn = document.getElementById('themeBtn');
themeBtn.addEventListener('click', () => {
  const cur = document.documentElement.getAttribute('data-theme');
  const next = cur === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  Storage.setSetting('theme', next);
});
const savedTheme = Storage.getSetting('theme', 'dark');
document.documentElement.setAttribute('data-theme', savedTheme);

/* ============================================================
   BOOT
   ============================================================ */
async function boot() {
  updateProfileChip();   // show the active profile name in the topbar immediately, even before data loads
  try {
    const r = await fetch('data/questions.json');
    DATA = await r.json();
  } catch (e) {
    $app.innerHTML = `<p style="padding:40px;color:var(--neg)">Failed to load question data: ${e.message}</p>`;
    return;
  }
  // Compatibility shim: the new hierarchical schema uses {sections: {Section: {Subtopic: [tests]}}}.
  // Existing helpers iterate DATA.topics — derive a flat .topics so they keep working.
  if (DATA.sections && !DATA.topics) {
    DATA.topics = {};
    for (const subtopics of Object.values(DATA.sections)) {
      for (const [topic, tests] of Object.entries(subtopics)) {
        DATA.topics[topic] = tests;
      }
    }
  }
  applyRoute();
  window.addEventListener('hashchange', applyRoute);
}
boot();

})();
