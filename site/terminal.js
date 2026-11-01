import {PANEL_IDS,WORKSPACES,INDICATORS,COUNTRIES,defaultLayout,cleanLayout,cleanState,ordered,movePanel} from './components/terminal-state.mjs';
import {$,el,companyPanel,evidencePanel,macroPanel,calendarPanel,sourcesPanel} from './terminal-panels.js';
const KEY='raisina-terminal-v1',params=new URLSearchParams(location.search);
let state,grid,arranging=false,applying=false,companies=[],records=[],countries,finance,watch,index;
const current=()=>state.workspaces[state.active];
const activeCompany=()=>companies.find(c=>c.id===current().company);
const activeSeries=()=>['brent','wti'].includes(current().indicator)?finance?.oil?.[current().indicator]:countries?.series?.[current().indicator];
function persist(message='Workspace updated in this browser.'){
 try{localStorage.setItem(KEY,JSON.stringify(state));$('terminal-save-status').textContent=message;}
 catch{$('terminal-save-status').textContent='Browser storage unavailable. This session still works; settings will not persist.';}
}
function updateURL(){const u=new URL(location.href);u.searchParams.set('workspace',state.active);u.searchParams.set('company',current().company);u.searchParams.set('indicator',current().indicator);u.searchParams.set('country',current().country);history.replaceState({},'',u);}
function renderFollowing(){const root=$('terminal-watchlist');root.replaceChildren();
 for(const id of state.followed){const c=companies.find(c=>c.id===id);if(!c)continue;const row=el('div',undefined,'terminal-watch-row'),open=el('button',c.short),remove=el('button','Remove');open.type=remove.type='button';open.append(el('small',c.sector+' · '+c.asOf));open.addEventListener('click',()=>selectCompany(id));remove.setAttribute('aria-label','Stop following '+c.name);remove.addEventListener('click',()=>{state.followed=state.followed.filter(x=>x!==id);renderFollowing();renderFollowButton();persist();});row.append(open,remove);root.append(row);}
 if(!root.children.length)root.append(el('p','Follow a company to keep its record here.','panel-caption'));
}
function renderFollowButton(){const followed=state.followed.includes(current().company);$('terminal-follow').textContent=followed?'Following':'Follow company';$('terminal-follow').setAttribute('aria-pressed',String(followed));$('terminal-follow').disabled=!activeCompany();}
function renderEvidence(){evidencePanel(records,activeCompany(),$('evidence-mode').value,$('evidence-query').value,index);}
function renderMacro(){const w=current(),oil=['brent','wti'].includes(w.indicator);$('terminal-indicator').value=w.indicator;$('terminal-country').value=w.country;$('terminal-country').disabled=oil;macroPanel(activeSeries(),w.country,countries?.countries?.[w.country]||w.country,oil);sourcesPanel(watch,activeCompany(),activeSeries());}
function selectCompany(id){if(!companies.some(c=>c.id===id))return;current().company=id;$('terminal-company').value=id;companyPanel(activeCompany());renderFollowButton();renderEvidence();sourcesPanel(watch,activeCompany(),activeSeries());persist();updateURL();}
function syncOrder(){for(const n of ordered(current().layout)){const item=document.querySelector('[gs-id="'+n.id+'"]');if(item)$('terminal-grid').append(item);}}
function loadLayout(){applying=true;const layout=cleanLayout(current().layout,state.active);current().layout=layout;
 if(grid)grid.load(layout,false);syncOrder();applying=false;
}
function captureLayout(){if(!grid||applying)return;current().layout=cleanLayout(grid.save(false),state.active);syncOrder();persist('Panel arrangement updated in this browser.');}
function renderWorkspace(){const w=current();$('terminal-workspace').value=state.active;$('terminal-company').value=w.company;$('evidence-mode').value=state.active==='policy'?'policy':'company';$('evidence-query').value='';loadLayout();companyPanel(activeCompany());renderFollowButton();renderEvidence();renderMacro();renderFollowing();updateURL();}
function initLayout(){const root=$('terminal-grid');
 try{if(!window.GridStack)throw Error('Unavailable');grid=window.GridStack.init({column:12,cellHeight:64,margin:8,animate:false,disableDrag:true,disableResize:true,handle:'.panel-head',columnOpts:{breakpoints:[{w:800,c:1}]},resizable:{handles:'se'},draggable:{cancel:'button,input,select,a'}},root);grid.on('dragstop resizestop',()=>requestAnimationFrame(captureLayout));}
 catch{grid=null;root.classList.add('terminal-grid-fallback');}
 document.querySelectorAll('[data-move]').forEach(b=>b.addEventListener('click',()=>{current().layout=movePanel(current().layout,b.dataset.move,Number(b.dataset.step));loadLayout();persist('Panel order updated in this browser.');}));
 $('terminal-arrange').addEventListener('click',()=>{arranging=!arranging;$('terminal-arrange').setAttribute('aria-pressed',String(arranging));$('terminal-arrange').textContent=arranging?'Finish arranging':'Arrange panels';root.classList.toggle('arranging',arranging);document.querySelectorAll('.arrange-controls').forEach(n=>n.hidden=!arranging);grid?.enableMove(arranging);grid?.enableResize(arranging);$('terminal-save-status').textContent=arranging?'Drag panel headings, resize a corner, or use Earlier / Later buttons.':'Panel arrangement retained in this browser.';});
}
const dialog=$('terminal-command-dialog');let commands=[],visible=[];
function renderCommands(){const q=$('terminal-command-input').value.toLocaleLowerCase().trim();visible=commands.filter(c=>!q||c.search.includes(q)).slice(0,10);const root=$('terminal-command-results');root.replaceChildren();for(const c of visible){const b=el('button');b.type='button';b.append(el('small',c.kind),el('span',c.label));b.addEventListener('click',()=>run(c));root.append(b);}$('command-status').textContent=visible.length?visible.length+' results. Tab to a result, or press Enter for the first.':'No match. Try a company name, GDP, inflation or policy.';}
function run(c){if(c.kind==='Company')selectCompany(c.id);else if(c.kind==='Economic indicator'){current().indicator=c.id;renderMacro();persist();updateURL();}else{$('evidence-mode').value='policy';$('evidence-query').value=c.query;renderEvidence();}dialog.close();$('terminal-save-status').textContent=c.label+' selected.';}
function openCommands(){if(!state)return;dialog.showModal();$('terminal-command-input').value='';renderCommands();$('terminal-command-input').focus();}
$('terminal-command').addEventListener('click',openCommands);$('terminal-command-close').addEventListener('click',()=>dialog.close());
$('terminal-command-input').addEventListener('input',renderCommands);$('terminal-command-input').addEventListener('keydown',e=>{if(e.key==='Enter'&&visible.length){e.preventDefault();run(visible[0]);}});
window.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key.toLocaleLowerCase()==='k'){e.preventDefault();if(!dialog.open)openCommands();}});
const get=async url=>{const r=await fetch(url);if(!r.ok)throw Error('Unavailable');const text=await r.text();if(text.length>4000000)throw Error('Oversize data');return JSON.parse(text);};
const paths=['ownership-companies','countries','document-library','release-calendar','source-watch','finance'];
Promise.allSettled(paths.map(p=>get('data/'+p+'.json'))).then(results=>{
 const data=Object.fromEntries(paths.map((p,i)=>[p,results[i].status==='fulfilled'?results[i].value:null]));
 companies=(data['ownership-companies']?.companies||[]).filter(c=>typeof c.id==='string'&&/^[a-z0-9-]+$/.test(c.id)&&typeof c.name==='string'&&Array.isArray(c.owners)&&c.source);
 records=(data['document-library']?.records||[]).filter(r=>typeof r.id==='string'&&typeof r.title==='string');countries=data.countries;finance=data.finance;watch=data['source-watch'];
 let raw={};try{const text=localStorage.getItem(KEY);if(text&&text.length<40000)raw=JSON.parse(text);}catch{}
 state=cleanState(raw,companies);if(WORKSPACES.includes(params.get('workspace')))state.active=params.get('workspace');const w=current();
 if(companies.some(c=>c.id===params.get('company')))w.company=params.get('company');if(INDICATORS.includes(params.get('indicator')))w.indicator=params.get('indicator');if(COUNTRIES.includes(params.get('country')))w.country=params.get('country');
 const selector=$('terminal-company');selector.replaceChildren();for(const c of companies){const o=el('option',c.name);o.value=c.id;selector.append(o);}selector.disabled=!companies.length;
 for(const key of INDICATORS){const s=['brent','wti'].includes(key)?finance?.oil?.[key]:countries?.series?.[key];const o=el('option',s?.label||key.toUpperCase());o.value=key;$('terminal-indicator').append(o);}
 for(const key of COUNTRIES){const o=el('option',countries?.countries?.[key]||key);o.value=key;$('terminal-country').append(o);}
 try{if(window.MiniSearch){index=new window.MiniSearch({fields:['title','publisher','context'],searchOptions:{prefix:true,fuzzy:.2,combineWith:'AND'}});index.addAll(records);}}catch{index=null;}
 commands=companies.map(c=>({kind:'Company',id:c.id,label:c.name,search:(c.name+' '+c.short+' '+c.sector).toLocaleLowerCase()})).concat(INDICATORS.map(id=>({kind:'Economic indicator',id,label:([...$('terminal-indicator').options].find(o=>o.value===id)?.textContent||id),search:(id+' '+([...$('terminal-indicator').options].find(o=>o.value===id)?.textContent||id)+' economy GDP').toLocaleLowerCase()})),[{kind:'Policy research',label:'Data protection',query:'data protection',search:'data protection dpdp privacy'},{kind:'Policy research',label:'Petroleum and energy',query:'petroleum',search:'petroleum oil energy policy'},{kind:'Policy research',label:'Public accounts',query:'public accounts',search:'public accounts budget spending policy'}]);
 initLayout();renderWorkspace();calendarPanel(data['release-calendar']);
 const unavailable=results.filter(r=>r.status==='rejected').length;$('terminal-status').textContent=companies.length+' companies · '+records.length+' indexed documents · Dated snapshots'+(unavailable?' · '+unavailable+' datasets unavailable':'');
 selector.addEventListener('change',()=>selectCompany(selector.value));$('terminal-indicator').addEventListener('change',()=>{wChanged('indicator',$('terminal-indicator').value);});$('terminal-country').addEventListener('change',()=>wChanged('country',$('terminal-country').value));
 $('evidence-mode').addEventListener('change',renderEvidence);$('evidence-query').addEventListener('input',renderEvidence);
 $('terminal-follow').addEventListener('click',()=>{const id=current().company;if(state.followed.includes(id))state.followed=state.followed.filter(x=>x!==id);else if(state.followed.length<30)state.followed.push(id);else{$('terminal-save-status').textContent='Your watchlist has 30 companies. Remove one before adding another.';return;}renderFollowButton();renderFollowing();persist();});
 $('terminal-workspace').addEventListener('change',()=>{state.active=$('terminal-workspace').value;renderWorkspace();persist('Workspace selected. Its settings stay in this browser.');});
 $('terminal-reset').addEventListener('click',()=>{state.workspaces[state.active]={company:companies[0]?.id||'tcs',indicator:'growth',country:'IND',layout:defaultLayout(state.active)};renderWorkspace();persist('This workspace has been reset. Followed companies are retained.');});
 function wChanged(key,value){current()[key]=value;renderMacro();persist();updateURL();}
}).catch(()=>{$('terminal-status').textContent='The workspace could not be loaded. Use the research links above to open individual records.';});
