/* The Raisina Post — browser-side, source-labelled intelligence tools. */
(() => {
  'use strict';
  const kind=document.body.dataset.intel;
  if (!kind) return;
  const el=id=>document.getElementById(id);
  const create=(tag,content,cls)=>{
    const e=document.createElement(tag);
    if (content!==undefined) e.textContent=String(content);
    if (cls) e.className=cls;
    return e;
  };
  const officialLink=url=>{
    try {
      const u=new URL(url);
      return u.protocol==='https:' &&
        ['sansad.in','www.sansad.in','eparlib.sansad.in','www.sebi.gov.in','www.pib.gov.in','pib.gov.in','www.mospi.gov.in'].includes(u.hostname) &&
        !u.username && !u.password;
    } catch (_) { return false; }
  };
  const source=(url,title)=>{
    const a=create('a',title);
    a.href=url;
    a.target='_blank'; a.rel='noopener noreferrer';
    return a;
  };
  const fullDate=iso=>{
    if (!/^\d{4}-\d{2}-\d{2}$/.test(iso||'')) return 'Date not supplied';
    const d=new Date(iso+'T12:00:00Z');
    return Number.isNaN(+d)?'Date not supplied':
      d.toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'});
  };
  const checkedAt=value=>{
    const d=new Date(value||'');
    return Number.isNaN(+d)?'No completed check yet':
      'Checked '+d.toLocaleString('en-GB',{day:'numeric',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit',timeZone:'Asia/Kolkata'})+' IST';
  };
  document.querySelectorAll('.desk-subnav a').forEach(a=>{
    if (a.getAttribute('href')===kind+'/') a.setAttribute('aria-current','page');
  });

  if (kind==='parliament-file') {
    const panel=el('parliament-records'),status=el('parliament-status');
    const search=el('parliament-search'),committee=el('parliament-committee');
    let records=[];
    const render=()=>{
      panel.replaceChildren();
      const q=search.value.trim().toLocaleLowerCase();
      const rows=records.filter(item=>(committee.value==='All'||item.committee===committee.value) &&
        (!q || (item.title+' '+item.committee_name+' '+item.report_number).toLocaleLowerCase().includes(q)));
      rows.slice(0,150).forEach(item=>{
        const article=create('article',undefined,'desk-record');
        const meta=create('div',undefined,'desk-record-meta');
        meta.append(create('strong',item.committee_name),create('span',fullDate(item.date)));
        const body=create('div',undefined,'desk-record-body');
        body.append(source(item.url,item.title));
        body.append(create('p',(item.report_number?'Report '+item.report_number+' · ':'')+'Official parliamentary record · '+(item.date?'Publication date supplied':'Date not supplied by source')));
        article.append(meta,body); panel.append(article);
      });
      status.textContent=rows.length ?
        rows.length+' official report links found'+(rows.length>150?' · showing first 150':'') :
        (records.length?'No report titles match the selected filters.':'No validated parliamentary documents are available from the current source snapshot.');
    };
    search.addEventListener('input',render);
    committee.addEventListener('change',render);
    fetch('data/parliament.json',{cache:'no-store'})
      .then(r=>{if(!r.ok)throw Error('Metadata unavailable');return r.json();})
      .then(data=>{
        const map=new Map();
        const entries=Array.isArray(data.items)?data.items:[];
        records=entries.filter(item=>item && typeof item.title==='string' && item.title.length>0 &&
          typeof item.committee==='string' && typeof item.committee_name==='string' &&
          typeof item.report_number==='string' && officialLink(item.url) &&
          (item.date==='' || /^\d{4}-\d{2}-\d{2}$/.test(item.date))).slice(0,700);
        records.forEach(item=>map.set(item.committee,item.committee_name));
        [...map.entries()].sort((a,b)=>a[1].localeCompare(b[1])).forEach(([key,label])=>{
          const option=create('option',label);option.value=key;committee.append(option);
        });
        const scope=data.status==='stale'?' · previous snapshot; current refresh failed':
          data.status==='partial'?' · some committees unavailable':
          data.status==='unavailable'?' · upstream unavailable':'';
        el('parliament-updated').textContent=checkedAt(data.checked_at)+scope+
          (typeof data.committees_available==='number'?' · '+data.committees_available+' committees available':'');
        render();
      }).catch(()=>{status.textContent='The parliamentary source index is unavailable. Use the original Sansad links below.';});
  }

  if (kind==='evidence-desk') {
    const panel=el('watch-records'),status=el('watch-status');
    fetch('data/source-watch.json',{cache:'no-store'})
      .then(r=>{if(!r.ok)throw Error('Monitor offline');return r.json();})
      .then(data=>{
        const valid=Array.isArray(data.sources)?data.sources.filter(x=>x &&
          typeof x.name==='string' && typeof x.category==='string' && officialLink(x.url) &&
          ['available','unavailable'].includes(x.status)).slice(0,8):[];
        panel.replaceChildren();
        valid.forEach(item=>{
          const row=create('article',undefined,'desk-record');
          const meta=create('div',undefined,'desk-record-meta');
          meta.append(create('strong',item.category),create('span',item.status==='available'?'Source reachable':'Source unavailable'));
          const body=create('div',undefined,'desk-record-body');
          body.append(source(item.url,item.name));
          const message=item.change_unreviewed?
            'Page-level difference detected · NOT reviewed · not evidence of a policy change':
            item.status==='unavailable'?'Latest source retrieval failed · no content claim made':
            'No unreviewed change currently flagged';
          body.append(create('p',message));
          if (item.change_unreviewed && item.change_detected_at) body.append(create('p','Change observed: '+checkedAt(item.change_detected_at),'intel-review-note'));
          row.append(meta,body); panel.append(row);
        });
        el('watch-updated').textContent=checkedAt(data.checked_at);
        status.textContent=valid.length ?
          valid.length+' monitored official pages · '+valid.filter(x=>x.change_unreviewed).length+' require editorial review':
          'No verified monitoring results are available. Check the official sources directly.';
      }).catch(()=>{status.textContent='The monitoring registry is not available. This does not establish that any policy changed.';});
  }

  if (kind==='data-room') {
    const indicator=el('data-indicator'),status=el('data-status'),body=el('data-rows');
    const stats=el('data-latest'),chart=el('data-chart'),exportButton=el('data-csv');
    const countries={IND:'India',CHN:'China',BGD:'Bangladesh'};
    const allowedCodes=new Set([...indicator.options].map(x=>x.value));
    const selected=()=>[...document.querySelectorAll('.intel-country-fieldset input:checked')]
      .map(input=>input.value).filter(x=>Object.hasOwn(countries,x));
    let shown=[],requestId=0;
    const ns='http://www.w3.org/2000/svg';
    const svg=(tag,attrs,label)=>{
      const n=document.createElementNS(ns,tag);
      Object.entries(attrs).forEach(([key,value])=>n.setAttribute(key,String(value)));
      if (label!==undefined) n.textContent=label;
      return n;
    };
    const plot=(rows,keys)=>{
      chart.replaceChildren();
      if (!rows.length) return;
      const vals=rows.map(r=>r.value),years=rows.map(r=>r.year);
      let lo=Math.min(...vals),hi=Math.max(...vals);
      if (lo===hi) {lo-=1;hi+=1;}
      const ext=(hi-lo)*.11;lo-=ext;hi+=ext;
      const minYear=Math.min(...years),maxYear=Math.max(...years);
      const X=v=>74+(v-minYear)/(Math.max(1,maxYear-minYear))*745;
      const Y=v=>248-(v-lo)/(hi-lo)*218;
      for(let i=0;i<4;i++){
        const y=32+(216/3)*i;
        chart.append(svg('line',{x1:74,y1:y,x2:819,y2:y,stroke:'#e8e8e8','stroke-width':1}));
        chart.append(svg('text',{x:62,y:y+4,'text-anchor':'end',fill:'#555','font-size':12},(hi-(hi-lo)*i/3).toFixed(1)));
      }
      const style={IND:{stroke:'#171717',dash:''},CHN:{stroke:'#5f5f5f',dash:'9 5'},BGD:{stroke:'#888888',dash:'3 5'}};
      for(const key of keys){
        const group=rows.filter(r=>r.code===key).sort((a,b)=>a.year-b.year);
        if(!group.length)continue;
        chart.append(svg('polyline',{points:group.map(p=>X(p.year).toFixed(1)+','+Y(p.value).toFixed(1)).join(' '),
          fill:'none',stroke:style[key].stroke,'stroke-width':2.6,'stroke-dasharray':style[key].dash,
          'stroke-linejoin':'round','stroke-linecap':'round'}));
        const last=group.at(-1);
        chart.append(svg('circle',{cx:X(last.year),cy:Y(last.value),r:3,fill:style[key].stroke}));
      }
      chart.append(svg('text',{x:74,y:282,'text-anchor':'start',fill:'#555','font-size':12},String(minYear)));
      chart.append(svg('text',{x:819,y:282,'text-anchor':'end',fill:'#555','font-size':12},String(maxYear)));
      chart.setAttribute('aria-label',indicator.selectedOptions[0].text+' comparison from '+minYear+' to '+maxYear);
    };
    const paint=(rows,keys)=>{
      shown=rows.sort((a,b)=>b.year-a.year || keys.indexOf(a.code)-keys.indexOf(b.code));
      stats.replaceChildren();body.replaceChildren();
      for(const key of keys){
        const series=rows.filter(r=>r.code===key).sort((a,b)=>b.year-a.year);
        const card=create('div',undefined,'intel-stat');
        card.append(create('span',countries[key]),create('strong',series.length?series[0].value.toLocaleString('en-IN',{maximumFractionDigits:2})+'%':'—'),
          create('small',series.length?'Latest available year: '+series[0].year:'No published observations'));
        stats.append(card);
      }
      shown.forEach(row=>{
        const tr=create('tr');
        tr.append(create('td',countries[row.code]),create('td',row.year),
          create('td',row.value.toLocaleString('en-IN',{maximumFractionDigits:3})));
        body.append(tr);
      });
      if (!shown.length) {
        const tr=create('tr'),td=create('td','No published observations available');
        td.colSpan=3;tr.append(td);body.append(tr);
      }
      exportButton.disabled=!shown.length;
      plot(rows,keys);
    };
    const load=async()=>{
      const code=indicator.value,keys=selected(),turn=++requestId;
      shown=[];stats.replaceChildren();body.replaceChildren();chart.replaceChildren();
      exportButton.disabled=true;
      if(!keys.length){status.textContent='Choose at least one country.';return;}
      if(!allowedCodes.has(code))return;
      status.textContent='Retrieving annual observations from the World Bank…';
      const endYear=new Date().getUTCFullYear();
      const requests=keys.map(async key=>{
        const url='https://api.worldbank.org/v2/country/'+key+'/indicator/'+encodeURIComponent(code)+
          '?format=json&per_page=100&date=2000:'+endYear;
        try {
          const response=await fetch(url,{cache:'no-store'});
          if (!response.ok)throw Error('Request failed');
          const raw=await response.json();
          if(!Array.isArray(raw)||!Array.isArray(raw[1]))throw Error('Malformed data');
          return raw[1].filter(x=>x && /^\d{4}$/.test(x.date)&&
            typeof x.value==='number'&&Number.isFinite(x.value))
            .map(x=>({code,unused:undefined,year:Number(x.date),value:x.value,country:key}))
            .map(x=>({code:x.country,year:x.year,value:x.value}));
        } catch (_) {return null;}
      });
      const replies=await Promise.all(requests);
      if(turn!==requestId)return;
      const rows=replies.flatMap(x=>x||[]);
      paint(rows,keys);
      const failed=keys.filter((_,i)=>replies[i]===null);
      status.textContent=rows.length?
        rows.length+' sourced annual observations · indicator '+code+
          (failed.length?' · unavailable: '+failed.map(x=>countries[x]).join(', '):'')+
          ' · series may be revised':
        'World Bank observations could not be retrieved. View the original source.';
      const sourceUrl='https://data.worldbank.org/indicator/'+code+'?locations='+keys.map(x=>x==='IND'?'IN':x==='CHN'?'CN':'BD').join('-');
      const para=el('data-source-link');para.replaceChildren(source(sourceUrl,'Original World Bank indicator and methodology'));
    };
    const escapeCsv=v=>{
      let text=String(v);
      if (/^[=+\-@\t\r]/.test(text))text="'"+text;
      return '"'+text.replaceAll('"','""')+'"';
    };
    exportButton.addEventListener('click',()=>{
      if(!shown.length)return;
      const csv=[['Country','Year','Value (%)','Indicator code','Source']].concat(shown.map(r=>[
        countries[r.code],r.year,r.value,indicator.value,
        'https://data.worldbank.org/indicator/'+indicator.value]))
        .map(parts=>parts.map(escapeCsv).join(',')).join('\r\n');
      const blob=new Blob(['\ufeff',csv],{type:'text/csv;charset=utf-8'});
      const href=URL.createObjectURL(blob);
      const a=create('a');a.href=href;a.download='raisina-economic-'+indicator.value+'.csv';
      document.body.append(a);a.click();a.remove();
      setTimeout(()=>URL.revokeObjectURL(href),3000);
    });
    indicator.addEventListener('change',load);
    document.querySelectorAll('.intel-country-fieldset input').forEach(x=>x.addEventListener('change',load));
    load();
  }
})();
