#!/usr/bin/env node
// Display-only dropdown regression checks. No server, network or browser is used.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const catalog = JSON.parse(fs.readFileSync('src/i18n/schema/ru.json', 'utf8'));
assert.deepEqual(
  [...catalog.meta.schemaHashes].sort(),
  ['Pryc909aTNRr_k6uwZLvZNs74YaPQv-PXQ38t2K7VlY',
   'fyG-0rY0Q0Zq2PwUyaVPqnGT0nyS7AYK5SCmreTDZXs'].sort(),
);
for (const [key, original, ru] of [
  ['nav/link/Management/CustomComponent/Dashboard', 'Dashboard', 'Центр управления'],
  ['nav/link/Management/CustomComponent/LiveTracing', 'Live Tracing', 'Трассировка'],
  ['nav/link/Management/x:Log', 'Logs', 'Журнал'],
]) {
  assert.deepEqual(catalog.entries[key], { original, ru });
}

const src = fs.readFileSync('src/i18n/schemaOptionLabels.ts', 'utf8');
const compiled = ts.transpileModule(src, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
});
const exports = {};
vm.runInNewContext(compiled.outputText, { exports, Intl, Map, Date }, { filename: 'schemaOptionLabels.ts' });

assert.equal(exports.quotaOptionLabel('Maximum number of emails'), 'Максимум писем');
assert.equal(exports.quotaOptionLabel('Maximum number of mailboxes'), 'Максимум почтовых ящиков');
assert.equal(exports.quotaOptionLabel('Unrecognized upstream quota'), 'Unrecognized upstream quota');
assert.equal(exports.headerProtectionOptionLabel('None'), 'Не защищать заголовки');
assert.equal(exports.headerProtectionOptionLabel('Protected, headers visible'), 'Защищены, заголовки видимы');
assert.equal(exports.headerProtectionOptionLabel('Protected, Subject hidden'), 'Защищены, тема скрыта');
assert.equal(exports.headerProtectionOptionLabel('Unknown protection'), 'Unknown protection');
const localeLabel = exports.localeOptionLabel('en-US', 'English locale for the USA.');
assert.match(localeLabel, /английск/i);
assert.equal(exports.localeOptionLabel('invalid-??', 'Unknown locale'), 'Unknown locale');
assert.match(exports.timeZoneOptionLabel('Asia/Tomsk', 'Asia/Tomsk'), /[А-Яа-яЁё]/);
assert.equal(exports.timeZoneOptionLabel('Not/A_Zone', 'Not/A_Zone'), 'Not/A_Zone');

const schemaText = fs.readFileSync('src/i18n/schemaText.ts', 'utf8');
const hook = fs.readFileSync('src/hooks/useSchemaText.ts', 'utf8');
assert.ok(schemaText.includes('canTranslateSchema(schemaHash, language)'));
assert.ok(hook.includes('canTranslateSchema(schemaHash, i18n.resolvedLanguage ?? i18n.language)'));

const enumSource = fs.readFileSync('src/components/forms/widgets/EnumWidgets.tsx', 'utf8');
assert.ok(enumSource.includes('useCanTranslateSchema()'));
assert.ok(enumSource.includes("formField.name === 'locale' ? localeOptionLabel(v.name, translated)"));
assert.ok(enumSource.includes("formField.name === 'headerProtection' ? headerProtectionOptionLabel(translated)"));
assert.ok(enumSource.includes('value: v.name'));
assert.ok(enumSource.includes("onChange(v === '' ? null : v)"));

const map = fs.readFileSync('src/components/forms/widgets/MapWidget.tsx', 'utf8');
assert.ok(map.includes('quotaOptionLabel(localized)'));
assert.ok(map.includes("quota={formField.name === 'quotas'}"));
assert.ok(map.includes('onValueChange={onChange}'));
assert.ok(map.includes('<SelectItem key={v.name} value={v.name}>'));
assert.ok(map.includes('[trimmedKey]: defaultMapValue('));

const zone = fs.readFileSync('src/components/forms/widgets/TimeZoneWidget.tsx', 'utf8');
assert.ok(zone.includes('timeZoneOptionLabel(v.name, v.label)'));
assert.ok(zone.includes('value: v.name'));
assert.ok(zone.includes('description: offset'));
assert.ok(zone.includes('keywords: [v.name, v.label, label'));
assert.ok(zone.includes("onChange(v === '' ? null : v)"));

console.log('Option-label source checks passed; JMAP IDs, map keys, IANA values and UTC offsets kept raw.');
