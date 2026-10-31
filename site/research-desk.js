/* The Raisina Post research tools: DOM-safe, source-labelled and browser-only. */
(() => {
  'use strict';
  const kind = document.body.dataset.desk;
  if (!kind) return;
  document.querySelectorAll('.desk-subnav a').forEach(link => {
    if (link.getAttribute('href') === kind + '.html') link.setAttribute('aria-current', 'page');
  });
  const byId = id => document.getElementById(id);
  const node = (tag, text, className) => {
    const e = document.createElement(tag);
    if (text !== undefined) e.textContent = text;
    if (className) e.className = className;
    return e;
  };
  const dateLabel = date => /^\d{4}-\d{2}-\d{2}$/.test(date || '')
    ? new Date(date + 'T12:00:00Z').toLocaleDateString('en-GB', {day:'numeric',month:'short',year:'numeric',timeZone:'UTC'})
    : 'Date not verified';
  const todayIST = () => new Date(Date.now() + 330 * 60000).toISOString().slice(0, 10);
  const safeOfficial = raw => {
    try {
      const u = new URL(raw);
      return u.protocol === 'https:' &&
        ['sebi.gov.in','www.sebi.gov.in','pib.gov.in','www.pib.gov.in'].includes(u.hostname) &&
        !u.username && !u.password;
    } catch (_) { return false; }
  };
  const sourceLink = (url, title) => {
    const a = node('a', title);
    a.href = url;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    return a;
  };

  if (kind === 'policy-monitor') {
    const list = byId('regulatory-list'), status = byId('regulatory-status');
    const search = byId('regulatory-search'), source = byId('regulatory-source');
    let items = [];
    const render = () => {
      const q = search.value.trim().toLocaleLowerCase();
      const filtered = items.filter(x => (source.value === 'All' || x.institution === source.value) &&
        (!q || (x.title + ' ' + x.summary).toLocaleLowerCase().includes(q)));
      list.replaceChildren();
      filtered.forEach(item => {
        const record = node('article', undefined, 'desk-record');
        const meta = node('div', undefined, 'desk-record-meta');
        meta.append(node('strong', item.institution), node('time', dateLabel(item.date)));
        const body = node('div', undefined, 'desk-record-body');
        body.append(sourceLink(item.url, item.title));
        if (item.summary) body.append(node('p', item.summary));
        record.append(meta, body);
        list.append(record);
      });
      status.textContent = filtered.length
        ? filtered.length + ' official-source entries in this view. Open each original for context.'
        : (items.length ? 'No entries match these filters.' : 'No verified feed entries are available. Use the official source links below.');
    };
    search.addEventListener('input', render);
    source.addEventListener('change', render);
    fetch('data/regulatory.json', {cache:'no-store'})
      .then(r => { if (!r.ok) throw Error('Feed unavailable'); return r.json(); })
      .then(data => {
        items = Array.isArray(data.items) ? data.items.filter(x =>
          x && ['SEBI','PIB'].includes(x.institution) &&
          typeof x.title === 'string' && x.title.length <= 260 &&
          (/^\d{4}-\d{2}-\d{2}$/.test(x.date) || (x.institution === 'PIB' && x.date === '')) && safeOfficial(x.url))
          .slice(0,100) : [];
        const sources = data.sources || {};
        const unavailable = ['SEBI','PIB'].filter(x => sources[x] !== 'available');
        byId('regulatory-updated').textContent = (data.checked_at
          ? 'Last source check: ' + new Date(data.checked_at).toLocaleString('en-GB',{dateStyle:'medium',timeStyle:'short',timeZone:'Asia/Kolkata'}) + ' IST'
          : 'Live feed has not been checked') + (unavailable.length ? ' · Unavailable: ' + unavailable.join(', ') : '');
        render();
      }).catch(() => { status.textContent = 'The official-source feed is temporarily unavailable. Open the original sources below.'; });
  }

  if (kind === 'india-data') {
    const indicator = byId('india-indicator'), svg = byId('india-history-chart');
    const status = byId('india-status'), rows = byId('india-data-rows');
    const allowed = new Set([...indicator.options].map(option => option.value));
    let requestNumber = 0;
    const NS = 'http://www.w3.org/2000/svg';
    const svgNode = (tag, attrs, text) => {
      const element = document.createElementNS(NS, tag);
      for (const [key, value] of Object.entries(attrs)) element.setAttribute(key, String(value));
      if (text !== undefined) element.textContent = text;
      return element;
    };
    const draw = points => {
      svg.replaceChildren();
      if (!points.length) return;
      const left = 70, right = 820, top = 25, bottom = 253;
      let lo = Math.min(...points.map(p=>p.value)), hi = Math.max(...points.map(p=>p.value));
      if (hi === lo) { hi += 1; lo -= 1; }
      const pad = (hi-lo)*.12;
      lo -= pad; hi += pad;
      const x = year => left + (year-points[0].year) / Math.max(1,points.at(-1).year-points[0].year)*(right-left);
      const y = value => bottom-(value-lo)/(hi-lo)*(bottom-top);
      for (let k=0;k<4;k++) {
        const yPos = top+(bottom-top)*k/3;
        svg.append(svgNode('line',{x1:left,y1:yPos,x2:right,y2:yPos,stroke:'#ededed','stroke-width':1}));
        svg.append(svgNode('text',{x:62,y:yPos+4,'text-anchor':'end',fill:'#666','font-size':12,'font-family':'Inter, sans-serif'},(hi-(hi-lo)*k/3).toFixed(1)+'%'));
      }
      svg.append(svgNode('polyline',{
        points: points.map(p=>x(p.year).toFixed(1)+','+y(p.value).toFixed(1)).join(' '),
        fill:'none',stroke:'#222','stroke-width':2.1,'stroke-linejoin':'round','stroke-linecap':'round'
      }));
      const last=points.at(-1);
      svg.append(svgNode('circle',{cx:x(last.year),cy:y(last.value),r:4.7,fill:'#171717'}));
      for (const p of [points[0], last]) {
        svg.append(svgNode('text',{x:x(p.year),y:284,'text-anchor':'middle',fill:'#777','font-size':12,'font-family':'Inter, sans-serif'},String(p.year)));
      }
      svg.setAttribute('aria-label',indicator.selectedOptions[0].text+' in India from '+points[0].year+' to '+last.year);
    };
    const load = async () => {
      const id = indicator.value, requestId = ++requestNumber;
      if (!allowed.has(id)) return;
      byId('india-series-label').textContent = indicator.selectedOptions[0].text;
      status.textContent = 'Loading published annual observations…';
      byId('india-latest-value').textContent = '—';
      byId('india-latest-year').textContent = 'Awaiting source';
      rows.replaceChildren(); svg.replaceChildren();
      const api = 'https://api.worldbank.org/v2/country/ind/indicator/' + encodeURIComponent(id)
        + '?format=json&per_page=100&date=2000:' + new Date().getUTCFullYear();
      byId('india-source').href = 'https://data.worldbank.org/indicator/' + id + '?locations=IN';
      try {
        const response = await fetch(api, {cache:'no-store'});
        if (!response.ok) throw Error('World Bank unavailable');
        const data = await response.json();
        if (requestId !== requestNumber) return;
        if (!Array.isArray(data) || !Array.isArray(data[1])) throw Error('No observations');
        const points = data[1].filter(p=>p && /^\d{4}$/.test(p.date) &&
          typeof p.value === 'number' && Number.isFinite(p.value))
          .map(p=>({year:Number(p.date),value:p.value}))
          .sort((a,b)=>a.year-b.year);
        if (!points.length) throw Error('No numeric observations');
        const last = points.at(-1);
        byId('india-latest-value').textContent = last.value.toLocaleString('en-IN',{maximumFractionDigits:2})+'%';
        byId('india-latest-year').textContent = 'Latest available reference year: '+last.year;
        status.textContent = points.length+' published annual observations · source: World Bank WDI · values may be revised';
        draw(points);
        points.slice().reverse().slice(0,18).forEach(p=>{
          const row = node('tr');
          row.append(node('td',String(p.year)),node('td',p.value.toLocaleString('en-IN',{maximumFractionDigits:3})));
          rows.append(row);
        });
      } catch (_) {
        if (requestId !== requestNumber) return;
        status.textContent = 'World Bank data is unavailable. Try another indicator or open the original source.';
        const row=node('tr');
        const cell=node('td','No published observations could be retrieved.');
        cell.colSpan=2;row.append(cell);rows.append(row);
      }
    };
    indicator.addEventListener('change',load);
    load();
  }

  if (kind === 'release-calendar') {
    const list=byId('release-list'), status=byId('release-status');
    const filter=byId('release-filter'), range=byId('release-range');
    let events=[];
    const render=()=>{
      const today=todayIST();
      const filtered=events.filter(x=>(filter.value==='All'||x.category===filter.value) &&
        (range.value==='all'||x.date>=today));
      list.replaceChildren();
      filtered.forEach(item=>{
        const record=node('article',undefined,'desk-record');
        const meta=node('div',undefined,'desk-record-meta');
        meta.append(node('strong',dateLabel(item.date)),
          node('span',item.date < today ? 'Planned date passed · verify' : 'Scheduled date'));
        const body=node('div',undefined,'desk-record-body');
        body.append(sourceLink(item.source,item.title), node('p',item.category+' · MoSPI advance calendar'));
        record.append(meta,body);list.append(record);
      });
      status.textContent=filtered.length ? filtered.length+' scheduled records shown. Publication is not confirmed.' :
        'No scheduled releases match this view. Check the latest official calendar.';
    };
    filter.addEventListener('change',render);range.addEventListener('change',render);
    fetch('data/release-calendar.json').then(r=>{if(!r.ok)throw Error('Not available');return r.json();})
      .then(data=>{
        events=Array.isArray(data.events)?data.events.filter(x=>x && x.status==='scheduled' &&
          /^202[6-7]-\d{2}-\d{2}$/.test(x.date) &&
          typeof x.title==='string' && typeof x.source==='string' &&
          x.source.startsWith('https://www.mospi.gov.in/')).sort((a,b)=>a.date.localeCompare(b.date)):[];
        render();
      }).catch(()=>{status.textContent='The source calendar could not be loaded. See the MoSPI document below.';});
  }

  if (kind === 'document-diff') {
    const before=byId('diff-before'),after=byId('diff-after');
    const output=byId('diff-output'), status=byId('diff-status');
    const addRow=(prefix,text,cls)=>{
      const row=node('div',undefined,'desk-diff-line '+cls);
      row.append(node('span',prefix,'prefix'),document.createTextNode(text));output.append(row);
    };
    byId('diff-run').addEventListener('click',()=>{
      const a=before.value.replace(/\r\n?/g,'\n'),b=after.value.replace(/\r\n?/g,'\n');
      output.replaceChildren();
      if(!a.trim()&&!b.trim()){status.textContent='Enter two passages to compare.';return;}
      const A=a?a.split('\n'):[],B=b?b.split('\n'):[];
      if(A.length>350||B.length>350||a.length>120000||b.length>120000){
        status.textContent='This comparison accepts up to 350 lines and 120,000 characters per version.';return;
      }
      const n=A.length,m=B.length,stride=m+1;
      const table=new Uint16Array((n+1)*(m+1));
      for(let i=n-1;i>=0;i--){
        for(let j=m-1;j>=0;j--){
          const idx=i*stride+j;
          table[idx]=A[i]===B[j] ? 1+table[(i+1)*stride+j+1]
            : Math.max(table[(i+1)*stride+j],table[i*stride+j+1]);
        }
      }
      let i=0,j=0,added=0,removed=0;
      while(i<n||j<m){
        if(i<n&&j<m&&A[i]===B[j]){addRow(' ',A[i],'unchanged');i++;j++;}
        else if(j<m&&(i===n||table[i*stride+j+1]>=table[(i+1)*stride+j])){
          addRow('+',B[j],'added');added++;j++;
        }else{addRow('−',A[i],'removed');removed++;i++;}
      }
      status.textContent=added+' added lines · '+removed+' removed lines · compared locally';
    });
    byId('diff-clear').addEventListener('click',()=>{
      before.value='';after.value='';
      output.replaceChildren(node('p','No comparison yet.','desk-muted'));
      status.textContent='Text cleared. Nothing was uploaded.';
      before.focus();
    });
  }
})();
