// Verify explicitly activated reviewed batches; never write source or catalog.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {readJson,digest,json,at} from './locale-source.mjs';
import {plan,compactReport,textSafe} from './locale-planner.mjs';

export function loadReviewedBatches(root,policy) {
  const files=policy.reviewedBatches??[];
  assert.ok(Array.isArray(files)&&new Set(files).size===files.length);
  return files.map(p=>{
    assert.match(p,/^scripts\/data\/stage\d+-[a-z0-9-]+-review\.json$/);
    const raw=fs.readFileSync(path.join(root,p),'utf8');
    assert.equal(digest(raw),policy.protectedInputs[p],'Reviewed packet digest mismatch: '+p);
    return readJson(raw,p);
  });
}
export function undoBatch(catalog,packet) {
  assert.equal(packet.version,1);
  assert.equal(packet.status,'editor-reviewed');
  assert.equal(packet.apply,false);
  assert.match(packet.baseline,/^[a-f0-9]{40}$/);
  assert.match(packet.baselineCatalogSha256,/^[a-f0-9]{64}$/);
  assert.ok(Array.isArray(packet.entries)&&packet.entries.length>0);
  const before=structuredClone(catalog),seen=new Set();
  for(const e of packet.entries) {
    assert.ok(typeof e.slot==='string'&&e.slot&&!seen.has(e.slot),'Duplicate or invalid slot');
    seen.add(e.slot);
    assert.equal(e.decision,'translate');
    assert.ok(typeof e.original==='string'&&e.original&&typeof e.ru==='string'&&e.ru.trim()===e.ru&&e.ru!==e.original&&/[А-Яа-яЁё]/u.test(e.ru));
    assert.deepEqual(before.entries[e.slot],{original:e.original,ru:e.ru});
    assert.ok(!(before.scopedEntries??[]).some(s=>s.slot===e.slot));
    delete before.entries[e.slot];
  }
  assert.equal(digest(json(before)),packet.baselineCatalogSha256,'Previous catalog bytes changed outside reviewed batch');
  return before;
}
export function baselineCatalog(catalog,batches) {
  return [...batches].reverse().reduce((current,packet)=>undoBatch(current,packet),catalog);
}
export function batchTextSafe(original,ru,stage=19) {
  const tokens=s=>[...s.matchAll(/\$(?:seen|draft)\b|\/api\/calendar\/rsvp\b|IMAP ACLs? "[a-z]+"|\b(?:shareWith|isSubscribed|mayWriteOwn|mayUpdatePrivate|mayRSVP|PROPFIND|iTIP|iMIP|HTTP RSVP|WebDAV|iCalendar|IANA|CSS|RGB|XML|HTML|null|false)\b/g)].map(m=>m[0]).sort();
  const mailTokens=s=>[...s.matchAll(/\b(?:Authentication-Results|auth-failure|MTA-STS|TLS-RPT|MT-PRIORITY|MAIL FROM|RCPT TO|RFC \d+|hard fail|soft fail|DKIM|ADSP|DMARC|SPF|DANE|DNSSEC|DNS|TLSA|TLS|SMTP|HELO|EHLO|STARTTLS|WebPKI|ENVID|ORCPT|DSN|ARF|MX|MTA|TTL|IP|pct)\b|\bi=|"[0-9]+\.[0-9]+\.[0-9]+"/g)].map(m=>m[0]).sort();
  const maintenanceTokens=s=>[...s.matchAll(/\b(?:DKIM2|ARC|PTR|JSON|X-Spam-AI|S\/MIME|IMAP UIDs|ACME|OAuth|DAV|MIME|UTF-8|LZ4|Zstandard|ham)\b|"run"|MAIL FROM:<>/g)].map(m=>m[0]).sort();
  const externalTokens=s=>[...s.matchAll(/AI_<(?:CATEGORY|SIGNAL)>(?:_(?:HIGH|MEDIUM|LOW))?|\b(?:AI_UNCERTAIN|AI_|HIGH|MEDIUM|LOW|true|llm_prompt|Sieve|Azure OpenAI|OpenAI|llama\.cpp|vLLM|TypeSafe|OpenID Connect|Client ID Metadata Documents|JWTs?|PEM|ECDSA|HMAC|RSASSA-PSS|RSASSA-PKCS1-v1_5|MGF1|P-(?:256|384)|SHA-(?:256|384|512)|HTTPS|HTTP|SSL|URLs?|CSV|gzip|Gzipped|OAuth 2\.0)\b|\b\d+(?:\.\d+)?\b/g)].map(m=>({JWTs:'JWT',URLs:'URL',Gzipped:'gzip'})[m[0]]??m[0]).sort();
  const securityTokens=s=>[...s.matchAll(/(?:>=|<) 10\^\d+|\b\d+\/\d+\b|\b(?:DNS-PERSIST-01|DNS-01|HTTP-01|TLS-ALPN-01|SHA-1|AES-(?:128|192|256)-(?:CBC|GCM)|AES-GCM|ChaCha20-Poly1305|RSA-OAEP|RSA|OpenPGP|WKD|keys\.openpgp\.org|CA|CAA|accounturi|EAB|URIs?|SAN|Argon2id|Bcrypt|Pbkdf2|Scrypt|zxcvbn|API|Apple Mail|Thunderbird ESR|gpgsm|KMail|Microsoft Outlook|glob|[Bb]ase64|(?:Relaxed|Simple)\/(?:Relaxed|Simple))\b/g)].map(m=>({URIs:'URI',Base64:'base64'})[m[0]]??m[0]).sort();
  return textSafe(original,ru)&&json(tokens(original))===json(tokens(ru))&&
    (stage<20||json(mailTokens(original))===json(mailTokens(ru)))&&
    (stage<21||json(maintenanceTokens(original))===json(maintenanceTokens(ru)))&&
    (stage<22||json(externalTokens(original))===json(externalTokens(ru)))&&
    (stage<23||json(securityTokens(original))===json(securityTokens(ru)));
}
export function eligibleRows(report,scope) {
  assert.ok(Array.isArray(scope)&&scope.length);
  const screens=new Set(scope.flatMap(s=>{
    assert.ok(['Settings','Management','Account'].includes(s.section)&&Array.isArray(s.screens)&&s.screens.length);
    return s.screens.map(screen=>s.section+'\0'+screen);
  }));
  const groups=new Map();
  for(const g of report.candidates)for(const id of g.rowIds){
    const list=groups.get(id)??[];list.push(g);groups.set(id,list);
  }
  return report.rows.filter(r=>{
    if(r.classification!=='missing'||r.catalogState!=='missing'||r.sourceConflict||r.renderer.wired<=0||r.renderer.unwired||r.renderer.review||!r.usages.length)return false;
    const gs=groups.get(r.id)??[];
    if(gs.length!==1||gs[0].ambiguous||gs[0].reviewStatus!=='pending'||gs[0].apply)return false;
    return r.usages.every(u=>{
      const c=report.usageContexts[u.context];
      return c.state==='wired'&&screens.has(c.section+'\0'+c.screen)&&(u.lookupSlot??r.slot)===r.slot;
    });
  });
}
export function verifyReviewedBatch({packet,before,after,inputs,graph,makeSchema}) {
  assert.deepEqual(undoBatch(after,packet),before);
  const prevInputs={...inputs,catalog:before,schema:makeSchema(before)};
  const afterInputs={...inputs,catalog:after,schema:makeSchema(after)};
  const prev=compactReport(plan(prevInputs,graph)),next=compactReport(plan(afterInputs,graph));
  const eligible=eligibleRows(prev,packet.scope),selected=new Map(eligible.map(r=>[r.slot,r]));
  assert.equal(selected.size,eligible.length);
  assert.deepEqual(packet.entries.map(e=>e.slot).sort(),[...selected.keys()].sort(),'Packet must cover exactly the eligible scope');
  const active=new Map(next.rows.map(r=>[r.id,r])),groupById=new Map();
  for(const g of prev.candidates)for(const id of g.rowIds)groupById.set(id,g);
  for(const e of packet.entries) {
    const r=selected.get(e.slot);
    assert.equal(r.original,e.original,'Original changed: '+e.slot);
    assert.ok(batchTextSafe(e.original,e.ru,packet.stage),'Protected marker mismatch: '+e.slot);
    assert.equal(active.get(r.id).classification,'translated','Display path not fully translated: '+e.slot);
    const g=groupById.get(r.id);
    for(const l of r.locations){
      const pin=inputs.pins.find(p=>p.schemaHash===l.schemaHash);
      assert.ok(pin&&at(pin.data,l.sourcePointer)===e.original,'Pinned source mismatch: '+e.slot);
      assert.ok(g.targets.some(t=>t.schemaHash===l.schemaHash&&t.slot===e.slot&&t.original===e.original&&t.sourcePointer===l.sourcePointer&&!t.catalogWrite));
      assert.equal(prevInputs.schema.schemaText(l.schemaHash,'ru',e.slot,e.original),e.original);
      assert.equal(afterInputs.schema.schemaText(l.schemaHash,'ru',e.slot,e.original),e.ru);
      assert.equal(afterInputs.schema.schemaText(l.schemaHash,'en',e.slot,e.original),e.original);
      assert.equal(afterInputs.schema.schemaText(l.schemaHash,'ru',e.slot,e.original+' changed'),e.original+' changed');
    }
    assert.equal(afterInputs.schema.schemaText('unknown','ru',e.slot,e.original),e.original);
    assert.equal(afterInputs.schema.schemaText(null,'ru',e.slot,e.original),e.original);
  }
  assert.equal(next.summary.classification.translated,prev.summary.classification.translated+packet.entries.length);
  assert.equal(next.summary.classification.missing,prev.summary.classification.missing-packet.entries.length);
  for(const k of Object.keys(prev.summary.classification))if(k!=='translated'&&k!=='missing')assert.equal(next.summary.classification[k],prev.summary.classification[k]);
  return {before:prev.summary,after:next.summary,eligible:eligible.length};
}
