#!/usr/bin/env node
// Focused, dependency-locked test of the actual schemaText.ts module.
// Does not fetch a server schema, run a browser, or access the network.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
// Execute source-path regression guard together with the pinned schema checks.
import './check-renderer-display-paths.mjs';
import {loadReviewedBatches} from './lib/locale-reviewed-batch.mjs';
import {loadFormContextPacket,undoFormContext} from './lib/locale-form-context.mjs';
import {loadVariantPacket,undoVariants} from './lib/locale-variant-labels.mjs';
import {loadTracePacket,undoTrace} from './lib/locale-trace-labels.mjs';
import {loadRegionalPacket,undoRegional} from './lib/locale-regional-labels.mjs';
import {loadSpecializedPacket,undoSpecialized} from './lib/locale-specialized-labels.mjs';
import {loadFieldDescriptionPacket,undoFieldDescriptions} from './lib/locale-field-descriptions.mjs';

const catalog = JSON.parse(fs.readFileSync('src/i18n/schema/ru.json', 'utf8'));
const { entries, meta } = catalog;
assert.match(meta.source, /^syncguy\/stalwart@win2008r2:[a-f0-9]{40}$/);
assert.deepEqual(
  [...meta.schemaHashes].sort(),
  [
    'Pryc909aTNRr_k6uwZLvZNs74YaPQv-PXQ38t2K7VlY',
    'fyG-0rY0Q0Zq2PwUyaVPqnGT0nyS7AYK5SCmreTDZXs',
  ].sort(),
);
assert.ok(Object.keys(entries).length >= 1300, 'Schema display catalog unexpectedly lost translated contexts');
assert.deepEqual(
  meta.sources,
  [
    { file: 'schema_oss.json.gz', blobSha: '3d41ba6b3126648b1c1603b32ad26d60111f4420' },
    { file: 'schema.json.gz', blobSha: 'a7224968446b0935b245a22ce832e9ad2a6fb49a' },
  ],
);

for (const [slot, value] of Object.entries(entries)) {
  assert.ok(slot.includes('/') && typeof value.original === 'string' && value.original.length);
  assert.ok(typeof value.ru === 'string' && value.ru.length);
  for (const match of value.original.matchAll(/{{[^{}]+}}|%\{[^{}]+}|\{(?:version|algorithm|date-[^{}]+)}/g)) {
    assert.ok(value.ru.includes(match[0]), `Missing placeholder in ${slot}: ${match[0]}`);
  }
}

// Verify against selected literal slots from the two source-verified built-in server schemas.
const sample = {
  'layout/Management': 'Management',
  'nav/container/Management/Domains': 'Domains',
  'nav/link/Management/x:Domain': 'Domains',
  'list/x:Domain/title': 'Domains',
  'list/x:Domain/subtitle': 'Manage email domains and their DNS, DKIM, and TLS certificate settings',
  'list/x:Domain/column/name': 'Domain Name',
  'list/x:Domain/filter/text': 'Text',
  'form/x:Domain/section/section-0': 'Domain',
  'form/x:Domain/section/section-1': 'Email',
  'form/x:Domain/field/name': 'Domain Name',
  'form/x:Domain/field/aliases': 'Aliases',
  'form/x:Domain/field/enable': 'Enabled',
  'field/x:Domain/name/description': 'Domain name',
  'nav/link/Management/x:Account/User': 'Accounts',
  'nav/link/Settings/x:NetworkListener': 'Listeners',
  'nav/container/Management/Directory': 'Directory',
  'list/x:Account/User/title': 'Accounts',
  'list/x:Account/Group/title': 'Groups',
  'list/x:QueuedMessage/title': 'Queued Messages',
  'list/x:NetworkListener/column/implicitTls': 'Implicit TLS',
  'form/x:NetworkListener/section/section-0': 'Listener settings',
  'form/Mailbox/section/section-0': 'Mailbox',
  'form/x:MailingList/field/recipients': 'Recipients',
  'enum/IndexType/email/label': 'Email',
  'variant/x:SpamDnsblServer/Domain/label': 'Domain',
};
for (const [slot, original] of Object.entries(sample)) {
  assert.equal(entries[slot]?.original, original, `Source text mismatch: ${slot}`);
}

// Execute the TypeScript implementation itself, not a copied logic approximation.
const source = fs.readFileSync('src/i18n/schemaText.ts', 'utf8');
const { outputText } = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
});
const exports = {};
vm.runInNewContext(outputText, {
  exports,
  URL,
  require: (specifier) => {
    assert.equal(specifier, './schema/ru.json');
    return catalog;
  },
}, { filename: 'schemaText.ts' });
const { schemaText, extractSchemaHash } = exports;
assert.equal(typeof schemaText, 'function');
assert.equal(typeof extractSchemaHash, 'function');

for (const hash of meta.schemaHashes) {
  assert.equal(schemaText(hash, 'ru', 'nav/link/Management/x:Domain', 'Domains'), 'Домены');
  assert.equal(schemaText(hash, 'ru_RU', 'list/x:Domain/title', 'Domains'), 'Домены');
  assert.equal(schemaText(hash, 'en', 'list/x:Domain/title', 'Domains'), 'Domains');
  assert.equal(schemaText(hash, 'ru', 'list/x:Domain/title', 'Unexpected upstream title'), 'Unexpected upstream title');
  assert.equal(schemaText(hash, 'ru', 'unknown/slot', 'Untouched'), 'Untouched');
}
assert.equal(schemaText(null, 'ru', 'list/x:Domain/title', 'Domains'), 'Domains');
assert.equal(schemaText('unknown-hash', 'ru', 'list/x:Domain/title', 'Domains'), 'Domains');
assert.equal(
  extractSchemaHash('https://mail.example.test/api/schema/' + meta.schemaHashes[0], 'https://mail.example.test'),
  meta.schemaHashes[0],
);
assert.equal(
  extractSchemaHash('https://attacker.example.test/api/schema/' + meta.schemaHashes[0], 'https://mail.example.test'),
  null,
);
assert.equal(extractSchemaHash('https://mail.example.test/api/schema', 'https://mail.example.test'), null);
assert.equal(extractSchemaHash('not a url', 'https://mail.example.test'), null);

// Render-branch contract: sortable and non-sortable headers use the same
// display-only label. Sorting must still use the raw column.name identifier.
const headerSource = fs.readFileSync('src/components/lists/ColumnHeader.tsx', 'utf8');
assert.match(headerSource, /if \(!sortable\) \{[\s\S]*?\{label\}/);
const sortableBranch = headerSource.slice(headerSource.indexOf('  const hint ='));
assert.match(sortableBranch, /onClick=\{\(\) => onSort\(column\.name\)\}/);
assert.match(sortableBranch, /\{label\}\s*\{direction ===/);
assert.doesNotMatch(sortableBranch, /\{column\.label\}/);

// Check representative contexts against the real translation resolver for both server versions.
for (const hash of meta.schemaHashes) {
  for (const [slot, english, russian] of [
    ['nav/link/Management/x:Account/User', 'Accounts', 'Учётные записи'],
    ['list/x:Account/Group/title', 'Groups', 'Группы'],
    ['list/x:QueuedMessage/title', 'Queued Messages', 'Сообщения в очереди'],
    ['form/x:NetworkListener/section/section-0', 'Listener settings', 'Настройки слушателя'],
    ['form/Mailbox/section/section-0', 'Mailbox', 'Почтовый ящик'],
    ['enum/IndexType/email/label', 'Email', 'Почта'],
  ]) {
    assert.equal(schemaText(hash, 'ru', slot, english), russian);
    assert.equal(schemaText(hash, 'en', slot, english), english);
    assert.equal(schemaText(hash, 'ru', slot, english + ' changed'), english + ' changed');
  }
}

const listSource = fs.readFileSync('src/components/lists/DynamicList.tsx', 'utf8');
assert.match(listSource, /Object\.hasOwn\(schema\.lists, viewName\) \? viewName : objectName/);
assert.match(listSource, /const title = display\(`list\/\$\{listKey\}\/title`, list\.title\)/);
assert.match(listSource, /listKey=\{listKey\}/);

const filterSource = fs.readFileSync('src/components/lists/FilterFields.tsx', 'utf8');
assert.match(filterSource, /display\(`enum\/\$\{filter\.enumName\}\/\$\{v\.name\}\/label`, v\.label\)/);
assert.match(filterSource, /value: v\.name/);

const variantSource = fs.readFileSync('src/components/forms/VariantSelect.tsx', 'utf8');
assert.match(variantSource, /display\(`variant\/\$\{variantScope\}\/\$\{v\.name\}\/label`, v\.label\)/);
assert.match(variantSource, /onChange\(v\.name\)/);

const localeSource = fs.readFileSync('src/i18n/index.ts', 'utf8');
assert.ok(
  localeSource.indexOf('setDisplayLanguage(initialLocale)') < localeSource.indexOf('i18n.use(initReactI18next).init('),
  'Locale must initialize schema display BEFORE the first schema fetch',
);
assert.match(localeSource, /localStorage\.setItem\(LOCALE_STORAGE_KEY, lang\)/);
const topBar = fs.readFileSync('src/components/layout/TopBar.tsx', 'utf8');
assert.match(topBar, /DropdownMenuRadioGroup value=\{activeLanguage\} onValueChange=\{setLocale\}/);
assert.match(topBar, /DropdownMenuRadioItem value="ru"/);
assert.match(topBar, /DropdownMenuRadioItem value="en"/);
const storeSource = fs.readFileSync('src/stores/schemaStore.ts', 'utf8');
const languageSwitch = storeSource.slice(storeSource.indexOf('  setDisplayLanguage: (language) => {'));
assert.match(languageSwitch, /set\(\{ displayLanguage: language, searchIndex \}\)/);
assert.doesNotMatch(languageSwitch, /setSchema\(/);

// Stage 4: nested Domain objects keep raw identifiers and preserve selector variables.
const nestedDomainSamples = [
  ['variant/x:SubAddressing/Enabled/label', 'Enable sub-addressing', 'Включить дополнительную адресацию'],
  ['variant/x:SubAddressing/Custom/label', 'Enable custom sub-addressing', 'Включить собственные правила дополнительной адресации'],
  ['variant/x:SubAddressing/Disabled/label', 'Disable sub-addressing', 'Отключить дополнительную адресацию'],
  ['variant/x:DkimManagement/Automatic/label', 'Automatic DKIM management', 'Автоматическое управление DKIM'],
  ['variant/x:DkimManagement/Manual/label', 'Manual DKIM management', 'Ручное управление DKIM'],
  ['variant/x:CertificateManagement/Automatic/label', 'ACME TLS certificate management', 'Управление сертификатами TLS через ACME'],
  ['variant/x:DnsManagement/Automatic/label', 'Automatic DNS management', 'Автоматическое управление DNS'],
  ['form/x:DkimManagementProperties/field/algorithms', 'Signing Algorithms', 'Алгоритмы подписи'],
  ['form/x:DkimManagementProperties/field/selectorTemplate', 'Selector Template', 'Шаблон селектора'],
  ['form/x:DkimManagementProperties/field/rotateAfter', 'Rotate After', 'Период ротации ключей'],
  ['form/x:SubAddressingCustom/field/customRule', 'Custom Rule Expression', 'Выражение пользовательского правила'],
  ['field/x:DkimManagementProperties/algorithms/description', 'List of signing algorithms to use when generating new DKIM keys', 'Алгоритмы подписи, используемые для генерации новых ключей DKIM'],
  ['field/x:Domain/directoryId/description', 'Identifier for the directory where accounts for this domain are stored, or null to use the internal directory', 'Идентификатор каталога с учётными записями домена. Если не указан, используется внутренний каталог.'],
];
for (const hash of meta.schemaHashes) {
  for (const [slot, original, translated] of nestedDomainSamples) {
    assert.equal(entries[slot]?.original, original);
    assert.equal(schemaText(hash, 'ru', slot, original), translated);
    assert.equal(schemaText(hash, 'en', slot, original), original);
    assert.equal(schemaText(hash, 'ru', slot, original + ' changed'), original + ' changed');
  }
  const template = entries['field/x:DkimManagementProperties/selectorTemplate/description'];
  assert.ok(template, 'Missing selector documentation');
  assert.equal(schemaText(hash, 'ru', 'field/x:DkimManagementProperties/selectorTemplate/description', template.original), template.ru);
  for (const marker of ['{algorithm}', '{hash}', '{version}', '{date-<fmt>}', '{date-%Y%m%d}', '{epoch}', '{random}']) {
    assert.ok(template.original.includes(marker) && template.ru.includes(marker), 'Missing selector variable: ' + marker);
  }
}
const embeddedSource = fs.readFileSync('src/components/forms/widgets/EmbeddedObjectWidget.tsx', 'utf8');
assert.match(embeddedSource, /variantScope=\{objectName\}/);
assert.match(embeddedSource, /formKey=\{resolved\.schemaName \?\? undefined\}/);
assert.match(embeddedSource, /onChange=\{changeVariant\}/);
const nestedFieldSource = fs.readFileSync('src/components/forms/FieldRow.tsx', 'utf8');
assert.match(nestedFieldSource, /const label = formKey \? display\(/);
assert.match(nestedFieldSource, /const description = descriptionOwner\s*\? display\(/);
assert.doesNotMatch(nestedFieldSource, /formKey && topLevel \? display/);
const stableVariantSource = fs.readFileSync('src/components/forms/VariantSelect.tsx', 'utf8');
assert.match(stableVariantSource, /const segmented = isSegmented\(variants\)/);
assert.match(stableVariantSource, /onChange\(v\.name\)/);
assert.match(stableVariantSource, /value=\{v\.name\}/);

// Stage 5: source-verified, view-specific Accounts, Actions, tenant and trace labels.
const stage5Samples = [
  ['list/x:Action/title', 'Actions', 'Действия'],
  ['list/x:Action/subtitle', 'Execute server management actions', 'Выполнение административных действий на сервере'],
  ['variant/x:Action/UpdateApps/label', 'Application Management: Update applications', 'Управление приложениями: Обновить приложение'],
  ['variant/x:Action/PauseMtaQueue/label', 'MTA: Pause queue processing', 'MTA: Приостановить обработку очереди'],
  ['nav/container/Management/Emails/History', 'History', 'История'],
  ['list/x:Trace/InboundDelivery/title', 'Inbound Delivery Attempts', 'Попытки входящей доставки'],
  ['list/x:Trace/OutboundDelivery/title', 'Outbound Delivery Attempts', 'Попытки исходящей доставки'],
  ['list/x:Trace/OutboundDelivery/column/timestamp', 'Date', 'Дата'],
  ['list/x:Tenant/title', 'Tenants', 'Арендаторы'],
  ['form/x:Tenant/section/section-2', 'Quotas', 'Квоты'],
  ['form/x:UserAccount/section/section-0', 'User Account', 'Учётная запись пользователя'],
  ['form/x:UserAccount/section/section-2', 'Groups & Roles', 'Группы и роли'],
  ['form/x:GroupAccount/section/section-1', 'Roles & Permissions', 'Роли и права доступа'],
  ['form/x:UserAccount/field/name', 'Username', 'Имя пользователя'],
  ['form/x:GroupAccount/field/aliases', 'Email Aliases', 'Почтовые псевдонимы'],
  ['field/x:MailingList/recipients/description', 'List of email addresses that are members of the mailing list', 'Почтовые адреса участников списка рассылки'],
  ['field/x:Role/enabledPermissions/description', 'List of permissions that are explicitly enabled.', 'Права, явно разрешённые этой ролью.'],
  ['field/x:OAuthClient/scopes/description', 'Scopes the client may request. When empty, the client can only request sign-in (openid).', 'Области доступа, запрашиваемые клиентом. Если список пуст, доступен только вход (openid).'],
  ['variant/x:Account/User/label', 'User account', 'Учётная запись пользователя'],
];
for (const hash of meta.schemaHashes) {
  for (const [slot, original, russian] of stage5Samples) {
    assert.equal(entries[slot]?.original, original, 'Source label mismatch: ' + slot);
    assert.equal(schemaText(hash, 'ru', slot, original), russian);
    assert.equal(schemaText(hash, 'en', slot, original), original);
    assert.equal(schemaText(hash, 'ru', slot, original + ' new'), original + ' new');
  }
}

// Execute the pure form display selector; schema IDs and section offsets are untouched.
const formCtxTs = fs.readFileSync('src/i18n/schemaFormContext.ts', 'utf8');
const formCtxJs = ts.transpileModule(formCtxTs, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const formCtxExports = {};
vm.runInNewContext(formCtxJs, { exports: formCtxExports }, { filename: 'schemaFormContext.ts' });
const ctx = (section, base, variant, parentCount) =>
  JSON.parse(JSON.stringify(formCtxExports.sectionDisplayContext(section, base, variant, parentCount)));
assert.deepEqual(ctx('section-0', 'x:Account', 'x:UserAccount', 1), {
  formKey: 'x:Account', sectionKey: 'section-0',
});
assert.deepEqual(ctx('section-1', 'x:Account', 'x:UserAccount', 1), {
  formKey: 'x:UserAccount', sectionKey: 'section-0',
});
assert.deepEqual(ctx('section-3', 'x:Account', 'x:GroupAccount', 1), {
  formKey: 'x:GroupAccount', sectionKey: 'section-2',
});
assert.deepEqual(ctx('section-2', 'x:DkimSignature', 'x:Dkim1Signature', 1), {
  formKey: 'x:Dkim1Signature', sectionKey: 'section-1',
});
assert.deepEqual(ctx('section-2', 'x:OAuthClient', 'x:OAuthClient', 0), {
  formKey: 'x:OAuthClient', sectionKey: 'section-2',
});
assert.deepEqual(ctx('section-1', 'x:Domain', undefined, 0), {
  formKey: 'x:Domain', sectionKey: 'section-1',
});

// Wiring is display-only: routes and event payloads retain raw names and IDs.
const dynamicFormStage5 = fs.readFileSync('src/components/forms/DynamicForm.tsx', 'utf8');
const formSectionsStage5 = fs.readFileSync('src/components/forms/FormSections.tsx', 'utf8');
assert.ok(dynamicFormStage5.includes('variantFormKey={variantFormKey}'));
assert.ok(dynamicFormStage5.includes('parentSectionCount={parentSectionCount}'));
assert.ok(formSectionsStage5.includes('sectionDisplayContext(section.key, formKey, variantFormKey, parentSectionCount)'));
assert.ok(formSectionsStage5.includes('formKey={context.formKey}'));
const actionsStage5 = fs.readFileSync('src/features/actions/ActionPage.tsx', 'utf8');
assert.ok(actionsStage5.includes('splitActionLabel(actionLabel(entry.variant)).name'));
assert.ok(actionsStage5.includes('buildActionPayload(pending.name, null, {})'));
assert.ok(actionsStage5.includes('hasPermission('));
assert.ok(actionsStage5.includes('setMutation.mutateAsync({ create: { [CREATE_ID]: payload } })'));
const actionFormStage5 = fs.readFileSync('src/features/actions/components/ActionForm.tsx', 'utf8');
assert.ok(actionFormStage5.includes('formKey={variant.schemaName}'));
const actionResultStage5 = fs.readFileSync('src/features/actions/components/ActionResult.tsx', 'utf8');
assert.ok(actionResultStage5.includes('variant/x:Action/'));

// Stage 6: exact original server labels for nested account contexts.
const stage6Samples = [
  ['variant/x:UserRoles/User/label', 'User role', 'Роль пользователя'],
  ['variant/x:UserRoles/Admin/label', 'Administrator role', 'Роль администратора'],
  ['variant/x:UserRoles/Custom/label', 'Custom role', 'Пользовательская роль'],
  ['variant/x:Roles/Default/label', 'Default role', 'Роль по умолчанию'],
  ['variant/x:Permissions/Inherit/label', 'Inherited permissions', 'Унаследованные права'],
  ['variant/x:Permissions/Merge/label', 'Permissions are combined with inherited permissions', 'Объединить с унаследованными правами'],
  ['variant/x:Permissions/Replace/label', 'Permissions replace all inherited permissions', 'Заменить унаследованные права'],
  ['variant/x:Credential/Password/label', 'Password for authenticating to the account', 'Пароль для входа в учётную запись'],
  ['form/x:EmailAlias/field/name', 'Local Part', 'Имя до знака @'],
  ['form/x:EmailAlias/field/domainId', 'Domain', 'Домен'],
  ['form/x:EmailAlias/field/enable', 'Enabled', 'Включён'],
  ['field/x:EmailAlias/name/description', 'The local part of the email alias (the part before the @ symbol)', 'Часть почтового адреса до знака @'],
  ['field/x:EmailAlias/domainId/description', 'Identifier for the domain of the email alias (the part after the @ symbol).', 'Домен почтового псевдонима — часть адреса после знака @.'],
  ['form/x:PermissionsList/field/enabledPermissions', 'Enabled Permissions', 'Разрешённые права'],
  ['form/x:CustomRoles/field/roleIds', 'Roles', 'Роли'],
  ['form/x:SecondaryCredential/field/permissions', 'Permissions', 'Права доступа'],
  ['form/x:EncryptionSettings/field/headerProtection', 'Header Protection', 'Защита заголовков'],
];
for (const hash of meta.schemaHashes) {
  for (const [slot, original, translated] of stage6Samples) {
    assert.equal(entries[slot]?.original, original, 'Source mismatch at ' + slot);
    assert.equal(schemaText(hash, 'ru', slot, original), translated);
    assert.equal(schemaText(hash, 'en', slot, original), original);
    assert.equal(schemaText(hash, 'ru', slot, original + ' v2'), original + ' v2');
  }
}
const enUi = JSON.parse(fs.readFileSync('src/i18n/en.json', 'utf8'));
const ruUi = JSON.parse(fs.readFileSync('src/i18n/ru.json', 'utf8'));
assert.match(enUi.actions.updateAppsScopeWarning, /all configured web applications/);
assert.match(ruUi.actions.updateAppsScopeWarning, /все настроенные веб-приложения/);
const actionWithWarning = fs.readFileSync('src/features/actions/ActionPage.tsx', 'utf8');
assert.ok(actionWithWarning.includes("pending?.name === 'UpdateApps'"));
assert.ok(actionWithWarning.includes("actions.updateAppsScopeWarning"));
assert.ok(actionWithWarning.includes('buildActionPayload(pending.name, null, {})'));

const sourceNestedRow = fs.readFileSync('src/components/forms/FieldRow.tsx', 'utf8');
// Stage15 expanded the display-only copy to key/value labels and placeholders.
// Keep checking the actual widget boundary instead of the obsolete inline copy.
assert.ok(sourceNestedRow.includes('const formFieldDisplay = {'));
assert.ok(sourceNestedRow.includes('formField: formFieldDisplay'));
assert.ok(sourceNestedRow.includes('formKey ? display('));
const sourceObjectList = fs.readFileSync('src/components/forms/widgets/ObjectListWidget.tsx', 'utf8');
assert.ok(sourceObjectList.includes('variant/${type.objectName}/${variant}/label'));
assert.ok(sourceObjectList.includes('summaryLabel ?? itemLabel'));
assert.ok(sourceObjectList.includes('onChange({ ...items, [key]: v })'));

// Stage 7: version-locked dashboards and visible-only JMAP/metric labels.
const dashboardSizes = {
  overview: 10, network: 12, delivery: 13, security: 5,
  authentication: 12, encryption: 16, performance: 9, storage: 6,
  'search-index': 11, tasks: 8, cache: 11,
};
assert.equal(Object.keys(entries).filter((k) => k.startsWith('dashboard/')).length, 274);
for (const [id, count] of Object.entries(dashboardSizes)) {
  assert.ok(entries['dashboard/' + id + '/label']);
  for (let i = 0; i < count; i++) {
    const key = 'dashboard/' + id + '/item/' + i + '/title';
    assert.ok(entries[key], 'Missing dashboard tile ' + key);
  }
}
const stage7Labels = [
  ['nav/container/Management/Observability', 'Observability', 'Наблюдение'],
  ['list/x:Log/title', 'Log Entries', 'Записи журнала'],
  ['list/x:Log/column/timestamp', 'Timestamp', 'Время'],
  ['variant/x:Action/InvalidateNegativeCaches/label', 'Cache: Invalidate negative caches', 'Кэш: Очистить кэш отрицательных результатов'],
  ['dashboard/overview/label', 'Overview', 'Обзор'],
  ['dashboard/overview/item/0/title', 'Received Messages', 'Принятые сообщения'],
  ['dashboard/overview/item/4/series/0/label', 'received', 'получено'],
  ['dashboard/network/item/9/series/0/label', 'inbound', 'входящие'],
  ['dashboard/delivery/item/10/series/1/label', 'DSNs', 'уведомления DSN'],
  ['dashboard/cache/item/9/series/0/label', 'hit', 'попадания'],
];
for (const hash of meta.schemaHashes) {
  for (const [key, original, translated] of stage7Labels) {
    assert.equal(entries[key]?.original, original);
    assert.equal(schemaText(hash, 'ru', key, original), translated);
    assert.equal(schemaText(hash, 'en', key, original), original);
    assert.equal(schemaText(hash, 'ru', key, original + ' altered'), original + ' altered');
  }
}
const rawChart = fs.readFileSync('src/features/dashboard/components/DashboardChart.tsx', 'utf8');
assert.ok(rawChart.includes('point[series.label] = seriesValues[s][i]'));
assert.ok(rawChart.includes('const key = s.label;'));
assert.ok(rawChart.includes('dataKey={key}'));
assert.ok(rawChart.includes('name={name}'));
assert.ok(rawChart.includes('seriesName(s.label, i)'));
const rawRanking = fs.readFileSync('src/features/dashboard/components/RankingTile.tsx', 'utf8');
assert.ok(rawRanking.includes('rankingEntries(ranking, historySamples)'));
assert.ok(rawRanking.includes('seriesName(entry.label)'));
const rawDashboard = fs.readFileSync('src/features/dashboard/components/DashboardView.tsx', 'utf8');
assert.ok(rawDashboard.includes('dashboardId={dashboardId}'));
assert.ok(rawDashboard.includes('itemIndex={i}'));
const rawLogList = fs.readFileSync('src/components/lists/DynamicList.tsx', 'utf8');
assert.ok(rawLogList.includes("listKey === 'x:Log'"));
assert.ok(rawLogList.includes("listState.error === 'No log tracers configured on the server'"));
assert.ok(rawLogList.includes("t('logs.noTracersConfigured'"));
const logEn = JSON.parse(fs.readFileSync('src/i18n/en.json', 'utf8'));
const logRu = JSON.parse(fs.readFileSync('src/i18n/ru.json', 'utf8'));
assert.equal(logEn.logs.noTracersConfigured, 'No log tracers configured on the server');
assert.equal(logRu.logs.noTracersConfigured, 'На сервере не настроены источники журналирования');
assert.ok(logRu.actions.negativeCacheExplanation.includes('Сами данные не удаляются'));
const rawActions = fs.readFileSync('src/features/actions/ActionPage.tsx', 'utf8');
assert.ok(rawActions.includes("pending?.name === 'InvalidateNegativeCaches'"));
const readOnlyValues = fs.readFileSync('src/components/values/ScalarValues.tsx', 'utf8');
assert.ok(readOnlyValues.includes('const display = useSchemaText()'));
assert.ok(readOnlyValues.includes('variant.label'));

// Shallow DOM-independent contract: lookup cannot mutate a schema or functional identifiers.
const sourceSchema = Object.freeze({
  layouts: Object.freeze([Object.freeze({ name: 'Management', viewName: 'x:Domain' })]),
  chart: Object.freeze({ series: Object.freeze([Object.freeze({ label: 'Inbound' }), Object.freeze({ label: 'Incoming' })]) }),
  form: Object.freeze({ name: 'example.org', dirty: true }),
});
schemaText(meta.schemaHashes[0], 'ru', 'layout/Management', sourceSchema.layouts[0].name);
assert.equal(sourceSchema.layouts[0].name, 'Management');
assert.equal(sourceSchema.layouts[0].viewName, 'x:Domain');
assert.equal(sourceSchema.form.dirty, true);
assert.deepEqual(sourceSchema.chart.series.map((s) => s.label), ['Inbound', 'Incoming']);


// Stage 9: operator-observed Task/Index Queue screens and safe scoped fallbacks.
const stage9Pinned = [
  ['nav/link/Management/x:QueuedMessage', 'Queued', 'Очередь'],
  ['list/x:Task/TaskFailed/title', 'Failed Tasks', 'Задания с ошибками'],
  ['list/x:Task/TaskFailed/subtitle', 'View failed background tasks', 'Просмотр фоновых заданий, завершившихся с ошибкой'],
  ['list/x:Task/TaskFailed/singular', 'failed task', 'задание'],
  ['list/x:IndexQueueStatus/title', 'Index Queues', 'Очереди индексации'],
  ['list/x:IndexQueueStatus/subtitle', 'Monitor search index processing and reschedule failed indexing operations', 'Контроль поисковой индексации и повторный запуск операций с ошибками'],
];
const stage9Fallback = [
  ['list/x:IndexQueueStatus/column/index', 'Index', 'Индекс'],
  ['list/x:IndexQueueStatus/column/partition', 'Partition', 'Раздел'],
  ['list/x:IndexQueueStatus/column/queuedUpdates', 'Queued Updates', 'Ожидают обновления'],
  ['list/x:IndexQueueStatus/column/queuedDeletions', 'Queued Deletions', 'Ожидают удаления'],
  ['variant/x:Task/CalendarAlarmEmail/label', 'Calendar alarm e-mail', 'Письмо с напоминанием календаря'],
  ['variant/x:Task/CalendarAlarmNotification/label', 'Calendar alarm notification', 'Уведомление календаря'],
  ['variant/x:Task/CalendarItipMessage/label', 'Calendar iTIP message', 'Календарное сообщение iTIP'],
  ['variant/x:Task/MergeThreads/label', 'Merge email threads', 'Объединение цепочек писем'],
  ['variant/x:Task/DmarcReport/label', 'Send DMARC report to remote server', 'Отправка отчёта DMARC на удалённый сервер'],
  ['variant/x:Task/TlsReport/label', 'Send TLS report to remote server', 'Отправка отчёта TLS на удалённый сервер'],
  ['variant/x:Task/RestoreArchivedItem/label', 'Restore archived item', 'Восстановление архивного элемента'],
  ['variant/x:Task/DestroyAccount/label', 'Destroy account and all associated data', 'Удаление учётной записи со всеми данными'],
  ['variant/x:Task/AccountMaintenance/label', 'Perform account maintenance operations', 'Обслуживание учётной записи'],
  ['variant/x:Task/TenantMaintenance/label', 'Perform tenant maintenance operations', 'Обслуживание арендатора'],
  ['variant/x:Task/StoreMaintenance/label', 'Perform store maintenance operations', 'Обслуживание хранилища'],
  ['form/x:TaskCalendarAlarmEmail/section/section-1', 'Account Task', 'Задание для учётной записи'],
  ['form/x:TaskCalendarAlarmEmail/field/documentId', 'Document', 'Документ'],
  ['field/x:TaskCalendarAlarmEmail/accountId/description', 'Identifier of the account associated with this task', 'Идентификатор учётной записи, связанной с заданием'],
  ['field/x:TaskCalendarAlarmEmail/documentId/description', 'Identifier of the document associated with this task', 'Идентификатор документа, связанного с заданием'],
  ['field/x:TaskCalendarAlarmEmail/status/description', 'Current status of the task', 'Текущее состояние задания'],
  ['variant/x:TaskStatus/Pending/label', 'Pending task awaiting execution', 'Задание ожидает выполнения'],
  ['field/x:TaskStatusPending/due/description', 'Due date and time for the task', 'Дата и время выполнения задания'],
];
for (const hash of meta.schemaHashes) {
  for (const [slot, original, translated] of stage9Pinned) {
    assert.equal(entries[slot]?.original, original, 'Pinned stage9 mismatch: ' + slot);
    assert.equal(schemaText(hash, 'ru', slot, original), translated);
    assert.equal(schemaText(hash, 'en', slot, original), original);
    assert.equal(schemaText(hash, 'ru', slot, original + ' changed'), original + ' changed');
  }
  for (const [slot, original, translated] of stage9Fallback) {
    assert.equal(schemaText(hash, 'ru', slot, original), translated);
    assert.equal(schemaText(hash, 'en', slot, original), original);
    assert.equal(schemaText(hash, 'ru', slot, original + ' changed'), original + ' changed');
  }
  // Stage38 gives section-0 its exact pinned Calendar Alarm Email caption.
  assert.equal(schemaText(hash,'ru','form/x:TaskCalendarAlarmEmail/section/section-0','Calendar Alarm Email'),'Письмо с напоминанием календаря');
  assert.equal(schemaText(hash,'ru','form/x:TaskCalendarAlarmEmail/section/section-0','Account Task'),'Account Task');
  assert.equal(schemaText(hash, 'ru', 'variant/x:Domain/Other/label', 'Account Task'), 'Account Task');
  assert.equal(schemaText(hash, 'ru', 'list/x:QueuedMessage/column/index', 'Index'), 'Index');
  assert.equal(schemaText(hash, 'ru', 'variant/x:Task/Unknown/label', 'Unseen task label'), 'Unseen task label');
}
assert.equal(schemaText('unknown-schema', 'ru', stage9Fallback[0][0], 'Index'), 'Index');
assert.equal(schemaText(null, 'ru', stage9Fallback[4][0], 'Calendar alarm e-mail'), 'Calendar alarm e-mail');
// Source-level contract: the task Create button is generated from the raw view
// and remains unchanged. UI labels are not task execution or server API changes.
assert.match(listSource, /navigate\(`\/\$\{section\}\/\$\{viewName\}\/new`\)/);
assert.match(listSource, /t\('list\.create', 'Create \{\{name\}\}'/);
assert.match(variantSource, /onChange\(v\.name\)/);
assert.match(headerSource, /onSort\(column\.name\)/);


// Stage10: short captions only. Identity of dashboard tabs and trace routes remains raw.
const stage10Captions = [
  ['dashboard/search-index/label', 'Search Index', 'Индексация'],
  ['dashboard/authentication/label', 'Message Authentication', 'Аутентификация'],
  ['nav/link/Management/x:Trace/InboundDelivery', 'Inbound Delivery', 'Входящих'],
  ['nav/link/Management/x:Trace/OutboundDelivery', 'Outbound Delivery', 'Исходящих'],
];
for (const [key, original, translated] of stage10Captions) {
  assert.equal(entries[key]?.original, original, 'Stage10 source mismatch: ' + key);
  assert.equal(entries[key]?.ru, translated);
  for (const hash of meta.schemaHashes) {
    assert.equal(schemaText(hash, 'ru', key, original), translated);
    assert.equal(schemaText(hash, 'en', key, original), original);
    assert.equal(schemaText(hash, 'ru', key, original + ' changed'), original + ' changed');
  }
}
assert.equal(schemaText(null, 'ru', stage10Captions[0][0], 'Search Index'), 'Search Index');
assert.ok(rawDashboard.includes('navigate(`/${section}/Dashboard/${id}`)'));
assert.ok(rawDashboard.includes('display(`dashboard/${d.id}/label`, d.label)'));
const navSource = fs.readFileSync('src/components/layout/navTree.ts', 'utf8');
assert.ok(navSource.includes('viewPath(sectionName: string, viewName: string)'));
assert.ok(navSource.includes('return `/${sectionName}/${viewName}`'));

// Stage12: complete source-verified ClusterNode read-only display (OSS+Enterprise).
const stage12Cluster = [
  ['list/x:ClusterNode/title', 'Cluster Nodes', 'Узлы кластера'],
  ['list/x:ClusterNode/subtitle', 'List of nodes in the cluster, including its unique identifier, hostname, last lease renewal timestamp and status', 'Список узлов кластера с идентификаторами, именами, временем последнего продления аренды и состоянием'],
  ['list/x:ClusterNode/singular', 'cluster node', 'узел кластера'],
  ['list/x:ClusterNode/plural', 'cluster nodes', 'узлы кластера'],
  ['list/x:ClusterNode/column/nodeId', 'Node ID', 'ID узла'],
  ['list/x:ClusterNode/column/hostname', 'Hostname', 'Имя узла'],
  ['list/x:ClusterNode/column/lastRenewal', 'Last Renewal', 'Последнее продление аренды'],
  ['list/x:ClusterNode/column/status', 'Status', 'Состояние'],
  ['form/x:ClusterNode/title', 'Cluster Node', 'Узел кластера'],
  ['form/x:ClusterNode/subtitle', 'View details about a node in the cluster, including its unique identifier, hostname, last lease renewal timestamp and status', 'Сведения об узле кластера: идентификатор, имя, последнее продление аренды и состояние'],
  ['form/x:ClusterNode/section/section-0', 'Details', 'Сведения'],
  ['form/x:ClusterNode/section/section-1', 'Status', 'Состояние'],
  ['form/x:ClusterNode/field/nodeId', 'Node ID', 'ID узла'],
  ['form/x:ClusterNode/field/hostname', 'Hostname', 'Имя узла'],
  ['form/x:ClusterNode/field/lastRenewal', 'Last Renewal', 'Последнее продление аренды'],
  ['form/x:ClusterNode/field/status', 'Status', 'Состояние'],
  ['field/x:ClusterNode/nodeId/description', 'Unique identifier for the node in the cluster', 'Уникальный идентификатор узла в кластере'],
  ['field/x:ClusterNode/hostname/description', 'Hostname of the node', 'Сетевое имя узла'],
  ['field/x:ClusterNode/lastRenewal/description', 'Timestamp of the last lease renewal from this node, used to determine if the node is still active in the cluster', 'Время последнего продления аренды узлом, используемое для определения его активности в кластере'],
  ['field/x:ClusterNode/status/description', 'Current status of the node in the cluster', 'Текущее состояние узла в кластере'],
  ['enum/ClusterNodeStatus/active/label', 'Active', 'Активен'],
  ['enum/ClusterNodeStatus/stale/label', 'Stale', 'Нет свежих данных'],
  ['enum/ClusterNodeStatus/inactive/label', 'Inactive', 'Неактивен'],
];
for (const [slot, original, translated] of stage12Cluster) {
  assert.deepEqual(entries[slot], { original, ru: translated }, 'Stage12 pinned source mismatch: ' + slot);
  for (const hash of meta.schemaHashes) {
    assert.equal(schemaText(hash, 'ru', slot, original), translated);
    assert.equal(schemaText(hash, 'en', slot, original), original);
    assert.equal(schemaText(hash, 'ru', slot, original + ' v2'), original + ' v2');
  }
  assert.equal(schemaText('unknown-hash', 'ru', slot, original), original);
}
const viewSource = fs.readFileSync('src/components/views/DynamicView.tsx', 'utf8');
const viewPageSource = fs.readFileSync('src/components/views/DynamicViewPage.tsx', 'utf8');
const tableSource = fs.readFileSync('src/components/lists/DynamicList.tsx', 'utf8');
const enumValueSource = fs.readFileSync('src/components/values/ScalarValues.tsx', 'utf8');
assert.ok(viewSource.includes('display(`form/${section.formKey}/section/${section.displaySectionKey}`, section.title)'));
assert.ok(viewSource.includes('display(`form/${section.formKey}/field/${formField.name}`, formField.label)'));
assert.ok(viewSource.includes('`field/${layout.fieldOwner}/${formField.name}/description`'));
assert.ok(viewSource.includes('value={data[formField.name]}'));
assert.ok(viewPageSource.includes('display(`list/${listKey}/singular`, rawSingularName)'));
assert.ok(viewPageSource.includes('objectId, undefined, { accountId }'));
assert.ok(tableSource.includes('pluralName={display(`list/${listKey}/plural`, list.pluralName)}'));
assert.ok(enumValueSource.includes('display(`enum/${enumName}/${name}/label`, variant.label)'));
// Routes, technical enum IDs, timestamps and cluster state remain untouched.
assert.ok(tableSource.includes('rowHref={(id) => (section ? `/${section}/${viewName}/${id}` : null)}'));
assert.ok(enumValueSource.includes('getEnumVariant(schema, enumName, name)'));

// Stage13: one shared Russian pagination summary across all nonempty lists.
// Do not concatenate English schema collection names or attempt to inflect
// arbitrary domain/cluster/task names with Russian numerals.
const enLocale = JSON.parse(fs.readFileSync('src/i18n/en.json', 'utf8'));
const ruLocale = JSON.parse(fs.readFileSync('src/i18n/ru.json', 'utf8'));
assert.equal(enLocale.list.showingRange, 'Showing {{from}}-{{to}} of {{total}}');
assert.equal(ruLocale.list.showingRange, 'Показано {{from}}–{{to}} из {{total}}');
assert.equal(ruLocale.list.showingRange.includes('{{name}}'), false);
function renderRange(template, from, to, total) {
  return template.replace(/{{(from|to|total)}}/g, (_match, key) => String({ from, to, total }[key]));
}
for (const [from, to, total, expected] of [
  [1, 1, 1, 'Показано 1–1 из 1'],
  [1, 2, 2, 'Показано 1–2 из 2'],
  [1, 5, 5, 'Показано 1–5 из 5'],
  [26, 50, 125, 'Показано 26–50 из 125'],
]) {
  assert.equal(renderRange(ruLocale.list.showingRange, from, to, total), expected);
}
assert.equal(enLocale.list.showing, 'Showing {{from}}-{{to}} of {{total}} {{name}}');
assert.equal(ruLocale.list.showing, 'Показано {{from}}–{{to}} из {{total}} {{name}}');
const paginationSource = fs.readFileSync('src/components/lists/Pagination.tsx', 'utf8');
assert.ok(paginationSource.includes("const { t, i18n } = useTranslation()"));
assert.ok(paginationSource.includes("toLowerCase() === 'ru'"));
assert.ok(paginationSource.includes("t('list.showingRange'"));
assert.ok(paginationSource.includes("t('list.showing'"));
assert.ok(paginationSource.includes('name: pluralName'));
assert.ok(paginationSource.includes("t('list.showingItems'"));
assert.ok(tableSource.includes('<Pagination'));
assert.ok(tableSource.includes('pluralName={list.pluralName}'));
assert.ok(paginationSource.includes('{summary}'));

// Stage14: five report list/detail layouts from the pinned OSS/Enterprise schemas.
const reportViews = [
  ['DmarcExternalReport', 'Inbound DMARC Reports', 'Входящие отчёты DMARC',
    'Manage received DMARC aggregate reports',
    ['from', 'subject', 'receivedAt'],
    ['domain', 'totalFailedSessions', 'totalSuccessfulSessions', 'expiresAt', 'memberTenantId'],
    ['report', 'memberTenantId', 'from', 'subject', 'to', 'receivedAt', 'expiresAt'], 'DMARC Report'],
  ['TlsExternalReport', 'TLS Reports', 'Входящие отчёты TLS',
    'Manage received TLS aggregate reports',
    ['from', 'subject', 'receivedAt'], [],
    ['report', 'memberTenantId', 'from', 'subject', 'to', 'receivedAt', 'expiresAt'], 'TLS Report'],
  ['ArfExternalReport', 'ARF Reports', 'Входящие отчёты ARF',
    'Manage received ARF feedback reports',
    ['from', 'subject', 'receivedAt'], [],
    ['report', 'memberTenantId', 'from', 'subject', 'to', 'receivedAt', 'expiresAt'], 'ARF Report'],
  ['DmarcInternalReport', 'Outbound DMARC Reports', 'Исходящие отчёты DMARC',
    'Manage outbound DMARC aggregate reports',
    ['domain', 'createdAt', 'deliverAt'], ['domain'],
    ['rua', 'policyIdentifier', 'report', 'domain', 'createdAt', 'deliverAt'], 'DMARC Report'],
  ['TlsInternalReport', 'Outbound TLS Reports', 'Исходящие отчёты TLS',
    'Manage outbound TLS aggregate reports',
    ['domain', 'createdAt', 'deliverAt'], [],
    ['mailRua', 'httpRua', 'policyIdentifiers', 'report', 'domain', 'createdAt', 'deliverAt'], 'TLS Report'],
];
const reportFieldLabels = {
  from: 'From', subject: 'Subject', receivedAt: 'Received At',
  domain: 'Domain', createdAt: 'Created At', deliverAt: 'Deliver At',
  expiresAt: 'Expires At', memberTenantId: 'Tenant', to: 'To', report: 'Report',
  rua: 'Report Recipients', policyIdentifier: 'Policy Identifier',
  mailRua: 'Mail Report Recipients', httpRua: 'HTTP Report URIs',
  policyIdentifiers: 'Policy Identifiers',
};
const reportFilterLabels = {
  domain: 'Domain Name', totalFailedSessions: 'Failed Sessions',
  totalSuccessfulSessions: 'Successful Sessions', expiresAt: 'Expires At',
  memberTenantId: 'Tenant',
};
const reportDescriptions = {
  expiresAt: 'When the report is scheduled to be deleted',
  from: 'Email address of the report sender',
  memberTenantId: 'Identifier for the tenant this report belongs to',
  receivedAt: 'When the report email was received',
  subject: 'Subject line of the report email',
  to: 'List of recipient email addresses',
  createdAt: 'When the report was created',
  deliverAt: 'When the report is scheduled to be delivered',
  domain: 'Domain this report is associated with',
  policyIdentifier: 'Identifier for the DMARC policy that generated this report',
  rua: 'Reporting email addresses from the DMARC policy',
  httpRua: 'Reporting URIs from the TLS policy',
  mailRua: 'Reporting email addresses from the TLS policy',
  policyIdentifiers: 'Identifiers for the TLS policies that generated this report',
};
const reportContents = {
  DmarcExternalReport: 'DMARC report content',
  TlsExternalReport: 'TLS report content',
  ArfExternalReport: 'Parsed ARF feedback report content',
  DmarcInternalReport: 'DMARC report content',
  TlsInternalReport: 'TLS report content',
};
const reportSlots = [];
for (const [name, title, titleRu, subtitle, columns, filters, fields, firstSection] of reportViews) {
  const list = 'list/x:' + name, form = 'form/x:' + name;
  reportSlots.push([list + '/title', title, titleRu]);
  reportSlots.push([list + '/subtitle', subtitle, null]);
  reportSlots.push([list + '/singular', 'report', 'отчёт']);
  reportSlots.push([list + '/plural', 'reports', 'отчёты']);
  for (const field of columns) reportSlots.push([list + '/column/' + field, reportFieldLabels[field], null]);
  for (const field of filters) reportSlots.push([list + '/filter/' + field, reportFilterLabels[field], null]);
  reportSlots.push([form + '/section/section-0', firstSection, null]);
  reportSlots.push([form + '/section/section-1', 'Report', 'Сведения об отчёте']);
  for (const field of fields) {
    reportSlots.push([form + '/field/' + field, reportFieldLabels[field], null]);
    reportSlots.push([
      'field/x:' + name + '/' + field + '/description',
      field === 'report' ? reportContents[name] : reportDescriptions[field],
      null,
    ]);
  }
}
assert.equal(reportSlots.length, 119, 'Pinned report screen structure changed');
for (const [slot, original, expectedRu] of reportSlots) {
  assert.ok(original, 'Missing original label: ' + slot);
  const entry = entries[slot];
  assert.equal(entry?.original, original, 'Pinned source string changed: ' + slot);
  assert.ok(entry?.ru && entry.ru !== original, 'Missing translated label: ' + slot);
  if (expectedRu) assert.equal(entry.ru, expectedRu);
  for (const hash of meta.schemaHashes) {
    assert.equal(schemaText(hash, 'ru', slot, original), entry.ru);
    assert.equal(schemaText(hash, 'en', slot, original), original);
    assert.equal(schemaText(hash, 'ru', slot, original + ' updated'), original + ' updated');
  }
  assert.equal(schemaText('unknown-schema', 'ru', slot, original), original);
}
const reviewedPolicy=JSON.parse(fs.readFileSync('scripts/data/locale-review-policy.json','utf8'));
const reviewedCount=loadReviewedBatches(process.cwd(),reviewedPolicy).reduce((n,p)=>n+p.entries.length,0);
const stage37Packet=loadFieldDescriptionPacket(process.cwd(),reviewedPolicy);
const packet38=loadFormContextPacket(process.cwd(),reviewedPolicy);
const packet39=loadVariantPacket(process.cwd(),reviewedPolicy);
const packet41=loadTracePacket(process.cwd(),reviewedPolicy);
const packet42=loadRegionalPacket(process.cwd(),reviewedPolicy);
const packet43=loadSpecializedPacket(process.cwd(),reviewedPolicy);
const stage42Catalog=undoSpecialized(catalog,packet43);
const stage41Catalog=undoRegional(stage42Catalog,packet42);
const stage39Catalog=undoTrace(stage41Catalog,packet41);
const stage38Catalog=undoVariants(stage39Catalog,packet39);
const stage37Catalog=undoFormContext(stage38Catalog,packet38);
const stage35Catalog=undoFieldDescriptions(stage37Catalog,stage37Packet);
assert.equal(Object.keys(stage35Catalog.entries).length,2084+reviewedCount);
assert.equal(Object.keys(entries).length,2084+reviewedCount+stage37Packet.slots.length+packet38.entries.length +packet39.entries.length+packet41.entries.length+packet42.entries.length+packet43.entries.length,'Unexpected contextual slot inventory');
assert.ok(dynamicFormStage5.includes('fieldOwner={fieldOwner}'));
assert.ok(dynamicFormStage5.includes('display(`form/${titleKey ?? objectKey}/title`, title)'));
assert.ok(formSectionsStage5.includes('fieldOwner={fieldOwner}'));
// Both source schemas define forms for each of these read-only JMAP object views.
assert.ok(viewPageSource.includes('<DynamicView'));
assert.ok(viewSource.includes('value={data[formField.name]}'));

console.log(`Schema locale check passed: ${Object.keys(entries).length} contextual slots, two pinned variants, safe fallbacks, preserved identifiers.`);
