import * as T from '../public/vendor/three.module.min.js';
import {hardwareGeometry, layers, parts, requestSteps} from './origin-lab-data.js';

const overviewLayout = {
  hardware: [-3.45, 0, .4], compute: [.95, 0, -2.25], runtime: [4, 0, -2.25],
  model: [4, 0, .14], agent: [.95, 0, .14], application: [4, 0, 2.65],
  file: [-.15, .17, 2.53], observation: [1.65, .17, 2.53]
};
const smooth = (progress, start, end) => {
  const t = Math.max(0, Math.min(1, (progress - start) / (end - start)));
  return t * t * (3 - 2 * t);
};

export function makeLabScene(canvas, annotations, {context, invalidate, onPick, onLost, signal}) {
  const renderer = new T.WebGLRenderer({canvas, context, antialias:true, alpha:true});
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5));
  renderer.setClearColor(0x000000, 0);
  renderer.toneMapping = T.ACESFilmicToneMapping;
  const scene = new T.Scene();
  const camera = new T.OrthographicCamera(-1, 1, 1, -1, .1, 70);
  const raycaster = new T.Raycaster();
  const boxGeometry = new T.BoxGeometry();
  const cylinderGeometry = new T.CylinderGeometry(1, 1, 1, 12);
  const sphereGeometry = new T.SphereGeometry(.085, 12, 8);
  const geometry = new Set([boxGeometry, cylinderGeometry, sphereGeometry]);
  const materials = new Set();
  const paint = (color, properties = {}) => {
    const material = new T.MeshStandardMaterial({color, metalness:.32, roughness:.43, ...properties});
    materials.add(material);
    return material;
  };
  const ink = (color, opacity = 1) => {
    const material = new T.LineBasicMaterial({color, transparent:opacity !== 1, opacity});
    materials.add(material);
    return material;
  };
  const hemisphere = new T.HemisphereLight(0xc4e5ff, 0x263653, 2.05);
  const light = new T.DirectionalLight(0xd7ecff, 3);
  light.position.set(-5, 11, 7);
  const rim = new T.DirectionalLight(0xa4a4ed, 2);
  rim.position.set(4, 4, -8);
  scene.add(hemisphere, light, rim);
  const board = paint(0x243f55);
  const steel = paint(0x577b9d);
  const dark = paint(0x172539);
  const gold = paint(0xb98949, {metalness:.58, roughness:.36});
  const lineMaterial = ink(0x83b5dd, .34);
  const activeLineMaterial = ink(0xf8ce91);
  const details = new Map();
  const overview = new T.Group();
  const routes = new T.Group();
  const toolBranch = new T.Group();
  scene.add(overview);
  overview.add(routes, toolBranch);

  function box(parent, size, position, material) {
    const mesh = new T.Mesh(boxGeometry, material);
    mesh.scale.set(...size);
    mesh.position.set(...position);
    parent.add(mesh);
    return mesh;
  }

  function group(parent, id, position = [0,0,0]) {
    const node = new T.Group();
    node.position.set(...position);
    node.userData.part = id;
    parent.add(node);
    return node;
  }

  function instances(parent, shape, material, layout) {
    const mesh = new T.InstancedMesh(shape, material, layout.length);
    const dummy = new T.Object3D();
    layout.forEach(([size, position], index) => {
      dummy.scale.set(...size);
      dummy.position.set(...position);
      dummy.updateMatrix();
      mesh.setMatrixAt(index, dummy.matrix);
    });
    parent.add(mesh);
    return mesh;
  }

  function line(parent, points, material) {
    const pathGeometry = new T.BufferGeometry().setFromPoints(points.map(p => new T.Vector3(...p)));
    geometry.add(pathGeometry);
    const path = new T.Line(pathGeometry, material);
    parent.add(path);
    return path;
  }

  function fasteners(parent, width, depth, y, material = steel) {
    instances(parent, cylinderGeometry, material, [-1, 1].flatMap(x => [-1,1].map(z =>
      [[.083,.045,.083],[x * (width / 2 - .2),y,z * (depth / 2 - .2)]])));
  }

  function grid(parent, columns, rows, width, depth, y, material, gap = .045) {
    const dx = width / columns, dz = depth / rows;
    instances(parent, boxGeometry, material, Array.from({length:columns * rows}, (_, i) => [
      [dx-gap,.042,dz-gap], [(i % columns + .5) * dx - width/2, y, (Math.floor(i / columns) + .5) * dz - depth/2]
    ]));
  }

  const gpu = new T.Group();
  const hardware = new T.Group();
  hardware.add(gpu);
  scene.add(hardware);
  const substrate = group(gpu,'substrate');
  const interposer = group(gpu,'interposer');
  const die = group(gpu,'die');
  const packageSurface = box(substrate, hardwareGeometry.substrate.size, [0,0,0], board);
  packageSurface.userData.part = 'gpu';
  box(substrate,[8.26,.04,5.96],[0,.18,0],steel);
  fasteners(substrate,8.5,6.2,.22);
  grid(substrate,26,3,7.68,.77,-.18,gold,.065);
  for (const side of [-1,1]) {
    instances(substrate, boxGeometry, gold, Array.from({length:29}, (_, i) => [[.1,.055,.22],[(i-14)*.274,.21,side*2.89]]));
  }
  box(interposer, hardwareGeometry.interposer.size,[0,0,0],dark);
  box(interposer,[7.58,.025,5.27],[0,.091,0],steel);
  const traceMaterial = ink(0x9ac8d2,.38);
  for (const side of [-1,1]) {
    for (let trace = 0; trace < 8; trace++) {
      const z = (trace-3.5)*.16;
      line(interposer,[[side*1.52,.11,z],[side*2.14,.11,z],[side*2.39,.11,z+.21],[side*3.43,.11,z+.21]],traceMaterial);
    }
  }
  const hbmMaterial = paint(0x386c80);
  const hbmCap = paint(0x87c5ce,{metalness:.42,roughness:.34});
  const stacks = [-1,1].flatMap(x => [-1,1].map(z => {
    const stack = group(gpu,'hbm');
    box(stack,[1.33,.12,1.39],[0,-.27,0],steel);
    instances(stack, boxGeometry, hbmMaterial, Array.from({length:5}, (_, i) => [[1.24,.075,1.30],[0,-.19+i*.083,0]]));
    box(stack,[1.18,.065,1.25],[0,.229,0],hbmCap);
    grid(stack,7,1,.9,.15,.273,steel);
    return {stack,x,z};
  }));

  box(die,hardwareGeometry.die.size,[0,0,0],dark);
  box(die,[3.73,.085,3.82],[0,.184,0],paint(0x49678d));
  const cap = box(die,[3.65,.08,3.73],[0,.49,0],paint(0x335272,{transparent:true,opacity:.64,depthWrite:false}));
  cap.userData.cover = true;
  const l2 = group(die,'l2',[0,.247,0]);
  box(l2,[.32,.04,3.41],[0,0,0],paint(0x4caeb5));
  grid(l2,1,16,.24,3.24,.035,steel);
  const controllers = [-1,1].map(side => {
    const controller = group(die,'memory-controller',[side*1.7,.253,0]);
    grid(controller,1,10,.30,3.46,.015,gold);
    return controller;
  });
  const clusters = [-1,1].map(side => {
    const cluster = group(die,'gpc',[side*.90,.232,0]);
    box(cluster,[1.32,.08,3.56],[0,0,0],paint(0x254561));
    return cluster;
  });
  const smMaterial = paint(0x527fa9);
  const smLid = paint(0x9bc7ea);
  const smUnits = clusters.flatMap((cluster, column) => Array.from({length:4}, (_, row) => {
    const index = column * 4 + row;
    const sm = group(cluster,'sm');
    sm.userData.smIndex = index;
    box(sm,[1.14,.106,.73],[0,0,0],smMaterial);
    grid(sm,5,3,.96,.58,.071,smLid);
    return {sm,row,column};
  }));
  const smDetail = new T.Group();
  smDetail.visible = false;
  const smParts = [
    ['tensor',-.68,-.18,0x9e88e6], ['cuda',.67,-.18,0x6eb4e7], ['registers',-.70,.58,0x738eb4],
    ['shared',.03,.61,0x67c4c1], ['l1',.76,.61,0x91b9c8]
  ].map(([id,x,z,color]) => {
    const node = group(smDetail,id);
    const material = paint(color);
    box(node,[id === 'tensor' || id === 'cuda' ? 1.11 : .61,.125,.59],[0,0,0],material);
    grid(node,id === 'tensor' ? 4 : 5,3,id === 'tensor' || id === 'cuda' ? .93 : .48,.46,.081,dark,.026);
    return {node,x,z};
  });
  const ports = ['pcie','nvlink'].map((id, i) => {
    const port = group(substrate,id,[i ? 2.57 : -2.57,.27,3.10]);
    box(port,[1.56,.22,.36],[0,0,0],dark);
    instances(port,boxGeometry,gold,Array.from({length:13},(_, n) => [[.068,.051,.25],[(n-6)*.11,.105,0]]));
    return port;
  });

  function moveHardware(progress, index) {
    for (const [node,id] of [[substrate,'substrate'],[interposer,'interposer'],[die,'die']]) {
      const {base,shift,window} = hardwareGeometry[id];
      node.position.set(...base.map((value,i) => value+shift[i]*smooth(progress,...window)));
    }
    const hbm = hardwareGeometry.hbm;
    const hbmProgress = smooth(progress,...hbm.window);
    for (const {stack,x,z} of stacks) stack.position.set(
      x*(hbm.base[0]+hbm.shift[0]*hbmProgress), hbm.base[1]+hbm.shift[1]*hbmProgress, z*(hbm.base[2]+hbm.shift[2]*hbmProgress));
    const arrayProgress = smooth(progress,.46,.76);
    const capProgress = smooth(progress,.06,.42);
    cap.position.y = .49+capProgress*1.32;
    cap.material.opacity = .64*(1-capProgress);
    cap.visible = capProgress<1;
    for (const [i,{sm,row,column}] of smUnits.entries()) {
      const spread = i === index ? smooth(progress,.74,1) : 0;
      sm.position.set((column ? 1 : -1)*.29*arrayProgress,
        .09+arrayProgress*(.24+row*.085)+spread*.75, (row-1.5)*(.85+.20*arrayProgress)+spread*(3.55-(row-1.5)*.65));
    }
    smUnits[index].sm.add(smDetail);
    const detailProgress = smooth(progress,.69,1);
    smDetail.visible = detailProgress > .02;
    for (const {node,x,z} of smParts) node.position.set(x*detailProgress,.18+detailProgress*.36,z*detailProgress);
  }

  const bayNodes = new Map();
  const bayAnchors = new Map();
  for (const layer of layers.slice(1)) {
    const node = group(overview,layer.root,overviewLayout[layer.id]);
    const material = paint(layer.color);
    box(node,[2.48,.26,1.56],[0,0,0],board);
    box(node,[2.25,.09,1.33],[0,.175,0],dark);
    fasteners(node,2.48,1.56,.169);
    if (layer.id === 'runtime') {
      instances(node, boxGeometry, material, Array.from({length:7},(_,i)=>[[.18,.28+i*.022,.85],[(i-3)*.26,.35,0]]));
    } else if (layer.id === 'agent') {
      const core = new T.Mesh(cylinderGeometry,material);
      core.scale.set(.45,.38,.45); core.position.y=.39; node.add(core);
      grid(node,6,1,1.83,.23,.25,material);
    } else if (layer.id === 'model') {
      instances(node,boxGeometry,material,Array.from({length:4},(_,i)=>[[1.66,.09,.78],[0,.29+i*.15,0]]));
    } else if (layer.id === 'application') {
      box(node,[1.54,.39,.14],[0,.41,-.16],material);
      box(node,[1.28,.12,.47],[0,.27,.12],material);
    } else {
      grid(node,7,4,1.76,.96,.275,material);
      box(node,[.88,.23,.49],[0,.39,0],material);
    }
    bayNodes.set(layer.id,node);
    bayAnchors.set(layer.id,new T.Vector3(...overviewLayout[layer.id]).add(new T.Vector3(0,.24,0)));
  }
  bayNodes.set('hardware',gpu);
  bayAnchors.set('hardware',new T.Vector3(-.75,.24,.42));

  for (const id of ['file','observation']) {
    const node = group(toolBranch,id,overviewLayout[id]);
    box(node,[1.12,.16,.68],[0,0,0],board);
    box(node,[.88,.095,.43],[0,.115,0],paint(0xd4a874));
    bayAnchors.set(id,node.position.clone());
  }

  const basePath = (from,to) => {
    const a = bayAnchors.get(from), b = bayAnchors.get(to);
    const lift = .13;
    return [[a.x,a.y,a.z],[a.x,.37+lift,a.z],[(a.x+b.x)/2,.37+lift,a.z],
      [(a.x+b.x)/2,.37+lift,b.z],[b.x,.37+lift,b.z],[b.x,b.y,b.z]];
  };
  const routesById = new Map();
  function getRoute(from,to, parent = routes) {
    const key = from+'/'+to;
    if (!routesById.has(key)) {
      const points = basePath(from,to);
      const route = new T.CurvePath();
      for (let i=1;i<points.length;i++) route.add(new T.LineCurve3(new T.Vector3(...points[i-1]),new T.Vector3(...points[i])));
      const path = line(parent,points,lineMaterial);
      routesById.set(key,{route,path});
    }
    return routesById.get(key);
  }
  for (let i=1;i<requestSteps.length;i++) getRoute(requestSteps[i-1].layer,requestSteps[i].layer);
  const branch = [['agent','file'],['file','observation'],['observation','agent']];
  for (const [from,to] of branch) getRoute(from,to,toolBranch);
  const pulseMaterial = paint(0xffd898,{emissive:0xffbd6a,emissiveIntensity:2.5});
  const pulse = new T.Mesh(sphereGeometry,pulseMaterial);
  overview.add(pulse);

  function makeLayer(layer) {
    const world = new T.Group();
    const cards = new Map();
    const entries = Object.keys(parts[layer.id]);
    const material = paint(layer.color);
    const rows = Math.ceil(entries.length / 4);
    box(world,[9.25,.20,Math.max(4.75,rows*1.37)],[0,-.33,0],board);
    fasteners(world,9.25,Math.max(4.75,rows*1.37),-.196);
    for (const [i,id] of entries.entries()) {
      const card = group(world,id);
      const expanded = [(i % 4 - 1.5)*2.14, .17, (Math.floor(i/4)-(rows-1)/2)*1.33];
      if (layer.id === 'agent') {
        const orbitIds = ['search','database','browser','file','api','memory'];
        const angle = orbitIds.indexOf(id)*Math.PI/3;
        if (orbitIds.includes(id)) expanded.splice(0,3,Math.cos(angle)*3.65,.15,Math.sin(angle)*2.55);
        else if (id === 'agent-core') expanded.splice(0,3,0,.45,0);
        else {
          const others = entries.filter(key => key !== 'agent-core' && !orbitIds.includes(key));
          const innerAngle = others.indexOf(id)*Math.PI*2/others.length;
          expanded.splice(0,3,Math.cos(innerAngle)*1.84,.17,Math.sin(innerAngle)*1.47);
        }
      }
      const cardWidth = layer.id === 'agent' ? 1.06 : 1.58;
      box(card,[cardWidth,.20,.87],[0,0,0],dark);
      box(card,[cardWidth-.1,.06,.75],[0,.125,0],material);
      if (id === 'agent-core') {
        const center = new T.Mesh(cylinderGeometry,material);
        center.scale.set(.31,.48,.31);center.position.y=.34;card.add(center);
      } else {
        grid(card,layer.id === 'model' ? 3 : 5,2,cardWidth-.24,.59,.176,dark);
      }
      cards.set(id,{card,expanded});
    }
    const connections = [];
    const edgeKeys = new Set();
    for (const [id,{connections: related}] of Object.entries(parts[layer.id])) {
      for (const target of related) {
        const key = [id,target].sort().join('/');
        if (!cards.has(target) || edgeKeys.has(key)) continue;
        edgeKeys.add(key);
        const edge = line(world,[[0,0,0],[0,0,0]],lineMaterial);
        edge.frustumCulled = false;
        connections.push({id,target,edge});
      }
    }
    scene.add(world);
    const detail = {world,cards,connections,entries};
    details.set(layer.id,detail);
    return detail;
  }

  function updateLayer(detail, layer, progress) {
    const amount = smooth(progress,0,1);
    for (const [i,id] of detail.entries.entries()) {
      const {card,expanded} = detail.cards.get(id);
      const compact = layer.id === 'model' ? [(i%2-.5)*1.68,.02+(Math.floor(i/2)*.19),(Math.floor(i/2)-2.5)*.66] : expanded;
      card.position.set(...expanded.map((value,j) => T.MathUtils.lerp(compact[j],value,amount)));
    }
    for (const {id,target,edge} of detail.connections) {
      const array = edge.geometry.attributes.position;
      const a = detail.cards.get(id).card.position, b = detail.cards.get(target).card.position;
      array.setXYZ(0,a.x,a.y-.15,a.z);
      array.setXYZ(1,b.x,b.y-.15,b.z);
      array.needsUpdate = true;
    }
  }

  const appearance = new Map();
  function emphasize(root, selected, related, active) {
    root.traverse(object => {
      if (!object.isMesh || object.userData.cover) return;
      let node = object;
      while (node !== root && !node.userData.part) node = node.parent;
      const id = node.userData.part;
      if (!appearance.has(object)) {
        const original = object.material;
        appearance.set(object,original);
      }
      const original = appearance.get(object);
      if (!selected && !active) {
        object.material = original;
        return;
      }
      const bright = id === selected || active === id;
      const dim = !bright && (selected ? !related.has(id) && Boolean(id) : Boolean(id));
      if (!bright && !dim) {
        object.material = original;
        return;
      }
      const key = bright ? 'labBright' : 'labDim';
      if (!original[key]) {
        const copy = original.clone();
        if (bright) {
          copy.emissive = original.color.clone().lerp(new T.Color(0xe7f5ff),.25);
          copy.emissiveIntensity = .34;
        } else {
          copy.transparent = true;
          copy.opacity = Math.min(original.opacity,.29);
          copy.depthWrite = false;
        }
        original[key] = copy;
        materials.add(copy);
      }
      object.material = original[key];
    });
  }

  let view = null, lastMode = '', lastSelected = '', lastLayer = '', currentProgress = 0, lastSm = -1;
  const target = new T.Vector3(), aim = new T.Vector3(), worldPoint = new T.Vector3(), projection = new T.Vector3();
  const rotation = {azimuth:.48,elevation:.57,zoom:1};
  let cameraScale = 0, aspect = 1, inspectionTarget;
  let labels = new Map();
  let cachedLabelKey = '';
  function label(name, node, offset = [0,0,0]) {
    const text = document.createElement('span');
    text.textContent = name;
    annotations.append(text);
    labels.set(text,{node,offset:new T.Vector3(...offset)});
  }
  function setLabels(state, detail) {
    const key = [state.layer,state.selected,state.mode,state.progress>=.75,state.smIndex,state.flowIndex===7].join('/');
    if (key === cachedLabelKey) return;
    cachedLabelKey = key;
    annotations.replaceChildren();
    labels = new Map();
    if (!state.layer) {
      for (const layer of layers) label(layer.id === 'runtime' ? 'Runtime' : layer.id === 'hardware' ? 'GPU Package' : layer.id === 'model' ? 'Transformer' : layer.name,bayNodes.get(layer.id),[0,.59,.54]);
      if (state.flowIndex===7) {
        for (const id of ['file','observation']) label(id==='file'?'File':'Observation',toolBranch.children.find(node=>node.userData.part===id),[0,.36,0]);
      }
    } else if (state.layer === 'hardware') {
      const targets = {gpu:substrate,substrate,interposer,die,hbm:stacks[3].stack,gpc:clusters[1],sm:smUnits[state.smIndex].sm,l2, 'memory-controller':controllers[1],pcie:ports[0],nvlink:ports[1]};
      for (const {node} of smParts) targets[node.userData.part]=node;
      const ids = state.selected !== 'gpu' ? [state.selected] : state.progress>=.75 ? ['hbm','die','sm'] : ['die','hbm'];
      for (const id of ids) label(parts.hardware[id].name,targets[id],[0,.25,.48]);
      inspectionTarget = targets[state.selected];
    } else {
      const id = state.selected;
      for (const key of state.layer==='model' && id==='decoder' ? ['decoder','qkv','heads','mlp'] : [id]) {
        label(parts[state.layer][key].name,detail.cards.get(key).card,[0,.27,.34]);
      }
      inspectionTarget = detail.cards.get(id)?.card;
    }
  }

  function render(state, dt, reduced) {
    const change = state.layer!==lastLayer || state.mode!==lastMode || state.selected!==lastSelected || state.smIndex!==lastSm;
    const onOverview = !state.layer;
    const hardwareVisible = state.layer === 'hardware' && !onOverview;
    const detail = !onOverview && !hardwareVisible && (details.get(state.layer) || makeLayer(layers.find(layer => layer.id === state.layer)));
    const activeStep = onOverview && state.mode === 'flow' && requestSteps[state.flowIndex];
    const activeLayer = activeStep?.layer;
    const related = new Set(parts[state.layer]?.[state.selected]?.connections || []);
    if (change) {
      lastMode = state.mode; lastLayer = state.layer; lastSelected = state.selected; lastSm = state.smIndex;
      inspectionTarget = null;
      if (onOverview) {
        overview.add(gpu);
        gpu.position.set(...overviewLayout.hardware);
        gpu.scale.setScalar(.72);
      } else if (hardwareVisible) {
        hardware.add(gpu);
        gpu.position.set(0,0,0);
        gpu.scale.setScalar(1);
      }
      overview.visible = onOverview;
      hardware.visible = hardwareVisible;
      for (const value of details.values()) value.world.visible = value === detail;
    }
    const t = reduced ? 1 : Math.min(1, 1-Math.exp(-dt*13));
    const desiredProgress = onOverview ? 0 : state.progress;
    const previousProgress = currentProgress;
    currentProgress += (desiredProgress-currentProgress)*t;
    if (Math.abs(desiredProgress-currentProgress)<.001) currentProgress=desiredProgress;
    if (change || previousProgress!==currentProgress) {
      if (onOverview || hardwareVisible) moveHardware(currentProgress,state.smIndex);
      if (detail) updateLayer(detail,state.layer,currentProgress);
    }
    setLabels(state,detail);
    const flowChange = state.flowIndex !== view;
    if (change || flowChange) {
      view = state.flowIndex;
      emphasize(gpu,hardwareVisible && state.selected !== 'gpu' ? state.selected : null,related,activeLayer==='hardware'?'gpu':null);
      if (detail) emphasize(detail.world,state.selected===layers.find(layer=>layer.id===state.layer).root?null:state.selected,related);
      for (const layer of layers.slice(1)) emphasize(bayNodes.get(layer.id),null,related,activeLayer===layer.id?layer.root:null);
    }

    toolBranch.visible = onOverview && state.mode==='flow' && state.flowIndex===7;
    let activeRoute;
    let position = state.flowFraction;
    if (toolBranch.visible && position>=.28) {
      const branchTime = (position-.28)/.72*branch.length;
      const segment = Math.min(branch.length-1,Math.floor(branchTime));
      activeRoute = getRoute(...branch[segment]);
      position = branchTime-segment;
    } else if (activeStep && state.flowIndex>0) {
      activeRoute = getRoute(requestSteps[state.flowIndex-1].layer,activeLayer);
      if (toolBranch.visible) position /= .28;
    }
    for (const route of routesById.values()) route.path.material = route===activeRoute ? activeLineMaterial : lineMaterial;
    pulse.visible = Boolean(activeStep);
    if (activeRoute) pulse.position.copy(activeRoute.route.getPointAt(T.MathUtils.clamp(position,0,1)));
    else if (activeStep) pulse.position.copy(bayAnchors.get(activeLayer));

    scene.updateMatrixWorld(true);
    const focused = !onOverview && state.selected !== (hardwareVisible?'gpu':layers.find(layer=>layer.id===state.layer).root) && inspectionTarget;
    if (focused) {
      focused.getWorldPosition(worldPoint);
      aim.copy(worldPoint).multiplyScalar(.76);
    } else {
      aim.set(onOverview ? -.28 : 0,hardwareVisible ? currentProgress*.58 : 0,0);
    }
    const desiredScale = (focused ? Math.max(3.9,5.75/aspect) :
      onOverview ? Math.max(6.65,14.2/aspect) :
      hardwareVisible ? Math.max(7.9,12.05/aspect) : Math.max(6.65,11.4/aspect)) / rotation.zoom;
    if (cameraScale===0) {cameraScale=desiredScale;target.copy(aim);}
    cameraScale += (desiredScale-cameraScale)*t;
    target.lerp(aim,t);
    camera.left=-cameraScale*aspect/2; camera.right=-camera.left;
    camera.top=cameraScale/2; camera.bottom=-camera.top;
    camera.position.setFromSphericalCoords(20,Math.PI/2-rotation.elevation,rotation.azimuth).add(target);
    camera.lookAt(target);
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();
    for (const [text,{node,offset}] of labels) {
      projection.copy(offset).applyMatrix4(node.matrixWorld).project(camera);
      text.style.left = (projection.x*.5+.5)*100+'%';
      text.style.top = (.5-projection.y*.5)*100+'%';
      text.hidden = Math.abs(projection.x)>.97 || Math.abs(projection.y)>.89;
    }
    renderer.render(scene,camera);
    return Math.abs(desiredProgress-currentProgress)>.001 || Math.abs(cameraScale-desiredScale)>.006 || target.distanceToSquared(aim)>.0001;
  }

  const input = new AbortController();
  signal.addEventListener('abort',()=>input.abort(),{signal:input.signal});
  const inputSignal = input.signal;
  const pointers = new Map();
  const zoom = factor => { rotation.zoom = T.MathUtils.clamp(rotation.zoom*factor,.65,2.7); };
  let dragged = false;
  let start = [0,0];
  function distance() {
    const [a,b] = pointers.values();
    return Math.hypot(a.x-b.x,a.y-b.y);
  }
  canvas.addEventListener('pointerdown',event => {
    if (event.button !== 0) return;
    if (pointers.size===0) {dragged=false;start=[event.clientX,event.clientY];}
    else dragged=true;
    pointers.set(event.pointerId,{x:event.clientX,y:event.clientY});
    canvas.setPointerCapture(event.pointerId);
  },{signal:inputSignal});
  canvas.addEventListener('pointermove',event => {
    const before = pointers.get(event.pointerId);
    if (!before) return;
    const pinching = pointers.size===2;
    const span = pinching ? distance() : 0;
    pointers.set(event.pointerId,{x:event.clientX,y:event.clientY});
    if (pinching && span>2) zoom(distance()/span);
    else if (pointers.size===1) {
      dragged ||= Math.hypot(event.clientX-start[0],event.clientY-start[1])>4;
      if (!dragged) return;
      rotation.azimuth -= (event.clientX-before.x)*.008;
      rotation.elevation = T.MathUtils.clamp(rotation.elevation+(event.clientY-before.y)*.007,.17,1.37);
    }
    invalidate();
  },{signal:inputSignal});
  canvas.addEventListener('pointerup',event => {
    if (!pointers.delete(event.pointerId) || dragged) return;
    const bounds = canvas.getBoundingClientRect();
    raycaster.setFromCamera(new T.Vector2((event.clientX-bounds.left)/bounds.width*2-1,1-(event.clientY-bounds.top)/bounds.height*2),camera);
    const root = overview.visible ? overview : hardware.visible ? hardware : details.get(lastLayer)?.world;
    const hits = root ? raycaster.intersectObject(root,true) : [];
    for (const hit of hits) {
      if (!hit.object.isMesh) continue;
      let node = hit.object, id;
      while (node !== root) {
        if (!node.visible) break;
        id ||= node.userData.part;
        node = node.parent;
      }
      if (node===root && id) {
        let marker = hit.object;
        while (marker!==root && marker.userData.smIndex===undefined) marker=marker.parent;
        onPick(id,marker.userData.smIndex);
        break;
      }
    }
  },{signal:inputSignal});
  for (const type of ['pointercancel','lostpointercapture']) {
    canvas.addEventListener(type,event => pointers.delete(event.pointerId),{signal:inputSignal});
  }
  canvas.addEventListener('wheel',event => {
    if (!event.ctrlKey && !event.metaKey) return;
    event.preventDefault();
    zoom(Math.exp(-event.deltaY*.005));
    invalidate();
  },{passive:false,signal:inputSignal});
  canvas.addEventListener('keydown',event => {
    switch (event.key) {
      case 'ArrowLeft': rotation.azimuth+=.12; break;
      case 'ArrowRight': rotation.azimuth-=.12; break;
      case 'ArrowUp': rotation.elevation=T.MathUtils.clamp(rotation.elevation+.09,.17,1.37); break;
      case 'ArrowDown': rotation.elevation=T.MathUtils.clamp(rotation.elevation-.09,.17,1.37); break;
      case '=':
      case '+': zoom(1.15); break;
      case '-': zoom(1/1.15); break;
      default: return;
    }
    event.preventDefault();
    invalidate();
  },{signal:inputSignal});
  canvas.addEventListener('webglcontextlost',event => {
    event.preventDefault();
    onLost();
  },{signal:inputSignal});

  return {
    render,
    resize(width,height) {
      if (!width || !height) return;
      aspect=width/height;
      renderer.setSize(width,height,false);
    },
    resetCamera() {
      Object.assign(rotation,{azimuth:.48,elevation:.57,zoom:1});
    },
    dispose(releaseContext = true) {
      input.abort();
      for (const resource of geometry) resource.dispose();
      for (const material of materials) material.dispose();
      renderer.dispose();
      if (releaseContext) renderer.forceContextLoss();
      annotations.replaceChildren();
    }
  };
}
