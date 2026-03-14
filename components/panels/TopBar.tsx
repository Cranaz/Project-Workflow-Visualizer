'use client';

import { useEffect, useState } from 'react';
import { Search, ArrowLeftRight, LayoutGrid, Upload, FileText } from 'lucide-react';
import { useWorkflowStore } from '@/lib/store/workflowStore';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { DetailedReportModal } from './DetailedReportModal';
import { getLanguageColor } from '@/lib/utils/colorUtils';
import { formatPercentage } from '@/lib/utils/formatUtils';
import type { AiStatus } from '@/lib/types/project';

export function TopBar() {
  const parsedProject = useWorkflowStore((s) => s.parsedProject);
  const searchQuery = useWorkflowStore((s) => s.searchQuery);
  const setSearchQuery = useWorkflowStore((s) => s.setSearchQuery);
  const layoutDirection = useWorkflowStore((s) => s.layoutDirection);
  const setLayoutDirection = useWorkflowStore((s) => s.setLayoutDirection);
  const isClusterMode = useWorkflowStore((s) => s.isClusterMode);
  const toggleClusterMode = useWorkflowStore((s) => s.toggleClusterMode);
  const aiStatus = useWorkflowStore((s) => s.aiStatus);
  const aiDetail = useWorkflowStore((s) => s.aiDetail);
  const resetStore = useWorkflowStore((s) => s.resetStore);
  const isReportOpen = useWorkflowStore((s) => s.isReportOpen);
  const setReportOpen = useWorkflowStore((s) => s.setReportOpen);
  const aiEnrichment = useWorkflowStore((s) => s.aiEnrichment);
  const [searchFocused, setSearchFocused] = useState(false);

  const aiStatusLabel: Record<AiStatus, string> = {
    ready: 'AI Ready',
    starting: 'AI Starting',
    pulling: 'AI Downloading',
    limited: 'AI Limited',
    offline: 'AI Offline',
  };

  const aiStatusColor: Record<AiStatus, string> = {
    ready: '#10B981',
    starting: '#38BDF8',
    pulling: '#60A5FA',
    limited: '#F59E0B',
    offline: '#EF4444',
  };

  // Language breakdown
  const languageBreakdown = (() => {
    if (!parsedProject) return [];
    const total = parsedProject.files.length;
    const counts = new Map<string, number>();
    for (const f of parsedProject.files) {
      counts.set(f.language, (counts.get(f.language) ?? 0) + 1);
    }
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([lang, count]) => ({
        lang,
        pct: formatPercentage(count, total),
        color: getLanguageColor(lang),
      }));
  })();

  // Keyboard shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === 'f') {
        e.preventDefault();
        document.getElementById('canvas-search')?.focus();
      }
      if (e.ctrlKey && e.key === 'l') {
        e.preventDefault();
        setLayoutDirection(layoutDirection === 'TB' ? 'LR' : 'TB');
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [layoutDirection, setLayoutDirection]);

  return (
    <header className="h-[52px] bg-surface border-b border-border-subtle flex items-center justify-between px-4 shrink-0 z-40">
      {/* Left */}
      <div className="flex items-center gap-3">
        <span className="text-sm font-bold text-gradient">PWV</span>
        {parsedProject && (
          <>
            <span className="text-sm font-semibold text-text-primary">
              {parsedProject.projectName}
            </span>
            <Badge variant="solid" size="sm" color={getLanguageColor(parsedProject.detectedFramework)}>
              {parsedProject.detectedFramework}
            </Badge>
            <div className="flex items-center gap-1 ml-2">
              {languageBreakdown.length > 3 ? (
                <>
                  {languageBreakdown.slice(0, 2).map(({ lang, pct, color }) => (
                    <Badge key={lang} color={color} size="sm" variant="outline">
                      {lang} {pct}%
                    </Badge>
                  ))}
                  <Badge color="#6366F1" size="sm" variant="solid" className="cursor-help">
                    +{languageBreakdown.length - 2} More
                  </Badge>
                </>
              ) : (
                languageBreakdown.map(({ lang, pct, color }) => (
                  <Badge key={lang} color={color} size="sm" variant="outline">
                    {lang} {pct}%
                  </Badge>
                ))
              )}
            </div>
          </>
        )}
      </div>

      {/* Center */}
      <div className="flex items-center gap-2">
        <div className={`relative ${searchFocused ? 'w-64' : 'w-48'} transition-all duration-200`}>
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted" />
          <input
            id="canvas-search"
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
            placeholder="Search nodes..."
            className="w-full bg-elevated border border-border-subtle rounded-lg pl-8 pr-3 py-1.5 text-xs text-text-primary placeholder:text-text-disabled focus:border-accent-primary focus:outline-none transition-colors"
            aria-label="Search nodes on canvas"
          />
        </div>
      </div>

      {/* Right */}
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1.5">
          <div
            className="w-2 h-2 rounded-full"
            style={{ backgroundColor: aiStatusColor[aiStatus] }}
            aria-hidden="true"
          />
          <span className="text-[11px] text-text-secondary">{aiStatusLabel[aiStatus]}</span>
        </div>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => setLayoutDirection(layoutDirection === 'TB' ? 'LR' : 'TB')}
          aria-label={`Switch layout direction. Currently: ${layoutDirection}`}
        >
          <ArrowLeftRight size={14} />
          <span className="text-[11px]">{layoutDirection}</span>
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={toggleClusterMode}
          aria-label={`Toggle cluster mode. Currently: ${isClusterMode ? 'on' : 'off'}`}
        >
          <LayoutGrid size={14} />
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={resetStore}
          icon={<Upload size={14} />}
          aria-label="Upload new project"
        >
          New
        </Button>

        {parsedProject && (
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setReportOpen(true)}
            icon={<FileText size={14} />}
            className="border border-border-muted"
          >
            Project Overview
          </Button>
        )}
      </div>

      {parsedProject && (
        <DetailedReportModal
          isOpen={isReportOpen}
          onClose={() => setReportOpen(false)}
          reportContent={aiEnrichment?.detailedReport || ''}
          projectName={parsedProject.projectName}
          aiStatus={aiStatus}
          aiDetail={aiDetail}
        />
      )}
    </header>
  );
}
