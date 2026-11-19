const catalogUrl = 'https://aws.amazon.com/products/';
const learnedKey = 'aws-flashcards.learned.v1';
let deckRequest;
let query = '';
let category = '';
let unlearnedOnly = false;
let reverse = false;
let position = 0;
let order;
let learned = new Set();

try {
  const saved = JSON.parse(localStorage.getItem(learnedKey));
  if (Array.isArray(saved)) learned = new Set(saved);
} catch {
  // Study sessions still work when browser storage is unavailable.
}

function loadDeck() {
  deckRequest ??= fetch('./flashcards/aws-services.json').then(async response => {
    if (!response.ok) throw new Error('Deck unavailable');
    return response.json();
  }).catch(error => {
    deckRequest = undefined;
    throw error;
  });
  return deckRequest;
}

export async function showFlashcards(main) {
  main.innerHTML = `
    <div class="intro"><h1>AWS service flashcards</h1><p>Recall what a service does, then reveal an example of when to use it.</p></div>
    <section class="panel" aria-label="AWS flashcard deck"><p role="status">Loading AWS services…</p></section>
  `;
  const panel = main.querySelector('section');
  try {
    const cards = await loadDeck();
    if (panel.isConnected) setupDeck(panel, cards);
  } catch {
    if (!panel.isConnected) return;
    panel.innerHTML = '<p role="status">The deck couldn’t load. Connect to the internet and try again.</p><button type="button">Retry</button>';
    panel.querySelector('button').onclick = () => showFlashcards(main);
  }
}

function setupDeck(panel, cards) {
  panel.innerHTML = `
    <div class="flash-filters">
      <label>Search services <input type="search" id="flash-search" placeholder="Try Lambda or storage"></label>
      <label>Category <select id="flash-category"><option value="">All categories</option></select></label>
    </div>
    <div class="flash-options">
      <label><input type="checkbox" id="flash-unlearned"> Unlearned only</label>
      <label><input type="checkbox" id="flash-reverse"> Guess the service</label>
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
    <p class="fine-print">Services and selected tools from AWS’s public catalog and documentation. Check <a href="${catalogUrl}">AWS</a> for new products and availability.</p>
  `;
  const get = id => panel.querySelector('#flash-' + id);
  const search = get('search'), select = get('category'), filter = get('unlearned'), flip = get('reverse');
  const previous = get('prev'), next = get('next'), reveal = get('reveal'), mark = get('learned');
  const article = panel.querySelector('article');
  for (const label of [...new Set(cards.map(card => card.category))].sort()) {
    select.add(new Option(label, label));
  }
  search.value = query;
  select.value = category;
  filter.checked = unlearnedOnly;
  flip.checked = reverse;
  let visible = [];
  let current;

  function render() {
    const term = query.trim().toLowerCase();
    visible = (order || cards).filter(card =>
      (!category || card.category === category) &&
      (!unlearnedOnly || !learned.has(card.id)) &&
      `${card.name} ${card.category} ${card.definition}`.toLowerCase().includes(term)
    );
    position = Math.max(0, Math.min(position, visible.length - 1));
    current = visible[position];
    const totalLearned = cards.filter(card => learned.has(card.id)).length;
    get('progress').textContent = current
      ? `Card ${position + 1} of ${visible.length} · ${totalLearned} of ${cards.length} learned`
      : `No cards match these filters. ${totalLearned} of ${cards.length} learned.`;
    previous.disabled = position === 0;
    next.disabled = position >= visible.length - 1;
    mark.disabled = !current;
    article.hidden = !current;
    get('shuffle').disabled = visible.length < 2;
    const isLearned = !!current && learned.has(current.id);
    mark.setAttribute('aria-pressed', String(isLearned));
    mark.textContent = isLearned ? 'Mark unlearned' : 'Mark learned';
    if (!current) return;
    get('label').textContent = current.category;
    get('name').textContent = reverse ? current.definition : current.name;
    get('definition').textContent = reverse ? current.name : current.definition;
    get('example').textContent = current.example;
    get('docs').href = current.url;
    get('availability').hidden = true;
    get('back').hidden = true;
    reveal.setAttribute('aria-expanded', 'false');
    reveal.textContent = 'Reveal answer';
  }

  search.oninput = () => { query = search.value; position = 0; render(); };
  select.onchange = () => { category = select.value; position = 0; render(); };
  filter.onchange = () => { unlearnedOnly = filter.checked; position = 0; render(); };
  flip.onchange = () => { reverse = flip.checked; render(); };
  previous.onclick = () => { position--; render(); };
  next.onclick = () => { position++; render(); };
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
      localStorage.setItem(learnedKey, JSON.stringify([...learned]));
    } catch {
      get('storage-status').textContent = 'Learned status can’t be saved on this device.';
    }
    render();
  };
  get('shuffle').onclick = () => {
    order = [...cards];
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
    position = 0;
    render();
  };
  render();
}
