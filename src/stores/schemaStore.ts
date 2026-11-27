/*
 * SPDX-FileCopyrightText: 2020 Stalwart Labs LLC <hello@stalw.art>
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-SEL
 */

import { create } from 'zustand';
import { schemaText } from '@/i18n/webuiRuSchemaText';
import { layoutViewFor } from '@/lib/layout';
import type { Schema, LayoutSubItem } from '@/types/schema';

export interface SearchIndexEntry {
  text: string;
  type: 'link' | 'field' | 'form';
  viewName: string;
  section: string;
  breadcrumb: string;
  icon?: string;
  objectType?: 'object' | 'singleton' | 'view';
  keywords?: string[];
}

interface SchemaState {
  /** Untouched API response: permission checks, JMAP and form identity rely on this reference. */
  schema: Schema | null;
  schemaHash: string | null;
  displayLanguage: string;
  isLoaded: boolean;
  viewToSection: Record<string, string>;
  searchIndex: SearchIndexEntry[];

  setSchema: (schema: Schema, schemaHash: string | null) => void;
  setDisplayLanguage: (language: string) => void;
}

function walkLayouts(
  schema: Schema,
  hash: string | null,
  language: string,
): { viewToSection: Record<string, string>; linkEntries: SearchIndexEntry[] } {
  const viewToSection: Record<string, string> = {};
  const linkEntries: SearchIndexEntry[] = [];
  const display = (key: string, text: string) => schemaText(hash, language, key, text);

  function visit(items: LayoutSubItem[], sectionName: string, parentPath: string, rawPath: string): void {
    for (const sub of items) {
      if (sub.type === 'link') {
        if (!(sub.viewName in viewToSection)) {
          viewToSection[sub.viewName] = sectionName;
        }
        const label = display(`nav/link/${sectionName}/${sub.viewName}`, sub.name);
        linkEntries.push({
          text: label,
          type: 'link',
          viewName: sub.viewName,
          section: sectionName,
          breadcrumb: `${parentPath} > ${label}`,
          keywords: [sub.name, sub.viewName],
        });
      } else if (sub.type === 'container') {
        const context = `${rawPath}/${sub.name}`;
        const label = display(`nav/container/${context}`, sub.name);
        visit(sub.items, sectionName, `${parentPath} > ${label}`, context);
      }
    }
  }

  for (const layout of schema.layouts) {
    const sectionName = layout.name; // Functional identifier, never localized.
    const sectionLabel = display(`layout/${sectionName}`, sectionName);
    for (const item of layout.items) {
      if ('link' in item) {
        if (!(item.link.viewName in viewToSection)) {
          viewToSection[item.link.viewName] = sectionName;
        }
        const label = display(`nav/link/${sectionName}/${item.link.viewName}`, item.link.name);
        linkEntries.push({
          text: label,
          type: 'link',
          viewName: item.link.viewName,
          section: sectionName,
          breadcrumb: `${sectionLabel} > ${label}`,
          keywords: [item.link.name, item.link.viewName],
          icon: item.link.icon,
        });
      } else if ('container' in item) {
        const context = `${sectionName}/${item.container.name}`;
        const label = display(`nav/container/${context}`, item.container.name);
        visit(item.container.items, sectionName, `${sectionLabel} > ${label}`, context);
      }
    }
  }
  return { viewToSection, linkEntries };
}

function buildSearchIndex(
  schema: Schema,
  viewToSection: Record<string, string>,
  linkEntries: SearchIndexEntry[],
  hash: string | null,
  language: string,
): SearchIndexEntry[] {
  const entries: SearchIndexEntry[] = [...linkEntries];
  const display = (key: string, text: string) => schemaText(hash, language, key, text);
  const sectionLabel = (section: string) => display(`layout/${section}`, section);

  function displayNameFor(viewName: string): string {
    const obj = schema.objects[viewName];
    if (!obj) return viewName.replace(/^x:/, '');
    let resolvedName = viewName;
    let resolvedObj = obj;
    if (obj.type === 'view') {
      const parent = schema.objects[obj.objectName];
      if (parent && parent.type !== 'view') {
        resolvedName = obj.objectName;
        resolvedObj = parent;
      }
    }
    if (resolvedObj.type === 'singleton') {
      const formKey = schema.forms[viewName] ? viewName : resolvedName;
      const form = schema.forms[formKey];
      if (form?.title) return display(`form/${formKey}/title`, form.title);
    }
    if (resolvedObj.type === 'object') {
      const listKey = schema.lists[viewName] ? viewName : resolvedName;
      const list = schema.lists[listKey];
      if (list?.singularName) {
        const name = display(`list/${listKey}/singular`, list.singularName);
        return name.charAt(0).toUpperCase() + name.slice(1);
      }
    }
    return viewName.replace(/^x:/, '');
  }

  for (const [name, obj] of Object.entries(schema.objects)) {
    if (obj.type !== 'view' && obj.description) {
      const viewName = layoutViewFor(schema, viewToSection, name);
      if (!viewName) continue;
      const section = viewToSection[viewName];
      const title = displayNameFor(viewName);
      entries.push({
        text: display(`object/${name}/description`, obj.description),
        type: 'link',
        viewName,
        section,
        breadcrumb: `${sectionLabel(section)} > ${title}`,
        objectType: obj.type,
        keywords: [obj.description, name],
      });
    }
  }

  for (const [formKey, form] of Object.entries(schema.forms)) {
    const mapped = schema.objects[formKey] ? layoutViewFor(schema, viewToSection, formKey) : formKey;
    if (!mapped) continue;
    const viewName = mapped;
    const section = viewToSection[viewName] ?? '';
    const title = displayNameFor(viewName);
    const root = section ? `${sectionLabel(section)} > ${title}` : title;

    for (const [index, formSection] of form.sections.entries()) {
      if (formSection.title) {
        const label = display(`form/${formKey}/section/section-${index}`, formSection.title);
        entries.push({
          text: label,
          type: 'form',
          viewName,
          section,
          breadcrumb: `${root} > ${label}`,
          keywords: [formSection.title],
        });
      }
      for (const field of formSection.fields) {
        const label = display(`form/${formKey}/field/${field.name}`, field.label);
        const keywords = [field.label];
        if (field.name && field.name !== '@type') keywords.push(field.name);
        entries.push({
          text: label,
          type: 'field',
          viewName,
          section,
          breadcrumb: `${root} > ${label}`,
          keywords,
        });
      }
    }
  }
  return entries;
}

export const useSchemaStore = create<SchemaState>()((set, get) => ({
  schema: null,
  schemaHash: null,
  displayLanguage: 'en',
  isLoaded: false,
  viewToSection: {},
  searchIndex: [],

  setSchema: (schema, schemaHash) => {
    const language = get().displayLanguage;
    const { viewToSection, linkEntries } = walkLayouts(schema, schemaHash, language);
    const searchIndex = buildSearchIndex(schema, viewToSection, linkEntries, schemaHash, language);
    set({ schema, schemaHash, isLoaded: true, viewToSection, searchIndex });
  },

  setDisplayLanguage: (language) => {
    const state = get();
    if (state.displayLanguage === language) return;
    if (!state.schema) {
      set({ displayLanguage: language });
      return;
    }
    // Rebuild only derived text. Preserve raw schema / resolved-view WeakMap keys.
    const { linkEntries } = walkLayouts(state.schema, state.schemaHash, language);
    const searchIndex = buildSearchIndex(state.schema, state.viewToSection, linkEntries, state.schemaHash, language);
    set({ displayLanguage: language, searchIndex });
  },
}));
