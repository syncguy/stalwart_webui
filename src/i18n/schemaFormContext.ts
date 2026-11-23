/*
 * SPDX-FileCopyrightText: 2026
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-SEL
 */

/** Pure display lookup context. Never changes schema keys, section IDs or data. */
export function sectionDisplayContext(
  sectionKey: string,
  formKey?: string,
  variantFormKey?: string,
  parentSectionCount = 0,
): { formKey?: string; sectionKey: string } {
  const match = /^section-(\d+)$/.exec(sectionKey);
  if (!match || !variantFormKey) return { formKey, sectionKey };
  const index = Number(match[1]);
  return index >= parentSectionCount
    ? { formKey: variantFormKey, sectionKey: `section-${index - parentSectionCount}` }
    : { formKey, sectionKey };
}
