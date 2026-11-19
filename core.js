// Shared, dependency-free content validation, persistence, and scoring.
export const CONTENT_KEY = 'cert-practice.content.v1';
export const STATE_KEY = 'cert-practice.attempts.v1';
const nonempty = x => typeof x === 'string' && x.trim().length > 0;
const safeId = x => nonempty(x) && /^[a-zA-Z0-9][a-zA-Z0-9_-]*$/.test(x) && !['constructor', 'prototype', '__proto__'].includes(x);
const unique = xs => new Set(xs).size === xs.length;
function check(ok, message) { if (!ok) throw new Error(message); }
export function validateCatalog(c) {
  check(c?.schemaVersion === 1 && Array.isArray(c.exams) && c.exams.length > 0, 'Invalid catalog schema');
  check(unique(c.exams.map(e => e.id)), 'Duplicate exam ID');
  for (const e of c.exams) {
    check([e.id, e.name, e.code, e.version, e.bank].every(nonempty), 'Missing exam metadata');
    check(safeId(e.id) && /^[a-z0-9-]+$/.test(e.id), 'Invalid exam ID');
    check(/^content\/[a-z0-9/-]+\.json$/.test(e.bank) && !e.bank.includes('..'), 'Bank must use a local content path');
    check(Number.isFinite(e.defaultMinutes) && e.defaultMinutes > 0, 'Invalid default time');
  }
  return c;
}
export function validateBank(b, exam) {
  check(b?.schemaVersion === 1 && b.examId === exam.id && b.version === exam.version, 'Bank identity/version mismatch');
  check(Array.isArray(b.domains) && b.domains.length > 0 && unique(b.domains.map(d => d.id)), 'Invalid domains');
  for (const d of b.domains) check(nonempty(d.id) && nonempty(d.name), 'Invalid domain');
  check(Array.isArray(b.questions) && b.questions.length > 0 && unique(b.questions.map(q => q.id)), 'Invalid question IDs');
  for (const q of b.questions) {
    check(safeId(q.id) && nonempty(q.prompt) && nonempty(q.objective) && b.domains.some(d => d.id === q.domain), 'Invalid question metadata');
    check(['single', 'multiple'].includes(q.type), 'Invalid question type');
    check(Array.isArray(q.choices) && q.choices.length >= 2 && unique(q.choices.map(c => c.id)), 'Invalid choices');
    for (const c of q.choices) check(safeId(c.id) && nonempty(c.text) && nonempty(c.explanation), 'Invalid choice or missing explanation');
    check(Array.isArray(q.correctAnswerIds) && unique(q.correctAnswerIds) && q.correctAnswerIds.length > 0 && q.correctAnswerIds.length < q.choices.length && q.correctAnswerIds.every(id => q.choices.some(c => c.id === id)), 'Invalid answer key');
    check(q.type === 'single' ? q.correctAnswerIds.length === 1 : q.correctAnswerIds.length >= 2, 'Answer count/type mismatch');
  }
  return b;
}
export function readContent(storage = localStorage) {
  try {
    const value = JSON.parse(storage.getItem(CONTENT_KEY));
    validateCatalog(value.catalog);
    for (const e of value.catalog.exams) validateBank(value.banks[e.id], e);
    return value;
  } catch { return null; }
}
async function download(path, fetcher) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);
  try {
    const response = await fetcher(path, {cache: 'no-store', signal: controller.signal});
    check(response.ok, `Could not load ${path}`);
    return await response.json();
  } finally { clearTimeout(timer); }
}
export async function updateContent(storage = localStorage, fetcher = fetch) {
  const catalog = validateCatalog(await download('./content/catalog.json', fetcher));
  const banks = {};
  await Promise.all(catalog.exams.map(async exam => {
    banks[exam.id] = validateBank(await download(`./${exam.bank}`, fetcher), exam);
  }));
  const previous = readContent(storage);
  // An immutable version may never silently acquire different questions.
  for (const e of catalog.exams) {
    const old = previous?.banks[e.id];
    check(!old || old.version !== e.version || JSON.stringify(old) === JSON.stringify(banks[e.id]), 'Changed bank must have a new version and filename');
  }
  const next = {catalog, banks, checkedAt: Date.now()};
  // One atomic write: a failed download or validation never replaces the last good set.
  storage.setItem(CONTENT_KEY, JSON.stringify(next));
  return next;
}
export function readState(storage = localStorage) {
  try { const s = JSON.parse(storage.getItem(STATE_KEY)); if (s?.schemaVersion === 1 && s.exams && typeof s.exams === 'object') return s; } catch { /* fresh device */ }
  return {schemaVersion: 1, exams: {}};
}
export function saveState(state, storage = localStorage) { storage.setItem(STATE_KEY, JSON.stringify(state)); }
export function examState(state, id) {
  if (!Object.hasOwn(state.exams, id)) state.exams[id] = {active: null, history: []};
  return state.exams[id];
}
export function shuffled(items, random = Math.random) {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
export function createAttempt(exam, bank, {mode, domain = 'all', count, minutes}, now = Date.now()) {
  const pool = bank.questions.filter(q => domain === 'all' || q.domain === domain);
  check(['practice', 'timed'].includes(mode), 'Choose a valid mode');
  check(Number.isInteger(count) && count > 0 && count <= pool.length, 'Choose an available question count');
  check(mode !== 'timed' || (Number.isFinite(minutes) && minutes >= 1 && minutes <= 300), 'Time must be 1–300 minutes');
  return JSON.parse(JSON.stringify({id: crypto.randomUUID(), examId: exam.id, examName: exam.name, code: exam.code, version: bank.version,
    domains: bank.domains, mode, startedAt: now, deadline: mode === 'timed' ? now + minutes * 60000 : null,
    questions: shuffled(pool).slice(0, count), answers: {}, checked: {}, flags: {}, index: 0, completedAt: null}));
}
export function isCorrect(q, selected = []) {
  return selected.length === q.correctAnswerIds.length && unique(selected) && q.correctAnswerIds.every(id => selected.includes(id));
}
export function score(attempt) {
  const domains = attempt.domains.map(d => ({...d, total: 0, correct: 0, unanswered: 0}));
  let correct = 0, unanswered = 0;
  for (const q of attempt.questions) {
    const d = domains.find(d => d.id === q.domain), a = attempt.answers[q.id] || [];
    d.total++; if (!a.length) { unanswered++; d.unanswered++; }
    if (isCorrect(q, a)) { correct++; d.correct++; }
  }
  return {correct, unanswered, total: attempt.questions.length, percent: Math.round(correct / attempt.questions.length * 100), domains: domains.filter(d => d.total)};
}
export function finishAttempt(state, id, reason = 'submitted', now = Date.now()) {
  const e = examState(state, id), a = e.active;
  if (!a) return null;
  a.completedAt = now; a.reason = reason;
  e.history.unshift(a); e.active = null;
  return a;
}
export function expireAttempts(state, now = Date.now()) {
  const expired = [];
  for (const [id, e] of Object.entries(state.exams)) if (e.active?.deadline && now >= e.active.deadline) {
    expired.push(finishAttempt(state, id, 'time-expired', now));
  }
  return expired;
}
