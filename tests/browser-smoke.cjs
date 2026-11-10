const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const fs=require('node:fs');
const path=require('node:path');
const http=require('node:http');
const assert=require('node:assert/strict');

const root=path.resolve(__dirname,'..');
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.webp':'image/webp','.jpg':'image/jpeg','.png':'image/png','.svg':'image/svg+xml'};
const server=http.createServer((req,res)=>{
  const name=new URL(req.url,'http://localhost').pathname.replace(/^\/preview\//,'/').replace(/\/$/,'/index.html');
  const file=path.resolve(root,'.'+name);
  if(!file.startsWith(root+'/')||!fs.existsSync(file)){res.writeHead(404);return res.end();}
  res.setHeader('Content-Type',types[path.extname(file)]||'application/octet-stream');
  fs.createReadStream(file).pipe(res);
});
const shots=process.env.SCREENSHOTS_DIR;
async function capture(page,name,{section,...options}={}){
  if(!shots)return;
  if(options.fullPage||section)await page.locator((section?section+' ':'')+'img[loading=lazy]:visible').evaluateAll(images=>Promise.all(images.map(img=>{
    img.loading='eager';
    return img.decode();
  })));
  const surface=section?page.locator(section):page;
  await surface.screenshot({path:path.join(shots,name+'.png'),style:section?'.site-nav{position:static!important}.skip-link{visibility:hidden!important}':'',...options});
}
const ids=['origin','intelligence','ventures','observatory','playground'];
const intros=[
  '把零件拼起来，解决一个又一个问题。',
  '学着和 AI 一起，把事情做得更好。',
  '想做的事情，就试着把它做出来。',
  '认真感受生活里的每一个瞬间。',
  '从生活里找灵感，再把它们变成有趣的东西。'
];
const sections=['home','worlds','projects','writing','now','about','playground','connect'];
async function checkRoamingBounds(page){
  const overlaps=await page.locator('.roommate-track').evaluateAll(tracks=>{
    const sky=document.querySelector('#sky').getBoundingClientRect();
    const labels=[...document.querySelectorAll('.world-links a')].map(link=>link.getBoundingClientRect());
    return tracks.flatMap(track=>{
      const [roam]=track.getAnimations();
      const start=roam.currentTime, duration=roam.effect.getTiming().duration;
      const character=track.querySelector('.roommate-sighting'), failures=[];
      for(let step=0;step<=20;step++){
        roam.currentTime=duration*step/20;
        const box=character.getBoundingClientRect();
        if(box.left<sky.left-1||box.right>sky.right+1||box.top<sky.top-1||box.bottom>sky.bottom+1||
          labels.some(label=>box.left<label.right&&box.right>label.left&&box.top<label.bottom&&box.bottom>label.top))failures.push([character.dataset.roommate,step]);
      }
      roam.currentTime=start;
      return failures;
    });
  });
  assert.deepEqual(overlaps,[],'roommates leave the sky or overlap planet labels');
}
async function checkRoommateReply(page,id){
  await page.locator('#roommate-reply[data-speaker='+id+']').waitFor();
  const anchored=await page.locator('#roommate-reply').evaluate(reply=>{
    const sky=document.querySelector('#sky').getBoundingClientRect();
    const actor=document.querySelector('[data-roommate='+reply.dataset.speaker+'] button').getBoundingClientRect();
    const bubble=reply.getBoundingClientRect();
    const tailX=bubble.left+parseFloat(reply.style.getPropertyValue('--reply-tail'));
    const gap=reply.dataset.side==='below'?bubble.top-actor.bottom:actor.top-bubble.bottom;
    return bubble.left>=sky.left&&bubble.right<=sky.right&&Math.abs(tailX-actor.left-actor.width/2)<2&&Math.abs(gap-9)<2;
  });
  assert.ok(anchored,id+' reply is detached or outside the map');
}
async function checkIntro(page,id){
  const copy=intros[ids.indexOf(id)];
  assert.equal(await page.locator('#preview-intro').textContent(),copy);
  assert.equal(await page.locator('#intro-'+id).textContent(),copy);
  assert.equal(await page.locator('.world-links [data-world='+id+']').getAttribute('aria-describedby'),'intro-'+id);
}
async function checkFocus(page,id){
  assert.equal(new URL(page.url()).hash,'#focus-'+id);
  assert.equal(await page.locator('#universe').getAttribute('data-mode'),'focus');
  assert.equal(await page.locator('#view-story').getAttribute('href'),'#world-'+id);
  assert.ok(await page.locator('#view-story').isVisible());
  await checkIntro(page,id);
}
async function checkSelection(page,id){
  assert.equal(new URL(page.url()).hash,'#world-'+id);
  await page.locator('#world-'+id).waitFor();
  assert.equal(await page.locator('.world-note:visible').count(),1);
  assert.equal(await page.locator('.world-directory [aria-current]').getAttribute('data-world'),id);
}

(async()=>{
  if(shots)fs.mkdirSync(shots,{recursive:true});
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const browser=await chromium.launch({
    ...(process.env.CHROME_CHANNEL?{channel:process.env.CHROME_CHANNEL}:{}),
    headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--enable-webgl']
  });
  const url='http://127.0.0.1:'+server.address().port+'/preview/';
  try{
    const errors=[];
    async function checkedPage(options){
      const page=await browser.newPage(options);
      page.on('pageerror',e=>errors.push(e.message));
      page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
      page.on('response',response=>{if(response.url().startsWith(url)&&response.status()>=400)errors.push(response.status()+' '+response.url());});
      return page;
    }
    const desktop=await checkedPage({viewport:{width:1440,height:980},reducedMotion:'reduce'});
    await desktop.goto(url);await desktop.locator('#sky.is-rendered').waitFor();
    const mapRoommates=desktop.locator('#roommate-sighting .roommate-sighting');
    assert.deepEqual(await mapRoommates.locator('span').allTextContents(),['Claude','GPT','DeepSeek']);
    assert.equal(await desktop.locator('#roommate-sighting .roommate-sighting:visible').count(),3);
    assert.deepEqual(await desktop.locator('.roommate-track').evaluateAll(nodes=>nodes.map(node=>getComputedStyle(node).animationName)),['none','none','none']);
    assert.deepEqual(await desktop.locator('main > [id]').evaluateAll(nodes=>nodes.map(el=>el.id)),sections);
    assert.equal(await desktop.locator('.hero-principle').textContent(),'Enough abstraction makes it concrete.');
    assert.equal(await desktop.locator('.world-directory [data-world=ventures] .world-directory-name').textContent(),'Life');
    assert.deepEqual(await desktop.locator('.world-directory small').allTextContents(),['理解世界','拓展认知','主动创造','感受世界','表达自我']);
    assert.deepEqual(await desktop.locator('.world-links [data-world=ventures] :is(strong,small)').allTextContents(),['Life','人生']);
    await capture(desktop,'1440x980');
    const gpt=desktop.getByRole('button',{name:'和 GPT 打招呼'});
    const roommateReply=desktop.locator('#roommate-reply');
    for(const [id,name] of [['claude','Claude'],['gpt','GPT'],['deepseek','DeepSeek']]){
      await desktop.getByRole('button',{name:'和 '+name+' 打招呼'}).click();
      await checkRoommateReply(desktop,id);
    }
    await gpt.click();
    assert.match(await roommateReply.textContent(),/^GPT ·/);
    const firstReply=await roommateReply.textContent();
    await gpt.press('Enter');
    assert.notEqual(await roommateReply.textContent(),firstReply);
    assert.equal(new URL(desktop.url()).hash,'');
    await capture(desktop,'roommate-chat');
    await gpt.press('Escape');
    assert.equal(await roommateReply.textContent(),'');
    await desktop.getByRole('button',{name:'召唤室友！'}).click();
    assert.ok(await desktop.locator('#roommate-sighting.is-gathered').count());
    assert.match(await roommateReply.textContent(),/三位室友/);
    assert.equal(await desktop.locator('#roommate-channel:visible').getAttribute('href'),'#playground');
    assert.match(await desktop.locator('.terminal-chat-title').textContent(),/^三位室友上线/);
    await desktop.keyboard.press('Escape');
    assert.equal(await desktop.locator('#roommate-sighting.is-gathered').count(),0);
    await capture(desktop,'desktop-full',{fullPage:true});
    const canvas=desktop.locator('#star-map'), box=await canvas.boundingBox();
    const position={x:Math.round(box.width*.21),y:Math.round(box.height*.24)};
    await canvas.hover({position});
    await desktop.locator('.world-links [data-world=origin].is-hot').waitFor();
    assert.equal(await desktop.locator('#preview-name').textContent(),'Origin');
    await checkIntro(desktop,'origin');
    assert.equal(new URL(desktop.url()).hash,'');
    await desktop.locator('.hero-copy h1').hover();
    assert.equal(await desktop.locator('#preview-name').textContent(),'五个世界，一座宇宙。');
    await canvas.click({position});
    await checkFocus(desktop,'origin');
    assert.equal(await desktop.evaluate(()=>scrollY),0);
    await capture(desktop,'world-focus');
    await desktop.locator('#view-story').click();
    await checkSelection(desktop,'origin');
    await capture(desktop,'worlds',{section:'#worlds'});
    await desktop.goBack();await checkFocus(desktop,'origin');
    await desktop.waitForFunction(()=>document.querySelector('#sky').getBoundingClientRect().top<innerHeight/2);
    await desktop.goForward();await checkSelection(desktop,'origin');
    await desktop.keyboard.press('Escape');
    assert.equal(new URL(desktop.url()).hash,'#home');
    for(const id of ids){
      const label=desktop.locator('.world-links [data-world='+id+']');
      await label.focus();
      assert.equal(await desktop.locator('#preview-name').textContent(),await label.locator('strong').textContent());
      await checkIntro(desktop,id);
      await label.press('Enter');await checkFocus(desktop,id);
      assert.ok(await desktop.locator('#view-story').evaluate(el=>el===document.activeElement));
      await desktop.locator('#view-story').press('Enter');await checkSelection(desktop,id);
      if(id==='observatory'){
        const photo=desktop.locator('.journal-photo img');
        assert.ok(await photo.evaluate(async img=>{await img.decode();return img.naturalWidth>0;}));
        assert.equal(await photo.evaluate(img=>getComputedStyle(img).transform),'none');
      }
      if(shots)await desktop.locator('#world-'+id+' h3').blur();
      await capture(desktop,'world-'+id,{section:'#worlds'});
      if(id==='playground'){
        const toys=desktop.locator('.playground-toys details');
        await toys.nth(0).locator('summary').press('Enter');
        await toys.nth(1).locator('summary').click();
        assert.equal(await desktop.locator('.playground-toys details[open]').count(),2);
      }
      await desktop.locator('[data-close-world]').click();
      assert.equal(await desktop.locator('#universe').getAttribute('data-mode'),'overview');
    }
    await desktop.locator('#explore-universe').click();await checkFocus(desktop,'origin');
    await desktop.locator('#projects').evaluate(el=>el.scrollIntoView({behavior:'instant'}));
    await checkFocus(desktop,'origin');
    assert.ok(await desktop.locator('#world-playground').isVisible());
    assert.equal(await desktop.locator('#projects .project-card').count(),3);
    assert.deepEqual(await desktop.locator('#projects .project-cover').evaluateAll(images=>images.map(img=>img.getAttribute('src'))),[
      'public/project-carelink-workbench.jpg','public/project-podcast-recording.jpg','public/project-yougan-interface.jpg'
    ]);
    assert.deepEqual(await desktop.locator('.currently-list strong').allTextContents(),['Building','Exploring','Creating','Life']);
    assert.equal(await desktop.locator('.notes-in-progress li').count(),2);
    const podcasts=desktop.getByRole('region',{name:'播客节目 小宇宙'});
    for(const [name,id] of [['观猹','6a9ad194c138f60c044ae4bf'],['熠点点','68eb24418a7ae5b458b63104']]){
      const link=podcasts.getByRole('link',{name:new RegExp('^'+name)});
      assert.equal(await link.getAttribute('href'),'https://www.xiaoyuzhoufm.com/podcast/'+id);
      assert.equal(await link.getAttribute('target'),'_blank');
    }
    assert.equal(await desktop.locator('.notes-in-progress a').count(),0);
    assert.equal(await desktop.locator('#notes-in-progress-title span').textContent(),'Draft');
    assert.ok((await desktop.locator('.note-podcast .note-kind').textContent()).includes('虚构样例'));
    assert.ok((await desktop.locator('.currently-list').textContent()).includes('优先验证 AI 入住咨询和院内照护协同'));
    assert.equal(await desktop.locator('#connect-title').textContent(),'来打个招呼');
    await capture(desktop,'selected-work',{section:'#projects'});
    await capture(desktop,'field-notes',{section:'#writing'});
    await capture(desktop,'about',{section:'#about'});
    await desktop.goto(url+'#focus-intelligence');await checkFocus(desktop,'intelligence');
    await desktop.goto(url+'#world-intelligence');await checkSelection(desktop,'intelligence');
    const intelligence=desktop.locator('#world-intelligence');
    await intelligence.getByRole('button',{name:'GPT',exact:true}).press('Enter');
    assert.match(await intelligence.getByRole('status').textContent(),/二十分钟/);
    await intelligence.getByRole('button',{name:'DeepSeek',exact:true}).click();
    assert.match(await intelligence.getByRole('status').textContent(),/改一个变量/);
    assert.equal(await intelligence.locator('[aria-pressed=true]').count(),1);
    await desktop.locator('.world-directory [data-world=ventures]').click();
    await checkSelection(desktop,'ventures');
    await desktop.goBack();await checkSelection(desktop,'intelligence');
    await desktop.goForward();await checkSelection(desktop,'ventures');
    const life=desktop.locator('#world-ventures');
    await life.getByRole('button',{name:'迭代',exact:true}).click();
    assert.match(await life.getByRole('status').textContent(),/哪条线该擦掉/);
    await desktop.locator('.world-pager [rel=next]').press('Enter');
    await checkSelection(desktop,'observatory');
    await desktop.goBack();await checkSelection(desktop,'ventures');
    await desktop.goForward();await checkSelection(desktop,'observatory');
    await desktop.locator('.journal-feature summary').press('Enter');
    assert.ok(await desktop.locator('.journal-feature[open] p').isVisible());
    await desktop.locator('.journal-strip summary').first().click();
    assert.ok(await desktop.locator('.journal-strip details[open] p').isVisible());
    assert.equal(await desktop.locator('#world-observatory .world-copy').evaluate(el=>getComputedStyle(el).animationName),'none');
    await desktop.locator('.world-pager [rel=next]').click();
    await checkSelection(desktop,'playground');
    const originalIdea=await desktop.locator('#idea-result').textContent();
    await desktop.getByRole('button',{name:'抽一条灵感'}).click();
    assert.notEqual(await desktop.locator('#idea-result').textContent(),originalIdea);
    await desktop.getByRole('button',{name:'换形状'}).press('Enter');
    await desktop.getByRole('button',{name:'换颜色'}).click();
    assert.equal(await desktop.locator('#sticker-preview').getAttribute('aria-label'),'杏橙色圆形');
    await desktop.locator('.world-pager [rel=next]').click();
    await checkSelection(desktop,'origin');
    await desktop.locator('.origin-modules summary').filter({hasText:'Pipeline'}).press('Enter');
    assert.match(await desktop.locator('.origin-modules details[open] p').textContent(),/隔离环境执行/);
    await desktop.locator('.world-pager [rel=prev]').click();
    await checkSelection(desktop,'playground');
    await desktop.locator('#about summary').filter({hasText:/03 Agent$/}).click();
    assert.ok(await desktop.locator('#about details[open]').filter({hasText:'怎么让 AI 从回答问题'}).count());
    await desktop.locator('#writing').evaluate(el=>el.scrollIntoView({behavior:'instant'}));
    await desktop.waitForFunction(()=>document.querySelector('.nav-links [aria-current]')?.hash==='#writing');

    await desktop.locator('.essay-feature summary').click();
    assert.ok(await desktop.locator('.essay-feature details[open]').getByText('我写东西时总忍不住补一句',{exact:false}).isVisible());
    await desktop.locator('[data-open-case]').click();
    await checkSelection(desktop,'origin');
    assert.ok(await desktop.locator('.world-case[open]').isVisible());

    const input=desktop.locator('#terminal-input'), output=desktop.locator('#terminal-output');
    async function command(text){await input.fill(text);await input.press('Enter');}
    for(const [cmd,copy] of [['help','可用命令'],['about','AI Engineer'],['now','当前作品'],['projects','Podcast Workspace'],['echo 宇宙坐标','宇宙坐标']]){
      await command(cmd);assert.ok((await output.textContent()).includes(copy));
    }
    await desktop.getByRole('button',{name:'projects',exact:true}).click();
    assert.ok((await output.textContent()).includes('ITEC × OpenHex Hackathon 挑战组一等奖'));
    await command('fortune');assert.ok(await output.locator('.terminal-success').count());
    await command('links');assert.ok(await output.locator('a[href="https://carelink.pw/"]').count());
    await command('visit playground');await checkSelection(desktop,'playground');
    await command('visit ventures');await checkSelection(desktop,'ventures');
    await command('visit life');await checkSelection(desktop,'ventures');
    await command('orbit');assert.equal(await desktop.locator('#universe').getAttribute('data-mode'),'auto');
    await command('universe');assert.equal(await desktop.locator('#universe').getAttribute('data-mode'),'overview');
    await command('neko');assert.ok(await output.locator('.terminal-ascii').count());
    await input.press('ArrowUp');assert.equal(await input.inputValue(),'neko');
    for(const [id,name] of [['claude','Claude'],['gpt','GPT'],['deepseek','DeepSeek']]){
      await command(id);
      const reply=output.locator('.terminal-roommate').last();
      assert.ok((await reply.textContent()).startsWith(name));
      assert.equal(await reply.locator('use').getAttribute('href'),'#roommate-'+id);
      assert.equal(await desktop.locator('#roommate-sighting .is-greeted').count(),0,'offscreen greeting started early');
      await reply.locator('a').click();
      const sighting=desktop.locator('#roommate-sighting [data-roommate='+id+'].is-greeted');
      await sighting.waitFor();
      await checkRoommateReply(desktop,id);
      assert.equal((await roommateReply.textContent())+' 去星图看看 ↑',await reply.textContent());
      assert.equal(await sighting.locator('use').getAttribute('href'),'#roommate-'+id);
      assert.equal(await desktop.locator('#roommate-sighting .roommate-sighting:visible').count(),3);
    }
    await capture(desktop,'deepseek-sighting');
    for(const [id,name] of [['claude','Claude'],['gpt','GPT'],['deepseek','DeepSeek']]){
      await command('clear');
      const button=desktop.locator('.roommate-card[data-command='+id+']');
      await button.click();
      const reply=output.locator('.terminal-roommate').last();
      assert.ok((await reply.textContent()).startsWith(name));
      assert.equal(await button.locator('svg').evaluate(svg=>getComputedStyle(svg).animationName),'none');
      await capture(desktop,'roommate-'+id,{section:'#playground .console-layout'});
    }
    await command('clear');assert.equal(await output.textContent(),'');
    const groupMessages=output.locator('.terminal-roommate');
    await command('chat coding');
    assert.match(await output.locator('.terminal-chat-title').textContent(),/^开发部日常.*本地剧本/);
    assert.equal(await groupMessages.count(),0);
    assert.ok(await output.locator('.terminal-typing').isVisible());
    assert.equal(await output.locator('.terminal-typing span').evaluate(el=>getComputedStyle(el).animationName),'none');
    await groupMessages.first().waitFor();
    await output.locator('.terminal-typing').waitFor({state:'detached',timeout:6000});
    assert.ok(await groupMessages.count()>=4&&await groupMessages.count()<=8);
    assert.deepEqual([...new Set(await groupMessages.evaluateAll(rows=>rows.map(row=>row.dataset.speaker)))].sort(),['claude','deepseek','gpt']);
    assert.ok(await groupMessages.evaluateAll(rows=>rows.every(row=>row.querySelector('use').getAttribute('href')==='#roommate-'+row.dataset.speaker)));
    await capture(desktop,'roommate-group-chat',{section:'#playground .console-layout'});
    await command('chat midnight');
    await input.press('Control+l');
    await desktop.waitForTimeout(800);
    assert.equal(await output.textContent(),'','a cleared chat wrote back into the terminal');
    await command('chat unknown');
    assert.match(await output.locator('.terminal-error').textContent(),/没找到这个频道/);
    assert.deepEqual(errors,[]);
    console.log('1440px: raycast hover/click, all worlds, keyboard, hash/history, scroll navigation, timeline, console passed');

    await desktop.goto(url);
    await desktop.clock.install();
    await desktop.locator('#tour-toggle').click();
    for(const [i,id] of ids.entries()){
      if(i)await desktop.clock.fastForward(4600);
      assert.equal(await desktop.locator('#view-story').getAttribute('href'),'#world-'+id);
      assert.equal(await desktop.locator('#preview-index').textContent(),'0'+(i+1)+' / 05');
      await checkIntro(desktop,id);
      assert.equal(await desktop.evaluate(()=>scrollY),0);
    }
    await desktop.locator('#tour-toggle').click();
    assert.equal(await desktop.locator('#universe').getAttribute('data-mode'),'overview');
    await desktop.locator('#tour-toggle').click();
    await desktop.locator('#tour-toggle').hover();
    await desktop.mouse.wheel(0,300);
    await desktop.waitForFunction(()=>document.querySelector('#universe').dataset.mode==='overview');
    console.log('Opt-in tour previews all five worlds and stops on command or scroll');

    for(const [width,height] of [[1280,900],[768,1024],[390,844],[375,812]]){
      const page=await checkedPage({viewport:{width,height},reducedMotion:'reduce',hasTouch:width<500});
      await page.goto(url);await page.locator('#sky.is-rendered').waitFor();
      assert.equal(await page.locator('#roommate-sighting .roommate-sighting:visible').count(),3);
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),width+'px overflow');
      if(width>900)assert.ok(await page.locator('.world-links a').evaluateAll(links=>links.every(link=>{
        const box=link.getBoundingClientRect();return box.left>=0&&box.right<=innerWidth;
      })),width+'px labels clipped');
      await capture(page,width+'x'+height);
      if(width<500)await capture(page,width+'x'+height+'-full',{fullPage:true});
      if(width===390){
        await page.emulateMedia({reducedMotion:'no-preference'});
        await checkRoamingBounds(page);
        await page.emulateMedia({reducedMotion:'reduce'});
        for(const [id,name] of [['claude','Claude'],['gpt','GPT'],['deepseek','DeepSeek']]){
          await page.getByRole('button',{name:'和 '+name+' 打招呼'}).tap();
          await checkRoommateReply(page,id);
        }
        assert.match(await page.locator('#roommate-reply').textContent(),/^DeepSeek ·/);
        await capture(page,'mobile-roommate-chat');
      }
      const label=page.locator('.world-links [data-world=observatory]');
      if(width<500)await label.tap();else await label.click();
      await checkFocus(page,'observatory');
      assert.ok(await page.locator('#view-story').evaluate(link=>link.getBoundingClientRect().top<innerHeight),width+'px story action below the viewport');
      await page.locator('#view-story').click();await checkSelection(page,'observatory');
      if(width===390){
        await page.locator('.roommate-card[data-command=deepseek]').tap();
        const reply=page.locator('.terminal-roommate').last();
        assert.ok((await reply.textContent()).includes('DeepSeek'));
        await page.waitForFunction(()=>{
          const box=document.querySelector('.terminal-roommate').getBoundingClientRect();
          return box.top<innerHeight&&box.bottom>0;
        });
        await capture(page,'mobile-console');
        await page.getByRole('button',{name:'鱼生',exact:true}).tap();
        await page.locator('.terminal-chat-title').waitFor();
        assert.match(await page.locator('.terminal-chat-title').textContent(),/^鱼生与人生/);
        await page.locator('.terminal-typing').waitFor({state:'detached',timeout:6000});
        await capture(page,'mobile-roommate-group');
        await page.locator('.world-pager [rel=next]').tap();
        await checkSelection(page,'playground');
        const worldNav=page.locator('.world-directory');
        assert.ok(await worldNav.evaluate(el=>el.scrollWidth>el.clientWidth&&el.scrollLeft>0));
        assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
        await page.getByRole('button',{name:'换颜色'}).tap();
        assert.equal(await page.locator('#sticker-preview').getAttribute('data-color'),'1');
        await capture(page,'mobile-world-playground',{section:'#worlds'});
      }
      await page.locator('.nav-links [href="#connect"]').click();
      assert.equal(new URL(page.url()).hash,'#connect');
      await page.waitForFunction(()=>document.querySelector('.nav-links [aria-current]')?.hash==='#connect');
      if(width<500)assert.ok(await page.locator('.nav-links').evaluate(el=>el.scrollWidth<=el.clientWidth||el.scrollLeft>0));
      await page.close();
    }
    console.log('1280 / 768 / 390 / 375px: layout, labels and touch controls passed');

    const fallback=await checkedPage({reducedMotion:'reduce'});
    await fallback.addInitScript(()=>{const original=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){return type==='webgl2'?null:original.call(this,type,...args)};});
    await fallback.goto(url);
    assert.ok(await fallback.locator('.sky-fallback').isVisible());
    await fallback.locator('.world-links [data-world=ventures]').click();
    await checkFocus(fallback,'ventures');
    await fallback.locator('#view-story').click();await checkSelection(fallback,'ventures');

    const broken=await browser.newPage({reducedMotion:'reduce'});
    await broken.route('**/universe.js',route=>route.abort());
    await broken.goto(url);
    assert.ok(await broken.locator('.sky-fallback').isVisible());
    await broken.locator('.world-links [data-world=playground]').click();
    await checkFocus(broken,'playground');
    await broken.locator('#view-story').click();await checkSelection(broken,'playground');

    const animated=await checkedPage();
    await animated.addInitScript(()=>{
      window.testFrames=0;
      const raf=window.requestAnimationFrame;
      window.requestAnimationFrame=callback=>raf(time=>{window.testFrames++;callback(time);});
    });
    await animated.goto(url);await animated.locator('#sky.is-rendered').waitFor();
    const tracks=animated.locator('.roommate-track');
    await animated.waitForFunction(()=>[...document.querySelectorAll('.roommate-track')].every(track=>{
      const style=getComputedStyle(track);
      return style.animationName==='roommate-roam'&&style.animationPlayState==='running'&&style.transform!=='matrix(1, 0, 0, 1, 0, 0)';
    }));
    assert.deepEqual(await tracks.evaluateAll(nodes=>nodes.map(node=>getComputedStyle(node.querySelector('svg')).animationName)),['roommate-stroll','roommate-hop','roommate-swim']);
    assert.ok(await tracks.evaluateAll(nodes=>nodes.every(node=>getComputedStyle(node.querySelector('button'),'::after').animationName==='roommate-idle')));
    await checkRoamingBounds(animated);
    await animated.getByRole('button',{name:'暂停动效'}).click();
    await animated.waitForFunction(()=>[...document.querySelectorAll('.roommate-track')].every(track=>{
      const [roam]=track.getAnimations();
      return roam?.playState==='paused'&&!roam.pending;
    }));
    assert.ok(await tracks.evaluateAll(nodes=>nodes.every(node=>getComputedStyle(node.querySelector('button'),'::after').animationName==='none')));
    const parked=await tracks.evaluateAll(nodes=>nodes.map(node=>getComputedStyle(node).transform));
    await animated.waitForTimeout(180);
    assert.deepEqual(await tracks.evaluateAll(nodes=>nodes.map(node=>getComputedStyle(node).transform)),parked);
    await animated.getByRole('button',{name:'继续动效'}).click();
    await animated.locator('#home').evaluate(el=>el.scrollIntoView({behavior:'instant'}));
    await capture(animated,'roommates-roaming');
    await animated.locator('.world-links [data-world=origin]').click();
    await checkFocus(animated,'origin');
    assert.ok(await tracks.evaluateAll(nodes=>nodes.every(node=>getComputedStyle(node.querySelector('svg')).animationName==='roommate-idle-body')));
    await animated.waitForTimeout(1000);
    assert.equal(await animated.evaluate(()=>scrollY),0,'camera focus scrolled away from Hero');
    await animated.locator('.world-links [data-world=ventures]').click();
    await checkFocus(animated,'ventures');
    await animated.locator('.world-links [data-world=intelligence]').click();
    await checkFocus(animated,'intelligence');
    await animated.evaluate(()=>window.yubaiUniverse.overview());
    await animated.locator('#connect').evaluate(el=>el.scrollIntoView({behavior:'instant'}));
    await animated.waitForTimeout(300);
    assert.deepEqual(await tracks.evaluateAll(nodes=>nodes.map(node=>getComputedStyle(node).animationPlayState)),['paused','paused','paused']);
    const frames=await animated.evaluate(()=>window.testFrames);
    await animated.waitForTimeout(240);
    assert.equal(await animated.evaluate(()=>window.testFrames),frames,'RAF continued offscreen');
    await animated.locator('.world-directory [data-world=observatory]').click();
    const journal=animated.locator('.journal-photo');
    await journal.evaluate(el=>el.scrollIntoView({behavior:'instant',block:'center'}));
    await animated.waitForFunction(()=>{
      const photo=document.querySelector('.journal-photo');
      const box=photo.getBoundingClientRect();
      return Math.abs(box.top+box.height/2-innerHeight/2)<60&&photo.style.getPropertyValue('--photo-shift');
    });
    const firstShift=await journal.evaluate(el=>Number.parseFloat(el.style.getPropertyValue('--photo-shift')));
    await animated.evaluate(()=>window.scrollBy({top:140,behavior:'instant'}));
    await animated.waitForFunction(before=>Number.parseFloat(document.querySelector('.journal-photo').style.getPropertyValue('--photo-shift'))<before,firstShift);
    const fish=animated.locator('.roommate-card[data-command=deepseek]');
    await fish.hover();
    assert.equal(await fish.locator('svg').evaluate(svg=>getComputedStyle(svg).animationName),'roommate-glide');
    await animated.getByRole('button',{name:'混沌脑洞',exact:true}).click();
    assert.equal(await animated.locator('.terminal-typing span').evaluate(el=>getComputedStyle(el).animationName),'typing-pulse');
    await fish.click();
    assert.equal(await animated.locator('.terminal-typing').count(),0);
    await animated.locator('#home').evaluate(el=>el.scrollIntoView({behavior:'instant'}));
    await animated.getByRole('button',{name:'暂停动效'}).click();
    await animated.getByRole('button',{name:'继续动效'}).click();
    await animated.evaluate(()=>document.querySelector('#star-map').getContext('webgl2').getExtension('WEBGL_lose_context').loseContext());
    await animated.locator('.sky-fallback').waitFor();
    assert.equal(await animated.locator('#motion-toggle').isVisible(),false);
    const noJS=await checkedPage({javaScriptEnabled:false});
    await noJS.goto(url);
    assert.equal(await noJS.locator('#roommate-sighting .roommate-sighting:visible').count(),3);
    await noJS.locator('.world-links [data-world=origin]').click();
    assert.equal(new URL(noJS.url()).hash,'#world-origin');
    assert.ok(await noJS.locator('#world-origin h3').isVisible());
    assert.deepEqual(errors,[]);
    console.log('Offscreen RAF pause, motion controls, lost/disabled WebGL, failed import, and no-JS fallback passed');
  }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;}).finally(()=>server.close());
