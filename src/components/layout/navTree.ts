/*
 * SPDX-FileCopyrightText: 2020 Stalwart Labs LLC <hello@stalw.art>
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-SEL
 */

import type { Layout, LayoutItem, LayoutSubItem } from '@/types/schema';

export type NavNode =
  | { kind: 'link'; name: string; icon?: string; viewName: string; displaySlot: string }
  | { kind: 'container'; name: string; icon?: string; children: NavNode[]; displaySlot: string };

function fromSubItem(item: LayoutSubItem, section: string, path: string): NavNode | null {
  if (item.type === 'link') {
    return { kind: 'link', name: item.name, viewName: item.viewName, displaySlot: `nav/link/${section}/${item.viewName}` };
  }
  if (item.type === 'container') {
    const childPath = `${path}/${item.name}`;
    return {
      kind: 'container',
      name: item.name,
      displaySlot: `nav/container/${childPath}`,
      children: fromSubItems(item.items, section, childPath),
    };
  }
  return null;
}

function fromSubItems(items: LayoutSubItem[], section: string, path: string): NavNode[] {
  return items.map((item) => fromSubItem(item, section, path)).filter((n): n is NavNode => n !== null);
}

function fromItem(item: LayoutItem, section: string): NavNode | null {
  if ('link' in item) {
    return { kind: 'link', ...item.link, displaySlot: `nav/link/${section}/${item.link.viewName}` };
  }
  if ('container' in item) {
    const { name, icon, items } = item.container;
    const path = `${section}/${name}`;
    return {
      kind: 'container',
      name,
      icon,
      displaySlot: `nav/container/${path}`,
      children: fromSubItems(items, section, path),
    };
  }
  return null;
}

export function layoutNavNodes(layout: Layout): NavNode[] {
  return layout.items.map((item) => fromItem(item, layout.name)).filter((n): n is NavNode => n !== null);
}

export function navNodeKey(node: NavNode): string {
  return node.kind === 'link' ? `link:${node.viewName}` : `container:${node.name}`;
}

export function viewPath(sectionName: string, viewName: string): string {
  return `/${sectionName}/${viewName}`;
}

export function pathMatchesView(pathname: string, sectionName: string, viewName: string): boolean {
  const base = viewPath(sectionName, viewName);
  if (pathname === base || pathname.startsWith(`${base}/`)) return true;
  // SPDX-SnippetBegin
  // SPDX-FileCopyrightText: 2020 Stalwart Labs LLC <hello@stalw.art>
  // SPDX-License-Identifier: LicenseRef-SEL
  if (viewName === 'CustomComponent/Dashboard' && pathname.startsWith(`/${sectionName}/Dashboard/`)) return true;
  // SPDX-SnippetEnd
  return false;
}

export function someLink(nodes: NavNode[], predicate: (viewName: string) => boolean): boolean {
  return nodes.some((node) => (node.kind === 'link' ? predicate(node.viewName) : someLink(node.children, predicate)));
}

export function activeViewName(nodes: NavNode[], pathname: string, sectionName: string): string | undefined {
  let active: string | undefined;
  for (const node of nodes) {
    let candidate: string | undefined;
    if (node.kind === 'container') candidate = activeViewName(node.children, pathname, sectionName);
    else if (pathMatchesView(pathname, sectionName, node.viewName)) candidate = node.viewName;
    if (candidate !== undefined && (active === undefined || candidate.length > active.length)) active = candidate;
  }
  return active;
}
