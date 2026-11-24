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
import './lib/offline-guard.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const inputs = loadInputs(root);
const graph = buildUsageGraph(inputs);
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
check('Permission учитывается только в реальном EnumMultiSelect helper', () => {
  const r = row('enum/Permission/sysAccountGet/label');
  assert.ok(uses(r).some(u => u.renderer === 'EnumMultiSelect' && u.text.ru === 'Учётные записи: Просмотр'));
  assert.ok(uses(r).some(u => u.mode === 'detail' && u.text.ru === r.original));
  assert.notEqual(r.classification, 'translated');
});
check('Enum explanation действительно wired, неизвестные custom-пути не засчитаны', () => {
  const r = row('enum/EventType/acme.auth-start/explanation');
  assert.ok(uses(r).some(u => u.state === 'wired' && /EnumWidget|EnumMultiSelect/.test(u.renderer)));
  assert.ok(report.rows.some(r => uses(r).some(u => u.state === 'review')));
  assert.ok(report.rows.some(r => r.classification === 'renderer-unwired'));
  const alias = row('form/x:AiModelAnthropic/field/model');
  assert.ok(uses(alias).some(u => u.mode === 'detail' && u.state === 'slot-mismatch'));
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
const stage18Catalog = baselineCatalog(inputs.catalog,laterBatches);
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
const beforeReport18 = compactReport(plan(beforeInputs18, graph));
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
  assert.equal(report.summary.classification.translated, beforeReport18.summary.classification.translated + 58 + laterTranslations);
  assert.equal(report.summary.classification.missing, beforeReport18.summary.classification.missing - 56 - laterTranslations);
});
console.log('Stage18: applied 54 translations, two preserved standard labels, four exact scoped bindings. Static/source tests, not React/browser acceptance.');
