import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';

const source=readFileSync(new URL('../roommate-dialogue.js',import.meta.url),'utf8');

function load(random){
  const math=Object.create(Math);
  math.random=()=>random;
  return runInNewContext(source+'\nroommateDialogue;', {Math:math});
}

test('each roommate has two distinct pools of twenty or more short lines',()=>{
  const dialogue=load(0);
  for(const [id,character] of Object.entries(dialogue.characters)){
    for(const kind of ['greetings','replies']){
      assert.ok(new Set(character[kind]).size>=20);
      assert.ok(character[kind].every(line=>line.length<=48));
      const first=dialogue.line(id,kind);
      assert.notEqual(dialogue.line(id,kind),first);
      assert.equal(dialogue.line(id,kind),first);
    }
    assert.ok(character.greetings.every(line=>!character.replies.includes(line)));
  }
});

test('five channels each contain three complete conversations, plus a rare random scene',()=>{
  const dialogue=load(0);
  const titles=new Set();
  for(const channel of Object.keys(dialogue.channels)){
    for(const random of [1/6,1/2,5/6]){
      const scene=load(random).chat(channel);
      assert.equal(scene.channel,channel);
      assert.ok(scene.messages.length>=4&&scene.messages.length<=8);
      assert.equal(new Set(scene.messages.map(([id])=>id)).size,3);
      assert.ok(scene.messages.every(([id,text])=>Object.hasOwn(dialogue.characters,id)&&text.length));
      titles.add(scene.title);
    }
    assert.notEqual(dialogue.chat(channel).title,dialogue.chat(channel).title);
  }
  assert.equal(titles.size,15);
  assert.equal(dialogue.chat('constructor'),null);
  const surprise=dialogue.chat('');
  assert.equal(surprise.channel,'');
  assert.equal(new Set(surprise.messages.map(([id])=>id)).size,3);
  assert.notEqual(dialogue.chat('').title,surprise.title);
});
