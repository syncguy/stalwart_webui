/*
 * SPDX-FileCopyrightText: 2020 Stalwart Labs LLC <hello@stalw.art>
 *
 * SPDX-License-Identifier: LicenseRef-SEL
 */

import { useTranslation } from 'react-i18next';
import { Card } from '@/components/ui/card';
import { formatPercent } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { Headline, Placement } from '../types/schema';
import type { Metric } from '../types/metrics';
import { headlineRatio } from '../helpers';
import { toneClasses } from './tone';
import { TileHeader } from './TileHeader';
import { useSchemaText } from '@/hooks/useSchemaText';

interface HeadlineTileProps {
  dashboardId: string;
  itemIndex: number;
  headline: Headline & Placement;
  className?: string;
  historySamples: Metric[];
}

export function HeadlineTile({ dashboardId, itemIndex, headline, className, historySamples }: HeadlineTileProps) {
  const { t } = useTranslation();
  const display = useSchemaText();
  const title = display(`dashboard/${dashboardId}/item/${itemIndex}/title`, headline.title);
  const description = headline.description
    ? display(`dashboard/${dashboardId}/item/${itemIndex}/description`, headline.description)
    : undefined;
  const toneClass = toneClasses(headline.tone);
  const ratio = headlineRatio(headline, historySamples);

  return (
    <Card
      role="figure"
      aria-label={title}
      className={cn('flex min-h-[148px] flex-col gap-3 px-5 pb-5 pt-[18px]', toneClass.surface, className)}
    >
      <TileHeader icon={headline.icon} title={title} badgeClass={toneClass.badge} />
      <div
        data-slot="headline-value"
        className="font-display text-[2.75rem] font-[750] leading-none tracking-[-0.035em] tabular-nums"
      >
        {ratio === null ? t('dashboard.noData', 'No data') : formatPercent(ratio * 100)}
      </div>
      {description && (
        <p className={cn('text-[13px] leading-relaxed', toneClass.muted)}>{description}</p>
      )}
    </Card>
  );
}
