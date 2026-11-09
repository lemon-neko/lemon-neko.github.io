import {readFile, access} from 'node:fs/promises';
import assert from 'node:assert/strict';
import test from 'node:test';
import {Box3, Vector3} from '../public/vendor/three.module.min.js';
import {worlds, makeWorld, disposeScene} from '../universe-models.js';
import {cameraEase, fitWorldZoom} from '../universe.js';

const html=await readFile(new URL('../index.html',import.meta.url),'utf8');
const css=await readFile(new URL('../styles.css',import.meta.url),'utf8');

test('each world has a unique HTML destination, real geometry, and finite dimensions',()=>{
  assert.equal(worlds.length,5);
  assert.equal(new Set(worlds.map(([id])=>id)).size,5);
  const silhouettes=new Set();
  for(const [index,[id]] of worlds.entries()){
    assert.ok(html.includes('data-world="'+id+'"'));
    assert.ok(html.includes('id="world-'+id+'"'));
    const world=makeWorld(index);
    const size=new Box3().setFromObject(world).getSize(new Vector3());
    assert.ok(size.toArray().every(n=>Number.isFinite(n)&&n>0));
    silhouettes.add(size.toArray().map(n=>n.toFixed(2)).join('/'));
    disposeScene(world);
  }
  assert.equal(silhouettes.size,5);
});

test('all static asset paths used by the homepage exist',async()=>{
  const assets=[
    ...Array.from(html.matchAll(/(?:src|href)="((?![#/]|https?:)[^"]+)"/g),m=>m[1]),
    ...Array.from(html.matchAll(/(?:property="og:image"|name="twitter:image") content="https:\/\/lemon-neko\.github\.io\/([^"]+)"/g),m=>m[1]),
    ...Array.from(css.matchAll(/url\("([^"]+)"\)/g),m=>m[1])
  ];
  await Promise.all([...new Set(assets)].map(file=>access(new URL('../'+file,import.meta.url))));
  assert.ok(html.includes('href="https://carelink.pw/"'));
});

test('camera easing clamps overshoot and keeps a smooth symmetric transition',()=>{
  assert.deepEqual([-1,0,.5,1,2].map(cameraEase),[0,0,.5,1,1]);
  assert.ok(cameraEase(.25)<.25);
  assert.equal(cameraEase(.25)+cameraEase(.75),1);
});

test('planet framing targets 45% of scene height and respects narrow view widths',()=>{
  assert.equal(fitWorldZoom(12,8,2,2),1.8);
  assert.equal(fitWorldZoom(5,8,4,2),.95);
  for(const [index] of worlds.entries()){
    const model=makeWorld(index);
    const size=new Box3().setFromObject(model).getSize(new Vector3());
    for(const width of [5,12]){
      const zoom=fitWorldZoom(width,8,size.x,size.y);
      assert.ok(size.x*zoom<=width*.76+.0001);
      assert.ok(size.y*zoom<=8*.45+.0001);
    }
    disposeScene(model);
  }
});
