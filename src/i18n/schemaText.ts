/*
 * SPDX-FileCopyrightText: 2026
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-SEL
 */

import ruCatalog from './schema/ru.json';

type Entry = { original: string; ru: string };
const entries: Record<string, Entry> = ruCatalog.entries;
const schemaHashes = new Set<string>(ruCatalog.meta.schemaHashes);
// Stage18: conflicting source slots are scoped to edition and exact original.
const scopedEntries: readonly (Entry & { schemaHash: string; slot: string })[] = ruCatalog.scopedEntries;
const scopedSlots = new Set(scopedEntries.map(entry => entry.slot));

// Stage47 interim: exact original-locked editorial display overrides.
// The historical catalog remains unchanged for digest replay.
export const dashboardEditorial: Readonly<Record<string, Entry>> = {
  "dashboard/overview/item/0/title": { original: "Received Messages", ru: "Принято" },
  "dashboard/overview/item/1/title": { original: "Sent Messages", ru: "Отправлено" },
  "dashboard/overview/item/2/title": { original: "Pending Messages", ru: "Очередь" },
  "dashboard/overview/item/3/title": { original: "Server Memory", ru: "Память Stalwart" },
  "dashboard/overview/item/6/title": { original: "Rejections", ru: "Отклонено" },
  "dashboard/overview/item/8/title": { original: "Memory usage", ru: "Использовано памяти" },
  "dashboard/overview/item/4/series/0/label": { original: "received", ru: "принято" },
  "dashboard/overview/item/6/series/2/label": { original: "Failed logins", ru: "Ошибки входа" },
  "dashboard/overview/item/6/series/4/label": { original: "Relay denied", ru: "Запрет ретрансляции" },
  "dashboard/overview/item/6/series/5/label": { original: "Rate limited", ru: "Лимит запросов" },
  "dashboard/network/item/0/title": { original: "SMTP active", ru: "Активные SMTP" },
  "dashboard/network/item/1/title": { original: "IMAP active", ru: "Активные IMAP" },
  "dashboard/network/item/2/title": { original: "POP3 active", ru: "Активные POP3" },
  "dashboard/network/item/3/title": { original: "HTTP active", ru: "Активные HTTP" },
  "dashboard/network/item/4/title": { original: "Sieve active", ru: "Активные Sieve" },
  "dashboard/network/item/5/title": { original: "SMTP total", ru: "Всего SMTP" },
  "dashboard/network/item/6/title": { original: "IMAP total", ru: "Всего IMAP" },
  "dashboard/network/item/7/title": { original: "POP3 total", ru: "Всего POP3" },
  "dashboard/network/item/8/title": { original: "HTTP total", ru: "Всего HTTP" },
  "dashboard/network/item/10/title": { original: "Mailbox Protocol Connections", ru: "Почтовые соединения" },
  "dashboard/security/item/1/title": { original: "IPs banned", ru: "Заблокированные IP" },
  "dashboard/encryption/item/0/title": { original: "Encrypted Outbound", ru: "Исходящие: зашифровано" },
  "dashboard/encryption/item/1/title": { original: "Plaintext Outbound", ru: "Исходящие: без шифра" },
  "dashboard/encryption/item/2/title": { original: "Bounced Recipients", ru: "Отказ получателям" },
  "dashboard/encryption/item/3/title": { original: "Encrypted at Rest", ru: "Хранение: зашифровано" },
  "dashboard/encryption/item/4/title": { original: "At Rest Skipped", ru: "Хранение: без шифра" },
  "dashboard/encryption/item/6/title": { original: "Keys Harvested", ru: "Найдено ключей" },
  "dashboard/encryption/item/8/title": { original: "Revocation List Failures", ru: "Ошибки CRL" },
  "dashboard/encryption/item/11/title": { original: "Outbound encryption", ru: "Исходящие письма" },
  "dashboard/encryption/item/12/title": { original: "Encryption at rest", ru: "Хранение" },
  "dashboard/search-index/item/0/title": { original: "Indexing Time", ru: "Время обработки пакета" },
  "dashboard/search-index/item/1/title": { original: "Batches Indexed", ru: "Обработано пакетов" },
  "dashboard/search-index/item/3/title": { original: "Partition Retries", ru: "Повторы разделов" },
  "dashboard/search-index/item/4/title": { original: "E-mail Index Queue", ru: "Очередь писем" },
  "dashboard/search-index/item/5/title": { original: "Calendar Index Queue", ru: "Очередь календарей" },
  "dashboard/search-index/item/6/title": { original: "Contacts Index Queue", ru: "Очередь контактов" },
  "dashboard/search-index/item/7/title": { original: "Files Index Queue", ru: "Очередь файлов" },
  "dashboard/search-index/item/8/title": { original: "Tracing Index Queue", ru: "Очередь трассировок" },
  "dashboard/search-index/item/9/title": { original: "Index queue", ru: "Очередь" },
  "dashboard/search-index/item/10/title": { original: "Indexing", ru: "Обработка" },
  "dashboard/tasks/item/0/title": { original: "Pending Tasks", ru: "В очереди" },
  "dashboard/tasks/item/1/title": { original: "Due Tasks", ru: "К выполнению" },
  "dashboard/tasks/item/2/title": { original: "Task Failures", ru: "Ошибки" },
  "dashboard/tasks/item/3/title": { original: "Task Retries", ru: "Повторные попытки" },
  "dashboard/tasks/item/4/title": { original: "Stalled Tasks", ru: "Застряли" },
  "dashboard/tasks/item/5/title": { original: "Expired Tasks", ru: "Просрочено" },
  "dashboard/tasks/item/6/title": { original: "Task queue", ru: "Очередь" },
  "dashboard/tasks/item/7/title": { original: "Task outcomes", ru: "Результаты" },
  "dashboard/cache/item/0/title": { original: "E-mail Cache", ru: "Почта" },
  "dashboard/cache/item/1/title": { original: "Large Account Cache", ru: "Крупные учётные записи" },
  "dashboard/cache/item/2/title": { original: "Other Caches", ru: "Прочие" },
  "dashboard/cache/item/3/title": { original: "Cache Hits", ru: "Попадания" },
  "dashboard/cache/item/4/title": { original: "Cache Misses", ru: "Промахи" },
  "dashboard/cache/item/6/title": { original: "Swap Pending", ru: "Ожидают записи" },
  "dashboard/cache/item/8/title": { original: "Cache memory", ru: "Память" },
  "dashboard/cache/item/9/title": { original: "Cache lookups", ru: "Обращения" },
  "dashboard/performance/item/2/title": { original: "Server Memory", ru: "Память Stalwart" },
  "dashboard/performance/item/7/title": { original: "Memory usage", ru: "Использовано памяти" },
};

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
  if (scopedSlots.has(slot)) {
    return scopedEntries.find(entry => entry.schemaHash === schemaHash
      && entry.slot === slot && entry.original === original)?.ru ?? original;
  }
  const entry = entries[slot];
  if (entry) {
    if (entry.original !== original) return original;
    const editorial = dashboardEditorial[slot];
    return editorial?.original === original ? editorial.ru : entry.ru;
  }
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
