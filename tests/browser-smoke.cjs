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
async function capture(page,name,options={}){
  if(!shots)return;
  if(options.fullPage)await page.locator('img[loading=lazy]:visible').evaluateAll(images=>Promise.all(images.map(img=>{
    img.loading='eager';
    return img.decode();
  })));
  await page.screenshot({path:path.join(shots,name+'.png'),...options});
}
const ids=['origin','intelligence','ventures','observatory','playground'];
const sections=['home','worlds','projects','writing','now','about','playground','connect'];
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
    const desktop=await browser.newPage({viewport:{width:1440,height:980},reducedMotion:'reduce'});
    desktop.on('pageerror',e=>errors.push(e.message));
    desktop.on('response',response=>{if(response.url().startsWith(url)&&response.status()>=400)errors.push(response.status()+' '+response.url());});
    await desktop.goto(url);await desktop.locator('#sky.is-rendered').waitFor();
    assert.deepEqual(await desktop.locator('main > [id]').evaluateAll(nodes=>nodes.map(el=>el.id)),sections);
    await capture(desktop,'desktop');
    await capture(desktop,'full',{fullPage:true});
    const canvas=desktop.locator('#star-map'), box=await canvas.boundingBox();
    const position={x:Math.round(box.width*.21),y:Math.round(box.height*.24)};
    await canvas.hover({position});
    await desktop.locator('.world-links [data-world=origin].is-hot').waitFor();
    await canvas.click({position});
    await checkSelection(desktop,'origin');
    await desktop.keyboard.press('Escape');
    assert.equal(new URL(desktop.url()).hash,'#home');
    for(const id of ids){
      await desktop.locator('.world-links [data-world='+id+']').click();
      await checkSelection(desktop,id);
      await desktop.locator('[data-close-world]').click();
      assert.equal(await desktop.locator('#universe').getAttribute('data-mode'),'overview');
    }
    await desktop.goto(url+'#world-intelligence');await checkSelection(desktop,'intelligence');
    await desktop.locator('.world-directory [data-world=ventures]').click();
    await checkSelection(desktop,'ventures');
    await desktop.goBack();await checkSelection(desktop,'intelligence');
    await desktop.goForward();await checkSelection(desktop,'ventures');
    await desktop.locator('#about summary').filter({hasText:'Agent Building'}).click();
    assert.ok(await desktop.locator('#about details[open]').filter({hasText:'Agent Building'}).count());
    await desktop.locator('#writing').evaluate(el=>el.scrollIntoView({behavior:'instant'}));
    await desktop.waitForFunction(()=>document.querySelector('.nav-links [aria-current]')?.hash==='#writing');

    await desktop.locator('.essay-feature summary').click();
    assert.ok(await desktop.locator('.essay-feature details[open]').getByText('审美不是给作品宣布一个高低。',{exact:false}).isVisible());

    const input=desktop.locator('#terminal-input'), output=desktop.locator('#terminal-output');
    async function command(text){await input.fill(text);await input.press('Enter');}
    for(const [cmd,copy] of [['help','可用命令'],['about','AI Engineer'],['now','当前作品'],['projects','Podcast Workspace'],['echo 宇宙坐标','宇宙坐标']]){
      await command(cmd);assert.ok((await output.textContent()).includes(copy));
    }
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
      await desktop.locator('#world-'+id).waitFor();
    }
    await desktop.locator('#tour-toggle').click();
    assert.equal(await desktop.locator('#universe').getAttribute('data-mode'),'overview');
    console.log('Opt-in tour visits all five worlds and stops on command');

    for(const width of [1280,768,390,375]){
      const page=await browser.newPage({viewport:{width,height:844},reducedMotion:'reduce',hasTouch:width<500});
      await page.goto(url);await page.locator('#sky.is-rendered').waitFor();
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),width+'px overflow');
      if(width>900)assert.ok(await page.locator('.world-links a').evaluateAll(links=>links.every(link=>{
        const box=link.getBoundingClientRect();return box.left>=0&&box.right<=innerWidth;
      })),width+'px labels clipped');
      await capture(page,'width-'+width);
      await page.locator('.world-links [data-world=observatory]').click();
      await checkSelection(page,'observatory');
      await page.close();
    }
    console.log('1280 / 768 / 390 / 375px: layout, labels and touch controls passed');

    const fallback=await browser.newPage({reducedMotion:'reduce'});
    await fallback.addInitScript(()=>{const original=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){return type==='webgl2'?null:original.call(this,type,...args)};});
    await fallback.goto(url);
    assert.ok(await fallback.locator('.sky-fallback').isVisible());
    await fallback.locator('.world-links [data-world=ventures]').click();
    await checkSelection(fallback,'ventures');

    const broken=await browser.newPage({reducedMotion:'reduce'});
    await broken.route('**/universe.js',route=>route.abort());
    await broken.goto(url);
    assert.ok(await broken.locator('.sky-fallback').isVisible());
    await broken.locator('.world-links [data-world=playground]').click();
    await checkSelection(broken,'playground');

    const animated=await browser.newPage();
    await animated.addInitScript(()=>{
      window.testFrames=0;
      const raf=window.requestAnimationFrame;
      window.requestAnimationFrame=callback=>raf(time=>{window.testFrames++;callback(time);});
    });
    await animated.goto(url);await animated.locator('#sky.is-rendered').waitFor();
    await animated.locator('.world-links [data-world=origin]').click();
    await animated.locator('#world-origin').waitFor();
    assert.equal(await animated.locator('#universe').getAttribute('data-mode'),'focus');
    await animated.waitForFunction(()=>document.querySelector('#world-origin').getBoundingClientRect().top<innerHeight);
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
    const noJS=await browser.newPage({javaScriptEnabled:false});
    await noJS.goto(url);
    await noJS.locator('.world-links [data-world=origin]').click();
    assert.equal(new URL(noJS.url()).hash,'#world-origin');
    assert.ok(await noJS.locator('#world-origin h3').isVisible());
    console.log('Offscreen RAF pause, motion controls, lost/disabled WebGL, failed import, and no-JS fallback passed');
  }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;}).finally(()=>server.close());
