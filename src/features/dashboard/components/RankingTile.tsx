/*
 * SPDX-FileCopyrightText: 2020 Stalwart Labs LLC <hello@stalw.art>
 *
 * SPDX-License-Identifier: LicenseRef-SEL
 */

import { Card } from '@/components/ui/card';
import { getChartColor } from '@/components/ui/chart';
import { cn } from '@/lib/utils';
import type { Ranking, Placement } from '../types/schema';
import type { Metric } from '../types/metrics';
import { formatValue, rankingEntries } from '../helpers';
import { toneClasses } from './tone';
import { TileHeader } from './TileHeader';
import { useSchemaText } from '@/hooks/useSchemaText';

interface RankingTileProps {
  dashboardId: string;
  itemIndex: number;
  ranking: Ranking & Placement;
  className?: string;
  historySamples: Metric[];
}

export function RankingTile({ dashboardId, itemIndex, ranking, className, historySamples }: RankingTileProps) {
  const display = useSchemaText();
  const title = display(`dashboard/${dashboardId}/item/${itemIndex}/title`, ranking.title);
  const description = ranking.description
    ? display(`dashboard/${dashboardId}/item/${itemIndex}/description`, ranking.description)
    : undefined;
  const seriesName = (original: string) => {
    const index = ranking.series.findIndex((series) => series.label === original);
    return index < 0 ? original : display(`dashboard/${dashboardId}/item/${itemIndex}/series/${index}/label`, original);
  };
  const toneClass = toneClasses(ranking.tone);
  const entries = rankingEntries(ranking, historySamples);
  const max = entries.reduce((m, e) => Math.max(m, e.value), 0);
  const format = ranking.valueFormat ?? 'number';

  return (
    <Card
      role="figure"
      aria-label={title}
      className={cn('flex flex-col gap-3.5 px-5 pb-5 pt-[18px]', toneClass.surface, className)}
    >
      <TileHeader
        icon={ranking.icon}
        title={title}
        description={description}
        badgeClass={toneClass.badge}
      />
      <ul className="grid gap-2.5">
        {entries.map((entry, i) => (
          <li
            key={entry.label}
            className="grid grid-cols-[minmax(0,7.5rem)_minmax(0,1fr)_minmax(3.5rem,auto)] items-center gap-3 text-[13px]"
          >
            <span className="truncate">{seriesName(entry.label)}</span>
            <span className={cn('h-2 overflow-hidden rounded-full', toneClass.track)} aria-hidden="true">
              <span
                className="block h-full rounded-full"
                style={{
                  width: max > 0 ? `${(entry.value / max) * 100}%` : '0%',
                  backgroundColor: getChartColor(i),
                }}
              />
            </span>
            <span className={cn('text-right tabular-nums', toneClass.muted)}>{formatValue(entry.value, format)}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}
