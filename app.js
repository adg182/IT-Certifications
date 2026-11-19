import {showFlashcards} from './flashcards.js';
import {readContent, updateContent, readState, saveState, examState, createAttempt, isCorrect, score, finishAttempt, expireAttempts} from './core.js';

const $ = s => document.querySelector(s);
const esc = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let content = readContent(), state = readState(), screen = 'home', selected = content?.catalog.exams[0]?.id, result = null;
let mode = 'practice', domain = 'all', count = 10, minutes = content?.catalog.exams[0]?.defaultMinutes || 30, reviewAll = false;
function notice(text) { $('#notice').textContent = text; $('#notice').hidden = false; }
function persist() {
  try { saveState(state); }
  catch { notice('Device storage is full or unavailable. This session works, but new progress may be lost when you close it. Free browser storage to save again.'); }
}
function expire() {
  const expired = expireAttempts(state);
  if (expired.length) {
    persist();
    result = expired.find(a => a.examId === selected) || expired[0];
    selected = result.examId; screen = 'results'; reviewAll = false;
    return true;
  }
  return false;
}
function go(next) { screen = next; render(); $('#main').focus(); window.scrollTo(0, 0); }
$('#nav-home').onclick = () => go('home');
$('#nav-flashcards')?.addEventListener('click', () => go('flashcards'));
$('#nav-history').onclick = () => go('history');
function exam() { return content?.catalog.exams.find(e => e.id === selected); }
function bank() { return content?.banks[selected]; }
function active() { return state.exams[selected]?.active; }
function intro(title, subtitle, eyebrow = 'YOUR CERTIFICATION JOURNEY') {
  return `<div class="intro"><div class="eyebrow">${eyebrow}</div><h1>${title}</h1><p>${subtitle}</p></div>`;
}
function render() {
  $('#nav-home').classList.toggle('active', ['home', 'quiz', 'results'].includes(screen));
  $('#nav-history').classList.toggle('active', screen === 'history');
  $('#nav-flashcards')?.classList.toggle('active', screen === 'flashcards');
  if (screen === 'flashcards') { showFlashcards($('#main')); return; }
  if (!content && !Object.keys(state.exams).length) {
    $('#main').innerHTML = intro('Your study space is getting ready.', 'Connect to the internet for your first visit, then practice offline.') + '<button id="retry">Retry loading question banks</button>';
    $('#retry').onclick = sync; return;
  }
  if (screen === 'quiz' && active()) renderQuiz();
  else if (screen === 'results' && result) renderResults();
  else if (screen === 'history') renderHistory();
  else renderHome();
}
function renderHome() {
  const exams = content?.catalog.exams || [];
  if (!exams.some(e => e.id === selected)) selected = exams[0]?.id;
  const a = active(), b = bank(), allHistory = Object.values(state.exams).flatMap(e => e.history);
  if (b) {
    if (domain !== 'all' && !b.domains.some(d => d.id === domain)) domain = 'all';
    const available = b.questions.filter(q => mode === 'timed' || domain === 'all' || q.domain === domain).length;
    if (!available) domain = 'all';
    count = Math.min(Math.max(1, count || 1), available || b.questions.length);
  }
  $('#main').innerHTML = intro('Your next certification<br>starts here.', 'Choose your exam. Find your rhythm. Make every question count.', 'LET’S BUILD YOUR CONFIDENCE') +
    `<div class="section-heading"><h2>Choose your certification</h2><span>${exams.length} exams available</span></div><div class="exam-cards">${exams.map((e, i) => `<button class="exam-card ${selected === e.id ? 'selected' : ''}" data-exam="${esc(e.id)}" aria-pressed="${selected === e.id}"><span class="card-top"><span class="exam-icon ${i % 2 ? 'purple' : ''}" aria-hidden="true">${i % 2 ? '◇' : '☁'}</span><span class="exam-code">${esc(e.code)}</span><span class="selected-dot" aria-hidden="true">${selected === e.id ? '✓' : ''}</span></span><span class="provider">${esc(e.provider || 'CERTIFICATION')}</span><strong>${esc(e.name)}</strong><span class="card-bottom">${content.banks[e.id].questions.length} questions <span>·</span> ${content.banks[e.id].domains.length} domains <span class="card-arrow">↗</span></span></button>`).join('')}</div>` +
    `<p><button id="open-aws-flashcards" class="secondary" type="button">Study AWS flashcards →</button></p>` +
    (a ? `<section class="resume"><div><strong>You have a session in progress</strong><p>${esc(a.code)} · ${a.mode === 'timed' ? 'Timed exam' : 'Practice'} · ${Object.values(a.answers).filter(v => v.length).length}/${a.questions.length} answered · bank ${esc(a.version)}</p></div><button id="resume">Resume session →</button></section>` : '') +
    (b ? `<section class="setup"><div class="section-heading"><div><div class="eyebrow">MAKE IT YOURS</div><h2>Set up your session</h2></div><span class="pill">${esc(exam().code)}</span></div><div class="mode-grid"><button class="mode-card ${mode === 'practice' ? 'chosen' : ''}" data-mode="practice" aria-pressed="${mode === 'practice'}"><span aria-hidden="true">◎</span><strong>Practice mode</strong><small>Learn at your pace with instant explanations.</small></button><button class="mode-card ${mode === 'timed' ? 'chosen' : ''}" data-mode="timed" aria-pressed="${mode === 'timed'}"><span aria-hidden="true">◷</span><strong>Timed exam</strong><small>Test your readiness. Review answers at the end.</small></button></div><form id="setup-form"><div class="form-grid">${mode === 'practice' ? `<label>Focus area<select id="domain"><option value="all">All domains · mixed practice</option>${b.domains.map(d => `<option value="${esc(d.id)}" ${domain === d.id ? 'selected' : ''}>${esc(d.id)} · ${esc(d.name)}</option>`).join('')}</select></label>` : `<label>Time limit <span class="muted">(minutes)</span><input id="minutes" type="number" min="1" max="300" required value="${minutes}"></label>`}<label>Number of questions<input id="count" type="number" min="1" max="${b.questions.filter(q => mode === 'timed' || domain === 'all' || q.domain === domain).length}" value="${count}" required></label></div><div class="setup-bottom"><span>↳ Progress saves as you go.</span><button type="submit" ${a ? 'disabled' : ''}>Start ${mode === 'practice' ? 'practicing' : 'timed exam'} <span aria-hidden="true">→</span></button></div>${a ? '<p class="muted">Finish your active session before starting another for this exam.</p>' : ''}</form></section>` : '') +
    `<section class="study-tip"><span aria-hidden="true">✦</span><div><strong>Understanding beats memorizing.</strong><p>Every choice has an explanation. Use practice mode to learn why an answer works.</p></div></section><div class="dashboard-stats"><span><strong>${allHistory.length}</strong> sessions completed</span><span><strong>${allHistory.length ? Math.round(allHistory.reduce((n, a) => n + score(a).percent, 0) / allHistory.length) + '%' : '—'}</strong> average score</span><span><strong>On your terms</strong> online or offline</span></div><p class="fine-print">Starter banks cover every domain, with equal credit per question. This is independent practice, not an official exam or a prediction of your certification score.</p>`;
  $('#open-aws-flashcards').onclick = () => go('flashcards');
  document.querySelectorAll('[data-exam]').forEach(btn => btn.onclick = () => { captureSetup(); selected = btn.dataset.exam; domain = 'all'; minutes = exam().defaultMinutes; count = Math.min(count, bank().questions.length); renderHome(); });
  document.querySelectorAll('[data-mode]').forEach(btn => btn.onclick = () => { captureSetup(); mode = btn.dataset.mode; renderHome(); });
  if ($('#domain')) $('#domain').onchange = () => { captureSetup(); count = Math.min(count, b.questions.filter(q => domain === 'all' || q.domain === domain).length); renderHome(); };
  if ($('#resume')) $('#resume').onclick = () => { if (!expire()) screen = 'quiz'; render(); };
  if ($('#setup-form')) $('#setup-form').onsubmit = event => {
    event.preventDefault(); captureSetup();
    try { examState(state, selected).active = createAttempt(exam(), b, {mode, domain: mode === 'timed' ? 'all' : domain, count, minutes}); persist(); go('quiz'); }
    catch (error) { notice(error.message); }
  };
}
function captureSetup() {
  if ($('#domain')) domain = $('#domain').value;
  if ($('#count')) count = Number($('#count').value);
  if ($('#minutes')) minutes = Number($('#minutes').value);
}
function explanation(q, answers) {
  return `<section class="explanation"><h3>${isCorrect(q, answers) ? 'Correct — nicely done.' : answers?.length ? 'Let’s work through it.' : 'Unanswered'}</h3>${q.choices.map(c => `<div class="explanation-choice"><span class="key ${q.correctAnswerIds.includes(c.id) ? 'good' : ''}">${q.correctAnswerIds.includes(c.id) ? 'Correct' : 'Incorrect'}</span><p><strong>${esc(c.text)}</strong>${answers?.includes(c.id) ? ' · Your choice' : ''}<br>${esc(c.explanation)}</p></div>`).join('')}</section>`;
}
function renderQuiz() {
  const a = active(), q = a.questions[a.index], locked = a.mode === 'practice' && a.checked[q.id], answers = a.answers[q.id] || [];
  $('#main').innerHTML = `<div class="quiz-heading"><div><div class="eyebrow">${esc(a.code)} · ${a.mode === 'practice' ? 'PRACTICE' : 'TIMED EXAM'}</div><h1>One question at a time.</h1></div>${a.deadline ? '<div id="timer" class="timer" role="timer" aria-label="Time remaining"></div>' : '<span class="pill">At your pace</span>'}</div><div class="progress-label"><span>Question ${a.index + 1} of ${a.questions.length}</span><span>${Object.values(a.answers).filter(v => v.length).length} answered</span></div><progress max="${a.questions.length}" value="${Object.values(a.answers).filter(v => v.length).length}" aria-label="Answered questions"></progress><section class="question"><div class="question-meta"><span>Domain ${esc(q.domain)} · Objective ${esc(q.objective)}</span><button id="flag" class="text-button" aria-pressed="${!!a.flags[q.id]}">${a.flags[q.id] ? '⚑ Flagged' : '⚐ Flag for review'}</button></div><h2 id="question-prompt">${esc(q.prompt)}</h2><p id="selection-hint" class="selection-hint">${q.type === 'multiple' ? `Select ${q.correctAnswerIds.length} answers.` : 'Select one answer.'}</p><fieldset aria-labelledby="question-prompt" aria-describedby="selection-hint"><legend class="sr-only">Answer choices</legend>${q.choices.map((c, i) => `<label class="answer ${answers.includes(c.id) ? 'picked' : ''} ${locked && q.correctAnswerIds.includes(c.id) ? 'correct' : ''}"><input type="${q.type === 'single' ? 'radio' : 'checkbox'}" name="answer" value="${esc(c.id)}" ${answers.includes(c.id) ? 'checked' : ''} ${locked ? 'disabled' : ''}><span class="letter" aria-hidden="true">${String.fromCharCode(65 + i)}</span><span>${esc(c.text)}</span></label>`).join('')}</fieldset>${a.mode === 'practice' && !locked ? '<button id="check">Check answer</button><span id="answer-error" role="status"></span>' : ''}${locked ? explanation(q, answers) : ''}</section><div class="quiz-actions"><button id="prev" class="secondary" ${a.index === 0 ? 'disabled' : ''}>← Previous</button><button id="next" class="secondary">${a.index === a.questions.length - 1 ? 'Back to first' : answers.length ? 'Next question →' : 'Skip for now →'}</button></div><section class="navigator"><div class="section-heading"><h2>Question navigator</h2><span>● Answered · ⚑ Flagged</span></div><div class="question-grid">${a.questions.map((x, i) => `<button data-index="${i}" aria-label="Question ${i + 1}${a.answers[x.id]?.length ? ', answered' : ', unanswered'}${a.flags[x.id] ? ', flagged' : ''}" ${i === a.index ? 'aria-current="step"' : ''} class="number ${a.answers[x.id]?.length ? 'answered' : ''} ${i === a.index ? 'current' : ''}">${i + 1}${a.flags[x.id] ? '<span aria-hidden="true">⚑</span>' : ''}</button>`).join('')}</div><div class="finish-row"><button id="save-exit" class="text-button">Save & return to dashboard</button><button id="finish">Finish & review</button></div><div id="confirm-finish" hidden></div></section>`;
  document.querySelectorAll('[name="answer"]').forEach(input => input.onchange = () => {
    if (expire()) { render(); return; }
    a.answers[q.id] = [...document.querySelectorAll('[name="answer"]:checked')].map(x => x.value);
    persist(); renderQuiz();
    // Preserve keyboard focus after the answer controls are rebuilt.
    document.querySelector(`[name="answer"][value="${CSS.escape(input.value)}"]`)?.focus();
  });
  $('#flag').onclick = () => { if (expire()) return render(); a.flags[q.id] = !a.flags[q.id]; persist(); renderQuiz(); };
  const navigate = i => { if (expire()) return render(); a.index = i; persist(); renderQuiz(); $('#main').focus(); window.scrollTo(0,0); };
  $('#prev').onclick = () => navigate(a.index - 1);
  $('#next').onclick = () => navigate((a.index + 1) % a.questions.length);
  document.querySelectorAll('[data-index]').forEach(btn => btn.onclick = () => navigate(Number(btn.dataset.index)));
  if ($('#check')) $('#check').onclick = () => {
    if (answers.length !== q.correctAnswerIds.length) { $('#answer-error').textContent = ` Select ${q.correctAnswerIds.length} ${q.type === 'single' ? 'answer' : 'answers'} first.`; return; }
    a.checked[q.id] = true; persist(); renderQuiz();
  };
  $('#save-exit').onclick = () => go('home');
  $('#finish').onclick = () => {
    const unanswered = a.questions.filter(q => !a.answers[q.id]?.length).length;
    const box = $('#confirm-finish'); box.hidden = false;
    box.innerHTML = `<p><strong>Submit this session?</strong> ${unanswered} unanswered question(s) will receive no credit. You can’t change answers after submission.</p><button id="confirm-submit">Submit session</button> <button id="cancel-submit" class="secondary">Keep working</button>`;
    $('#confirm-submit').onclick = () => { if (expire()) return render(); result = finishAttempt(state, selected); persist(); reviewAll = false; go('results'); };
    $('#cancel-submit').onclick = () => { box.hidden = true; };
    box.scrollIntoView({block:'nearest'}); $('#confirm-submit').focus();
  };
  tick();
}
function renderResults() {
  const s = score(result), missed = result.questions.filter(q => !isCorrect(q, result.answers[q.id]));
  $('#main').innerHTML = intro('A step forward.', `${esc(result.code)} · ${result.mode === 'timed' ? 'Timed exam' : 'Practice mode'} · Bank ${esc(result.version)}`, 'SESSION COMPLETE') + `${result.reason === 'time-expired' ? '<p class="banner">Time expired. Your saved selections were submitted automatically.</p>' : ''}<section class="result-summary"><div class="score-circle"><strong>${s.percent}%</strong><span>practice score</span></div><div><h2>${s.correct} of ${s.total} correct</h2><p>${s.unanswered} unanswered · ${s.total - s.correct - s.unanswered} incorrect</p><p>Every question is a chance to learn. Review the explanations, then try again.</p><button id="again">Back to dashboard →</button></div></section><section class="panel"><h2>Performance by domain</h2><div class="table-scroll"><table><thead><tr><th scope="col">Domain</th><th scope="col">Correct</th><th scope="col">Score</th></tr></thead><tbody>${s.domains.map(d => `<tr><th scope="row">${esc(d.id)} · ${esc(d.name)}</th><td>${d.correct}/${d.total}</td><td>${Math.round(d.correct / d.total * 100)}%</td></tr>`).join('')}</tbody></table></div></section><div class="section-heading"><h2>Review ${reviewAll ? 'all questions' : 'missed & unanswered'}</h2><button id="review-toggle" class="text-button">${reviewAll ? 'Show missed only' : 'Show all questions'}</button></div>${(reviewAll ? result.questions : missed).map(q => `<article class="review-card"><div class="eyebrow">DOMAIN ${esc(q.domain)} · OBJECTIVE ${esc(q.objective)}</div><h3>${esc(q.prompt)}</h3>${explanation(q, result.answers[q.id])}</article>`).join('') || '<section class="panel">All answers correct. Great work!</section>'}<p class="fine-print">This percentage uses exact-match, equal-credit scoring. It is not the scaled score used by a certification provider.</p>`;
  $('#again').onclick = () => go('home');
  $('#review-toggle').onclick = () => { reviewAll = !reviewAll; renderResults(); };
}
function renderHistory() {
  const ids = [...new Set([...(content?.catalog.exams.map(e => e.id) || []), ...Object.keys(state.exams)])];
  $('#main').innerHTML = intro('See how far you’ve come.', 'Your completed sessions, organized by exam. Stored only in this browser.', 'ATTEMPT HISTORY') + ids.map(id => {
    const e = state.exams[id], label = content?.catalog.exams.find(e => e.id === id)?.name || e?.history[0]?.examName || id;
    return `<section class="panel"><h2>${esc(label)}</h2>${e?.active ? `<button class="secondary" data-resume="${esc(id)}">Resume active session</button>` : ''}${e?.history.length ? `<div class="history-list">${e.history.map(a => `<button class="history-item" data-attempt="${esc(a.id)}" data-exam-id="${esc(id)}"><span><strong>${esc(a.code)} · ${a.mode === 'timed' ? 'Timed' : 'Practice'}</strong><small>${esc(new Date(a.completedAt).toLocaleString())} · ${a.questions.length} questions · ${esc(a.version)}</small></span><span class="history-score">${score(a).percent}% <span aria-hidden="true">↗</span></span></button>`).join('')}</div>` : '<p class="muted">Your first completed session will appear here.</p>'}</section>`;
  }).join('') + '<p class="fine-print">History stays in this browser and origin. Clearing site data removes it. Safari and Home Screen installations may keep separate storage. Nothing syncs to GitHub.</p>';
  document.querySelectorAll('[data-attempt]').forEach(btn => btn.onclick = () => { selected = btn.dataset.examId; result = state.exams[selected].history.find(a => a.id === btn.dataset.attempt); reviewAll = false; go('results'); });
  document.querySelectorAll('[data-resume]').forEach(btn => btn.onclick = () => { selected = btn.dataset.resume; if (!expire()) screen = 'quiz'; render(); });
}
function tick() {
  if (expire()) { render(); return; }
  const a = active();
  if ($('#timer') && a?.deadline) {
    const seconds = Math.max(0, Math.ceil((a.deadline - Date.now()) / 1000));
    $('#timer').textContent = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')} remaining`;
    $('#timer').classList.toggle('urgent', seconds <= 60);
  }
}
let syncing = false;
async function sync() {
  if (syncing) return;
  syncing = true;
  $('#sync-status').textContent = 'Checking question banks…';
  try {
    if (screen === 'home') captureSetup();
    content = await updateContent();
    $('#sync-status').textContent = 'Question banks up to date · saved on device';
    if (screen === 'home') render();
  } catch (error) {
    $('#sync-status').textContent = content ? 'Using last valid question banks · update unavailable' : 'First download unavailable · reconnect and retry';
    console.warn('Question bank update was not installed:', error.message);
    if (!content) render();
  } finally { syncing = false; }
}
function connection() { $('#connection').textContent = navigator.onLine ? '● Online' : '○ Offline'; }
window.addEventListener('online', () => { connection(); sync(); });
window.addEventListener('offline', connection);
document.addEventListener('visibilitychange', () => { if (!document.hidden) { tick(); sync(); } });
window.addEventListener('pageshow', tick);
window.addEventListener('storage', event => { if (event.key?.startsWith('cert-practice.')) { state = readState(); content = readContent(); if (screen === 'quiz' && !active()) { result = state.exams[selected]?.history[0]; screen = result ? 'results' : 'home'; } expire(); render(); } });
connection();
if (!expire()) {
  const latestActive = Object.values(state.exams).map(e => e.active).filter(Boolean).sort((a,b) => b.startedAt - a.startedAt)[0];
  if (latestActive) { selected = latestActive.examId; screen = 'quiz'; }
}
render(); sync(); setInterval(tick, 500);
if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(() => notice('Offline app caching is unavailable. Use HTTPS or localhost to enable it.'));
