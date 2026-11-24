/*
 * SPDX-FileCopyrightText: 2020 Stalwart Labs LLC <hello@stalw.art>
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-SEL
 */

import { useTranslation } from 'react-i18next';
import { ChevronLeft, ChevronRight } from 'lucide-react';

import { Button } from '@/components/ui/button';
import type { PageRange } from './listQuery';

interface PaginationProps {
  range: PageRange;
  total: number | null;
  count: number;
  pluralName: string;
  disabled: boolean;
  onPrev: () => void;
  onNext: () => void;
}

export function Pagination({ range, total, count, pluralName, disabled, onPrev, onNext }: PaginationProps) {
  const { t, i18n } = useTranslation();
  // Source schemas contain English collection names and Russian case forms
  // cannot be derived reliably from singular/plural labels. Use a neutral
  // count-only footer in RU; preserve the upstream named footer in EN.
  const isRussian = (i18n.resolvedLanguage ?? i18n.language).split(/[-_]/)[0].toLowerCase() === 'ru';
  const summary = total === null
    ? t('list.showingItems', 'Showing {{count}} items', { count })
    : isRussian
      ? t('webuiRu.list.showingRange', 'Showing {{from}}-{{to}} of {{total}}', {
          from: range.from,
          to: range.to,
          total,
        })
      : t('list.showing', 'Showing {{from}}-{{to}} of {{total}} {{name}}', {
          from: range.from,
          to: range.to,
          total,
          name: pluralName,
        });
  return (
    <nav
      aria-label={t('list.pagination', 'Pagination')}
      className="flex flex-wrap items-center justify-between gap-2 border-t border-border py-2.5 pl-5 pr-2.5 text-[13px] text-muted-foreground"
    >
      <p aria-live="polite">{summary}</p>
      <div className="flex items-center gap-1.5">
        <Button variant="secondary" size="sm" disabled={!range.hasPrev || disabled} onClick={onPrev}>
          <ChevronLeft aria-hidden />
          {t('list.previous', 'Previous')}
        </Button>
        <Button variant="secondary" size="sm" disabled={!range.hasNext || disabled} onClick={onNext}>
          {t('list.next', 'Next')}
          <ChevronRight aria-hidden />
        </Button>
      </div>
    </nav>
  );
}
