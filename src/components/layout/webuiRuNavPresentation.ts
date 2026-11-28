// UI-50-03: presentation-only regrouping in our edition. Do not change raw
// layout metadata, permission checks, routes, search or server schema.
import type { Layout } from '@/types/schema';
import { canTranslateSchema } from '@/i18n/webuiRuSchemaText';
import type { NavNode } from './navTree';

const expected = [
  ['System Interpreter', 'x:SieveSystemInterpreter', 'System', 'systemInterpreter'],
  ['User Interpreter', 'x:SieveUserInterpreter', 'User', 'userInterpreter'],
  ['System Scripts', 'x:SieveSystemScript', 'System', 'systemScripts'],
  ['User Scripts', 'x:SieveUserScript', 'User', 'userScripts'],
] as const;

/** Re-review this guard against new upstream schemas and menu permissions. */
export function webuiRuNavPresentation(layout: Layout, nodes: NavNode[], hash: string | null): NavNode[] {
  if (layout.name !== 'Settings' || !canTranslateSchema(hash, 'ru')) return nodes;
  const matches = layout.items.filter(item => 'container' in item && item.container.name === 'Sieve');
  if (matches.length !== 1) return nodes;
  const raw = matches[0];
  if (!('container' in raw)) return nodes;
  const { container } = raw;
  if (Object.keys(raw).length !== 1 || Object.keys(container).length !== 3 ||
      container.icon !== 'file-code' || container.items.length !== expected.length ||
      !container.items.every((item, i) => item.type === 'link' && Object.keys(item).length === 3 &&
        item.name === expected[i][0] && item.viewName === expected[i][1])) return nodes;

  const index = nodes.findIndex(n => n.kind === 'container' && n.displaySlot === 'nav/container/Settings/Sieve');
  if (index < 0 || nodes.filter(n => n.displaySlot === 'nav/container/Settings/Sieve').length !== 1) return nodes;
  const original = nodes[index];
  if (original.kind !== 'container' || original.children.length !== expected.length ||
      !original.children.every((n, i) => n.kind === 'link' && n.name === expected[i][0] &&
        n.viewName === expected[i][1] && n.displaySlot === 'nav/link/Settings/' + expected[i][1])) return nodes;

  const children: NavNode[] = original.children.map((node, i) => ({
    ...node, name: expected[i][2], displaySlot: 'webuiRu.sieveNav.' + expected[i][3],
  }));
  const groups: NavNode[] = [
    { kind: 'container', name: 'Interpreters', displaySlot: 'webuiRu.sieveNav.interpreters', children: children.slice(0, 2) },
    { kind: 'container', name: 'Scripts', displaySlot: 'webuiRu.sieveNav.scripts', children: children.slice(2) },
  ];
  return nodes.map((node, i) => i === index ? { ...original, children: groups } : node);
}
