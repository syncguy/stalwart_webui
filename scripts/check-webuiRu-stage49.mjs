// Current-schema classification, separate from the complete historical replay.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { collectPairs, webuiRuPins, historicalPins } from './check-webuiRu-stage49-pins.mjs';
import { loadInputs, sourceModule, json, digest } from './lib/locale-source.mjs';
import { webuiRuStage49Graph } from './lib/webuiRu-stage49-graph.mjs';
import { classify, compactReport, textSafe } from './lib/locale-planner.mjs';
import { stage44Graph, loadStage44Packet } from './lib/locale-stage44.mjs';
import { verifyWebuiRuStage49Files } from './lib/webuiRu-stage49-review.mjs';
import { reviewWebuiRuStage49Exclusions } from './lib/webuiRu-stage49-exclusions.mjs';
import { grammarReviewCandidates } from './lib/webuiRu-grammar-review.mjs';

const read = p => fs.readFileSync(p, 'utf8');
const parse = p => JSON.parse(read(p));
const key = r => r.slot + '\0' + r.original;
const original = loadInputs(process.cwd());
verifyWebuiRuStage49Files(process.cwd());
const delta = parse('src/i18n/schema/webuiRu-1.2.json');
const permissions = parse('src/i18n/schema/webuiRu-permission-1.2.json');
const extra = { ...delta.entries, ...permissions.entries };
const runtimeSchema = sourceModule(read('src/i18n/webuiRuSchemaText.ts'), 'webuiRuSchemaText.ts', {
  './schemaText': original.schema, './schema/webuiRu-1.2.json': delta, './schema/webuiRu-permission-1.2.json': permissions,
});
// Reproduce the accepted historical Stage49 report exactly. Stage50 tests below
// compare the live dispatcher against this baseline for every pinned pair.
const schema = { ...runtimeSchema, schemaText: runtimeSchema.stage49SchemaText, schemaActionName: runtimeSchema.stage49SchemaActionName };
const currentPairs = collectPairs(webuiRuPins), previousPairs = collectPairs(historicalPins);
const rows = [...currentPairs.values()];
const newHash = old => Object.keys(delta.meta.baseHashes).find(h => delta.meta.baseHashes[h] === old);
const catalog = structuredClone(original.catalog);
catalog.meta.schemaHashes = webuiRuPins.map(p => p.schemaHash);
for (const slot of delta.meta.removedSlots) delete catalog.entries[slot];
for (const [slot, entry] of Object.entries(extra)) catalog.entries[slot] = { original: entry.original, ru: entry.ru };
catalog.scopedEntries = catalog.scopedEntries.map(e => ({ ...e, schemaHash: newHash(e.schemaHash) }));
const policy = structuredClone(original.policy);
policy.schemaHashes = catalog.meta.schemaHashes;
policy.contextCandidates = policy.contextCandidates.map(e => ({ ...e, ...(e.schemaHash ? { schemaHash: newHash(e.schemaHash) } : {}) }));
const editorial = parse('scripts/data/webuiRu-stage49-editorial.json');
assert.equal(editorial.rows.length,439);
assert.deepEqual(delta.meta.serverVersions,['1.2.0','1.2.1']);
assert.deepEqual(Object.keys(delta.meta.baseHashes).sort(),webuiRuPins.map(p=>p.schemaHash).sort());
for(const p of webuiRuPins)assert.equal(delta.meta.baseHashes[p.schemaHash],historicalPins.find(h=>h.edition===p.edition).schemaHash);
assert.equal(Object.keys(delta.entries).length,422);
assert.equal(Object.keys(permissions.entries).length,17);
assert.equal(Object.keys(extra).length,439);
assert.deepEqual(Object.keys(extra).sort(),editorial.rows.map(r=>r.slot).sort());
for (const r of editorial.rows) {
  assert.ok(currentPairs.has(key(r)), r.slot);
  const expected=r.decision.endsWith('translation')?r.reviewedRu:r.original;
  assert.deepEqual(extra[r.slot],{original:r.original,ru:expected,hashes:[...new Set(r.bindings.map(b=>b.schemaHash))].sort()},r.slot);
  assert.ok(textSafe(r.original,expected),'Изменены протокольные маркеры: '+r.slot);
  assert.deepEqual([...expected.matchAll(/\$[A-Za-z][A-Za-z0-9]*/g)].map(m=>m[0]).sort(),[...r.original.matchAll(/\$[A-Za-z][A-Za-z0-9]*/g)].map(m=>m[0]).sort(),r.slot);
  if (r.decision === 'keep-original-proposed') policy.keepOriginal.push({ slot:r.slot, original:r.original, reason:r.reason });
  if (r.decision === 'technical-proposed') policy.technical.push({ slot:r.slot, original:r.original, reason:r.reason });
}
const utils=sourceModule(read('src/lib/jmapUtils.ts'),'jmapUtils.ts');
const embedded=sourceModule(read('src/lib/embeddedSchema.ts'),'embeddedSchema.ts',{'@/lib/jmapUtils':utils});
const model=sourceModule(read('src/features/mailRules/model.ts'),'model.ts',{'@/lib/embeddedSchema':embedded,'@/lib/jmapUtils':utils});
const builder=sourceModule(read('src/features/mailRules/builder.ts'),'builder.ts',{'@/lib/embeddedSchema':embedded,'./model':model});
const inputs = { ...original, webuiRuInlineField:builder.isInlineField, pins:webuiRuPins, schema, catalog, policy, inventory:{...original.inventory,rows} };
const packet = structuredClone(loadStage44Packet(process.cwd()));
for (const r of packet.rows) {
  const current = currentPairs.get(key(r));
  assert.ok(current, 'Historical review pair changed: ' + r.slot);
  r.bindings = current.locations.map(b => ({...r.bindings.find(old=>old.edition===b.edition),...b}));
}
const graph = webuiRuStage49Graph(inputs,stage44Graph(inputs,packet));
const report = classify(inputs,graph);
const historicalReport=parse('.artifacts/locale-candidates/classification.json');
const exclusions = reviewWebuiRuStage49Exclusions(inputs,original,historicalReport,loadStage44Packet(process.cwd()),report);
const priorUsages=new Map(historicalReport.rows.map(r=>[key(r),r.usages.map(u=>({...historicalReport.usageContexts[u.context],lookupSlot:u.lookupSlot??r.slot}))]));
const grammar=grammarReviewCandidates(previousPairs,currentPairs,priorUsages,new Map(report.rows.map(r=>[key(r),r.usages])));
assert.equal(grammar.length,14,'Новые грамматические контексты требуют отдельного решения');
assert.equal(grammar.reduce((n,r)=>n+r.bindings.length,0),28);
for(const r of grammar) {
  const owner=r.slot.split('/').slice(1,-1).join('/');
  if(r.kind==='object-description-fallback') {
    assert.ok(['x:Account','x:BlockedSender','x:CalendarSettings','x:Exchange','x:MailRule','x:SafeSender'].includes(owner));
    r.decision='not-an-action-name';
    r.reason='Search description; the routed form has a list singular or a singleton form title. No description is substituted into Create/Edit.';
    for(const b of r.bindings) {
      const s=inputs.pins.find(p=>p.schemaHash===b.schemaHash).data;
      if(s.objects[owner].type==='singleton')assert.ok(s.forms[owner].title);
      else assert.ok(s.lists[owner==='x:Account'?'x:Account/Resource':owner].singularName);
    }
  } else if(owner==='x:Account/Resource'||owner==='x:MailRule') {
    r.decision=r.kind==='list-singular'?'exact-accusative':'quoted-nominal-or-no-consumer';
    r.actionName=owner==='x:Account/Resource'?'ресурс':'почтовое правило';
    r.reason=owner==='x:Account/Resource'?'Actual DynamicList and DynamicForm create/edit; quoted nominal delete/count/toast; RU Pagination count-only.':'Actual DynamicForm create/edit; custom list/delete text is client-localized; schema plural has no consumer.';
  } else {
    assert.ok(['x:BlockedSender','x:SafeSender'].includes(owner));
    r.decision='custom-page-no-generated-action-name';
    r.reason='SenderListPage overrides list/create/edit/detail; Add/Remove captions are client translations. Schema singular is a search breadcrumb; plural unused.';
  }
}
const count = {};
for (const r of report.rows) count[r.classification] = (count[r.classification]??0)+1;
assert.deepEqual(count,{translated:11782,'keep-original':73,'unreachable/conditional':744,technical:78});
assert.equal(report.rows.length,12677);
fs.mkdirSync('.artifacts/webuiRu-stage49',{recursive:true});
fs.writeFileSync('.artifacts/webuiRu-stage49/exclusions.json',json(exclusions));
fs.writeFileSync('.artifacts/webuiRu-stage49/grammar-review.json',json({stage:49,sourceCandidates:13,sourceBindings:26,withNewConsumers:14,bindings:28,rows:grammar,limits:'source + synthetic components; operator runtime separate'}));
fs.writeFileSync('.artifacts/webuiRu-stage49/classification.json',json(compactReport({stage:49,versions:['1.2.0','1.2.1'],summary:count,...report})));
fs.writeFileSync('.artifacts/webuiRu-stage49/diagnostic.json',json(report.rows.filter(r=>['missing','needs-review','renderer-unwired'].includes(r.classification))));

// Every approved addition is checked using its exact edition bindings and the
// actual runtime dispatcher, including changed-original and language fallback.
let tested = 0;
for (const r of editorial.rows) for (const b of r.bindings) {
  const expected = r.decision.endsWith('translation') ? r.reviewedRu : r.original;
  assert.equal(schema.schemaText(b.schemaHash,'ru',r.slot,r.original),expected,r.slot);
  for (const language of ['en','de']) assert.equal(schema.schemaText(b.schemaHash,language,r.slot,r.original),r.original);
  assert.equal(schema.schemaText(b.schemaHash,'ru',r.slot,r.original+' changed'),r.original+' changed');
  assert.equal(schema.schemaText('unknown','ru',r.slot,r.original),r.original);
  tested++;
}
assert.equal(tested,873);
for(const r of editorial.rows) for(const pin of webuiRuPins.filter(p=>!r.bindings.some(b=>b.schemaHash===p.schemaHash)))
  assert.equal(schema.schemaText(pin.schemaHash,'ru',r.slot,r.original),r.original,'Перевод другой редакции: '+r.slot);
for(const [slot,originalText,expected] of [
  ['list/x:Account/Resource/singular','resource','ресурс'],
  ['list/x:BlockedSender/singular','blocked sender','заблокированного отправителя'],
  ['list/x:SafeSender/singular','safe sender','доверенного отправителя'],
  ['list/x:MailRule/singular','mail rule','почтовое правило'],
]) for(const pin of webuiRuPins) {
  assert.equal(schema.schemaActionName(pin.schemaHash,'ru',slot,originalText),expected);
  assert.equal(schema.schemaActionName(pin.schemaHash,'en',slot,originalText),originalText);
  assert.equal(schema.schemaActionName(pin.schemaHash,'ru',slot,originalText+' changed'),null);
}
for(const pin of webuiRuPins)assert.equal(schema.canTranslateSchema(pin.schemaHash,'ru-RU'),true);
assert.equal(schema.canTranslateSchema('unknown','ru'),false);
// Inheritance is exact per edition; verify every unchanged pair, not only totals.
for (const r of rows.filter(r=>previousPairs.has(key(r)))) for (const b of r.locations) {
  const before = original.schema.schemaText(delta.meta.baseHashes[b.schemaHash],'ru',r.slot,r.original);
  assert.equal(schema.schemaText(b.schemaHash,'ru',r.slot,r.original),before,r.slot);
}
for (const r of [...previousPairs.values()].filter(r=>!currentPairs.has(key(r)))) {
  for (const hash of catalog.meta.schemaHashes) assert.equal(schema.schemaText(hash,'ru',r.slot,r.original),r.original,r.slot);
}
assert.equal(digest(read('src/i18n/schema/ru.json')),original.provenance.catalogSha256);
console.log('Stage49 exact runtime bindings and historical inheritance PASS:',JSON.stringify(count));
export { inputs, graph, report, schema, runtimeSchema, currentPairs, previousPairs };
