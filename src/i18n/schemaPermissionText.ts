/*
 * SPDX-FileCopyrightText: 2026
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-SEL
 */

import permissionCatalog from './schema/permission_ru.json';

type PermissionEntry = { original: string; ru: string };
const permissionLabels: Record<string, PermissionEntry> = permissionCatalog.entries;

/**
 * Display-only Russian labels, pinned to original server permission text.
 * Caller must also check the active schema hash and RU language.
 * Never change Permission enum names, keys or submitted values.
 */
export function permissionDisplayLabel(name: string, original: string): string {
  const entry = permissionLabels[name];
  return entry?.original === original ? entry.ru : original;
}
