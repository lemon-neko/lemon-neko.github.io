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
    light.position.set(x,y,z);light.scale.setScalar(size);group.add(light);return light;
  }};
}

function makeCore(scene, glow) {
  const core=new T.Group();scene.add(core);
  const halo=glow.sprite(core,0,.07,-.9,3.9,0x7495ff,.65);
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
  return {core,feather,halo};
}

export function cameraEase(t){
  const progress=T.MathUtils.clamp(t,0,1);
  return progress*progress*(3-2*progress);
}

export function fitWorldZoom(viewWidth,viewHeight,modelWidth,modelHeight){
  return Math.min(viewHeight*.45/modelHeight,viewWidth*.76/modelWidth);
}

export function startUniverse(canvas,{onPick,onLabels,onHover,onFallback,reduced,paused}) {
  const sky=canvas.parentElement;
  const context=canvas.getContext('webgl2',{alpha:true,antialias:true,powerPreference:'low-power'});
  if(!context)return null;
  const renderer=new T.WebGLRenderer({canvas,context});
  renderer.setClearColor(0,0);renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.18;
  const scene=new T.Scene(), camera=new T.OrthographicCamera(-6,6,4,-4,.1,80), glow=makeGlow();
  addLights(scene);
  const {core,feather,halo}=makeCore(scene,glow);
  const system=new T.Group();scene.add(system);
  ellipse(system,5.69,3.65,-.18,.24,0x8c9cd9,.28);
  ellipse(system,5.53,3.41,-.34,.24,0x645aa6,.25);
  ellipse(system,4.95,2.75,.12,-.26,0x8079ca,.22);
  const hits=[], models=[], routes=[], glows=[], palettes=[], origins=[], bounds=[], beacons=[];
  camera.position.set(0,8,18);camera.lookAt(0,0,0);camera.updateMatrixWorld();
  const viewRotation=new T.Matrix4().makeRotationFromQuaternion(camera.quaternion.clone().invert());
  const center=new T.Vector3(), corner=new T.Vector3();
  const modelView=new T.Matrix4(), instance=new T.Matrix4(), transform=new T.Matrix4();
  const viewBox=new T.Box3();
  function expandBounds(box,matrix){
    for(const x of [box.min.x,box.max.x])for(const y of [box.min.y,box.max.y])for(const z of [box.min.z,box.max.z]){
      viewBox.expandByPoint(corner.set(x,y,z).applyMatrix4(matrix));
    }
  }
  function frameModel(model){
    // Measure each mesh in camera space so the model-wide box does not overstate the silhouette.
    model.updateMatrixWorld(true);
    viewBox.makeEmpty();
    model.traverse(item=>{
      if(!item.geometry)return;
      if(!item.geometry.boundingBox)item.geometry.computeBoundingBox();
      const box=item.geometry.boundingBox;
      modelView.multiplyMatrices(viewRotation,item.matrixWorld);
      if(!item.isInstancedMesh){expandBounds(box,modelView);return;}
      for(let i=0;i<item.count;i++){
        item.getMatrixAt(i,instance);
        expandBounds(box,transform.multiplyMatrices(modelView,instance));
      }
    });
    const size=viewBox.getSize(new T.Vector3());
    viewBox.getCenter(center).applyQuaternion(camera.quaternion);
    return {center:center.clone(),width:size.x*1.1,height:size.y*1.07};
  }
  worlds.forEach(([id,position,color],i)=>{
    const model=makeWorld(i);model.position.fromArray(position);model.rotation.y=(i-2)*.12;system.add(model);models.push(model);
    bounds.push(frameModel(model));
    const hit=new T.Mesh(new T.SphereGeometry(1.22,8,6),new T.MeshBasicMaterial());hit.position.y=.17;
    hit.visible=false;hit.userData.id=id;model.add(hit);hits.push(hit);
    const target=new T.Vector3(...position);
    const curve=new T.CatmullRomCurve3([new T.Vector3(0,-.16,0),target.clone().multiplyScalar(.45).add(new T.Vector3(0,.34,.62)),target]);
    const route=new T.Line(new T.BufferGeometry().setFromPoints(curve.getPoints(39)),new T.LineBasicMaterial({color,transparent:true,opacity:.22}));
    system.add(route);routes.push(route);
    beacons.push({curve,light:glow.sprite(system,0,0,0,.28,color,.48)});
    glows.push(glow.sprite(model,0,-.1,.1,2.45,color,.23));
    origins.push(model.position.clone());
    const owned=new Map();
    model.traverse(item=>{
      if(!item.material?.isMeshStandardMaterial)return;
      if(!owned.has(item.material)){
        const material=item.material.clone();
        owned.set(item.material,{material,color:material.color.clone(),emissive:material.emissive.clone()});
      }
      item.material=owned.get(item.material).material;
    });
    palettes.push([...owned.values()]);
  });
  const seed=Array.from({length:500},(_,i)=>{
    const x=Math.sin(i*127.1+11)*43758.5453;return x-Math.floor(x);
  });
  const stars=[];
  for(let i=0;i<155;i++)stars.push((seed[i]-.5)*15,(seed[i+156]-.5)*11,-5+seed[i+310]*4);
  const starsAt=(points, color, size, opacity)=>{
    const geometry=new T.BufferGeometry().setAttribute('position',new T.Float32BufferAttribute(points,3));
    const layer=new T.Points(geometry,new T.PointsMaterial({color,size,sizeAttenuation:false,transparent:true,opacity,depthWrite:false}));
    scene.add(layer);return layer;
  };
  const farStars=starsAt(stars.slice(0,330),0xaab9ee,1.15,.38);
  const nearStars=starsAt(stars.slice(330),0xd3d9ff,1.7,.56);
  const controller=new AbortController(), eventOptions={signal:controller.signal};
  const pointer=new T.Vector2(), drift=new T.Vector2(), ray=new T.Raycaster(), view=new T.Vector3();
  const focal=new T.Vector3(), from=new T.Vector3(), target=new T.Vector3(), label=new T.Vector3();
  const fine=matchMedia('(pointer:fine)'), small=matchMedia('(max-width:900px)');
  let selected='', selectedIndex=-1, hover='', frame=0, visible=true, destroyed=false, last=0, zoom=1, motionTime=0, width=1,height=1;
  let elapsed=.86, fromZoom=1, targetZoom=1, pulseUntil=0, labelTime=1;
  const lastLabels=new Map(), dim=worlds.map(()=>1), baseHeight=4.12;
  function canAnimate(){return !paused() && !reduced();}
  function setHover(id){
    if(id!==hover){hover=id;onHover?.(id);schedule();}
  }
  function select(id){
    if(id===selected)return;
    selected=id;
    from.copy(focal);fromZoom=zoom;elapsed=0;
    selectedIndex=worlds.findIndex(item=>item[0]===id);
    const bound=bounds[selectedIndex];
    if(bound)target.copy(bound.center);else target.set(0,0,0);
    fitSelection();
    schedule();
  }
  function fitSelection(){
    const bound=bounds[selectedIndex];
    targetZoom=bound?fitWorldZoom(camera.right-camera.left,camera.top-camera.bottom,bound.width,bound.height):1;
  }
  function applyCamera(dt,elapsedTime=dt){
    const moving=canAnimate();
    if(moving)motionTime+=dt;
    elapsed=moving?Math.min(.86,elapsed+elapsedTime):.86;
    const amount=cameraEase(elapsed/.86), smooth=moving?1-Math.exp(-dt*8):1;
    focal.lerpVectors(from,target,amount);
    zoom=T.MathUtils.lerp(fromZoom,targetZoom,amount);
    if(moving&&fine.matches&&!small.matches)drift.lerp(selected?view.set(0,0,0):pointer,smooth);else drift.set(0,0);
    camera.position.set(focal.x+drift.x*.48,focal.y+8+drift.y*.31,focal.z+18);
    camera.lookAt(focal);
    camera.zoom=zoom;camera.updateProjectionMatrix();
    farStars.position.set(drift.x*.06,drift.y*.04,0);
    nearStars.position.set(drift.x*.24,drift.y*.17,0);
    nearStars.material.opacity=.51+.055*Math.sin(motionTime*.63);
    models.forEach((model,i)=>{
      const id=worlds[i][0], hot=id===(hover||selected), other=(hover||selected)&&!hot;
      model.position.y=origins[i].y+.075*Math.sin(motionTime*(.66+i*.10)+i*.67);
      model.scale.lerp(view.setScalar(id===selected?1.07:hot?1.055:1),smooth);
      model.rotation.y=(i-2)*.12+.16*Math.sin(motionTime*(.24+i*.035)+i);
      routes[i].material.opacity=T.MathUtils.lerp(routes[i].material.opacity,hot?.82:other?.13:.22,smooth);
      glows[i].material.opacity=(hot?.51:.22)+.03*Math.sin(motionTime*.72+i);
      const {curve,light}=beacons[i], phase=(.22+i*.143+motionTime*(.041+i*.006))%1;
      curve.getPoint(phase,light.position);
      light.material.opacity=Math.sin(phase*Math.PI)*(hot?.73:.46);
      const factor=T.MathUtils.lerp(dim[i],other?.70:1,smooth);
      if(Math.abs(factor-dim[i])>.001){
        palettes[i].forEach(({material,color,emissive})=>{
          material.color.copy(color).multiplyScalar(factor);
          material.emissive.copy(emissive).multiplyScalar(factor);
        });
        dim[i]=factor;
      }
    });
    core.rotation.y=.11*Math.sin(motionTime*.38);
    feather.rotation.z=.05+.07*Math.sin(motionTime*.58);
    halo.material.opacity=.63+.08*Math.sin(motionTime*.63)+(pulseUntil>performance.now()?.29:0);
    renderer.render(scene,camera);
    labelTime+=dt;
    if(selected||small.matches||labelTime<.033)return;
    labelTime=0;
    const changes=[];
    worlds.forEach(([id,p,,,[dx,dy]],i)=>{
      label.set(p[0]+dx,models[i].position.y+dy,p[2]).project(camera);
      const x=Math.round(T.MathUtils.clamp((label.x+1)/2*width,44,width-44));
      const y=Math.round(T.MathUtils.clamp((1-label.y)/2*height,24,height-34));
      const previous=lastLabels.get(id);
      if(previous?.[0]===x&&previous?.[1]===y)return;
      lastLabels.set(id,[x,y]);changes.push([id,x,y]);
    });
    if(changes.length)onLabels(changes);
  }
  function render(time){
    frame=0;
    if(destroyed||document.hidden||!visible)return;
    const dt=last?(time-last)/1000:.016;last=time;
    applyCamera(Math.min(dt,.052),dt);
    if(canAnimate())schedule();
  }
  function schedule(){if(!destroyed&&!frame&&!document.hidden&&visible)frame=requestAnimationFrame(render);}
  function resize(){
    width=Math.max(sky.clientWidth,1);height=Math.max(sky.clientHeight,1);
    const h=Math.max(baseHeight,6.12*height/width);
    lastLabels.clear();labelTime=1;
    camera.left=-h*width/height;camera.right=-camera.left;camera.top=h;camera.bottom=-h;
    fitSelection();
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
    setHover(pick(event));canvas.style.cursor=hover?'pointer':'default';schedule();
  },eventOptions);
  canvas.addEventListener('pointerleave',()=>{pointer.set(0,0);setHover('');schedule();},eventOptions);
  canvas.addEventListener('click',event=>{const id=pick(event);if(id)onPick(id);},eventOptions);
  canvas.addEventListener('webglcontextlost',event=>{event.preventDefault();sky.classList.remove('is-rendered');destroy();onFallback?.();},eventOptions);
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
  return {select,hover:setHover,refresh:schedule,pulse(){pulseUntil=performance.now()+700;schedule();}};
}
