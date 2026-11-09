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
  await surface.screenshot({path:path.join(shots,name+'.png'),...options});
}
const ids=['origin','intelligence','ventures','observatory','playground'];
const sections=['home','worlds','projects','writing','now','about','playground','connect'];
async function checkFocus(page,id){
  assert.equal(new URL(page.url()).hash,'#focus-'+id);
  assert.equal(await page.locator('#universe').getAttribute('data-mode'),'focus');
  assert.equal(await page.locator('#view-story').getAttribute('href'),'#world-'+id);
  assert.ok(await page.locator('#view-story').isVisible());
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
    assert.deepEqual(await desktop.locator('main > [id]').evaluateAll(nodes=>nodes.map(el=>el.id)),sections);
    await capture(desktop,'1440x980');
    const canvas=desktop.locator('#star-map'), box=await canvas.boundingBox();
    const position={x:Math.round(box.width*.21),y:Math.round(box.height*.24)};
    await canvas.hover({position});
    await desktop.locator('.world-links [data-world=origin].is-hot').waitFor();
    assert.equal(await desktop.locator('#preview-name').textContent(),'Origin');
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
      await label.press('Enter');await checkFocus(desktop,id);
      assert.ok(await desktop.locator('#view-story').evaluate(el=>el===document.activeElement));
      await desktop.locator('#view-story').press('Enter');await checkSelection(desktop,id);
      await desktop.locator('[data-close-world]').click();
      assert.equal(await desktop.locator('#universe').getAttribute('data-mode'),'overview');
    }
    await desktop.locator('#explore-universe').click();await checkFocus(desktop,'origin');
    await desktop.locator('#projects').evaluate(el=>el.scrollIntoView({behavior:'instant'}));
    await checkFocus(desktop,'origin');
    assert.ok(await desktop.locator('#world-playground').isVisible());
    await capture(desktop,'selected-work',{section:'#projects'});
    await capture(desktop,'field-notes',{section:'#writing'});
    await capture(desktop,'about',{section:'#about'});
    await desktop.goto(url+'#focus-intelligence');await checkFocus(desktop,'intelligence');
    await desktop.goto(url+'#world-intelligence');await checkSelection(desktop,'intelligence');
    await desktop.locator('.world-directory [data-world=ventures]').click();
    await checkSelection(desktop,'ventures');
    await desktop.goBack();await checkSelection(desktop,'intelligence');
    await desktop.goForward();await checkSelection(desktop,'ventures');
    await desktop.locator('#about summary').filter({hasText:'Agent Engineering'}).click();
    assert.ok(await desktop.locator('#about details[open]').filter({hasText:'Agent Engineering'}).count());
    await desktop.locator('#writing').evaluate(el=>el.scrollIntoView({behavior:'instant'}));
    await desktop.waitForFunction(()=>document.querySelector('.nav-links [aria-current]')?.hash==='#writing');

    await desktop.locator('.essay-feature summary').click();
    assert.ok(await desktop.locator('.essay-feature details[open]').getByText('审美不是给作品宣布一个高低。',{exact:false}).isVisible());
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
    await command('orbit');assert.equal(await desktop.locator('#universe').getAttribute('data-mode'),'auto');
    await command('universe');assert.equal(await desktop.locator('#universe').getAttribute('data-mode'),'overview');
    await command('neko');assert.ok(await output.locator('.terminal-ascii').count());
    await input.press('ArrowUp');assert.equal(await input.inputValue(),'neko');
    await command('clear');assert.equal(await output.textContent(),'');
    assert.deepEqual(errors,[]);
    console.log('1440px: raycast hover/click, all worlds, keyboard, hash/history, scroll navigation, timeline, console passed');

    await desktop.goto(url);
    await desktop.clock.install();
    await desktop.locator('#tour-toggle').click();
    for(const [i,id] of ids.entries()){
      if(i)await desktop.clock.fastForward(4600);
      assert.equal(await desktop.locator('#view-story').getAttribute('href'),'#world-'+id);
      assert.equal(await desktop.locator('#preview-index').textContent(),'0'+(i+1)+' / 05');
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
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),width+'px overflow');
      if(width>900)assert.ok(await page.locator('.world-links a').evaluateAll(links=>links.every(link=>{
        const box=link.getBoundingClientRect();return box.left>=0&&box.right<=innerWidth;
      })),width+'px labels clipped');
      await capture(page,width+'x'+height);
      if(width<500)await capture(page,width+'x'+height+'-full',{fullPage:true});
      const label=page.locator('.world-links [data-world=observatory]');
      if(width<500)await label.tap();else await label.click();
      await checkFocus(page,'observatory');
      assert.ok(await page.locator('#view-story').evaluate(link=>link.getBoundingClientRect().top<innerHeight),width+'px story action below the viewport');
      await page.locator('#view-story').click();await checkSelection(page,'observatory');
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
    await animated.locator('.world-links [data-world=origin]').click();
    await checkFocus(animated,'origin');
    await animated.waitForTimeout(1000);
    assert.equal(await animated.evaluate(()=>scrollY),0,'camera focus scrolled away from Hero');
    await animated.locator('.world-links [data-world=ventures]').click();
    await checkFocus(animated,'ventures');
    await animated.locator('.world-links [data-world=intelligence]').click();
    await checkFocus(animated,'intelligence');
    await animated.locator('#connect').evaluate(el=>el.scrollIntoView({behavior:'instant'}));
    await animated.waitForTimeout(300);
    const frames=await animated.evaluate(()=>window.testFrames);
    await animated.waitForTimeout(240);
    assert.equal(await animated.evaluate(()=>window.testFrames),frames,'RAF continued offscreen');
    await animated.locator('#home').evaluate(el=>el.scrollIntoView({behavior:'instant'}));
    await animated.getByRole('button',{name:'暂停动效'}).click();
    await animated.getByRole('button',{name:'继续动效'}).click();
    await animated.evaluate(()=>document.querySelector('#star-map').getContext('webgl2').getExtension('WEBGL_lose_context').loseContext());
    await animated.locator('.sky-fallback').waitFor();
    assert.equal(await animated.locator('#motion-toggle').isVisible(),false);
    const noJS=await checkedPage({javaScriptEnabled:false});
    await noJS.goto(url);
    await noJS.locator('.world-links [data-world=origin]').click();
    assert.equal(new URL(noJS.url()).hash,'#world-origin');
    assert.ok(await noJS.locator('#world-origin h3').isVisible());
    assert.deepEqual(errors,[]);
    console.log('Offscreen RAF pause, motion controls, lost/disabled WebGL, failed import, and no-JS fallback passed');
  }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;}).finally(()=>server.close());
