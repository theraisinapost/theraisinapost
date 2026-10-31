/* Lightweight sharing: Shareon is requested only after a visitor opens the dialog. */
(() => {
  'use strict';
  const triggers=[...document.querySelectorAll('[data-share-url]')];
  if(!triggers.length)return;
  const dialog=document.createElement('dialog');
  dialog.className='share-modal';
  dialog.setAttribute('aria-label','Share article');
  dialog.innerHTML='<h2>Share this article.</h2><p id="share-title"></p><div class="share-options shareon" id="share-options"><a class="linkedin" target="_blank" rel="noopener noreferrer">LinkedIn</a><a class="whatsapp" target="_blank" rel="noopener noreferrer">WhatsApp</a><a class="email">Email</a><button type="button" id="share-copy">Copy link</button></div><button type="button" class="share-modal-close">Close</button>';
  document.body.appendChild(dialog);
  const panel=dialog.querySelector('#share-options');
  const copy=dialog.querySelector('#share-copy');
  let url='';
  let loading=false;
  let loaded=false;
  const lazyShareon=()=>{
    if(loaded){window.Shareon?.init?.();return;}
    if(loading)return;
    loading=true;
    const script=document.createElement('script');
    script.src='https://cdn.jsdelivr.net/npm/shareon@2/dist/shareon.iife.js';
    script.defer=true;
    script.onload=()=>{loaded=true;loading=false;window.Shareon?.init?.();};
    script.onerror=()=>{loading=false;};
    document.head.appendChild(script);
  };
  triggers.forEach(button=>button.addEventListener('click',()=>{
    const candidate=button.dataset.shareUrl;
    try{
      const parsed=new URL(candidate);
      if(parsed.protocol!=='https:'||parsed.hostname!=='raisinapost.substack.com'||!parsed.pathname.startsWith('/p/'))return;
      url=parsed.href;
    }catch(_){return;}
    const title=button.dataset.shareTitle||'The Raisina Post';
    panel.dataset.url=url;
    panel.dataset.title=title;
    dialog.querySelector('#share-title').textContent=title;
    panel.querySelector('.linkedin').href='https://www.linkedin.com/sharing/share-offsite/?url='+encodeURIComponent(url);
    panel.querySelector('.whatsapp').href='https://api.whatsapp.com/send?text='+encodeURIComponent(title+' '+url);
    panel.querySelector('.email').href='mailto:?subject='+encodeURIComponent(title)+'&body='+encodeURIComponent(url);
    dialog.showModal();
    lazyShareon();
  }));
  dialog.querySelector('.share-modal-close').addEventListener('click',()=>dialog.close());
  copy.addEventListener('click',async()=>{
    try{await navigator.clipboard.writeText(url);copy.textContent='Copied';}
    catch(_){copy.textContent='Copy unavailable';}
  });
  dialog.addEventListener('close',()=>{copy.textContent='Copy link';});
})();