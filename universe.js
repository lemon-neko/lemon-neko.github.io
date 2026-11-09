import * as T from './public/vendor/three.module.min.js';
import {worlds,makeWorld,addLights,disposeScene} from './universe-models.js';

function ellipse(scene, a,b, y, tilt, color, opacity) {
  const points=new T.EllipseCurve(0,0,a,b).getPoints(120).map(p=>new T.Vector3(p.x,y+p.x*tilt,p.y));
  const orbit=new T.Line(new T.BufferGeometry().setFromPoints(points),new T.LineBasicMaterial({color,transparent:true,opacity}));
  scene.add(orbit);
  return orbit;
}

function makeGlow() {
  const art=document.createElement('canvas');art.width=art.height=64;
  const ctx=art.getContext('2d'), gradient=ctx.createRadialGradient(32,32,0,32,32,32);
  gradient.addColorStop(0,'rgba(255,255,255,1)');gradient.addColorStop(.17,'rgba(210,223,255,.55)');
  gradient.addColorStop(.48,'rgba(151,172,255,.12)');gradient.addColorStop(1,'rgba(108,132,255,0)');
  ctx.fillStyle=gradient;ctx.fillRect(0,0,64,64);
  const texture=new T.CanvasTexture(art);
  return {texture, sprite(group,x,y,z,size,color,opacity){
    const light=new T.Sprite(new T.SpriteMaterial({map:texture,color,transparent:true,opacity,blending:T.AdditiveBlending,depthWrite:false}));
    light.position.set(x,y,z);light.scale.setScalar(size);group.add(light);
  }};
}

function makeCore(scene, glow) {
  const core=new T.Group();scene.add(core);
  glow.sprite(core,0,.07,-.9,3.9,0x7495ff,.65);
  const bubble=new T.Mesh(new T.SphereGeometry(1.09,48,32),new T.ShaderMaterial({
    transparent:true,depthWrite:false,
    vertexShader:'varying vec3 vN; varying vec3 vP; void main(){vec4 p=modelViewMatrix*vec4(position,1.);vP=p.xyz;vN=normalize(normalMatrix*normal);gl_Position=projectionMatrix*p;}',
    fragmentShader:`varying vec3 vN; varying vec3 vP;
      void main(){vec3 n=normalize(vN);float rim=pow(1.-max(0.,dot(n,normalize(-vP))),2.8);
      float streak=pow(max(0.,dot(n,normalize(vec3(-.65,.63,.32)))),19.);
      vec3 tint=mix(vec3(.27,.39,.79),vec3(.80,.85,1.),rim);
      gl_FragColor=vec4(tint+streak*.45,.055+rim*.62+streak*.27);}`
  }));
  bubble.renderOrder=5;core.add(bubble);
  const feather=new T.Group();feather.rotation.set(.39,-.17,-.32);feather.position.set(.05,.02,.16);core.add(feather);
  const shape=new T.Shape();
  shape.moveTo(-.26,-.69);
  shape.bezierCurveTo(-.29,-.51,-.49,-.34,-.36,-.1);
  shape.quadraticCurveTo(-.29,-.21,-.24,-.23);
  shape.bezierCurveTo(-.36,.05,-.25,.34,-.07,.48);
  shape.quadraticCurveTo(-.11,.34,-.07,.28);
  shape.bezierCurveTo(-.02,.48,.2,.7,.43,.79);
  shape.bezierCurveTo(.51,.59,.48,.42,.32,.28);
  shape.quadraticCurveTo(.42,.31,.47,.38);
  shape.bezierCurveTo(.42,.12,.29,.02,.12,-.08);
  shape.quadraticCurveTo(.26,-.04,.34,.026);
  shape.bezierCurveTo(.29,-.2,.10,-.29,-.06,-.35);
  shape.quadraticCurveTo(.1,-.33,.18,-.29);
  shape.bezierCurveTo(.08,-.48,-.13,-.5,-.26,-.69);
  const body=new T.Mesh(new T.ExtrudeGeometry(shape,{depth:.027,bevelEnabled:true,bevelSize:.018,bevelThickness:.016,bevelSegments:2,curveSegments:16}),new T.MeshStandardMaterial({color:0xf4f3ff,metalness:.25,roughness:.32,emissive:0xaba5e6,emissiveIntensity:.48}));
  feather.add(body);
  const trace=(points, r, color)=>{
    const curve=new T.CatmullRomCurve3(points.map(([x,y])=>new T.Vector3(x,y,.053)));
    const mesh=new T.Mesh(new T.TubeGeometry(curve,20,r,6,false),new T.MeshBasicMaterial({color}));
    feather.add(mesh);
  };
  trace([[-.38,-.79],[-.21,-.56],[-.02,-.16],[.16,.22],[.39,.73]],.014,0xfdf9ff);
  for(let j=0;j<7;j++){
    const y=-.45+j*.143,x=-.15+j*.07;
    trace([[x,y],[x+.11,y+.077],[x+.22-j*.011,y+.207]],.0065,0xc0c4e5);
    trace([[x,y],[x-.095,y+.12],[x-.124,y+.258]],.0065,0xc0c4e5);
  }
  ellipse(core,1.89,.8,-.26,.075,0xc5caff,.78);
  ellipse(core,1.95,.83,-.284,.075,0x777de3,.48);
  ellipse(core,1.78,.74,-.20,.075,0xf0c7ff,.51);
  for(const [x,y,z,size] of [[-.77,.73,.44,.51],[.56,1.03,.02,.47],[1.28,-.06,.64,.36],[-1.66,-.35,.21,.37],[.05,-.38,1,.53]]) glow.sprite(core,x,y,z,size,0xb0bfff,.92);
  return feather;
}

export function startUniverse(canvas,{onPick,onLabels,reduced,paused}) {
  const sky=canvas.parentElement;
  const context=canvas.getContext('webgl2',{alpha:true,antialias:true,powerPreference:'low-power'});
  if(!context)return null;
  const renderer=new T.WebGLRenderer({canvas,context});
  renderer.setClearColor(0,0);renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.18;
  const scene=new T.Scene(), camera=new T.OrthographicCamera(-6,6,4,-4,.1,80), glow=makeGlow();
  addLights(scene);
  const feather=makeCore(scene,glow);
  const system=new T.Group();scene.add(system);
  ellipse(system,5.69,3.65,-.18,.24,0x8c9cd9,.28);
  ellipse(system,5.53,3.41,-.34,.24,0x645aa6,.25);
  ellipse(system,4.95,2.75,.12,-.26,0x8079ca,.22);
  const hits=[], models=[], routes=[];
  worlds.forEach(([id,position,color],i)=>{
    const model=makeWorld(i);model.position.fromArray(position);model.rotation.y=(i-2)*.12;system.add(model);models.push(model);
    const hit=new T.Mesh(new T.SphereGeometry(1.22,8,6),new T.MeshBasicMaterial());hit.position.y=.17;
    hit.visible=false;hit.userData.id=id;model.add(hit);hits.push(hit);
    const target=new T.Vector3(...position);
    const curve=new T.CatmullRomCurve3([new T.Vector3(0,-.16,0),target.clone().multiplyScalar(.45).add(new T.Vector3(0,.34,.62)),target]);
    const route=new T.Line(new T.BufferGeometry().setFromPoints(curve.getPoints(39)),new T.LineBasicMaterial({color,transparent:true,opacity:.22}));
    system.add(route);routes.push(route);
    for(const j of [.33,.63,.88]){
      const p=curve.getPoint(j);glow.sprite(system,p.x,p.y,p.z,.22,color,.6);
    }
    glow.sprite(model,0,-.1,.1,2.45,color,.23);
  });
  const seed=Array.from({length:500},(_,i)=>{
    const x=Math.sin(i*127.1+11)*43758.5453;return x-Math.floor(x);
  });
  const stars=[];
  for(let i=0;i<155;i++)stars.push((seed[i]-.5)*15,(seed[i+156]-.5)*11,-5+seed[i+310]*4);
  const starGeometry=new T.BufferGeometry();starGeometry.setAttribute('position',new T.Float32BufferAttribute(stars,3));
  scene.add(new T.Points(starGeometry,new T.PointsMaterial({color:0xb7c8ff,size:1.3,sizeAttenuation:false,transparent:true,opacity:.48,depthWrite:false})));
  const controller=new AbortController(), eventOptions={signal:controller.signal};
  const pointer=new T.Vector2(), ray=new T.Raycaster(), view=new T.Vector3(), focal=new T.Vector3(), orbitTarget=new T.Vector3(), label=new T.Vector3();
  let selected='', hover='', orbit=false, frame=0, visible=true, destroyed=false, last=0, zoom=1, motionTime=0, width=1,height=1;
  const baseHeight=4.12;
  function canAnimate(){return !paused() && !reduced();}
  function applyCamera(dt){
    const active=worlds.findIndex(world=>world[0]===selected);
    orbitTarget.set(0,0,0);
    if(active>=0)orbitTarget.fromArray(worlds[active][1]).multiplyScalar(.13);
    const lerp=canAnimate()?1-Math.exp(-dt*5):1;
    focal.lerp(orbitTarget,lerp);
    zoom=T.MathUtils.lerp(zoom,active>=0?1.10:orbit?1.075:1,lerp);
    const parallax=canAnimate() && matchMedia('(pointer:fine)').matches;
    camera.position.set(focal.x+(parallax?pointer.x*.49:0),focal.y+8+(parallax?pointer.y*.33:0),focal.z+18);
    camera.lookAt(focal);
    camera.zoom=zoom;camera.updateProjectionMatrix();
    models.forEach((model,i)=>{
      const hot=worlds[i][0]===hover||worlds[i][0]===selected;
      model.scale.lerp(view.setScalar(hot?1.10:1),lerp);
      model.rotation.y=(i-2)*.12+(canAnimate()?.15*Math.sin(motionTime*.27+i):0);
      routes[i].material.opacity=hot?.87:orbit?.49:.22;
    });
    feather.rotation.z=.05+(canAnimate()?.065*Math.sin(motionTime*.58):0);
    renderer.render(scene,camera);
    onLabels(worlds.map(([id,p,,,[dx,dy]])=>{
      label.set(p[0]+dx,p[1]+dy,p[2]).project(camera);
      return [id, T.MathUtils.clamp((label.x+1)/2*100,7,93), T.MathUtils.clamp((1-label.y)/2*100,6,91)];
    }));
  }
  function render(time){
    frame=0;
    if(destroyed||document.hidden||!visible)return;
    const dt=last?Math.min((time-last)/1000,.052):.016;last=time;motionTime+=dt;
    applyCamera(dt);
    if(canAnimate())schedule();
  }
  function schedule(){if(!destroyed&&!frame&&!document.hidden&&visible)frame=requestAnimationFrame(render);}
  function resize(){
    width=Math.max(sky.clientWidth,1);height=Math.max(sky.clientHeight,1);
    const h=Math.max(baseHeight,5.98*height/width);
    camera.left=-h*width/height;camera.right=-camera.left;camera.top=h;camera.bottom=-h;
    renderer.setPixelRatio(Math.min(devicePixelRatio,width<610?1.35:1.65));renderer.setSize(width,height,false);
    schedule();
  }
  function pick(event){
    const rect=canvas.getBoundingClientRect();
    pointer.set((event.clientX-rect.left)/rect.width*2-1,-(event.clientY-rect.top)/rect.height*2+1);
    ray.setFromCamera(pointer,camera);
    return ray.intersectObjects(hits,false)[0]?.object.userData.id||'';
  }
  canvas.addEventListener('pointermove',event=>{
    if(event.pointerType!=='mouse')return;
    hover=pick(event);canvas.style.cursor=hover?'pointer':'default';schedule();
  },eventOptions);
  canvas.addEventListener('pointerleave',()=>{pointer.set(0,0);hover='';schedule();},eventOptions);
  canvas.addEventListener('click',event=>{const id=pick(event);if(id)onPick(id);},eventOptions);
  canvas.addEventListener('webglcontextlost',event=>{event.preventDefault();sky.classList.remove('is-rendered');document.querySelector('#motion-toggle').hidden=true;destroy();},eventOptions);
  const resizeObserver=new ResizeObserver(resize);resizeObserver.observe(sky);
  const intersection=new IntersectionObserver(entries=>{
    visible=entries[0].isIntersecting;last=0;
    if(visible)schedule();else if(frame){cancelAnimationFrame(frame);frame=0;}
  });intersection.observe(sky);
  document.addEventListener('visibilitychange',()=>{last=0;if(document.hidden&&frame){cancelAnimationFrame(frame);frame=0;}else schedule();},eventOptions);
  function destroy(){
    if(destroyed)return;
    destroyed=true;controller.abort();cancelAnimationFrame(frame);resizeObserver.disconnect();intersection.disconnect();
    disposeScene(scene);glow.texture.dispose();renderer.dispose();
  }
  window.addEventListener('pagehide',event=>{if(!event.persisted)destroy();},eventOptions);
  resize();applyCamera(.016);sky.classList.add('is-rendered');
  return {select(id){selected=id;orbit=false;schedule();},orbit(){selected='';orbit=true;schedule();},hover(id){hover=id;schedule();},refresh:schedule};
}
