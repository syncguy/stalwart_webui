#!/usr/bin/env node
// Independent fixture expectations + mutation tests, no server or React claims.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { loadInputs, readJson, digest, json, ptr, at, sourceModule } from './lib/locale-source.mjs';
import { buildUsageGraph } from './lib/locale-graph.mjs';
import { CATEGORIES, classify, candidates, preview, textSafe, diffRows, translationMemory, semanticGroup, plan, compactReport } from './lib/locale-planner.mjs';
import {loadReviewedBatches,baselineCatalog} from './lib/locale-reviewed-batch.mjs';
import {loadFieldDescriptionPacket,undoFieldDescriptions} from './lib/locale-field-descriptions.mjs';
import {loadFormContextPacket,undoFormContext} from './lib/locale-form-context.mjs';
import {loadVariantPacket,undoVariants} from './lib/locale-variant-labels.mjs';
import './lib/offline-guard.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const inputs = loadInputs(root);
const legacyGraph = buildUsageGraph(inputs);
const stage37Graph = buildUsageGraph({ ...inputs, fieldOwners: true });
const stage38Graph = buildUsageGraph({ ...inputs, fieldOwners: true, formOwners: true });
const graph = buildUsageGraph({ ...inputs, fieldOwners: true, formOwners: true, variantBadges: true });
const report = readJson(fs.readFileSync(path.join(root, '.artifacts/locale-candidates/classification.json'), 'utf8'), 'classification');
const row = slot => report.rows.find(r => r.slot === slot);
const uses = r => r.usages.map(u => ({ ...report.usageContexts[u.context], text: report.displayTexts[u.text],
  lookupSlot: Object.hasOwn(u, 'lookupSlot') ? u.lookupSlot : r.slot }));
let cases = 0;
function check(name, fn) { fn(); cases++; console.log('PASS: ' + name); }
function classifyOne(sourceRow, overrides = {}) {
  const i = { ...inputs, ...overrides, inventory: { ...inputs.inventory, rows: [sourceRow] } };
  return { input: i, row: classify(i, graph).rows[0] };
}
const sourceRow = slot => inputs.inventory.rows.find(r => r.slot === slot);

check('Полный знаменатель и ровно семь категорий', () => {
  assert.equal(report.rows.length, 12246);
  assert.deepEqual(Object.keys(report.summary.classification), CATEGORIES);
  assert.equal(Object.values(report.summary.classification).reduce((a, b) => a + b, 0), 12246);
  assert.ok(report.rows.every(r => CATEGORIES.includes(r.classification) && r.reasons.length && r.access === 'unknown'));
  assert.ok(report.rows.every(r => r.usages.every(u => u.location >= 0 && report.usageContexts[u.context] && report.displayTexts[u.text])));
  assert.deepEqual(report.diagnostics.staleRules, []);
  assert.deepEqual(report.diagnostics.adapterDrift, []);
});
check('Domain привязан к Management, Mailbox к Account, MySQL к Settings', () => {
  assert.deepEqual(row('form/x:Domain/field/name').sections, ['Management']);
  assert.deepEqual(row('form/Mailbox/section/section-0').sections, ['Account']);
  assert.deepEqual(row('form/x:MySqlStore/section/section-3').sections, ['Settings']);
  assert.equal(row('form/x:Domain/field/name').classification, 'translated');
  for (const s of report.screens) assert.equal(CATEGORIES.reduce((n, c) => n + s[c], 0), s.slots);
  for (const s of report.screens) for (const m of s.modes) assert.equal(CATEGORIES.reduce((n, c) => n + m[c], 0), m.slots);
});
check('Оба конфликта разделены по hash и original, без last-write-wins', () => {
  assert.deepEqual(report.conflicts.map(c => c.slot).sort(), ['form/x:MySqlStore/section/section-3', 'form/x:PostgreSqlStore/section/section-3']);
  for (const c of report.conflicts) {
    assert.deepEqual(c.variants.map(v => v.original).sort(), ['Pools', 'Read Replicas']);
    for (const v of c.variants) {
      const target = v.locations[0];
      const translation = v.original === 'Pools' ? 'Пулы соединений' : 'Реплики для чтения';
      assert.equal(v.scopedBindingVerified, true);
      assert.equal(row(c.slot).sourceConflict, true);
      assert.equal(report.rows.find(r => r.slot === c.slot && r.original === v.original).classification, 'translated');
      const candidate = { selected: translation, targets: v.locations.map(l => ({schemaHash: l.schemaHash, slot: c.slot, original: v.original})) };
      assert.equal(preview(candidate, target.schemaHash, c.slot, v.original, 'ru'), candidate.selected);
      assert.equal(preview(candidate, 'unknown', c.slot, v.original, 'ru'), v.original);
      assert.equal(preview(candidate, target.schemaHash, c.slot, v.original + ' changed', 'ru'), v.original + ' changed');
      assert.equal(preview(candidate, target.schemaHash, c.slot, v.original, 'en'), v.original);
      const other = inputs.pins.find(p => p.schemaHash !== target.schemaHash);
      assert.equal(preview(candidate, other.schemaHash, c.slot, v.original, 'ru'), v.original);
      assert.equal(inputs.schema.schemaText(target.schemaHash, 'ru', c.slot, v.original), translation);
      assert.equal(inputs.schema.schemaText(other.schemaHash, 'ru', c.slot, v.original), v.original);
      assert.equal(inputs.schema.schemaText('unknown', 'ru', c.slot, v.original), v.original);
      assert.equal(inputs.schema.schemaText(target.schemaHash, 'en', c.slot, v.original), v.original);
      assert.equal(inputs.schema.schemaText(target.schemaHash, 'ru', c.slot, v.original + ' changed'), v.original + ' changed');
    }
  }
});
check('Permission: прежний helper и расширение на все wired consumers после stage29', () => {
  const slot='enum/Permission/sysAccountGet/label', r=row(slot);
  const prior=structuredClone(inputs.catalog);
  delete prior.entries[slot];
  const priorSchema=sourceModule(fs.readFileSync(path.join(root,'src/i18n/schemaText.ts'),'utf8'),'schemaText.ts',{'./schema/ru.json':prior});
  const before=classifyOne(sourceRow(slot),{catalog:prior,schema:priorSchema}).row;
  assert.ok(before.usages.some(u=>u.renderer==='EnumMultiSelect'&&u.text.ru==='Учётные записи: Просмотр'));
  assert.ok(before.usages.some(u=>u.mode==='detail'&&u.text.ru===before.original));
  assert.notEqual(before.classification,'translated');
  if(inputs.catalog.entries[slot]){
    assert.equal(r.classification,'translated');
    assert.ok(uses(r).some(u=>u.mode==='detail'&&u.text.ru==='Учётные записи: Просмотр'));
    assert.ok(uses(r).every(u=>u.state==='wired'&&u.text.ru==='Учётные записи: Просмотр'));
  }else assert.equal(r.classification,before.classification);
});
check('Enum explanation действительно wired, неизвестные custom-пути не засчитаны', () => {
  const r = row('enum/EventType/acme.auth-start/explanation');
  assert.ok(uses(r).some(u => u.state === 'wired' && /EnumWidget|EnumMultiSelect/.test(u.renderer)));
  assert.ok(report.rows.some(r => uses(r).some(u => u.state === 'review')));
  assert.ok(stage38Graph.usages.get('variant/x:Account/User/label\0User account').some(u=>u.state==='unwired'));
  assert.ok(!report.rows.some(r => r.classification === 'renderer-unwired'));
  const alias = row('form/x:AiModelAnthropic/field/model');
  assert.ok(uses(alias).some(u => u.mode === 'detail' && u.state === 'wired' && u.lookupSlot===alias.slot));
  assert.ok(stage37Graph.usages.get(alias.slot+'\0'+alias.original).some(u=>u.mode==='detail'&&u.state==='slot-mismatch'));
});
check('Технические примеры сохранены, обычные placeholders не исключаются', () => {
  assert.equal(row('form/x:MySqlStore/field/maxAllowedPacket/placeholder').classification, 'technical');
  assert.equal(row('form/x:AiModelAnthropic/field/url/placeholder').classification, 'technical');
  assert.notEqual(row('form/x:Role/field/description/placeholder').classification, 'technical');
  assert.equal(row('form/x:Domain/section/section-2').classification, 'keep-original');
  const timeZone = row('enum/TimeZone/Africa~1Abidjan/label') ?? row('enum/TimeZone/Africa/Abidjan/label');
  assert.ok(uses(timeZone).some(u => u.text.conditional));
});
check('Изменение original блокирует прежний перевод и preview', () => {
  const old = sourceRow('form/x:Domain/field/name');
  const changed = { ...old, original: 'Domain display name (new)' };
  const { input, row: r } = classifyOne(changed);
  assert.equal(r.classification, 'needs-review');
  assert.ok(r.reasons.includes('accepted-original-changed'));
  const c = candidates(input, [r]).groups[0];
  assert.equal(c.selected, null);
  const diff = diffRows({ rows: [old] }, [r]);
  assert.deepEqual(diff.added[0].previousOriginals, [old.original]);
  assert.equal(diff.removed.length, 1);
});
check('Новая схема не получает доверие автоматически', () => {
  const src = sourceRow('form/x:Domain/field/name');
  const changed = { ...src, locations: src.locations.map(l => ({ ...l, schemaHash: 'new-schema-hash' })) };
  const { input, row: r } = classifyOne(changed);
  assert.ok(r.reasons.includes('unknown-schema-hash'));
  assert.equal(candidates(input, [r]).groups[0].selected, null);
});
check('Изменение renderer требует ревью даже при прежнем каталоге', () => {
  const { row: r } = classifyOne(sourceRow('form/x:Domain/field/name'), { adapterDrift: ['src/components/forms/FieldRow.tsx'] });
  assert.equal(r.classification, 'needs-review');
  assert.ok(r.reasons.includes('renderer-source-drift'));
});
check('Новый конфликт не разрешается порядком массива', () => {
  const src = sourceRow('form/x:Domain/field/name');
  const other = { ...src, original: 'Domain alias' };
  const forward = classify({ ...inputs, inventory: { ...inputs.inventory, rows: [src, other] } }, graph).rows;
  const reverse = classify({ ...inputs, inventory: { ...inputs.inventory, rows: [other, src] } }, graph).rows;
  assert.ok(forward.every(r => r.classification === 'needs-review'));
  assert.deepEqual(forward.map(r => [r.original, r.classification]).sort(), reverse.map(r => [r.original, r.classification]).sort());
});
check('Разные принятые смыслы остаются разными вариантами TM', () => {
  const result = classify(inputs, graph).rows;
  const { memory, glossaryConflicts } = translationMemory(inputs, result);
  assert.ok(new Set(memory.get('Enabled').map(x => x.ru)).size > 1);
  assert.ok(glossaryConflicts.some(c => c.original === 'Observability' && c.preferred === 'Наблюдение'));
  assert.ok(glossaryConflicts.some(c => c.original === 'Logs' && c.preferred === 'Журнал'));
  assert.ok(!memory.get('Logs').some(x => x.source.kind === 'glossary' && x.ru === 'Журналы'));
  const x = { ...row('form/x:Domain/field/name'), category: 'form-field-label' };
  assert.notEqual(semanticGroup(x), semanticGroup({ ...x, category: 'list' }));
});
check('Контекстное исключение имеет приоритет и не распространяется глобально', () => {
  const r = { ...row('form/x:Role/field/description/placeholder'), catalogState: 'missing', classification: 'missing' };
  const override = { slot: r.slot, original: r.original, schemaHash: r.locations[0].schemaHash, ru: 'Описание роли доступа', reason: 'synthetic contextual exception' };
  const generated = candidates({ ...inputs, policy: { ...inputs.policy, contextCandidates: [override] } }, [r]).groups;
  const result = generated.find(g => g.selected === override.ru);
  assert.equal(result.suggestions[0].ru, override.ru);
  assert.equal(result.suggestions[0].rank, 0);
  assert.equal(result.apply, false);
  assert.ok(result.targets.every(t => t.schemaHash === override.schemaHash));
  assert.equal(preview(result, 'another-hash', r.slot, r.original, 'ru'), r.original);
});
check('Маркеры, ссылки, код и HTML проверяются точными мультимножествами', () => {
  assert.equal(textSafe('{{name}} {{name}}', '{{name}}'), false);
  assert.equal(textSafe('%{metric}% `key` https://example.test/a', '%{metric}% `ключ` https://example.test/a'), false);
  assert.equal(textSafe('[Help](https://example.test/a)', '[Справка](https://example.test/b)'), false);
  assert.equal(textSafe('<b class="x">Hello</b>', '<b class="y">Привет</b>'), false);
  assert.equal(textSafe('Use {{name}} and `key`', 'Используйте {{name}} и `key`'), true);
  assert.throws(() => readJson('{"x":1,"x":2}', 'duplicate'), /Повтор ключа/);
});
check('Циклы вложенных объектов завершаются; повторные ссылки сохраняются по экрану', () => {
  const data = { layouts: [{ name: 'Settings', items: [{ link: { name: 'Cycle', viewName: 'Root' } }] }],
    objects: { Root: { type: 'object', permissionPrefix: 'test' } }, schemas: { Root: { type: 'single', schemaName: 'Root' } },
    fields: { Root: { properties: { child: { type: { type: 'object', objectName: 'Root' }, description: 'Child', update: 'mutable' } } } },
    forms: { Root: { sections: [{ fields: [{ name: 'child', label: 'Child' }] }] } }, enums: {}, lists: {} };
  const row = { slot: 'form/Root/field/child', original: 'Child', locations: [{ schemaHash: 'cycle', sourcePointer: ptr('forms', 'Root', 'sections', 0, 'fields', 0, 'label') }] };
  const g = buildUsageGraph({ ...inputs, pins: [{ schemaHash: 'cycle', edition: 'synthetic', data }], inventory: { rows: [row] }, pages: [], widgets: [] });
  assert.ok(g.usages.get(row.slot + '\0Child').length > 0);
  assert.ok(g.usages.get(row.slot + '\0Child').length < 30);
});
check('Каталог, runtime и закреплённые схемы побайтно сохранены', () => {
  for (const [p, expected] of Object.entries(inputs.policy.protectedInputs)) {
    assert.equal(digest(fs.readFileSync(path.join(root, p))), expected);
  }
  assert.ok(report.candidates.every(c => !c.apply && c.reviewStatus === 'pending' && c.targets.every(t => !t.catalogWrite)));
});
check('Недопустимый путь вывода отклоняется до генерации', () => {
  assert.throws(() => execFileSync(process.execPath, ['scripts/generate-locale-candidates.mjs', '--out=src/i18n/schema'], { cwd: root, stdio: 'pipe' }));
});
check('Ссылки в каталоге вывода не позволяют перезаписать другой файл', () => {
  const tmp = fs.mkdtempSync(path.join(root, '.artifacts', 'candidate-safety-'));
  try {
    fs.writeFileSync(path.join(tmp, 'canary'), 'unchanged');
    fs.mkdirSync(path.join(tmp, 'out'));
    fs.symlinkSync(path.join(tmp, 'canary'), path.join(tmp, 'out', 'classification.json'));
    assert.throws(() => execFileSync(process.execPath, ['scripts/generate-locale-candidates.mjs', '--out=' + path.join(tmp, 'out')], { cwd: root, stdio: 'pipe' }));
    assert.equal(fs.readFileSync(path.join(tmp, 'canary'), 'utf8'), 'unchanged');
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
});
check('Offline-guard блокирует сеть до запроса', () => {
  assert.throws(() => globalThis.fetch('https://example.invalid/'), /Сетевое обращение запрещено/);
});
console.log(`Этап 17: ${cases} групп проверок PASS. Это offline/source tests, не browser PASS.`);


/* Stage18: editor-reviewed packet, validated against the regenerated Stage17 report.
 * Preview only: no runtime catalog mutation or browser/React claim. */
const packet18 = readJson(fs.readFileSync(path.join(root, 'scripts/data/stage18-address-calendar-review.json'), 'utf8'), 'stage18 packet');
const scopes18 = new Set(['x:AddressBook', 'x:Calendar']);
const laterBatches = loadReviewedBatches(root,inputs.policy);
const stage37Packet = loadFieldDescriptionPacket(root,inputs.policy);
const packet38=loadFormContextPacket(root,inputs.policy);
const packet39=loadVariantPacket(root,inputs.policy);
const stage38Catalog=undoVariants(inputs.catalog,packet39);
const stage37Catalog=undoFormContext(stage38Catalog,packet38);
const stage35Catalog = undoFieldDescriptions(stage37Catalog,stage37Packet);
const stage18Catalog = baselineCatalog(stage35Catalog,laterBatches);
const laterTranslations = laterBatches.reduce((n,p)=>n+p.entries.length,0);
const baselineCatalog18 = structuredClone(stage18Catalog);
for (const e of packet18.entries) if (e.decision === 'translate') delete baselineCatalog18.entries[e.slot];
delete baselineCatalog18.scopedEntries;
baselineCatalog18.entries = Object.fromEntries(Object.entries(baselineCatalog18.entries).sort(([a], [b]) => a.localeCompare(b, 'en')));
assert.equal(digest(json(baselineCatalog18)), '16504147e66a6bf66452522b441f5767eeb8f79f899302a96b52de04941b58db', 'Stage17 catalog changed beyond reviewed additions');
const baselinePolicy18 = structuredClone(inputs.policy);
baselinePolicy18.keepOriginal = baselinePolicy18.keepOriginal.filter(r => !packet18.entries.some(e =>
  e.decision === 'keep-original' && e.slot === r.slot && e.original === r.original));
const rawRuntime18 = fs.readFileSync(path.join(root, 'src/i18n/schemaText.ts'), 'utf8');
const beforeInputs18 = { ...inputs, catalog: baselineCatalog18, policy: baselinePolicy18,
  schema: sourceModule(rawRuntime18, 'schemaText.ts', { './schema/ru.json': { ...baselineCatalog18, scopedEntries: [] } }) };
const beforeReport18 = compactReport(plan(beforeInputs18, legacyGraph));
const stage35Inputs={...inputs,catalog:stage35Catalog,schema:sourceModule(rawRuntime18,'schemaText.ts',{'./schema/ru.json':stage35Catalog})};
const legacyRows=classify(stage35Inputs,legacyGraph).rows;
const stage37Inputs={...inputs,catalog:stage37Catalog,schema:sourceModule(rawRuntime18,'schemaText.ts',{'./schema/ru.json':stage37Catalog})};
const stage37Rows=classify(stage37Inputs,stage37Graph).rows;
const stage38Inputs={...inputs,catalog:stage38Catalog,schema:sourceModule(rawRuntime18,'schemaText.ts',{'./schema/ru.json':stage38Catalog})};
const stage38Rows=classify(stage38Inputs,stage38Graph).rows;
const stage37ById=new Map(stage37Rows.map(r=>[r.id,r]));
const legacyCount=c=>legacyRows.filter(r=>r.classification===c).length;
const missing18 = beforeReport18.rows.filter(r => r.classification === 'missing' &&
  r.usages.some(u => {
    const c = beforeReport18.usageContexts[u.context];
    return c.section === 'Settings' && scopes18.has(c.screen);
  }));
function validatePacket18(packet) {
  assert.equal(packet.version, 1);
  assert.equal(packet.stage, 18);
  assert.equal(packet.baseline, 'a441d9bafd2af9cdc2fa17aadc9ad4f8506e3d91');
  assert.equal(packet.status, 'editor-reviewed-preview');
  assert.equal(packet.apply, false);
  assert.deepEqual(packet.scope, { section: 'Settings', screens: [...scopes18] });
  const keys = new Set();
  for (const e of packet.entries) {
    assert.ok(!keys.has(e.slot), 'Duplicate packet slot: ' + e.slot);
    keys.add(e.slot);
    const rs = beforeReport18.rows.filter(r => r.slot === e.slot);
    assert.equal(rs.length, 1);
    const r = rs[0];
    assert.ok(missing18.includes(r), 'Outside reviewed wired-missing scope: ' + e.slot);
    assert.equal(r.original, e.original);
    assert.equal(r.catalogState, 'missing');
    assert.ok(!Object.hasOwn(baselineCatalog18.entries, e.slot));
    assert.ok(r.renderer.wired > 0 && r.renderer.unwired === 0 && r.renderer.review === 0);
    assert.ok(r.usages.every(u => {
      const c = beforeReport18.usageContexts[u.context];
      return c.state === 'wired' && c.section === 'Settings' && scopes18.has(c.screen) &&
        (u.lookupSlot ?? r.slot) === r.slot;
    }));
    const gs = beforeReport18.candidates.filter(g => g.rowIds.includes(r.id));
    assert.equal(gs.length, 1);
    assert.ok(!gs[0].ambiguous && gs[0].reviewStatus === 'pending' && !gs[0].apply);
    for (const l of r.locations) {
      const pin = inputs.pins.find(p => p.schemaHash === l.schemaHash);
      assert.ok(pin && at(pin.data, l.sourcePointer) === e.original);
      assert.ok(gs[0].targets.some(t => t.schemaHash === l.schemaHash && t.slot === e.slot &&
        t.original === e.original && t.sourcePointer === l.sourcePointer && !t.catalogWrite));
    }
    assert.ok(textSafe(e.original, e.ru));
    assert.equal(e.decision, e.ru === e.original ? 'keep-original' : 'translate');
    const active = report.rows.find(x => x.slot === e.slot && x.original === e.original);
    if (e.decision === 'keep-original') {
      assert.ok(['enum/VCardVersion/v3/label', 'enum/VCardVersion/v4/label'].includes(e.slot));
      assert.equal(active.classification, 'keep-original');
      assert.ok(!Object.hasOwn(inputs.catalog.entries, e.slot));
    } else {
      assert.ok(/[А-Яа-яЁё]/u.test(e.ru) && e.ru.trim() === e.ru && e.ru.length > 0);
      assert.deepEqual(inputs.catalog.entries[e.slot], { original: e.original, ru: e.ru });
      assert.equal(active.classification, 'translated');
    }
  }
  assert.deepEqual([...keys].sort(), missing18.map(r => r.slot).sort());
}
check('Stage18: applied exact 54 translations, two keep-original decisions, unchanged original 2030 entries', () => {
  assert.equal(missing18.length, 56);
  assert.equal(packet18.entries.filter(e => e.decision === 'translate').length, 54);
  assert.equal(packet18.entries.filter(e => e.decision === 'keep-original').length, 2);
  assert.equal(Object.keys(stage18Catalog.entries).length, 2084);
  validatePacket18(packet18);
});
check('Stage18: actual schemaText RU/EN, unknown hash and changed original', () => {
  const lookup = inputs.schema.schemaText;
  for (const e of packet18.entries) {
    const r = missing18.find(r => r.slot === e.slot);
    for (const l of r.locations) {
      assert.equal(lookup(l.schemaHash, 'ru', e.slot, e.original), e.ru);
      assert.equal(lookup(l.schemaHash, 'en', e.slot, e.original), e.original);
      assert.equal(lookup(l.schemaHash, 'ru', e.slot, e.original + ' changed'), e.original + ' changed');
      assert.equal(beforeInputs18.schema.schemaText(l.schemaHash, 'ru', e.slot, e.original), e.original);
    }
    assert.equal(lookup('unknown-schema', 'ru', e.slot, e.original), e.original);
    assert.equal(lookup(null, 'ru', e.slot, e.original), e.original);
  }
});
check('Stage18: reject changed original, duplicate, missing entry, scope escape and activation flag', () => {
  for (const mutate of [
    p => { p.entries[0].original += ' changed'; },
    p => { p.entries.push(p.entries[0]); },
    p => { p.entries.pop(); },
    p => { p.entries[0].slot = 'form/x:Domain/field/name'; },
    p => { p.apply = true; },
    p => { p.entries[2].ru += ' {{unexpected}}'; },
  ]) {
    const p = structuredClone(packet18);
    mutate(p);
    assert.throws(() => validatePacket18(p));
  }
});
check('Stage18: exact four reviewed scoped entries; no shared fallback or unexpected variants', () => {
  assert.equal(inputs.catalog.scopedEntries.length, 4);
  assert.deepEqual(inputs.catalog.scopedEntries, inputs.policy.contextCandidates.map(({schemaHash, slot, original, ru}) =>
    ({schemaHash, slot, original, ru})));
  assert.equal(new Set(inputs.catalog.scopedEntries.map(e => JSON.stringify([e.schemaHash,e.slot,e.original]))).size, 4);
  for (const e of inputs.catalog.scopedEntries) {
    const r = report.rows.find(r => r.slot === e.slot && r.original === e.original);
    assert.ok(r && r.scopedBindingVerified && r.classification === 'translated');
    assert.ok(!Object.hasOwn(inputs.catalog.entries,e.slot));
    assert.ok(r.locations.every(l => l.schemaHash === e.schemaHash &&
      at(inputs.pins.find(p => p.schemaHash === l.schemaHash).data,l.sourcePointer) === e.original));
  }
  assert.equal(beforeReport18.conflicts.length, 2);
  assert.ok(beforeReport18.conflicts.every(c => c.variants.every(v => !v.scopedBindingVerified)));
  assert.equal(legacyCount('translated'), beforeReport18.summary.classification.translated + 58 + laterTranslations);
  assert.equal(legacyCount('missing'), beforeReport18.summary.classification.missing - 56 - laterTranslations);
});
console.log('Stage18: applied 54 translations, two preserved standard labels, four exact scoped bindings. Static/source tests, not React/browser acceptance.');

check('Stage37: exact historical scope, all canonical description paths and no translation regression', () => {
  assert.equal(report.stage,39);
  assert.equal(legacyCount('translated'),6418);
  assert.equal(legacyCount('missing'),0);
  assert.equal(legacyCount('renderer-unwired'),2364);
  const old=legacyRows.filter(r=>r.classification==='renderer-unwired'&&r.slot.startsWith('field/')&&r.slot.endsWith('/description'));
  assert.equal(old.length,978);
  assert.equal(old.filter(r=>r.catalogState==='missing').length,947);
  assert.deepEqual(old.filter(r=>r.catalogState==='missing').map(r=>r.slot).sort(),[...stage37Packet.slots].sort());
  const active=new Map(report.rows.map(r=>[r.id,r]));
  let mismatches=0;
  const screens=new Set();
  for(const prior of old){
    const current=active.get(prior.id);
    assert.equal(current.classification,'translated',prior.slot);
    for(const u of prior.usages.filter(u=>u.state==='slot-mismatch')){
      mismatches++;screens.add(u.section+'\0'+u.screen);
    }
    for(const u of uses(current)){
      assert.equal(u.state,'wired',prior.slot);
      assert.equal(u.lookupSlot,current.slot,prior.slot);
      assert.equal(u.text.ru,current.acceptedTranslation,prior.slot);
    }
    for(const l of current.locations){
      assert.equal(at(inputs.pins.find(p=>p.schemaHash===l.schemaHash).data,l.sourcePointer),current.original);
      const lookup=inputs.schema.schemaText;
      assert.equal(lookup(l.schemaHash,'ru',current.slot,current.original),current.acceptedTranslation);
      assert.equal(lookup(l.schemaHash,'en',current.slot,current.original),current.original);
      assert.equal(lookup(l.schemaHash,'ru',current.slot,current.original+' changed'),current.original+' changed');
      assert.equal(lookup('unknown','ru',current.slot,current.original),current.original);
    }
  }
  assert.equal(mismatches,2336);
  assert.equal(screens.size,38);
  for(const prior of legacyRows){
    const current=active.get(prior.id);
    if(prior.classification==='translated')assert.equal(current.classification,'translated','Prior translation regressed: '+prior.slot);
    if(!prior.slot.startsWith('field/')||!prior.slot.endsWith('/description'))
      assert.equal(stage37ById.get(prior.id).classification,prior.classification,'Historical unrelated classification changed: '+prior.slot);
  }
  for(const mutate of [p=>p.slots.pop(),p=>p.slots.push(p.slots[0]),p=>p.translations[0]+=' {{unexpected}}',p=>p.apply=true]){
    const p=structuredClone(stage37Packet);mutate(p);assert.throws(()=>undoFieldDescriptions(stage37Catalog,p));
  }
  const tampered=structuredClone(stage37Catalog);
  tampered.entries[Object.keys(stage35Catalog.entries)[0]].ru+=' changed';
  assert.throws(()=>undoFieldDescriptions(tampered,stage37Packet));
  console.log('Stage37 exact scope: '+old.length+' descriptions; '+mismatches+' historical mismatched usages; '+screens.size+' affected screens; 947 new catalog entries, 31 previous entries reconnected.');
});

check('Stage38: exact form-owner scope; previous catalog and classifications preserved',()=>{
  const scope=stage37Rows.filter(r=>r.classification==='renderer-unwired'&&['form-field-label','form-section','form'].includes(r.category));
  assert.equal(scope.length,1251);
  const pairDigest=rows=>digest(rows.map(r=>r.slot+'\0'+r.original+'\n').sort().join(''));
  assert.equal(pairDigest(scope),packet38.scopePairSha256);
  const missing=scope.filter(r=>r.catalogState==='missing');
  assert.equal(missing.length,841);
  assert.equal(pairDigest(missing),packet38.pairSha256);
  assert.deepEqual(missing.map(r=>r.slot).sort(),packet38.entries.map(e=>e.slot).sort());
  const target=new Set(scope.map(r=>r.id)),active=new Map(stage38Rows.map(r=>[r.id,r]));
  const screens=new Set();let mismatches=0;
  for(const prior of stage37Rows){
    const now=active.get(prior.id);
    assert.equal(now.classification,target.has(prior.id)?'translated':prior.classification,prior.slot);
    if(!target.has(prior.id))continue;
    for(const u of prior.usages.filter(u=>u.state==='slot-mismatch')){
      mismatches++;screens.add(u.section+'\0'+u.screen);
    }
    for(const u of now.usages){
      assert.equal(u.state,'wired',now.slot);
      assert.equal(u.lookupSlot,now.slot,now.slot);
      assert.equal(u.text.ru,now.acceptedTranslation,now.slot);
    }
    for(const l of now.locations){
      const pin=inputs.pins.find(p=>p.schemaHash===l.schemaHash);
      assert.equal(at(pin.data,l.sourcePointer),now.original,now.slot);
      const lookup=inputs.schema.schemaText;
      assert.equal(lookup(l.schemaHash,'ru',now.slot,now.original),now.acceptedTranslation);
      assert.equal(lookup(l.schemaHash,'en',now.slot,now.original),now.original);
      assert.equal(lookup(l.schemaHash,'ru',now.slot,now.original+' changed'),now.original+' changed');
      assert.equal(lookup('unknown','ru',now.slot,now.original),now.original);
    }
  }
  assert.equal(mismatches,3138);assert.equal(screens.size,33);
  assert.equal(stage38Rows.filter(r=>r.classification==='translated').length,8647);
  assert.equal(stage38Rows.filter(r=>r.classification==='renderer-unwired').length,135);
  assert.equal(stage38Rows.filter(r=>r.classification==='missing').length,0);
  for(const mutate of [p=>p.entries.pop(),p=>p.entries.push(p.entries[0]),p=>p.entries[0].ru+=' {{unexpected}}',p=>p.apply=true]){
    const p=structuredClone(packet38);mutate(p);assert.throws(()=>undoFormContext(stage38Catalog,p));
  }
  const tampered=structuredClone(stage38Catalog);
  tampered.entries[Object.keys(stage37Catalog.entries)[0]].ru+=' changed';
  assert.throws(()=>undoFormContext(tampered,packet38));
  console.log('Stage38: 1251 form captions; 841 new entries, 410 reconnected, 3138 historical mismatch usages on 33 screens; 135 variant rows remain.');
});

check('Stage39: exact remaining variant scope; all prior classifications and bindings retained',()=>{
  const scope=stage38Rows.filter(r=>r.classification==='renderer-unwired');
  assert.equal(scope.length,135);
  assert.ok(scope.every(r=>r.category==='variant'));
  const pairDigest=rows=>digest(rows.map(r=>r.slot+'\0'+r.original+'\n').sort().join(''));
  assert.equal(pairDigest(scope),packet39.scopePairSha256);
  const missing=scope.filter(r=>r.catalogState==='missing');
  const existing=scope.filter(r=>r.catalogState==='translated');
  assert.equal(missing.length,131);assert.equal(existing.length,4);
  assert.equal(pairDigest(missing),packet39.pairSha256);
  assert.deepEqual(missing.map(r=>r.slot).sort(),packet39.entries.map(e=>e.slot).sort());
  assert.deepEqual(existing.map(r=>r.slot).sort(),packet39.existing.map(e=>e.slot).sort());
  const target=new Set(scope.map(r=>r.id)),active=new Map(report.rows.map(r=>[r.id,r]));
  let rawBadges=0,allUses=0;const screens=new Set();
  for(const prior of stage38Rows){
    const now=active.get(prior.id);
    assert.equal(now.classification,target.has(prior.id)?'translated':prior.classification,prior.slot);
    if(prior.acceptedTranslation!==null)assert.equal(now.acceptedTranslation,prior.acceptedTranslation,prior.slot);
    if(!target.has(prior.id))continue;
    for(const u of prior.usages.filter(u=>u.state==='unwired')){
      assert.equal(u.mode,'detail');assert.equal(u.lookupSlot,null);
      rawBadges++;screens.add(u.section+'\0'+u.screen);
    }
    for(const u of uses(now)){
      assert.equal(u.state,'wired',now.slot);
      assert.equal(u.lookupSlot,now.slot,now.slot);
      assert.equal(u.text.ru,now.acceptedTranslation,now.slot);
      allUses++;
    }
    for(const l of now.locations){
      assert.equal(at(inputs.pins.find(p=>p.schemaHash===l.schemaHash).data,l.sourcePointer),now.original,now.slot);
      const lookup=inputs.schema.schemaText;
      assert.equal(lookup(l.schemaHash,'ru',now.slot,now.original),now.acceptedTranslation);
      assert.equal(lookup(l.schemaHash,'en',now.slot,now.original),now.original);
      assert.equal(lookup(l.schemaHash,'ru',now.slot,now.original+' changed'),now.original+' changed');
      assert.equal(lookup('unknown','ru',now.slot,now.original),now.original);
    }
  }
  assert.equal(rawBadges,296);assert.equal(screens.size,14);assert.equal(allUses,1169);
  assert.equal(report.screens.length,153);
  assert.deepEqual(report.summary.classification,{'translated':8782,'missing':0,'keep-original':58,'technical':74,'renderer-unwired':0,'unreachable/conditional':812,'needs-review':2520});
  assert.equal(report.summary.acceptedCatalogEntries,8855);
  assert.equal(report.summary.acceptedScopedEntries,4);
  for(const mutate of [p=>p.entries.pop(),p=>p.entries.push(p.entries[0]),p=>p.entries[0].ru+=' {{unexpected}}',p=>p.existing.pop(),p=>p.apply=true]){
    const p=structuredClone(packet39);mutate(p);assert.throws(()=>undoVariants(inputs.catalog,p));
  }
  const tampered=structuredClone(inputs.catalog);
  tampered.entries[Object.keys(stage38Catalog.entries)[0]].ru+=' changed';
  assert.throws(()=>undoVariants(tampered,packet39));
  console.log('Stage39: 135 exact variant pairs; 131 new entries, four existing; 296 raw detail badges, 14 screens, 1169 usages; no other classifications changed.');
});
