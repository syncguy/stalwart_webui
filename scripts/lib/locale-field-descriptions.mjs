// Stage37: exact editor-reviewed description packet. Never writes a catalog.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {digest,json,readJson,compare} from './locale-source.mjs';
import {textSafe} from './locale-planner.mjs';

export const packetPath = 'scripts/data/stage37-field-descriptions-review.json';
export function loadFieldDescriptionPacket(root,policy) {
  const raw=fs.readFileSync(path.join(root,packetPath),'utf8');
  assert.equal(digest(raw),policy.protectedInputs[packetPath],'Stage37 review packet changed');
  return readJson(raw,packetPath);
}
export function undoFieldDescriptions(catalog,packet) {
  assert.equal(packet.version,1);
  assert.equal(packet.stage,37);
  assert.equal(packet.status,'editor-reviewed');
  assert.equal(packet.apply,false);
  assert.equal(packet.baseline,'97fdc5cf2adbeaedf83c3c170b9c42cd68364d27');
  assert.equal(packet.baselineCatalogSha256,'7e5e809aeab81456329bd9ae898b13953482e8ea4918ea8fb215897bdb9b1932');
  assert.equal(packet.pairSha256,'588f0120c6129609db46fd70c55d52e5429a3879e9f6d239fa7652e4b63c67fb');
  assert.equal(packet.orderedGroupSha256,'5c0a1f7579efa7b4207dc1f484fa94fff0cccd895f6c42ab0e7901247219e514');
  assert.equal(packet.pairCount,947);
  assert.equal(packet.slots.length,947);
  assert.equal(new Set(packet.slots).size,947);
  assert.deepEqual(packet.slots,[...packet.slots].sort(compare));
  assert.equal(packet.translations.length,436);
  const before=structuredClone(catalog),groups=new Map(),pairs=[];
  const numbers=s=>[...s.matchAll(/\b\d+(?:\.\d+)?\b/g)].map(m=>m[0]).sort(compare);
  for(const slot of packet.slots) {
    assert.match(slot,/^field\/[^/]+\/[^/]+\/description$/);
    const entry=before.entries[slot];
    assert.ok(entry&&entry.original&&entry.ru&&entry.ru!==entry.original,slot);
    assert.ok(/[А-Яа-яЁё]/u.test(entry.ru)&&entry.ru.trim()===entry.ru,slot);
    assert.ok(textSafe(entry.original,entry.ru),'Changed markup/URL/placeholder: '+slot);
    assert.deepEqual(numbers(entry.original),numbers(entry.ru),'Changed numeric marker: '+slot);
    const slots=groups.get(entry.original)??[];
    slots.push(slot);groups.set(entry.original,slots);
    pairs.push(slot+'\0'+entry.original+'\n');
    delete before.entries[slot];
  }
  assert.equal(digest(pairs.join('')),packet.pairSha256);
  const ordered=[...groups].sort((a,b)=>compare(a[1][0],b[1][0])||compare(a[0],b[0]));
  assert.equal(ordered.length,436);
  assert.equal(digest(ordered.map(([o,s])=>o+'\0'+s[0]+'\n').join('')),packet.orderedGroupSha256);
  ordered.forEach(([original,slots],i)=>{
    for(const slot of slots)assert.deepEqual(catalog.entries[slot],{original,ru:packet.translations[i]},slot);
  });
  assert.equal(digest(json(before)),packet.baselineCatalogSha256,'Stage35 catalog changed outside approved description batch');
  return before;
}
