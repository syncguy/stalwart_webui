// Stage44: source-pinned independent review, no changes to the historical graph.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { buildUsageGraph } from './locale-graph.mjs';
import { textSafe } from './locale-planner.mjs';
import { loadStage48Packet, validateStage48 } from './locale-stage48.mjs';

const digest = v => createHash('sha256').update(v).digest('hex');
const json = v => JSON.stringify(v, null, 2) + '\n';
const key = r => r.slot + '\0' + r.original;
const packetPath = 'scripts/data/stage44-final-review.json';
const hash = '0fe29d63d70e0fba023b39f231611b94d76c1ae39ca160eb051266edaa73e536';
const id = r => digest(key(r)).slice(0,20);

export function loadStage44Packet(root) {
  const raw = fs.readFileSync(path.join(root, packetPath));
  assert.equal(digest(raw), hash, 'Stage44 evidence changed: reopen review');
  return JSON.parse(raw);
}

export function undoStage44(catalog, packet) {
  assert.equal(digest(json(catalog)), packet.finalCatalogSha256);
  const old = structuredClone(catalog);
  assert.equal(packet.entries.length, 167);
  const seen = new Set();
  for (const e of packet.entries) {
    assert.equal(e.id, id(e));
    assert.ok(!seen.has(e.slot)); seen.add(e.slot);
    assert.ok(e.ru && e.ru !== e.original && textSafe(e.original, e.ru), e.slot);
    assert.deepEqual(old.entries[e.slot], { original:e.original, ru:e.ru }, e.slot);
    delete old.entries[e.slot];
  }
  assert.equal(digest(json(old)), packet.baselineCatalogSha256, 'Historical catalogue changed');
  return old;
}

export function validateStage44(root, inputs, packet) {
  assert.equal(digest(fs.readFileSync(path.join(root,'scripts/data/pinned-schema-manifest.json'))), packet.manifestSha256, 'Schema change: reopen stage44 exclusions');
  assert.deepEqual([...inputs.pins.map(p=>p.schemaHash)].sort(), [...packet.schemaHashes].sort());
  const source = {};
  function walk(dir) {
    for (const item of fs.readdirSync(path.join(root,dir), {withFileTypes:true})) {
      const rel = dir + '/' + item.name;
      if (item.isDirectory()) walk(rel);
      else if (/\.[cm]?[jt]sx?$/.test(rel)) {
        const b = fs.readFileSync(path.join(root,rel));
        source[rel] = createHash('sha1').update('blob ' + b.length + '\0').update(b).digest('hex');
      }
    }
  }
  walk('src');
  // Stage47 interim: explicit reviewed delta from the stage45 source tree.
  // The stage44 packet itself is immutable; reject every unreviewed change.
  const stage47Delta = [
    [
      "src/components/common/OverflowText.tsx",
      null,
      "3c2f6dba0c18c624e5484641c72fe2c9fb592a86"
    ],
    [
      "src/components/forms/DynamicForm.tsx",
      "c5ab137c3ae29774731b554c31814da21e20f7f2",
      "ac99975eaf6ee10e3da511a81cddfee96953f629"
    ],
    [
      "src/components/lists/DynamicList.tsx",
      "45ba8e8f2341d4fbdd6f936804a285020b575145",
      "aaf0724b11286fd4c4f60aa20feaa58ea61a3d75"
    ],
    [
      "src/features/dashboard/components/DashboardChart.tsx",
      "7e82a8744930809679c1aa2b2fe72fde9d1409ce",
      "74e670b03d26f492597a2745e07943cf0289e5fd"
    ],
    [
      "src/features/dashboard/components/RankingTile.tsx",
      "f90f3c293d7b93358b4c966305d773caf6158b67",
      "276daa1fc4ac77a3911f984b68463126d8d93b58"
    ],
    [
      "src/features/dashboard/components/StatCard.tsx",
      "f0a964949afce74770b158d2cde0ad148d93cf98",
      "7cee6a1684aef36bf4ad7e271052fe4a34d6c658"
    ],
    [
      "src/features/dashboard/components/TileHeader.tsx",
      "a941615e9609b9da3638ca609f37bfb50e26ccfe",
      "4b05a5f43d8de60b3a384665dd916f710c3d6b47"
    ],
    [
      "src/hooks/useSchemaText.ts",
      "2202df8f3e9c4cfd35bb75b78c86c6ed523bb255",
      "bd137c7121cb9da7f9fa22b8f57d6f450f131d2a"
    ],
    [
      "src/i18n/schemaText.ts",
      "5eb5f4c27fe4d5ffa1d643cc33e4830f087cad20",
      "5ef865e357a94243efd8504518cf1c017b8d0dd2"
    ]
  ];
  const expectedSource = {...packet.sourceBlobs};
  for (const [file, previous, next] of stage47Delta) {
    assert.equal(expectedSource[file] ?? null, previous, 'Historical source changed: reopen stage44 ' + file);
    expectedSource[file] = next;
  }
  const stage48 = validateStage48(root, inputs, packet, expectedSource, source, loadStage48Packet(root));
  const rows = new Map(inputs.inventory.rows.map(r=>[key(r),r]));
  assert.equal(rows.size,12246);
  assert.equal(packet.rows.length,828);
  const old = undoStage44(inputs.catalog,packet);
  const seen = new Set(), categories = {};
  let bindings = 0;
  for (const r of packet.rows) {
    assert.ok(!seen.has(key(r))); seen.add(key(r));
    assert.equal(r.id,id(r));
    const actual = rows.get(key(r)); assert.ok(actual,r.slot);
    assert.equal(actual.locations.length,r.bindings.length,r.slot);
    const previous = old.entries[r.slot];
    if (r.priorRu === null) assert.ok(!previous,r.slot);
    else assert.deepEqual(previous,{original:r.original,ru:r.priorRu},r.slot);
    for (const b of r.bindings) {
      assert.ok(actual.locations.some(l=>l.edition===b.edition&&l.schemaHash===b.schemaHash&&l.sourcePointer===b.sourcePointer),r.slot);
      assert.ok(b.referencePath&&b.rendererModeGate,r.slot);
      bindings++;
    }
    categories[r.recommendedClassification]=(categories[r.recommendedClassification]??0)+1;
    assert.ok(r.sourceFiles.length && r.sourceFiles.every(f=>Object.hasOwn(source,f)),r.slot);
  }
  assert.equal(bindings,1539);
  assert.deepEqual(categories,{'unreachable/conditional':639,missing:133,'renderer-unwired':35,translated:21});
  const eligible=packet.rows.filter(r=>r.recommendedClassification!=='unreachable/conditional'&&r.priorRu===null);
  assert.deepEqual(eligible.map(key).sort(),packet.entries.map(key).sort());
  for(const e of packet.entries) for(const b of rows.get(key(e)).locations) {
    assert.equal(inputs.schema.schemaText(b.schemaHash,'ru',e.slot,e.original),e.ru);
    assert.equal(inputs.schema.schemaText(b.schemaHash,'en',e.slot,e.original),e.original);
    assert.equal(inputs.schema.schemaText('unknown','ru',e.slot,e.original),e.original);
    assert.equal(inputs.schema.schemaText(b.schemaHash,'ru',e.slot,e.original+' changed'),e.original+' changed');
  }
  return {rows:828,bindings,translations:167,sourceFiles:Object.keys(expectedSource).length,categories,stage48};
}

export function stage44Graph(inputs, packet) {
  const graph=buildUsageGraph({...inputs,fieldOwners:true,formOwners:true,variantBadges:true,traceLabels:true,regionalLabels:true,specializedPaths:true,webuiRuBootstrapPaths:true});
  const rootNames={D0:'Principal',D1:'x:Metric',D2:'item-action',D3:'x:Trace',D4:'x:Bootstrap',Q0:'global-search',A0:'action-result',F0:'credential-details',F1:'Principal'};
  const modes={D0:'direct-route',D1:'direct-route',D2:'detail',D3:'list',D4:'singleton',Q0:'search',A0:'result',F0:'detail',F1:'denied-tooltip'};
  const sections={D0:'@direct',D1:'@direct',D2:'@item-action',D3:'@direct',D4:'@direct',Q0:'@search',A0:'@action-result',F0:'@returned-values',F1:'@permission'};
  graph.reviewedExclusions=new Map();
  let bootstrap=0,review=0;
  for(const r of packet.rows) {
    const uses=graph.usages.get(key(r)); assert.ok(uses,r.slot);
    if(r.recommendedClassification==='unreachable/conditional') {
      // Do not suppress a newly discovered consumer.
      if(!uses.length) graph.reviewedExclusions.set(key(r),r.reason);
      continue;
    }
    if(['B0','B1'].includes(r.group)) {
      assert.ok(uses.length,r.slot); bootstrap++; continue;
    }
    assert.ok(rootNames[r.group],r.group);
    const screen=r.group==='D2'?(r.slot.includes('Domain')?'x:Domain/DomainZone':'x:QueuedMessage/MessageContents'):rootNames[r.group];
    const section=sections[r.group], mode=modes[r.group];
    // Exact source-reviewed non-menu paths. The CI separately exercises the
    // actual sink components and route/search contracts (not browser access).
    for(const b of r.bindings) {
      uses.push({section,area:section,screen,mode,via:b.referencePath,conditions:[b.rendererModeGate,'source-pinned review; synthetic/source checks required; browser/ACL unknown'],schemaHash:b.schemaHash,edition:b.edition,sourcePointer:b.sourcePointer,lookupSlot:r.slot,renderer:r.sourceFiles.join(' -> '),state:'wired'});
    }
    review++;
    let s=graph.screens.find(s=>s.section===section&&s.view===screen);
    if(!s) {s={section,area:section,view:screen,name:screen,editions:[],gates:[],modes:[mode]};graph.screens.push(s);}
    s.editions=[...new Set([...s.editions,...r.bindings.map(b=>b.edition)])].sort();
  }
  assert.equal(bootstrap,104);
  assert.equal(review,85);
  // Previously translated slots: do not count non-rendered editor metadata.
  const addSink=(slot,section,screen,mode,renderer,condition,replace=false)=>{
    const rows=inputs.inventory.rows.filter(r=>r.slot===slot); assert.equal(rows.length,1,slot);
    const row=rows[0],k=key(row);
    if(replace)graph.usages.set(k,[]);
    const uses=graph.usages.get(k);
    for(const b of row.locations)uses.push({section,area:section,screen,mode,via:renderer,conditions:[condition,'availability-unknown'],schemaHash:b.schemaHash,edition:b.edition,sourcePointer:b.sourcePointer,lookupSlot:slot,renderer,state:'wired'});
    let s=graph.screens.find(s=>s.section===section&&s.view===screen);
    if(!s){s={section,area:section,view:screen,name:screen,editions:[],gates:[],modes:[]};graph.screens.push(s);}
    s.modes=[...new Set([...s.modes,mode])].sort();
    s.editions=[...new Set([...s.editions,...row.locations.map(b=>b.edition)])].sort();
  };
  const otp=inputs.inventory.rows.find(r=>r.slot==='field/x:AccountPassword/otpAuth/description');
  assert.ok(otp);
  graph.usages.set(key(otp),[]);
  graph.reviewedExclusions.set(key(otp),'UNLABELLED OTP widget replaces outer description; singleton has no generic detail; search indexes labels only');
  addSink('form/x:AccountPassword/field/otpAuth','@search','global-search','search','schemaStore.buildSearchIndex','Search label with permitted layout/view',true);
  addSink('form/x:Passkey/field/registration','@search','global-search','search','schemaStore.buildSearchIndex','Search label with permitted layout/view',true);
  addSink('form/x:Passkey/field/registration','@direct','x:Passkey','detail','DynamicView/FieldValue','Nonempty registration in full detail; not editor');
  addSink('field/x:Passkey/registration/description','@direct','x:Passkey','detail','DynamicView/FieldValue','Nonempty registration in full detail; createOnly suppresses editor',true);
  for(const name of ['x:AppPassword','x:ApiKey']) addSink('form/'+name+'/field/secret','@returned-values',name,'create-result','DynamicForm/CreatedValuesDialog','Nonempty returned server secret; caption only, value and copy remain raw');
  addSink('list/x:AppPassword/singular','@actions','x:AppPassword','delete','DynamicList.confirmItemAction / DynamicForm / useDynamicForm.remove','Conditional item confirmation or confirmed destroy; raw ID unchanged');
  addSink('list/x:AppPassword/plural','@actions','x:AppPassword','mass-action','DynamicList.confirmMassAction','Selected items/allMatching, action permitted; payload untouched');
  return graph;
}

// Exact same-text and dynamic client decisions, separate from the schema denominator.
// validateStage44 must already have verified the full source and locale snapshot.
export function reviewStage44Client(inputs, report, { stage48 = false } = {}) {
  const entries=[
    ['dashboard.nodeWithHost','{{hostname}} ({{id}})','src/features/dashboard/components/NodeSelector.tsx','technical','raw hostname and node ID, punctuation only'],
    ['field.itemN','{{label}} {{n}}','src/components/forms/widgets/ObjectListWidget.tsx','technical','FieldRow passes localized formFieldDisplay label; position is numeric'],
    ['field.segmentOf','{{field}}, {{segment}}','src/components/forms/widgets/LocalTimeInput.tsx','technical','ARIA label and translated segment name, punctuation only'],
    ['mailRules.summary.detail','{{label}}: {{detail}}','src/features/mailRules/summary.ts','technical','format only; MailRule metadata absent in both pinned schemas; re-review on schema change'],
    ['mailRules.summary.sentence','{{when}}, {{then}}.','src/features/mailRules/summary.ts','technical','format only; conditional MailRule feature outside both pins'],
    ['mailRules.summary.slot','{{days}} {{start}}–{{end}}','src/features/mailRules/summary.ts','technical','format only; conditional MailRule enum inputs outside both pins'],
    ['mailRules.summary.test','{{operator}} {{values}}','src/features/mailRules/summary.ts','technical','format only; conditional MailRule enum inputs outside both pins'],
    ['schedule.dayRange','{{first}}–{{last}}','src/lib/scheduleFormat.ts','technical','localized formatWeekday endpoints; punctuation only'],
    ['login.usernamePlaceholder','user@example.com','src/pages/LoginPage.tsx','keep-original','literal example address'],
    ['vacation.htmlTab','HTML','src/features/vacation/components/VacationPreview.tsx','keep-original','standard format name'],
  ];
  // The historical Stage44 decision remains above; the corresponding key
  // was removed by upstream 2.1.1. Review the new punctuation-only ARIA
  // template separately; its MailRule schema inputs are outside both pins.
  const activeEntries = stage48
    ? [...entries.filter(e => e[0] !== 'mailRules.summary.sentence'),
      ['mailRules.builder.itemField','{{item}}: {{field}}','src/features/mailRules/components/RuleItemList.tsx','technical','format only; item caption plus schema field label in conditional MailRule editor; stage49 must review schema arguments']]
    : entries;
  const seen=new Set();
  for(const [messageId,original,file,classification,reason] of activeEntries) {
    const m=report.client.messages.find(c=>c.messageId===messageId);
    assert.ok(m&&m.original===original&&m.ru===original&&m.status==='same-text-needs-review',messageId);
    const refs=inputs.inventory.astReferences.filter(r=>r.messageId===messageId);
    assert.equal(refs.length,1,messageId);
    assert.equal(refs[0].file,file,messageId);
    m.classification=classification; m.reviewReason=reason;
    seen.add(messageId);
  }
  assert.equal(seen.size,10);
  assert.equal(report.client.messages.filter(c=>c.classification==='needs-review').length,0,'new client review case');
  assert.equal(report.client.messages.filter(c=>c.classification==='missing').length,0,'new missing client key');
  const calls=report.client.dynamicCalls;
  assert.equal(calls.length,2,'new dynamic client call');
  assert.deepEqual(calls.map(c=>[c.file,c.kind,c.expression,c.line,c.column]),[
    ['src/components/layout/Sidebar.tsx','schema-display-dynamic','node.displaySlot',76,29],
    ['src/components/layout/Sidebar.tsx','schema-display-dynamic','node.displaySlot',122,37],
  ]);
  for(const c of calls){c.classification='reviewed-schema-lookup';c.reviewReason='navTree.layoutNavNodes exact schema slots tested against both pins; protected captions retain original; ACL/browser unknown';}
  report.client.note+=' Stage44 exact same-text and dynamic lookup decisions require source, locale and schema snapshot validation; not exhaustive JS-string analysis.';
}
