const root = document.querySelector('.premium-desk');
const $ = s => document.querySelector(s);
const key = 'raisina-desk-v1';
let state = {topics: ['policy', 'economy', 'business'], density: 'comfortable', seen: []};
try { const saved = JSON.parse(localStorage.getItem(key)); if (saved && Array.isArray(saved.topics) && Array.isArray(saved.seen)) state = {...state, ...saved, topics: saved.topics.filter(t => ['policy','economy','business'].includes(t))}; } catch { /* Private browsing keeps a usable session desk. */ }
const previous = new Set(state.seen);
let returningVisit = Boolean(state.lastVisit);
let posts = [];
const node = (tag, text, cls) => { const el = document.createElement(tag); if (text) el.textContent = text; if (cls) el.className = cls; return el; };
const link = (text, url) => { const el = node('a', text); try { const u = new URL(url, location.href); if (['https:', 'http:'].includes(u.protocol)) el.href = u.href; } catch { /* Invalid source stays plain text. */ } return el; };
const get = async path => { const response = await fetch(path); if (!response.ok) throw Error('Unavailable'); return response.json(); };
function persist() { try { localStorage.setItem(key, JSON.stringify(state)); $('#preference-status').textContent = 'Your desk is saved in this browser.'; } catch { $('#preference-status').textContent = 'Preferences work for this visit; browser storage is unavailable.'; } }
function apply() {
 root.dataset.density = state.density === 'compact' ? 'compact' : 'comfortable';
 $('#desk-density').value = root.dataset.density;
 document.querySelectorAll('[data-topic]').forEach(card => {card.hidden = !state.topics.includes(card.dataset.topic);});
 document.querySelectorAll('#preferences input').forEach(input => { input.checked = state.topics.includes(input.value); });
}
function renderPosts() {
 const category = {policy: ['Governance','The Power Brief'], economy: ['Business','Reporting'], business: ['Business']};
 const allowed = new Set(state.topics.flatMap(t => category[t] || []));
 const selected = posts.filter(p => allowed.has(p.category)).slice(0,3);
 const list = $('#briefing-list'); list.replaceChildren();
 if (!selected.length) { list.append(node('p', state.topics.length ? 'No editions match this focus in the current feed. Explore the full archive or choose another topic.' : 'Choose a topic above to compose your reading list.')); return; }
 selected.forEach((p, i) => {
  const article = node('article', null, 'briefing-item'); article.append(node('span', String(i+1).padStart(2,'0'), 'briefing-number'));
  const content = node('div'); content.append(node('span', `${p.category} · ${p.date}${returningVisit && !previous.has(p.url) ? ' · New to your desk' : ''}`, 'briefing-meta'));
  const h = node('h3'); h.append(link(p.title, p.url)); content.append(h, node('p', p.description)); article.append(content); list.append(article);
 });
 const words = selected.reduce((sum,p) => sum + (p.title+' '+p.description).split(/\s+/).length, 0);
 list.append(node('p', `Your ${selected.length}-edition selection ends here. About ${Math.max(1,Math.ceil(words/220))} min of preview reading.`, 'desk-caption'));
}
apply();
document.querySelectorAll('#preferences input').forEach(input => input.addEventListener('change', () => { state.topics = [...document.querySelectorAll('#preferences input:checked')].map(i => i.value); apply(); renderPosts(); persist(); }));
$('#desk-density').addEventListener('change', event => { state.density = event.target.value; apply(); persist(); });
$('#desk-reset').addEventListener('click', () => { state = {topics:['policy','economy','business'],density:'comfortable',seen:[]}; previous.clear(); returningVisit = false; apply(); renderPosts(); try { localStorage.removeItem(key); } catch {} $('#preference-status').textContent = 'Desk preferences and visit history cleared.'; $('#visit-status').textContent = 'Your desk has been reset.'; });
$('#desk-print').addEventListener('click', () => window.print());
get('posts.json').then(data => {
 posts = data.articles;
 const last = state.lastVisit;
 const fresh = posts.filter(p => !previous.has(p.url)).length;
 $('#visit-status').textContent = last ? `${fresh} edition${fresh === 1 ? '' : 's'} added to the current feed since your last visit on ${new Date(last).toLocaleDateString('en-GB')}. Latest available: ${posts[0]?.date || 'not dated'}.` : `Welcome to your desk. Latest available edition: ${posts[0]?.date || 'not dated'}.`;
 renderPosts(); state.seen = posts.map(p => p.url); state.lastVisit = new Date().toISOString();
 try { localStorage.setItem(key, JSON.stringify(state)); } catch {}
}).catch(() => { $('#visit-status').textContent = 'The briefing could not load. Your research tools remain available.'; $('#briefing-list').append(link('Open the latest editions', 'index.html#latest')); });
get('data/dpdp-timeline.json').then(data => {
 const record = $('#policy-record'); record.replaceChildren(node('p', `Record reviewed ${data.asOf}.`,'desk-caption'));
 const event = data.events.find(e => e.id === 'rules');
 if (event) { record.append(node('p', `${event.date} · ${event.detail}`), link('Read the original notification', event.url)); }
 const next = data.events.find(e => e.status === 'scheduled' && e.date >= new Date().toISOString().slice(0,10));
 record.append(node('p', next ? `Next recorded stage: ${next.date}. ${next.detail}` : 'No future stage remains in this recorded schedule. Check the source for later developments.'));
}).catch(() => { $('#policy-record').textContent = 'The record is unavailable. Open the full timeline for source documents.'; });
function download(text, name, type) { const url = URL.createObjectURL(new Blob([text],{type})); const a = node('a'); a.href=url; a.download=name; document.body.append(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(url),1000); }
const escapeICS = s => String(s).replace(/\\/g,'\\\\').replace(/\r?\n/g,'\\n').replace(/,/g,'\\,').replace(/;/g,'\\;');
get('data/release-calendar.json').then(data => {
 const upcoming = data.events.filter(e => e.date >= new Date().toISOString().slice(0,10)).sort((a,b)=>a.date.localeCompare(b.date));
 const rail = $('#desk-calendar'); rail.replaceChildren();
 upcoming.slice(0,3).forEach(e => { const card=node('article',null,'bento-card'); card.append(node('span',e.date,'eyebrow'),node('h3',e.title),node('p',`${e.category} · Scheduled, subject to amendment`),link('Primary source',e.source)); rail.append(card); });
 if (!upcoming.length) rail.append(node('p','No future dates remain in the recorded schedule. Check the ministry calendar for an updated release plan.'));
 $('#calendar-download').disabled = !upcoming.length;
 $('#calendar-download').addEventListener('click', () => {
  const stamp = new Date().toISOString().replace(/[-:]/g,'').replace(/\.\d{3}/,'');
  const lines=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//The Raisina Post//Research Calendar//EN','CALSCALE:GREGORIAN'];
  upcoming.forEach(e => { const end=new Date(e.date+'T00:00:00Z'); end.setUTCDate(end.getUTCDate()+1); lines.push('BEGIN:VEVENT',`UID:raisina-${e.date}-${encodeURIComponent(e.title)}@theraisinapost.github.io`,`DTSTAMP:${stamp}`,`DTSTART;VALUE=DATE:${e.date.replaceAll('-','')}`,`DTEND;VALUE=DATE:${end.toISOString().slice(0,10).replaceAll('-','')}`,`SUMMARY:${escapeICS(e.title+' (scheduled)')}`,`DESCRIPTION:${escapeICS('Planned release; dates may change. Source: '+e.source)}`,'END:VEVENT'); });
  lines.push('END:VCALENDAR');
  const folded=lines.map(line=>{let parts=[],part='',bytes=0;for(const ch of line){const size=new TextEncoder().encode(ch).length;if(bytes+size>74){parts.push(part);part=' ';bytes=1;}part+=ch;bytes+=size;}parts.push(part);return parts.join('\r\n');}).join('\r\n')+'\r\n';
  download(folded,'raisina-release-calendar.ics','text/calendar;charset=utf-8');
 });
}).catch(() => { $('#desk-calendar').replaceChildren(node('p','Calendar unavailable. Open the complete schedule below for source links.')); });
