import {safeLink,finiteRows} from './components/terminal-state.mjs';
export const $=id=>document.getElementById(id);
export const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=String(text);if(cls)n.className=cls;return n;};
export function link(text,url){const a=el('a',text),safe=safeLink(url);if(safe){a.href=safe;a.target='_blank';a.rel='noopener noreferrer';}return a;}
export function original(id,url){const a=$(id),safe=safeLink(url);a.hidden=!safe;if(safe){a.href=safe;a.target='_blank';a.rel='noopener noreferrer';}}
export const number=value=>value.toLocaleString('en-GB',{maximumFractionDigits:2});
export function companyPanel(company){
 const root=$('terminal-holdings');root.replaceChildren();
 if(!company){$('company-name').textContent='Company records unavailable';$('company-scope').textContent='Open the ownership atlas to inspect its available records.';return;}
 $('company-name').textContent=company.name;$('company-sector').textContent=company.sector;
 $('company-record-date').textContent='Holding date '+company.asOf+' · '+company.recordType;
 for(const o of company.owners){if(!Number.isFinite(o.percent))continue;const row=el('div',undefined,'holding-row');row.append(el('span',o.label),el('strong',number(o.percent)+'%'));root.append(row);}
 $('company-scope').textContent=company.scope;original('company-original',company.source.url);
 const u=new URL('ownership-atlas/',document.baseURI);u.searchParams.set('company',company.id);$('company-atlas').href=u.href;
}
export function evidencePanel(records,company,mode,query,index){
 const root=$('terminal-documents');root.replaceChildren();let selected=records;
 if(mode==='company')selected=company?records.filter(r=>r.kind==='Company filing'&&r.title.toLocaleLowerCase().includes(company.name.toLocaleLowerCase())):[];
 else if(mode==='policy')selected=records.filter(r=>r.kind==='Policy document'||r.kind==='Committee report');
 const q=query.trim();
 if(q){const ranked=index?new Map(index.search(q).map((r,i)=>[r.id,i])):null;selected=selected.filter(r=>ranked?ranked.has(r.id):(r.title+' '+r.publisher+' '+r.context).toLocaleLowerCase().includes(q.toLocaleLowerCase()));if(ranked)selected.sort((a,b)=>ranked.get(a.id)-ranked.get(b.id));}
 $('evidence-context').textContent=(mode==='company'?'Filings for '+(company?.name||'the selected company'):mode==='policy'?'General policy research context; not a company-impact assessment.':'Original-document library')+' · '+selected.length+' matching documents. Search covers metadata.';
 for(const r of selected.slice(0,5)){const card=el('article',undefined,'terminal-record');card.append(el('h3',r.title),el('p',r.kind+' · '+(r.date||'Date not indexed')),el('p',r.publisher),link('Open original document',r.url));root.append(card);}
 if(!selected.length)root.append(el('p','No indexed documents match this view. Try the library or broaden the search.','panel-caption'));
 const u=new URL('document-library/',document.baseURI);if(q)u.searchParams.set('q',q);if(mode==='company')u.searchParams.set('kind','Company filing');$('terminal-library').href=u.href;
}
let chart;
export function macroPanel(series,country,name,oil=false){
 const all=finiteRows(series?.rows),rows=oil?all:all.filter(r=>r.country===country);
 const latest=rows.at(-1),unit=series?.unit||'',label=series?.label||'Economic series';
 $('macro-label').textContent=(oil?'Global reference':name)+' / '+label;
 $('macro-value').textContent=latest?(unit.startsWith('US$')?'US$ ':'')+number(latest.value)+(unit.startsWith('%')?'%':''):'Unavailable';
 $('macro-provenance').textContent=latest?'Observation '+latest.period+' · '+unit+' · retrieved '+(series.retrieved_at?.slice(0,10)||'date unavailable')+' · '+(series.status==='retained'?'Retained after failed refresh':series.status||'status unavailable'):'No available observations in this snapshot.';
 $('macro-note').textContent=series?.note||(oil?'Published daily spot observations. Missing days are not estimated. Prices are not live quotes.':'Annual observations; check definitions before comparing economies.');
 original('macro-source',series?.source);
 chart?.remove();chart=null;const root=$('terminal-chart');root.replaceChildren();root.setAttribute('aria-label',label+' history for '+(oil?'global reference':name)+'. Latest value '+(latest?number(latest.value)+' '+unit+' on '+latest.period:'unavailable'));
 $('chart-fallback').hidden=true;
 if(rows.length&&window.LightweightCharts){try{
  chart=window.LightweightCharts.createChart(root,{autoSize:true,height:190,layout:{background:{color:'#f9f9f9'},textColor:'#595959',fontFamily:'Inter, sans-serif',attributionLogo:true},grid:{vertLines:{visible:false},horzLines:{color:'#ededed'}},rightPriceScale:{borderVisible:false},timeScale:{borderVisible:false,timeVisible:false},handleScroll:false,handleScale:false});
  const line=chart.addSeries(window.LightweightCharts.LineSeries,{color:'#b42332',lineWidth:2,priceLineVisible:false,lastValueVisible:false});
  let points=rows.map(r=>({time:r.period.length===4?r.period+'-01-01':r.period,value:r.value}));
  if(!oil){const map=new Map(points.map(r=>[r.time.slice(0,4),r]));points=[];for(let y=Number(rows[0].period);y<=Number(latest.period);y++)points.push(map.get(String(y))||{time:y+'-01-01'});}
  line.setData(points);chart.timeScale().fitContent();
 }catch{chart?.remove();chart=null;$('chart-fallback').hidden=false;}}
 else $('chart-fallback').hidden=false;
 const table=el('table',undefined,'macro-table');table.append(el('caption','Latest five published observations'));
 const head=el('thead'),tr=el('tr');for(const text of ['Observation','Value ('+unit+')']){const th=el('th',text);th.scope='col';tr.append(th);}head.append(tr);table.append(head);const body=el('tbody');
 for(const r of rows.slice(-5).reverse()){const tr=el('tr');tr.append(el('td',r.period),el('td',number(r.value)));body.append(tr);}table.append(body);$('macro-table').replaceChildren(table);
}
export function calendarPanel(data){const root=$('terminal-calendar');root.replaceChildren();
 const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kolkata',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 const events=(data?.events||[]).filter(e=>/^\d{4}-\d{2}-\d{2}$/.test(e.date)&&e.date>=today).sort((a,b)=>a.date.localeCompare(b.date)).slice(0,6);
 for(const e of events){const card=el('article',undefined,'terminal-record');card.append(el('h3',e.title),el('p',e.date+' · Scheduled'),link('Schedule source',e.source));root.append(card);}
 if(!events.length)root.append(el('p','No upcoming releases are available in the recorded schedule.','panel-caption'));
}
export function sourcesPanel(watch,company,series){const root=$('terminal-sources');root.replaceChildren();
 const add=(title,note,url)=>{const r=el('article',undefined,'terminal-record');r.append(el('h3',title),el('p',note));if(url)r.append(link('Source record',url));root.append(r);};
 if(company)add(company.name,'Ownership snapshot '+company.asOf,company.source.url);
 if(series)add(series.label,'Checked '+(series.checked_at?.slice(0,10)||'unavailable')+' · retrieved '+(series.retrieved_at?.slice(0,10)||'unavailable')+' · '+series.status,series.source);
 for(const s of (watch?.sources||[]).slice(0,4))add(s.name,'Last check '+(s.last_checked_at?.slice(0,10)||'unavailable')+' · '+s.status+(s.change_unreviewed?' · Change requires review':''),s.url);
 if(!root.children.length)root.append(el('p','Source status unavailable. Open the original records before using a figure.','panel-caption'));
}
