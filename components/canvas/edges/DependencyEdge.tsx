'use client';

import { memo } from 'react';
import { type EdgeProps, getBezierPath } from 'reactflow';
import type { WorkflowEdgeData } from '@/lib/types/graph';

function DependencyEdgeComponent({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  selected,
}: EdgeProps<WorkflowEdgeData>) {
  const [edgePath] = getBezierPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  });

  return (
    <path
      id={id}
      d={edgePath}
      fill="none"
      stroke="var(--border-default)"
      strokeWidth={selected ? 2 : 1}
      markerEnd="url(#arrow)"
      style={{ opacity: selected ? 0.8 : 0.4 }}
    />
  );
}

export const DependencyEdge = memo(DependencyEdgeComponent);
