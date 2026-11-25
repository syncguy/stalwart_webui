/* SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-SEL */
import { useEffect, useRef, useState } from 'react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

/** Full localized text on hover and keyboard focus when clipped. */
export function OverflowText({ text, className }: { text: string; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [overflow, setOverflow] = useState(false);
  useEffect(() => {
    const element = ref.current;
    if (!element || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => {
      setOverflow(element.scrollWidth > element.clientWidth);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [text]);
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          ref={ref}
          className={cn('block min-w-0 truncate', className)}
          tabIndex={overflow ? 0 : undefined}
          title={typeof ResizeObserver === 'undefined' ? text : undefined}
        >
          {text}
        </span>
      </TooltipTrigger>
      {overflow && <TooltipContent className="max-w-xs whitespace-normal break-words">{text}</TooltipContent>}
    </Tooltip>
  );
}
