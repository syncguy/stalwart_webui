// Stage41: exact reviewed EventType/Key packet; never write source or catalog.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {digest,readJson} from './locale-source.mjs';
import {textSafe} from './locale-planner.mjs';
import {undoBatch} from './locale-reviewed-batch.mjs';

export const packet41Path='scripts/data/stage41-trace-review.json';
export function loadTracePacket(root,policy) {
  const raw=fs.readFileSync(path.join(root,packet41Path),'utf8');
  assert.equal(digest(raw),policy.protectedInputs[packet41Path],'Stage41 packet changed');
  return readJson(raw,packet41Path);
}
export function undoTrace(catalog,packet) {
  assert.equal(packet.stage,41);
  assert.equal(packet.baseline,'b12d0f960b0e99452eb7199098e29d4eaf9867d3');
  assert.equal(packet.baselineCatalogSha256,'374084099351ec9ebae1bcd98ba72730a34ce18ab99aa1e508299f5c8bf9022e');
  assert.equal(packet.pairSha256,'091f3aaf42b49c44f2b73533c1b5b7ab029aa49d4da42e547e5992eb7312f9f9');
  assert.equal(packet.scopePairSha256,'59b46b5bcebdb5621ef7db8466b3068c4388d993c61bd3cb571035180180f762');
  assert.equal(packet.entries.length,1434);
  assert.equal(packet.existing.length,7);
  const all=[...packet.entries,...packet.existing];
  const pairs=rows=>digest(rows.map(e=>e.slot+'\0'+e.original+'\n').sort().join(''));
  assert.equal(pairs(packet.entries),packet.pairSha256);
  assert.equal(pairs(all),packet.scopePairSha256);
  assert.equal(new Set(all.map(e=>e.slot)).size,1441);
  assert.equal(all.filter(e=>/^enum\/EventType\/[^/]+\/label$/.test(e.slot)).length,672);
  assert.equal(all.filter(e=>/^enum\/EventType\/[^/]+\/explanation$/.test(e.slot)).length,672);
  assert.equal(all.filter(e=>/^enum\/Key\/[^/]+\/label$/.test(e.slot)).length,97);
  const markers=s=>[...s.matchAll(/\b(?:[A-Z][A-Z0-9]{1,}(?:-[A-Z0-9]+)*|WebDAV|CalDAV|CardDAV|ManageSieve|OpenTelemetry|WebSocket|iTIP|iMIP|Stalwart|FoundationDB|MySQL|PostgreSQL|RocksDB|SQLite|Elasticsearch|Meilisearch|Milter|Pyzor|Redis|Sieve|OAuth|OpenPGP|PubSub|Kafka|Keep|NATS|Zenoh|Prometheus|FTRL-Proximal|[0-9]+(?:\.[0-9]+)?)\b/g)].map(m=>m[0]);
  for(const e of all){
    assert.ok(textSafe(e.original,e.ru),'Protected marker changed: '+e.slot);
    for(const marker of markers(e.original))assert.ok(e.ru.includes(marker),'Protocol marker lost: '+e.slot+' '+marker);
    assert.deepEqual(catalog.entries[e.slot],{original:e.original,ru:e.ru});
  }
  const before=undoBatch(catalog,packet);
  assert.equal(Object.keys(before.entries).length,8855);
  for(const e of packet.existing)assert.deepEqual(before.entries[e.slot],{original:e.original,ru:e.ru});
  return before;
}
