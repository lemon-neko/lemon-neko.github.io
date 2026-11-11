import assert from 'node:assert/strict';
import test from 'node:test';
import {hardwareGeometry, layers, parts, requestSteps} from '../origin-lab/origin-lab-data.js';

test('Origin Lab Inspector connections and request steps resolve to defined components',()=>{
  assert.equal(layers.length,6);
  const entries=Object.values(parts).flatMap(Object.entries);
  const ids=new Set(entries.map(([id])=>id));
  assert.equal(ids.size,entries.length);
  for(const layer of layers) assert.ok(parts[layer.id][layer.root]);
  for(const [id,part] of entries){
    assert.ok(part.name&&part.type&&part.description&&part.functionText&&part.notes,id);
    for(const other of part.connections) assert.ok(ids.has(other),id+' refers to '+other);
  }
  assert.equal(requestSteps.length,9);
  for(const step of requestSteps) assert.ok(parts[step.layer][step.part],step.name);
  assert.equal(requestSteps[0].layer,'application');
  assert.equal(requestSteps.at(-1).layer,'application');
});

test('the HBM stacks sit beside the GPU die and move outward in the exploded view',()=>{
  const {die,hbm,interposer,substrate}=hardwareGeometry;
  assert.ok(hbm.base[0]-hbm.size[0]/2>die.size[0]/2);
  assert.ok(hbm.base[0]+hbm.size[0]/2<interposer.size[0]/2);
  assert.ok(hbm.shift[0]>0&&die.shift[1]>hbm.shift[1]&&substrate.shift[1]<0);
});
