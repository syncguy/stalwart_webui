/*
 * SPDX-FileCopyrightText: 2020 Stalwart Labs LLC <hello@stalw.art>
 *
 * SPDX-License-Identifier: LicenseRef-SEL
 */

import { useMemo } from 'react';
import { useSchemaText } from '@/hooks/useSchemaText';
import { useSchemaStore } from '@/stores/schemaStore';
import { getEnum } from '@/lib/schemaResolver';
import type { EnumVariant, Schema } from '@/types/schema';

export interface EventLabel {
  label: string;
  explanation?: string;
  known: boolean;
}

export interface TraceLabels {
  event: (eventType: string) => EventLabel;
  key: (key: string) => string;
}

type Display = (slot: string, original: string) => string;
const originalText: Display = (_slot, original) => original;
// Cache raw schema entries only. Translated closures are keyed by the reactive display callback.
const cache = new WeakMap<Schema, { events: Map<string, EnumVariant>; keys: Map<string, EnumVariant> }>();
const EMPTY_LABELS: TraceLabels = {
  event: (eventType) => ({ label: eventType, known: false }),
  key: (key) => key,
};

export function traceLabelsFor(schema: Schema | null, display: Display = originalText): TraceLabels {
  if (!schema) return EMPTY_LABELS;
  let entries = cache.get(schema);
  if (!entries) {
    entries = {
      events: new Map(getEnum(schema, 'EventType').map((e) => [e.name, e])),
      keys: new Map(getEnum(schema, 'Key').map((e) => [e.name, e])),
    };
    cache.set(schema, entries);
  }
  const { events, keys } = entries;
  return {
    event: (eventType) => {
      const entry = events.get(eventType);
      return entry ? {
        label: display(`enum/EventType/${entry.name}/label`, entry.label),
        explanation: entry.explanation === undefined ? undefined
          : display(`enum/EventType/${entry.name}/explanation`, entry.explanation),
        known: true,
      } : { label: eventType, known: false };
    },
    key: (key) => {
      const entry = keys.get(key);
      return entry ? display(`enum/Key/${entry.name}/label`, entry.label) : key;
    },
  };
}

export function useTraceLabels(): TraceLabels {
  const schema = useSchemaStore((s) => s.schema);
  const display = useSchemaText();
  return useMemo(() => traceLabelsFor(schema, display), [schema, display]);
}
