'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight as ChevronRightIcon, Eye, EyeOff, AlertTriangle, FileText } from 'lucide-react';
import { useWorkflowStore } from '@/lib/store/workflowStore';
import { FileTree } from '@/components/upload/FileTree';
import { Button } from '@/components/ui/Button';
import { getNodeTypeColor } from '@/lib/utils/colorUtils';
import { nodeTypeLabel, formatNumber, pluralize } from '@/lib/utils/formatUtils';
import type { NodeType } from '@/lib/types/graph';

const ALL_NODE_TYPES: NodeType[] = [
  'entry', 'component', 'hook', 'api', 'service',
  'database', 'config', 'style', 'test', 'external',
];


export function SidebarLeft() {
  const [collapsed, setCollapsed] = useState(false);
  
  const parsedProject = useWorkflowStore((s) => s.parsedProject);
  const aiEnrichment = useWorkflowStore((s) => s.aiEnrichment);
  const nodes = useWorkflowStore((s) => s.nodes);
  const edges = useWorkflowStore((s) => s.edges);
  const activeFilters = useWorkflowStore((s) => s.activeFilters);
  const toggleFilter = useWorkflowStore((s) => s.toggleFilter);
  const setReportOpen = useWorkflowStore((s) => s.setReportOpen);

  if (!parsedProject) return null;

  return (
    <>
      <motion.aside
        animate={{ width: collapsed ? 52 : 320 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="bg-surface border-r border-border-subtle flex flex-col shrink-0 overflow-hidden z-30"
        aria-label="Sidebar"
      >
        {/* Toggle button */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="h-10 flex items-center justify-center hover:bg-elevated transition-colors"
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <ChevronRightIcon size={16} className="text-text-muted" /> : <ChevronLeft size={16} className="text-text-muted" />}
        </button>

        {!collapsed && (
          <div className="flex-1 overflow-y-auto px-4 pb-5 space-y-5">
            {/* Project Overview */}
            <section>
              <h3 className="text-[10px] font-semibold text-text-muted uppercase tracking-wider mb-2">
                Project Overview
              </h3>
              <div className="mb-3 bg-gradient-to-br from-[#1A1D24] to-[#1E222A] p-4 rounded-xl border border-white/5 relative overflow-hidden">
                <p className="text-xs text-text-secondary leading-relaxed relative z-10">
                  {aiEnrichment?.projectSummary
                    ? aiEnrichment.projectSummary
                    : 'AI summary will appear once the model is ready and analysis completes.'}
                </p>
              </div>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setReportOpen(true)}
                icon={<FileText size={14} />}
                className="w-full justify-center bg-elevated/80 border border-border-muted hover:bg-overlay"
              >
                Open Full Project Overview
              </Button>
              <div className="grid grid-cols-2 gap-2 text-[11px] mt-3">
                <div className="bg-elevated rounded px-2.5 py-2 border border-border-subtle">
                  <span className="text-text-muted">Files</span>
                  <p className="font-semibold text-text-primary">{parsedProject.totalFiles}</p>
                </div>
                <div className="bg-elevated rounded px-2.5 py-2 border border-border-subtle">
                  <span className="text-text-muted">LOC</span>
                  <p className="font-semibold text-text-primary">{formatNumber(parsedProject.totalLinesOfCode)}</p>
                </div>
                <div className="bg-elevated rounded px-2.5 py-2 border border-border-subtle">
                  <span className="text-text-muted">Deps</span>
                  <p className="font-semibold text-text-primary">{parsedProject.dependencies.dependencies.length}</p>
                </div>
                <div className="bg-elevated rounded px-2.5 py-2 border border-border-subtle">
                  <span className="text-text-muted">Framework</span>
                  <p className="font-semibold text-text-primary text-[10px]">{parsedProject.detectedFramework}</p>
                </div>
              </div>
            </section>

          {/* File Tree */}
          <section>
            <h3 className="text-[10px] font-semibold text-text-muted uppercase tracking-wider mb-2">
              File Tree
            </h3>
            <FileTree />
          </section>

          {/* Layer Toggles */}
          <section>
            <h3 className="text-[10px] font-semibold text-text-muted uppercase tracking-wider mb-2">
              Layers
            </h3>
            <div className="space-y-0.5">
              {ALL_NODE_TYPES.map((type) => {
                const count = nodes.filter((n) => n.data.nodeType === type).length;
                const isActive = activeFilters.includes(type);
                const color = getNodeTypeColor(type);

                return (
                  <button
                    key={type}
                    className="w-full flex items-center gap-2 py-1 px-1.5 rounded hover:bg-elevated transition-colors"
                    onClick={() => toggleFilter(type)}
                    aria-label={`Toggle ${nodeTypeLabel(type)} nodes. ${count} nodes. Currently: ${isActive ? 'visible' : 'hidden'}`}
                  >
                    {isActive ? (
                      <Eye size={12} className="text-text-secondary" />
                    ) : (
                      <EyeOff size={12} className="text-text-disabled" />
                    )}
                    <div className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: color, opacity: isActive ? 1 : 0.3 }} />
                    <span className={`text-xs flex-1 text-left ${isActive ? 'text-text-primary' : 'text-text-disabled'}`}>
                      {nodeTypeLabel(type)}
                    </span>
                    <span className="text-[10px] text-text-muted">{count}</span>
                  </button>
                );
              })}
            </div>
          </section>

          {/* Graph Stats */}
          <section>
            <h3 className="text-[10px] font-semibold text-text-muted uppercase tracking-wider mb-2">
              Stats
            </h3>
            <div className="text-[11px] text-text-secondary space-y-1">
              <p>{pluralize(nodes.length, 'node')} - {pluralize(edges.length, 'edge')}</p>
              {nodes.length > 0 && (
                <p>Most connected: {
                  nodes.reduce((best, n) =>
                    (n.data.metrics.dependencies + n.data.metrics.dependents) >
                    (best.data.metrics.dependencies + best.data.metrics.dependents) ? n : best
                  ).data.label
                }</p>
              )}
            </div>

            {/* Warnings */}
            {(aiEnrichment?.warnings ?? []).length > 0 && (
              <div className="mt-2 space-y-1">
                {aiEnrichment?.warnings.map((w, i) => (
                  <div key={i} className="flex items-start gap-1.5 text-[11px] text-yellow-400">
                    <AlertTriangle size={12} className="shrink-0 mt-0.5" />
                    <span>{w}</span>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      )}
      </motion.aside>
    </>
  );
}
