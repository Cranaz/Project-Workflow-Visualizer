'use client';

import { memo } from 'react';
import { Handle, Position, type NodeProps } from 'reactflow';
import { Star } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import type { WorkflowNodeData } from '@/lib/types/graph';
import { getNodeTypeColor } from '@/lib/utils/colorUtils';

function EntryNodeComponent({ data, selected }: NodeProps<WorkflowNodeData>) {
  const color = getNodeTypeColor('entry');

  return (
    <div className="relative flex flex-col items-center group">
      {/* Target handle on Left in LR mode */}
      <Handle type="target" position={Position.Left} className="!bg-border-default !w-2 !h-2 !border-0" />

      {/* Decorative lightning or trigger icon offset to the left */}
      <div className="absolute -left-6 top-1/2 -translate-y-[calc(50%+1rem)] transition-colors duration-200" style={{ color }}>
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="none">
          <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
        </svg>
      </div>

      <div
        className="w-[100px] h-[80px] rounded-l-[40px] rounded-r-xl bg-[#232731] border border-[#3A4150] shadow-xl flex items-center justify-center transition-all duration-200"
        style={{
          boxShadow: selected
            ? `0 0 0 2px ${color}, 0 8px 32px rgba(0,0,0,0.6)`
            : '0 8px 24px rgba(0,0,0,0.4)',
        }}
        aria-label={`Entry point: ${data.label}`}
      >
        <Star size={32} style={{ color }} strokeWidth={1.5} className="opacity-90" />
      </div>

      {/* Label outside below the node */}
      <div className="mt-4 text-center w-36 pb-2">
        <p className="text-[13px] font-medium text-gray-200 break-words leading-snug">{data.label}</p>
        <p className="text-[10px] text-gray-500 mt-1 uppercase tracking-wider">{data.subsystem || 'Trigger'}</p>
      </div>

      {/* Source handle on Right */}
      <Handle type="source" position={Position.Right} className="!bg-[#555] !w-2 !h-2 !border-0" />
    </div>
  );
}

export const EntryNode = memo(EntryNodeComponent);
