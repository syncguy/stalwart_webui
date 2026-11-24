// Stage43: exact reviewed residual renderer families; no automatic writes.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {digest,readJson} from './locale-source.mjs';
import {textSafe} from './locale-planner.mjs';
import {undoBatch} from './locale-reviewed-batch.mjs';
export const packet43Path='scripts/data/stage43-specialized-review.json';
export function loadSpecializedPacket(root,policy) {
  const raw=fs.readFileSync(path.join(root,packet43Path),'utf8');
  assert.equal(digest(raw),policy.protectedInputs[packet43Path],'Stage43 packet changed');
  return readJson(raw,packet43Path);
}
export function family43(slot) {
  const owner=slot.split('/')[1];
  if(/^x:Trace(?:$|Event$|KeyValue$|Value)/.test(owner))return 'trace';
  if(['DnsRecordType','x:DnsManagement','x:DnsManagementProperties','x:CertificateManagement','x:CertificateManagementProperties'].includes(owner))return 'domain';
  if(/^x:(TaskStatus|IndexStatus)/.test(owner))return 'task-index';
  if(owner==='VacationResponse')return 'vacation';
  if(['KeyDiscoverySource','x:KeySource','x:KeySourceAutomatic'].includes(owner))return 'external-keys';
  if(['x:Expression','x:ExpressionMatch'].includes(owner))return 'expression';
  if(['x:OtpAuth','x:PasskeyRegistration'].includes(owner))return 'credentials';
  if(owner==='x:Rate')return 'rate';
  assert.fail('Unexpected stage43 family '+slot);
}
export function undoSpecialized(catalog,packet) {
  assert.equal(packet.stage,43);
  assert.equal(packet.baseline,'6341bb1defdf73e08fc850565288e0f097bf5ef1');
  assert.equal(packet.baselineCatalogSha256,'3b17ec1946b4a6d8866823d3937a33bef60e00c846d8415b1451a98b47229e25');
  assert.equal(packet.scopePairSha256,'296d47b8cc83927307bfa8aaca10e893c341e648f401959878294f1e9132b6d6');
  assert.equal(packet.pairSha256,'902b26db57ac42c13efe1ba575a8b1ffa046153815b8957605a3a698fffea037');
  assert.equal(packet.existingPairSha256,'08cdc68b7221cff9e9243d0d60a1b31240d55e234254207294dcd20d5653ade2');
  assert.equal(packet.noConsumerPairSha256,'3c1eb0b83a47466e16e3703948673e94f9d4ddb5abb957bab4058fde2b0d93c9');
  const pairs=rows=>digest(rows.map(e=>e.slot+'\0'+e.original+'\n').sort().join(''));
  const all=[...packet.entries,...packet.existing,...packet.noConsumer];
  assert.equal(packet.entries.length,122);assert.equal(packet.existing.length,21);assert.equal(packet.noConsumer.length,16);
  assert.equal(new Set(all.map(e=>e.slot)).size,159);
  assert.equal(pairs(all),packet.scopePairSha256);
  assert.equal(pairs(packet.entries),packet.pairSha256);
  assert.equal(pairs(packet.existing),packet.existingPairSha256);
  assert.equal(pairs(packet.noConsumer),packet.noConsumerPairSha256);
  const counts=Object.fromEntries(['trace','domain','task-index','vacation','external-keys','expression','credentials','rate'].map(k=>[k,all.filter(e=>family43(e.slot)===k).length]));
  assert.deepEqual(counts,{trace:54,domain:26,'task-index':32,vacation:16,'external-keys':11,expression:8,credentials:8,rate:4});
  const markers=s=>[...s.matchAll(/\b(?:DNSSEC|OPENPGPKEY|SMIMEA|DNS|HKP|keys\.openpgp\.org|Autoconfig|Autodiscover|Microsoft|CAA|DKIM|DMARC|MTA-STS|MX|SPF|SRV|TLSA|TLS|ACME|SANs|OpenPGP|S\/MIME|Autocrypt|base64url|JSON|HTML|UTC|IP|null|sub\.example\.com|example\.com|example\.org)\b/g)].map(x=>x[0]);
  for(const e of [...packet.entries,...packet.existing]){
    assert.ok(textSafe(e.original,e.ru),e.slot);
    if(e.decision==='translate')for(const token of markers(e.original))assert.ok(e.ru.includes(token),e.slot+' marker '+token);
    assert.deepEqual(catalog.entries[e.slot],{original:e.original,ru:e.ru});
  }
  for(const e of packet.existing)assert.equal(e.decision,'retain');
  for(const e of packet.noConsumer){
    assert.equal(e.decision,'no-proven-consumer');
    assert.ok(['vacation-date-override','otp-widget-client-labels','trace-custom-detail-and-server-set-create'].includes(e.family));
    if(e.priorRu===null)assert.equal(catalog.entries[e.slot],undefined);
    else assert.deepEqual(catalog.entries[e.slot],{original:e.original,ru:e.priorRu});
  }
  const before=undoBatch(catalog,packet);
  assert.equal(Object.keys(before.entries).length,11209);
  for(const e of packet.existing)assert.deepEqual(before.entries[e.slot],{original:e.original,ru:e.ru});
  return before;
}
