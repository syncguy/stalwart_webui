// Stage38: immutable reviewed form-caption packet. No source or catalog writes.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {digest,json,readJson} from './locale-source.mjs';
import {textSafe} from './locale-planner.mjs';
import {undoBatch} from './locale-reviewed-batch.mjs';

export const packet38Path='scripts/data/stage38-form-context-review.json';
export function loadFormContextPacket(root,policy) {
  const raw=fs.readFileSync(path.join(root,packet38Path),'utf8');
  assert.equal(digest(raw),policy.protectedInputs[packet38Path],'Stage38 packet changed');
  return readJson(raw,packet38Path);
}
export function undoFormContext(catalog,packet) {
  assert.equal(packet.stage,38);
  assert.equal(packet.baseline,'0543f079a57d8d17d1d3ef241ded00e168cd746a');
  assert.equal(packet.baselineCatalogSha256,'a8b693f7d1afa38d895ce0a679c6fcdfa57251ae9706b266a1a6febdfe5c2943');
  assert.equal(packet.pairSha256,'174fbd038fa053a8667d9fdae500b795caeec2202063f143772b2a22c77cd613');
  assert.equal(packet.scopePairSha256,'a925d78f6795b115ee81a2af14730fcd9a72e18ce9036ad2824e99827dfde11c');
  assert.equal(packet.entries.length,841);
  assert.equal(new Set(packet.entries.map(e=>e.original)).size,271);
  assert.equal(digest(packet.entries.map(e=>e.slot+'\0'+e.original+'\n').sort().join('')),packet.pairSha256);
  for(const e of packet.entries){
    assert.match(e.slot,/^form\/.+\/(?:field\/[^/]+|section\/section-\d+|title)$/);
    assert.ok(textSafe(e.original,e.ru),'Protected marker changed: '+e.slot);
    // Acronyms that are also protocol or credential identifiers, not prose.
    const markers=s=>[...s.matchAll(/\b(?:API|URLs?|DNSBL|DNS|DKIM|DMARC|JMAP|TLS|TSIG|TTL|HTTP|gRPC|PEM|Base64|IAM|OCID|STS|WAPI|ANSI|iTIP|Sieve|OVH|IPs?|MX|OpenTelemetry|Prometheus|WebSocket)\b/g)].map(m=>({URLs:'URL',IPs:'IP'})[m[0]]??m[0]).sort();
    // The DNS task record-types label gains its explicit domain qualifier only here.
    const expected=e.slot==='form/x:TaskDnsManagement/field/updateRecords'&&e.original==='Record Types'?['DNS']:markers(e.original);
    assert.deepEqual(expected,markers(e.ru),'Protocol marker changed: '+e.slot);
  }
  const before=undoBatch(catalog,packet);
  assert.equal(Object.keys(before.entries).length,7883);
  return before;
}
