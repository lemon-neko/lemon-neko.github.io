import {layers, parts, prompt, promptTokens, decodedTokens, reportExcerpt, sampleReport, requestSteps} from './origin-lab-data.js';

const FLOW_DURATION = 1320;
const TOKEN_DURATION = 680;
const partIndex = new Map(layers.flatMap(layer => Object.entries(parts[layer.id]).map(([id, part]) => [id,{...part,layer}])));
const make = (tag, text) => Object.assign(document.createElement(tag), {textContent:text});

export function mountLab(lab) {
  const get = selector => lab.querySelector(selector);
  const all = selector => [...lab.querySelectorAll(selector)];
  const world = lab.closest('#world-origin');
  const stage = get('.lab-stage'), fallback = get('.lab-schematic');
  let canvas = get('.lab-canvas');
  const cameraButton = get('[data-action="camera"]');
  const stageLabel = get('.lab-stage-label'), stageHint = get('.lab-stage-hint');
  const layerNav = get('.lab-layers'), picker = get('#origin-lab-part');
  const modeButtons = all('[data-mode]');
  const slider = get('#origin-lab-explode'), progressValue = get('.lab-split-control output');
  const request = get('.lab-request'), currentStep = get('.lab-current-step'), stepList = get('.lab-steps');
  const playButton = get('[data-action="play"]'), nextButton = get('[data-action="next"]');
  const partMeta = get('.lab-part-meta'), partName = get('.lab-part-name'), partDescription = get('.lab-part-description');
  const partFunction = get('[data-detail="function"]'), partConnections = get('[data-detail="connections"]'), partNotes = get('[data-detail="notes"]');
  const mini = get('.lab-mini');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const lifetime = new AbortController(), events = {signal:lifetime.signal};
  const state = {mode:'system', layer:null, selected:'gpu', smIndex:5, progress:0, flowIndex:-1, flowFraction:0};
  let scene, sceneRequest, stageVisible = false, labVisible = false, frame = 0, lastFrame = 0, playing = false, flowTime = 0;
  let phase = 'idle', generated = 0, tokenTime = 0, tokensPlaying = false;
  let gemmCell = 0;

  get('.lab-prompt').textContent = prompt;
  get('.lab-report p').textContent = reportExcerpt;
  const layerButtons = layers.map(layer => {
    const button = make('button',layer.name);
    button.type = 'button';
    button.dataset.layer = layer.id;
    button.append(make('small',layer.zh));
    layerNav.append(button);
    return button;
  });
  const stepItems = requestSteps.map((step,i) => {
    const item = make('li',String(i+1).padStart(2,'0'));
    item.title = step.name;
    stepList.append(item);
    return item;
  });

  function button(text, action) {
    const element = make('button',text);
    element.type = 'button';
    element.dataset.action = action;
    return element;
  }

  function updateView() {
    const layer = layers.find(item => item.id === state.layer);
    const active = layer?.id || (state.mode==='flow' ? requestSteps[state.flowIndex]?.layer : undefined);
    layerButtons.forEach(item => item.setAttribute('aria-pressed',String(item.dataset.layer === active)));
    modeButtons.forEach(item => item.setAttribute('aria-pressed',String(item.dataset.mode === state.mode)));
    fallback.toggleAttribute('data-active',Boolean(active));
    fallback.querySelectorAll('[data-layer]').forEach(item => item.classList.toggle('is-active',item.dataset.layer===active));
    fallback.setAttribute('viewBox',layer?.id==='hardware' ? '16 112 343 211' : '0 0 720 365');
    stageLabel.textContent = layer ? layer.name+' · 架构示意' : state.mode==='flow' ? 'AI Request · 教学轨迹' : 'AI System · 架构示意';
    slider.value = Math.round(state.progress*100);
    progressValue.value = slider.value+'%';
    slider.disabled = state.mode==='flow';
    request.hidden = state.mode!=='flow';
    invalidate();
  }

  function populatePicker(layer) {
    if (picker.dataset.layer === layer.id) return;
    picker.dataset.layer = layer.id;
    picker.replaceChildren(...Object.entries(parts[layer.id]).map(([id, part]) => new Option(part.name,id)));
  }

  function updateInspector({focusConnection = false} = {}) {
    const part = partIndex.get(state.selected);
    populatePicker(part.layer);
    picker.value = state.selected;
    partMeta.textContent = part.layer.name+' / '+part.type;
    partName.textContent = part.name;
    partDescription.textContent = part.description;
    partFunction.textContent = part.functionText;
    partNotes.textContent = part.notes;
    if (focusConnection) picker.focus({preventScroll:true});
    partConnections.replaceChildren(...part.connections.map(id => {
      const link = make('button',partIndex.get(id).name);
      link.type = 'button';
      link.dataset.part = id;
      return link;
    }));
    renderMini();
  }

  function renderMini() {
    const kind = state.selected;
    const isTokenLab = ['decoder','runtime-engine','kv-cache'].includes(kind);
    const isMathLab = ['gemm','mlp'].includes(kind);
    const hasDetails = isTokenLab || isMathLab || ['heads','qkv','sampling','agent-core','tool'].includes(kind);
    mini.hidden = !hasDetails;
    if (!hasDetails) return;
    if (mini.dataset.kind !== kind) {
      mini.dataset.kind = kind;
      mini.replaceChildren();
      if (isTokenLab) {
        const controls = document.createElement('div');
        controls.className = 'lab-actions';
        controls.append(button('Prefill','prefill'),button('Decode','decode'),button('下一 Token','token'));
        const cache = document.createElement('div');
        cache.className = 'lab-tokens';
        const status = make('p','');
        status.setAttribute('role','status');
        if (kind==='decoder') mini.append(make('p','Token → Embedding → Decoder 堆栈 → Logits → 下一 Token'));
        mini.append(make('p','KV Cache · 示意分块'),controls,cache,status);
      } else if (isMathLab) {
        mini.append(make('p','输入 A × 权重 B = 输出 C'),make('pre',''),button('计算下一格','gemm'));
      } else {
        const descriptions = {
          qkv:['输入 → Q / K / V','Q 查询可见的 K，V 按注意力权重汇总。'],
          heads:['Q / K / V → 多个注意力头 → 合并 → 输出投影','各头各自计算权重，拼接后投影回隐藏空间。'],
          sampling:['Logits [2, 1, 0] → Softmax [66.5%, 24.5%, 9.0%]','例：按分布采样，分数最高的候选更容易被选中。'],
          'agent-core':['Think → Plan → Act → Observe → Respond','运行时根据 Observation 决定是否继续行动。'],
          tool:['Agent → File → Observation → Agent','工具分支可在请求回放第 8 步查看。']
        };
        mini.append(...descriptions[kind].map(text => make('p',text)));
      }
    }
    if (isTokenLab) renderTokens();
    if (isMathLab) renderMatrix();
  }

  function renderMatrix() {
    const a = [[1,2],[3,4]], b = [[2,0],[1,2]];
    const row = Math.floor(gemmCell/2), column = gemmCell%2;
    const c = a.map(values => b[0].map((_, i) => values[0]*b[0][i]+values[1]*b[1][i]));
    const result = c.map((line,y) => line.map((value,x) => y*2+x<=gemmCell?value:'·').join(' '));
    mini.querySelector('pre').textContent = `1 2      2 0      ${result[0]}\n3 4  ×   1 2  =   ${result[1]}\n\nC[${row+1},${column+1}] = ${a[row][0]}×${b[0][column]} + ${a[row][1]}×${b[1][column]} = ${c[row][column]}`;
  }

  function renderTokens() {
    const cache = mini.querySelector('.lab-tokens');
    if (!cache || mini.hidden) return;
    const status = mini.querySelector('[role="status"]');
    const cachedGenerated = Math.max(0,generated-1);
    cache.replaceChildren();
    if (phase !== 'idle') {
      const markers = [...promptTokens,...decodedTokens.slice(0,cachedGenerated)].map((token,i) => {
        const marker = make('span',token);
        if (i >= promptTokens.length) marker.classList.add('is-generated');
        return marker;
      });
      cache.append(...markers);
      if (generated) {
        const output = make('span',decodedTokens[generated-1]);
        output.className = 'is-current';
        output.title = '刚采样，尚未进入 KV Cache';
        cache.append(output);
      }
    }
    if (phase === 'idle') status.textContent = '选择 Prefill，批量写入 Prompt 的 K/V。';
    else if (!generated) status.textContent = 'Prefill：一次处理 '+promptTokens.length+' 个示意输入分块，建立初始 K/V。';
    else status.textContent = 'Decode：缓存 '+(promptTokens.length+cachedGenerated)+' 个位置。输出「'+decodedTokens.slice(0,generated).join('')+'」，金色块刚采样，尚未写入缓存。';
    mini.querySelector('[data-action="token"]').disabled = generated>=decodedTokens.length;
    mini.querySelector('[data-action="decode"]').disabled = tokensPlaying;
  }

  function resetTokens() {
    phase='idle'; generated=0; tokenTime=0; tokensPlaying=false;
    renderTokens();
  }
  function prefill() {
    resetTokens();
    phase='prefill';
    renderTokens();
  }
  function nextToken() {
    if (generated>=decodedTokens.length) return;
    if (phase==='idle') prefill();
    phase='decode';
    generated++;
    if (generated===decodedTokens.length) tokensPlaying=false;
    renderTokens();
  }
  function decode() {
    if (phase==='idle' || generated>=decodedTokens.length) prefill();
    nextToken();
    tokensPlaying = !reduced.matches && generated<decodedTokens.length;
    tokenTime = 0;
    renderTokens();
    invalidate();
  }

  function setStep(index) {
    state.flowIndex = index;
    state.flowFraction = index<0 ? 0 : 1;
    flowTime = 0;
    const step = requestSteps[index];
    if (step) {
      state.layer = null;
      state.selected = step.part;
      updateInspector();
    }
    stepItems.forEach((item,i) => {
      item.classList.toggle('is-past',i<index);
      if (i===index) item.setAttribute('aria-current','step');
      else item.removeAttribute('aria-current');
    });
    if (!step) currentStep.textContent = '运行请求，或单步查看执行链路。';
    else {
      const title = make('strong',String(index+1).padStart(2,'0')+' / '+step.name);
      currentStep.replaceChildren(title,make('p',step.text));
      if (index===7) currentStep.append(make('p','Agent → File → Observation → Agent'));
      if (index===requestSteps.length-1) currentStep.append(make('p',sampleReport));
    }
    updatePlayButtons();
    updateView();
  }

  function updatePlayButtons() {
    playButton.textContent = playing ? '暂停' : state.flowIndex>=0 ? '继续' : '播放';
    playButton.disabled = reduced.matches || state.flowIndex===requestSteps.length-1 && !playing;
    nextButton.disabled = state.flowIndex===requestSteps.length-1;
  }

  function enterFlow() {
    if (state.mode==='flow') return;
    state.mode='flow';
    state.layer=null;
    state.progress=0;
    scene?.resetCamera();
    setStep(-1);
  }
  function runRequest() {
    enterFlow();
    resetTokens();
    playing=!reduced.matches;
    setStep(0);
  }
  function togglePlay() {
    if (state.flowIndex<0) { runRequest(); return; }
    playing=!playing;
    if (playing && state.layer) {
      state.layer=null;
      state.selected=requestSteps[state.flowIndex].part;
      scene?.resetCamera();
      updateInspector();
      updateView();
    }
    updatePlayButtons();
    invalidate();
  }

  function pick(id, smIndex, focusConnection = false) {
    const part = partIndex.get(id);
    if (!part) return;
    if (state.mode==='flow') {
      playing=false;
      updatePlayButtons();
    }
    tokensPlaying=false;
    const changedLayer = state.layer !== part.layer.id;
    state.layer = part.layer.id;
    state.selected = id;
    if (smIndex!==undefined) state.smIndex=smIndex;
    if (changedLayer) {
      scene?.resetCamera();
      state.progress=state.mode==='exploded' ? Math.max(state.progress,.55) : 0;
    }
    const internal = ['tensor','cuda','registers','shared','l1'];
    if (id==='sm') state.progress=Math.max(state.progress,.78);
    else if (internal.includes(id)) state.progress=Math.max(state.progress,.96);
    else if (['gpc','l2','memory-controller'].includes(id)) state.progress=Math.max(state.progress,.67);
    else if (id==='decoder' && !changedLayer) state.progress=Math.max(state.progress,.79);
    else if (part.layer.id==='model' && id!=='decoder') state.progress=Math.max(state.progress,.66);
    if (state.progress>0 && state.mode!=='flow') state.mode='exploded';
    gemmCell=0;
    updateInspector({focusConnection});
    updateView();
  }

  function split(value) {
    if (state.mode==='flow') playing=false;
    if (!state.layer) {
      state.layer='hardware';
      state.selected='gpu';
      updateInspector();
    }
    state.mode='exploded';
    state.progress=value;
    updateView();
  }

  function assemble() {
    playing=false;
    resetTokens();
    state.mode='system';
    state.layer=null;
    state.selected='gpu';
    state.progress=0;
    state.smIndex=5;
    scene?.resetCamera();
    updateInspector();
    setStep(-1);
  }

  lab.addEventListener('click', event => {
    const control=event.target.closest('button');
    if (!control) return;
    if (control.dataset.layer) {
      const layer=layers.find(item=>item.id===control.dataset.layer);
      pick(layer.root);
      return;
    }
    if (control.dataset.part) { pick(control.dataset.part,undefined,true); return; }
    if (control.dataset.mode==='system') { assemble(); return; }
    if (control.dataset.mode==='exploded') { split(state.progress||.55); return; }
    if (control.dataset.mode==='flow') { enterFlow(); return; }
    switch (control.dataset.action) {
      case 'assemble':
      case 'reset': assemble(); break;
      case 'explode': split(1); break;
      case 'run':
      case 'replay': runRequest(); break;
      case 'play': togglePlay(); break;
      case 'next':
        playing=false;
        setStep(state.flowIndex+1);
        break;
      case 'camera':
        scene?.resetCamera();
        invalidate();
        break;
      case 'prefill': prefill(); break;
      case 'decode': decode(); break;
      case 'token':
        tokensPlaying=false;
        nextToken();
        break;
      case 'gemm':
        gemmCell=(gemmCell+1)%4;
        renderMatrix();
        break;
    }
  },events);
  slider.addEventListener('input',()=>split(slider.valueAsNumber/100),events);
  picker.addEventListener('change',()=>pick(picker.value),events);

  function active() { return labVisible && !document.hidden && !world.hidden; }
  function stopFrame() {
    cancelAnimationFrame(frame);
    frame=0;
    lastFrame=0;
  }
  function invalidate() {
    if (!frame && active()) frame=requestAnimationFrame(tick);
  }
  function tick(now) {
    frame=0;
    if (!active()) { lastFrame=0; return; }
    const elapsed=lastFrame ? Math.min(now-lastFrame,70) : 16;
    lastFrame=now;
    if (playing) {
      flowTime+=elapsed;
      state.flowFraction=Math.min(1,flowTime/FLOW_DURATION);
      if (flowTime>=FLOW_DURATION) {
        if (state.flowIndex===requestSteps.length-1) {
          playing=false;
          updatePlayButtons();
        } else {
          setStep(state.flowIndex+1);
          state.flowFraction=0;
        }
      }
    }
    if (tokensPlaying) {
      tokenTime+=elapsed;
      if (tokenTime>=TOKEN_DURATION) { tokenTime=0; nextToken(); }
    }
    const moving=stageVisible && scene?.render(state,elapsed/1000,reduced.matches);
    if (playing || tokensPlaying || moving) invalidate();
    else if (!frame) lastFrame=0;
  }

  function showFallback(reason, contextLost = false) {
    if (scene) scene.dispose(!contextLost);
    scene=undefined;
    canvas.hidden=true;
    fallback.removeAttribute('hidden');
    cameraButton.hidden=true;
    stageHint.textContent=reason;
  }

  function maybeLoadScene() {
    if (sceneRequest || reduced.matches || navigator.connection?.saveData || !active() || !stageVisible) return;
    if (!('WebGL2RenderingContext' in window)) {
      sceneRequest=true;
      showFallback('WebGL 不可用 · 架构示意与零件说明仍可查看。');
      return;
    }
    sceneRequest=import('./origin-lab-scene.js').then(({makeLabScene})=>{
      if (lifetime.signal.aborted || reduced.matches || !active() || !stageVisible) {
        sceneRequest=undefined;
        return;
      }
      const renderCanvas=canvas;
      const context=renderCanvas.getContext('webgl2',{antialias:true,alpha:true});
      if (!context) {
        showFallback('WebGL 不可用 · 架构示意与零件说明仍可查看。');
        return;
      }
      scene=makeLabScene(renderCanvas,get('.lab-annotations'),{
        context,
        signal:lifetime.signal,
        invalidate,
        onPick:pick,
        onLost:()=>{
          if (canvas===renderCanvas && scene) showFallback('3D 上下文已断开 · 已切换到架构示意。',true);
        }
      });
      canvas.hidden=false;
      fallback.setAttribute('hidden','');
      cameraButton.hidden=false;
      stageHint.textContent='拖动或用方向键旋转 · 双指、Ctrl / ⌘ 滚轮或 + / − 缩放';
      resizeScene();
      invalidate();
    }).catch(()=>showFallback('3D 模块不可用 · 已切换到架构示意。'));
  }

  function resizeScene() {
    scene?.resize(stage.clientWidth,stage.clientHeight);
    invalidate();
  }
  const resizeObserver = new ResizeObserver(resizeScene);
  resizeObserver.observe(stage);
  const intersection = new IntersectionObserver(entries=>{
    for (const entry of entries) {
      if (entry.target===stage) stageVisible=entry.isIntersecting;
      else labVisible=entry.isIntersecting;
    }
    if (active()) { maybeLoadScene(); invalidate(); }
    else stopFrame();
  });
  intersection.observe(lab);
  intersection.observe(stage);
  const worldObserver = new MutationObserver(()=>{
    if (world.hidden) stopFrame();
  });
  worldObserver.observe(world,{attributes:true,attributeFilter:['hidden']});
  document.addEventListener('visibilitychange',()=>{
    if (active()) { maybeLoadScene(); invalidate(); }
    else stopFrame();
  },events);
  reduced.addEventListener('change',()=>{
    if (reduced.matches) {
      playing=false;
      tokensPlaying=false;
      if (scene) {
        showFallback('已按减少动态效果偏好切换到 2D。');
        sceneRequest=undefined;
      }
      // Re-entering 3D after releasing a WebGL context requires a fresh canvas.
      const replacement=canvas.cloneNode();
      canvas.replaceWith(replacement);
      canvas=replacement;
      updatePlayButtons();
      renderTokens();
    } else maybeLoadScene();
    invalidate();
  },events);
  window.addEventListener('pagehide',event=>{
    stopFrame();
    if (event.persisted) return;
    lifetime.abort();
    intersection.disconnect();
    worldObserver.disconnect();
    resizeObserver.disconnect();
    scene?.dispose();
  },events);
  window.addEventListener('pageshow',()=>invalidate(),events);

  if (reduced.matches) stageHint.textContent='减少动态效果 · 使用 2D 示意，可单步查看请求。';
  else if (navigator.connection?.saveData) stageHint.textContent='节省流量模式 · 使用 2D 示意。';
  updateInspector();
  setStep(-1);
  all('[data-lab-interactive]').forEach(item => {item.hidden=false;});
}
