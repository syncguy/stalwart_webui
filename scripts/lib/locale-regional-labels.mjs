// Stage42: complete, exact reviewed TimeZone/Locale packet; never write source/catalog.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {digest,readJson} from './locale-source.mjs';
import {textSafe} from './locale-planner.mjs';
import {undoBatch} from './locale-reviewed-batch.mjs';

export const packet42Path='scripts/data/stage42-regional-labels-review.json';
export function loadRegionalPacket(root,policy) {
  const raw=fs.readFileSync(path.join(root,packet42Path),'utf8');
  assert.equal(digest(raw),policy.protectedInputs[packet42Path],'Stage42 packet changed');
  return readJson(raw,packet42Path);
}
export function undoRegional(catalog,packet) {
  assert.equal(packet.stage,42);
  assert.equal(packet.baseline,'cc1f3c859ac8d51b2edb4fb63b60813b920735e5');
  assert.equal(packet.baselineCatalogSha256,'7762ef2cb72d07962e1d672a87d0c380ef3e887242f81bdd4920ebce50aee84e');
  assert.equal(packet.pairSha256,'80bc6ff6f1e1a838edd5b22d8781a8066184d1ebc7b715834c6f9b6f3fcfb885');
  assert.equal(packet.scopePairSha256,packet.pairSha256);
  assert.equal(packet.entries.length,920);
  const pairs=rows=>digest(rows.map(e=>e.slot+'\0'+e.original+'\n').sort().join(''));
  assert.equal(pairs(packet.entries),packet.pairSha256);
  assert.equal(new Set(packet.entries.map(e=>e.slot)).size,920);
  assert.equal(new Set(packet.entries.map(e=>e.ru)).size,920);
  assert.equal(packet.entries.filter(e=>/^enum\/TimeZone\/.+\/label$/.test(e.slot)).length,598);
  assert.equal(packet.entries.filter(e=>/^enum\/Locale\/[^/]+\/label$/.test(e.slot)).length,322);
  for(const e of packet.entries) {
    assert.ok(textSafe(e.original,e.ru),e.slot);
    const [kind,id]=e.slot.slice(5,-6).split(/\/(.*)/s);
    assert.ok(kind==='TimeZone'||kind==='Locale',e.slot);
    assert.ok(e.ru.endsWith(kind==='TimeZone'?' ('+id+')':' — '+id),e.slot);
    assert.ok(!e.ru.includes('UTC+')&&!e.ru.includes('UTC-'),e.slot);
    assert.deepEqual(catalog.entries[e.slot],{original:e.original,ru:e.ru});
  }
  const before=undoBatch(catalog,packet);
  assert.equal(Object.keys(before.entries).length,10289);
  return before;
}
