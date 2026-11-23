#!/usr/bin/env node
// Stalwart WebUI RU: deterministic, offline source inventory (stage16).
// Never fetches schemas, mutates server data, or edits the accepted catalogue.
// Source reachability is a static hypothesis, not a browser/ACL assertion.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { gunzipSync } from 'node:zlib';
import ts from 'typescript';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = rel => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const hex = (bytes, alg = 'sha256') => createHash(alg).update(bytes).digest('hex');
const pointer = (base, ...pieces) => '/' + [base, ...pieces].flat().map(x =>
  String(x).replace(/~/g, '~0').replace(/\//g, '~1')).join('/');
const truthyString = x => typeof x === 'string' && x.trim().length > 0;
const sortBy = (items, field) => items.sort((a, b) => String(a[field]).localeCompare(String(b[field]), 'en'));

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

const catalogFile = 'src/i18n/schema/ru.json';
const catalogRaw = read(catalogFile);
const catalog = readJsonExact(catalogRaw, catalogFile);
const accepted = catalog.entries;
const manifest = readJsonExact(read('scripts/data/pinned-schema-manifest.json'), 'schema-manifest');
assert.equal(manifest.source, catalog.meta.source);
assert.equal(manifest.schemas.length, 2);
const pins = [];
for (const item of manifest.schemas) {
  const raw = read(item.fixture).trim();
  assert.match(raw, /^[A-Za-z0-9+/]+={0,2}$/, 'Invalid fixture base64');
  const gz = Buffer.from(raw, 'base64');
  assert.equal(gz.toString('base64'), raw, 'Invalid base64 roundtrip');
  assert.equal(gz.length, item.size, 'Pinned gzip size mismatch: ' + item.file);
  assert.equal(hex(gz), item.sha256Gzip, 'Pinned SHA-256 mismatch: ' + item.file);
  const blobHeader = Buffer.from('blob ' + gz.length + '\0');
  assert.equal(hex(Buffer.concat([blobHeader, gz]), 'sha1'), item.blobSha,
    'Pinned Git blob SHA mismatch: ' + item.file);
  const schemaHash = createHash('sha256').update(gz).digest('base64url');
  assert.equal(schemaHash, item.schemaHash, 'Schema URL hash mismatch: ' + item.file);
  assert.ok(catalog.meta.schemaHashes.includes(schemaHash), 'Unknown catalog schema hash');
  assert.ok(catalog.meta.sources.some(x => x.file === item.file && x.blobSha === item.blobSha));
  const jsonBytes = gunzipSync(gz);
  const data = readJsonExact(jsonBytes.toString('utf8'), item.file);
  for (const key of ['layouts', 'objects', 'schemas', 'fields', 'forms', 'lists', 'enums']) {
    assert.ok(data[key] && typeof data[key] === 'object', 'Missing schema section: ' + key);
  }
  pins.push({ ...item, jsonSha256: hex(jsonBytes), jsonLength: jsonBytes.length, data });
}

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

// Compare contextual source slots, not raw English tokens. Conflicts are explicit.
const slotConflicts = [...duplicateSlotPairs].filter(([,values]) => values.size>1)
  .map(([slot, values]) => ({slot, originals:[...values].sort()}));
sortBy(slotConflicts,'slot');
const rows = sortBy([...occurrences.values()].map(row => {
  row.locations.sort((a,b)=> a.edition.localeCompare(b.edition) ||
    a.sourcePointer.localeCompare(b.sourcePointer));
  const entry=accepted[row.slot];
  const conflict=duplicateSlotPairs.get(row.slot).size>1;
  const status=conflict?'original-conflict':
    !entry?'missing':
    entry.original!==row.original?'changed-original':
    entry.ru===row.original?'same-text-needs-review':'translated';
  return {...row,status,translation:entry?.ru??null,
    taskKey: row.original, editionCount:new Set(row.locations.map(x=>x.edition)).size};
}), 'slot');
const orphan=Object.keys(accepted).filter(k=>!sourceCatalogKeys.has(k)).sort()
  .map(slot=>({slot,...accepted[slot]}));

const permission=readJsonExact(read('src/i18n/schema/permission_ru.json'),'permission_ru');
const permissionFixture=readJsonExact(read('scripts/data/stage11-enum-source-fixture.json'),
  'stage11-enum-source-fixture');
assert.equal(permissionFixture.schemaSource, manifest.source);
const permissionStats={enterprise:permissionFixture.permissions.length,
  oss:permissionFixture.ossPermissions.length,
  translated:Object.keys(permission.entries).length,
  mismatched:permissionFixture.permissions.filter(x=>
    !permission.entries[x.name]||permission.entries[x.name].original!==x.label).map(x=>x.name)};

// The client i18n catalogue and AST are separately inventoried; schema slots
// and UI message IDs must not be combined into a fake coverage percentage.
function flatten(node, pre='',out={}) {
  for (const [k,v] of all(node)) {
    const key=pre?pre+'.'+k:k;
    if (typeof v==='string') out[key]=v;
    else if (v&&typeof v==='object'&&!Array.isArray(v)) flatten(v,key,out);
    else throw new Error('Invalid locale value: '+key);
  }
  return out;
}
const en=flatten(readJsonExact(read('src/i18n/en.json'),'en.json'));
const ru=flatten(readJsonExact(read('src/i18n/ru.json'),'ru.json'));
const clients=sortBy(Object.entries(en).map(([id,original])=>({
  messageId:id,original,ru:ru[id]??null,
  status:ru[id]===undefined?'missing':ru[id]===original?'same-text-needs-review':'translated'
})), 'messageId');
const unknownClientKeys=Object.keys(ru).filter(k=>!(k in en)).sort();
const astReferences=[], rawJsx=[], dynamicCalls=[];
const scanned=[];
function scan(dir) {
  for (const item of fs.readdirSync(path.join(ROOT,dir),{withFileTypes:true})) {
    const rel=dir+'/'+item.name;
    if (item.isDirectory()) {scan(rel);continue;}
    if (!/\.[tj]sx?$/.test(rel)) continue;
    scanned.push(rel);
    const source=read(rel);
    const ast=ts.createSourceFile(rel,source,ts.ScriptTarget.Latest,true,
      rel.endsWith('tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS);
    function location(node) {
      const at=ast.getLineAndCharacterOfPosition(node.getStart(ast));
      return {file:rel,line:at.line+1,column:at.character+1};
    }
    function visit(node) {
      if (ts.isCallExpression(node)) {
        const expr=node.expression;
        const name=ts.isIdentifier(expr)?expr.text:
          ts.isPropertyAccessExpression(expr)?expr.name.text:null;
        if (name==='t' && node.arguments.length>0) {
          const arg=node.arguments[0],pos=location(node);
          if (ts.isStringLiteral(arg)||ts.isNoSubstitutionTemplateLiteral(arg)) {
            astReferences.push({messageId:arg.text,...pos});
          } else {
            dynamicCalls.push({kind:'i18next-dynamic',expression:arg.getText(ast).slice(0,100),...pos});
          }
        }
        if (name==='display' && node.arguments.length>0) {
          const arg=node.arguments[0];
          if (!ts.isStringLiteral(arg) && !ts.isNoSubstitutionTemplateLiteral(arg) &&
            !ts.isTemplateExpression(arg)) {
            dynamicCalls.push({kind:'schema-display-dynamic',expression:arg.getText(ast).slice(0,100),
              ...location(node)});
          }
        }
      }
      if (ts.isJsxText(node)) {
        const original=node.text.replace(/\s+/g,' ').trim();
        if (original && /[A-Za-z]{2}/.test(original)) rawJsx.push({
          original,kind:'jsx-text',...location(node)});
      }
      if (ts.isJsxAttribute(node) && node.initializer &&
        ts.isStringLiteral(node.initializer) &&
        /^(title|placeholder|aria-label|alt)$/.test(node.name.text)) {
        const original=node.initializer.text;
        if (/[A-Za-z]{2}/.test(original)) rawJsx.push({
          original,kind:'jsx-attribute-'+node.name.text,...location(node)});
      }
      ts.forEachChild(node,visit);
    }
    visit(ast);
  }
}
scan('src');
sortBy(astReferences,'file');sortBy(rawJsx,'file');sortBy(dynamicCalls,'file');
const byCategory={};
for (const row of rows) {
  const stat=byCategory[row.category]??{total:0,translated:0,missing:0,changed:0,review:0};
  stat.total++;
  if (row.status==='translated')stat.translated++;
  else if (row.status==='missing')stat.missing++;
  else if (row.status==='changed-original'||row.status==='original-conflict')stat.changed++;
  else stat.review++;
  byCategory[row.category]=stat;
}
const grouped=new Map();
for (const row of rows) {
  const x=grouped.get(row.original)??{original:row.original,slots:[],translations:new Set(),locations:0};
  x.slots.push(row.slot);x.locations+=row.locations.length;
  if (row.translation!==null)x.translations.add(row.translation);
  grouped.set(row.original,x);
}
const memory=sortBy([...grouped.values()].map(x=>({
  original:x.original,slotCount:x.slots.length,sourceLocations:x.locations,
  approvedVariants:[...x.translations].sort(),
  needsContextReview:x.translations.size>1,
  slots:x.slots.sort(),
})), 'original');
const statusCount={};
for (const row of rows)statusCount[row.status]=(statusCount[row.status]??0)+1;
const report={
  version:1,source:manifest.source,
  input:{catalogSha256:hex(Buffer.from(catalogRaw)),manifestSha256:hex(Buffer.from(read('scripts/data/pinned-schema-manifest.json'))),
    schemas:pins.map(({edition,file,blobSha,sha256Gzip,schemaHash,jsonSha256,jsonLength})=>
      ({edition,file,blobSha,sha256Gzip,schemaHash,jsonSha256,jsonLength}))},
  summary:{slots:rows.length,sourceLocations:rows.reduce((a,x)=>a+x.locations.length,0),
    uniqueEnglish:memory.length,status:statusCount,byCategory,conflicts:slotConflicts.length,
    orphanEntries:orphan.length,clientMessages:clients.length,clientUnknownKeys:unknownClientKeys.length,
    rawJsxCandidates:rawJsx.length,dynamicCallsForReview:dynamicCalls.length,
    scannedSourceFiles:scanned.length,permission:permissionStats},
  rows,slotConflicts,orphan,clients,unknownClientKeys,astReferences,rawJsx,dynamicCalls,memory,
};
const reportDir=process.argv.find(x=>x.startsWith('--out='))?.slice(6)??'.artifacts/locale-coverage';
if (!process.argv.includes('--no-write')) {
  const dir=path.resolve(ROOT,reportDir);
  assert.ok(dir===path.resolve(ROOT,'.artifacts')||dir.startsWith(path.resolve(ROOT,'.artifacts')+path.sep),
    'Only write reports inside .artifacts/');
  fs.mkdirSync(dir,{recursive:true});
  fs.writeFileSync(path.join(dir,'inventory.json'),JSON.stringify(report,null,2)+'\n');
  fs.writeFileSync(path.join(dir,'translation-memory.json'),JSON.stringify(memory,null,2)+'\n');
  const sorted=rows.filter(x=>x.status!=='translated').sort((a,b)=>a.slot.localeCompare(b.slot));
  const lines=[
    '# Offline localization coverage — pinned schemas',
    '',
    'Source: '+manifest.source,
    'Slots: '+rows.length+'; source occurrences: '+report.summary.sourceLocations+
      '; distinct English originals: '+memory.length,
    'Status: '+JSON.stringify(statusCount),
    'Orphan accepted keys: '+orphan.length+'; source conflicts: '+slotConflicts.length,
    'Client messages: '+clients.length+'; raw JSX candidates: '+rawJsx.length+
      '; dynamic-call reviews: '+dynamicCalls.length,
    '',
    '## Missing / review queue (first 250 source slots)',
    '',
    '| Slot | Status | Original | Sources |',
    '| --- | --- | --- | --- |',
    ...sorted.slice(0,250).map(row=>
      '| '+row.slot.replace(/\|/g,'\\|')+' | '+row.status+' | '+
      row.original.replace(/\|/g,'\\|').replace(/\r?\n/g,' ') .slice(0,110)+
      ' | '+[...new Set(row.locations.map(x=>x.edition))].join(',')+' |'),
    '',
    '## Scope and caveats',
    '',
    '- Static source inventory, not permission-aware reachability or browser PASS.',
    '- The JSON inventory contains all discovered rows and precise JSON pointers.',
    '- Orphan keys may be expected fallback or view aliases; review before deletion.',
    '- Permission IDs are tracked separately; never translate raw permission names.',
    '- Unknown/embedded renderers and direct JSX are review candidates, not automatic failures.',
    '- Re-running with identical pinned fixtures and source files gives identical output.',
    ''
  ];
  fs.writeFileSync(path.join(dir,'summary.md'),lines.join('\n'));
}
console.log('LOCALIZATION COVERAGE (static, offline; not browser PASS)');
console.log(JSON.stringify(report.summary,null,2));
console.log('Reports: '+(process.argv.includes('--no-write')?'no writes':reportDir));
