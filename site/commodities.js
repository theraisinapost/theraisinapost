/* The Raisina Post / compact sourced commodities, FX and economic-calendar feed.
 * No values are published until a verifiable upstream response is received.
 * Indicative spot conversions are NOT exchange traded Indian prices. */
(() => {
  'use strict';
  const gramPerTroyOunce=31.1034768;
  const fields={gold:document.getElementById('spot-gold-value'),silver:document.getElementById('spot-silver-value'),ratio:document.getElementById('spot-ratio-value')};
  if(!fields.gold)return;
  const spotStatus=document.getElementById('spot-status');
  const fxStatus=document.getElementById('fx-status');
  const cash=v=>'₹'+new Intl.NumberFormat('en-IN',{maximumFractionDigits:0}).format(v);
  const fxCash=v=>'₹'+new Intl.NumberFormat('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2}).format(v);
  const numeric=v=>typeof v==='number'&&Number.isFinite(v)&&v>0;
  const dateIST=raw=>{
    const parsed=Date.parse(raw);
    if(!Number.isFinite(parsed))return null;
    return new Intl.DateTimeFormat('en-GB',{day:'numeric',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit',hour12:false,timeZone:'Asia/Kolkata'}).format(new Date(parsed))+' IST';
  };
  async function loadJSON(url){
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),10000);
    try{
      const response=await fetch(url,{cache:'no-store',signal:controller.signal});
      if(!response.ok)throw Error('Upstream unavailable');
      return await response.json();
    }finally{clearTimeout(timer);}
  }
  async function refreshSpot(){
    try{
      const data=await loadJSON('https://xaus.com/api/v1/spot?currency=INR&unit=gram&compact=1');
      if(!data||!data.data_state||!['fresh','stale'].includes(data.data_state.status))throw Error('Invalid data state');
      const state=data.data_state;
      const date=dateIST(state.as_of||data.updated_at);
      if(!date)throw Error('No source observation time');
      const quoteAge=Date.now()-Date.parse(state.as_of||data.updated_at);
      const stale=state.status==='stale'||quoteAge>1000*60*60*24||quoteAge<-(1000*60*10);
      const gold=data.xau;
      fields.gold.textContent=numeric(gold?.price)&&gold.currency==='INR'&&gold.unit==='gram'?cash(gold.price*10):'—';
      const silverValid=numeric(data.silver_usd_oz)&&numeric(data.fx_rate);
      fields.silver.textContent=silverValid?cash(data.silver_usd_oz*data.fx_rate*1000/gramPerTroyOunce):'—';
      fields.ratio.textContent=numeric(data.gold_silver_ratio)?data.gold_silver_ratio.toFixed(2):'—';
      spotStatus.textContent=(stale?'Stale quote':'Indicative spot')+' · '+date+' · XAUS';
      if(Object.values(fields).every(node=>node.textContent==='—'))spotStatus.textContent='Metal prices unavailable · XAUS';
    }catch(_){
      Object.values(fields).forEach(node=>node.textContent='—');
      spotStatus.textContent='Metal prices unavailable · XAUS';
    }
  }
  async function refreshFX(){
    try{
      const data=await loadJSON('https://api.frankfurter.dev/v2/rates?base=INR&quotes=USD,EUR,GBP');
      if(!Array.isArray(data))throw Error('Invalid rate table');
      let referenceDate='';
      for(const code of ['USD','EUR','GBP']){
        const row=data.find(item=>item&&item.base==='INR'&&item.quote===code&&numeric(item.rate)&&/^\d{4}-\d{2}-\d{2}$/.test(item.date));
        const target=document.getElementById('fx-'+code.toLowerCase()+'-value');
        target.textContent=row?fxCash(1/row.rate):'—';
        if(row)referenceDate=referenceDate? (referenceDate<row.date?referenceDate:row.date):row.date;
      }
      if(!referenceDate)throw Error('Reference rates unavailable');
      const reference=new Intl.DateTimeFormat('en-GB',{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'}).format(new Date(referenceDate+'T12:00:00Z'));
      fxStatus.textContent='Daily reference · '+reference+' · Frankfurter';
    }catch(_){
      ['usd','eur','gbp'].forEach(code=>document.getElementById('fx-'+code+'-value').textContent='—');
      fxStatus.textContent='Daily reference rates unavailable · Frankfurter';
    }
  }
  refreshSpot();
  refreshFX();
  // Updates are automatic only while the desk is being viewed; never invent a tick when offline.
  setInterval(()=>{if(document.visibilityState==='visible'){refreshSpot();refreshFX();}},15*60*1000);
  const calendar=document.getElementById('calendar-widget');
  const button=document.getElementById('calendar-load');
  button?.addEventListener('click',()=>{
    if(button.disabled)return;
    button.disabled=true;
    button.textContent='Calendar loaded';
    calendar.replaceChildren();
    const shell=document.createElement('div');
    shell.className='tradingview-widget-container';
    const body=document.createElement('div');
    body.className='tradingview-widget-container__widget';
    const credit=document.createElement('div');
    credit.className='tradingview-widget-copyright';
    const link=document.createElement('a');
    link.href='https://www.tradingview.com/economic-calendar/';
    link.target='_blank';
    link.rel='noopener noreferrer';
    link.textContent='Economic Calendar by TradingView';
    credit.appendChild(link);
    shell.append(body,credit);
    calendar.append(shell);
    const script=document.createElement('script');
    script.type='text/javascript';
    script.src='https://s3.tradingview.com/external-embedding/embed-widget-events.js';
    script.async=true;
    script.textContent=JSON.stringify({colorTheme:'light',isTransparent:true,locale:'en',countryFilter:'in,us,eu,cn,gb',importanceFilter:'1',width:'100%',height:450});
    shell.appendChild(script);
  });
})();