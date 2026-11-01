import test from 'node:test';
import assert from 'node:assert/strict';
import {cleanState,cleanLayout,defaultLayout,movePanel,ordered,safeLink,finiteRows} from '../site/components/terminal-state.mjs';
test('stored workspaces drop unknown companies, unsafe content and invalid coordinates',()=>{
 const bad=defaultLayout();bad[0]={...bad[0],x:-2,content:'<script>bad</script>'};
 const s=cleanState({active:'evil',followed:['tcs','tcs','unknown'],workspaces:{overview:{company:'unknown',indicator:'fake',country:'XXX',layout:bad}}},[{id:'tcs'}]);
 assert.equal(s.active,'overview');assert.deepEqual(s.followed,['tcs']);assert.equal(s.workspaces.overview.company,'tcs');assert.equal(s.workspaces.overview.country,'IND');assert.deepEqual(s.workspaces.overview.layout,defaultLayout());
 const valid=defaultLayout().map(n=>({...n,content:'not restored'}));assert.ok(cleanLayout(valid).every(n=>!('content'in n)));
 assert.deepEqual(cleanState(null,[{id:'tcs'}]).followed,[]);
});
test('panel moves preserve unique panels and do not share workspace settings',()=>{
 const layout=defaultLayout(),moved=movePanel(layout,'evidence',-1);assert.equal(ordered(moved)[0].id,'evidence');assert.equal(new Set(moved.map(n=>n.id)).size,6);assert.deepEqual(layout,defaultLayout());
 const s=cleanState({},[{id:'tcs'}]);s.workspaces.company.indicator='inflation';assert.equal(s.workspaces.overview.indicator,'growth');
});
test('source links and observations reject executable links and nonfinite values',()=>{
 assert.equal(safeLink('javascript:alert(1)'),null);assert.equal(safeLink('https://user:pass@example.com'),null);
 assert.equal(safeLink('https://www.tcs.com/'),'https://www.tcs.com/');
 assert.equal(finiteRows([{period:'2024',value:2},{period:'2025',value:NaN},{period:'2026',value:true}]).length,1);
});
