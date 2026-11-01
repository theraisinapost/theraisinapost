import { observations } from './components/finance-model.mjs';
const $ = id => document.getElementById(id);
const catalog = {
 growth:['NY.GDP.MKTP.KD.ZG','Output','Real output growth adjusts for price changes.'],
 gdp:['NY.GDP.MKTP.CD','Output','Nominal GDP in current US dollars reflects both output and exchange-rate movements.'],
 income:['NY.GDP.PCAP.CD','Output','GDP per person is an economic average, not a typical salary or household income.'],
 inflation:['FP.CPI.TOTL.ZG','Prices','Annual consumer-price inflation is not the latest monthly CPI reading.'],
 cpi:['FP.CPI.TOTL','Prices','Annual average index with 2010 = 100; index levels are not inflation rates.'],
 manufacturing:['NV.IND.MANF.ZS','Output','Manufacturing value added as a share of GDP; this is not manufacturing growth.'],
 reserves:['FI.RES.TOTL.CD','External flows','Reserves include gold; annual observations are not the RBI’s latest weekly stock.'],
 exports:['NE.EXP.GNFS.ZS','External flows','Includes goods and services; not comparable to a merchandise-only trade series.'],
 imports:['NE.IMP.GNFS.ZS','External flows','Includes goods and services; a larger share alone does not establish economic weakness.'],
 fdi:['BX.KLT.DINV.WD.GD.ZS','External flows','Net inward direct investment as a share of GDP; differs from gross announced investment.'],
 current_account:['BN.CAB.XOKA.GD.ZS','External flows','Includes goods, services, primary income and secondary income; negative values indicate a deficit.'],
 remittances:['BX.TRF.PWKR.DT.GD.ZS','External flows','Personal transfers and compensation of employees received, expressed as a share of GDP.'],
 unemployment:['SL.UEM.TOTL.ZS','Labour','Modelled ILO estimate of the unemployed share of the labour force, not of the total population.'],
 participation:['SL.TLF.CACT.ZS','Labour','Modelled ILO estimate of people aged 15+ who are employed or seeking work.'],
 investment:['NE.GDI.TOTL.ZS','Capital','Gross capital formation includes fixed assets and changes in inventories; it is not foreign investment alone.'],
 credit:['FS.AST.PRVT.GD.ZS','Capital','Financial resources provided to the private sector as a share of GDP; not a measure of new loans this month.']
};
const el=(tag,text)=>{const n=document.createElement(tag);n.textContent=text;return n;};
const format=n=>n.toLocaleString('en-IN',{maximumFractionDigits:2});
function headline(row,unit){
 if(unit==='US$') return 'US$ '+format(row.value/(Math.abs(row.value)>=1e12?1e12:1e9))+(Math.abs(row.value)>=1e12?'tn':'bn');
 return (unit==='US$ per person'?'US$ ':'')+format(row.value)+(unit.startsWith('%')?'%':'');
}
function chart(rows,label){
 const svg=$('economy-chart');svg.replaceChildren();svg.setAttribute('aria-label',label);
 if(!rows.length)return;
 const values=rows.map(r=>r.value),min=Math.min(...values),max=Math.max(...values),padding=(max-min||1)*.1;
 const low=min-padding,high=max+padding,start=Number(rows[0].period),end=Number(rows.at(-1).period);
 const x=year=>90+(Number(year)-start)/(end-start||1)*740,y=v=>250-(v-low)/(high-low)*220;
 const shape=(tag,attrs,text)=>{const n=document.createElementNS('http://www.w3.org/2000/svg',tag);for(const [k,v]of Object.entries(attrs))n.setAttribute(k,v);if(text)n.textContent=text;svg.append(n);};
 for(let i=0;i<4;i++){const v=low+(high-low)*i/3;shape('line',{x1:90,x2:830,y1:y(v),y2:y(v),stroke:'#e6e6e6'});shape('text',{x:80,y:y(v)+4,'text-anchor':'end',fill:'#595959','font-size':12},Math.abs(v)>=1e9?format(v/1e9)+'bn':format(v));}
 shape('path',{d:rows.map((r,i)=>(i&&Number(r.period)===Number(rows[i-1].period)+1?'L':'M')+x(r.period)+','+y(r.value)).join(' '),fill:'none',stroke:'#b42332','stroke-width':2});
 for(const r of rows)shape('circle',{cx:x(r.period),cy:y(r.value),r:2.5,fill:'#b42332'});
 shape('text',{x:90,y:280,fill:'#595959','font-size':12},rows[0].period);if(rows.length>1)shape('text',{x:830,y:280,'text-anchor':'end',fill:'#595959','font-size':12},rows.at(-1).period);
}
async function init(){
 const response=await fetch('data/finance.json');if(!response.ok)throw Error('Snapshot unavailable');const data=await response.json();if(data.schema!==1)throw Error('Unsupported snapshot');
 const series={};for(const [key,[code]]of Object.entries(catalog)){
  const s=data.annual?.[key];if(!s||s.code!==code||!['available','retained'].includes(s.status)||!Number.isFinite(Date.parse(s.retrieved_at)))continue;
  try{const rows=observations(s.rows);if(rows.length)series[key]={...s,rows};}catch{/* Reject conflicting observations. */}
 }
 if(!Object.keys(series).length)throw Error('No observations');
 const select=$('economy-series');select.replaceChildren();const groups={};
 for(const [key,s]of Object.entries(series)){const category=catalog[key][1];if(!groups[category]){groups[category]=document.createElement('optgroup');groups[category].label=category;select.append(groups[category]);}const option=el('option',s.label+' · '+s.unit);option.value=key;groups[category].append(option);}
 select.disabled=false;select.value=series.gdp?'gdp':Object.keys(series)[0];
 const rail=$('economy-snapshots');rail.replaceChildren();
 for(const key of ['gdp','income','fdi','current_account','unemployment','credit']){
  const s=series[key];if(!s)continue;const last=s.rows.at(-1),card=el('article','');card.className='bento-card finance-stat';card.append(el('h3',s.label),el('strong',headline(last,s.unit)),el('span',last.period+' · '+s.unit),el('small',s.status==='retained'?'Saved data; refresh failed':'Published annual observation'));rail.append(card);
 }
 if(!rail.children.length)rail.append(el('p','Summary indicators are unavailable; explore available series below.'));
 let selected=[];
 function render(){
  const key=select.value,s=series[key],range=$('economy-range').value;
  selected=s.rows.filter(r=>range==='all'||Number(r.period)>Number(s.rows.at(-1).period)-Number(range));
  const last=selected.at(-1);$('economy-label').textContent=s.label;$('economy-value').textContent=headline(last,s.unit);$('economy-period').textContent=last.period+' · '+s.unit;
  $('economy-status').textContent=selected.length+' observations · '+Object.keys(series).length+' of 16 series available. Retrieved '+new Date(s.retrieved_at).toLocaleDateString('en-GB')+'. '+(s.status==='retained'?'Latest refresh failed; saved observations shown.':'Values may be revised.');
  $('economy-context').textContent=catalog[key][2];$('economy-source').href='https://data.worldbank.org/indicator/'+catalog[key][0]+'?locations=IN';$('economy-unit').textContent=s.unit;$('economy-caption').textContent=s.label+' · '+s.unit;
  $('economy-rows').replaceChildren(...[...selected].reverse().map(r=>{const tr=el('tr','');tr.append(el('td',r.period),el('td',format(r.value)));return tr;}));
  chart(selected,s.label+', '+s.unit+', '+selected[0].period+' to '+last.period+'. Exact observations follow in the table.');$('economy-download').disabled=false;
 }
 select.addEventListener('change',render);$('economy-range').addEventListener('change',render);
 $('economy-download').addEventListener('click',()=>{
  const key=select.value,s=series[key],quote=value=>'"'+String(value).replaceAll('"','""')+'"';
  const lines=[['country','indicator_code','indicator','year','value','unit','source','retrieved_at','status'],...selected.map(r=>['IND',s.code,s.label,r.period,r.value,s.unit,$('economy-source').href,s.retrieved_at,s.status])];
  const url=URL.createObjectURL(new Blob([lines.map(row=>row.map(quote).join(',')).join('\r\n')+'\r\n'],{type:'text/csv;charset=utf-8'}));const a=el('a','');a.href=url;a.download='india-'+key+'-annual.csv';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
 });render();
}
if($('economic-record'))init().catch(()=>{$('economy-status').textContent='Economic snapshot unavailable. Open the World Bank source for original observations.';$('economy-snapshots').replaceChildren(el('p','Data unavailable; no values estimated.'));});
