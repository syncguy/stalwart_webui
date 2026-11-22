/*
 * SPDX-FileCopyrightText: 2026
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-SEL
 */

import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { schemaText } from '@/i18n/schemaText';
import { useSchemaStore } from '@/stores/schemaStore';

/** A reactive, schema-versioned display lookup. Raw schema references stay stable. */
export function useSchemaText() {
  const schemaHash = useSchemaStore((state) => state.schemaHash);
  const { i18n } = useTranslation();
  const language = i18n.resolvedLanguage ?? i18n.language;
  return useCallback(
    (slot: string, original: string): string => schemaText(schemaHash, language, slot, original),
    [schemaHash, language],
  );
}
