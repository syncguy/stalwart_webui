/*
 * SPDX-FileCopyrightText: 2026
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-SEL
 */

import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { canTranslateSchema, schemaActionName, schemaText } from '@/i18n/schemaText';
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

/** True only for the supported Russian locale on a source-verified schema. */
export function useCanTranslateSchema(): boolean {
  const schemaHash = useSchemaStore((state) => state.schemaHash);
  const { i18n } = useTranslation();
  return canTranslateSchema(schemaHash, i18n.resolvedLanguage ?? i18n.language);
}

/** Context-specific grammatical form, never a schema identifier. */
export function useSchemaActionName() {
  const schemaHash = useSchemaStore((state) => state.schemaHash);
  const { i18n } = useTranslation();
  const language = i18n.resolvedLanguage ?? i18n.language;
  return useCallback(
    (slot: string, original: string) => schemaActionName(schemaHash, language, slot, original),
    [schemaHash, language],
  );
}
