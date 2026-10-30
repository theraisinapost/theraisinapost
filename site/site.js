(() => {
  'use strict';
  const buttons = [...document.querySelectorAll('[data-filter]')];
  const rows = [...document.querySelectorAll('.article-row')];
  const search = document.getElementById('article-search');
  const label = document.getElementById('result-label');
  const empty = document.getElementById('empty-state');
  const clear = document.getElementById('clear-filters');
  let current = 'All';
  const normalize = value => (value || '').toLocaleLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '');

  function apply() {
    const query = normalize(search.value.trim());
    let visible = 0;
    rows.forEach(row => {
      const section = row.dataset.category;
      const searchable = normalize(row.dataset.title + ' ' + row.dataset.summary + ' ' + section);
      const matches = (current === 'All' || section === current) && (!query || searchable.includes(query));
      row.hidden = !matches;
      if (matches) visible++;
    });
    buttons.forEach(button => {
      const active = button.dataset.filter === current;
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', String(active));
    });
    label.textContent = `${visible} ${visible === 1 ? 'dispatch' : 'dispatches'} showing`;
    empty.hidden = visible > 0;
  }
  buttons.forEach(button => button.addEventListener('click', () => { current = button.dataset.filter; apply(); }));
  document.querySelectorAll('[data-nav-filter]').forEach(link => link.addEventListener('click', () => {
    current = link.dataset.navFilter;
    search.value = '';
    apply();
  }));
  search.addEventListener('input', apply);
  clear.addEventListener('click', () => {current = 'All'; search.value = ''; apply(); search.focus();});
  apply();
})();
