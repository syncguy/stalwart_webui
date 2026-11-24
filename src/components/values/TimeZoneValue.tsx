/*
 * SPDX-FileCopyrightText: 2020 Stalwart Labs LLC <hello@stalw.art>
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-SEL
 */

import { useState } from 'react';
import { formatUtcOffset } from '@/lib/format';
import { useSchemaText } from '@/hooks/useSchemaText';
import { getEnumVariant } from '@/lib/schemaResolver';
import type { ValueProps } from '@/extensions/types';

export function TimeZoneValue({ schema, type, value, variant }: ValueProps) {
  const display = useSchemaText();
  const [now] = useState(() => new Date());
  const name = String(value);
  const entry = type.type === 'enum' ? getEnumVariant(schema, type.enumName, name) : undefined;
  const label = entry && type.type === 'enum'
    ? display(`enum/${type.enumName}/${name}/label`, entry.label) : name;
  const offset = variant === 'full' ? formatUtcOffset(name, now) : null;
  return (
    <span className="text-sm">
      {label}
      {offset && <span className="ms-1.5 text-muted-foreground tabular-nums">({offset})</span>}
    </span>
  );
}
