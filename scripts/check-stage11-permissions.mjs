#!/usr/bin/env node
// Stage11: independently compare translations with two pinned server schema enumerations.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const fixture = JSON.parse(fs.readFileSync('scripts/data/stage11-enum-source-fixture.json', 'utf8'));
const permissionCatalog = JSON.parse(fs.readFileSync('src/i18n/schema/permission_ru.json', 'utf8'));
const schemaCatalog = JSON.parse(fs.readFileSync('src/i18n/schema/ru.json', 'utf8'));
const en = JSON.parse(fs.readFileSync('src/i18n/en.json', 'utf8'));
const ru = JSON.parse(fs.readFileSync('src/i18n/ru.json', 'utf8'));

assert.equal(fixture.schemaSource, schemaCatalog.meta.source);
assert.equal(fixture.enterpriseBlobSha, schemaCatalog.meta.sources.find(x => x.file === 'schema.json.gz').blobSha);
assert.equal(fixture.ossBlobSha, schemaCatalog.meta.sources.find(x => x.file === 'schema_oss.json.gz').blobSha);
assert.equal(permissionCatalog.meta.source, fixture.schemaSource);
assert.equal(permissionCatalog.meta.enterpriseBlobSha, fixture.enterpriseBlobSha);
assert.equal(permissionCatalog.meta.ossBlobSha, fixture.ossBlobSha);
assert.equal(fixture.permissions.length, 667);
assert.equal(fixture.ossPermissions.length, 630);
assert.equal(Object.keys(permissionCatalog.entries).length, fixture.permissions.length);

const source = fs.readFileSync('src/i18n/schemaPermissionText.ts', 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
});
const exports = {};
vm.runInNewContext(compiled.outputText, {
  exports,
  require: name => {
    assert.equal(name, './schema/permission_ru.json');
    return permissionCatalog;
  },
}, { filename: 'schemaPermissionText.ts' });
const { permissionDisplayLabel } = exports;
assert.equal(typeof permissionDisplayLabel, 'function');

for (const { name, label } of fixture.permissions) {
  const entry = permissionCatalog.entries[name];
  assert.ok(entry, 'Missing permission translation for ' + name);
  assert.equal(entry.original, label, 'Pinned English source mismatch for ' + name);
  assert.ok(entry.ru.trim() && entry.ru !== label, 'Missing RU translation for ' + name);
  assert.equal(permissionDisplayLabel(name, label), entry.ru, 'Display translation mismatch for ' + name);
  assert.equal(permissionDisplayLabel(name, label + ' changed'), label + ' changed', 'Original guard failed for ' + name);
}
for (const { name, label } of fixture.ossPermissions) {
  assert.equal(permissionCatalog.entries[name]?.original, label, 'OSS Permission variant changed: ' + name);
}
assert.equal(permissionDisplayLabel('newPermissionNotInPinnedSource', 'Unknown permission'), 'Unknown permission');

for (const [name, original, translated] of [
  ['authenticate', 'Sign in to the server', 'Вход на сервер'],
  ['authenticateWithAlias', 'Sign in using email alias addresses', 'Вход с использованием почтовых псевдонимов'],
  ['interactAi', 'Interact with AI models', 'Взаимодействие с моделями ИИ'],
  ['impersonate', 'Act on behalf of another user', 'Действия от имени другого пользователя'],
  ['unlimitedRequests', 'Bypass request rate limits', 'Обход ограничений частоты запросов'],
  ['unlimitedUploads', 'Bypass upload size and rate limits', 'Обход ограничений размера и скорости загрузки'],
]) {
  assert.equal(permissionCatalog.entries[name].original, original);
  assert.equal(permissionDisplayLabel(name, original), translated);
}

const optionSource = fs.readFileSync('src/i18n/schemaOptionLabels.ts', 'utf8');
const optionCompiled = ts.transpileModule(optionSource, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
});
const optionExports = {};
vm.runInNewContext(optionCompiled.outputText, { exports: optionExports, Intl, Map, Date }, { filename: 'schemaOptionLabels.ts' });
assert.equal(fixture.tenantStorageQuota.length, 11);
assert.equal(fixture.storageQuota.length, 20);
for (const { label } of [...fixture.tenantStorageQuota, ...fixture.storageQuota]) {
  const translated = optionExports.quotaOptionLabel(label);
  assert.notEqual(translated, label, 'Untranslated pinned quota: ' + label);
}
assert.equal(optionExports.quotaOptionLabel('New upstream quota'), 'New upstream quota');

assert.equal(en.field.selectOptions, 'Select options...');
assert.equal(ru.field.selectOptions, 'Выбрать значения...');
assert.equal(en.webuiRu.field.selectPermissions, 'Select permissions...');
assert.equal(ru.webuiRu.field.selectPermissions, 'Выбрать права...');

const enumSource = fs.readFileSync('src/components/forms/widgets/EnumWidgets.tsx', 'utf8');
assert.ok(enumSource.includes('useCanTranslateSchema()'));
assert.ok(enumSource.includes("enumName === 'Permission' && canTranslate ? permissionDisplayLabel(v.name, localized) : localized"));
assert.ok(enumSource.includes("enumName === 'Permission'"));
assert.ok(enumSource.includes("t('webuiRu.field.selectPermissions', 'Select permissions...')"));
assert.ok(enumSource.includes("t('field.selectOptions', 'Select options...')"));
assert.ok(enumSource.includes('filterComboboxOptions('));
assert.ok(enumSource.includes('keywords: [v.label, v.name]'));
assert.ok(enumSource.includes('onChange([...items, name])'));
assert.ok(enumSource.includes('onChange(items.filter((i) => i !== name))'));
assert.ok(enumSource.includes('hasPermission(v.name)'));
const map = fs.readFileSync('src/components/forms/widgets/MapWidget.tsx', 'utf8');
assert.ok(map.includes("quota={formField.name === 'quotas'}"));
assert.ok(map.includes('quotaOptionLabel(localized)'));
assert.ok(map.includes('[trimmedKey]: defaultMapValue('));
assert.ok(map.includes('<SelectItem key={v.name} value={v.name}>'));

console.log('Stage11 PASS: 667 Enterprise / 630 OSS permission labels, 11 tenant / 20 account quotas; EN fallback and raw IDs preserved.');
