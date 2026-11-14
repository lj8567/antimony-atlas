'use strict';

/* =====================================================================
   Daily Six: six brain-training challenges a day, works offline.
   To make a day longer or shorter, change the numbers in CONFIG.
   ===================================================================== */

const CONFIG = {
  questionsPerDay: { probability: 3, smc: 3, gmat: 3 },
  nback: {
    blocks: 3,              // blocks per day
    baseTrials: 20,         // trials per block = baseTrials + n
    stimulusMs: 500,        // how long the square shows
    trialMs: 3000,          // time per trial
    targetsPerModality: 6,  // position matches per block (same for sound)
    bothTargets: 2,         // of those, trials where both match
    upAt: 80,               // both scores at or above this: n goes up
    downBelow: 50,          // either score below this: n goes down
    startN: 2,
  },
  maths: { seconds: 120, add: [2, 100], mulA: [2, 12], mulB: [2, 100] },
  memory: { digitMs: 700, gapMs: 300, strikes: 2, maxTrials: 14, startLen: 4 },
};

const CHALLENGES = [
  { id: 'nback', name: 'Dual n-back' },
  { id: 'maths', name: 'Mental maths' },
  { id: 'memory', name: 'Number memory' },
  { id: 'probability', name: 'Probability' },
  { id: 'smc', name: 'Senior maths' },
  { id: 'gmat', name: 'GMAT / LSAT' },
];
const BANK_CATS = ['probability', 'smc', 'gmat'];
const CAT_NAME = { probability: 'Probability', smc: 'Senior maths', gmat: 'GMAT / LSAT' };
const LETTERS = ['C', 'H', 'K', 'L', 'Q', 'R', 'S', 'T'];
const GRID_POS = [0, 1, 2, 3, 5, 6, 7, 8]; // 3x3 grid without the centre
const CHOICE_LETTERS = 'ABCDEF';

/* ---------- DOM helpers ---------- */
const app = document.getElementById('app');
const tabsEl = document.getElementById('tabs');
const SVGNS = 'http://www.w3.org/2000/svg';

function addKids(el, kids) {
  for (const kid of kids.flat(Infinity)) {
    if (kid == null || kid === false) continue;
    el.append(kid instanceof Node ? kid : document.createTextNode(String(kid)));
  }
}
function h(tag, props, ...kids) {
  const el = document.createElement(tag);
  if (props) for (const [k, v] of Object.entries(props)) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v === true ? '' : v);
  }
  addKids(el, kids);
  return el;
}
function s(tag, attrs, ...kids) {
  const el = document.createElementNS(SVGNS, tag);
  if (attrs) for (const [k, v] of Object.entries(attrs)) if (v != null) el.setAttribute(k, v);
  addKids(el, kids);
  return el;
}

const ICONS = {
  today: ['M3.5 3h7v5h-7z', 'M13.5 3h7v5h-7z', 'M3.5 9.5h7v5h-7z', 'M13.5 9.5h7v5h-7z', 'M3.5 16h7v5h-7z', 'M13.5 16h7v5h-7z'],
  history: ['M4 5.5h16v15H4z', 'M4 10h16', 'M8.5 3v4', 'M15.5 3v4'],
  progress: ['M3.5 20h17', 'M4.5 15.5l5-5.5 4 3.5 6.5-8'],
  settings: ['M4 7h9', 'M17 7h3', 'M15 4.5v5', 'M4 17h3', 'M11 17h9', 'M9 14.5v5'],
  close: ['M6 6l12 12', 'M18 6L6 18'],
  left: ['M15 5l-7 7 7 7'],
  right: ['M9 5l7 7-7 7'],
  del: ['M9 5.5h11v13H9l-6-6.5z', 'M12.5 9.5l5 5', 'M17.5 9.5l-5 5'],
};
function icon(paths, cls = 'ico') {
  return s('svg', { viewBox: '0 0 24 24', class: cls, 'aria-hidden': 'true' }, paths.map(d => s('path', { d })));
}
// Red-pen marks: shape carries the meaning, so they work without colour.
function tick(animate) {
  return s('svg', { viewBox: '0 0 30 30', class: 'mark' + (animate ? ' draw' : ''), role: 'img', 'aria-label': 'Correct' },
    s('path', { class: 'pen', d: 'M5 16.5c2.6 1.9 4.6 4.2 6.3 7.3C14.6 15.2 19 9.2 25.5 4.5' }));
}
function cross() {
  return s('svg', { viewBox: '0 0 30 30', class: 'mark', role: 'img', 'aria-label': 'Wrong' },
    s('path', { class: 'pen', d: 'M7 7.5c5.5 4.6 10.5 10 16 15.5' }),
    s('path', { class: 'pen', d: 'M23 6.5C17.5 12 12.2 17.6 6.5 23.5' }));
}

function renderMath(el) {
  if (!window.renderMathInElement) return;
  try {
    window.renderMathInElement(el, {
      delimiters: [{ left: '\\[', right: '\\]', display: true }, { left: '\\(', right: '\\)', display: false }],
      throwOnError: false,
    });
  } catch (e) { /* show raw text if KaTeX fails */ }
}

/* ---------- Dates (local time, keys like 2026-11-14) ---------- */
const pad = n => String(n).padStart(2, '0');
const keyOf = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const todayKey = () => keyOf(new Date());
const dateOf = k => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d); };
const addDays = (k, n) => { const d = dateOf(k); d.setDate(d.getDate() + n); return keyOf(d); };
const daysBetween = (a, b) => Math.round((dateOf(b) - dateOf(a)) / 864e5);
const fmt = (k, opts) => dateOf(k).toLocaleDateString('en-GB', opts);
const shiftMonth = (ym, n) => { const [y, m] = ym.split('-').map(Number); const d = new Date(y, m - 1 + n, 1); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`; };
const clock = sec => { const t = Math.max(0, sec); return `${Math.floor(t / 60)}:${pad(t % 60)}`; };
const fmtN = v => { const r = Math.round(v * 10) / 10; return Number.isInteger(r) ? String(r) : r.toFixed(1); };
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

/* ---------- Seeded randomness (same questions all day) ---------- */
function hash32(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
function mulberry32(a) {
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rngFor = (...parts) => mulberry32(hash32(parts.join('|')));
const randInt = (rng, n) => Math.floor(rng() * n);
function shuffle(arr, rng) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

/* ---------- Saved data ---------- */
const STORE_KEY = 'dailysix.v1';
function freshState() {
  return { v: 1, days: {}, levels: { nback: CONFIG.nback.startN, memory: CONFIG.memory.startLen }, seen: {}, settings: { sound: 'voice' } };
}
function mergeState(raw) {
  const st = freshState();
  return {
    ...st, ...raw,
    levels: { ...st.levels, ...(raw.levels || {}) },
    settings: { ...st.settings, ...(raw.settings || {}) },
    days: raw.days || {}, seen: raw.seen || {},
  };
}
function loadState() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORE_KEY));
    if (raw && raw.v === 1) return mergeState(raw);
  } catch (e) { /* fall through */ }
  return freshState();
}
let state = loadState();
function save() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); }
  catch (e) { toast('Couldn’t save. Phone storage may be full.'); }
}

function dayRec(k, create) {
  if (!state.days[k]) { if (!create) return null; state.days[k] = { results: {}, picks: {} }; }
  const d = state.days[k];
  d.results = d.results || {}; d.picks = d.picks || {};
  return d;
}
const result = (k, id) => state.days[k]?.results?.[id];
const isDone = (k, id) => !!result(k, id)?.done;
const dayDoneCount = k => CHALLENGES.filter(c => isDone(k, c.id)).length;
const dayComplete = k => dayDoneCount(k) === CHALLENGES.length;
function currentStreak() {
  let k = todayKey();
  if (!dayComplete(k)) k = addDays(k, -1);
  let n = 0;
  while (dayComplete(k)) { n++; k = addDays(k, -1); }
  return n;
}
function bestStreak() {
  let best = 0, run = 0, prev = null;
  for (const k of Object.keys(state.days).filter(dayComplete).sort()) {
    run = prev && addDays(prev, 1) === k ? run + 1 : 1;
    best = Math.max(best, run); prev = k;
  }
  return best;
}
function bestOf(id, get) {
  let best = null;
  for (const d of Object.values(state.days)) {
    const r = d.results?.[id];
    if (r?.done) { const v = get(r); if (best == null || v > best) best = v; }
  }
  return best;
}

/* ---------- Question bank ---------- */
let BANK = { probability: [], smc: [], gmat: [] };
let BANK_BY_ID = new Map();
let BANK_ERRORS = [];
let BANK_STATUS = 'loading';
let bankWaiters = [];

async function loadBank() {
  try {
    const res = await fetch('questions.json');
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    ingestBank(Array.isArray(data) ? data : data.questions);
    BANK_STATUS = 'ready';
  } catch (e) {
    BANK_STATUS = 'error';
    BANK_ERRORS = [`Couldn’t read questions.json (${e.message}).`];
  }
  const waiting = bankWaiters; bankWaiters = [];
  waiting.forEach(fn => fn());
  if (!route.challenge) render();
}
function ingestBank(list) {
  const out = { probability: [], smc: [], gmat: [] }, byId = new Map(), errs = [];
  if (!Array.isArray(list)) { errs.push('questions.json needs a "questions" list.'); list = []; }
  list.forEach((q, i) => {
    const problem = checkQuestion(q, byId);
    if (problem) { errs.push(`${q && q.id ? q.id : `Item ${i + 1}`}: ${problem}`); return; }
    out[q.category].push(q); byId.set(q.id, q);
  });
  BANK = out; BANK_BY_ID = byId; BANK_ERRORS = errs;
}
function checkQuestion(q, byId) {
  if (!q || typeof q !== 'object') return 'not a question object';
  if (typeof q.id !== 'string' || !q.id.trim()) return 'missing id';
  if (byId.has(q.id)) return 'duplicate id';
  if (!BANK_CATS.includes(q.category)) return `category must be ${BANK_CATS.join(', ')}`;
  if (typeof q.prompt !== 'string' || !q.prompt.trim()) return 'missing prompt';
  if (q.choices != null) {
    if (!Array.isArray(q.choices) || q.choices.length < 2 || q.choices.length > 6 || !q.choices.every(c => typeof c === 'string')) return 'choices must be 2 to 6 pieces of text';
    const idx = CHOICE_LETTERS.indexOf(String(q.answer).toUpperCase());
    if (idx < 0 || idx >= q.choices.length) return 'answer must be one of the choice letters';
  } else if (q.answer == null || String(q.answer).trim() === '') return 'missing answer';
  return null;
}
// Unseen questions first (in a fixed order for the day), then ones you got wrong, oldest first.
function pickQuestions(cat, k) {
  const day = dayRec(k, true);
  if (day.picks[cat]?.length) return day.picks[cat];
  const pool = BANK[cat], want = CONFIG.questionsPerDay[cat];
  let chosen = shuffle(pool.filter(q => !state.seen[q.id]), rngFor(k, cat)).slice(0, want);
  if (chosen.length < want) {
    const rest = pool.filter(q => state.seen[q.id]).sort((a, b) => {
      const A = state.seen[a.id], B = state.seen[b.id];
      return (A.correct - B.correct) || (A.last < B.last ? -1 : A.last > B.last ? 1 : 0);
    });
    chosen = chosen.concat(rest.slice(0, want - chosen.length));
  }
  day.picks[cat] = chosen.map(q => q.id);
  save();
  return day.picks[cat];
}
function parseNumber(str) {
  let t = String(str).trim().replace(/[−–]/g, '-').replace(/,/g, '').replace(/\s+/g, '');
  let pct = false;
  if (t.endsWith('%')) { pct = true; t = t.slice(0, -1); }
  let v = null, m;
  if ((m = t.match(/^(-?\d*\.?\d+)\/(-?\d*\.?\d+)$/))) { const d = parseFloat(m[2]); if (d !== 0) v = parseFloat(m[1]) / d; }
  else if (/^-?(\d+\.?\d*|\.\d+)$/.test(t)) v = parseFloat(t);
  if (v === null || !isFinite(v)) return null;
  return pct ? v / 100 : v;
}
const norm = x => String(x).trim().toLowerCase().replace(/\s+/g, ' ');
// Exact values match; decimals with 3+ significant figures match if right to the last digit typed.
function checkFree(q, given) {
  const answers = [q.answer, ...(Array.isArray(q.accept) ? q.accept : [])].map(String);
  const v = parseNumber(given);
  for (const a of answers) {
    const t = parseNumber(a);
    if (t !== null && v !== null) {
      if (Math.abs(v - t) <= 1e-9 * Math.max(1, Math.abs(t))) return true;
      const m = String(given).trim().replace(/[−–]/g, '-').match(/^-?(\d*)\.(\d+)$/);
      if (m) {
        const sig = (m[1] + m[2]).replace(/^0+/, '').length;
        if (sig >= 3 && Math.abs(v - t) < Math.pow(10, -m[2].length)) return true;
      }
    } else if (t === null && norm(a) === norm(given)) return true;
  }
  return false;
}
function shortPrompt(p, max = 120) {
  const t = p.split('\n')[0];
  if (t.length <= max) return t;
  let cut = t.lastIndexOf(' ', max);
  if (cut < 40) cut = max;
  let out = t.slice(0, cut);
  const opens = (out.match(/\\\(/g) || []).length, closes = (out.match(/\\\)/g) || []).length;
  if (opens > closes) { const j = t.indexOf('\\)', cut); if (j >= 0) out = t.slice(0, j + 2); }
  return out + '…';
}

/* ---------- Sound for n-back ---------- */
const Sound = {
  ctx: null, voice: null,
  init() {
    try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch (e) { /* older iOS */ }
    if (!('speechSynthesis' in window)) return;
    const pick = () => {
      const vs = speechSynthesis.getVoices();
      this.voice = vs.find(v => v.lang === 'en-GB' && v.localService) || vs.find(v => v.lang === 'en-GB') || vs.find(v => /^en/.test(v.lang)) || null;
    };
    pick();
    speechSynthesis.addEventListener?.('voiceschanged', pick);
  },
  mode() { return state.settings.sound === 'tones' || !('speechSynthesis' in window) ? 'tones' : 'voice'; },
  unlock() { // must run inside a tap so iOS allows sound
    try {
      if (!this.ctx) this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      if (this.ctx.state === 'suspended') this.ctx.resume();
      const b = this.ctx.createBuffer(1, 1, 22050), src = this.ctx.createBufferSource();
      src.buffer = b; src.connect(this.ctx.destination); src.start(0);
    } catch (e) { /* no Web Audio */ }
    if (this.mode() === 'voice') { try { const u = new SpeechSynthesisUtterance(' '); u.volume = 0; speechSynthesis.speak(u); } catch (e) { /* ignore */ } }
  },
  play(i) {
    if (this.mode() === 'voice') {
      try {
        const u = new SpeechSynthesisUtterance(LETTERS[i]);
        if (this.voice) u.voice = this.voice;
        u.lang = this.voice?.lang || 'en-GB'; u.rate = 1.05;
        speechSynthesis.speak(u);
        return;
      } catch (e) { /* fall back to tones */ }
    }
    this.tone(i);
  },
  tone(i) {
    if (!this.ctx) return;
    const f = [262, 294, 330, 392, 440, 523, 587, 659][i];
    const t = this.ctx.currentTime, o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = 'sine'; o.frequency.value = f;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.35, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.42);
    o.connect(g).connect(this.ctx.destination); o.start(t); o.stop(t + 0.45);
  },
  stop() { try { speechSynthesis.cancel(); } catch (e) { /* ignore */ } },
};

let wakeLock = null;
async function requestWake() { try { if ('wakeLock' in navigator) wakeLock = await navigator.wakeLock.request('screen'); } catch (e) { /* not allowed */ } }
function releaseWake() { try { wakeLock?.release(); } catch (e) { /* ignore */ } wakeLock = null; }

/* ---------- Small UI pieces ---------- */
let toastTimer;
function toast(msg) {
  document.querySelector('.toast')?.remove();
  const t = h('div', { class: 'toast', role: 'status' }, msg);
  document.body.append(t);
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.remove(), 2600);
}
function sheet({ title, text, confirm, cancel = 'Cancel', danger, onConfirm }) {
  const close = () => scrim.remove();
  const scrim = h('div', { class: 'scrim', onclick: e => { if (e.target === scrim) close(); } },
    h('div', { class: 'sheet', role: 'dialog', 'aria-modal': 'true', 'aria-label': title },
      h('h2', {}, title), text ? h('p', {}, text) : null,
      h('div', { class: 'stack' },
        h('button', { class: danger ? 'danger-btn' : 'primary', onclick: () => { close(); onConfirm(); } }, confirm),
        h('button', { class: 'secondary-btn', onclick: close }, cancel))));
  document.body.append(scrim);
  scrim.querySelector('button').focus();
}
function keypad(keys, onKey, cols) {
  const labels = { del: icon(ICONS.del), skip: 'Skip', enter: 'Enter', check: 'Check', neg: '−' };
  const pad = h('div', { class: `keypad cols-${cols}` });
  for (const k of keys) {
    const cls = k === 'enter' || k === 'check' ? 'key go' : k === 'skip' || k === 'del' ? 'key fn' : 'key';
    const b = h('button', { class: cls, 'aria-label': k === 'del' ? 'Delete' : null, 'data-key': k }, labels[k] ?? k);
    const up = () => b.classList.remove('down');
    b.addEventListener('pointerdown', e => { e.preventDefault(); b.classList.add('down'); onKey(k); });
    b.addEventListener('pointerup', up); b.addEventListener('pointerleave', up); b.addEventListener('pointercancel', up);
    b.addEventListener('click', e => { if (e.detail === 0) onKey(k); }); // keyboard activation
    pad.append(b);
  }
  return pad;
}

/* ---------- Navigation ---------- */
let route = { tab: 'today' };
let cleanup = null;
let justDone = null;
const hist = { month: null, sel: null, open: null };
const prog = { range: 30, table: false };

function go(tab) { route = { tab }; render(); window.scrollTo(0, 0); }
function render() {
  document.body.classList.toggle('in-challenge', !!route.challenge);
  if (route.challenge) return;
  tabsEl.querySelectorAll('button').forEach(b => {
    if (b.dataset.tab === route.tab) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
  });
  const views = { today: viewToday, history: viewHistory, progress: viewProgress, settings: viewSettings };
  app.replaceChildren(views[route.tab]());
  renderMath(app);
  if (route.tab === 'progress') drawCharts();
  justDone = null;
}
function buildTabs() {
  const items = [['today', 'Today'], ['history', 'History'], ['progress', 'Progress'], ['settings', 'Settings']];
  tabsEl.replaceChildren(...items.map(([id, label]) => h('button', { 'data-tab': id, onclick: () => go(id) }, icon(ICONS[id]), label)));
}
function openChallenge(id) {
  const k = todayKey();
  if (isDone(k, id)) { hist.sel = k; hist.month = k.slice(0, 7); hist.open = id; go('history'); return; }
  route = { challenge: id, tab: 'today' };
  document.body.classList.add('in-challenge');
  window.scrollTo(0, 0);
  ({ nback: runNback, maths: runMaths, memory: runMemory }[id] || runBank)(k, id);
}
function exitChallenge(completedId) {
  if (cleanup) { try { cleanup(); } catch (e) { /* ignore */ } cleanup = null; }
  releaseWake();
  route = { tab: 'today' };
  justDone = completedId || null; // the red tick draws itself once on the cell just finished
  render();
  window.scrollTo(0, 0);
}
function shell(title) {
  const ui = { onClose: () => exitChallenge() };
  ui.meta = h('div', { class: 'ch-meta' });
  ui.body = h('div', { class: 'ch-body' });
  ui.root = h('section', { class: 'challenge', 'aria-label': title },
    h('header', { class: 'ch-head' },
      h('button', { class: 'icon-btn', 'aria-label': 'Close', onclick: () => ui.onClose() }, icon(ICONS.close)),
      h('h1', { class: 'ch-title' }, title), ui.meta),
    ui.body);
  app.replaceChildren(ui.root);
  return ui;
}
function confirmQuit() {
  sheet({ title: 'Stop this challenge?', text: 'This attempt won’t be saved. You can start it again from Today.', confirm: 'Stop', cancel: 'Keep going', danger: true, onConfirm: () => exitChallenge() });
}
function resultScreen(ui, { lead, unit, extra, list, id }) {
  ui.meta.textContent = '';
  ui.onClose = () => exitChallenge(id);
  ui.body.replaceChildren(
    h('div', { class: 'result-screen' },
      h('div', { class: 'lead' }, lead), h('div', { class: 'unit' }, unit),
      extra ? h('p', { class: 'extra' }, extra) : null, list || null),
    h('button', { class: 'primary', onclick: () => exitChallenge(id) }, 'Done'));
}

/* ---------- Today ---------- */
function viewToday() {
  const k = todayKey(), streak = currentStreak(), done = dayDoneCount(k);
  let streakText = 'Finish all six to start a streak.';
  if (streak && dayComplete(k)) streakText = `${streak}-day streak`;
  else if (streak) streakText = `${streak}-day streak. Finish today to make it ${streak + 1}.`;
  return h('div', {},
    h('header', { class: 'today-head' },
      h('div', { class: 'weekday' }, fmt(k, { weekday: 'long' })),
      h('div', { class: 'date' }, fmt(k, { day: 'numeric', month: 'long' })),
      h('p', { class: 'streak' }, streakText)),
    h('div', { class: 'day-grid' }, CHALLENGES.map(c => cellFor(c, k))),
    h('p', { class: 'day-foot' }, done === CHALLENGES.length ? 'All six done. New challenges at midnight.' : `${done} of 6 done`));
}
function cellFor(c, k) {
  const r = result(k, c.id), done = !!r?.done;
  const kids = [h('span', { class: 'name' }, c.name)];
  if (done) {
    const sm = summaryOf(c.id, r);
    kids.push(h('span', { class: 'result' }, h('span', { class: 'big' }, sm.big), h('span', { class: 'unit' }, sm.unit)), tick(justDone === c.id));
  } else {
    kids.push(h('span', { class: 'blurb' }, blurbOf(c.id, r)), h('span', { class: 'go' }, r?.items?.length ? 'Continue' : 'Start'));
  }
  return h('button', { class: 'cell', onclick: () => openChallenge(c.id) }, kids);
}
function summaryOf(id, r) {
  switch (id) {
    case 'nback': return { big: fmtN(r.avgN), unit: `average n, ${r.avgPct}% right` };
    case 'maths': return { big: String(r.score), unit: `correct in ${r.seconds / 60} min` };
    case 'memory': return { big: String(r.span), unit: r.span === 1 ? 'digit' : 'digits' };
    default: return { big: `${r.correct}/${r.total}`, unit: 'correct' };
  }
}
function blurbOf(id, r) {
  switch (id) {
    case 'nback': return [`${CONFIG.nback.blocks} blocks, starting at `, h('span', { class: 'nowrap' }, `${state.levels.nback}-back`)];
    case 'maths': return `${CONFIG.maths.seconds / 60}-minute arithmetic sprint`;
    case 'memory': return `Starting at ${state.levels.memory} digits`;
    default: {
      const n = CONFIG.questionsPerDay[id], a = r?.items?.length || 0;
      if (BANK_STATUS === 'ready' && !BANK[id].length) return 'No questions in the bank yet';
      return a ? `${a} of ${n} answered` : `${n} questions`;
    }
  }
}

/* ---------- Challenge: dual n-back ---------- */
function genNback(n, rng) {
  const C = CONFIG.nback, T = C.baseTrials + n;
  const order = shuffle(Array.from({ length: T - n }, (_, i) => i + n), rng);
  const both = C.bothTargets, only = C.targetsPerModality - both;
  const vT = new Array(T).fill(false), aT = new Array(T).fill(false);
  order.slice(0, both).forEach(i => { vT[i] = true; aT[i] = true; });
  order.slice(both, both + only).forEach(i => { vT[i] = true; });
  order.slice(both + only, both + 2 * only).forEach(i => { aT[i] = true; });
  const other = x => { let y; do { y = randInt(rng, 8); } while (y === x); return y; };
  const pos = [], snd = [];
  for (let i = 0; i < T; i++) {
    pos[i] = i < n ? randInt(rng, 8) : vT[i] ? pos[i - n] : other(pos[i - n]);
    snd[i] = i < n ? randInt(rng, 8) : aT[i] ? snd[i - n] : other(snd[i - n]);
  }
  return { n, T, pos, snd, vT, aT };
}
function scoreMod(targets, presses, n, T) {
  let hit = 0, miss = 0, fa = 0;
  for (let i = n; i < T; i++) {
    if (targets[i] && presses[i]) hit++;
    else if (targets[i]) miss++;
    else if (presses[i]) fa++;
  }
  return { hit, miss, fa, pct: Math.round(100 * hit / Math.max(1, hit + miss + fa)) };
}
function runNback(k) {
  const C = CONFIG.nback;
  let n = state.levels.nback, timers = [], running = false, note = '', keyHandler = null;
  const blocks = [];
  const ui = shell('Dual n-back');
  ui.onClose = () => (running || blocks.length ? confirmQuit() : exitChallenge());
  const clearTimers = () => { timers.forEach(clearTimeout); timers = []; };
  const onVis = () => {
    if (document.hidden && running) {
      clearTimers(); running = false; Sound.stop();
      note = 'That block stopped when the app went into the background. Start it again.';
      intro();
    }
  };
  const onKey = e => keyHandler && keyHandler(e);
  document.addEventListener('visibilitychange', onVis);
  document.addEventListener('keydown', onKey);
  cleanup = () => { clearTimers(); Sound.stop(); document.removeEventListener('visibilitychange', onVis); document.removeEventListener('keydown', onKey); };

  function blockSummary(b) {
    const next = b.next > b.n ? `Up to ${b.next}-back` : b.next < b.n ? `Down to ${b.next}-back` : `Staying at ${b.n}-back`;
    return h('dl', { class: 'block-scores' },
      h('dt', {}, `Block ${blocks.length}`), h('dd', {}, `${b.n}-back`),
      h('dt', {}, 'Position'), h('dd', {}, `${b.v.pct}%`),
      h('dt', {}, 'Sound'), h('dd', {}, `${b.a.pct}%`),
      h('dt', {}, 'Next'), h('dd', {}, next));
  }
  function intro() {
    keyHandler = null;
    ui.meta.textContent = `Block ${blocks.length + 1} of ${C.blocks}`;
    const what = Sound.mode() === 'voice' ? 'letter' : 'tone';
    ui.body.replaceChildren(
      h('div', { class: 'intro' },
        blocks.length ? blockSummary(blocks[blocks.length - 1]) : null,
        h('div', { class: 'lead' }, `${n}-back`),
        h('p', {}, `Tap Position when the square is where it was ${n} ${n === 1 ? 'step' : 'steps'} back. Tap Sound when the ${what} matches the one ${n} back. A trial can match on both, one or neither.`),
        note ? h('p', { class: 'note' }, note) : null),
      h('button', { class: 'primary', onclick: startBlock }, blocks.length ? `Start block ${blocks.length + 1}` : 'Start'));
    note = '';
  }
  function startBlock() {
    Sound.unlock(); requestWake();
    const seq = genNback(n, rngFor(k, 'nback', blocks.length, Date.now()));
    const pv = new Array(seq.T).fill(false), pa = new Array(seq.T).fill(false);
    let cur = -1;
    const cells = Array.from({ length: 9 }, (_, i) => h('div', { class: i === 4 ? 'nb-cell nb-center' : 'nb-cell' }));
    const prog = h('div', { class: 'nb-progress' }, `Get ready`);
    const bV = h('button', { class: 'nb-btn' }, 'Position');
    const bA = h('button', { class: 'nb-btn' }, 'Sound');
    const press = kind => {
      if (cur < seq.n) return;
      const arr = kind === 'v' ? pv : pa;
      if (arr[cur]) return;
      arr[cur] = true;
      const btn = kind === 'v' ? bV : bA;
      btn.classList.add('pressed');
      btn.append((kind === 'v' ? seq.vT[cur] : seq.aT[cur]) ? tick() : cross());
    };
    for (const [btn, kind] of [[bV, 'v'], [bA, 'a']]) {
      btn.addEventListener('pointerdown', e => { e.preventDefault(); press(kind); });
      btn.addEventListener('click', e => { if (e.detail === 0) press(kind); });
    }
    keyHandler = e => { const key = e.key.toLowerCase(); if (key === 'a') press('v'); if (key === 'l') press('a'); };
    ui.body.replaceChildren(
      h('div', { class: 'nb-wrap' }, prog, h('div', { class: 'nb-grid', 'aria-hidden': 'true' }, cells)),
      h('div', { class: 'nb-buttons' }, bV, bA));
    running = true;
    const t0 = performance.now() + 800;
    const at = (ms, fn) => timers.push(setTimeout(fn, Math.max(0, ms - performance.now())));
    const onset = i => {
      cur = i;
      for (const b of [bV, bA]) { b.classList.remove('pressed'); b.querySelector('.mark')?.remove(); }
      const cell = cells[GRID_POS[seq.pos[i]]];
      cell.classList.add('on');
      Sound.play(seq.snd[i]);
      prog.textContent = `${i + 1} of ${seq.T}`;
      at(t0 + i * C.trialMs + C.stimulusMs, () => cell.classList.remove('on'));
      at(t0 + (i + 1) * C.trialMs, i + 1 < seq.T ? () => onset(i + 1) : finishBlock);
    };
    const finishBlock = () => {
      running = false; cur = -1; keyHandler = null;
      const v = scoreMod(seq.vT, pv, seq.n, seq.T), a = scoreMod(seq.aT, pa, seq.n, seq.T);
      const lo = Math.min(v.pct, a.pct);
      const next = lo >= C.upAt ? n + 1 : lo < C.downBelow ? Math.max(1, n - 1) : n;
      blocks.push({ n, v, a, next });
      n = next;
      if (blocks.length < C.blocks) intro(); else finishAll();
    };
    at(t0, () => onset(0));
  }
  function finishAll() {
    releaseWake();
    const avgN = blocks.reduce((t, b) => t + b.n, 0) / blocks.length;
    const avgPct = Math.round(blocks.reduce((t, b) => t + (b.v.pct + b.a.pct) / 2, 0) / blocks.length);
    state.levels.nback = n;
    dayRec(k, true).results.nback = { done: true, at: Date.now(), blocks, avgN: Math.round(avgN * 100) / 100, avgPct, maxN: Math.max(...blocks.map(b => b.n)), endN: n };
    save();
    resultScreen(ui, { lead: fmtN(avgN), unit: 'average n-back level', extra: [`${avgPct}% right across ${blocks.length} blocks. Tomorrow starts at `, h('span', { class: 'nowrap' }, `${n}-back`), '.'], id: 'nback' });
  }
  intro();
}

/* ---------- Challenge: mental maths ---------- */
function runMaths(k) {
  const C = CONFIG.maths;
  let score = 0, skipped = 0, prob = null, input = '', endAt = 0, raf = 0, running = false;
  let probEl, entryEl, bar;
  const ui = shell('Mental maths');
  ui.onClose = () => (running ? confirmQuit() : exitChallenge());
  const onKeyDown = e => {
    if (!running) return;
    if (/^\d$/.test(e.key)) key(e.key);
    else if (e.key === 'Backspace') key('del');
    else if (e.key === 'Enter') key('skip');
  };
  document.addEventListener('keydown', onKeyDown);
  cleanup = () => { cancelAnimationFrame(raf); running = false; document.removeEventListener('keydown', onKeyDown); };
  const best = bestOf('maths', r => r.score);
  ui.body.replaceChildren(
    h('div', { class: 'intro' },
      h('div', { class: 'lead' }, `${C.seconds / 60} minutes`),
      h('p', {}, 'Answer as many as you can. Correct answers move on by themselves. Tap Skip if you’re stuck.'),
      h('p', { class: 'note' }, `Adding and subtracting numbers up to ${C.add[1]}, multiplying and dividing up to ${C.mulA[1]} × ${C.mulB[1]}.${best != null ? ` Your best is ${best}.` : ''}`)),
    h('button', { class: 'primary', onclick: start }, 'Start'));

  function newProblem() {
    const R = ([a, b]) => a + Math.floor(Math.random() * (b - a + 1));
    let text, ans;
    do {
      const op = '+−×÷'[Math.floor(Math.random() * 4)];
      const a = op === '+' || op === '−' ? R(C.add) : R(C.mulA);
      const b = op === '+' || op === '−' ? R(C.add) : R(C.mulB);
      if (op === '+') { text = `${a} + ${b}`; ans = a + b; }
      else if (op === '−') { text = `${a + b} − ${a}`; ans = b; }
      else if (op === '×') { text = `${a} × ${b}`; ans = a * b; }
      else { text = `${a * b} ÷ ${a}`; ans = b; }
    } while (prob && text === prob.text);
    prob = { text, ans: String(ans) };
    probEl.textContent = text;
    input = '';
    paint();
  }
  function paint() {
    entryEl.textContent = input;
    entryEl.classList.toggle('wrong', input.length >= prob.ans.length && input !== prob.ans);
  }
  function key(kv) {
    if (!running) return;
    if (kv === 'skip') { skipped++; newProblem(); return; }
    if (kv === 'del') input = input.slice(0, -1);
    else if (input.length < 6) input += kv;
    if (input === prob.ans) { score++; newProblem(); return; }
    paint();
  }
  function start() {
    requestWake();
    probEl = h('div', { class: 'problem', 'aria-live': 'polite' });
    entryEl = h('div', { class: 'entry caret', 'aria-label': 'Your answer' });
    bar = h('div');
    ui.body.replaceChildren(
      h('div', { class: 'timebar' }, bar),
      h('div', { class: 'stage' }, probEl, entryEl),
      keypad(['1', '2', '3', '4', '5', '6', '7', '8', '9', 'skip', '0', 'del'], key, 3));
    running = true;
    endAt = performance.now() + C.seconds * 1000;
    newProblem();
    tickClock();
  }
  function tickClock() {
    if (!running) return;
    const left = Math.max(0, endAt - performance.now());
    ui.meta.textContent = clock(Math.ceil(left / 1000));
    bar.style.transform = `scaleX(${left / (C.seconds * 1000)})`;
    if (left <= 0) { finish(); return; }
    raf = requestAnimationFrame(tickClock);
  }
  function finish() {
    running = false; releaseWake();
    const prevBest = bestOf('maths', r => r.score);
    dayRec(k, true).results.maths = { done: true, at: Date.now(), score, skipped, seconds: C.seconds };
    save();
    const notes = [];
    if (skipped) notes.push(`${skipped} skipped.`);
    if (prevBest != null) notes.push(score > prevBest ? `New best. The old one was ${prevBest}.` : `Your best is ${prevBest}.`);
    resultScreen(ui, { lead: String(score), unit: `correct in ${C.seconds / 60} minutes`, extra: notes.join(' '), id: 'maths' });
  }
}

/* ---------- Challenge: number memory ---------- */
function runMemory(k) {
  const C = CONFIG.memory;
  let len = state.levels.memory, strikes = 0, best = 0, seq = '', input = '', phase = 'intro', timers = [];
  let key = () => {};
  const trials = [];
  const ui = shell('Number memory');
  ui.onClose = () => (phase === 'intro' ? exitChallenge() : confirmQuit());
  const onKeyDown = e => {
    if (phase !== 'input') return;
    if (/^\d$/.test(e.key)) key(e.key);
    else if (e.key === 'Backspace') key('del');
    else if (e.key === 'Enter') key('enter');
  };
  document.addEventListener('keydown', onKeyDown);
  cleanup = () => { timers.forEach(clearTimeout); document.removeEventListener('keydown', onKeyDown); };
  ui.body.replaceChildren(
    h('div', { class: 'intro' },
      h('div', { class: 'lead' }, `${len} digits`),
      h('p', {}, 'Digits appear one at a time. Type them back in the same order. Each correct answer adds a digit.'),
      h('p', { class: 'note' }, `The challenge ends after ${plural(C.strikes, 'mistake', 'mistakes')}.`)),
    h('button', { class: 'primary', onclick: () => { requestWake(); show(); } }, 'Start'));

  function makeSeq(n) {
    let out = '';
    while (out.length < n) {
      const d = String(Math.floor(Math.random() * 10));
      if (out.length >= 2 && out.at(-1) === d && out.at(-2) === d) continue;
      out += d;
    }
    return out;
  }
  function show() {
    phase = 'show'; seq = makeSeq(len); input = '';
    ui.meta.textContent = `${len} digits`;
    const digit = h('div', { class: 'digit' });
    const dots = h('div', { class: 'dots', 'aria-hidden': 'true' }, Array.from({ length: len }, () => h('span')));
    ui.body.replaceChildren(h('div', { class: 'stage' }, digit, dots));
    const t0 = performance.now() + 700;
    const at = (ms, fn) => timers.push(setTimeout(fn, Math.max(0, ms - performance.now())));
    [...seq].forEach((d, i) => {
      const startAt = t0 + i * (C.digitMs + C.gapMs);
      at(startAt, () => { digit.textContent = d; dots.children[i].classList.add('on'); });
      at(startAt + C.digitMs, () => { digit.textContent = ''; });
    });
    at(t0 + len * (C.digitMs + C.gapMs), ask);
  }
  function ask() {
    phase = 'input';
    const entry = h('div', { class: 'entry caret', 'aria-label': 'Your answer' });
    key = kv => {
      if (phase !== 'input') return;
      if (kv === 'enter') { if (input.length) check(); return; }
      if (kv === 'del') input = input.slice(0, -1);
      else if (input.length < len + 3) input += kv;
      entry.textContent = input;
    };
    ui.body.replaceChildren(
      h('div', { class: 'stage' }, h('p', { class: 'secondary' }, `Type the ${len} digits`), entry),
      keypad(['1', '2', '3', '4', '5', '6', '7', '8', '9', 'del', '0', 'enter'], kv => key(kv), 3));
  }
  function check() {
    phase = 'feedback';
    const ok = input === seq;
    trials.push({ len, ok });
    if (ok) {
      best = Math.max(best, len);
      ui.body.replaceChildren(h('div', { class: 'stage' }, h('div', { class: 'verdict' }, tick(), 'Correct'), h('div', { class: 'compare' }, seq)));
      len++;
      timers.push(setTimeout(trials.length >= C.maxTrials ? finish : show, 900));
      return;
    }
    strikes++;
    const over = strikes >= C.strikes || trials.length >= C.maxTrials;
    const yours = [...input].map((d, i) => h('span', { class: seq[i] === d ? null : 'bad' }, d));
    ui.body.replaceChildren(
      h('div', { class: 'stage' },
        h('div', { class: 'verdict' }, cross(), over ? 'Not quite. That’s the last try.' : `Not quite. ${plural(C.strikes - strikes, 'mistake', 'mistakes')} left.`),
        h('p', { class: 'secondary small' }, 'It was'), h('div', { class: 'compare' }, seq),
        h('p', { class: 'secondary small' }, 'You typed'), h('div', { class: 'compare' }, yours)),
      h('button', { class: 'primary', onclick: over ? finish : show }, over ? 'See result' : `Try ${len} digits again`));
  }
  function finish() {
    phase = 'done'; releaseWake();
    const prevBest = bestOf('memory', r => r.span);
    state.levels.memory = Math.max(3, (best || len) - 1);
    dayRec(k, true).results.memory = { done: true, at: Date.now(), span: best, trials };
    save();
    const notes = [`Tomorrow starts at ${state.levels.memory} digits.`];
    if (prevBest != null) notes.unshift(best > prevBest ? `New best. The old one was ${prevBest}.` : `Your best is ${prevBest}.`);
    resultScreen(ui, { lead: String(best), unit: best === 1 ? 'digit, the longest string you recalled' : 'digits, the longest string you recalled', extra: notes.join(' '), id: 'memory' });
  }
}

/* ---------- Challenge: question bank (probability, senior maths, GMAT/LSAT) ---------- */
function runBank(k, cat) {
  const ui = shell(CAT_NAME[cat]);
  let clockTimer = 0, keyHandler = null;
  const onKeyDown = e => keyHandler && keyHandler(e);
  document.addEventListener('keydown', onKeyDown);
  cleanup = () => { clearInterval(clockTimer); document.removeEventListener('keydown', onKeyDown); };

  if (BANK_STATUS !== 'ready') {
    ui.body.replaceChildren(h('div', { class: 'intro' }, h('p', {}, BANK_STATUS === 'loading'
      ? 'Loading questions…'
      : 'Questions couldn’t be loaded. Open the app once with a connection, then try again.')));
    if (BANK_STATUS === 'loading') bankWaiters.push(() => { if (route.challenge === cat) { cleanup(); runBank(k, cat); } });
    return;
  }
  const ids = pickQuestions(cat, k);
  if (!ids.length) {
    ui.body.replaceChildren(
      h('div', { class: 'intro' }, h('p', {}, 'There are no questions in this category yet. Add some to questions.json, then open the app again.')),
      h('button', { class: 'secondary-btn', onclick: () => exitChallenge() }, 'Back to Today'));
    return;
  }
  const day = dayRec(k, true);
  const r = day.results[cat] || (day.results[cat] = { done: false, items: [] });
  let i = r.items.length;
  next();

  function next() {
    clearInterval(clockTimer);
    keyHandler = null;
    if (i >= ids.length) { finish(); return; }
    const q = BANK_BY_ID.get(ids[i]);
    if (!q) { r.items.push({ id: ids[i], missing: true }); i++; save(); next(); return; }
    const t0 = Date.now();
    const elapsed = h('div', { class: 'tiny' });
    ui.meta.replaceChildren(h('div', {}, `${i + 1} of ${ids.length}`), elapsed);
    const tickMeta = () => { elapsed.textContent = clock(Math.floor((Date.now() - t0) / 1000)); };
    tickMeta();
    clockTimer = setInterval(tickMeta, 1000);

    const area = h('div', { class: 'q-scroll' }, h('div', { class: 'prompt' }, q.prompt));
    const actions = h('div', { class: 'q-actions' });
    ui.body.replaceChildren(area, actions);
    let btns = [], entry = null;

    if (q.choices) {
      btns = q.choices.map((c, j) => h('button', { class: 'choice', onclick: () => answer(CHOICE_LETTERS[j]) },
        h('span', { class: 'letter' }, CHOICE_LETTERS[j]), h('span', { class: 'txt' }, c), h('span', { class: 'slot' })));
      area.append(h('div', { class: 'choices' }, btns));
      keyHandler = e => { const j = CHOICE_LETTERS.indexOf(e.key.toUpperCase()); if (j >= 0 && j < btns.length && !btns[j].disabled) answer(CHOICE_LETTERS[j]); };
    } else {
      let input = '';
      entry = h('div', { class: 'entry free-entry caret', 'aria-label': 'Your answer' });
      area.append(h('p', { class: 'secondary small' }, 'Type your answer. Fractions like 3/8, decimals and percentages all work.'), entry);
      const onKey = kv => {
        if (entry.dataset.locked) return;
        if (kv === 'check') { if (input.trim()) answer(input); return; }
        if (kv === 'del') input = input.slice(0, -1);
        else if (input.length < 14) input += kv === 'neg' ? '-' : kv;
        entry.textContent = input.replace(/-/g, '−');
      };
      actions.append(keypad(['7', '8', '9', 'del', '4', '5', '6', '/', '1', '2', '3', '.', 'neg', '0', '%', 'check'], onKey, 4));
      keyHandler = e => {
        if (/^[\d/.%]$/.test(e.key)) onKey(e.key);
        else if (e.key === '-') onKey('neg');
        else if (e.key === 'Backspace') onKey('del');
        else if (e.key === 'Enter') onKey('check');
      };
    }
    renderMath(area);

    function answer(given) {
      clearInterval(clockTimer);
      keyHandler = null;
      const ok = q.choices ? given === String(q.answer).toUpperCase() : checkFree(q, given);
      r.items.push({ id: q.id, given, correct: ok, ms: Date.now() - t0 });
      const prev = state.seen[q.id];
      state.seen[q.id] = { last: k, correct: ok, n: (prev?.n || 0) + 1 };
      save();
      if (q.choices) {
        const right = CHOICE_LETTERS.indexOf(String(q.answer).toUpperCase());
        btns.forEach((b, j) => {
          b.disabled = true;
          if (CHOICE_LETTERS[j] === given) b.classList.add('chosen');
          if (j === right) { b.classList.add('answer'); b.querySelector('.slot').replaceWith(tick()); }
          else if (CHOICE_LETTERS[j] === given) b.querySelector('.slot').replaceWith(cross());
        });
      } else {
        entry.dataset.locked = '1';
        entry.classList.remove('caret');
        entry.classList.toggle('wrong', !ok);
      }
      const answerText = q.choices ? String(q.answer).toUpperCase() : String(q.answer);
      const exp = h('div', { class: 'explain' },
        h('div', { class: 'verdict' }, ok ? tick() : cross(), ok ? 'Correct' : `The answer is ${answerText}`),
        q.explanation ? h('div', {}, q.explanation) : null);
      area.append(exp);
      renderMath(exp);
      actions.replaceChildren(h('button', { class: 'primary', onclick: () => { i++; next(); window.scrollTo(0, 0); } }, i + 1 < ids.length ? 'Next question' : 'See result'));
      exp.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }
  function finish() {
    const items = r.items.filter(x => !x.missing);
    r.done = true;
    r.correct = items.filter(x => x.correct).length;
    r.total = items.length;
    r.ms = items.reduce((t, x) => t + x.ms, 0);
    r.at = Date.now();
    save();
    const list = h('ul', { class: 'result-list' }, items.map(x => {
      const q = BANK_BY_ID.get(x.id);
      return h('li', {}, x.correct ? tick() : cross(), h('span', {}, q ? shortPrompt(q.prompt) : x.id));
    }));
    const avg = r.total ? Math.round(r.ms / r.total / 1000) : 0;
    resultScreen(ui, { lead: `${r.correct}/${r.total}`, unit: 'correct', extra: `${avg} seconds per question on average. Explanations are in History.`, list, id: cat });
    renderMath(list);
  }
}

/* ---------- History ---------- */
function viewHistory() {
  const t = todayKey();
  if (!hist.sel) hist.sel = t;
  if (!hist.month) hist.month = hist.sel.slice(0, 7);
  const [y, m] = hist.month.split('-').map(Number);
  const daysIn = new Date(y, m, 0).getDate();
  const lead = (new Date(y, m - 1, 1).getDay() + 6) % 7; // weeks start on Monday
  const cal = h('div', { class: 'cal' }, ['M', 'T', 'W', 'T', 'F', 'S', 'S'].map(d => h('div', { class: 'dow', 'aria-hidden': 'true' }, d)));
  for (let i = 0; i < lead; i++) cal.append(h('div', { class: 'day blank' }));
  for (let d = 1; d <= daysIn; d++) {
    const key = `${y}-${pad(m)}-${pad(d)}`, cnt = dayDoneCount(key), future = key > t;
    const cls = ['day', key === t && 'today', key === hist.sel && 'sel', future && 'future'].filter(Boolean).join(' ');
    cal.append(h('button', {
      class: cls, disabled: future,
      'aria-label': `${fmt(key, { day: 'numeric', month: 'long' })}, ${cnt} of 6 done`,
      onclick: () => { hist.sel = key; render(); },
    }, h('span', { class: 'num' }, d), h('span', { class: 'pip' + (cnt === 6 ? ' full' : cnt ? ' part' : '') })));
  }
  for (let i = lead + daysIn; i % 7; i++) cal.append(h('div', { class: 'day blank' }));
  const nextM = shiftMonth(hist.month, 1);
  return h('div', {},
    h('h1', { class: 'page-title' }, 'History'),
    h('div', { class: 'cal-head' },
      h('div', { class: 'month' }, new Date(y, m - 1, 1).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })),
      h('div', { class: 'cal-nav' },
        h('button', { 'aria-label': 'Previous month', onclick: () => { hist.month = shiftMonth(hist.month, -1); render(); } }, icon(ICONS.left)),
        h('button', { 'aria-label': 'Next month', disabled: nextM > t.slice(0, 7), onclick: () => { hist.month = nextM; render(); } }, icon(ICONS.right)))),
    cal,
    h('div', { class: 'cal-key' }, h('span', {}, h('i', { class: 'pip full' }), 'All six done'), h('span', {}, h('i', { class: 'pip part' }), 'Some done')),
    dayDetail(hist.sel));
}
function detailValue(id, r) {
  switch (id) {
    case 'nback': return `${fmtN(r.avgN)} average n`;
    case 'maths': return `${r.score} correct`;
    case 'memory': return plural(r.span, 'digit', 'digits');
    default: return `${r.correct}/${r.total}`;
  }
}
function detailBody(id, r) {
  if (id === 'nback') {
    return r.blocks.map((b, j) => h('p', {}, `Block ${j + 1} at ${b.n}-back: position ${b.v.pct}%, sound ${b.a.pct}%.`))
      .concat(h('p', { class: 'secondary' }, `Ended at ${r.endN}-back.`));
  }
  if (id === 'maths') return [h('p', {}, `${r.score} correct and ${r.skipped} skipped in ${r.seconds / 60} minutes.`)];
  if (id === 'memory') {
    return [h('p', {}, `Longest string recalled: ${plural(r.span, 'digit', 'digits')}.`),
      h('p', { class: 'secondary' }, `Attempts in order: ${r.trials.map(t => `${t.len} ${t.ok ? '✓' : '✗'}`).join(', ')}`)];
  }
  return (r.items || []).filter(x => !x.missing).map(x => {
    const q = BANK_BY_ID.get(x.id);
    if (!q) return h('div', { class: 'qrev' }, x.correct ? tick() : cross(), h('div', { class: 'secondary' }, `${x.id} is no longer in the question bank.`));
    const label = L => { const j = CHOICE_LETTERS.indexOf(L); return q.choices && j >= 0 ? `${L} (${q.choices[j]})` : L; };
    const yours = q.choices ? label(x.given) : x.given;
    const right = q.choices ? label(String(q.answer).toUpperCase()) : q.answer;
    return h('div', { class: 'qrev' }, x.correct ? tick() : cross(),
      h('div', {},
        h('div', { class: 'qp' }, q.prompt),
        h('div', { class: 'ans' }, x.correct ? `You answered ${yours} in ${Math.round(x.ms / 1000)} s.` : `You answered ${yours}. The answer is ${right}.`),
        q.explanation ? h('details', {}, h('summary', {}, 'Explanation'), h('div', { class: 'exp' }, q.explanation)) : null));
  });
}
function dayDetail(k) {
  const rec = state.days[k];
  const box = h('section', { class: 'day-detail' }, h('h2', {}, fmt(k, { weekday: 'long', day: 'numeric', month: 'long' })));
  const any = rec && CHALLENGES.some(c => rec.results?.[c.id]?.done || rec.results?.[c.id]?.items?.length);
  if (!any) {
    box.append(h('p', { class: 'empty' }, k === todayKey() ? 'Nothing done yet today. Start from the Today tab.' : 'No training on this day.'));
    return box;
  }
  for (const c of CHALLENGES) {
    const r = rec.results?.[c.id];
    const val = r?.done ? detailValue(c.id, r) : r?.items?.length ? `${r.items.length} answered` : 'Not done';
    let body = [h('p', { class: 'secondary' }, 'Not attempted.')];
    if (r?.done || r?.items?.length) body = detailBody(c.id, r);
    box.append(h('details', { class: 'det', open: hist.open === c.id },
      h('summary', {}, h('span', { class: 'nm' }, c.name), h('span', { class: 'val' }, val), icon(ICONS.right, 'ico chev')),
      h('div', { class: 'body' }, body)));
  }
  hist.open = null;
  return box;
}

/* ---------- Progress ---------- */
const METRICS = [
  { id: 'nback', title: 'Dual n-back', unit: 'Average n-back level each day', get: r => r.avgN, fmt: fmtN },
  { id: 'maths', title: 'Mental maths', unit: `Correct answers in ${CONFIG.maths.seconds / 60} minutes`, get: r => r.score, fmt: v => String(Math.round(v)) },
  { id: 'memory', title: 'Number memory', unit: 'Longest digit string recalled', get: r => r.span, fmt: v => String(Math.round(v)) },
  { id: 'probability', title: 'Probability', unit: 'Share correct over the last 7 days', bank: true, fmt: v => `${Math.round(v)}%` },
  { id: 'smc', title: 'Senior maths', unit: 'Share correct over the last 7 days', bank: true, fmt: v => `${Math.round(v)}%` },
  { id: 'gmat', title: 'GMAT / LSAT', unit: 'Share correct over the last 7 days', bank: true, fmt: v => `${Math.round(v)}%` },
];
function seriesFor(m) {
  const pts = [];
  for (const key of Object.keys(state.days).sort()) {
    const r = state.days[key].results?.[m.id];
    if (!r?.done) continue;
    if (!m.bank) { const v = m.get(r); if (typeof v === 'number' && isFinite(v)) pts.push({ k: key, v }); continue; }
    let c = 0, t = 0;
    for (let j = 0; j < 7; j++) {
      const rr = state.days[addDays(key, -j)]?.results?.[m.id];
      if (rr?.done) { c += rr.correct; t += rr.total; }
    }
    if (t) pts.push({ k: key, v: 100 * c / t });
  }
  return pts;
}
function viewProgress() {
  const cur = currentStreak(), best = bestStreak();
  const full = Object.keys(state.days).filter(dayComplete).length;
  const ranges = [[30, '30 days'], [90, '90 days'], ['all', 'All time']];
  return h('div', {},
    h('h1', { class: 'page-title' }, 'Progress'),
    h('p', { class: 'prog-sum' }, cur ? `${cur}-day streak` : 'No streak running'),
    h('p', { class: 'prog-sum-sub' }, `Best streak ${plural(best, 'day', 'days')}. ${plural(full, 'full day', 'full days')} completed.`),
    h('div', { class: 'controls' },
      h('div', { class: 'seg', role: 'group', 'aria-label': 'Date range' },
        ranges.map(([v, l]) => h('button', { 'aria-pressed': String(prog.range === v), onclick: () => { prog.range = v; render(); } }, l))),
      h('div', { class: 'seg' }, h('button', { 'aria-pressed': String(prog.table), onclick: () => { prog.table = !prog.table; render(); } }, 'Table'))),
    METRICS.map(metricCard));
}
function metricCard(m) {
  const all = seriesFor(m), t = todayKey();
  const start = prog.range === 'all' ? (all[0]?.k ?? t) : addDays(t, -(prog.range - 1));
  const pts = all.filter(p => p.k >= start);
  const card = h('section', { class: 'chart-card' }, h('h3', {}, m.title), h('div', { class: 'unit' }, m.unit));
  if (!pts.length) {
    card.append(h('p', { class: 'empty' }, all.length ? 'Nothing in this range. Try a longer one.' : 'Finish this challenge once to start the chart.'));
    return card;
  }
  const vals = pts.map(p => p.v);
  let stats = `Latest ${m.fmt(vals.at(-1))}, best ${m.fmt(Math.max(...vals))}.`;
  if (m.bank) {
    let ms = 0, n = 0;
    for (const p of pts) { const r = state.days[p.k].results[m.id]; ms += r.ms || 0; n += r.total || 0; }
    if (n) stats += ` ${Math.round(ms / n / 1000)} seconds per question.`;
  }
  card.append(h('p', { class: 'stats' }, stats));
  if (prog.table) {
    card.append(h('table', { class: 'vtable' }, h('tbody', {}, pts.slice().reverse().map(p =>
      h('tr', {}, h('td', {}, fmt(p.k, { weekday: 'short', day: 'numeric', month: 'short' })), h('td', {}, m.fmt(p.v)))))));
    return card;
  }
  const box = h('div', { class: 'chart-box' });
  box._chart = { pts, start, m };
  card.append(box);
  return card;
}
function niceScale(min, max) {
  if (min === max) { min -= 1; max += 1; }
  const raw = (max - min) / 3, mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 2, 5, 10].map(f => f * mag).find(st => st >= raw);
  const lo = Math.floor(min / step) * step, hi = Math.ceil(max / step) * step, ticks = [];
  for (let v = lo; v <= hi + step / 2; v += step) ticks.push(Math.round(v * 1000) / 1000);
  return { lo, hi, ticks };
}
function drawCharts() { app.querySelectorAll('.chart-box').forEach(b => drawChart(b, b._chart)); }
function drawChart(box, { pts, start, m }) {
  const W = Math.max(240, Math.round(box.clientWidth)), H = 140, M = { l: 36, r: 44, t: 14, b: 22 };
  const span = Math.max(1, daysBetween(start, todayKey()));
  const x = key => M.l + (daysBetween(start, key) / span) * (W - M.l - M.r);
  const sc = m.bank ? { lo: 0, hi: 100, ticks: [0, 50, 100] } : niceScale(Math.min(...pts.map(p => p.v)), Math.max(...pts.map(p => p.v)));
  const y = v => M.t + (1 - (v - sc.lo) / (sc.hi - sc.lo)) * (H - M.t - M.b);
  const last = pts.at(-1);
  const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, height: H, role: 'img', 'aria-label': `${m.title}. Latest ${m.fmt(last.v)}.` });
  const grid = s('g', { class: 'grid' }), axis = s('g', { class: 'axis' });
  for (const tk of sc.ticks) {
    grid.append(s('line', { x1: M.l, x2: W - M.r + 8, y1: y(tk), y2: y(tk) }));
    axis.append(s('text', { x: M.l - 8, y: y(tk) + 4, 'text-anchor': 'end' }, m.bank ? `${tk}%` : m.fmt(tk)));
  }
  axis.append(s('text', { x: M.l, y: H - 4, 'text-anchor': 'start' }, fmt(start, { day: 'numeric', month: 'short' })));
  axis.append(s('text', { x: W - M.r, y: H - 4, 'text-anchor': 'end' }, 'Today'));
  // A missed day breaks the line rather than drawing a slope across it.
  let d = '';
  const lone = [];
  pts.forEach((p, i) => {
    const joinPrev = i > 0 && daysBetween(pts[i - 1].k, p.k) === 1;
    const joinNext = i < pts.length - 1 && daysBetween(p.k, pts[i + 1].k) === 1;
    d += `${joinPrev ? 'L' : 'M'}${x(p.k).toFixed(1)},${y(p.v).toFixed(1)}`;
    if (!joinPrev && !joinNext && p !== last) lone.push(p);
  });
  const crossLine = s('line', { class: 'cross', y1: M.t - 4, y2: H - M.b, visibility: 'hidden' });
  const hoverDot = s('circle', { class: 'end', r: 4.5, visibility: 'hidden' });
  const hit = s('rect', { class: 'hit', x: 0, y: 0, width: W, height: H });
  svg.append(grid, axis, s('path', { class: 'series', d }),
    lone.map(p => s('circle', { class: 'pt', cx: x(p.k), cy: y(p.v), r: 3 })),
    s('circle', { class: 'end', cx: x(last.k), cy: y(last.v), r: 4.5 }),
    s('text', { class: 'end-label', x: x(last.k) + 9, y: y(last.v) + 4 }, m.fmt(last.v)),
    crossLine, hoverDot, hit);
  const tip = h('div', { class: 'tip', hidden: true });
  box.replaceChildren(svg, tip);
  const showAt = clientX => {
    const rect = svg.getBoundingClientRect(), px = (clientX - rect.left) * (W / rect.width);
    let near = pts[0];
    for (const p of pts) if (Math.abs(x(p.k) - px) < Math.abs(x(near.k) - px)) near = p;
    const cx = x(near.k);
    crossLine.setAttribute('x1', cx); crossLine.setAttribute('x2', cx); crossLine.setAttribute('visibility', 'visible');
    hoverDot.setAttribute('cx', cx); hoverDot.setAttribute('cy', y(near.v)); hoverDot.setAttribute('visibility', 'visible');
    tip.hidden = false;
    tip.replaceChildren(h('strong', {}, m.fmt(near.v)), h('span', {}, fmt(near.k, { weekday: 'short', day: 'numeric', month: 'short' })));
    tip.style.left = `${Math.min(Math.max(cx * rect.width / W, 56), rect.width - 56)}px`;
  };
  const hide = () => { crossLine.setAttribute('visibility', 'hidden'); hoverDot.setAttribute('visibility', 'hidden'); tip.hidden = true; };
  hit.addEventListener('pointermove', e => showAt(e.clientX));
  hit.addEventListener('pointerdown', e => showAt(e.clientX));
  hit.addEventListener('pointerleave', hide);
  hit.addEventListener('pointerup', e => { if (e.pointerType !== 'mouse') setTimeout(hide, 1800); });
}

/* ---------- Settings ---------- */
function viewSettings() {
  const stepper = (label, get, set, min, max) => {
    const out = h('output', {}, get());
    const change = dv => { set(Math.min(max, Math.max(min, get() + dv))); out.textContent = get(); save(); };
    return h('div', { class: 'set-row' }, h('span', {}, label),
      h('div', { class: 'stepper' },
        h('button', { 'aria-label': `Lower ${label}`, onclick: () => change(-1) }, '−'), out,
        h('button', { 'aria-label': `Raise ${label}`, onclick: () => change(1) }, '+')));
  };
  const bank = h('div', { class: 'set-block' });
  if (BANK_STATUS === 'loading') bank.append(h('p', { class: 'note' }, 'Loading questions…'));
  for (const c of BANK_CATS) {
    const unseen = BANK[c].filter(q => !state.seen[q.id]).length;
    bank.append(h('div', { class: 'bank-line' }, h('span', {}, CAT_NAME[c]), h('span', {}, `${plural(BANK[c].length, 'question', 'questions')}, ${unseen} unseen`)));
  }
  if (BANK_ERRORS.length) {
    bank.append(h('p', { class: 'warn' }, `${plural(BANK_ERRORS.length, 'question was', 'questions were')} skipped because of a problem in the file:`),
      h('ul', { class: 'note', style: 'padding-left:18px' }, BANK_ERRORS.slice(0, 12).map(e => h('li', {}, e))));
  }
  bank.append(h('p', { class: 'note' }, 'Questions live in questions.json next to the app. After adding some, open the app twice: the first launch downloads them and the second shows them. When a category runs out of unseen questions, it repeats the ones you got wrong first.'));

  const fileIn = h('input', { type: 'file', accept: 'application/json,.json', hidden: true, onchange: e => { importBackup(e.target.files[0]); e.target.value = ''; } });
  return h('div', {},
    h('h1', { class: 'page-title' }, 'Settings'),
    h('h2', { class: 'section-title' }, 'N-back sound'),
    h('div', { class: 'set-block' },
      h('div', { class: 'set-row' },
        h('div', { class: 'seg', role: 'group', 'aria-label': 'N-back sound' },
          [['voice', 'Spoken letters'], ['tones', 'Tones']].map(([v, l]) => h('button', { 'aria-pressed': String(state.settings.sound === v), onclick: () => { state.settings.sound = v; save(); render(); } }, l))),
        h('button', { class: 'secondary-btn', onclick: () => { Sound.unlock(); Sound.play(Math.floor(Math.random() * 8)); } }, 'Test')),
      h('p', { class: 'note' }, 'Spoken letters use your phone’s built-in voice. If you hear nothing, turn the volume up or switch to tones.')),
    h('h2', { class: 'section-title' }, 'Starting levels'),
    h('div', { class: 'set-block' },
      stepper('N-back level', () => state.levels.nback, v => { state.levels.nback = v; }, 1, 9),
      stepper('Number memory digits', () => state.levels.memory, v => { state.levels.memory = v; }, 3, 20),
      h('p', { class: 'note' }, 'Both adjust themselves after each session. Change them here if a level feels wrong.')),
    h('h2', { class: 'section-title' }, 'Question bank'),
    bank,
    h('h2', { class: 'section-title' }, 'Backup'),
    h('div', { class: 'set-block' },
      h('p', { class: 'note' }, `Your history is stored only on this phone, and removing the Home Screen icon deletes it. ${plural(Object.keys(state.days).length, 'day', 'days')} recorded so far.`),
      h('div', { class: 'btn-row' },
        h('button', { class: 'secondary-btn', onclick: exportBackup }, 'Export backup'),
        h('button', { class: 'secondary-btn', onclick: () => fileIn.click() }, 'Restore a backup'), fileIn)),
    h('h2', { class: 'section-title' }, 'Reset'),
    h('div', { class: 'set-block' },
      h('div', { class: 'btn-row' },
        h('button', {
          class: 'secondary-btn danger',
          onclick: () => sheet({
            title: 'Delete all data?', text: 'This removes every day of history and resets your levels. Export a backup first if you might want it back.',
            confirm: 'Delete everything', danger: true,
            onConfirm: () => { state = freshState(); save(); toast('All data deleted'); render(); },
          }),
        }, 'Delete all data'))),
    h('p', { class: 'note', style: 'margin-top:24px' }, 'Daily Six, version 1'));
}
async function exportBackup() {
  const name = `daily-six-backup-${todayKey()}.json`;
  const file = new File([JSON.stringify({ app: 'daily-six', exported: new Date().toISOString(), state })], name, { type: 'application/json' });
  try {
    if (navigator.canShare?.({ files: [file] })) { await navigator.share({ files: [file], title: 'Daily Six backup' }); return; }
  } catch (e) { if (e.name === 'AbortError') return; }
  const url = URL.createObjectURL(file);
  const a = h('a', { href: url, download: name });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  toast('Backup saved');
}
function importBackup(file) {
  if (!file) return;
  const rd = new FileReader();
  rd.onload = () => {
    let data;
    try { data = JSON.parse(rd.result); } catch (e) { toast('That file isn’t a Daily Six backup.'); return; }
    const st = data?.state;
    if (!st || st.v !== 1 || typeof st.days !== 'object') { toast('That file isn’t a Daily Six backup.'); return; }
    const n = Object.keys(st.days).length;
    const when = data.exported ? `, exported ${new Date(data.exported).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}` : '';
    sheet({
      title: 'Replace your data with this backup?',
      text: `The backup has ${plural(n, 'day', 'days')}${when}. Everything currently on this phone will be replaced.`,
      confirm: 'Replace', danger: true,
      onConfirm: () => { state = mergeState(st); save(); toast('Backup restored'); render(); },
    });
  };
  rd.readAsText(file);
}

/* ---------- Start ---------- */
buildTabs();
Sound.init();
render();
loadBank();
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
try { navigator.storage?.persist?.(); } catch (e) { /* not supported */ }
document.addEventListener('visibilitychange', () => { if (!document.hidden && !route.challenge) render(); });
let resizeTimer;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => { if (!route.challenge && route.tab === 'progress') drawCharts(); }, 150);
});
