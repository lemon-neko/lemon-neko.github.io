(() => {
  const sky=document.querySelector('#sky'), canvas=document.querySelector('#star-map');
  const links=[...document.querySelectorAll('.world-links a')];
  const notes=new Map(links.map(link=>[link.dataset.world,document.querySelector(link.hash)]));
  const heroCopy=document.querySelector('#hero-copy'), detail=document.querySelector('#hero-world');
  const content=document.querySelector('#hero-world-content'), close=detail.querySelector('[data-close-world]');
  const motion=document.querySelector('#motion-toggle'), preference=matchMedia('(prefers-reduced-motion: reduce)');
  const nav=[...document.querySelectorAll('.nav-links a')];
  let renderer, active='', lastFocus, paused=false;

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

  function showNote(id){
    notes.forEach((note,key)=>{
      note.hidden=key!==id;
      note.open=key===id;
    });
  }
  showNote('ventures');

  function setNav(hash){
    nav.forEach(link=>{if(link.hash===hash)link.setAttribute('aria-current','location');else link.removeAttribute('aria-current');});
  }
  const sections=nav.map(link=>document.querySelector(link.hash));
  const scrollspy=new IntersectionObserver(()=>{
    const bottom=scrollY+innerHeight>=document.documentElement.scrollHeight-5;
    const edge=Math.max(112,innerHeight*.32);
    const current=bottom?document.querySelector('#connect'):[...sections].sort((a,b)=>b.getBoundingClientRect().top-a.getBoundingClientRect().top).find(section=>section.getBoundingClientRect().top<=edge);
    if(current)setNav('#'+current.id);
  },{rootMargin:'-25% 0px -60% 0px'});
  sections.forEach(section=>scrollspy.observe(section));
  nav.forEach(link=>link.addEventListener('click',()=>setNav(link.hash)));
  const goHome=()=>document.querySelector('#home').scrollIntoView({block:'start'});

  function visit(id,origin,scroll=true){
    if(!notes.has(id))return false;
    const note=notes.get(id);
    active=id;
    lastFocus=origin || document.activeElement;
    links.forEach(link=>{if(link.dataset.world===id)link.setAttribute('aria-current','location');else link.removeAttribute('aria-current');});
    const label=document.createElement('span');label.className='planet-name';label.textContent=note.dataset.name;
    const heading=document.createElement('h2');heading.textContent=note.querySelector('summary').textContent;
    content.replaceChildren(label,heading,note.querySelector('.world-copy').cloneNode(true));
    detail.hidden=false;heroCopy.hidden=true;
    showNote(id);renderer?.select(id);
    if(scroll)goHome();
    close.focus({preventScroll:true});
    return true;
  }
  function overview({restore=false,orbit=false}={}){
    active='';detail.hidden=true;heroCopy.hidden=false;
    links.forEach(link=>link.removeAttribute('aria-current'));
    showNote('ventures');
    if(orbit)renderer?.orbit();else renderer?.select('');
    goHome();
    if(restore){
      const target=lastFocus?.closest('.world-links')?lastFocus:document.querySelector('#explore-universe');
      target.focus({preventScroll:true});
    }
  }
  links.forEach(link=>{
    link.addEventListener('click',event=>{
      if(event.ctrlKey||event.metaKey||event.shiftKey||event.altKey)return;
      event.preventDefault();visit(link.dataset.world,link);
    });
    link.addEventListener('pointerenter',()=>renderer?.hover(link.dataset.world));
    link.addEventListener('pointerleave',()=>renderer?.hover(''));
    link.addEventListener('focus',()=>renderer?.hover(link.dataset.world));
    link.addEventListener('blur',()=>renderer?.hover(''));
  });
  document.querySelector('#explore-universe').addEventListener('click',event=>{
    if(event.ctrlKey||event.metaKey||event.shiftKey||event.altKey)return;
    event.preventDefault();links[0].focus();renderer?.hover('origin');
  });
  close.addEventListener('click',()=>overview({restore:true}));
  document.addEventListener('keydown',event=>{
    if(event.key==='Escape'&&active){event.preventDefault();overview({restore:true});}
  });
  function followHash(){
    const id=location.hash.replace(/^#world-/,'');
    if(location.hash.startsWith('#world-')&&notes.has(id))visit(id,null,false);
  }
  window.addEventListener('hashchange',followHash);
  followHash();
  window.yubaiUniverse={visit,overview};
  window.addEventListener('yubai:neko-found',()=>{
    const terminal=document.querySelector('#playground');
    terminal.classList.add('neko-signal');
    setTimeout(()=>terminal.classList.remove('neko-signal'),700);
  });

  if(location.protocol!=='file:' && !navigator.connection?.saveData && 'WebGL2RenderingContext' in window){
    import('./universe.js').then(({startUniverse})=>{
      renderer=startUniverse(canvas,{
        onPick:id=>visit(id,links.find(link=>link.dataset.world===id)),
        onLabels:positions=>positions.forEach(([id,x,y])=>{
          const link=links.find(item=>item.dataset.world===id);
          link.style.setProperty('--x',x.toFixed(2)+'%');link.style.setProperty('--y',y.toFixed(2)+'%');
        }),
        reduced:()=>preference.matches,paused:()=>paused
      });
      if(!renderer)return;
      if(active)renderer.select(active);
      motion.hidden=preference.matches;
      motion.addEventListener('click',()=>{
        paused=!paused;motion.textContent=paused?'继续动效':'暂停动效';
        renderer.refresh();
      });
      preference.addEventListener('change',()=>{motion.hidden=preference.matches;renderer.refresh();});
    }).catch(()=>{sky.classList.remove('is-rendered');});
  }
})();
