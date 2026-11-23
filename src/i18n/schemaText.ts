/*
 * SPDX-FileCopyrightText: 2026
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-SEL
 */

import ruCatalog from './schema/ru.json';

type Entry = { original: string; ru: string };
const entries: Record<string, Entry> = ruCatalog.entries;
const schemaHashes = new Set<string>(ruCatalog.meta.schemaHashes);

// Stage9: bounded original-text fallback for task variants and indexing
// columns that are supplied by the pinned server schemas. No raw enum names,
// routes, field names or persisted values are ever rewritten.
const taskDisplayLabels: Readonly<Record<string, string>> = {
  'Calendar alarm e-mail': 'Письмо с напоминанием календаря',
  'Calendar alarm notification': 'Уведомление календаря',
  'Calendar iTIP message': 'Календарное сообщение iTIP',
  'Merge email threads': 'Объединение цепочек писем',
  'Send DMARC report to remote server': 'Отправка отчёта DMARC на удалённый сервер',
  'Send TLS report to remote server': 'Отправка отчёта TLS на удалённый сервер',
  'Restore archived item': 'Восстановление архивного элемента',
  'Destroy account and all associated data': 'Удаление учётной записи со всеми данными',
  'Perform account maintenance operations': 'Обслуживание учётной записи',
  'Perform tenant maintenance operations': 'Обслуживание арендатора',
  'Perform store maintenance operations': 'Обслуживание хранилища',
  'Account Task': 'Задание для учётной записи',
  'Document': 'Документ',
  'Identifier of the account associated with this task': 'Идентификатор учётной записи, связанной с заданием',
  'Identifier of the document associated with this task': 'Идентификатор документа, связанного с заданием',
  'Current status of the task': 'Текущее состояние задания',
  'Pending task awaiting execution': 'Задание ожидает выполнения',
  'Due date and time for the task': 'Дата и время выполнения задания',
};

const indexingColumnLabels: Readonly<Record<string, string>> = {
  Index: 'Индекс',
  Partition: 'Раздел',
  'Queued Updates': 'Ожидают обновления',
  'Queued Deletions': 'Ожидают удаления',
};

/** Exact original strings only, restricted to specific server-schema contexts. */
function taskAndIndexDisplayFallback(slot: string, original: string): string {
  if (slot.startsWith('list/x:IndexQueueStatus/column/')) {
    return indexingColumnLabels[original] ?? original;
  }
  if (slot.startsWith('form/x:Task') || slot.startsWith('field/x:Task') || slot.startsWith('variant/x:Task')) {
    return taskDisplayLabels[original] ?? original;
  }
  return original;
}

/**
 * Display-only text lookup. Never rewrite schema values, keys, routes or
 * persisted form data. An unfamiliar schema revision falls back to English.
 */
export function canTranslateSchema(schemaHash: string | null, language: string): boolean {
  return language.split(/[-_]/)[0].toLowerCase() === 'ru'
    && !!schemaHash
    && schemaHashes.has(schemaHash);
}

export function schemaText(
  schemaHash: string | null,
  language: string,
  slot: string,
  original: string,
): string {
  if (!canTranslateSchema(schemaHash, language)) {
    return original;
  }
  const entry = entries[slot];
  if (entry) return entry.original === original ? entry.ru : original;
  return taskAndIndexDisplayFallback(slot, original);
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
