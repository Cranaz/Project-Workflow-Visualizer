'use client';

import { memo } from 'react';
import { type EdgeProps, getBezierPath, EdgeLabelRenderer } from 'reactflow';
import type { WorkflowEdgeData } from '@/lib/types/graph';
import { getEdgeTypeColor } from '@/lib/utils/colorUtils';

function DataFlowEdgeComponent({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  selected,
}: EdgeProps<WorkflowEdgeData>) {
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  });

  const edgeType = data?.edgeType ?? 'dataflow';
  const color = getEdgeTypeColor(edgeType);
  const isInferred = edgeType === 'inferred';
  const isApiCall = edgeType === 'api_call';
  const isDbQuery = edgeType === 'db_query';

  return (
    <>
      <path
        id={id}
        className={isInferred || isApiCall || isDbQuery ? 'edge-flow-path' : ''}
        d={edgePath}
        fill="none"
        stroke={color}
        strokeWidth={selected ? 2.5 : 1.5}
        strokeDasharray={isInferred ? '6 4' : undefined}
        markerEnd="url(#arrow)"
        style={{ opacity: selected ? 1 : 0.6 }}
      />
      {/* Animated dot along the path */}
      {(isApiCall || isDbQuery) && (
        <circle r="3" fill={color}>
          <animateMotion dur="2s" repeatCount="indefinite" path={edgePath} />
        </circle>
      )}
      {data?.label && (
        <EdgeLabelRenderer>
          <div
            className="absolute px-1.5 py-0.5 rounded text-[9px] font-medium pointer-events-none"
            style={{
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
              backgroundColor: isInferred ? '#A855F720' : `${color}15`,
              color: color,
              border: `1px solid ${color}30`,
            }}
          >
            {isInferred && <span className="mr-1">AI</span>}
            {data.label}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}

export const DataFlowEdge = memo(DataFlowEdgeComponent);
