import * as T from './public/vendor/three.module.min.js';

const boxGeo = new T.BoxGeometry();
const orbGeo = new T.SphereGeometry(1, 24, 16);
const cylGeo = new T.CylinderGeometry(1, 1, 1, 32);
const rockGeo = new T.IcosahedronGeometry(1, 0);
const cubeGeo = new T.BoxGeometry(1, 1, 1);
const materials = new Map();
export const worlds = [
  ['origin', [-3.65,1.53,-1.24], 0x81baff, 0x34445e, [-.89,1.78]],
  ['intelligence', [2.43,2.05,-1.18], 0xa190ff, 0x4b4071, [1.62,.83]],
  ['ventures', [4.16,.09,.85], 0xffbf78, 0x625149, [1.14,1.14]],
  ['observatory', [1.67,-2.14,1.4], 0xf0a2c3, 0x554664, [2.05,.16]],
  ['playground', [-3.34,-1.91,.78], 0xa9a3ff, 0x3e446b, [-.83,-1.41]]
];

function random(seed) {
  return () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
}

function mat(color, glow = false) {
  const key = color + ':' + glow;
  if (!materials.has(key)) materials.set(key, new T.MeshStandardMaterial({
    color, roughness: glow ? .38 : .72, metalness: glow ? .12 : .29,
    emissive: glow ? color : 0, emissiveIntensity: glow ? .66 : 0, flatShading: !glow
  }));
  return materials.get(key);
}

function mesh(group, geometry, material, x, y, z, sx=1, sy=sx, sz=sx) {
  const object = new T.Mesh(geometry, material);
  object.position.set(x,y,z);
  object.scale.set(sx,sy,sz);
  group.add(object);
  return object;
}
function box(g, c, x,y,z,w,h,d, light=false) { return mesh(g,boxGeo,mat(c,light),x,y,z,w,h,d); }
function cylinder(g, c, x,y,z,r,h,light=false) { return mesh(g,cylGeo,mat(c,light),x,y,z,r,h,r); }
function ring(g, radius, tube, color, y, glow=true) {
  const object=mesh(g,new T.TorusGeometry(radius,tube,6,56),mat(color,glow),0,y,0);
  object.rotation.x=Math.PI/2;
  return object;
}
function line(g, points, color, opacity=.7) {
  const object=new T.Line(new T.BufferGeometry().setFromPoints(points),
    new T.LineBasicMaterial({color,transparent:opacity<1,opacity}));
  g.add(object);
  return object;
}

function foundation(g, ground, color, rng) {
  const n=23, points=[], rgb=[], vertices=[], layers=[[1.06,-.02],[1.16,-.18],[.91,-.45],[.65,-.69],[.22,-.98]];
  for (const [r,y] of layers) for (let i=0;i<n;i++) {
    const a=i/n*2*Math.PI, size=r*(.85+rng()*.27);
    vertices.push([size*Math.cos(a),y+(rng()-.5)*.1,size*Math.sin(a)]);
  }
  for (let row=0;row<layers.length-1;row++) for (let i=0;i<n;i++) {
    const a=row*n+i,b=row*n+(i+1)%n,c=a+n,d=b+n;
    for (const face of [[a,b,c],[b,d,c]]) {
      const tint=new T.Color(ground).multiplyScalar(.56+rng()*.57);
      face.forEach(j=>{points.push(...vertices[j]);rgb.push(tint.r,tint.g,tint.b);});
    }
  }
  const geo=new T.BufferGeometry();
  geo.setAttribute('position',new T.Float32BufferAttribute(points,3));
  geo.setAttribute('color',new T.Float32BufferAttribute(rgb,3));
  geo.computeVertexNormals();
  mesh(g,geo,new T.MeshStandardMaterial({vertexColors:true,roughness:.94,flatShading:true,side:T.DoubleSide}),0,0,0);
  for(let i=0;i<18;i++){
    const a=rng()*Math.PI*2,r=.65+rng()*.36;
    const rock=mesh(g,rockGeo,mat(ground),Math.cos(a)*r,-.35-rng()*.17,Math.sin(a)*r,.08+rng()*.13,.13+rng()*.22,.1+rng()*.16);
    rock.rotation.set(rng(),rng(),rng());
  }
  cylinder(g,0x202c43,0,-.02,0,1.10,.21);
  cylinder(g,ground,0,.11,0,1.06,.085);
  ring(g,1.075,.019,color,-.032);
  ring(g,.94,.009,color,.159);
  for(let i=0;i<20;i++){
    const a=i*Math.PI/10;
    const step=box(g,i%4===0?color:0x47536e,1.02*Math.cos(a),.152,1.02*Math.sin(a),.12,.045,.15,i%4===0);
    step.rotation.y=-a;
  }
}

function tower(g, x,z,w,h,d, surface, color, rows) {
  box(g,surface,x,.15+h/2,z,w,h,d);
  box(g,0x8190a8,x,.17+h,z,w*1.06,.035,d*1.06);
  for(let row=0;row<rows;row++){
    const y=.22+(row+.42)/rows*(h-.09);
    box(g,color,x,y,z+d/2+.008,w*.71,.025,.011,true);
    box(g,color,x+w/2+.007,y,z,.009,.025,d*.63,true);
  }
  for(const sign of [-1,1]) box(g,0x65728e,x+sign*w*.37,.16+h/2,z+d/2+.013,.022,h*.95,.026);
}

function crystal(g, x,y,z,size,color) {
  const gem=new T.OctahedronGeometry(size,0);
  const body=mesh(g,gem,new T.MeshPhysicalMaterial({color,metalness:.18,roughness:.23,transparent:true,opacity:.68,depthWrite:false,side:T.DoubleSide,emissive:color,emissiveIntensity:.2}),x,y,z);
  body.rotation.y=.35;
  body.add(new T.LineSegments(new T.EdgesGeometry(gem),new T.LineBasicMaterial({color:0xd8e1ff})));
  return body;
}

function batch(g) {
  const buckets=new Map();
  for(const item of [...g.children]){
    if(!item.isMesh || item.children.length || item.material.transparent) continue;
    const key=item.geometry.id+':'+item.material.id;
    if(!buckets.has(key)) buckets.set(key,[]);
    buckets.get(key).push(item);
  }
  for(const items of buckets.values()){
    if(items.length<3) continue;
    const result=new T.InstancedMesh(items[0].geometry,items[0].material,items.length);
    items.forEach((item,i)=>{item.updateMatrix();result.setMatrixAt(i,item.matrix);g.remove(item);});
    g.add(result);
  }
}

export function makeWorld(index) {
  const [id,,color,ground]=worlds[index], g=new T.Group(), rng=random(33+index*28);
  foundation(g,ground,color,rng);
  if(id==='origin'){
    tower(g,-.21,-.12,.58,1.03,.44,0x43577b,0x8cd8ff,8);
    tower(g,.41,.12,.34,.72,.32,0x344966,0x82c6ff,6);
    tower(g,-.66,.32,.23,.52,.25,0x586982,0x8ce7ff,5);
    tower(g,.56,-.43,.24,.54,.3,0x475e79,0x84b6fc,6);
    for(let i=0;i<4;i++) box(g,0x60bfff,-.3+i*.19,.17,.62,.1,.025,.26,true);
    cylinder(g,0x758caf,-.32,1.36,-.2,.018,.37);
    mesh(g,orbGeo,mat(color,true),-.32,1.55,-.2,.026);
  }else if(id==='intelligence'){
    tower(g,-.58,-.23,.29,.49,.28,0x45436e,color,5);
    tower(g,.58,-.07,.3,.59,.31,0x595480,color,5);
    tower(g,.33,.55,.25,.34,.25,0x4e537c,0x85c9ff,3);
    cylinder(g,0x6876a8,0,.22,0,.4,.15);
    ring(g,.45,.016,0x92c6ff,.32);
    crystal(g,0,.86,0,.51,color);
    crystal(g,0,.86,0,.22,0x83d8ff);
    for(let i=0;i<5;i++){
      const a=i*Math.PI*2/5;
      cylinder(g,0x9ba2cc,.74*Math.cos(a),.27,.74*Math.sin(a),.049,.24);
    }
  }else if(id==='ventures'){
    const buildings=[[-.59,-.15,.48],[.61,-.13,.6],[-.42,.48,.37],[.37,.5,.43],[.43,-.51,.73],[-.26,-.58,.66],[-.69,.2,.31],[.67,.24,.28]];
    buildings.forEach(([x,z,h],i)=>tower(g,x,z,.16+(i%2)*.08,h,.18,i%2?0x756477:0x86746a,0xffc285,Math.floor(h*10)));
    tower(g,0,-.05,.31,1.23,.31,0xa58c77,0xffd89d,11);
    const spire=mesh(g,new T.ConeGeometry(.22,.39,4),mat(0xc29e81),0,1.57,-.05);
    spire.rotation.y=Math.PI/4;
    box(g,0xffd7a0,0,1.16,.115,.078,.29,.018,true);
    ring(g,1.19,.013,0xf6ae6e,.04);
    ring(g,1.22,.006,0xffddb8,.047);
  }else if(id==='observatory'){
    tower(g,.05,-.05,.76,.43,.66,0x6c5061,0xffbf82,3);
    cylinder(g,0x8691b6,.05,.6,-.08,.42,.105);
    const dome=new T.SphereGeometry(.393,28,12,0,Math.PI*2,0,Math.PI/2);
    mesh(g,dome,mat(0x8c9fc4),.05,.65,-.08);
    const arc=[];
    for(let i=0;i<=32;i++){const a=i/32*Math.PI;arc.push(new T.Vector3(.05,.65+Math.sin(a)*.398,-.08+Math.cos(a)*.398));}
    line(g,arc,0xe2edff);
    const scope=cylinder(g,0xadc0dd,.14,.94,.12,.062,.42);
    scope.rotation.set(.98,0,-.44);
    for(const [x,z] of [[-.66,.2],[-.68,-.29],[.62,.41],[.56,-.43]]){
      cylinder(g,0x77606c,x,.29,z,.025,.29);
      for(let j=0;j<5;j++) mesh(g,rockGeo,mat(j%2?0xedafca:0xb777a8),x+(rng()-.5)*.24,.44+rng()*.17,z+(rng()-.5)*.24,.12+rng()*.06);
    }
    for(let j=0;j<4;j++)box(g,0xf5b685,.05,.17,.39+j*.13,.39,.025,.067,true);
  }else{
    for(const [x,z,h] of [[-.64,-.18,.55],[.6,-.29,.45],[-.56,.45,.27],[.56,.44,.26]]) tower(g,x,z,.23,h,.22,0x55547e,color,4);
    cylinder(g,0x6076a9,0,.2,0,.44,.11);
    const casing=new T.LineSegments(new T.EdgesGeometry(cubeGeo),new T.LineBasicMaterial({color:0xc2b5ff}));
    casing.position.set(0,.68,0);casing.scale.set(.83,.86,.76);casing.rotation.y=.28;g.add(casing);
    const wave=[];
    for(let j=0;j<=48;j++){const x=j/48*.73-.365;wave.push(new T.Vector3(x,.68+.13*Math.sin(j*.28),.31));}
    mesh(g,new T.TubeGeometry(new T.CatmullRomCurve3(wave),36,.019,6,false),mat(0xffa9dd,true),0,0,0);
    crystal(g,0,.68,0,.25,0x8a7fff);
    mesh(g,orbGeo,mat(0xc4d5ec),.67,.23,.44,.13,.17,.12);
    mesh(g,orbGeo,mat(0xe3ebff),.67,.38,.45,.105);
    for(const dx of [-.06,.06]) mesh(g,new T.ConeGeometry(.045,.12,4),mat(0xe3ebff),.67+dx,.49,.45);
  }
  batch(g);
  return g;
}

export function addLights(scene) {
  scene.add(new T.HemisphereLight(0xd9e5ff,0x433051,2.05));
  const key=new T.DirectionalLight(0xe7edff,2.15);key.position.set(-3,8,7);scene.add(key);
  const fill=new T.DirectionalLight(0x8e9bff,1.35);fill.position.set(4,-1,-5);scene.add(fill);
}

export function disposeScene(scene) {
  const resources=new Set();
  scene.traverse(item=>{
    if(item.geometry) resources.add(item.geometry);
    if(item.material) resources.add(item.material);
    if(item.isInstancedMesh) item.dispose();
  });
  resources.forEach(item=>item.dispose());
}
