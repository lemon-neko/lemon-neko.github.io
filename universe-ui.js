(() => {
  const sky=document.querySelector('#sky'), canvas=document.querySelector('#star-map');
  const home=document.querySelector('#home'), map=document.querySelector('#universe');
  const labels=new Map([...map.querySelectorAll('[data-world]')].map(link=>[link.dataset.world,link]));
  const notes=new Map([...document.querySelectorAll('.world-note')].map(note=>[note.id.slice(6),note]));
  const observatory=notes.get('observatory'), journalPhoto=observatory.querySelector('.journal-photo');
  const selectors=[...document.querySelectorAll('.world-links a,.world-directory a')];
  const worldIds=[...notes.keys()], defaultId=worldIds[0];
  const motion=document.querySelector('#motion-toggle'), preview=document.querySelector('#world-preview');
  const previewCopy=preview.querySelector('.preview-copy');
  const previewIndex=document.querySelector('#preview-index'), previewName=document.querySelector('#preview-name');
  const previewNameZh=document.querySelector('#preview-name-zh'), previewIntro=document.querySelector('#preview-intro');
  const viewStory=document.querySelector('#view-story');
  const call=document.querySelector('#roommate-call'), reply=document.querySelector('#roommate-reply');
  const tour=document.querySelector('#tour-toggle'), explore=document.querySelector('#explore-universe');
  const close=document.querySelector('[data-close-world]'), preference=matchMedia('(prefers-reduced-motion: reduce)');
  const nav=[...document.querySelectorAll('.nav-links a')];
  const sections=[...document.querySelectorAll('main > [id]')];
  const fallbackStyles=new Map([...labels].map(([id,link])=>[id,link.getAttribute('style')]));
  const controller=new AbortController(), options={signal:controller.signal};
  let renderer, active='', story=defaultId, hovered='', shown, tourIndex=-1, tourTimer=0;
  let navFrame=0, hashFrame=0, lastFocus, paused=false, tourHasEntered=false;

  document.querySelectorAll('[data-project-link]').forEach(element=>{
    const link=document.getElementById(element.dataset.projectLink)?.closest('.project-card')?.querySelector('.project-link');
    if(link){element.href=link.href;element.target=link.target;element.rel=link.rel;}
  });
  const worldCopy=new Map([...notes].map(([id,note])=>{
    const heading=note.querySelector('h3'), intro=note.querySelector('.world-intro');
    heading.tabIndex=-1;
    return [id,{heading,intro,name:note.dataset.name,alt:heading.textContent}];
  }));
  selectors.forEach(link=>{
    const copy=worldCopy.get(link.dataset.world);
    link.setAttribute('aria-describedby',copy.intro.id);
    link.querySelector('strong,.world-directory-name').textContent=copy.name;
    const secondary=link.querySelector('small');
    if(secondary)secondary.textContent=copy.alt;
  });

  function update(){
    const selected=tourIndex<0?active:worldIds[tourIndex];
    const id=hovered||selected;
    notes.forEach((note,key)=>{note.hidden=key!==story;});
    selectors.forEach(link=>{
      const isLabel=labels.get(link.dataset.world)===link;
      if(link.dataset.world===(isLabel?selected:story))link.setAttribute('aria-current','location');
      else link.removeAttribute('aria-current');
      link.classList.toggle('is-hot',isLabel&&link.dataset.world===hovered);
    });
    map.dataset.mode=tourIndex>=0?'auto':selected?'focus':'overview';
    call.hidden=Boolean(selected);
    if(shown!==id){
      shown=id;
      previewIndex.hidden=!id;
      previewIndex.textContent=id?labels.get(id).querySelector('span').textContent+' / '+String(worldIds.length).padStart(2,'0'):'';
      const copy=worldCopy.get(id);
      previewName.textContent=copy?.name||'五个世界，一座宇宙。';
      previewNameZh.textContent=copy?.alt||'';
      previewIntro.textContent=copy?.intro.textContent||'悬停预览，点击星球聚焦。也可以使用下方的星球目录。';
      preview.style.setProperty('--preview-color',id?labels.get(id).style.getPropertyValue('--world'):'var(--accent-2)');
      if(!preference.matches)previewCopy.animate([{opacity:.35,transform:'translateY(4px)'},{opacity:1,transform:'none'}],{duration:240,easing:'ease-out'});
    }
    viewStory.hidden=!selected||id!==selected;
    if(selected)viewStory.setAttribute('href','#world-'+selected);
    renderer?.select(selected);
  }
  function setHover(id){
    if(hovered===id||tourIndex>=0)return;
    hovered=id;update();
  }
  function clearHover(){
    hovered='';renderer?.hover('');
  }
  function stopTour(){
    if(tourIndex<0)return;
    clearTimeout(tourTimer);tourIndex=-1;
    tour.setAttribute('aria-pressed','false');tour.textContent='自动探索';
    update();
  }
  function tourStep(){
    update();
    tourTimer=setTimeout(()=>{
      if(tourIndex===worldIds.length-1)stopTour();
      else {tourIndex++;tourStep();}
    },4600);
  }
  function setHash(hash){
    cancelAnimationFrame(hashFrame);
    if(location.hash!==hash)history.pushState(null,'',hash);
  }
  function startTour(scroll=false){
    stopTour();active='';clearHover();setHash('#home');
    if(scroll)home.scrollIntoView({block:'start'});
    const box=sky.getBoundingClientRect();
    tourHasEntered=box.bottom>0&&box.top<innerHeight;
    tourIndex=0;tour.setAttribute('aria-pressed','true');tour.textContent='停止探索';tourStep();
  }
  function focusWorld(id,origin,keyboard=false){
    stopTour();active=id;clearHover();lastFocus=origin;
    setHash('#focus-'+id);update();
    if(keyboard)viewStory.focus({preventScroll:true});
  }
  function visit(id,origin=document.activeElement){
    if(!notes.has(id))return false;
    stopTour();active=story=id;clearHover();
    if(origin!==viewStory)lastFocus=origin;
    setHash('#world-'+id);update();
    if(origin?.hasAttribute('data-open-case'))notes.get(id).querySelector('.world-case').open=true;
    if(!origin?.closest('.world-directory')){
      document.querySelector('#worlds').scrollIntoView({block:'start'});
      worldCopy.get(id).heading.focus({preventScroll:true});
    }
    return true;
  }
  function overview({restore=false,orbit=false}={}){
    if(orbit){startTour(true);return;}
    stopTour();active='';clearHover();setHash('#home');
    update();home.scrollIntoView({block:'start'});
    if(restore)(lastFocus&&map.contains(lastFocus)?lastFocus:explore).focus({preventScroll:true});
  }
  function followHash(){
    cancelAnimationFrame(hashFrame);
    stopTour();clearHover();
    const hash=location.hash, id=hash.slice(7);
    const isStory=hash.startsWith('#world-'), isFocus=hash.startsWith('#focus-');
    active=(isStory||isFocus)&&notes.has(id)?id:'';
    story=isStory&&active?active:defaultId;
    update();
    if(!active)return;
    hashFrame=requestAnimationFrame(()=>{
      if(isStory)notes.get(id).scrollIntoView({block:'start',behavior:'instant'});
      else if(sky.getBoundingClientRect().bottom<0||sky.getBoundingClientRect().top>=innerHeight)home.scrollIntoView({block:'start',behavior:'instant'});
    });
  }
  function intercept(link,fn){
    link.addEventListener('click',event=>{
      if(event.ctrlKey||event.metaKey||event.shiftKey||event.altKey)return;
      event.preventDefault();fn(event);
    },options);
  }
  document.querySelectorAll('a[data-world]').forEach(link=>{
    const id=link.dataset.world;
    intercept(link,event=>labels.get(id)===link?focusWorld(id,link,event.detail===0):visit(id,link));
  });
  intercept(explore,event=>focusWorld(defaultId,explore,event.detail===0));
  intercept(viewStory,()=>visit(viewStory.hash.slice(7),viewStory));
  intercept(close,()=>overview({restore:true}));
  labels.forEach((link,id)=>{
    for(const type of ['pointerenter','focus'])link.addEventListener(type,event=>{
      if(tourIndex<0&&event.pointerType!=='touch'){renderer?.hover(id);setHover(id);}
    },options);
    for(const type of ['pointerleave','blur'])link.addEventListener(type,()=>{renderer?.hover('');setHover('');},options);
  });
  preview.hidden=false;
  tour.hidden=false;
  tour.addEventListener('click',()=>tourIndex<0?startTour():stopTour(),options);
  const directControls='#tour-toggle,#view-story,.roommate-trigger,#roommate-call';
  document.addEventListener('keydown',event=>{
    if(event.key==='Escape'&&reply.textContent){event.preventDefault();clearGreeting();}
    else if(event.key==='Escape'&&(active||hovered||tourIndex>=0)){event.preventDefault();overview({restore:true});}
    else if(!(event.target.closest(directControls)&&(event.key==='Enter'||event.key===' ')))stopTour();
  },{...options,capture:true});
  window.addEventListener('hashchange',followHash,options);
  document.addEventListener('pointerdown',event=>{
    if(!event.target.closest(directControls))stopTour();
  },options);
  for(const type of ['wheel','touchmove'])window.addEventListener(type,stopTour,{...options,passive:true});
  function syncRoommateMotion(){sky.classList.toggle('is-motion-paused',paused||document.hidden);}
  document.addEventListener('visibilitychange',()=>{syncRoommateMotion();if(document.hidden)stopTour();},options);

  function shiftJournal(){
    if(observatory.hidden||preference.matches)return;
    const box=journalPhoto.getBoundingClientRect();
    if(box.bottom<=0||box.top>=innerHeight)return;
    const progress=(box.top+box.height/2-innerHeight/2)/(innerHeight/2);
    const limit=Math.min(7,box.height*.028);
    const shift=Math.round(Math.max(-1,Math.min(1,progress))*limit)+'px';
    if(journalPhoto.style.getPropertyValue('--photo-shift')!==shift)journalPhoto.style.setProperty('--photo-shift',shift);
  }
  function syncNav(){
    navFrame=0;
    shiftJournal();
    const edge=Math.max(116,innerHeight*.3);
    const current=scrollY+innerHeight>=document.documentElement.scrollHeight-4?sections[sections.length-1]:sections.filter(el=>el.getBoundingClientRect().top<=edge).pop()||home;
    const sectionId=current.id==='now'?'writing':current.id==='playground'?'about':current.id;
    nav.forEach(link=>{
      if(link.hash==='#'+sectionId){if(!link.hasAttribute('aria-current'))link.setAttribute('aria-current','location');}
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
  const roommateGroup=document.querySelector('#roommate-sighting');
  const sightings=new Map([...roommateGroup.querySelectorAll('[data-roommate]')].map(el=>[el.dataset.roommate,el]));
  const lines={
    claude:['等我折个书角。好了，听你说。','今天这页，借着星光刚好能读。','我给你留了个靠窗的位置。'],
    gpt:['我捡到一颗星，正在想它能做什么。','脑洞充电完毕。要不要一起瞎想五分钟？','我给刚才路过的彗星起了个名字。叫小逗号。'],
    deepseek:['咕噜！刚才那个泡泡是我吹的。','今天游得慢，正好可以数星星。','星图里有水吗？嘘，假装有。']
  };
  let greeting, sightingTimer=0, pendingSighting=false;
  function clearGreeting(){
    clearTimeout(sightingTimer);
    greeting?.classList.remove('is-greeted');
    roommateGroup.classList.remove('is-gathered');
    reply.textContent='';
    greeting=null;
    pendingSighting=false;
  }
  function showRoommate(){
    pendingSighting=false;
    greeting.classList.add('is-greeted');
    sightingTimer=setTimeout(clearGreeting,5200);
  }
  sightings.forEach((roommate,id)=>{
    const button=roommate.querySelector('button'), name=button.textContent.trim();
    let line=0;
    button.disabled=false;
    button.addEventListener('click',()=>{
      stopTour();clearGreeting();
      greeting=roommate;
      reply.textContent=name+' · '+lines[id][line];
      line=(line+1)%lines[id].length;
      showRoommate();
    },options);
  });
  call.addEventListener('click',()=>{
    stopTour();clearGreeting();
    roommateGroup.classList.add('is-gathered');
    reply.textContent='叮！三位室友都听见了。';
    if(!preference.matches&&!paused)renderer?.pulse();
    sightingTimer=setTimeout(clearGreeting,5200);
  },options);
  window.addEventListener('yubai:roommate',({detail:{id}})=>{
    const roommate=sightings.get(id);
    if(!roommate)return;
    clearGreeting();
    greeting=roommate;
    const box=sky.getBoundingClientRect();
    if(box.bottom>0&&box.top<innerHeight)showRoommate();
    else pendingSighting=true;
  },options);
  const tourObserver=new IntersectionObserver(([entry])=>{
    sky.classList.toggle('is-in-view',entry.isIntersecting);
    if(pendingSighting&&entry.isIntersecting)showRoommate();
    if(tourIndex<0)return;
    const box=sky.getBoundingClientRect();
    if(box.bottom>0&&box.top<innerHeight)tourHasEntered=true;
    else if(tourHasEntered)stopTour();
  });
  tourObserver.observe(sky);
  syncRoommateMotion();
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
    cancelAnimationFrame(hashFrame);stopTour();
    clearGreeting();
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
        onPick:id=>focusWorld(id,labels.get(id)),onHover:setHover,onFallback:fallback,
        onLabels:positions=>positions.forEach(([id,x,y])=>{
          const link=labels.get(id);link.style.setProperty('--x',x+'px');link.style.setProperty('--y',y+'px');
        }),
        reduced:()=>preference.matches,paused:()=>paused
      });
      if(!renderer)return;
      update();motion.hidden=preference.matches;
      motion.addEventListener('click',()=>{
        paused=!paused;motion.textContent=paused?'继续动效':'暂停动效';
        motion.setAttribute('aria-pressed',String(paused));syncRoommateMotion();renderer?.refresh();
      },options);
      preference.addEventListener('change',()=>{motion.hidden=preference.matches||!renderer;renderer?.refresh();},options);
    }).catch(fallback);
  }
})();
