// Stage44: source-pinned independent review, no changes to the historical graph.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { buildUsageGraph } from './locale-graph.mjs';
import { textSafe } from './locale-planner.mjs';

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
      else if (/\.(?:ts|tsx)$/.test(rel)) {
        const b = fs.readFileSync(path.join(root,rel));
        source[rel] = createHash('sha1').update('blob ' + b.length + '\0').update(b).digest('hex');
      }
    }
  }
  walk('src');
  assert.deepEqual(source, packet.sourceBlobs, 'Renderer source inventory changed: reopen stage44 paths and exclusions');
  for(const [p,h] of Object.entries(packet.clientCatalogSha256)) assert.equal(digest(fs.readFileSync(path.join(root,p))),h,'Client catalogue changed: reopen stage44 review');
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
  return {rows:828,bindings,translations:167,sourceFiles:Object.keys(source).length,categories};
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
