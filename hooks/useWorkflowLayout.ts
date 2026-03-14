'use client';

import { useCallback, useEffect, useRef } from 'react';
import { useWorkflowStore, useFilteredNodes, useFilteredEdges } from '@/lib/store/workflowStore';
import { computeLayout, computeClusterLayout } from '@/lib/graph/layoutEngine';

export function useWorkflowLayout() {
  const nodes = useFilteredNodes();
  const edges = useFilteredEdges();
  const layoutDirection = useWorkflowStore((s) => s.layoutDirection);
  const isClusterMode = useWorkflowStore((s) => s.isClusterMode);
  const updateNodePositions = useWorkflowStore((s) => s.updateNodePositions);
  const hasBootLayout = useRef(false);

  const applyLayout = useCallback(() => {
    if (nodes.length === 0) return;

    const options = {
      direction: layoutDirection,
      rankSep: 120,
      nodeSep: 80,
    };

    const positions = isClusterMode
      ? computeClusterLayout(nodes, edges, options)
      : computeLayout(nodes, edges, options);

    updateNodePositions(positions);
  }, [nodes, edges, layoutDirection, isClusterMode, updateNodePositions]);

  // Re-layout when direction or cluster mode changes
  useEffect(() => {
    if (!nodes.length) return;
    if (!hasBootLayout.current) {
      hasBootLayout.current = true;
      return;
    }
    applyLayout();
  }, [layoutDirection, isClusterMode]); // eslint-disable-line react-hooks/exhaustive-deps

  return { applyLayout };
}
