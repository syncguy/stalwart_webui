// Stage39: immutable reviewed variant label packet. No catalog writes.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {digest,readJson} from './locale-source.mjs';
import {textSafe} from './locale-planner.mjs';
import {undoBatch} from './locale-reviewed-batch.mjs';

export const packet39Path='scripts/data/stage39-variants-review.json';
export function loadVariantPacket(root,policy) {
  const raw=fs.readFileSync(path.join(root,packet39Path),'utf8');
  assert.equal(digest(raw),policy.protectedInputs[packet39Path],'Stage39 packet changed');
  return readJson(raw,packet39Path);
}
export function undoVariants(catalog,packet) {
  assert.equal(packet.stage,39);
  assert.equal(packet.baseline,'a16028b7342b467613f633d6b3417e6f243e512c');
  assert.equal(packet.baselineCatalogSha256,'320bbaa5c36d7f637aa0cd90a8c31456e7b4d9d801c5542e808c5edbfac7aad3');
  assert.equal(packet.pairSha256,'0588361b1e45222ab5c6562b511120b9aed7eef2fb0eedeac59a5b008926260a');
  assert.equal(packet.scopePairSha256,'ebe2a135abf36a7989ad3db495c1c7ad2ffad00c2aa0fbec6250d787b0cf504e');
  assert.equal(packet.entries.length,131);
  assert.equal(packet.existing.length,4);
  const pairDigest=rows=>digest(rows.map(e=>e.slot+'\0'+e.original+'\n').sort().join(''));
  assert.equal(pairDigest(packet.entries),packet.pairSha256);
  assert.equal(pairDigest([...packet.entries,...packet.existing]),packet.scopePairSha256);
  for(const e of [...packet.entries,...packet.existing]){
    assert.match(e.slot,/^variant\/x:[^/]+\/[^/]+\/label$/);
    assert.ok(textSafe(e.original,e.ru),'Protected marker changed: '+e.slot);
    assert.deepEqual(catalog.entries[e.slot],{original:e.original,ru:e.ru});
    // Preserve vendor names and technical protocol/algorithm tokens.
    if(e.slot.startsWith('variant/x:DnsServer/')&&!e.slot.endsWith('/PowerDns/label'))
      assert.ok(e.ru.includes(e.original),'Provider identity changed: '+e.slot);
    if(e.slot.endsWith('/PowerDns/label'))assert.ok(e.ru.includes('PowerDNS'));
    const markers=s=>[...s.matchAll(/\b(?:DKIM[12]?|Ed25519|SHA-256|RSA|ML-DSA-44|LDAP|SQL|OpenID Connect|OpenAI|TypeSafe|Anthropic|Google Gemini|Ollama|Sieve|MX|IP|URL|ACME|DMARC|DNS|TLS|iTIP|gRPC|HTTP|RFC2136|TSIG|Systemd|S\/MIME)\b/g)].map(m=>m[0]).sort();
    assert.deepEqual(markers(e.ru),markers(e.original),'Protocol marker changed: '+e.slot);
  }
  const before=undoBatch(catalog,packet);
  assert.equal(Object.keys(before.entries).length,8724);
  for(const e of packet.existing)assert.deepEqual(before.entries[e.slot],{original:e.original,ru:e.ru});
  return before;
}
