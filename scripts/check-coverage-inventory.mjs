#!/usr/bin/env node
// Independent structural assertions against the stage16 inventory output.
// Does not certify React rendering, authorization, or translation quality.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
const dir=path.resolve('.artifacts/locale-coverage');
const report=JSON.parse(fs.readFileSync(path.join(dir,'inventory.json'),'utf8'));
const catalog=JSON.parse(fs.readFileSync('src/i18n/schema/ru.json','utf8'));
const manifest=JSON.parse(fs.readFileSync('scripts/data/pinned-schema-manifest.json','utf8'));
assert.equal(report.version,1);
assert.equal(report.source,manifest.source);
assert.equal(report.input.schemas.length,2);
assert.deepEqual(report.input.schemas.map(x=>x.schemaHash).sort(),[...catalog.meta.schemaHashes].sort());
assert.equal(report.input.schemas.reduce((n,x)=>n+(x.jsonLength>0?1:0),0),2);
assert.equal(report.summary.slots,report.rows.length);
assert.equal(report.summary.sourceLocations,report.rows.reduce((n,x)=>n+x.locations.length,0));
assert.equal(report.summary.uniqueEnglish,report.memory.length);
assert.equal(report.summary.clientExtraPluralForms,38);
assert.equal(report.summary.clientUnknownKeys,0);
assert.equal(report.extraRuPlurals.length,38);
assert.deepEqual(report.unknownClientKeys,[]);
assert.ok(report.summary.slots>0);
assert.ok(report.summary.sourceLocations>=report.summary.slots);
assert.ok(report.summary.clientMessages>0);
assert.ok(report.summary.scannedSourceFiles>0);
assert.ok(report.summary.permission.enterprise===667 && report.summary.permission.oss===630);
assert.deepEqual(report.summary.permission.mismatched,[]);
assert.ok(report.rows.every(row=>row.slot&&row.original&&row.locations.length>0));
assert.ok(report.rows.every(row=>row.locations.every(loc=>
  manifest.schemas.some(pin=>pin.edition===loc.edition&&pin.schemaHash===loc.schemaHash))));
assert.equal(new Set(report.rows.map(x=>x.slot+'\0'+x.original)).size,report.rows.length);
for (const [slot,original] of [
  ['list/x:Domain/title','Domains'],
  ['list/x:ClusterNode/title','Cluster Nodes'],
  ['list/x:DmarcExternalReport/title','Inbound DMARC Reports'],
  ['list/x:TlsExternalReport/title','TLS Reports'],
  ['list/x:ArfExternalReport/title','ARF Reports'],
  ['list/x:DmarcInternalReport/title','Outbound DMARC Reports'],
  ['list/x:TlsInternalReport/title','Outbound TLS Reports'],
]) {
  const row=report.rows.find(x=>x.slot===slot&&x.original===original);
  assert.ok(row, 'Missing exact source label: '+slot);
  assert.equal(row.status,'translated',slot);
  assert.equal(row.editionCount,2,'Both schemas should supply '+slot);
}
for (const row of report.rows) {
  const accepted=catalog.entries[row.slot];
  if(row.status==='translated'){
    assert.equal(row.original,accepted.original);
    assert.notEqual(row.original,accepted.ru);
  }
  if(row.status==='changed-original')assert.notEqual(row.original,accepted.original);
  if(row.status==='missing')assert.ok(!accepted);
}
for(const x of report.orphan)assert.ok(!report.rows.some(row=>row.slot===x.slot));
assert.ok(report.memory.every(x=>x.slots.length>0));
assert.ok(report.astReferences.every(x=>x.file.startsWith('src/')));
assert.ok(report.dynamicCalls.every(x=>x.kind&&x.file.startsWith('src/')));
const allClientIds=new Set(report.clients.map(x=>x.messageId));
for (const legacy of [
  'actions.updateAppsScopeWarning',
  'actions.negativeCacheExplanation',
  'field.selectPermissions',
  'list.showingRange',
  'interfaceLanguage',
  'logs.noTracersConfigured',
]) {
  assert.ok(allClientIds.has('webuiRu.' + legacy), 'Missing fork client key: ' + legacy);
  assert.ok(!allClientIds.has(legacy), 'Legacy fork client key still present: ' + legacy);
}
assert.equal(report.summary.status.translated>0,true);
console.log('Stage16 offline inventory structural assertions PASS. This is static source coverage, not browser/render PASS.');
