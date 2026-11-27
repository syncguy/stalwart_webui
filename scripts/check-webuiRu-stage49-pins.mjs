// Stage49 independent preflight: pin verification and exact-pair census only.
// No runtime catalogue writes, network, renderer acceptance or changes to historical replay.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { gunzipSync } from 'node:zlib';
import ts from 'typescript';
import { grammarReviewCandidates } from './lib/webuiRu-grammar-review.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = p => fs.readFileSync(path.join(root, p));
const digest = (bytes, alg = 'sha256') => createHash(alg).update(bytes).digest('hex');
const blob = bytes => digest(Buffer.concat([Buffer.from('blob ' + bytes.length + '\0'), bytes]), 'sha1');
const oldManifestPath = 'scripts/data/pinned-schema-manifest.json';
const candidatePath = 'scripts/data/webuiRu-stage49-candidates.json';
const collectorPath = 'scripts/generate-locale-coverage.mjs';

assert.equal(blob(read(collectorPath)), 'f6fe80af03c7f11655d0e1033ea295036fa8bc63',
  'Historical collector changed; review the Stage49 census adapter');
assert.equal(blob(read(oldManifestPath)), '37aea346a8298f1600dc5414312e40b08d3f6119');
assert.equal(blob(read(candidatePath)), '2c46a06e196bac3f5bde95535615a677be25c4e9');

const pointer = (base, ...pieces) => '/' + [base, ...pieces].flat().map(x =>
  String(x).replace(/~/g, '~0').replace(/\//g, '~1')).join('/');
const truthyString = x => typeof x === 'string' && x.trim().length > 0;

function readJsonExact(raw, label) {
  // Regular JSON.parse silently drops duplicate keys; inspect the AST first.
  const ast = ts.parseJsonText(label, raw);
  assert.equal(ast.parseDiagnostics?.length ?? 0, 0, 'Invalid pinned JSON in ' + label);
  const duplicates = [];
  function walk(node, location) {
    if (ts.isObjectLiteralExpression(node)) {
      const seen = new Set();
      for (const prop of node.properties) {
        if (!ts.isPropertyAssignment(prop)) continue;
        const key = prop.name.text;
        if (seen.has(key)) duplicates.push(location + '/' + key);
        seen.add(key);
        walk(prop.initializer, location + '/' + key);
      }
    } else if (ts.isArrayLiteralExpression(node)) {
      node.elements.forEach((element, i) => walk(element, location + '/' + i));
    }
  }
  if (ast.statements[0]?.expression) walk(ast.statements[0].expression, '');
  assert.deepEqual(duplicates, [], 'Duplicate JSON properties in ' + label);
  return JSON.parse(raw);
}

// Exact copied census functions from the pinned historical collector.
// Kept separate until the shared collector can be refactored with replay evidence.
function collectPairs(pins) {
  const occurrences = new Map();
  const review = [];
  const sourceCatalogKeys = new Set();
  const duplicateSlotPairs = new Map();
  function add(pin, location, slot, original, category, renderer, options = {}) {
    if (!truthyString(original)) return;
    const key = slot + '\0' + original;
    sourceCatalogKeys.add(slot);
    const source = { edition: pin.edition, schemaHash: pin.schemaHash,
      sourcePointer: location, sourceFile: pin.file };
    const row = occurrences.get(key) ?? {
      slot, original, category, renderer,
      rendererEvidence: options.rendererEvidence ?? 'static-source-path',
      view: options.view ?? null, mode: options.mode ?? null,
      availability: options.availability ?? 'requires-edition-and-permissions-review',
      locations: [],
    };
    row.locations.push(source);
    occurrences.set(key, row);
    if (!duplicateSlotPairs.has(slot)) duplicateSlotPairs.set(slot, new Set());
    duplicateSlotPairs.get(slot).add(original);
  }
  const all = (o) => o && typeof o === 'object' ? Object.entries(o) : [];
  function stableKey(action, seen) {
    let identity;
    switch (action.type) {
      case 'view': identity = 'view:' + action.objectName + ':' + action.label; break;
      case 'query': identity = 'query:' + action.objectName + ':' + action.fieldName + ':' + action.label; break;
      default: identity = action.type + ':' + (action.label ?? '');
    }
    const count = seen.get(identity) ?? 0;
    seen.set(identity, count + 1);
    return count === 0 ? identity : identity + '#' + count;
  }
  function layoutTree(pin, data, items, section, route, idxBase) {
    for (const [i, item] of items.entries()) {
      const ptr = idxBase + '/' + i;
      if (item.type === 'link') {
        add(pin, ptr + '/name', 'nav/link/' + section + '/' + item.viewName,
          item.name, 'navigation', 'schemaStore.walkLayouts', { view: item.viewName });
      } else if (item.type === 'container') {
        const context = route + '/' + item.name;
        add(pin, ptr + '/name', 'nav/container/' + context,
          item.name, 'navigation', 'schemaStore.walkLayouts');
        layoutTree(pin, data, item.items ?? [], section, context, ptr + '/items');
      }
    }
  }
  function collectSchema(pin) {
    const data = pin.data;
    for (const [i, layout] of (data.layouts ?? []).entries()) {
      const base = '/layouts/' + i;
      add(pin, base + '/name', 'layout/' + layout.name, layout.name,
        'navigation', 'schemaStore.walkLayouts');
      for (const [j, item] of (layout.items ?? []).entries()) {
        const ptr = base + '/items/' + j;
        if (item.link) {
          add(pin, ptr + '/link/name', 'nav/link/' + layout.name + '/' + item.link.viewName,
            item.link.name, 'navigation', 'schemaStore.walkLayouts', {view:item.link.viewName});
        } else if (item.container) {
          const ctx = layout.name + '/' + item.container.name;
          add(pin, ptr + '/container/name', 'nav/container/' + ctx,
            item.container.name, 'navigation', 'schemaStore.walkLayouts');
          layoutTree(pin, data, item.container.items ?? [], layout.name, ctx,
            ptr + '/container/items');
        }
      }
    }
    for (const [name, obj] of all(data.objects)) {
      add(pin, pointer('objects',name,'description'), 'object/' + name + '/description',
        obj.description, 'object', 'schemaStore.searchIndex|DynamicForm', { view:name });
    }
    for (const [name, entry] of all(data.schemas)) {
      if (entry.type !== 'multiple') continue;
      for (const [i, v] of (entry.variants ?? []).entries()) {
        add(pin, pointer('schemas',name,'variants',i,'label'),
          'variant/' + name + '/' + v.name + '/label', v.label,
          'variant', 'VariantSelect|ObjectValue', {view:name});
      }
    }
    for (const [name, item] of all(data.fields)) {
      for (const [field, value] of all(item.properties)) {
        add(pin, pointer('fields',name,'properties',field,'description'),
          'field/' + name + '/' + field + '/description', value.description,
          'field-description', 'FieldRow|DynamicView|ObjectValue',
          {view:name, mode:'form-or-readonly'});
      }
    }
    for (const [name, form] of all(data.forms)) {
      const base = pointer('forms',name);
      add(pin, base + '/title', 'form/' + name + '/title', form.title,
        'form', 'DynamicForm.title', {view:name,mode:'form'});
      add(pin, base + '/subtitle', 'form/' + name + '/subtitle', form.subtitle,
        'form', 'DynamicForm.subtitle', {view:name,mode:'form'});
      for (const [i, sec] of (form.sections ?? []).entries()) {
        add(pin, base + '/sections/' + i + '/title',
          'form/' + name + '/section/section-' + i, sec.title,
          'form-section', 'FormSections|DynamicView', {view:name,mode:'form-or-readonly'});
        for (const [j, field] of (sec.fields ?? []).entries()) {
          const baseField = base + '/sections/' + i + '/fields/' + j;
          for (const [prop, suffix] of [
            ['label',''], ['keyLabel','/keyLabel'], ['valueLabel','/valueLabel'],
            ['placeholder','/placeholder']
          ]) {
            add(pin, baseField + '/' + prop,
              'form/' + name + '/field/' + field.name + suffix,
              field[prop], 'form-field-' + prop,
              'FieldRow|FormSections|DynamicView', {view:name,mode:'form-or-readonly'});
          }
        }
      }
    }
    for (const [name, list] of all(data.lists)) {
      const base = pointer('lists',name);
      for (const [prop,slot] of [
        ['title','title'],['subtitle','subtitle'],['singularName','singular'],
        ['pluralName','plural']
      ]) add(pin,base+'/'+prop,'list/'+name+'/'+slot,list[prop],
        'list','DynamicList|Pagination',{view:name,mode:'list'});
      for (const [i, col] of (list.columns ?? []).entries()) {
        add(pin,base+'/columns/'+i+'/label', 'list/'+name+'/column/'+col.name,
          col.label,'list-column','ColumnHeader',{view:name,mode:'list'});
      }
      for (const [i, filter] of (list.filters ?? []).entries()) {
        add(pin,base+'/filters/'+i+'/label', 'list/'+name+'/filter/'+filter.field,
          filter.label,'list-filter','FilterBar',{view:name,mode:'list'});
      }
      for (const [kind,actions] of [['itemAction',list.itemActions],['massAction',list.massActions]]) {
        const seen = new Map();
        for (const [i, action] of (actions ?? []).entries()) {
          if (action.type === 'separator') continue;
          const k = stableKey(action,seen);
          const labelPtr = kind === 'itemAction'?'itemActions':'massActions';
          const isNav = kind === 'itemAction' && (action.type === 'view'||action.type === 'query');
          add(pin,base+'/'+labelPtr+'/'+i+'/label',
            isNav ? 'list/'+name+'/action/'+action.objectName :
              'list/'+name+'/'+kind+'/'+k+'/label',
            action.label,'list-action',isNav?'RowActions.navigate':
              'RowActions|MassActionBar|DynamicList.confirm',
            {view:name,mode:'list',availability:'permission-dependent'});
        }
      }
    }
    for (const [name, values] of all(data.enums)) {
      for (const [i, val] of (values ?? []).entries()) {
        add(pin,pointer('enums',name,i,'label'),
          'enum/'+name+'/'+val.name+'/label',val.label,'enum',
          'EnumValue|ScalarLabel|Select', {mode:'enum'});
        if (val.explanation) {
          add(pin,pointer('enums',name,i,'explanation'),
            'enum/'+name+'/'+val.name+'/explanation', val.explanation,
            'enum-explanation','UNKNOWN-RENDERER',
            {rendererEvidence:'needs-ui-adapter-review'});
        }
      }
    }
    for (const [i,d] of (data.dashboards ?? []).entries()) {
      const base='/dashboards/'+i;
      add(pin,base+'/label','dashboard/'+d.id+'/label',d.label,
        'dashboard','DashboardView',{view:'Dashboard/'+d.id});
      const modern=d.items?.length>0;
      const items=modern?d.items:[
        ...(d.cards??[]).map(x=>({type:'stat',...x})),
        ...(d.charts??[]).map(x=>({type:'chart',...x}))
      ];
      const origin=(index) => modern?base+'/items/'+index :
        index<(d.cards?.length??0)?base+'/cards/'+index :
        base+'/charts/'+(index-(d.cards?.length??0));
      for (const [j,item] of items.entries()) {
        const ip=origin(j), slot='dashboard/'+d.id+'/item/'+j;
        for (const prop of ['title','description']) add(pin,ip+'/'+prop,
          slot+'/'+prop,item[prop],'dashboard',item.type+' tile',{view:d.id});
        for (const [k,series] of (item.series??[]).entries()) {
          add(pin,ip+'/series/'+k+'/label',slot+'/series/'+k+'/label',
            series.label,'dashboard-series','DashboardChart|RankingTile',{view:d.id});
        }
      }
    }
  }
  
  for (const p of pins) collectSchema(p);
  return occurrences;
}

const newPins = [
  {edition:'enterprise',file:'schema.json.gz',fixture:'scripts/data/webuiRu-stage49-schema-ee.b64',
    blobSha:'5cd84b31c320ff2038b3c85372ff45671540db2a', size:189915, jsonSize:1138389,
    sha256Gzip:'9304fb326a1e8816f723f8a0b71b50bfa078ac17aaad85cd23411be34fde7613',
    schemaHash:'kwT7MmoeiBb3I_igtxtQv6B4rBeqrYXNI0Eb40_edhM'},
  {edition:'oss',file:'schema_oss.json.gz',fixture:'scripts/data/webuiRu-stage49-schema-oss.b64',
    blobSha:'5d8af7d623a257b8fe3917c9577b7e451fce67b6', size:170419, jsonSize:1003439,
    sha256Gzip:'922062a948f3b341b7cd26ca32f7962db292414a30b4a22c4a793426e188d1d2',
    schemaHash:'kiBiqUjzs0G3zSbKMveWLbKSQUowtKIsSnk0JuGI0dI'}
];
function loadPin(pin) {
  const raw = read(pin.fixture).toString('utf8').replace(/\s/g, '');
  assert.match(raw, /^[A-Za-z0-9+/]+={0,2}$/);
  const gz = Buffer.from(raw, 'base64');
  assert.equal(gz.toString('base64'), raw);
  assert.equal(gz.length, pin.size);
  assert.equal(blob(gz), pin.blobSha);
  assert.equal(digest(gz), pin.sha256Gzip);
  assert.equal(createHash('sha256').update(gz).digest('base64url'), pin.schemaHash);
  const bytes = gunzipSync(gz);
  if (pin.jsonSize) assert.equal(bytes.length, pin.jsonSize);
  return {...pin, data:readJsonExact(bytes.toString('utf8'), pin.file)};
}
const oldManifest = readJsonExact(read(oldManifestPath).toString('utf8'), oldManifestPath);
assert.equal(oldManifest.schemas.length, 2);
const old = oldManifest.schemas.map(loadPin);
const current = newPins.map(loadPin);
const compare = (a,b) => {
  const before = collectPairs(a), after = collectPairs(b);
  const added = new Map([...after].filter(([k]) => !before.has(k)));
  const removed = new Map([...before].filter(([k]) => !after.has(k)));
  return {before,after,added,removed};
};
for (const [edition, expected] of [['enterprise',[12244,12675,439,8]],['oss',[10893,11319,434,8]]]) {
  const d = compare(old.filter(p=>p.edition===edition),current.filter(p=>p.edition===edition));
  assert.deepEqual([d.before.size,d.after.size,d.added.size,d.removed.size],expected,edition);
}
const d = compare(old,current);
assert.deepEqual([d.before.size,d.after.size,d.added.size,d.removed.size],[12246,12677,439,8]);
const priorSlots = new Set([...d.before.values()].map(r=>r.slot));
const currentSlots = new Set([...d.after.values()].map(r=>r.slot));
assert.equal([...d.added.values()].filter(r=>priorSlots.has(r.slot)).length,5);
assert.equal([...d.removed.values()].filter(r=>!currentSlots.has(r.slot)).length,3);

const draft = readJsonExact(read(candidatePath).toString('utf8'), candidatePath);
assert.equal(draft.apply,false);
assert.equal(draft.stage,49);
assert.equal(draft.candidates.length,d.added.size);
const seen = new Set();
const bindingKey = b => [b.edition,b.schemaHash,b.sourcePointer].join('\0');
const sortedBindings = bs => bs.map(bindingKey).sort();
const markers = s => [...s.matchAll(/\{\{[^{}]+\}\}|%\{[^{}]+\}|\{(?:version|algorithm|date-[^{}]+)\}|`[^`]+`|\$(?:seen|flagged|notjunk)\b/g)].map(m=>m[0]).sort();
let translations=0, keepOriginal=0, bindings=0;
for (const r of draft.candidates) {
  const key = r.slot + '\0' + r.original;
  assert.ok(!seen.has(key), r.slot);
  seen.add(key);
  const actual = d.added.get(key);
  assert.ok(actual,r.slot);
  assert.equal(r.category,actual.category);
  assert.deepEqual(sortedBindings(r.bindings),sortedBindings(actual.locations),r.slot);
  assert.equal(r.delta,priorSlots.has(r.slot)?'changed-original':'added-context');
  assert.equal(r.apply,false);
  assert.equal(r.status,'needs-review');
  assert.ok(typeof r.ru==='string'&&r.ru.trim(),r.slot);
  if (r.proposalKind==='keep-original-candidate') {
    assert.equal(r.ru,r.original,r.slot);keepOriginal++;
  } else {
    assert.equal(r.proposalKind,'translation-candidate',r.slot);
    assert.notEqual(r.ru,r.original,r.slot);translations++;
  }
  assert.deepEqual(markers(r.ru),markers(r.original),r.slot);
  bindings+=r.bindings.length;
}
assert.deepEqual([seen.size,translations,keepOriginal,bindings],[439,419,20,873]);
console.log('Stage49 preflight PASS: exact gzip/hash/JSON, 439 new or changed pairs, 8 historical removals, 873 draft bindings; no renderer or translation acceptance.');
const grammarReview=grammarReviewCandidates(d.before,d.after);
assert.deepEqual(['list-singular','list-plural','object-description-fallback'].map(kind=>grammarReview.filter(r=>r.kind===kind).length),[4,4,5]);
assert.equal(grammarReview.reduce((n,r)=>n+r.bindings.length,0),26);
assert.ok(grammarReview.find(r=>r.slot==='list/x:Account/Resource/singular'&&r.bindings.length===2));
fs.mkdirSync(path.join(root,'.artifacts/webuiRu-stage49'),{recursive:true});
fs.writeFileSync(path.join(root,'.artifacts/webuiRu-stage49/grammar-candidates.json'),JSON.stringify({grammarReview,acceptance:false},null,2)+'\n');
console.log('Stage49 grammar source queue: 13 groups / 26 bindings; consumer and grammar review required.');
export { collectPairs, current as webuiRuPins, old as historicalPins };
