(() => {
  'use strict';
  const buttons = [...document.querySelectorAll('[data-filter]')];
  const search = document.getElementById('article-search');
  const cards = [...document.querySelectorAll('.article-card')];
  const empty = document.getElementById('empty-state');
  const status = document.getElementById('result-label');
  let selected = 'All';
  function update() {
    const query = search.value.trim().toLocaleLowerCase();
    let count = 0;
    cards.forEach(card => {
      const match = (selected === 'All' || card.dataset.category === selected) &&
        (!query || `${card.dataset.title} ${card.dataset.summary} ${card.dataset.category.toLocaleLowerCase()}`.includes(query));
      card.hidden = !match;
      if (match) count++;
    });
    empty.hidden = count > 0;
    status.textContent = `${count} ${count === 1 ? 'dispatch' : 'dispatches'} shown from the latest feed · The featured dispatch appears above`;
    buttons.forEach(button => {
      const active = button.dataset.filter === selected;
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', String(active));
    });
  }
  buttons.forEach(button => button.addEventListener('click', () => { selected = button.dataset.filter; update(); }));
  search.addEventListener('input', update);
  document.getElementById('clear-filters').addEventListener('click', () => { selected = 'All'; search.value = ''; update(); search.focus(); });
  update();
})();
