#!/usr/bin/env node
// Stage17. Reports/candidates only: no catalogue writes, build, ZIP or network.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { loadInputs, json, digest } from './lib/locale-source.mjs';
import { buildUsageGraph } from './lib/locale-graph.mjs';
import { plan, compactReport, CATEGORIES } from './lib/locale-planner.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
assert.ok(args.every(a => a.startsWith('--out=') || a.startsWith('--baseline=')), 'Неизвестный параметр генератора');
const out = path.resolve(root, args.find(a => a.startsWith('--out='))?.slice(6) ?? '.artifacts/locale-candidates');
const artifacts = path.join(root, '.artifacts');
assert.ok(out.startsWith(artifacts + path.sep), 'Запись разрешена только внутри .artifacts/');
// Check both generators, including existing/dangling file symlinks, before writes.
const destinations = [out, path.join(artifacts, 'locale-coverage'),
  ...['classification.json', 'candidates.json', 'diff.json', 'summary.md', 'review.md'].map(f => path.join(out, f)),
  ...['inventory.json', 'summary.md', 'translation-memory.json'].map(f => path.join(artifacts, 'locale-coverage', f))];
for (const destination of destinations) for (let p = destination; p !== root; p = path.dirname(p)) {
  assert.ok(!fs.lstatSync(p, { throwIfNoEntry: false })?.isSymbolicLink(), 'Путь отчёта содержит symlink: ' + p);
}
const baselinePath = args.find(a => a.startsWith('--baseline='))?.slice(11);
const previous = baselinePath ? JSON.parse(fs.readFileSync(path.resolve(root, baselinePath), 'utf8')) : null;
const catalogPath = path.join(root, 'src/i18n/schema/ru.json');
const before = digest(fs.readFileSync(catalogPath));
// Always regenerate the stage16 inventory: never silently reuse a stale local report.
execFileSync(process.execPath, ['scripts/generate-locale-coverage.mjs'], { cwd: root, stdio: 'pipe', maxBuffer: 2 ** 20 });
const inputs = loadInputs(root);
const report = plan(inputs, buildUsageGraph(inputs), previous);
fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(path.join(out, 'classification.json'), json(compactReport(report)));
fs.writeFileSync(path.join(out, 'candidates.json'), json({ version: 1, candidateOnly: true, apply: false, groups: report.candidates }));
fs.writeFileSync(path.join(out, 'diff.json'), json(report.diff));
const cell = text => String(text).replaceAll('|', '\\|').replaceAll('\n', ' ').replaceAll('\r', '');
const lines = [
  '# Этап 18: очередь локализации', '',
  'Источник схем: ' + report.source, '',
  '**Только анализ исходников. Доступность по лицензии/ACL неизвестна; browser PASS не заявлен.**', '',
  `Слотов: ${report.summary.slots}; каталог: ${report.summary.acceptedCatalogEntries} обычных записей, ${report.summary.acceptedScopedEntries} точных привязок по hash.`,
  `Групп на ревью: ${report.summary.candidateGroups}; с предложениями: ${report.summary.groupsWithSuggestions}; неоднозначных: ${report.summary.ambiguousGroups}.`,
  '', '| Категория | Слотов |', '| --- | ---: |',
  ...CATEGORIES.map(c => `| ${c} | ${report.summary.classification[c]} |`),
  '', '## Разделы', '',
  'Один общий слот может использоваться несколькими разделами. Строки таблицы не суммируются.', '',
  '| Раздел | Слотов | Переведены | Перевести | Original/tech | Renderer | Условия | Ревью | Групп |',
  '| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |',
  ...report.summary.sections.map(s => `| ${s.section} | ${s.slots} | ${s.translated} | ${s.missing} | ${s['keep-original'] + s.technical} | ${s['renderer-unwired']} | ${s['unreachable/conditional']} | ${s['needs-review']} | ${s.candidateGroups} |`),
  '', `Без доказанного пути из меню: ${report.summary.unassignedSlots}. Это не доказательство недоступности: остаются прямые маршруты, поиск и специальные страницы.`,
  '', '## Конфликты схем', '',
  ...report.conflicts.map(c => `- \`${c.slot}\`: ${c.variants.map(v => v.original + ' (' + [...new Set(v.locations.map(l => l.edition))].join(', ') + ')').join(' / ')}. ${c.resolution}`),
  '', '## Экраны', '',
  '| Раздел / экран | Слотов | Перевести | Renderer | Ревью |', '| --- | ---: | ---: | ---: | ---: |',
  ...report.screens.map(s => `| ${cell(s.section + ' / ' + s.name + ' / ' + s.view)} | ${s.slots} | ${s.missing} | ${s['renderer-unwired']} | ${s['needs-review']} |`),
  '', '## Границы', '',
  '- Полные source pointers, фактические lookup keys, условия и режимы находятся в classification.json.',
  '- needs-review включает специальные/компактные компоненты, Intl и спорные привязки. Без исполнения React это не закрытые UI-тесты.',
  '- Проверяются known schema hashes и SHA-256 источников адаптеров. Изменение требует повторного ревью, а не автоматического доверия.',
  '- candidates.json не совместим с утверждённым runtime-каталогом: apply=false, все группы pending.',
  '- Приоритет предложений: точный контекст, сохранённый перевод, смысловая группа, принятая терминология, другие контексты, glossary.',
  '- Отсутствие предложения означает новую редакторскую задачу. Внешние переводчики не вызываются.',
  '- Общие клиентские сообщения и raw JSX выделены отдельно; AST не доказывает полный охват строк JS.',
  '',
];
fs.writeFileSync(path.join(out, 'summary.md'), lines.join('\n'));
const review = ['# Кандидаты для редакторской проверки', '', 'Ничего не применяется автоматически. Точные цели и все источники предложений: candidates.json.', '',
  '| Группа | Раздел | Оригинал | Предложения | Замечания |', '| --- | --- | --- | --- | --- |',
  ...report.candidates.map(g => `| ${g.id} | ${cell(g.sections.join(', ') || 'не привязан')} | ${cell(g.original)} | ${cell(g.suggestions.map(s => s.ru + (s.safe ? '' : ' [НЕСОВПАДЕНИЕ МАРКЕРОВ]')).join(' / ') || 'новый перевод')} | ${cell(g.reviewFlags.join('; '))} |`), ''];
fs.writeFileSync(path.join(out, 'review.md'), review.join('\n'));
assert.equal(digest(fs.readFileSync(catalogPath)), before, 'Утверждённый каталог изменился');
assert.deepEqual(report.diagnostics.adapterDrift, [], 'Исходники renderer изменились: требуется ревью адаптеров');
assert.deepEqual(report.diagnostics.staleRules, [], 'Устаревшие контекстные правила');
console.log(json(report.summary));
console.log('Этап 18: отчёты созданы; утверждённый каталог сохранён. ' + path.relative(root, out));
