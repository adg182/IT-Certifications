export const flashcardDecks = new Map([
  ['aws-cloud-practitioner', {
    buttonLabel: 'Study AWS flashcards',
    title: 'AWS CLF-C02 service flashcards',
    intro: 'Recall what an in-scope service does, then reveal an example of when to use it.',
    file: './flashcards/aws-services.json',
    learnedKey: 'aws-flashcards.learned.v1',
    topicLabel: 'services',
    placeholder: 'Try Lambda or storage',
    groupLabel: 'Category',
    allGroupsLabel: 'All categories',
    reverseLabel: 'Guess the service',
    referenceUrl: 'https://docs.aws.amazon.com/aws-certification/latest/cloud-practitioner-02/clf-02-in-scope-services.html',
    referenceLabel: 'CLF-C02 in-scope services list',
    referenceNote: ' Use the full exam guide for concepts and objectives.'
  }],
  ['comptia-security-plus', {
    buttonLabel: 'Study Security+ flashcards',
    title: 'CompTIA Security+ SY0-701 flashcards',
    intro: 'Recall security concepts and see how they apply in short examples.',
    file: './flashcards/security-plus-sy0-701.json',
    learnedKey: 'security-plus-flashcards.learned.v1',
    topicLabel: 'security topics',
    placeholder: 'Try SIEM or objective 4.9',
    groupLabel: 'Domain',
    allGroupsLabel: 'All domains',
    reverseLabel: 'Guess the term',
    referenceUrl: 'https://lecbyo.files.cmp.optimizely.com/download/cf25ec24b8a511ef9ecbb69c0f9687be',
    referenceLabel: 'SY0-701 exam objectives',
    referenceNote: ''
  }]
]);

const sessions = new WeakMap();

function sessionFor(deck) {
  if (!sessions.has(deck)) {
    const session = {
      request: undefined,
      query: '',
      category: '',
      unlearnedOnly: false,
      reverse: false,
      position: 0,
      order: undefined,
      learned: new Set()
    };
    try {
      const saved = JSON.parse(localStorage.getItem(deck.learnedKey));
      if (Array.isArray(saved)) session.learned = new Set(saved);
    } catch {
      // Study sessions still work when browser storage is unavailable.
    }
    sessions.set(deck, session);
  }
  return sessions.get(deck);
}

function loadDeck(deck, session) {
  session.request ??= fetch(deck.file).then(async response => {
    if (!response.ok) throw new Error('Deck unavailable');
    return response.json();
  }).catch(error => {
    session.request = undefined;
    throw error;
  });
  return session.request;
}

export async function showFlashcards(main, deck) {
  const session = sessionFor(deck);
  main.innerHTML = `
    <div class="intro"><h1>${deck.title}</h1><p>${deck.intro}</p></div>
    <section class="panel" aria-label="Flashcard deck"><p role="status">Loading flashcards…</p></section>
  `;
  const panel = main.querySelector('section');
  try {
    const cards = await loadDeck(deck, session);
    if (panel.isConnected) setupDeck(panel, cards, deck, session);
  } catch {
    if (!panel.isConnected) return;
    panel.innerHTML = '<p role="status">The deck couldn’t load. Connect to the internet and try again.</p><button type="button">Retry</button>';
    panel.querySelector('button').onclick = () => showFlashcards(main, deck);
  }
}

function setupDeck(panel, cards, deck, session) {
  const {learned} = session;
  panel.innerHTML = `
    <div class="flash-filters">
      <label>Search ${deck.topicLabel} <input type="search" id="flash-search" placeholder="${deck.placeholder}"></label>
      <label>${deck.groupLabel} <select id="flash-category"><option value="">${deck.allGroupsLabel}</option></select></label>
    </div>
    <div class="flash-options">
      <label><input type="checkbox" id="flash-unlearned"> Unlearned only</label>
      <label><input type="checkbox" id="flash-reverse"> ${deck.reverseLabel}</label>
      <button type="button" class="secondary" id="flash-shuffle">Shuffle</button>
    </div>
    <p id="flash-progress" class="muted" role="status"></p>
    <article class="flash-card" aria-labelledby="flash-name">
      <p id="flash-label" class="eyebrow"></p>
      <h2 id="flash-name" aria-live="polite"></h2>
      <p id="flash-availability" hidden>Maintenance. AWS does not onboard new customers.</p>
      <button type="button" id="flash-reveal" aria-expanded="false" aria-controls="flash-back">Reveal answer</button>
      <div id="flash-back" hidden>
        <p id="flash-definition"></p>
        <p><strong>Example:</strong> <span id="flash-example"></span></p>
        <a id="flash-docs" target="_blank" rel="noopener noreferrer">AWS service page ↗</a>
      </div>
    </article>
    <div class="flash-actions">
      <button type="button" class="secondary" id="flash-prev">← Previous</button>
      <button type="button" class="secondary" id="flash-learned" aria-pressed="false">Mark learned</button>
      <button type="button" id="flash-next">Next →</button>
    </div>
    <p id="flash-storage-status" class="muted" role="status"></p>
    <p class="fine-print">This deck follows the <a href="${deck.referenceUrl}">${deck.referenceLabel}</a>.${deck.referenceNote}</p>
  `;
  const get = id => panel.querySelector('#flash-' + id);
  const search = get('search'), select = get('category'), filter = get('unlearned'), flip = get('reverse');
  const previous = get('prev'), next = get('next'), reveal = get('reveal'), mark = get('learned');
  const article = panel.querySelector('article');
  for (const label of [...new Set(cards.map(card => card.category))].sort()) {
    select.add(new Option(label, label));
  }
  search.value = session.query;
  select.value = session.category;
  filter.checked = session.unlearnedOnly;
  flip.checked = session.reverse;
  let visible = [];
  let current;

  function render() {
    const term = session.query.trim().toLowerCase();
    visible = (session.order || cards).filter(card =>
      (!session.category || card.category === session.category) &&
      (!session.unlearnedOnly || !learned.has(card.id)) &&
      `${card.name} ${card.category} ${card.definition}${card.objective ? ' objective ' + card.objective : ''}`.toLowerCase().includes(term)
    );
    session.position = Math.max(0, Math.min(session.position, visible.length - 1));
    current = visible[session.position];
    const totalLearned = cards.filter(card => learned.has(card.id)).length;
    get('progress').textContent = current
      ? `Card ${session.position + 1} of ${visible.length} · ${totalLearned} of ${cards.length} learned`
      : `No cards match these filters. ${totalLearned} of ${cards.length} learned.`;
    previous.disabled = session.position === 0;
    next.disabled = session.position >= visible.length - 1;
    mark.disabled = !current;
    article.hidden = !current;
    get('shuffle').disabled = visible.length < 2;
    const isLearned = !!current && learned.has(current.id);
    mark.setAttribute('aria-pressed', String(isLearned));
    mark.textContent = isLearned ? 'Mark unlearned' : 'Mark learned';
    if (!current) return;
    get('label').textContent = current.objective ? `${current.category} · Objective ${current.objective}` : current.category;
    get('name').textContent = session.reverse ? current.definition : current.name;
    get('definition').textContent = session.reverse ? current.name : current.definition;
    get('example').textContent = current.example;
    const docs = get('docs');
    docs.hidden = !current.url;
    if (current.url) docs.href = current.url;
    else docs.removeAttribute('href');
    get('availability').hidden = true;
    get('back').hidden = true;
    reveal.setAttribute('aria-expanded', 'false');
    reveal.textContent = 'Reveal answer';
  }

  search.oninput = () => { session.query = search.value; session.position = 0; render(); };
  select.onchange = () => { session.category = select.value; session.position = 0; render(); };
  filter.onchange = () => { session.unlearnedOnly = filter.checked; session.position = 0; render(); };
  flip.onchange = () => { session.reverse = flip.checked; render(); };
  previous.onclick = () => { session.position--; render(); };
  next.onclick = () => { session.position++; render(); };
  reveal.onclick = () => {
    const showing = get('back').hidden;
    get('back').hidden = !showing;
    get('availability').hidden = !showing || !current.maintenance;
    reveal.setAttribute('aria-expanded', String(showing));
    reveal.textContent = showing ? 'Hide answer' : 'Reveal answer';
  };
  mark.onclick = () => {
    if (learned.has(current.id)) learned.delete(current.id);
    else learned.add(current.id);
    try {
      localStorage.setItem(deck.learnedKey, JSON.stringify([...learned]));
    } catch {
      get('storage-status').textContent = 'Learned status can’t be saved on this device.';
    }
    render();
  };
  get('shuffle').onclick = () => {
    session.order = [...cards];
    for (let i = session.order.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [session.order[i], session.order[j]] = [session.order[j], session.order[i]];
    }
    session.position = 0;
    render();
  };
  render();
}
