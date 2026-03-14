'use client';

import { useWorkflowStore } from '@/lib/store/workflowStore';
import { formatDuration, zoomPercentage } from '@/lib/utils/formatUtils';
import { useState, useEffect } from 'react';

export function StatsBar() {
  const parsedProject = useWorkflowStore((s) => s.parsedProject);
  const nodes = useWorkflowStore((s) => s.nodes);
  const edges = useWorkflowStore((s) => s.edges);
  const selectedNodeId = useWorkflowStore((s) => s.selectedNodeId);
  const projectMeta = useWorkflowStore((s) => s.projectMeta);
  const aiModel = useWorkflowStore((s) => s.aiModel);
  const selectedNode = nodes.find((n) => n.id === selectedNodeId);

  const [zoom, setZoom] = useState(1);

  // Listen to viewport changes
  useEffect(() => {
    const interval = setInterval(() => {
      const viewport = document.querySelector('.react-flow__viewport');
      if (viewport) {
        const transform = viewport.getAttribute('transform') ?? '';
        const scaleMatch = /scale\(([^)]+)\)/.exec(transform);
        if (scaleMatch) {
          setZoom(parseFloat(scaleMatch[1]));
        }
      }
    }, 500);
    return () => clearInterval(interval);
  }, []);

  if (!parsedProject) return null;

  return (
    <footer
      className="h-7 bg-surface border-t border-border-subtle flex items-center justify-between px-4 text-[10px] text-text-muted shrink-0"
      aria-label="Status bar"
    >
      <div className="flex items-center gap-4">
        <span>{parsedProject.totalFiles} files</span>
        <span>{nodes.length} nodes</span>
        <span>{edges.length} edges</span>
        <span>{parsedProject.detectedLanguages.slice(0, 3).join(', ')}</span>
      </div>

      <div className="flex items-center gap-4">
        <span>Zoom: {zoomPercentage(zoom)}</span>
        {selectedNode && (
          <span className="text-text-secondary">
            Selected: {selectedNode.data.label}
          </span>
        )}
        {projectMeta && (
          <span>
            Analyzed by {aiModel ?? 'AI'} · {formatDuration(projectMeta.processingTimeMs)}
            {projectMeta.aiAvailable ? '' : ' (static only)'}
          </span>
        )}
      </div>
    </footer>
  );
}
