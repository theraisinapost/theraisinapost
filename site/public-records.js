/* The Raisina Post — public records tools. Native fetch, no paid dependencies.
   All third-party records are validated before rendering. No inline HTML from APIs. */
(()=>{
'use strict';
const kind=document.body.dataset.records;
if(!['question-hour','trade-ledger','public-money'].includes(kind))return;
const el=id=>document.getElementById(id);
const node=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=String(text);if(cls)n.className=cls;return n;};
const link=(text,url)=>{const a=node('a',text);a.href=url;a.target='_blank';a.rel='noopener noreferrer';return a;};
const number=new Intl.NumberFormat('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2});
const safePdf=url=>{try{const x=new URL(url);return x.protocol==='https:' && (x.hostname==='sansad.in'||x.hostname==='www.sansad.in')&&!x.username&&!x.password;}catch(_){return false;}};
const fetchJson=async(url,ms=12000)=>{
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),ms);
 try{const response=await fetch(url,{cache:'no-store',signal:controller.signal});
  if(!response.ok)throw Error('Data service HTTP '+response.status);
  return await response.json();
 }finally{clearTimeout(timer);}
};
const status=(id,msg)=>{el(id).textContent=msg;};
const lower=x=>String(x||'').toLocaleLowerCase();
const money=x=>'₹'+number.format(x)+' cr';
const pct=(from,to)=>from===0?'Not comparable':((to-from)/from*100>=0?'+':'')+number.format((to-from)/from*100)+'%';
const formatDate=x=>/^\d{4}-\d{2}-\d{2}$/.test(x||'')?x:'Date unavailable';
const dateStamp=x=>{const d=new Date(x||'');return Number.isNaN(+d)?'No successful data refresh':d.toLocaleString('en-IN',{timeZone:'Asia/Kolkata',dateStyle:'medium',timeStyle:'short'})+' IST';};

if(kind==='question-hour'){
 const form=el('qh-form'),search=el('qh-search'),house=el('qh-house'),type=el('qh-type'),output=el('qh-results');
 let offset=0,all=[],count=0,mode='latest',serial=0,sourceKind='live';
 const dataset='opensansad/lok-sabha-qa';
 const base='https://datasets-server.huggingface.co/';
 const mkUrl=()=>{
  const p=new URLSearchParams({dataset,config:'default',split:'train',offset:String(offset),length:'50'});
  const query=search.value.trim();
  if(query){mode='search';p.set('query',query);p.delete('offset');p.set('offset',String(offset));return base+'search?'+p;}
  mode='latest';p.set('where','"lok_no" = '+house.value);p.set('orderby','"date" DESC');return base+'filter?'+p;
 };
 const good=r=>r&&typeof r.subject==='string'&&typeof r.ministry==='string'&&
  [16,17,18].includes(Number(r.lok_no))&&/^\d{4}-\d{2}-\d{2}$/.test(r.date||'')&&safePdf(r.pdf_url);
 const asRecord=r=>({subject:r.subject,ministry:r.ministry,lok_no:Number(r.lok_no),
  type:String(r.type||''),date:r.date,member:Array.isArray(r.members)?r.members.join(', '):'',
  url:r.pdf_url,id:String(r.id||'')});
 const render=()=>{
  output.replaceChildren();
  const selected=all.filter(r=>r.lok_no===Number(house.value) && (type.value==='All'||r.type===type.value));
  selected.forEach(r=>{
   const article=node('article',undefined,'desk-record');
   const meta=node('div',undefined,'desk-record-meta');
   meta.append(node('strong',r.ministry),node('span',formatDate(r.date)),node('span','Lok Sabha '+r.lok_no+' · '+(r.type||'Question')));
   const content=node('div',undefined,'desk-record-body');
   content.append(link(r.subject,r.url));
   content.append(node('p',(r.member?r.member+' · ':'')+'Original question and government reply (PDF)'));
   article.append(meta,content);output.append(article);
  });
  el('qh-page').textContent='Page '+(Math.floor(offset/50)+1);
  el('qh-prev').disabled=sourceKind!=='live'||offset===0;
  el('qh-next').disabled=sourceKind!=='live'||offset+50>=count;
  status('qh-status',selected.length+' linked records shown from '+all.length+' upstream results'+
   (count>all.length?' · upstream matches '+count+'; filters apply to this page only':'')+
   (sourceKind==='saved'?' · saved snapshot':'')+
   (!selected.length?' · try another query or question type':''));
 };
 const useSnapshot=async(error)=>{
  try {
   const data=await fetchJson('data/question-hour.json',3000);
   const q=Array.isArray(data.items)?data.items:[];
   all=q.filter(x=>x&&typeof x.subject==='string'&&safePdf(x.url)&&[16,17,18].includes(Number(x.lok_no))&&
      /^\d{4}-\d{2}-\d{2}$/.test(x.date||''));
   sourceKind='saved';count=all.length;offset=0;
   el('qh-updated').textContent='Upstream temporarily unavailable · saved records checked '+dateStamp(data.checked_at);
   if(all.length) render();else status('qh-status','The upstream search is unavailable and no verified snapshot has been collected. Open Digital Sansad from the source links below.');
  } catch(_) {status('qh-status','The parliamentary search could not be reached. No results are being invented.');}
 };
 const load=async()=>{
  const request=++serial, url=mkUrl();
  sourceKind='live';status('qh-status','Searching the published parliamentary index…');
  try{
   const data=await fetchJson(url);
   if(request!==serial)return;
   if(!Array.isArray(data.rows))throw Error('Unrecognized dataset response');
   const rows=data.rows.map(x=>x&&x.row).filter(good).map(asRecord);
   all=rows;
   count=Number.isSafeInteger(data.num_rows_total)?data.num_rows_total:offset+rows.length;
   el('qh-updated').textContent='OpenSansad / Hugging Face · service response (not a scheduled publication date)';
   render();
  }catch(error){if(request===serial)await useSnapshot(error);}
 };
 form.addEventListener('submit',event=>{event.preventDefault();offset=0;load();});
 house.addEventListener('change',()=>{offset=0;load();});
 type.addEventListener('change',render);
 el('qh-prev').addEventListener('click',()=>{offset=Math.max(0,offset-50);load();});
 el('qh-next').addEventListener('click',()=>{offset+=50;load();});
 load();
}

if(kind==='trade-ledger'){
 const form=el('trade-form'),partner=el('trade-partner'),flow=el('trade-flow'),product=el('trade-product'),year=el('trade-year');
 const output=el('trade-rows'),feature=el('trade-feature');
 let request=0,snapshot=[];
 const origin='https://comtradeapi.un.org/public/v1/preview/C/A/HS';
 const params=()=>new URLSearchParams({period:year.value,reportercode:'699',partnerCode:partner.value,
  cmdCode:product.value,flowCode:flow.value,maxRecords:'500'});
 const validate=x=>x&&Number(x.reporterCode)===699&&String(x.partnerCode)===partner.value&&
  String(x.cmdCode).toUpperCase()===product.value&&String(x.flowCode).toUpperCase()===flow.value&&
  Number(x.refYear)===Number(year.value)&&Number.isFinite(Number(x.primaryValue))&&Number(x.primaryValue)>=0;
 const show=(entries,caption)=>{
  output.replaceChildren();feature.hidden=true;
  const selected=entries.filter(validate);
  if(!selected.length){status('trade-status','No validated observation was returned for this selection. This does not mean trade was zero.');return;}
  selected.forEach(x=>{
   const tr=node('tr');[x.refYear,x.partnerDesc||partner.selectedOptions[0].textContent,
    x.flowCode==='M'?'Imports':'Exports',x.cmdDesc||product.selectedOptions[0].textContent,
    '$'+number.format(Number(x.primaryValue))].forEach((v,i)=>{const cell=node('td',v);if(i===0)cell.className='records-year';tr.append(cell);});
   output.append(tr);
  });
  const first=selected[0];
  feature.hidden=false;
  el('trade-value').textContent='$'+number.format(Number(first.primaryValue));
  el('trade-context').textContent=(flow.value==='M'?'India imports from ':'India exports to ')+partner.selectedOptions[0].textContent+
   ' · '+year.value+' · '+product.selectedOptions[0].textContent;
  status('trade-status',selected.length+' matching annual record(s) · '+caption+' · reported trade value in nominal USD');
 };
 const load=async()=>{
  const serial=++request,url=origin+'?'+params();
  el('trade-link').replaceChildren(link('Open exact UN Comtrade query',url));
  status('trade-status','Requesting data from UN Comtrade…');feature.hidden=true;output.replaceChildren();
  try{
   const data=await fetchJson(url,14000);
   if(serial!==request)return;
   if(!Array.isArray(data.data))throw Error('Invalid trade response');
   show(data.data,'live public API');
   el('trade-updated').textContent='UN Comtrade · '+year.value+' annual report';
  }catch(_){
   if(serial!==request)return;
   const matches=snapshot.filter(validate);
   if(matches.length){
    show(matches,'saved official-source snapshot');
    el('trade-updated').textContent='Cached UN Comtrade observation · verify against source query';
   }else status('trade-status','The public trade API is unavailable or rate-limited for this selection. No trade value is inferred; use the official query link.');
  }
 };
 fetchJson('data/trade-ledger.json',5000).then(d=>{
   if(Array.isArray(d.items))snapshot=d.items.filter(x=>x&&Number.isFinite(x.value_usd)).map(x=>({
    ...x,primaryValue:x.value_usd,refYear:x.year,flowCode:x.flow,cmdCode:x.commodity,partnerCode:x.partner,
    reporterCode:699,partnerDesc:x.partner_label,cmdDesc:x.commodity_label
   }));
 }).catch(()=>{});
 form.addEventListener('submit',e=>{e.preventDefault();load();});
 load();
}

if(kind==='public-money'){
 const search=el('money-search'),basis=el('money-basis'),tbody=el('money-rows'),button=el('money-csv');
 let dataset=null,view=[];
 const str=x=>number.format(Number(x));
 const makeCsv=()=>{
  if(!dataset||!view.length)return;
  const [a,b]=basis.value.split(',').map(Number);
  const quote=s=>'"'+String(s).replaceAll('"','""')+'"';
  const rows=[['Head',dataset.year_labels[a]+' (INR crore)',dataset.year_labels[b]+' (INR crore)','Change %','Source'].map(quote).join(',')];
  view.forEach(r=>rows.push([r.label,r.values[a].toFixed(2),r.values[b].toFixed(2),
   r.values[a]===0?'':((r.values[b]-r.values[a])/r.values[a]*100).toFixed(2),dataset.source].map(quote).join(',')));
  const href=URL.createObjectURL(new Blob([rows.join('\r\n')+'\r\n'],{type:'text/csv;charset=utf-8'}));
  const anchor=node('a');anchor.href=href;anchor.download='raisina-public-money-budget-2026-27.csv';document.body.append(anchor);anchor.click();anchor.remove();
  setTimeout(()=>URL.revokeObjectURL(href),1000);
 };
 const render=()=>{
  if(!dataset)return;
  const [a,b]=basis.value.split(',').map(Number);
  const q=lower(search.value.trim());
  view=dataset.items.filter(r=>lower(r.label).includes(q));
  tbody.replaceChildren();
  el('money-col-from').textContent=dataset.year_labels[a]+' · ₹ cr';
  el('money-col-to').textContent=dataset.year_labels[b]+' · ₹ cr';
  view.forEach(r=>{
   const tr=node('tr',undefined,r.level===0?'records-parent':'records-child');
   [r.label,str(r.values[a]),str(r.values[b]),pct(r.values[a],r.values[b])].forEach(x=>tr.append(node('td',x)));
   tbody.append(tr);
  });
  const all=dataset.items.find(r=>r.id==='total');
  el('money-from-label').textContent=dataset.year_labels[a];
  el('money-to-label').textContent=dataset.year_labels[b];
  el('money-from').textContent=str(all.values[a]);
  el('money-to').textContent=str(all.values[b]);
  el('money-change').textContent=pct(all.values[a],all.values[b]);
  button.disabled=!view.length;
  status('money-status',view.length+' official expenditure heads · INR crore · '+dataset.source_label);
 };
 search.addEventListener('input',render);basis.addEventListener('change',render);
 button.addEventListener('click',makeCsv);
 fetchJson('data/public-money.json').then(data=>{
  if(!Array.isArray(data.items)||!Array.isArray(data.year_labels)||data.year_labels.length!==4||
      data.source!=='https://www.indiabudget.gov.in/doc/eb/vol1.pdf'||
      data.items.some(x=>!Array.isArray(x.values)||x.values.length!==4||x.values.some(v=>!Number.isFinite(v)||v<0)))
    throw Error('Invalid published budget data');
  dataset=data;render();
 }).catch(()=>status('money-status','The published Budget snapshot could not be loaded. Consult the Ministry of Finance original PDF.'));
}
})();
