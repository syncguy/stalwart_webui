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
const restOfObservedQuotas = [
  ['Maximum number of contact cards', 'Максимум карточек контактов'],
  ['Maximum number of files', 'Максимум файлов'],
  ['Maximum number of folders', 'Максимум папок'],
  ['Maximum number of masked email addresses', 'Максимум маскированных почтовых адресов'],
  ['Maximum number of app passwords', 'Максимум паролей приложений'],
  ['Maximum number of API keys', 'Максимум API-ключей'],
  ['Maximum number of public keys', 'Максимум открытых ключей'],
  ['Maximum disk space allocated (bytes)', 'Максимальное выделенное место на диске (байты)'],
  ['Maximum number of passkeys', 'Максимум ключей доступа'],
];
for (const [original, expected] of restOfObservedQuotas) {
  assert.equal(exports.quotaOptionLabel(original), expected);
}

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
// Locale now uses the same pinned lookup as ordinary enum values.
assert.ok(enumSource.includes('const translated = display(`enum/${type.enumName}/${v.name}/label`, v.label)'));
assert.ok(!enumSource.includes('localeOptionLabel'));
assert.ok(enumSource.includes("formField.name === 'headerProtection'"));
assert.ok(enumSource.includes("label = headerProtectionOptionLabel(translated)"));
assert.ok(enumSource.includes('value: v.name'));
assert.ok(enumSource.includes("onChange(v === '' ? null : v)"));

const map = fs.readFileSync('src/components/forms/widgets/MapWidget.tsx', 'utf8');
assert.ok(map.includes('quotaOptionLabel(localized)'));
assert.ok(map.includes("quota={formField.name === 'quotas'}"));
assert.ok(map.includes('onValueChange={onChange}'));
assert.ok(map.includes('<SelectItem key={v.name} value={v.name}>'));
assert.ok(map.includes('[trimmedKey]: defaultMapValue('));

const zone = fs.readFileSync('src/components/forms/widgets/TimeZoneWidget.tsx', 'utf8');
assert.ok(zone.includes('display(`enum/${type.enumName}/${v.name}/label`, v.label)'));
assert.ok(!zone.includes('timeZoneOptionLabel'));
const zoneValue = fs.readFileSync('src/components/values/TimeZoneValue.tsx', 'utf8');
assert.ok(zoneValue.includes('display(`enum/${type.enumName}/${name}/label`, entry.label)'));
assert.ok(zone.includes('value: v.name'));
assert.ok(zone.includes('description: offset'));
assert.ok(zone.includes('keywords: [v.name, v.label, label'));
assert.ok(zone.includes("onChange(v === '' ? null : v)"));


// Stage10: test the actual deterministic search function used by Combobox.
// Match Russian display text as well as English/BCP 47 and IANA IDs.
// Filtering must not change selected values or mutate the supplied options.
const searchSource = fs.readFileSync('src/components/ui/comboboxSearch.ts', 'utf8');
const searchCompiled = ts.transpileModule(searchSource, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
});
const searchExports = {};
vm.runInNewContext(searchCompiled.outputText, { exports: searchExports }, { filename: 'comboboxSearch.ts' });
const { filterComboboxOptions, normalizeComboboxSearch } = searchExports;
assert.equal(normalizeComboboxSearch('  РУССКИЙ   (РОССИЯ)  '), 'русский россия');
assert.equal(normalizeComboboxSearch('Семён'), 'семен');
const localeOptions = [
  { value: 'en_US', label: exports.localeOptionLabel('en_US', 'English locale for the USA.'),
    keywords: ['en_US', 'English locale for the USA.'] },
  { value: 'ru_RU', label: exports.localeOptionLabel('ru_RU', 'Russian locale for Russia.'),
    keywords: ['ru_RU', 'Russian locale for Russia.'] },
  { value: 'af_DJ', label: exports.localeOptionLabel('af_DJ', 'Afar language locale for Djibouti.'),
    keywords: ['af_DJ', 'Afar language locale for Djibouti.'] },
];
const labelsBefore = localeOptions.map((x) => [x.value, x.label]);
assert.equal(filterComboboxOptions(localeOptions, 'русск')[0]?.value, 'ru_RU');
assert.equal(filterComboboxOptions(localeOptions, 'росси')[0]?.value, 'ru_RU');
assert.equal(filterComboboxOptions(localeOptions, 'Russian')[0]?.value, 'ru_RU');
assert.equal(filterComboboxOptions(localeOptions, 'ru_RU')[0]?.value, 'ru_RU');
assert.equal(filterComboboxOptions(localeOptions, 'английск')[0]?.value, 'en_US');
assert.equal(filterComboboxOptions(localeOptions, 'en_US')[0]?.value, 'en_US');
assert.equal(filterComboboxOptions(localeOptions, 'gibberish').length, 0);
assert.deepEqual(localeOptions.map((x) => [x.value, x.label]), labelsBefore);
const timeZoneOptions = [
  { value: 'Asia/Tomsk', label: exports.timeZoneOptionLabel('Asia/Tomsk', 'Asia/Tomsk'),
    keywords: ['Asia/Tomsk'] },
  { value: 'Asia/Tokyo', label: exports.timeZoneOptionLabel('Asia/Tokyo', 'Asia/Tokyo'),
    keywords: ['Asia/Tokyo'] },
];
// CLDR may use a regional Russian name that does not literally contain "Томск".
assert.equal(filterComboboxOptions(timeZoneOptions, timeZoneOptions[0].label)[0]?.value, 'Asia/Tomsk');
assert.equal(filterComboboxOptions(timeZoneOptions, 'Tomsk')[0]?.value, 'Asia/Tomsk');
assert.equal(filterComboboxOptions(timeZoneOptions, 'Asia/Tomsk')[0]?.value, 'Asia/Tomsk');
assert.deepEqual(Array.from(filterComboboxOptions(timeZoneOptions, ''), (x) => x.value),
  ['Asia/Tomsk', 'Asia/Tokyo']);
const comboboxSource = fs.readFileSync('src/components/ui/combobox.tsx', 'utf8');
assert.ok(comboboxSource.includes('filterComboboxOptions(options, query)'));
assert.ok(comboboxSource.includes('<Command shouldFilter={false}>'));
assert.ok(comboboxSource.includes('onValueChange={setQuery}'));
assert.ok(comboboxSource.includes('visibleOptions.map((option)'));
assert.ok(comboboxSource.includes('onValueChange(option.value)'));
assert.ok(comboboxSource.includes('if (!next) setQuery('));

console.log('Option-label source checks passed; JMAP IDs, map keys, IANA values and UTC offsets kept raw.');
