/*
 * SPDX-FileCopyrightText: 2020 Stalwart Labs LLC <hello@stalw.art>
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-SEL
 */

import { useEffect, useId, useRef, useState, type ReactElement } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ChevronRight, Lock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { DynamicIcon } from '@/components/common/DynamicIcon';
import { EnterpriseUpsell } from '@/components/common/EnterpriseUpsell';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useUIStore } from '@/stores/uiStore';
import type { Layout } from '@/types/schema';
import { useSchemaText } from '@/hooks/useSchemaText';
import { activeViewName, layoutNavNodes, navNodeKey, someLink, viewPath, type NavNode } from './navTree';
import { SIDEBAR_ID, SidebarNavContext, useSidebarNav } from './sidebarContext';
import { useLayoutNavigation } from './useLayoutNavigation';

const itemClass =
  'flex w-full items-center gap-2.5 rounded-[10px] px-2.5 text-left font-medium text-muted-foreground outline-none transition-colors duration-200 hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring';

function itemSize(depth: number) {
  return depth > 0 ? 'h-8 text-[13px]' : 'h-9 text-sm';
}

// The actual link/button stays the tooltip trigger and the sole tab stop.
export function WebuiRuNavOverflowHint({ text, children }: { text: string; children: (label: ReactElement) => ReactElement }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [overflow, setOverflow] = useState(false);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    let active = true;
    const measure = () => {
      if (active) setOverflow(element.scrollWidth > element.clientWidth);
    };
    measure();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    observer?.observe(element);
    window.addEventListener('resize', measure);
    void document.fonts?.ready.then(measure);
    return () => {
      active = false;
      observer?.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [text]);
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        {children(<span ref={ref} className="min-w-0 truncate">{text}</span>)}
      </TooltipTrigger>
      {overflow && <TooltipContent side="right" className="max-w-xs whitespace-normal break-words">{text}</TooltipContent>}
    </Tooltip>
  );
}

function NavLink({ node, depth }: { node: Extract<NavNode, { kind: 'link' }>; depth: number }) {
  const { t } = useTranslation();
  const display = useSchemaText();
  const nav = useSidebarNav();
  const ref = useRef<HTMLAnchorElement>(null);
  const isActive = node.viewName === nav.activeViewName;

  useEffect(() => {
    if (isActive) ref.current?.scrollIntoView?.({ block: 'nearest' });
  }, [isActive]);

  if (!nav.isVisible(node.viewName)) return null;

  const label = node.name ? display(node.displaySlot, node.name) : t('sidebar.overview', 'Overview');
  const className = cn(itemClass, itemSize(depth));
  const icon = node.icon && <DynamicIcon name={node.icon} className="h-4 w-4 shrink-0" />;

  return (
    <WebuiRuNavOverflowHint text={label}>
      {(labelElement) => nav.isLocked(node.viewName) ? (
        <button type="button" className={className} onClick={nav.openUpsell} aria-describedby={nav.lockedHintId}>
          {icon}
          {labelElement}
          <Lock aria-hidden="true" className="ml-auto h-3 w-3 shrink-0 text-muted-foreground" />
        </button>
      ) : (
        <Link
          ref={ref}
          to={viewPath(nav.sectionName, node.viewName)}
          aria-current={isActive ? 'page' : undefined}
          className={cn(
            className,
            isActive &&
              'bg-highlight font-semibold text-highlight-foreground hover:bg-highlight hover:text-highlight-foreground',
          )}
        >
          {icon}
          {labelElement}
        </Link>
      )}
    </WebuiRuNavOverflowHint>
  );
}

function NavContainer({ node, depth }: { node: Extract<NavNode, { kind: 'container' }>; depth: number }) {
  const nav = useSidebarNav();
  const display = useSchemaText();
  const containsActive = someLink(node.children, (viewName) => viewName === nav.activeViewName);
  const [open, setOpen] = useState(containsActive);
  const [prevContainsActive, setPrevContainsActive] = useState(containsActive);
  if (containsActive !== prevContainsActive) {
    setPrevContainsActive(containsActive);
    if (containsActive) setOpen(true);
  }

  if (!someLink(node.children, nav.isVisible)) return null;

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <WebuiRuNavOverflowHint text={display(node.displaySlot, node.name)}>
        {(labelElement) => (
          <CollapsibleTrigger asChild>
            <button type="button" className={cn(itemClass, itemSize(depth))}>
              {node.icon && <DynamicIcon name={node.icon} className="h-4 w-4 shrink-0" />}
              {labelElement}
              <ChevronRight
                aria-hidden="true"
                className="ml-auto h-3.5 w-3.5 shrink-0 opacity-60 transition-transform duration-200 [[aria-expanded=true]>&]:rotate-90"
              />
            </button>
          </CollapsibleTrigger>
        )}
      </WebuiRuNavOverflowHint>
      <CollapsibleContent>
        <div className="my-0.5 ml-[18px] flex flex-col gap-0.5 border-l border-input pl-2">
          <NavNodes nodes={node.children} depth={depth + 1} />
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

function NavNodes({ nodes, depth }: { nodes: NavNode[]; depth: number }) {
  return nodes.map((node) =>
    node.kind === 'link' ? (
      <NavLink key={navNodeKey(node)} node={node} depth={depth} />
    ) : (
      <NavContainer key={navNodeKey(node)} node={node} depth={depth} />
    ),
  );
}

function SectionSwitcher({ layouts, activeSection }: { layouts: Layout[]; activeSection: string }) {
  const { t } = useTranslation();
  const display = useSchemaText();
  const navigate = useNavigate();
  const setActiveSection = useUIStore((s) => s.setActiveSection);
  const { landingPath } = useLayoutNavigation();

  return (
    <div
      role="group"
      aria-label={t('sections', 'Sections')}
      className="m-2.5 mt-0 flex items-center gap-0.5 rounded-full bg-muted p-1"
    >
      {layouts.map((target) => {
        const isActive = target.name === activeSection;
        return (
          <Tooltip key={target.name}>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={display(`layout/${target.name}`, target.name)}
                aria-pressed={isActive}
                onClick={() => {
                  setActiveSection(target.name);
                  const path = landingPath(target);
                  if (path) navigate(path);
                }}
                className={cn(
                  'h-8 flex-1 rounded-full',
                  isActive && 'bg-card text-foreground shadow-tile hover:bg-card hover:text-foreground',
                )}
              >
                <DynamicIcon name={target.icon} className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">{display(`layout/${target.name}`, target.name)}</TooltipContent>
          </Tooltip>
        );
      })}
    </div>
  );
}

export function Sidebar({ width, maxWidth, onWidthChange }: { width: number; maxWidth: number; onWidthChange: (width: number) => void }) {
  const { t } = useTranslation();
  const display = useSchemaText();
  const { pathname } = useLocation();
  const activeSection = useUIStore((s) => s.activeSection);
  const sidebarOpen = useUIStore((s) => s.sidebarOpen);
  const setSidebarOpen = useUIStore((s) => s.setSidebarOpen);
  const { layouts, isVisible, isLocked } = useLayoutNavigation();
  const [upsellOpen, setUpsellOpen] = useState(false);
  const lockedHintId = useId();
  const drag = useRef<{ x: number; width: number } | null>(null);

  useEffect(() => {
    if (window.matchMedia('(max-width: 767px)').matches) setSidebarOpen(false);
  }, [pathname, setSidebarOpen]);

  if (!sidebarOpen) return null;
  const layout = layouts.find((l) => l.name === activeSection);
  if (!layout) return null;

  const nodes = layoutNavNodes(layout);
  const nav = {
    sectionName: layout.name,
    pathname,
    activeViewName: activeViewName(nodes, pathname, layout.name),
    isVisible,
    isLocked,
    openUpsell: () => setUpsellOpen(true),
    lockedHintId,
  };

  return (
    <>
      <div
        aria-hidden="true"
        className="fixed inset-0 top-16 z-20 bg-overlay md:hidden"
        onClick={() => setSidebarOpen(false)}
      />
      <aside
        id={SIDEBAR_ID}
        aria-label={t('sidebar.label', 'Sidebar')}
        className="fixed bottom-3 left-3 top-16 z-30 flex w-60 flex-col tile overflow-hidden md:w-[var(--webui-ru-sidebar-width)]"
      >
        <span id={lockedHintId} className="sr-only">
          {t('enterprise.featureHint', 'Enterprise feature')}
        </span>
        <div className="flex-1 overflow-y-auto py-2.5 [scrollbar-width:thin]">
          <nav aria-label={display(`layout/${layout.name}`, layout.name)} className="flex flex-col gap-0.5 px-2.5">
            <SidebarNavContext value={nav}>
              <NavNodes nodes={nodes} depth={0} />
            </SidebarNavContext>
          </nav>
        </div>

        {layouts.length > 1 && <SectionSwitcher layouts={layouts} activeSection={activeSection} />}

        <EnterpriseUpsell open={upsellOpen} onClose={() => setUpsellOpen(false)} />
      </aside>
      <div
        role="separator"
        aria-label={t('sidebar.label', 'Sidebar')}
        aria-orientation="vertical"
        aria-controls={SIDEBAR_ID}
        aria-valuemin={200}
        aria-valuemax={maxWidth}
        aria-valuenow={width}
        tabIndex={0}
        className="group fixed bottom-3 top-16 z-30 hidden w-2.5 cursor-col-resize touch-none select-none items-center justify-center outline-none focus-visible:ring-2 focus-visible:ring-ring md:flex"
        style={{ left: 'calc(var(--webui-ru-sidebar-width) + 12px)' }}
        onPointerDown={(event) => {
          if (event.button !== 0 || !event.isPrimary) return;
          event.preventDefault();
          event.currentTarget.focus();
          event.currentTarget.setPointerCapture(event.pointerId);
          drag.current = { x: event.clientX, width };
        }}
        onPointerMove={(event) => {
          if (drag.current && event.currentTarget.hasPointerCapture(event.pointerId)) {
            onWidthChange(drag.current.width + event.clientX - drag.current.x);
          }
        }}
        onLostPointerCapture={() => { drag.current = null; }}
        onDoubleClick={() => onWidthChange(240)}
        onKeyDown={(event) => {
          const next = event.key === 'ArrowLeft' ? width - 12 : event.key === 'ArrowRight' ? width + 12 :
            event.key === 'Home' ? 200 : event.key === 'End' ? maxWidth : null;
          if (next !== null) {
            event.preventDefault();
            onWidthChange(next);
          }
        }}
      >
        <span aria-hidden="true" className="h-12 w-1 rounded-full bg-input opacity-70 transition-colors group-hover:bg-primary group-focus-visible:bg-primary" />
      </div>
    </>
  );
}
