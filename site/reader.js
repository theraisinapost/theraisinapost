/* The Raisina Post — browser-only reading desk. No tracking, accounts or external libraries. */
(() => {
  'use strict';
  const STORAGE_KEY = 'raisina-reading-queue-v1';
  const SECTIONS = ['The Power Brief', 'Business', 'Governance'];
  const homeURL = 'index.html';
  const validURL = url => typeof url === 'string' && /^https:\/\/raisinapost\.substack\.com\/p\/[a-z0-9-]+$/i.test(url);
  const normalize = str => String(str || '').toLocaleLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '');
  const create = (tag, cls, text) => {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text !== undefined) node.textContent = text;
    return node;
  };
  function loadSaved() {
    try {
      const data = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      if (!Array.isArray(data)) return [];
      return data.filter(item => item && validURL(item.url) && typeof item.title === 'string')
        .slice(0, 150);
    } catch (_) { return []; }
  }
  function persistSaved(items) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(items)); return true; }
    catch (_) { return false; }
  }
  let saved = loadSaved();
  let postsPromise;
  function getPosts() {
    if (!postsPromise) postsPromise = fetch('posts.json', {cache: 'no-store'})
      .then(res => { if (!res.ok) throw Error('Archive unavailable'); return res.json(); })
      .then(data => {
        if (!Array.isArray(data.articles)) throw Error('Malformed article index');
        return data.articles.filter(p => p && validURL(p.url) && typeof p.title === 'string' &&
          typeof p.date_iso === 'string');
      }).catch(() => { postsPromise = null; throw Error('Archive unavailable'); });
    return postsPromise;
  }
  const isSaved = url => saved.some(p => p.url === url);
  function refreshSavedButtons() {
    document.querySelectorAll('[data-save-story]').forEach(button => {
      const exists = isSaved(button.dataset.saveStory);
      button.hidden = false;
      button.textContent = exists ? 'Saved' : 'Save';
      button.setAttribute('aria-label', exists ? 'Remove from reading list' : 'Save to reading list');
      button.setAttribute('aria-pressed', String(exists));
      button.classList.toggle('is-saved', exists);
    });
    const count = document.getElementById('obs-saved-count');
    if (count) count.textContent = String(saved.length);
  }
  async function toggleSaved(url) {
    if (!validURL(url)) return;
    if (isSaved(url)) {
      saved = saved.filter(item => item.url !== url);
    } else {
      let posts;
      try { posts = await getPosts(); } catch (_) { return; }
      const post = posts.find(item => item.url === url);
      if (!post) return;
      saved = [{url: post.url, title: post.title, date_iso: post.date_iso, category: post.category}, ...saved].slice(0,150);
    }
    if (!persistSaved(saved)) {
      // Storage can be disabled; keep queue usable for this browser session.
    }
    refreshSavedButtons();
    renderQueue();
    if (document.getElementById('obs-saved-only')?.getAttribute('aria-pressed') === 'true') renderStories();
  }
  document.addEventListener('click', event => {
    const save = event.target.closest('[data-save-story]');
    if (save) { event.preventDefault(); toggleSaved(save.dataset.saveStory); }
    const remove = event.target.closest('[data-queue-remove]');
    if (remove) { event.preventDefault(); toggleSaved(remove.dataset.queueRemove); }
  });

  // Accessible native command dialog, invoked only by a click or keyboard shortcut.
  const dialog = create('dialog', 'story-palette');
  dialog.id = 'story-palette';
  dialog.setAttribute('aria-label', 'Find articles and pages');
  dialog.innerHTML = '<div class="palette-header"><label for="palette-query" class="sr-only">Search titles, topics and pages</label><input id="palette-query" type="search" placeholder="Search the publication" autocomplete="off"><button type="button" id="palette-close" aria-label="Close search">Close</button></div><p class="palette-eyebrow">STORIES &amp; DESTINATIONS</p><ul id="palette-results" class="palette-results"></ul><p class="palette-tip">Press ⌘K or Ctrl+K to open · Esc to close</p>';
  document.body.appendChild(dialog);
  const paletteInput = dialog.querySelector('#palette-query');
  const paletteResults = dialog.querySelector('#palette-results');
  const destinations = [
    {title: 'Observatory', caption: 'Explore publishing activity and your saved stories', url:'observatory.html'},
    {title: 'Full archive', caption:'Browse the original Substack archive', url:'https://raisinapost.substack.com/archive'},
    {title: 'About The Raisina Post', caption: 'The publication and its coverage', url:'about.html'},
    {title: 'Publication guide', caption:'Editorial standards and corrections', url:'publication-guide.html'}
  ];
  let paletteItems = [];
  function appendPaletteItem(item) {
    const li = create('li');
    const link = create('a', 'palette-item');
    link.href = item.url;
    if (item.url.startsWith('https://')) { link.target = '_blank'; link.rel = 'noopener noreferrer'; }
    const title = create('span', 'palette-item-title', item.title);
    const subtitle = create('span', 'palette-item-caption', item.caption);
    link.append(title, subtitle);
    li.appendChild(link);
    paletteResults.appendChild(li);
  }
  function paintPalette() {
    const query = normalize(paletteInput.value.trim());
    const items = [
      ...destinations,
      ...paletteItems.map(item => ({
        title: item.title, caption: [item.category, item.date].filter(Boolean).join(' · '), url: item.url
      }))
    ].filter(item => !query || normalize(item.title + ' ' + item.caption).includes(query)).slice(0, 14);
    paletteResults.replaceChildren();
    if (!items.length) {
      const li = create('li', 'palette-empty', 'No matching stories in the current RSS index.');
      paletteResults.append(li);
    } else items.forEach(appendPaletteItem);
  }
  async function openPalette() {
    if (dialog.open) return;
    paletteInput.value = '';
    paintPalette();
    dialog.showModal();
    paletteInput.focus();
    try { paletteItems = await getPosts(); if (dialog.open) paintPalette(); }
    catch (_) { if (dialog.open) paintPalette(); }
  }
  document.querySelectorAll('[data-open-palette]').forEach(btn => btn.addEventListener('click', openPalette));
  dialog.querySelector('#palette-close').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close(); });
  dialog.addEventListener('close', () => { const focus = document.querySelector('[data-open-palette]'); focus?.focus({preventScroll:true}); });
  paletteInput.addEventListener('input', paintPalette);
  paletteInput.addEventListener('keydown', event => {
    if (event.key === 'ArrowDown') { event.preventDefault(); paletteResults.querySelector('a')?.focus(); }
    if (event.key === 'Enter') { const link = paletteResults.querySelector('a'); if (link) { event.preventDefault(); link.click(); } }
  });
  paletteResults.addEventListener('keydown', event => {
    const links = [...paletteResults.querySelectorAll('a')];
    const current = links.indexOf(document.activeElement);
    if (event.key === 'ArrowDown') { event.preventDefault(); links[Math.min(current + 1, links.length - 1)]?.focus(); }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (current <= 0) paletteInput.focus(); else links[current - 1]?.focus();
    }
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && dialog.open) {
      event.preventDefault();
      dialog.close();
      return;
    }
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      if (dialog.open) dialog.close(); else openPalette();
    }
  });
  refreshSavedButtons();

  // Reading desk features only initialize on the dedicated page.
  const list = document.getElementById('obs-story-list');
  if (!list) return;
  let obsPosts = [];
  let activeCategory = 'All';
  const search = document.getElementById('obs-search');
  const filterButtons = [...document.querySelectorAll('[data-obs-filter]')];
  const savedOnly = document.getElementById('obs-saved-only');

  const shortDate = iso => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(iso || '')) return 'Unknown date';
    return new Date(iso + 'T12:00:00Z').toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'});
  };
  const dayFrom = iso => new Date(iso + 'T12:00:00Z');

  function renderPulse() {
    const svg = document.getElementById('obs-pulse');
    const current = obsPosts.filter(p => /^\d{4}-\d{2}-\d{2}$/.test(p.date_iso));
    if (!current.length) { svg.setAttribute('aria-label', 'No publishing dates available'); return; }
    const maxISO = current.map(p => p.date_iso).sort().at(-1);
    const end = dayFrom(maxISO);
    const days = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date(end.getTime() - i * 86400000);
      const iso = d.toISOString().slice(0, 10);
      days.push({iso, date:d, count: current.filter(p => p.date_iso === iso).length});
    }
    const max = Math.max(1, ...days.map(x=>x.count));
    const ns = 'http://www.w3.org/2000/svg';
    const elem = (tag, attrs, text) => {
      const node = document.createElementNS(ns, tag);
      Object.entries(attrs).forEach(([k,v]) => node.setAttribute(k, String(v)));
      if (text !== undefined) node.textContent = String(text);
      return node;
    };
    svg.replaceChildren();
    svg.setAttribute('aria-label', 'Articles per day from '+shortDate(days[0].iso)+' to '+shortDate(maxISO)+' in the current RSS index');
    svg.appendChild(elem('line', {x1:18,y1:160,x2:742,y2:160,stroke:'#dddddd','stroke-width':1}));
    days.forEach((day, index) => {
      const x = 22 + index * 51.4;
      const height = day.count ? Math.max(11, day.count / max * 125) : 0;
      if (height) svg.appendChild(elem('rect',{x,y:160-height,width:23,height,rx:3,fill:'#a41129'}));
      if (index % 2 === 0 || index === 13) {
        svg.appendChild(elem('text',{x:x+12,y:181,'text-anchor':'middle','font-size':'10',fill:'#555555','font-family':'Geist, sans-serif'},day.date.toLocaleDateString('en-GB',{day:'numeric',month:'short',timeZone:'UTC'})));
      }
      if (day.count) svg.appendChild(elem('text',{x:x+12,y:Math.max(14,152-height),'text-anchor':'middle','font-size':'11',fill:'#444444','font-family':'Geist, sans-serif'},day.count));
    });
    const total = document.getElementById('obs-count');
    if (total) total.textContent = String(obsPosts.length);
    const latest = document.getElementById('obs-latest');
    if (latest) latest.textContent = shortDate(maxISO);
    const distribution = document.getElementById('obs-distribution');
    distribution.replaceChildren();
    const groups = [...SECTIONS,'Reporting'];
    groups.forEach(group => {
      const n = obsPosts.filter(p => p.category === group).length;
      if (!n) return;
      const item=create('div','obs-distribution-row');
      const heading=create('div','obs-distribution-head');
      heading.append(create('span','',group),create('strong','',String(n)));
      const track=create('div','obs-distribution-track');
      const fill=create('span','obs-distribution-fill');
      fill.style.width=(n / obsPosts.length * 100).toFixed(1)+'%';
      track.append(fill); item.append(heading,track); distribution.append(item);
    });
  }
  function currentRows() {
    const q = normalize(search.value.trim());
    const only = savedOnly.getAttribute('aria-pressed') === 'true';
    return obsPosts.filter(p => (activeCategory === 'All' || p.category === activeCategory) &&
      (!only || isSaved(p.url)) &&
      (!q || normalize(p.title+' '+p.description+' '+p.category).includes(q)));
  }
  function makeStory(post) {
    const row=create('article','obs-story');
    const meta=create('div','obs-story-meta');
    meta.append(create('span','',post.category || 'Reporting'),create('time','',shortDate(post.date_iso)));
    const time=meta.querySelector('time'); time.dateTime=post.date_iso;
    const body=create('div','obs-story-body');
    const heading=create('h3');
    const link=create('a','',post.title); link.href=post.url; link.target='_blank'; link.rel='noopener noreferrer';
    heading.append(link);
    const desc=create('p','',post.description || '');
    body.append(heading,desc);
    const save=create('button','story-save',isSaved(post.url)?'Saved':'Save');
    save.type='button'; save.dataset.saveStory=post.url;
    row.append(meta,body,save);
    return row;
  }
  function renderStories() {
    const result=currentRows();
    list.replaceChildren();
    const status=document.getElementById('obs-status');
    status.textContent=result.length+' '+(result.length===1?'story':'stories')+' in this view';
    if (!result.length) {
      list.append(create('p','obs-empty','No matching stories. Try clearing the search or saved filter.'));
    } else result.forEach(post=>list.append(makeStory(post)));
    refreshSavedButtons();
  }
  function renderQueue() {
    const queue = document.getElementById('obs-queue-list');
    if (!queue) return;
    queue.replaceChildren();
    if (!saved.length) {
      queue.append(create('p','obs-empty','No saved stories yet. Choose Save on a story to add it here.'));
    } else saved.forEach(item=>{
      const row=create('div','obs-queue-item');
      const link=create('a','',item.title);link.href=item.url;link.target='_blank';link.rel='noopener noreferrer';
      const remove=create('button','obs-remove','Remove');remove.type='button';remove.dataset.queueRemove=item.url;
      row.append(link,remove);queue.append(row);
    });
  }
  search.addEventListener('input',renderStories);
  filterButtons.forEach(btn=>btn.addEventListener('click',()=>{
    activeCategory=btn.dataset.obsFilter;
    filterButtons.forEach(x=>{const active=x===btn;x.classList.toggle('is-active',active);x.setAttribute('aria-pressed',String(active));});
    renderStories();
  }));
  savedOnly.addEventListener('click',()=>{
    const value=savedOnly.getAttribute('aria-pressed') !== 'true';
    savedOnly.setAttribute('aria-pressed',String(value));
    savedOnly.classList.toggle('is-active',value);
    renderStories();
  });
  document.getElementById('obs-random').addEventListener('click',()=>{
    const options=currentRows().length?currentRows():obsPosts;
    if (!options.length) return;
    const target=options[Math.floor(Math.random()*options.length)];
    if (validURL(target.url)) window.open(target.url,'_blank','noopener,noreferrer');
  });
  renderQueue();
  getPosts().then(posts=>{
    obsPosts=posts;
    renderPulse();
    renderStories();
  }).catch(()=>{
    const status=document.getElementById('obs-status');
    status.textContent='The RSS index is temporarily unavailable. The original Substack archive is still accessible.';
  });
})();
