'use client';

import { useMemo } from 'react';
import { useWorkflowStore, useSelectedNode } from '@/lib/store/workflowStore';
import type { WorkflowNode, WorkflowEdge } from '@/lib/types/graph';

export function useNodeDetails() {
  const selectedNode = useSelectedNode();
  const edges = useWorkflowStore((s) => s.edges);
  const nodes = useWorkflowStore((s) => s.nodes);

  const connectedFiles = useMemo(() => {
    if (!selectedNode) return { importedBy: [], importing: [] };

    const importedBy: WorkflowNode[] = [];
    const importing: WorkflowNode[] = [];

    for (const edge of edges) {
      if (edge.target === selectedNode.id) {
        const src = nodes.find((n) => n.id === edge.source);
        if (src) importedBy.push(src);
      }
      if (edge.source === selectedNode.id) {
        const tgt = nodes.find((n) => n.id === edge.target);
        if (tgt) importing.push(tgt);
      }
    }

    return { importedBy, importing };
  }, [selectedNode, edges, nodes]);

  const connectedEdges = useMemo(() => {
    if (!selectedNode) return [];
    return edges.filter(
      (e) => e.source === selectedNode.id || e.target === selectedNode.id
    );
  }, [selectedNode, edges]);

  return { selectedNode, connectedFiles, connectedEdges };
}
