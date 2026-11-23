/*
 * SPDX-FileCopyrightText: 2026
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-SEL
 */

/** Search across visible translated labels, English labels and raw IDs without changing values. */
export interface SearchableOption {
  value: string;
  label: string;
  description?: string;
  keywords?: string[];
}

export function normalizeComboboxSearch(text: string): string {
  return text
    .normalize('NFKC')
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

export function filterComboboxOptions<T extends SearchableOption>(
  options: readonly T[],
  query: string,
): T[] {
  const normalizedQuery = normalizeComboboxSearch(query);
  if (!normalizedQuery) return [...options];

  const terms = normalizedQuery.split(' ');
  return options
    .map((option, index) => {
      const label = normalizeComboboxSearch(option.label);
      const value = normalizeComboboxSearch(option.value);
      const keywords = (option.keywords ?? []).map(normalizeComboboxSearch);
      const fields = [label, value, ...keywords, normalizeComboboxSearch(option.description ?? '')];
      // Each term may occur in a different searchable field (e.g. language + country).
      if (!terms.every((term) => fields.some((field) => field.includes(term)))) return null;

      const priority = label === normalizedQuery ? 0
        : label.startsWith(normalizedQuery) ? 1
        : label.includes(normalizedQuery) ? 2
        : value === normalizedQuery ? 3
        : value.startsWith(normalizedQuery) ? 4
        : keywords.some((keyword) => keyword.startsWith(normalizedQuery)) ? 5
        : 6;
      return { option, index, priority };
    })
    .filter((entry): entry is { option: T; index: number; priority: number } => entry !== null)
    .sort((a, b) => a.priority - b.priority || a.index - b.index)
    .map(({ option }) => option);
}
