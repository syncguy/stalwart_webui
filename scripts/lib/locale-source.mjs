// Offline adapters for the checked-in source. No browser, network or runtime imports.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createHash } from 'node:crypto';
import { gunzipSync } from 'node:zlib';
import ts from 'typescript';

export const digest = value => createHash('sha256').update(value).digest('hex');
export const json = value => JSON.stringify(value, null, 2) + '\n';
export const compare = (a, b) => a < b ? -1 : a > b ? 1 : 0;
export const ptr = (...parts) => '/' + parts.map(p => String(p).replaceAll('~', '~0').replaceAll('/', '~1')).join('/');
export const at = (object, pointer) => pointer.split('/').slice(1).reduce((o, k) => o?.[k.replaceAll('~1', '/').replaceAll('~0', '~')], object);

export function readJson(raw, name) {
  const ast = ts.parseJsonText(name, raw);
  assert.equal(ast.parseDiagnostics.length, 0, 'Некорректный JSON: ' + name);
  function visit(node) {
    if (ts.isObjectLiteralExpression(node)) {
      const keys = node.properties.filter(ts.isPropertyAssignment).map(p => p.name.text);
      assert.equal(new Set(keys).size, keys.length, 'Повтор ключа JSON: ' + name);
    }
    ts.forEachChild(node, visit);
  }
  visit(ast);
  return JSON.parse(raw);
}

// Execute only explicitly supplied local pure modules, with no ambient require/fetch/process.
export function sourceModule(raw, filename, imports = {}) {
  const exports = {};
  const code = ts.transpileModule(raw, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  vm.runInNewContext(code, {
    exports, URL,
    require: name => {
      assert.ok(Object.hasOwn(imports, name), 'Непредусмотренный import: ' + name);
      return imports[name];
    },
  }, { filename, timeout: 5000 });
  return exports;
}

// Read literal registry metadata through AST. Unknown expressions are review items.
export function registry(raw, filename, variable) {
  const ast = ts.createSourceFile(filename, raw, ts.ScriptTarget.Latest, true);
  const variables = new Map();
  function visit(node) {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer) variables.set(node.name.text, node.initializer);
    ts.forEachChild(node, visit);
  }
  visit(ast);
  function literal(node, seen = new Set()) {
    if (!node) return undefined;
    if (ts.isStringLiteral(node)) return node.text;
    if (node.kind === ts.SyntaxKind.TrueKeyword) return true;
    if (node.kind === ts.SyntaxKind.FalseKeyword) return false;
    if (ts.isIdentifier(node) && variables.has(node.text) && !seen.has(node.text)) {
      return literal(variables.get(node.text), new Set([...seen, node.text]));
    }
    if (ts.isArrayLiteralExpression(node)) return node.elements.flatMap(e => ts.isSpreadElement(e) ? literal(e.expression, seen) ?? [] : [literal(e, seen)]);
    if (ts.isObjectLiteralExpression(node)) {
      const result = {};
      for (const p of node.properties) {
        if (ts.isSpreadAssignment(p)) Object.assign(result, literal(p.expression, seen));
        if (ts.isPropertyAssignment(p)) result[p.name.text] = literal(p.initializer, seen);
      }
      return result;
    }
    if (ts.isCallExpression(node) && node.expression.getText(ast) === 'widget') return literal(node.arguments[0], seen);
    return undefined;
  }
  return literal(variables.get(variable));
}

export function loadInputs(root) {
  const read = p => fs.readFileSync(path.join(root, p), 'utf8');
  const load = p => readJson(read(p), p);
  const policy = load('scripts/data/locale-review-policy.json');
  const manifest = load('scripts/data/pinned-schema-manifest.json');
  const catalog = load('src/i18n/schema/ru.json');
  const inventory = load('.artifacts/locale-coverage/inventory.json');
  assert.equal(inventory.input.catalogSha256, digest(read('src/i18n/schema/ru.json')), 'Устарел исходный реестр');
  assert.equal(inventory.input.manifestSha256, digest(read('scripts/data/pinned-schema-manifest.json')), 'Изменился manifest');
  const pins = manifest.schemas.map(pin => {
    const bytes = Buffer.from(read(pin.fixture).trim(), 'base64');
    assert.equal(digest(bytes), pin.sha256Gzip, 'Изменилась схема: ' + pin.fixture);
    return { ...pin, data: readJson(gunzipSync(bytes).toString('utf8'), pin.fixture) };
  });
  const files = Object.keys(policy.adapterSources).sort(compare);
  const sourceHashes = Object.fromEntries(files.map(p => [p, digest(read(p))]));
  const adapterDrift = files.filter(p => sourceHashes[p] !== policy.adapterSources[p]);
  const resolver = sourceModule(read('src/lib/schemaResolver.ts'), 'schemaResolver.ts');
  const schema = sourceModule(read('src/i18n/schemaText.ts'), 'schemaText.ts', { './schema/ru.json': catalog });
  const options = sourceModule(read('src/i18n/schemaOptionLabels.ts'), 'schemaOptionLabels.ts');
  const permissionCatalog = load('src/i18n/schema/permission_ru.json');
  const permission = sourceModule(read('src/i18n/schemaPermissionText.ts'), 'schemaPermissionText.ts', { './schema/permission_ru.json': permissionCatalog });
  const pages = ['src/extensions/pages.ts', 'src/extensions/pages.sel.ts'].flatMap(p => registry(read(p), p, p.endsWith('sel.ts') ? 'SEL_PAGES' : 'PAGES'));
  const widgets = registry(read('src/extensions/widgets.ts'), 'widgets.ts', 'WIDGETS');
  assert.ok(pages.every(p => p?.match) && widgets.every(w => w?.key && w?.match), 'Не распознан registry');
  return {
    inventory, pins, catalog, policy, resolver, schema, options, permission, permissionCatalog, pages, widgets,
    glossary: load('scripts/schema-glossary.ru.json'), adapterDrift,
    provenance: { sourceHashes, catalogSha256: digest(read('src/i18n/schema/ru.json')),
      glossarySha256: digest(read('scripts/schema-glossary.ru.json')),
      policySha256: digest(read('scripts/data/locale-review-policy.json')),
      permissionSha256: digest(read('src/i18n/schema/permission_ru.json')) },
  };
}
