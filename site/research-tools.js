const $=id=>document.getElementById(id);
const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
const params=new URLSearchParams(location.search);
const setURL=values=>{const u=new URL(location.href);for(const [key,value]of Object.entries(values)){if(value)u.searchParams.set(key,value);else u.searchParams.delete(key);}history.replaceState({},'',u);};
const get=async url=>{const r=await fetch(url);if(!r.ok)throw Error('Unavailable');return r.json();};
const csvCell=v=>'"'+String(v??'').replaceAll('"','""')+'"';
function download(rows,name){const text=rows.map(row=>row.map(csvCell).join(',')).join('\r\n');const url=URL.createObjectURL(new Blob(['\uFEFF'+text],{type:'text/csv;charset=utf-8'}));const a=el('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
if(document.querySelector('[data-tool="country-desk"]')){
 get('data/countries.json').then(data=>{
  const indicator=$('country-indicator'),year=$('country-year');let chosen=[];
  for(const [key,s]of Object.entries(data.series)){const o=el('option',s.label);o.value=key;indicator.append(o);}
  indicator.value=Object.hasOwn(data.series,params.get('indicator'))?params.get('indicator'):'growth';
  function render(){const s=data.series[indicator.value],period=year.value;
   chosen=Object.entries(data.countries).map(([code,name])=>({code,name,row:s.rows.find(r=>r.country===code&&r.period===period)}));
   $('country-cards').replaceChildren();$('country-rows').replaceChildren();
   const number=v=>v.toLocaleString('en-GB',{maximumFractionDigits:2});
   for(const c of chosen){const value=c.row?(s.unit==='US$'?'US$ ':'')+number(c.row.value)+(s.unit.startsWith('%')?'%':''):'Not available';
    const card=el('article',undefined,'country-card');card.append(el('h3',c.name),el('strong',value),el('p',period+' · '+s.unit));$('country-cards').append(card);
    const row=el('tr');row.append(el('th',c.name),el('td',value),el('td',period));row.firstChild.scope='row';$('country-rows').append(row);
   }
   $('country-note').textContent=s.note;$('country-caption').textContent=s.label+' · '+period+' · '+s.unit;
   $('country-status').textContent=chosen.filter(c=>c.row).length+' of '+chosen.length+' economies available · '+(s.status==='retained'?'Refresh failed; retained snapshot':'Source snapshot')+' · retrieved '+(s.retrieved_at?.slice(0,10)||'unavailable');
   $('country-source').href=s.source;$('country-export').disabled=!chosen.some(c=>c.row);setURL({indicator:indicator.value,year:period});
  }
  function years(preferred){const s=data.series[indicator.value];const values=[...new Set(s.rows.map(r=>r.period))].sort().reverse();year.replaceChildren();values.forEach(y=>{const o=el('option',y);o.value=y;year.append(o);});
   const common=values.find(y=>Object.keys(data.countries).every(c=>s.rows.some(r=>r.period===y&&r.country===c)));
   year.value=values.includes(preferred)?preferred:(common||values[0]||'');render();
  }
  indicator.addEventListener('change',()=>years(year.value));year.addEventListener('change',render);
  $('country-export').addEventListener('click',()=>{const s=data.series[indicator.value];download([['country_code','economy','year','indicator','unit','value','status','source','retrieved_at'],...chosen.map(c=>[c.code,c.name,year.value,s.label,s.unit,c.row?.value??'',s.status,s.source,s.retrieved_at])],'raisina-country-comparison.csv');});
  years(params.get('year'));
 }).catch(()=>{$('country-status').textContent='Country panel unavailable. Please try again later; original World Bank sources are linked below.';});
}
if(document.querySelector('[data-tool="document-library"]')){
 get('data/document-library.json').then(data=>{
  const records=data.records,search=$('library-search'),kind=$('library-kind');let limit=20,index;
  if(typeof window.MiniSearch==='function'){index=new window.MiniSearch({fields:['title','publisher','context'],storeFields:['title'],searchOptions:{prefix:true,fuzzy:.2,combineWith:'AND',boost:{title:2}}});index.addAll(records);}
  [...new Set(records.map(r=>r.kind))].sort().forEach(k=>{const o=el('option',k);o.value=k;kind.append(o);});
  search.value=params.get('q')||'';kind.value=[...kind.options].some(o=>o.value===params.get('kind'))?params.get('kind'):'';
  function render(){const q=search.value.trim();const ranked=q&&index?new Map(index.search(q).map((r,i)=>[r.id,i])):null;
   const selected=records.filter(r=>(!kind.value||r.kind===kind.value)&&(!q||(ranked?ranked.has(r.id):(r.title+' '+r.publisher+' '+r.context).toLowerCase().includes(q.toLowerCase()))));
   if(ranked)selected.sort((a,b)=>ranked.get(a.id)-ranked.get(b.id));
   $('library-results').replaceChildren();selected.slice(0,limit).forEach(r=>{const card=el('article',undefined,'document-card');const a=el('a','Open original document');a.href=r.url;a.target='_blank';a.rel='noopener noreferrer';card.append(el('small',r.kind+' · '+(r.date||'Date not indexed')),el('h3',r.title),el('p',r.publisher+(r.context?' · '+r.context:'')),a);$('library-results').append(card);});
   $('library-status').textContent=selected.length?'Showing '+Math.min(limit,selected.length)+' of '+selected.length+' documents.':'No documents match. Try a broader term or another document type.';$('library-more').hidden=selected.length<=limit;setURL({q,kind:kind.value});
  }
  search.addEventListener('input',()=>{limit=20;render();});kind.addEventListener('change',()=>{limit=20;render();});$('library-more').addEventListener('click',()=>{limit+=20;render();});render();
 }).catch(()=>{$('library-status').textContent='Document index unavailable. Open the Parliament file or ownership atlas from the navigation above.';});
}
