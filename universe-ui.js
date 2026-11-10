(() => {
  const sky=document.querySelector('#sky'), canvas=document.querySelector('#star-map');
  const home=document.querySelector('#home'), map=document.querySelector('#universe');
  const labels=new Map([...map.querySelectorAll('[data-world]')].map(link=>[link.dataset.world,link]));
  const notes=new Map([...document.querySelectorAll('.world-note')].map(note=>[note.id.slice(6),note]));
  const worldsSection=document.querySelector('#worlds'), directory=worldsSection.querySelector('.world-directory');
  const pager=worldsSection.querySelector('.world-pager'), adjacent=[...pager.querySelectorAll('a')];
  const observatory=notes.get('observatory'), journalPhoto=observatory.querySelector('.journal-photo');
  const selectors=[...document.querySelectorAll('.world-links a,.world-directory a')];
  const worldIds=[...notes.keys()], defaultId=worldIds[0];
  const motion=document.querySelector('#motion-toggle'), preview=document.querySelector('#world-preview');
  const previewCopy=preview.querySelector('.preview-copy');
  const previewIndex=document.querySelector('#preview-index'), previewName=document.querySelector('#preview-name');
  const previewNameZh=document.querySelector('#preview-name-zh'), previewIntro=document.querySelector('#preview-intro');
  const viewStory=document.querySelector('#view-story');
  const call=document.querySelector('#roommate-call'), reply=document.querySelector('#roommate-reply');
  const channelLink=document.querySelector('#roommate-channel');
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
    if(secondary&&labels.get(link.dataset.world)===link)secondary.textContent=copy.alt;
  });

  let displayedStory;
  function updateWorldDirectory(){
    if(displayedStory===story)return;
    displayedStory=story;
    const index=worldIds.indexOf(story);
    adjacent.forEach((link,i)=>{
      const target=worldIds[(index+(i===0?-1:1)+worldIds.length)%worldIds.length];
      link.href='#world-'+target;
      link.querySelector('strong').textContent=worldCopy.get(target).name;
    });
    const item=directory.querySelector('[aria-current]');
    const bounds=directory.getBoundingClientRect(), itemBounds=item.getBoundingClientRect();
    if(itemBounds.left<bounds.left||itemBounds.right>bounds.right){
      directory.scrollBy({left:itemBounds.left-bounds.left-(bounds.width-itemBounds.width)/2,behavior:'instant'});
    }
  }
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
    updateWorldDirectory();
    const mode=tourIndex>=0?'auto':selected?'focus':'overview';
    if(map.dataset.mode!==mode){
      map.dataset.mode=mode;
      if(reply.dataset.speaker)positionReply();
    }
    call.hidden=Boolean(selected);
    channelLink.hidden=Boolean(selected)||!channelLink.dataset.ready;
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
      const destination=origin?.closest('.world-pager')?directory:worldsSection;
      destination.scrollIntoView({block:'start'});
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
  adjacent.forEach(link=>intercept(link,()=>visit(link.hash.slice(7),link)));
  pager.hidden=false;
  worldsSection.querySelectorAll('[data-world-lab]').forEach(lab=>{
    const choices=[...lab.querySelectorAll('[data-world-answer]')], answer=lab.querySelector('.world-answer');
    let selected=choices[0];
    choices.forEach(button=>{button.disabled=false;});
    lab.addEventListener('click',event=>{
      const button=event.target.closest('[data-world-answer]');
      if(!button||button===selected)return;
      selected.setAttribute('aria-pressed','false');
      button.setAttribute('aria-pressed','true');
      selected=button;
      answer.textContent=button.dataset.worldAnswer;
    },options);
  });
  const creative=document.querySelector('#creative-lab'), idea=document.querySelector('#idea-result');
  const sticker=document.querySelector('#sticker-preview'), stickerStatus=document.querySelector('#sticker-status');
  const subjects=['路灯','走错路的彗星','没被用过的杯子','凌晨的电梯'];
  const forms=['写一段开场白','设计一枚邮票','画一张小海报','录十秒声音'];
  const twists=['只让猫听懂','用不上任何文字','留一半给别人补完','只用两种颜色'];
  const shapes=['星星','圆形','菱形'], colors=['雾紫色','杏橙色','薄荷绿'];
  let lastIdea=0;
  creative.querySelectorAll('button').forEach(button=>{button.disabled=false;});
  creative.addEventListener('click',event=>{
    const action=event.target.closest('[data-creative]')?.dataset.creative;
    if(!action)return;
    if(action==='idea'){
      const combinations=subjects.length*forms.length*twists.length;
      lastIdea=(lastIdea+1+Math.floor(Math.random()*(combinations-1)))%combinations;
      const subject=subjects[Math.floor(lastIdea/(forms.length*twists.length))];
      const form=forms[Math.floor(lastIdea/twists.length)%forms.length];
      idea.textContent='给'+subject+form+'，'+twists[lastIdea%twists.length]+'。';
      return;
    }
    const attribute=action==='shape'?'form':'color';
    const variants=action==='shape'?shapes:colors;
    sticker.dataset[attribute]=(Number(sticker.dataset[attribute])+1)%variants.length;
    const description=colors[sticker.dataset.color]+shapes[sticker.dataset.form];
    sticker.setAttribute('aria-label',description);
    stickerStatus.textContent=description;
  },options);
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
  let greeting, greetingText='', sightingTimer=0, pendingSighting=false;
  function clearGreeting(){
    clearTimeout(sightingTimer);
    greeting?.classList.remove('is-greeted');
    roommateGroup.classList.remove('is-gathered');
    reply.textContent='';
    delete reply.dataset.speaker;
    greeting=null;
    pendingSighting=false;
  }
  function positionReply(){
    const skyBox=sky.getBoundingClientRect(), speaker=greeting.querySelector('button').getBoundingClientRect();
    const x=speaker.left+speaker.width/2-skyBox.left;
    const width=reply.offsetWidth, height=reply.offsetHeight, gap=9, inset=4;
    const left=Math.max(inset,Math.min(x-width/2,skyBox.width-width-inset));
    const above=speaker.top-skyBox.top-height-gap;
    const below=speaker.bottom-skyBox.top+gap;
    const opensDown=above<inset&&below+height<=skyBox.height-inset;
    reply.style.setProperty('--reply-x',left+'px');
    reply.style.setProperty('--reply-y',(opensDown?below:above)+'px');
    reply.style.setProperty('--reply-tail',x-left+'px');
    reply.dataset.side=opensDown?'below':'above';
  }
  function showRoommate(){
    pendingSighting=false;
    greeting.classList.add('is-greeted');
    reply.textContent=greetingText;
    positionReply();
    reply.dataset.speaker=greeting.dataset.roommate;
    sightingTimer=setTimeout(clearGreeting,5200);
  }
  const replyObserver=new ResizeObserver(()=>{if(reply.dataset.speaker)positionReply();});
  replyObserver.observe(sky);
  sightings.forEach((roommate,id)=>{
    const button=roommate.querySelector('button'), name=button.textContent.trim();
    button.disabled=false;
    button.addEventListener('click',()=>{
      stopTour();clearGreeting();
      greeting=roommate;
      greetingText=name+' · '+roommateDialogue.line(id,'greetings');
      showRoommate();
    },options);
  });
  call.addEventListener('click',()=>{
    stopTour();clearGreeting();
    roommateGroup.classList.add('is-gathered');
    reply.textContent='叮！三位室友上线了，群聊在访客终端。';
    channelLink.dataset.ready='true';
    channelLink.hidden=false;
    window.dispatchEvent(new Event('yubai:roommates-summoned'));
    if(!preference.matches&&!paused)renderer?.pulse();
    sightingTimer=setTimeout(clearGreeting,5200);
  },options);
  window.addEventListener('yubai:roommate',({detail:{id,name,text}})=>{
    const roommate=sightings.get(id);
    if(!roommate)return;
    clearGreeting();
    greeting=roommate;
    greetingText=(name||roommateDialogue.characters[id].name)+' · '+(text||roommateDialogue.line(id,'greetings'));
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
    revealObserver.disconnect();tourObserver.disconnect();replyObserver.disconnect();controller.abort();
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
