// Version/edition-bound extension. The historical 1.1.1 catalogue stays immutable.
import * as historical from './schemaText';
import catalog from './schema/webuiRu-1.2.json';
import permissions from './schema/webuiRu-permission-1.2.json';

type Entry = { original: string; ru: string; hashes: string[] };
const additions: Record<string, Entry> = { ...catalog.entries, ...permissions.entries };
const baseHashes: Record<string, string> = catalog.meta.baseHashes;
const removed = new Set<string>(catalog.meta.removedSlots);

export function canTranslateSchema(hash: string | null, language: string): boolean {
  return (
    historical.canTranslateSchema(hash, language) ||
    (language.split(/[-_]/)[0].toLowerCase() === 'ru' && !!hash && Object.hasOwn(baseHashes, hash))
  );
}

export function schemaText(hash: string | null, language: string, slot: string, original: string): string {
  if (!hash || !Object.hasOwn(baseHashes, hash)) return historical.schemaText(hash, language, slot, original);
  if (!canTranslateSchema(hash, language) || removed.has(slot)) return original;
  const entry = additions[slot];
  if (entry) return entry.original === original && entry.hashes.includes(hash) ? entry.ru : original;
  // Reuse only source-reviewed unchanged pairs. Scoped historical entries use
  // the corresponding edition; changed originals are intercepted above.
  return historical.schemaText(baseHashes[hash], language, slot, original);
}

const actionForms: Readonly<Record<string, string>> = {
  'list/x:Account/Resource/singular': 'ресурс',
  'list/x:BlockedSender/singular': 'заблокированного отправителя',
  'list/x:SafeSender/singular': 'доверенного отправителя',
  'list/x:MailRule/singular': 'почтовое правило',
};

export function schemaActionName(hash: string | null, language: string, slot: string, original: string): string | null {
  if (!hash || !Object.hasOwn(baseHashes, hash)) return historical.schemaActionName(hash, language, slot, original);
  if (language.split(/[-_]/)[0].toLowerCase() !== 'ru') return original;
  if (Object.hasOwn(actionForms, slot))
    return schemaText(hash, language, slot, original) !== original ? actionForms[slot] : null;
  return historical.schemaActionName(baseHashes[hash], language, slot, original);
}
