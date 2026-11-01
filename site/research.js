/* Source-backed research explorer; progressive enhancement, no invented data. */
(() => {
  'use strict';
  const kind=document.body.dataset.research;
  if(kind==='atlas'){
    const rail=document.getElementById('company-rail');
    const graph=document.getElementById('ownership-graph');
    const search=document.getElementById('company-search');
    const sector=document.getElementById('company-sector');
    const allButton=document.getElementById('atlas-show-all');
    const breakdown=document.getElementById('atlas-breakdown');
    const categoryBar=document.getElementById('atlas-category-bar');
    const categoryLegend=document.getElementById('atlas-category-legend');
    const stat=document.getElementById('atlas-directory-meta');
    const compareFirst=document.getElementById('compare-first');
    const compareSecond=document.getElementById('compare-second');
    const compareResults=document.getElementById('compare-results');
    const compareNote=document.getElementById('compare-note');
    const exportButton=document.getElementById('atlas-export');

    let companies=[],selectedCompany=null,buttons=[],cy,showAll=false;
    const trim=x=>String(x||'').toLocaleLowerCase().trim();
    const dateText=iso=>new Date(iso+'T12:00:00Z').toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'});
    const validUrl=url=>{
      try{const u=new URL(url);return u.protocol==='https:'&&!u.username&&!u.password&&
        ['www.tcs.com','www.hul.co.in','rilstaticasset.akamaized.net','nsearchives.nseindia.com',
         'www.nseindia.com','www.titancompany.in','www.hdfc.bank.in','sbi.bank.in','www.icici.bank.in','www.kotak.bank.in'].includes(u.hostname);}
      catch(_){return false;}
    };
    const validCompany=c=>c&&typeof c.id==='string'&&/^[a-z0-9-]+$/.test(c.id)&&
      typeof c.name==='string'&&c.name.length<110&&typeof c.short==='string'&&
      typeof c.sector==='string'&&c.sector.length<50&&/^20\d{2}-\d{2}-\d{2}$/.test(c.asOf||'')&&
      ['Selected named shareholders','Aggregate categories'].includes(c.recordType)&&
      c.source&&typeof c.source.label==='string'&&validUrl(c.source.url)&&
      Array.isArray(c.owners)&&c.owners.length>0&&c.owners.length<30&&
      c.owners.every(o=>o&&typeof o.id==='string'&&typeof o.label==='string'&&o.label.length<180&&
        Number.isFinite(o.percent)&&o.percent>0&&o.percent<=100&&o.target===c.id&&
        o.asOf===c.asOf&&o.source===c.source.url&&
        o.kind===(c.recordType==='Aggregate categories'?'Aggregate category':'Named shareholder'))&&
      c.owners.reduce((v,o)=>v+o.percent,0)<=100.03;
    const create=(tag,txt,cls)=>{
      const item=document.createElement(tag);
      if(txt!==undefined)item.textContent=String(txt);
      if(cls)item.className=cls;
      return item;
    };
    const select=owner=>{
      if(!owner||!selectedCompany)return;
      document.getElementById('owner-name').textContent=owner.label;
      document.getElementById('owner-value').textContent=owner.percent.toFixed(2)+'%';
      document.getElementById('owner-source').href=owner.source;
      document.getElementById('owner-record-type').textContent=owner.kind;
      document.getElementById('owner-context').textContent=selectedCompany.name+
        ' · '+dateText(owner.asOf)+' · '+owner.kind;
      buttons.forEach(b=>{
        const active=b.dataset.owner===owner.id;
        b.classList.toggle('selected',active);b.setAttribute('aria-pressed',String(active));
      });
    };
    const renderBreakdown=company=>{
      categoryBar.replaceChildren();
      categoryLegend.replaceChildren();
      const aggregate=company.recordType==='Aggregate categories';
      breakdown.hidden=!aggregate;
      if(!aggregate)return;
      const values=company.owners;
      categoryBar.setAttribute('aria-label',values.map(v=>v.label+': '+v.percent.toFixed(2)+'%').join('; '));
      values.forEach((o,i)=>{
        const segment=create('span',undefined,'atlas-category-segment category-'+i);
        segment.style.width=o.percent+'%';
        segment.title=o.label+' · '+o.percent.toFixed(2)+'%';
        categoryBar.append(segment);
        const item=create('span',undefined,'atlas-category-key');
        const color=create('i',undefined,'atlas-key-color category-'+i);
        color.setAttribute('aria-hidden','true');
        item.append(color,create('span',o.label+' · '+o.percent.toFixed(2)+'%'));
        categoryLegend.append(item);
      });
    };
    const renderDirectory=()=>{
      const q=trim(search.value),industry=sector.value;
      const filtered=companies.filter(c=>(industry==='All'||c.sector===industry)&&
        (!q||trim(c.name+' '+c.short+' '+c.sector).includes(q)));
      const activeSearch=Boolean(q)||industry!=='All';
      let visible=activeSearch||showAll?filtered:filtered.slice(0,8);
      if(!activeSearch&&!showAll&&selectedCompany&&!visible.some(c=>c.id===selectedCompany.id))
        visible=[...visible.slice(0,7),selectedCompany];
      rail.replaceChildren();
      visible.forEach(c=>{
        const a=create('a',undefined,'company-card');
        a.href='?company='+encodeURIComponent(c.id);a.dataset.company=c.id;
        if(c.id===selectedCompany?.id)a.setAttribute('aria-current','true');
        a.append(create('small',c.sector),create('strong',c.short));
        const summary=c.recordType==='Aggregate categories'?
          (c.owners.find(o=>o.id.endsWith('-promoter'))||c.owners[0]):null;
        a.append(create('span',dateText(c.asOf)));
        if(summary)a.append(create('em',summary.label==='Public shareholders'?
          'Public shareholders · '+summary.percent.toFixed(2)+'%':
          'Promoter group · '+summary.percent.toFixed(2)+'%'));
        rail.append(a);
      });
      stat.textContent=filtered.length+' of '+companies.length+' companies · '+
        companies.reduce((sum,c)=>sum+c.owners.length,0)+' disclosed entries';
      allButton.hidden=activeSearch||companies.length<=8;
      allButton.textContent=showAll?'Show fewer companies':'View all '+companies.length+' companies';
      allButton.setAttribute('aria-expanded',String(showAll));
      if(!visible.length){
        rail.append(create('p','No companies match this search. Try another name or sector.','company-no-results'));
      }
    };
    const aggregateValues=company=>{
      if(company.recordType!=='Aggregate categories')return null;
      if(company.categoryTotals)return company.categoryTotals;
      const find=word=>company.owners.find(o=>String(o.label).toLowerCase().includes(word))?.percent??0;
      return {promoter:find('promoter'),public:find('public'),trust:find('employee trust')};
    };
    const renderComparison=()=>{
      const picks=[compareFirst.value,compareSecond.value].map(id=>companies.find(c=>c.id===id));
      compareResults.replaceChildren();
      if(picks.some(c=>!c)){
        compareNote.textContent='Select two companies to compare their dated filings.';
        return;
      }
      for(const company of picks){
        const card=create('article',undefined,'atlas-compare-company');
        const caption=create('p',company.sector+' · '+dateText(company.asOf),'atlas-compare-caption');
        const name=create('h3',company.name);
        const record=create('p',company.recordType,'atlas-compare-recordtype');
        const values=aggregateValues(company);
        card.append(caption,name,record);
        if(values){
          const rows=create('dl',undefined,'atlas-compare-values');
          [['Promoter & group',values.promoter],['Public shareholders',values.public],['Employee trusts',values.trust]]
            .forEach(([label,value])=>{
              const line=create('div');
              line.append(create('dt',label),create('dd',Number(value).toFixed(2)+'%'));
              rows.append(line);
            });
          card.append(rows);
        }else{
          card.append(create('p','Selected named shareholders only; a complete category breakdown is not included.','atlas-compare-warning'));
        }
        const source=create('a','View original disclosure');
        source.href=company.source.url;
        source.rel='noopener noreferrer';
        source.target='_blank';
        card.append(source);
        compareResults.append(card);
      }
      if(picks.some(c=>c.recordType!=='Aggregate categories')){
        compareNote.textContent='Not directly comparable: one or both records contain selected named holders, not complete aggregate categories.';
      }else if(picks[0].id===picks[1].id){
        compareNote.textContent='Both selections are the same company. Choose a different second company for a useful comparison.';
      }else{
        compareNote.textContent='Category shares use the A+B+C2 denominator; rounded totals may differ slightly from 100%. Source dates can differ. These categories do not identify ultimate beneficial owners.';
      }
    };
    const safeCsv=value=>{
      let text=String(value??'');
      if(/^[=+@\-\t\r]/.test(text))text="'"+text;
      return '"'+text.replaceAll('"','""')+'"';
    };
    const downloadCsv=()=>{
      if(!companies.length)return;
      const fields=['Company','Ticker','Sector','Snapshot date','Record type','Shareholder or category','Percentage','Original source'];
      const lines=[fields.map(safeCsv).join(',')];
      companies.forEach(c=>{
        c.owners.forEach(o=>{
          lines.push([c.name,c.symbol||c.short,c.sector,c.asOf,c.recordType,o.label,o.percent.toFixed(2),o.source].map(safeCsv).join(','));
        });
      });
      const text=lines.join('\r\n')+'\r\n';
      const url=URL.createObjectURL(new Blob(['\uFEFF',text],{type:'text/csv;charset=utf-8'}));
      const link=document.createElement('a');
      link.href=url;
      link.download='raisina-ownership-atlas-'+companies.length+'-companies.csv';
      document.body.append(link);
      link.click();
      link.remove();
      setTimeout(()=>URL.revokeObjectURL(url),1000);
    };
    compareFirst.addEventListener('change',renderComparison);
    compareSecond.addEventListener('change',renderComparison);
    exportButton.addEventListener('click',downloadCsv);
    const render=id=>{
      const company=companies.find(c=>c.id===id)||companies[0];
      if(!company)return;
      selectedCompany=company;
      const owners=company.owners;
      cy?.destroy();cy=null;
      graph.textContent='The disclosed shareholdings are listed below.';
      graph.setAttribute('aria-label','Shareholding diagram for '+company.name);
      document.getElementById('company-heading').textContent=
        (company.recordType==='Aggregate categories'?'Shareholding at ':'Who owns ')+company.short+
        (company.recordType==='Aggregate categories'?'':'?');
      document.getElementById('company-date').textContent=dateText(company.asOf);
      document.getElementById('company-coverage').textContent=owners.length+' entries';
      document.getElementById('company-scope').textContent=company.scope;
      document.getElementById('owner-source').textContent=company.source.label;
      document.getElementById('atlas-status').textContent=company.recordType==='Aggregate categories'?
        'Displaying filed category totals, not named individual owners.':'Displaying selected named shareholders; other holders may not be included.';
      renderBreakdown(company);
      const list=document.getElementById('owner-list');list.replaceChildren();
      owners.forEach(o=>{
        const button=create('button',undefined,'owner-row');
        button.type='button';button.dataset.owner=o.id;
        button.append(create('span',o.label),create('strong',o.percent.toFixed(2)+'%'));
        button.addEventListener('click',()=>select(o));
        list.append(button);
      });
      buttons=[...list.children];select(owners[0]);
      renderDirectory();
      if(typeof window.cytoscape!=='function')return;
      const elements=[{data:{id:'company',label:company.short},classes:'focus'}]
        .concat(owners.map(o=>({data:{id:o.id,label:o.label}})))
        .concat(owners.map(o=>({data:{id:'link-'+o.id,source:o.id,target:'company',label:o.percent.toFixed(2)+'%'}})));
      graph.textContent='';
      cy=window.cytoscape({
        container:graph,elements,
        layout:{name:'concentric',concentric:n=>n.id()==='company'?2:1,levelWidth:()=>1,minNodeSpacing:30,spacingFactor:1.28},
        style:[
          {selector:'node',style:{'label':'data(label)','background-color':'#fff','border-width':1,'border-color':'#bbb','color':'#222','font-family':'Inter, sans-serif','font-size':10,'text-wrap':'wrap','text-max-width':88,'width':103,'height':60,'shape':'round-rectangle','text-valign':'center','text-halign':'center'}},
          {selector:'.focus',style:{'background-color':'#171717','border-color':'#171717','color':'white','font-weight':700,'font-size':16,'height':74,'width':100}},
          {selector:'edge',style:{'width':1.3,'line-color':'#bbb','target-arrow-shape':'triangle','target-arrow-color':'#bbb','curve-style':'bezier','label':'data(label)','color':'#555','font-size':10,'text-background-color':'white','text-background-opacity':1,'text-background-padding':3}},
          {selector:'node:selected',style:{'border-width':3,'border-color':'#171717'}}
        ],minZoom:.5,maxZoom:1.4
      });
      cy.on('tap','node',e=>select(owners.find(o=>o.id===e.target.id())));
      buttons.forEach(b=>b.addEventListener('click',()=>{
        cy.nodes().unselect();cy.getElementById(b.dataset.owner).select();
      }));
    };
    rail.addEventListener('click',event=>{
      const a=event.target.closest('a[data-company]');
      if(!a||event.ctrlKey||event.metaKey||event.shiftKey||event.altKey)return;
      event.preventDefault();history.pushState({},'',a.href);render(a.dataset.company);
    });
    search.addEventListener('input',renderDirectory);
    sector.addEventListener('change',renderDirectory);
    allButton.addEventListener('click',()=>{showAll=!showAll;renderDirectory();});
    fetch('data/ownership-companies.json',{cache:'no-store'})
      .then(r=>{if(!r.ok)throw Error('Unavailable');return r.json();})
      .then(data=>{
        companies=Array.isArray(data.companies)?data.companies.filter(validCompany):[];
        if(!companies.length)throw Error('No valid ownership records');
        const sectors=[...new Set(companies.map(c=>c.sector))].sort((a,b)=>a.localeCompare(b));
        sectors.forEach(s=>{const option=create('option',s);option.value=s;sector.append(option);});
        document.getElementById('atlas-company-total').textContent=companies.length;
        [compareFirst,compareSecond].forEach(select=>{
          companies.forEach(c=>{
            const option=create('option',c.short+' · '+dateText(c.asOf));
            option.value=c.id;
            select.append(option);
          });
        });
        compareFirst.value=companies.find(c=>c.id==='reliance')?'reliance':companies[0].id;
        compareSecond.value=companies.find(c=>c.id==='hindalco')?'hindalco':companies[1]?.id||companies[0].id;
        exportButton.disabled=false;
        renderComparison();

        const fromURL=()=>render(new URLSearchParams(location.search).get('company'));
        window.addEventListener('popstate',fromURL);fromURL();
      }).catch(()=>{
        document.getElementById('atlas-status').textContent=
          'Company index unavailable. The original TCS snapshot remains below; open its filing to verify figures.';
      });
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