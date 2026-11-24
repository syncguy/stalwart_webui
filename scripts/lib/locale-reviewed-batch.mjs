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
  const telemetryTokens=s=>[...s.matchAll(/\/v1\/metrics\b|\b(?:I\/O|AI|SNI|ALPN|CRL|PubSub|IPREV|JMAP|WebSocket|ManageSieve|POP3|Milter|DNSBL|Pyzor|Message-Instance|X-Forwarded-For|RPC|OpenTelemetry|Prometheus|gRPC|Stalwart|Basic|localhost|metric_name|Azure|ElasticSearch|FoundationDB|LDAP|MySQL|mySQL|PostgreSQL|Redis|RocksDB|S3|SQLite)\b|\b\d+(?:\.\d+)?\s?(?:ms|s|min|h|B|KiB|MiB|GiB|kB|MB|GB|%)\b/g)].map(m=>m[0]).sort();
  const storageTokens=s=>[...s.matchAll(/\b(?:AZURE_[A-Z_]+|privateMetadata|x-amz-security-token|IPv[46]|SAS|LSM|memtables|PDF|RTF|EPUB|ZIP|OpenDocument|Office|TXT|DNSBL|Valkey|MeiliSearch|Azurite|Microsoft Entra ID|Digital Ocean|Wasabi|Yandex Object Storage|[a-z]{2}-(?:[a-z]+-)+\d|ams3|fra1|nyc3|sgp1)\b|\/shared\/(?:admin|comment)|mailto:postmaster@example\.org/g)].map(m=>m[0]).sort();
  const metadataTokens=s=>/\bprivateMetadata\b/.test(s)?[...s.matchAll(/\b(?:metadata|privateMetadata)\b/g)].map(m=>m[0]).sort():[];
  const fractionTokens=s=>[...s.matchAll(/\bone sixteenth\b|\bone eighth\b|\ba quarter\b|(?<![А-Яа-яЁё])(?:одна шестнадцатая|одна восьмая|четверть)(?![А-Яа-яЁё])/g)].map(m=>({'one sixteenth':'1/16','одна шестнадцатая':'1/16','one eighth':'1/8','одна восьмая':'1/8','a quarter':'1/4','четверть':'1/4'})[m[0]]).sort();
  const smtpTokens=s=>[...s.matchAll(/\b(?:SASL|PLAIN|LOGIN|OAUTHBEARER|XOAUTH2|PIPELINING|CHUNKING|REQUIRETLS|EXPN|VRFY|FUTURERELEASE|DELIVERBY|NOSOLICITING|UCE|FQDN|LMTP|AUTH|DATA|MAIL-FROM|RCPT-TO|MAIL|RCPT|Received-SPF|Received|Delivered-To|Message-Id|Return-Path|No-Soliciting|Date|mixer|stanag4406|nsep|4xx)\b/g)].map(m=>m[0]).sort();
  // Three exact source casing errors in stage27; do not normalize arbitrary input or historical packets.
  const markerOriginal=stage===27?({
    'DNSBl Servers':'DNSBL Servers',
    'Maximum number of received headers':'Maximum number of Received headers',
    'The default maximum number of sieve scripts a user can create':'The default maximum number of Sieve scripts a user can create',
  })[original]??original:original;
  const sieveTokens=s=>[...s.matchAll(/\b(?:ASCII|CPU|OBJECTID|NZB|NZ|FTRL-Proximal|FTRL-FH|FTRL-CCFH|L1|L2|log1p|Elbonia|Cuckoo|Deliver-By|RBL|require|notify|editheader|foreach|Foreach|While|Detail|Ham|Alpha|Beta|alpha|beta|[0-9]+[kM])\b|\b2\^n\b/g)].map(m=>m[0]).sort();
  const extension=original.match(/\b(duplicate|vacation|notify|editheader) extension\b/i)?.[1].toLowerCase();
  const rawExtensionSafe=!extension||new RegExp('\\b'+extension+'\\b').test(ru);
  const rawFromSafe=!original.includes('from field')||/\bfrom\b/.test(ru);
  const networkTokens=s=>[...s.matchAll(/\b(?:HMAC-(?:MD5|SHA1|SHA224|SHA256(?:-128)?|SHA384(?:-192)?|SHA512(?:-256)?)|DDNS|EDNS|TCP|UDP|IMAP4|CalDAV|CardDAV|GSS|TOS|DMAPI|Joker|Cloudflare|Google|Quad9|OVH|Kimsufi|Soyoustart|EU|Nagle|origin)\b/g)].map(m=>m[0]).sort();
  const accountTokens=s=>[...s.matchAll(/\b(?:OTP|CIDR|WebAuthn|Ed25519|DKIM1|ML-DSA-44|SQL|IMAP|client_secret_basic|client_secret_post|UserInfo|custom-uri|mail\.example\.com|example\.com|a-z|0-9)\b|<= 64|(?<![\w])_(?![\w])/g)].map(m=>m[0]).sort();
  // Two exact natural-language dates in stage29, not the RFC Date header.
  const smtpOriginal=stage===29&&['Date the authorization was granted','Date the application last renewed its access'].includes(original)?original.replace(/^Date /,'date '):markerOriginal;
  const coordinatorTokens=s=>[...s.matchAll(/\b(?:Kafka|Keep|NATS|Zenoh|Eclipse|RESP2|RESP3|DER|Sentinels?|wait_timeout|stalwart\.db|host:port)\b/g)].map(m=>m[0]==='Sentinels'?'Sentinel':m[0]).sort();
  const clientProtocolTokens=s=>[...s.matchAll(/\b(?:Forwarded|HSTS|CORS|IDLE|FETCH|SEARCH|STORE|MOVE|UID EXPUNGE|UIDBATCHES|UID|MESSAGELIMIT|SAVELIMIT|COPY|APPEND|Copy|Append|TOOMANY|TOOFEW|VAPID|Web Push|Server-Sent Events|404 Not Found|Changes|Get|Query|Set)\b/g)].map(m=>({Copy:'COPY',Append:'APPEND'})[m[0]]??m[0]).sort();
  const reportTokens=s=>[...s.matchAll(/\b(?:From|TLSRPT)\b/g)].map(m=>m[0]).sort();
  // Stage32 exact natural-language plural DSNs, normalized only for this pinned source.
  const reportOriginal=stage===32&&original==="Domain name used by default in the sender address and organization name of DSNs and outbound reports, available in expressions as `system('report_domain')`. If left empty, the default domain is used."?original.replace('DSNs','DSN'):original;
  const lookupTokens=s=>[...s.matchAll(/\b(?:ASN|Geo|OIDC|Client ID|Webadmin)\b|\/(?:admin|tmp)\b/g)].map(m=>m[0]).sort();
  // Only the exact stage33 display label has initial-capital Glob, unlike the glob marker in its description.
  const securityOriginal=stage===33&&original==='Glob Pattern'?'glob Pattern':original;
  const residualTokens=s=>[...s.matchAll(/\b(?:HKP|Bearer|Subject)\b/g)].map(m=>m[0]).sort();
  // Stage34 consolidates the exact previously translated headerProtection adapter label.
  const subjectOriginal=stage===34&&original==='Protected, Subject hidden'&&ru==='Защищены, тема скрыта'?original.replace('Subject',''):original;
  return textSafe(original,ru)&&json(tokens(original))===json(tokens(ru))&&
    (stage<20||json(mailTokens(reportOriginal))===json(mailTokens(ru)))&&
    (stage<21||json(maintenanceTokens(original))===json(maintenanceTokens(ru)))&&
    (stage<22||json(externalTokens(markerOriginal))===json(externalTokens(ru)))&&
    (stage<23||json(securityTokens(securityOriginal))===json(securityTokens(ru)))&&
    (stage<24||json(telemetryTokens(markerOriginal))===json(telemetryTokens(ru)))&&
    (stage<25||(json(storageTokens(markerOriginal))===json(storageTokens(ru))&&json(metadataTokens(original))===json(metadataTokens(ru))&&json(fractionTokens(original))===json(fractionTokens(ru))))&&
    (stage<26||json(smtpTokens(smtpOriginal))===json(smtpTokens(ru)))&&
    (stage<27||(json(sieveTokens(markerOriginal))===json(sieveTokens(ru))&&rawExtensionSafe&&rawFromSafe))&&
    (stage<28||json(networkTokens(original))===json(networkTokens(ru)))&&
    (stage<29||json(accountTokens(original))===json(accountTokens(ru)))&&
    (stage<30||json(coordinatorTokens(original))===json(coordinatorTokens(ru)))&&
    (stage<31||json(clientProtocolTokens(original))===json(clientProtocolTokens(ru)))&&
    (stage<32||json(reportTokens(original))===json(reportTokens(ru)))&&
    (stage<33||json(lookupTokens(original))===json(lookupTokens(ru)))&&
    (stage<34||json(residualTokens(subjectOriginal))===json(residualTokens(ru)));
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
// A one-time, pinned editorial closure of the Stage34 residual. The normal
// eligibleRows path intentionally continues to reject every ambiguous group.
export function reviewedAmbiguousRows(report,packet) {
  assert.equal(packet.stage,35);
  assert.equal(packet.baseline,'af554d4bb3f3bf8b5c9cc1365ab82553fd5e8e72');
  assert.equal(packet.baselineCatalogSha256,'03ca6f4bb8ec0f50ed82d095bbcee2117ceaf8ce8b6eb23713ee44115cf80b65');
  assert.equal(packet.status,'editor-reviewed');assert.equal(packet.apply,false);
  const missing=report.rows.filter(r=>r.classification==='missing');
  const pairDigest=rows=>digest(rows.map(r=>r.slot+'\0'+r.original+'\n').sort().join(''));
  assert.equal(missing.length,61);
  assert.equal(pairDigest(missing),'ab1020f1f82d1932ec47866bcdd29d7da7fdee8827a6405f3e93d66428aabc5f');
  assert.equal(packet.entries.length,61);
  assert.equal(pairDigest(packet.entries),pairDigest(missing));
  assert.equal(new Set(packet.entries.map(e=>e.slot)).size,61);
  const screens=new Map(),groups=new Map(),rows=new Map(missing.map(r=>[r.slot,r]));
  for(const g of report.candidates)for(const id of g.rowIds){
    const list=groups.get(id)??[];list.push(g);groups.set(id,list);
  }
  for(const e of packet.entries){
    const r=rows.get(e.slot);assert.ok(r&&r.original===e.original);
    assert.equal(r.catalogState,'missing');assert.equal(r.sourceConflict,false);
    assert.ok(r.renderer.wired>0&&!r.renderer.unwired&&!r.renderer.review&&!r.intlUses&&r.usages.length);
    const gs=groups.get(r.id)??[];assert.equal(gs.length,1);const g=gs[0];
    assert.equal(g.ambiguous,true);assert.equal(g.reviewStatus,'pending');assert.equal(g.apply,false);
    assert.ok(g.targets.every(t=>!t.catalogWrite));
    assert.equal(e.review.groupId,g.id);assert.deepEqual(e.review.reviewFlags,[...g.reviewFlags].sort());
    assert.ok(typeof e.review.rationale==='string'&&e.review.rationale.trim().length>=20);
    for(const u of r.usages){
      const c=report.usageContexts[u.context];
      assert.equal(c.state,'wired');assert.equal(u.lookupSlot??r.slot,r.slot);
      const set=screens.get(c.section)??new Set();set.add(c.screen);screens.set(c.section,set);
    }
  }
  assert.deepEqual(packet.scope,[...screens].sort(([a],[b])=>a<b?-1:a>b?1:0).map(([section,set])=>({section,screens:[...set].sort()})));
  assert.equal(eligibleRows(report,packet.scope).length,0);
  return missing;
}
export function verifyReviewedBatch({packet,before,after,inputs,graph,makeSchema}) {
  assert.deepEqual(undoBatch(after,packet),before);
  const prevInputs={...inputs,catalog:before,schema:makeSchema(before)};
  const afterInputs={...inputs,catalog:after,schema:makeSchema(after)};
  const prev=compactReport(plan(prevInputs,graph)),next=compactReport(plan(afterInputs,graph));
  const eligible=packet.stage===35?reviewedAmbiguousRows(prev,packet):eligibleRows(prev,packet.scope),selected=new Map(eligible.map(r=>[r.slot,r]));
  assert.equal(selected.size,eligible.length);
  if(packet.stage===35){
    for(const change of [
      p=>{p.stage=34;},p=>{p.apply=true;},p=>{p.baseline='0'.repeat(40);},
      p=>{p.entries.pop();},p=>{p.entries[0].review.groupId='wrong';},
      p=>{p.entries[0].review.reviewFlags=[];},p=>{p.entries[0].review.rationale='';},
      p=>{p.scope[0].screens.pop();},p=>{p.entries[0].slot='form/x:ArchivedEmail/field/from';},
    ]){
      const mutated=structuredClone(packet);change(mutated);
      assert.throws(()=>reviewedAmbiguousRows(prev,mutated));
    }
    // A group-level ambiguity decision must never authorize an unwired or
    // unknown consumer, even when every other packet field is unchanged.
    const r=selected.get('form/x:SpamTrainingSample/field/from');
    const original=r.usages[0].lookupSlot;
    try{r.usages[0].lookupSlot='form/x:ArchivedEmail/field/from';assert.throws(()=>reviewedAmbiguousRows(prev,packet));}
    finally{if(original===undefined)delete r.usages[0].lookupSlot;else r.usages[0].lookupSlot=original;}
    const state=prev.usageContexts[r.usages[0].context].state;
    try{prev.usageContexts[r.usages[0].context].state='review';assert.throws(()=>reviewedAmbiguousRows(prev,packet));}
    finally{prev.usageContexts[r.usages[0].context].state=state;}
  }

  assert.deepEqual(packet.entries.map(e=>e.slot).sort(),[...selected.keys()].sort(),'Packet must cover exactly the eligible scope');
  const active=new Map(next.rows.map(r=>[r.id,r])),groupById=new Map();
  for(const g of prev.candidates)for(const id of g.rowIds)groupById.set(id,g);
  for(const e of packet.entries) {
    const r=selected.get(e.slot);
    assert.equal(r.original,e.original,'Original changed: '+e.slot);
    // Stage29 consolidates already-accepted Permission labels into the ordinary catalog.
    // Existing display wording can abbreviate protocol prefixes; do not silently rewrite it.
    // Only this exact stage and exact pinned permission id/original/RU may use this path.
    const permissionParts=e.slot.split('/');
    const permissionId=packet.stage===29&&permissionParts.length===4&&permissionParts[0]==='enum'&&permissionParts[1]==='Permission'&&permissionParts[3]==='label'?permissionParts[2]:undefined;
    if(permissionId){
      assert.deepEqual(inputs.permissionCatalog.entries[permissionId],{original:e.original,ru:e.ru},'Pinned Permission label mismatch: '+e.slot);
      assert.equal(inputs.permission.permissionDisplayLabel(permissionId,e.original),e.ru);
      assert.ok(textSafe(e.original,e.ru),'Protected placeholder mismatch: '+e.slot);
    }else assert.ok(batchTextSafe(e.original,e.ru,packet.stage),'Protected marker mismatch: '+e.slot);
    if((packet.stage===34&&['enum/HeaderProtection/baseline/label','enum/HeaderProtection/noConfidentiality/label'].includes(e.slot))||(packet.stage===35&&e.slot==='enum/HeaderProtection/none/label')){
      assert.equal(inputs.options.headerProtectionOptionLabel(e.original),e.ru,'Prior header protection wording changed: '+e.slot);
    }
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
  if(packet.stage===35){assert.equal(next.summary.classification.missing,0);assert.equal(eligibleRows(next,packet.scope).length,0);}
  return {before:prev.summary,after:next.summary,eligible:eligible.length};
}
