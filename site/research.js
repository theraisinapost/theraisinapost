/* Source-backed research explorer; progressive enhancement, no invented data. */
(() => {
  'use strict';
  const kind=document.body.dataset.research;
  if(kind==='atlas'){
    const buttons=[...document.querySelectorAll('[data-owner]')];
    const graph=document.getElementById('ownership-graph');
    const select=owner=>{
      if(!owner)return;
      document.getElementById('owner-name').textContent=owner.label;
      document.getElementById('owner-value').textContent=owner.percent.toFixed(2)+'%';
      document.getElementById('owner-source').href=owner.source;
      buttons.forEach(b=>{const active=b.dataset.owner===owner.id;b.classList.toggle('selected',active);b.setAttribute('aria-pressed',String(active));});
    };
    fetch('data/ownership-tcs.json').then(r=>{if(!r.ok)throw Error('Unavailable');return r.json();}).then(data=>{
      if(!Array.isArray(data.owners)||!data.owners.length)throw Error('Invalid');
      const owners=data.owners;
      buttons.forEach(b=>b.addEventListener('click',()=>select(owners.find(o=>o.id===b.dataset.owner))));
      if(typeof window.cytoscape!=='function')return;
      const elements=[{data:{id:'tcs',label:'TCS'},classes:'focus'}]
        .concat(owners.map(o=>({data:{id:o.id,label:o.label}})))
        .concat(owners.map(o=>({data:{id:'link-'+o.id,source:o.id,target:'tcs',label:o.percent.toFixed(2)+'%'}})));
      graph.textContent='';
      const cy=window.cytoscape({
        container:graph,elements,
        layout:{name:'concentric',concentric:n=>n.id()==='tcs'?2:1,levelWidth:()=>1,minNodeSpacing:30,spacingFactor:1.28},
        style:[
          {selector:'node',style:{'label':'data(label)','background-color':'#fff','border-width':1,'border-color':'#bbb','color':'#222','font-family':'Geist, sans-serif','font-size':10,'text-wrap':'wrap','text-max-width':88,'width':103,'height':60,'shape':'round-rectangle','text-valign':'center','text-halign':'center'}},
          {selector:'.focus',style:{'background-color':'#a41129','border-color':'#a41129','color':'white','font-weight':700,'font-size':16,'height':74,'width':100}},
          {selector:'edge',style:{'width':1.3,'line-color':'#bbb','target-arrow-shape':'triangle','target-arrow-color':'#bbb','curve-style':'bezier','label':'data(label)','color':'#555','font-size':10,'text-background-color':'white','text-background-opacity':1,'text-background-padding':3}},
          {selector:'node:selected',style:{'border-width':3,'border-color':'#a41129'}}
        ],minZoom:.5,maxZoom:1.4
      });
      cy.on('tap','node',e=>select(owners.find(o=>o.id===e.target.id())));
      buttons.forEach(b=>b.addEventListener('click',()=>{cy.nodes().unselect();cy.getElementById(b.dataset.owner).select();}));
    }).catch(()=>{});
  }
  if(kind==='timeline'){
    const chips=[...document.querySelectorAll('[data-stage-filter]')];
    const records=[...document.querySelectorAll('#policy-milestones li')];
    chips.forEach(chip=>chip.addEventListener('click',()=>{
      const mode=chip.dataset.stageFilter;
      chips.forEach(c=>{const active=c===chip;c.classList.toggle('active',active);c.setAttribute('aria-pressed',String(active));});
      records.forEach(r=>r.hidden=mode==='scheduled'?r.dataset.stage!=='scheduled':mode==='past'?r.dataset.stage==='scheduled':false);
    }));
    fetch('data/dpdp-timeline.json').then(r=>{if(!r.ok)throw Error('Unavailable');return r.json();}).then(data=>{
      if(!Array.isArray(data.events)||!window.vis?.Timeline)return;
      const el=document.getElementById('policy-timeline-visual');
      el.textContent='';
      const items=data.events.map(e=>({id:e.id,content:e.title,start:e.date,title:e.title+' · '+e.date}));
      const tl=new window.vis.Timeline(el,items,{height:190,min:'2023-01-01',max:'2028-01-01',start:'2023-01-01',end:'2028-01-01',stack:true,showCurrentTime:false,zoomKey:'ctrlKey',editable:false,orientation:{axis:'bottom'},margin:{item:12,axis:18}});
      tl.on('select',p=>{const chosen=data.events.find(e=>e.id===p.items[0]);if(!chosen)return;const item=records.find(r=>r.querySelector('time')?.dateTime===chosen.date&&r.textContent.includes(chosen.title));item?.scrollIntoView({behavior:'smooth',block:'center'});});
    }).catch(()=>{});
  }
})();