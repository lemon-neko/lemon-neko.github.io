(() => {
  const sky=document.querySelector('#sky'), canvas=document.querySelector('#star-map');
  const home=document.querySelector('#home'), map=document.querySelector('#universe');
  const labels=new Map([...map.querySelectorAll('[data-world]')].map(link=>[link.dataset.world,link]));
  const notes=new Map([...document.querySelectorAll('.world-note')].map(note=>[note.id.slice(6),note]));
  const selectors=[...document.querySelectorAll('.world-links a,.world-directory a')];
  const worldIds=[...notes.keys()], defaultId=worldIds[0];
  const status=document.querySelector('#map-status'), motion=document.querySelector('#motion-toggle');
  const tour=document.querySelector('#tour-toggle'), explore=document.querySelector('#explore-universe');
  const close=document.querySelector('[data-close-world]'), preference=matchMedia('(prefers-reduced-motion: reduce)');
  const nav=[...document.querySelectorAll('.nav-links a')];
  const sections=nav.map(link=>document.querySelector(link.hash));
  const fallbackStyles=new Map([...labels].map(([id,link])=>[id,link.getAttribute('style')]));
  const controller=new AbortController(), options={signal:controller.signal};
  let renderer, active='', hovered='', tourIndex=-1, tourTimer=0, focusTimer=0, navFrame=0, lastFocus, paused=false;

  document.querySelectorAll('[data-project-link],[data-project-copy]').forEach(element=>{
    const card=document.getElementById(element.dataset.projectLink || element.dataset.projectCopy)?.closest('.project-card');
    if(!card)return;
    if(element.dataset.projectCopy){
      element.textContent=card.querySelector('.project-description').textContent;
      const award=card.querySelector('.project-award');
      if(award){
        const line=document.createElement('p');line.className='world-award';line.textContent=award.textContent;
        element.after(line);
      }
    }else{
      const link=card.querySelector('.project-link');
      element.href=link.href;element.target=link.target;element.rel=link.rel;
    }
  });
  const intros=new Map([...notes].map(([id,note])=>[id,note.querySelector('.world-copy p').textContent]));
  const headings=new Map([...notes].map(([id,note])=>{
    const heading=note.querySelector('h3');heading.tabIndex=-1;return [id,heading];
  }));

  function update(){
    const selected=tourIndex<0?active:worldIds[tourIndex];
    const current=selected||defaultId, preview=hovered||selected;
    notes.forEach((note,id)=>{note.hidden=id!==current;});
    selectors.forEach(link=>{
      const label=link.closest('.world-links');
      const id=link.dataset.world;
      if(id===(label?selected:current))link.setAttribute('aria-current','location');else link.removeAttribute('aria-current');
      link.classList.toggle('is-hot',id===hovered);
    });
    map.dataset.mode=tourIndex>=0?'auto':selected?'focus':'overview';
    const message=preview?notes.get(preview).dataset.name+' · '+intros.get(preview):'五个世界，一座宇宙。';
    if(status.textContent!==message)status.textContent=message;
    renderer?.select(selected);
  }
  function setHover(id){
    if(hovered===id)return;
    hovered=id;update();
  }
  function stopTour(){
    if(tourIndex<0)return;
    clearTimeout(tourTimer);tourIndex=-1;
    tour.setAttribute('aria-pressed','false');tour.textContent='自动探索';
    update();
  }
  function tourStep(){
    if(tourIndex<0)return;
    update();
    tourTimer=setTimeout(()=>{
      if(tourIndex===worldIds.length-1)stopTour();
      else {tourIndex++;tourStep();}
    },4600);
  }
  function startTour(){
    clearTimeout(focusTimer);stopTour();active='';hovered='';renderer?.hover('');
    if(location.hash!=='#home')history.pushState(null,'','#home');
    home.scrollIntoView({block:'start'});
    tourIndex=0;tour.setAttribute('aria-pressed','true');tour.textContent='停止探索';tourStep();
  }
  function visit(id,origin=document.activeElement){
    if(!notes.has(id))return false;
    clearTimeout(focusTimer);stopTour();active=id;hovered='';renderer?.hover('');
    lastFocus=origin;
    if(location.hash!=='#world-'+id)history.pushState(null,'','#world-'+id);
    update();
    const box=sky.getBoundingClientRect();
    const fromMap=map.contains(origin)||origin===explore;
    const delay=fromMap&&renderer&&!preference.matches&&!paused&&box.bottom>0&&box.top<innerHeight?860:0;
    const reveal=()=>{
      notes.get(id).scrollIntoView({block:'start'});
      headings.get(id).focus({preventScroll:true});
    };
    if(delay)focusTimer=setTimeout(reveal,delay);else reveal();
    return true;
  }
  function overview({restore=false,orbit=false}={}){
    if(orbit){startTour();return;}
    clearTimeout(focusTimer);stopTour();active='';hovered='';renderer?.hover('');
    if(location.hash!=='#home')history.pushState(null,'','#home');
    update();home.scrollIntoView({block:'start'});
    if(restore)(lastFocus&&map.contains(lastFocus)?lastFocus:explore).focus({preventScroll:true});
  }
  function followHash(){
    clearTimeout(focusTimer);stopTour();hovered='';renderer?.hover('');
    const id=location.hash.slice(7);
    active=location.hash.startsWith('#world-')&&notes.has(id)?id:'';
    update();
    if(active)requestAnimationFrame(()=>{
      if(active===id)notes.get(id).scrollIntoView({block:'start',behavior:'instant'});
    });
  }
  function intercept(link,fn){
    link.addEventListener('click',event=>{
      if(event.ctrlKey||event.metaKey||event.shiftKey||event.altKey)return;
      event.preventDefault();fn();
    },options);
  }
  document.querySelectorAll('a[data-world]').forEach(link=>intercept(link,()=>visit(link.dataset.world,link)));
  intercept(explore,()=>visit(defaultId,explore));
  intercept(close,()=>overview({restore:true}));
  labels.forEach((link,id)=>{
    for(const type of ['pointerenter','focus'])link.addEventListener(type,()=>renderer?renderer.hover(id):setHover(id),options);
    for(const type of ['pointerleave','blur'])link.addEventListener(type,()=>renderer?renderer.hover(''):setHover(''),options);
  });
  tour.hidden=false;
  tour.addEventListener('click',()=>tourIndex<0?startTour():stopTour(),options);
  document.addEventListener('keydown',event=>{
    if(event.key==='Escape'&&(active||tourIndex>=0)){event.preventDefault();overview({restore:true});}
  },options);
  window.addEventListener('hashchange',followHash,options);
  for(const type of ['wheel','touchmove'])window.addEventListener(type,()=>{clearTimeout(focusTimer);stopTour();},{...options,passive:true});
  document.addEventListener('visibilitychange',()=>{if(document.hidden)stopTour();},options);

  function syncNav(){
    navFrame=0;
    const edge=Math.max(116,innerHeight*.3);
    const current=scrollY+innerHeight>=document.documentElement.scrollHeight-4?sections[sections.length-1]:sections.filter(el=>el.getBoundingClientRect().top<=edge).pop()||home;
    nav.forEach(link=>{
      if(link.hash==='#'+current.id){if(!link.hasAttribute('aria-current'))link.setAttribute('aria-current','location');}
      else link.removeAttribute('aria-current');
    });
  }
  window.addEventListener('scroll',()=>{if(!navFrame)navFrame=requestAnimationFrame(syncNav);},{...options,passive:true});
  const revealObserver=new IntersectionObserver(entries=>{
    entries.forEach(({target,isIntersecting})=>{
      if(!isIntersecting)return;
      target.classList.add('is-entered');revealObserver.unobserve(target);
    });
  },{threshold:.1});
  document.querySelectorAll('.section-heading,.project-card,.essay-feature').forEach(el=>revealObserver.observe(el));
  document.querySelectorAll('.project-card').forEach((el,i)=>el.style.setProperty('--reveal-delay',i*65+'ms'));
  const tourObserver=new IntersectionObserver(([entry])=>{
    if(!entry.isIntersecting&&tourIndex>=0)stopTour();
  });
  tourObserver.observe(home);
  followHash();syncNav();
  window.yubaiUniverse={visit,overview};
  const terminal=document.querySelector('#playground');
  let nekoTimer=0;
  window.addEventListener('yubai:neko-found',()=>{
    terminal.classList.add('neko-signal');
    if(!preference.matches){map.classList.add('neko-signal');renderer?.pulse();}
    clearTimeout(nekoTimer);
    nekoTimer=setTimeout(()=>{terminal.classList.remove('neko-signal');map.classList.remove('neko-signal');},700);
  },options);
  window.addEventListener('pagehide',event=>{
    clearTimeout(focusTimer);stopTour();
    if(event.persisted)return;
    clearTimeout(nekoTimer);cancelAnimationFrame(navFrame);
    revealObserver.disconnect();tourObserver.disconnect();controller.abort();
  },options);

  function fallback(){
    sky.classList.remove('is-rendered');renderer=null;motion.hidden=true;
    labels.forEach((link,id)=>link.setAttribute('style',fallbackStyles.get(id)));
  }
  if(location.protocol!=='file:'&&!navigator.connection?.saveData&&'WebGL2RenderingContext' in window){
    import('./universe.js').then(({startUniverse})=>{
      if(controller.signal.aborted)return;
      renderer=startUniverse(canvas,{
        onPick:id=>visit(id,labels.get(id)),onHover:setHover,onFallback:fallback,
        onLabels:positions=>positions.forEach(([id,x,y])=>{
          const link=labels.get(id);link.style.setProperty('--x',x+'px');link.style.setProperty('--y',y+'px');
        }),
        reduced:()=>preference.matches,paused:()=>paused
      });
      if(!renderer)return;
      update();motion.hidden=preference.matches;
      motion.addEventListener('click',()=>{
        paused=!paused;motion.textContent=paused?'继续动效':'暂停动效';
        motion.setAttribute('aria-pressed',String(paused));renderer?.refresh();
      },options);
      preference.addEventListener('change',()=>{motion.hidden=preference.matches||!renderer;renderer?.refresh();},options);
    }).catch(fallback);
  }
})();
