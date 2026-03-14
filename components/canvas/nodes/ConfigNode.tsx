'use client';

import { memo } from 'react';
import { Handle, Position, type NodeProps } from 'reactflow';
import { Settings } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import type { WorkflowNodeData } from '@/lib/types/graph';
import { getNodeTypeColor } from '@/lib/utils/colorUtils';

function ConfigNodeComponent({ data, selected }: NodeProps<WorkflowNodeData>) {
  const color = getNodeTypeColor('config');

  return (
    <div
      className="relative rounded-xl bg-[#232731] border border-[#3A4150] flex items-center p-3 pr-6 min-w-[200px] transition-all duration-200"
      style={{
        boxShadow: selected
          ? `0 0 0 2px ${color}, 0 8px 32px rgba(0,0,0,0.6)`
          : '0 4px 20px rgba(0,0,0,0.3)',
      }}
      aria-label={`Config: ${data.label}`}
    >
      <Handle type="target" position={Position.Left} className="!bg-[#555] !w-2 !h-2 !border-0" />
      
      <div className="flex items-center justify-center w-10 h-10 rounded-lg shrink-0" style={{ backgroundColor: `${color}15` }}>
        <Settings size={20} style={{ color }} />
      </div>

      <div className="ml-4 flex-1 min-w-0">
        <p className="text-[12px] font-medium text-gray-200 truncate">{data.label}</p>
        <p className="text-[10px] text-gray-400 mt-1 uppercase tracking-wider truncate">
          Configuration
        </p>
      </div>

      <Handle type="source" position={Position.Right} className="!bg-[#555] !w-2 !h-2 !border-0" />
    </div>
  );
}

export const ConfigNode = memo(ConfigNodeComponent);
