/*
 * SPDX-FileCopyrightText: 2026
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-SEL
 */

import ruCatalog from './schema/ru.json';

type Entry = { original: string; ru: string };
const entries: Record<string, Entry> = ruCatalog.entries;
const schemaHashes = new Set<string>(ruCatalog.meta.schemaHashes);

/**
 * Display-only text lookup. Never rewrite schema values, keys, routes or
 * persisted form data. An unfamiliar schema revision falls back to English.
 */
export function schemaText(
  schemaHash: string | null,
  language: string,
  slot: string,
  original: string,
): string {
  if (language.split(/[-_]/)[0].toLowerCase() !== 'ru' || !schemaHash || !schemaHashes.has(schemaHash)) {
    return original;
  }
  const entry = entries[slot];
  return entry?.original === original ? entry.ru : original;
}

export function extractSchemaHash(url: string, expectedOrigin: string): string | null {
  try {
    const responseUrl = new URL(url);
    if (responseUrl.origin !== new URL(expectedOrigin).origin) return null;
    const match = /^\/api\/schema\/([A-Za-z0-9_-]{43})$/.exec(responseUrl.pathname);
    return match?.[1] ?? null;
  } catch {
    return null;
  }
}
