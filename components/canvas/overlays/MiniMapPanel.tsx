'use client';

import { MiniMap } from 'reactflow';
import { getNodeTypeColor } from '@/lib/utils/colorUtils';
import type { NodeType } from '@/lib/types/graph';

export function MiniMapPanel() {
  return (
    <MiniMap
      nodeColor={(node) => {
        const nodeType = (node.type ?? 'service') as NodeType;
        return getNodeTypeColor(nodeType);
      }}
      maskColor="rgba(10, 10, 15, 0.7)"
      style={{
        backgroundColor: 'var(--bg-surface)',
        border: '1px solid var(--border-muted)',
        borderRadius: '8px',
      }}
      pannable
      zoomable
      ariaLabel="Mini map of the workflow graph"
    />
  );
}
