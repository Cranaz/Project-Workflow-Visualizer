'use client';

import { useCallback, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, FileCode, ArrowRight, ArrowLeft } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useNodeDetails } from '@/hooks/useNodeDetails';
import { useWorkflowStore } from '@/lib/store/workflowStore';
import { Badge } from '@/components/ui/Badge';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { getNodeTypeColor } from '@/lib/utils/colorUtils';
import { nodeTypeLabel, formatNumber } from '@/lib/utils/formatUtils';

export function DetailDrawer() {
  const isOpen = useWorkflowStore((s) => s.isDrawerOpen);
  const selectNode = useWorkflowStore((s) => s.selectNode);
  const aiStatus = useWorkflowStore((s) => s.aiStatus);
  const parsedProject = useWorkflowStore((s) => s.parsedProject);
  const fileOverviews = useWorkflowStore((s) => s.fileOverviews);
  const setFileOverview = useWorkflowStore((s) => s.setFileOverview);
  const { selectedNode, connectedFiles } = useNodeDetails();

  const handleClose = useCallback(() => {
    selectNode(null);
  }, [selectNode]);

  const selectedFilePath = selectedNode?.data.filePath ?? null;
  const overviewEntry = selectedFilePath ? fileOverviews[selectedFilePath] : undefined;
  const overviewStatus = overviewEntry?.status;
  const overviewHint = useMemo(() => {
    if (aiStatus === 'starting') {
      return 'AI engine is starting. File overview will appear automatically.';
    }
    if (aiStatus === 'pulling') {
      return 'Downloading the model. File overview will appear automatically.';
    }
    if (aiStatus === 'limited') {
      return 'Model is still warming up. File overview will appear automatically.';
    }
    if (aiStatus === 'offline') {
      return 'AI engine is unavailable right now. We will keep retrying automatically.';
    }
    return '';
  }, [aiStatus]);

  const requestOverview = useCallback(
    async (signal?: AbortSignal) => {
      if (!selectedNode || aiStatus !== 'ready') return;
      const filePath = selectedNode.data.filePath;
      const fileRecord = parsedProject?.files.find((f) => f.filePath === filePath);

      if (!fileRecord?.rawContent) {
        setFileOverview(filePath, {
          status: 'error',
          content: '',
          error: 'File content unavailable for overview generation.',
        });
        return;
      }

      setFileOverview(filePath, { status: 'loading', content: '' });

      try {
        const response = await fetch('/api/file-overview', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal,
          body: JSON.stringify({
            filePath,
            content: fileRecord.rawContent,
            language: fileRecord.language,
            lineCount: fileRecord.lineCount,
            imports: fileRecord.imports,
            exports: fileRecord.exports,
            projectName: parsedProject?.projectName,
            framework: parsedProject?.detectedFramework,
          }),
        });

        const data = (await response.json()) as { success?: boolean; overview?: string; error?: string };
        if (!response.ok || !data?.success) {
          throw new Error(data?.error ?? `Overview failed (${response.status})`);
        }

        setFileOverview(filePath, {
          status: 'ready',
          content: data.overview ?? '',
        });
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') return;
        const message = err instanceof Error ? err.message : 'Failed to generate overview';
        setFileOverview(filePath, { status: 'error', content: '', error: message });
      }
    },
    [aiStatus, parsedProject, selectedNode, setFileOverview]
  );

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        handleClose();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, handleClose]);

  useEffect(() => {
    if (!selectedNode) return;
    if (aiStatus !== 'ready') return;
    if (overviewStatus === 'loading' || overviewStatus === 'ready') return;

    const controller = new AbortController();
    void requestOverview(controller.signal);
    return () => controller.abort();
  }, [selectedNode, aiStatus, overviewStatus, requestOverview]);

  if (!selectedNode) return null;
  const data = selectedNode.data;
  const color = getNodeTypeColor(data.nodeType);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ x: 420, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: 420, opacity: 0 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="fixed right-0 top-[52px] bottom-0 w-[380px] md:w-[420px] bg-surface border-l border-border-muted z-50 overflow-y-auto"
          style={{ backdropFilter: 'blur(12px)' }}
          role="dialog"
          aria-label={`Details for ${data.label}`}
        >
          {/* Header */}
          <div className="sticky top-0 bg-surface border-b border-border-subtle p-4 z-10">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Badge color={color} variant="solid" size="md">
                  {nodeTypeLabel(data.nodeType)}
                </Badge>
                <Badge variant="outline" size="md">{data.language}</Badge>
              </div>
              <button
                onClick={handleClose}
                className="p-1.5 rounded-md hover:bg-elevated transition-colors"
                aria-label="Close details"
              >
                <X size={16} className="text-text-secondary" />
              </button>
            </div>
            <h2 className="text-lg font-bold text-text-primary mt-2">{data.label}</h2>
            <p className="text-xs text-text-muted font-mono mt-0.5">{data.filePath}</p>
            <div className="flex items-center gap-2 mt-2">
              <Badge variant="outline" size="sm">{data.lineCount} lines</Badge>
              {data.subsystem && (
                <Badge color={color} size="sm">{data.subsystem}</Badge>
              )}
            </div>
          </div>

          <div className="p-4 space-y-5">
            {/* File Overview */}
            <section>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wider">
                  File Overview
                </h3>
                {overviewStatus === 'error' && aiStatus === 'ready' && (
                  <button
                    onClick={() => requestOverview()}
                    className="text-[10px] font-semibold text-accent-primary hover:text-accent-hover transition-colors"
                  >
                    Retry
                  </button>
                )}
              </div>

              {aiStatus !== 'ready' && (
                <div className="text-[11px] text-text-muted bg-elevated/60 border border-border-subtle rounded-lg p-2.5">
                  {overviewHint}
                </div>
              )}

              {aiStatus === 'ready' && overviewStatus === 'loading' && (
                <div className="flex items-center gap-2 text-xs text-text-secondary bg-elevated/60 border border-border-subtle rounded-lg p-2.5">
                  <LoadingSpinner size="sm" className="justify-start gap-2" label="Generating overview" />
                  <span>Generating detailed overview...</span>
                </div>
              )}

              {aiStatus === 'ready' && overviewStatus === 'error' && (
                <div className="text-[11px] text-red-300 bg-red-500/10 border border-red-500/20 rounded-lg p-2.5">
                  {overviewEntry?.error ?? 'Failed to generate overview.'}
                </div>
              )}

              {aiStatus === 'ready' && overviewStatus === 'ready' && overviewEntry?.content && (
                <div className="bg-elevated/40 border border-border-subtle rounded-lg p-3">
                  <div className="prose prose-invert prose-sm max-w-none text-text-secondary">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {overviewEntry.content}
                    </ReactMarkdown>
                  </div>
                </div>
              )}
            </section>

            {/* AI Analysis */}
            {(data.description || data.responsibility) && (
              <section>
                <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">
                  AI Analysis
                </h3>
                {data.description && (
                  <div className="mb-2">
                    <p className="text-[11px] text-text-muted">Purpose</p>
                    <p className="text-sm text-text-primary">{data.description}</p>
                  </div>
                )}
                {data.responsibility && (
                  <div className="mb-2">
                    <p className="text-[11px] text-text-muted">Responsibility</p>
                    <p className="text-sm text-text-primary">{data.responsibility}</p>
                  </div>
                )}
                {data.dataIn && (
                  <div className="mb-2">
                    <p className="text-[11px] text-text-muted">Data In</p>
                    <p className="text-sm text-text-primary">{data.dataIn}</p>
                  </div>
                )}
                {data.dataOut && (
                  <div>
                    <p className="text-[11px] text-text-muted">Data Out</p>
                    <p className="text-sm text-text-primary">{data.dataOut}</p>
                  </div>
                )}
              </section>
            )}

            {/* Exports */}
            {data.exports.length > 0 && (
              <section>
                <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">
                  Exports ({data.exports.length})
                </h3>
                <div className="flex flex-wrap gap-1">
                  {data.exports.map((exp) => (
                    <Badge key={exp} variant="outline" size="sm">
                      {exp}
                    </Badge>
                  ))}
                </div>
              </section>
            )}

            {/* Imports */}
            {data.imports.length > 0 && (
              <section>
                <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">
                  Imports ({data.imports.length})
                </h3>
                <div className="space-y-1">
                  {data.imports.slice(0, 20).map((imp, i) => (
                    <div key={`${imp.source}-${i}`} className="flex items-center gap-2">
                      <FileCode size={10} className="text-text-muted shrink-0" aria-hidden="true" />
                      <span className="text-xs font-mono text-text-secondary truncate">{imp.source}</span>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Metrics */}
            <section>
              <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">
                Metrics
              </h3>
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-elevated rounded-lg p-2.5 border border-border-subtle">
                  <p className="text-[10px] text-text-muted">Lines of Code</p>
                  <p className="text-lg font-bold text-text-primary">{formatNumber(data.lineCount)}</p>
                </div>
                <div className="bg-elevated rounded-lg p-2.5 border border-border-subtle">
                  <p className="text-[10px] text-text-muted">Dependencies</p>
                  <p className="text-lg font-bold text-text-primary">{data.metrics.dependencies}</p>
                </div>
                <div className="bg-elevated rounded-lg p-2.5 border border-border-subtle">
                  <p className="text-[10px] text-text-muted">Dependents</p>
                  <p className="text-lg font-bold text-text-primary">{data.metrics.dependents}</p>
                </div>
              </div>
            </section>

            {/* Highlights */}
            {data.highlights.length > 0 && (
              <section>
                <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">
                  Highlights
                </h3>
                <div className="flex flex-wrap gap-1">
                  {data.highlights.map((h, i) => (
                    <Badge key={i} variant="subtle" size="sm" color={color}>
                      {h}
                    </Badge>
                  ))}
                </div>
              </section>
            )}

            {/* Connected Files */}
            {(connectedFiles.importedBy.length > 0 || connectedFiles.importing.length > 0) && (
              <section>
                <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">
                  Connected Files
                </h3>
                {connectedFiles.importedBy.length > 0 && (
                  <div className="mb-2">
                    <p className="text-[10px] text-text-muted mb-1 flex items-center gap-1">
                      <ArrowLeft size={10} aria-hidden="true" /> Imported by
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {connectedFiles.importedBy.map((n) => (
                        <button
                          key={n.id}
                          onClick={() => selectNode(n.id)}
                          className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-elevated border border-border-subtle hover:border-border-default transition-colors text-text-secondary"
                        >
                          {n.data.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {connectedFiles.importing.length > 0 && (
                  <div>
                    <p className="text-[10px] text-text-muted mb-1 flex items-center gap-1">
                      <ArrowRight size={10} aria-hidden="true" /> Imports
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {connectedFiles.importing.map((n) => (
                        <button
                          key={n.id}
                          onClick={() => selectNode(n.id)}
                          className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-elevated border border-border-subtle hover:border-border-default transition-colors text-text-secondary"
                        >
                          {n.data.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </section>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
