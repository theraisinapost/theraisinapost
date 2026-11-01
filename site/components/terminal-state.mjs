export const PANEL_IDS=['company','evidence','macro','calendar','sources','watchlist'];
export const WORKSPACES=['overview','company','policy'];
export const INDICATORS=['growth','income','inflation','manufacturing','exports','brent','wti'];
export const COUNTRIES=['IND','CHN','IDN','VNM','BGD','USA'];
export function defaultLayout(workspace='overview'){
 const order=workspace==='company'?['company','evidence','watchlist','macro','calendar','sources']:workspace==='policy'?['evidence','calendar','sources','macro','company','watchlist']:PANEL_IDS;
 return order.map((id,i)=>({id,x:i%2?6:0,y:Math.floor(i/2)*7,w:6,h:7}));
}
export function cleanLayout(input,workspace='overview'){
 if(!Array.isArray(input)||input.length!==PANEL_IDS.length||new Set(input.map(n=>n?.id)).size!==PANEL_IDS.length)return defaultLayout(workspace);
 const valid=input.every(n=>PANEL_IDS.includes(n.id)&&['x','y','w','h'].every(k=>Number.isInteger(n[k]))&&n.x>=0&&n.y>=0&&n.y<=100&&n.w>=3&&n.w<=12&&n.x+n.w<=12&&n.h>=4&&n.h<=16);
 if(!valid)return defaultLayout(workspace);
 return input.map(({id,x,y,w,h})=>({id,x,y,w,h}));
}
export function cleanState(raw={},companies=[]){
 const ids=companies.map(c=>c.id),first=ids[0]||'tcs';
 const state={version:1,active:WORKSPACES.includes(raw?.active)?raw.active:'overview',followed:[],workspaces:{}};
 state.followed=Array.isArray(raw?.followed)?[...new Set(raw.followed.filter(id=>ids.includes(id)))].slice(0,30):[];
 for(const key of WORKSPACES){const w=raw?.workspaces?.[key]||{};state.workspaces[key]={company:ids.includes(w.company)?w.company:first,indicator:INDICATORS.includes(w.indicator)?w.indicator:'growth',country:COUNTRIES.includes(w.country)?w.country:'IND',layout:cleanLayout(w.layout,key)};}
 return state;
}
export function ordered(layout){return [...layout].sort((a,b)=>a.y-b.y||a.x-b.x);}
export function movePanel(layout,id,delta){const items=ordered(layout),i=items.findIndex(n=>n.id===id),next=i+delta;if(i<0||next<0||next>=items.length)return layout;[items[i],items[next]]=[items[next],items[i]];return items.map((n,j)=>({...n,x:j%2?6:0,y:Math.floor(j/2)*7,w:6,h:7}));}
export function safeLink(value){try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password?u.href:null;}catch{return null;}}
export function finiteRows(rows){return (Array.isArray(rows)?rows:[]).filter(r=>typeof r.period==='string'&&/^\d{4}(-\d{2}-\d{2})?$/.test(r.period)&&typeof r.value==='number'&&Number.isFinite(r.value)).sort((a,b)=>a.period.localeCompare(b.period));}
