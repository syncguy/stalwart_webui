/*
 * SPDX-FileCopyrightText: 2026
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-SEL
 */

/**
 * Display-only labels for options whose full lists are supplied by the server.
 * Callers gate these helpers on the two pinned schema hashes. All IDs, keys,
 * selected values, UTC offsets and raw schema objects remain unchanged.
 */

const quotaLabels: Readonly<Record<string, string>> = {
  'Maximum number of emails': 'Максимум писем',
  'Maximum number of mailboxes': 'Максимум почтовых ящиков',
  'Maximum number of email submissions': 'Максимум отправок писем',
  'Maximum number of email identities': 'Максимум почтовых идентификаторов',
  'Maximum number of participant identities': 'Максимум идентификаторов участников',
  'Maximum number of Sieve scripts': 'Максимум сценариев Sieve',
  'Maximum number of push subscriptions': 'Максимум подписок на уведомления',
  'Maximum number of calendars': 'Максимум календарей',
  'Maximum number of calendar events': 'Максимум событий календаря',
  'Maximum number of calendar event notifications': 'Максимум уведомлений о событиях календаря',
  'Maximum number of address books': 'Максимум адресных книг',
  'Maximum number of contact cards': 'Максимум карточек контактов',
  'Maximum number of files': 'Максимум файлов',
  'Maximum number of folders': 'Максимум папок',
  'Maximum number of masked email addresses': 'Максимум маскированных почтовых адресов',
  'Maximum number of app passwords': 'Максимум паролей приложений',
  'Maximum number of API keys': 'Максимум API-ключей',
  'Maximum number of public keys': 'Максимум открытых ключей',
  'Maximum disk space allocated (bytes)': 'Максимальное выделенное место на диске (байты)',
  'Maximum number of passkeys': 'Максимум ключей доступа',
};

const headerProtectionLabels: Readonly<Record<string, string>> = {
  None: 'Не защищать заголовки',
  'Protected, headers visible': 'Защищены, заголовки видимы',
  'Protected, Subject hidden': 'Защищены, тема скрыта',
};

const localeNames = new Map<string, string>();
const timeZoneNames = new Map<string, string>();

export function quotaOptionLabel(original: string): string {
  return quotaLabels[original] ?? original;
}

export function headerProtectionOptionLabel(original: string): string {
  return headerProtectionLabels[original] ?? original;
}

export function localeOptionLabel(localeId: string, original: string): string {
  const cached = localeNames.get(localeId);
  if (cached) return cached;
  try {
    // Only the presentation uses a normalized BCP 47 tag, never the JMAP value.
    const locale = Intl.getCanonicalLocales(localeId.replaceAll('_', '-'))[0];
    if (!locale) return original;
    const label = new Intl.DisplayNames(['ru-RU'], { type: 'language' }).of(locale);
    if (!label || label === locale || label === localeId) return original;
    localeNames.set(localeId, label);
    return label;
  } catch {
    return original;
  }
}

export function timeZoneOptionLabel(timeZoneId: string, original: string): string {
  const cached = timeZoneNames.get(timeZoneId);
  if (cached) return cached;
  try {
    const label = new Intl.DateTimeFormat('ru-RU', {
      timeZone: timeZoneId,
      timeZoneName: 'longGeneric',
    }).formatToParts(new Date()).find((part) => part.type === 'timeZoneName')?.value;
    // Some zones have no localized CLDR name: retain the original IANA label.
    if (!label || label === timeZoneId || /^(?:GMT|UTC)[+-]/.test(label)) return original;
    timeZoneNames.set(timeZoneId, label);
    return label;
  } catch {
    return original;
  }
}
